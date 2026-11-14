"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ALL_PERMISSIONS, getAccess } from "@/lib/tenant";
import { phoneSchema } from "@/lib/phone";
import { runAction } from "@/lib/run";
import { audit } from "@/lib/audit";

const run = (fn: () => Promise<unknown>) => runAction("/dashboard/staff", fn);
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function ownerOnly() {
  const a = await getAccess();
  if (!a?.isOwner) throw new Error("Only the landlord can manage staff");
  return a;
}
const base = z.object({ name: z.string().min(2), phone: phoneSchema, perms: z.array(z.enum(ALL_PERMISSIONS)) });
const read = (f: FormData) => ({ name: str(f, "name"), phone: str(f, "phone"), perms: f.getAll("perm").map(String) });
/** Staff can be limited to certain buildings; only buildings of this landlord are accepted. */
async function buildingsOf(ownerId: string, f: FormData) {
  const ids = f.getAll("building").map(String);
  if (ids.length === 0) return null;
  const ok = await db.building.findMany({ where: { ownerId, id: { in: ids } }, select: { id: true } });
  return ok.length ? ok.map((b) => b.id) : null;
}

export async function addStaff(f: FormData) {
  await run(async () => {
    const { ownerId, perms: allowed } = await ownerOnly();
    const d = base.extend({ password: z.string().min(6) }).parse({ ...read(f), password: str(f, "password") });
    const buildingIds = await buildingsOf(ownerId, f);
    await db.user.create({ data: { name: d.name, phone: d.phone, password: await bcrypt.hash(d.password, 10), role: "STAFF", ownerId, permissions: d.perms.filter((p) => allowed.includes(p)), buildingIds: buildingIds ?? undefined } });
    await audit(ownerId, "Added staff", d.name);
  });
}
export async function updateStaff(f: FormData) {
  await run(async () => {
    const { ownerId, perms: allowed } = await ownerOnly();
    const d = base.extend({ password: z.string().min(6).optional() }).parse({ ...read(f), password: str(f, "password") || undefined });
    const r = await db.user.updateMany({
      where: { id: str(f, "id"), ownerId, role: "STAFF" },
      data: { name: d.name, phone: d.phone, permissions: d.perms.filter((p) => allowed.includes(p)), buildingIds: (await buildingsOf(ownerId, f)) ?? Prisma.DbNull, active: f.get("active") === "on", ...(d.password ? { password: await bcrypt.hash(d.password, 10) } : {}) },
    });
    if (!r.count) throw new Error("Staff member not found");
    await audit(ownerId, "Edited staff", d.name);
  });
}
export async function deleteStaff(f: FormData) {
  await run(async () => {
    const { ownerId } = await ownerOnly();
    await db.user.deleteMany({ where: { id: str(f, "id"), ownerId, role: "STAFF" } });
    await audit(ownerId, "Deleted staff");
  });
}
