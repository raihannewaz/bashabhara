"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { runAction } from "@/lib/run";
import { saveUpload } from "@/lib/uploads";
import { getFlatLimit } from "@/lib/plan";
import { phoneSchema } from "@/lib/phone";

const TABS = ["buildings", "flats", "renters", "heads", "accounts", "former"];
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k) || 0);
/** Redirects back to the tab the form came from. */
const run = (f: FormData, fn: () => Promise<unknown>) => runAction(`/dashboard/setup?tab=${TABS.includes(str(f, "tab")) ? str(f, "tab") : "buildings"}`, fn);
const manage = () => requireTenant("MANAGE_PROPERTY");

async function assertNoHistory(ownerId: string, flatId: string) {
  const [inv, renter] = await Promise.all([db.invoice.count({ where: { flatId, ownerId } }), db.renter.count({ where: { flatId, ownerId } })]);
  if (inv || renter) throw new Error("A flat with a renter or billing history cannot be deleted. Set it to Maintenance instead.");
}
const ownedBuilding = async (ownerId: string, id: string) => {
  if (!(await db.building.findFirst({ where: { id, ownerId } }))) throw new Error("Building not found");
};

// ---------- Buildings ----------
const buildingSchema = z.object({ name: z.string().min(2), address: z.string().min(2) });
const readBuilding = (f: FormData) => ({ name: str(f, "name"), address: str(f, "address") });
export async function addBuilding(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    await db.building.create({ data: { ...buildingSchema.parse(readBuilding(f)), ownerId } });
  });
}
export async function updateBuilding(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const r = await db.building.updateMany({ where: { id: str(f, "id"), ownerId }, data: buildingSchema.parse(readBuilding(f)) });
    if (!r.count) throw new Error("Building not found");
  });
}
export async function deleteBuilding(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const id = str(f, "id");
    await ownedBuilding(ownerId, id);
    const flats = await db.flat.findMany({ where: { buildingId: id, ownerId }, select: { id: true } });
    for (const fl of flats) await assertNoHistory(ownerId, fl.id);
    await db.$transaction([
      db.billingHead.deleteMany({ where: { OR: [{ buildingId: id }, { flatId: { in: flats.map((x) => x.id) } }], ownerId } }),
      db.flat.deleteMany({ where: { buildingId: id, ownerId } }),
      db.expense.updateMany({ where: { buildingId: id, ownerId }, data: { buildingId: null } }),
      db.building.delete({ where: { id } }),
    ]);
  });
}

// ---------- Flats ----------
const flatSchema = z.object({ buildingId: z.string().min(1), label: z.string().min(1), baseRent: z.number().min(0) });
const readFlat = (f: FormData) => ({ buildingId: str(f, "buildingId"), label: str(f, "label"), baseRent: num(f, "baseRent") });
export async function addFlat(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const d = flatSchema.parse(readFlat(f));
    const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
    const limit = getFlatLimit(owner);
    if ((await db.flat.count({ where: { ownerId } })) >= limit) throw new Error(`Your plan allows ${limit} flats. Ask the administrator to upgrade you.`);
    await ownedBuilding(ownerId, d.buildingId);
    await db.flat.create({ data: { ...d, ownerId } });
  });
}
export async function updateFlat(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const d = flatSchema.extend({ status: z.enum(["VACANT", "OCCUPIED", "MAINTENANCE"]) }).parse({ ...readFlat(f), status: str(f, "status") });
    const flat = await db.flat.findFirst({ where: { id: str(f, "id"), ownerId }, include: { renter: true } });
    if (!flat) throw new Error("Flat not found");
    await ownedBuilding(ownerId, d.buildingId);
    if (d.status === "OCCUPIED" && !flat.renter) throw new Error("Add a renter to make this flat occupied");
    if (d.status !== "OCCUPIED" && flat.renter) throw new Error("Move the renter out before changing the status");
    await db.flat.update({ where: { id: flat.id }, data: d });
  });
}
export async function deleteFlat(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const id = str(f, "id");
    if (!(await db.flat.findFirst({ where: { id, ownerId } }))) throw new Error("Flat not found");
    await assertNoHistory(ownerId, id);
    await db.$transaction([db.billingHead.deleteMany({ where: { flatId: id, ownerId } }), db.flat.delete({ where: { id } })]);
  });
}

// ---------- Renters ----------
const renterFields = {
  name: z.string().min(2), phone: phoneSchema, whatsappNumber: phoneSchema,
  nidNumber: z.string().nullable(), emergencyContact: z.string().nullable(), moveInDate: z.string().min(8), advanceDeposit: z.number().min(0),
};
const readRenter = (f: FormData) => ({
  name: str(f, "name"), phone: str(f, "phone"), whatsappNumber: str(f, "whatsappNumber") || str(f, "phone"),
  nidNumber: str(f, "nidNumber") || null, emergencyContact: str(f, "emergencyContact") || null, moveInDate: str(f, "moveInDate"), advanceDeposit: num(f, "advanceDeposit"),
});
export async function addRenter(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const d = z.object({ ...renterFields, flatId: z.string().min(1), password: z.string().min(6) }).parse({ ...readRenter(f), flatId: str(f, "flatId"), password: str(f, "password") });
    const flat = await db.flat.findFirst({ where: { id: d.flatId, ownerId, status: "VACANT" } });
    if (!flat) throw new Error("Choose a vacant flat");
    const hash = await bcrypt.hash(d.password, 10);
    const nidFrontUrl = await saveUpload(f.get("nidFront"), ownerId);
    const nidBackUrl = await saveUpload(f.get("nidBack"), ownerId);
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: d.name, phone: d.phone, password: hash, role: "RENTER", ownerId } });
      await tx.renter.create({ data: { ownerId, userId: user.id, flatId: flat.id, phone: d.phone, whatsappNumber: d.whatsappNumber, nidNumber: d.nidNumber, nidFrontUrl, nidBackUrl, emergencyContact: d.emergencyContact, moveInDate: new Date(d.moveInDate), advanceDeposit: d.advanceDeposit } });
      await tx.flat.update({ where: { id: flat.id }, data: { status: "OCCUPIED" } });
    });
  });
}
export async function updateRenter(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const d = z.object({ ...renterFields, password: z.string().min(6).optional() }).parse({ ...readRenter(f), password: str(f, "password") || undefined });
    const r = await db.renter.findFirst({ where: { id: str(f, "id"), ownerId } });
    if (!r) throw new Error("Renter not found");
    const nidFrontUrl = await saveUpload(f.get("nidFront"), ownerId);
    const nidBackUrl = await saveUpload(f.get("nidBack"), ownerId);
    await db.$transaction([
      db.user.update({ where: { id: r.userId }, data: { name: d.name, phone: d.phone, ...(d.password ? { password: await bcrypt.hash(d.password, 10) } : {}) } }),
      db.renter.update({ where: { id: r.id }, data: { ...(nidFrontUrl ? { nidFrontUrl } : {}), ...(nidBackUrl ? { nidBackUrl } : {}), phone: d.phone, whatsappNumber: d.whatsappNumber, nidNumber: d.nidNumber, emergencyContact: d.emergencyContact, moveInDate: new Date(d.moveInDate), advanceDeposit: d.advanceDeposit } }),
    ]);
  });
}
/** Move-out archives the renter with the recorded refund, removes only their login, and frees the flat. */
export async function moveOut(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const r = await db.renter.findFirst({ where: { flatId: str(f, "flatId"), ownerId }, include: { user: true, flat: { include: { building: true } } } });
    if (!r) throw new Error("No renter in this flat");
    const refundPaid = num(f, "refund");
    if (refundPaid < 0 || refundPaid > r.advanceDeposit) throw new Error("Refund must be between 0 and the advance deposit");
    const last = await db.invoice.findFirst({ where: { flatId: r.flatId, ownerId }, orderBy: { month: "desc" } });
    await db.$transaction([
      db.formerRenter.create({ data: { ownerId, name: r.user.name, phone: r.phone, whatsappNumber: r.whatsappNumber, nidNumber: r.nidNumber, nidFrontUrl: r.nidFrontUrl, nidBackUrl: r.nidBackUrl, emergencyContact: r.emergencyContact, flatLabel: r.flat.label, buildingName: r.flat.building.name, moveInDate: r.moveInDate, advanceDeposit: r.advanceDeposit, finalDue: last?.dueAmount ?? 0, refundPaid, settlementNote: str(f, "note") || null } }),
      db.renter.delete({ where: { id: r.id } }),
      db.user.delete({ where: { id: r.userId } }),
      db.flat.update({ where: { id: r.flatId }, data: { status: "VACANT" } }),
    ]);
  });
}

// ---------- Billing heads ----------
const headSchema = z.object({ buildingId: z.string().min(1), name: z.string().min(2), type: z.enum(["FIXED", "METERED"]), fixedAmount: z.number().min(0), unitRate: z.number().min(0), demandCharge: z.number().min(0) });
const readHead = (f: FormData) => ({ buildingId: str(f, "buildingId"), name: str(f, "name"), type: str(f, "type"), fixedAmount: num(f, "fixedAmount"), unitRate: num(f, "unitRate"), demandCharge: num(f, "demandCharge") });
export async function addBillingHead(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const d = headSchema.parse(readHead(f));
    await ownedBuilding(ownerId, d.buildingId);
    await db.billingHead.create({ data: { ...d, ownerId } });
  });
}
export async function updateBillingHead(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const d = headSchema.parse(readHead(f));
    await ownedBuilding(ownerId, d.buildingId);
    const r = await db.billingHead.updateMany({ where: { id: str(f, "id"), ownerId }, data: d });
    if (!r.count) throw new Error("Billing head not found");
  });
}
export async function deleteBillingHead(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    await db.billingHead.deleteMany({ where: { id: str(f, "id"), ownerId } });
  });
}

// ---------- Payment accounts ----------
const accSchema = z.object({ method: z.enum(["bKash", "Nagad", "Rocket", "Upay", "Bank", "Cash"]), number: z.string().nullable(), bankName: z.string().nullable(), branch: z.string().nullable(), routingNo: z.string().nullable() });
const readAcc = (f: FormData) => ({ method: str(f, "method"), number: str(f, "number") || null, bankName: str(f, "bankName") || null, branch: str(f, "branch") || null, routingNo: str(f, "routingNo") || null });
export async function addPaymentAccount(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    await db.paymentAccount.create({ data: { ...accSchema.parse(readAcc(f)), ownerId } });
  });
}
export async function updatePaymentAccount(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    const r = await db.paymentAccount.updateMany({ where: { id: str(f, "id"), ownerId }, data: accSchema.parse(readAcc(f)) });
    if (!r.count) throw new Error("Account not found");
  });
}
export async function deletePaymentAccount(f: FormData) {
  await run(f, async () => {
    const ownerId = await manage();
    await db.paymentAccount.deleteMany({ where: { id: str(f, "id"), ownerId } });
  });
}
