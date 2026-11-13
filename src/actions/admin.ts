"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { runAction } from "@/lib/run";
import { phoneSchema } from "@/lib/phone";
import { ALL_PERMISSIONS } from "@/lib/tenant";

const run = (fn: () => Promise<unknown>) => runAction("/admin", fn);
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function adminOnly() {
  const u = (await auth())?.user;
  if (u?.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}
const owner = z.object({
  name: z.string().min(2), phone: phoneSchema, email: z.string().email().nullable(), plan: z.enum(["FREE", "PRO"]),
  flatLimit: z.number().int().min(0).nullable(), perms: z.array(z.enum(ALL_PERMISSIONS)),
});
const read = (f: FormData) => ({
  name: str(f, "name"), phone: str(f, "phone"), email: str(f, "email") || null, plan: str(f, "plan"),
  flatLimit: str(f, "flatLimit") === "" ? null : Number(f.get("flatLimit")), perms: f.getAll("perm").map(String),
});

/** Only the administrator creates landlords. Permissions limit which modules the landlord, and their staff, can use. */
export async function createOwner(f: FormData) {
  await run(async () => {
    await adminOnly();
    const d = owner.extend({ password: z.string().min(6) }).parse({ ...read(f), password: str(f, "password") });
    await db.user.create({ data: { name: d.name, phone: d.phone, email: d.email, plan: d.plan, flatLimit: d.flatLimit, permissions: d.perms, password: await bcrypt.hash(d.password, 10), role: "OWNER" } });
  });
}

/** Landlords are suspended, never deleted, so their records stay intact. */
export async function updateOwner(f: FormData) {
  await run(async () => {
    await adminOnly();
    const d = owner.extend({ password: z.string().min(6).optional() }).parse({ ...read(f), password: str(f, "password") || undefined });
    const r = await db.user.updateMany({
      where: { id: str(f, "id"), role: "OWNER" },
      data: { name: d.name, phone: d.phone, email: d.email, plan: d.plan, flatLimit: d.flatLimit, permissions: d.perms, active: f.get("active") === "on", ...(d.password ? { password: await bcrypt.hash(d.password, 10) } : {}) },
    });
    if (!r.count) throw new Error("Landlord not found");
  });
}

export async function approveSubscription(f: FormData) {
  await run(async () => {
    await adminOnly();
    await db.$transaction(async (tx) => {
      const p = await tx.subscriptionPayment.findFirst({ where: { id: str(f, "id"), status: "PENDING" } });
      if (!p) throw new Error("Pending payment not found");
      await tx.subscriptionPayment.update({ where: { id: p.id }, data: { status: "APPROVED" } });
      await tx.user.update({ where: { id: p.ownerId }, data: { plan: "PRO" } });
    });
  });
}

export async function rejectSubscription(f: FormData) {
  await run(async () => {
    await adminOnly();
    const r = await db.subscriptionPayment.updateMany({ where: { id: str(f, "id"), status: "PENDING" }, data: { status: "REJECTED", rejectReason: z.string().min(2).parse(str(f, "reason")) } });
    if (!r.count) throw new Error("Pending payment not found");
  });
}
