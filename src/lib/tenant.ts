import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const ALL_PERMISSIONS = ["VIEW_FLATS", "MANAGE_PROPERTY", "ENTER_METER_READING", "GENERATE_BILLS", "APPROVE_PAYMENTS", "MANAGE_EXPENSES", "VIEW_REPORTS"] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  VIEW_FLATS: "View flats, renters and repair requests",
  MANAGE_PROPERTY: "Add and edit buildings, flats, renters, billing heads, accounts and notices",
  ENTER_METER_READING: "Enter meter readings and generate bills",
  GENERATE_BILLS: "Generate and adjust invoices, send reminders",
  APPROVE_PAYMENTS: "Approve, reject, undo and record payments",
  MANAGE_EXPENSES: "Add and edit expenses",
  VIEW_REPORTS: "View income and expense reports",
};

/** Permissions that cover the whole business, so they are not available to staff limited to certain buildings. */
export const OWNER_WIDE: Permission[] = ["MANAGE_PROPERTY", "MANAGE_EXPENSES", "VIEW_REPORTS"];

/** A stored permission list, or everything when none has been set. */
export const listOrAll = (v: unknown): Permission[] =>
  Array.isArray(v) ? ALL_PERMISSIONS.filter((p) => (v as string[]).includes(p)) : [...ALL_PERMISSIONS];

const idList = (v: unknown): string[] | null => (Array.isArray(v) && v.length > 0 ? (v as string[]) : null);

/**
 * Fresh access check on every request. A landlord's permissions are what the administrator allows;
 * staff get what the landlord ticked, limited to that. Staff limited to buildings lose the owner-wide permissions.
 */
export async function getAccess() {
  const u = (await auth())?.user;
  if (!u?.ownerId) return null;
  const owner = await db.user.findUnique({ where: { id: u.ownerId }, select: { active: true, permissions: true } });
  if (!owner?.active) return null;
  const allowed = listOrAll(owner.permissions);
  if (u.role === "OWNER") return { ownerId: u.ownerId, userId: u.id, isOwner: true, perms: allowed, buildingIds: null as string[] | null };
  if (u.role !== "STAFF") return null;
  const row = await db.user.findUnique({ where: { id: u.id }, select: { active: true, permissions: true, buildingIds: true } });
  if (!row?.active) return null;
  const buildingIds = idList(row.buildingIds);
  let perms = Array.isArray(row.permissions) ? listOrAll(row.permissions).filter((p) => allowed.includes(p)) : [];
  if (buildingIds) perms = perms.filter((p) => !OWNER_WIDE.includes(p));
  return { ownerId: u.ownerId, userId: u.id, isOwner: false, perms, buildingIds };
}

type Access = NonNullable<Awaited<ReturnType<typeof getAccess>>>;
/** Prisma filter that limits flats to the buildings a restricted staff member may see. */
export const flatScope = (a: Pick<Access, "buildingIds">): Prisma.FlatWhereInput => (a.buildingIds ? { buildingId: { in: a.buildingIds } } : {});

/** Like requireTenant, but also returns the flat filter for building-restricted staff. */
export async function requireScope(perm?: Permission | Permission[]) {
  const a = await getAccess();
  if (!a) throw new Error("Unauthorized");
  const need = perm === undefined ? [] : Array.isArray(perm) ? perm : [perm];
  if (need.length > 0 && !need.some((p) => a.perms.includes(p))) throw new Error("You do not have permission for this");
  return { ownerId: a.ownerId, flat: flatScope(a), buildingIds: a.buildingIds };
}

/** Landlord id every query must be scoped to; passes when the person holds any one of the given permissions. */
export async function requireTenant(perm?: Permission | Permission[]) {
  return (await requireScope(perm)).ownerId;
}

/** The signed-in renter, or null when logged out or when the renter or their landlord is suspended. */
export async function getRenter() {
  const u = (await auth())?.user;
  if (u?.role !== "RENTER" || !u.ownerId) return null;
  const [r, me, owner] = await Promise.all([
    db.renter.findUnique({ where: { userId: u.id }, include: { user: true, flat: { include: { building: true } } } }),
    db.user.findUnique({ where: { id: u.id }, select: { active: true } }),
    db.user.findUnique({ where: { id: u.ownerId }, select: { active: true } }),
  ]);
  return r && me?.active && owner?.active ? r : null;
}
