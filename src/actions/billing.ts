"use server";
import crypto from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getRenter, requireScope } from "@/lib/tenant";
import { phoneSchema } from "@/lib/phone";
import { audit } from "@/lib/audit";
import { carryOver, creditToApply, dueDateFor, invoiceTotal, meteredAmount, round2, splitPayment, statusFor } from "@/lib/money";

const prevMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

type Item = { headName: string; amount: number; previousUnit?: number; currentUnit?: number; unitRate?: number; demandCharge?: number };

/** One-click bulk generator. readings maps flatId to the current meter unit for METERED heads. Reads once, writes in one transaction. */
export async function generateBulkInvoices(month: string, readings: Record<string, number> = {}) {
  z.string().regex(/^\d{4}-\d{2}$/).parse(month);
  const { ownerId, flat: scope } = await requireScope(["GENERATE_BILLS", "ENTER_METER_READING"]);
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { dueDay: true } });
  const flats = await db.flat.findMany({ where: { ownerId, status: "OCCUPIED", ...scope }, include: { renter: true } });
  if (flats.length === 0) return { created: 0 };
  const flatIds = flats.map((f) => f.id);
  const [existing, heads, prevInvoices] = await Promise.all([
    db.invoice.findMany({ where: { flatId: { in: flatIds }, month }, select: { flatId: true } }),
    db.billingHead.findMany({ where: { ownerId } }),
    db.invoice.findMany({ where: { flatId: { in: flatIds }, month: prevMonth(month) }, include: { items: true } }),
  ]);
  const done = new Set(existing.map((e) => e.flatId));
  const prevBy = new Map(prevInvoices.map((i) => [i.flatId, i]));

  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const itemRows: Prisma.InvoiceItemCreateManyInput[] = [];
  const creditUpdates: Prisma.PrismaPromise<unknown>[] = [];
  for (const flat of flats) {
    if (done.has(flat.id)) continue;
    const prev = prevBy.get(flat.id);
    const previousDue = carryOver(prev ? { month: prev.month, dueAmount: prev.dueAmount } : null, flat.renter ? flat.renter.moveInDate.toISOString().slice(0, 7) : null);
    const items: Item[] = [{ headName: "Base Rent", amount: flat.baseRent }];
    for (const h of heads.filter((x) => x.flatId === flat.id || (x.buildingId === flat.buildingId && !x.flatId))) {
      if (h.type === "FIXED") { items.push({ headName: h.name, amount: h.fixedAmount }); continue; }
      const previousUnit = prev?.items.find((i) => i.headName === h.name)?.currentUnit ?? 0;
      const currentUnit = readings[flat.id] ?? previousUnit;
      items.push({ headName: h.name, previousUnit, currentUnit, unitRate: h.unitRate, demandCharge: h.demandCharge, amount: meteredAmount(previousUnit, currentUnit, h.unitRate, h.demandCharge) });
    }
    const credit = creditToApply(invoiceTotal(items.map((i) => i.amount), previousDue), flat.creditBalance);
    if (credit > 0) {
      items.push({ headName: "Advance credit applied", amount: -credit });
      creditUpdates.push(db.flat.update({ where: { id: flat.id }, data: { creditBalance: { decrement: credit } } }));
    }
    const totalAmount = invoiceTotal(items.map((i) => i.amount), previousDue);
    const id = crypto.randomUUID();
    invoiceRows.push({ id, ownerId, flatId: flat.id, month, dueDate: dueDateFor(month, owner.dueDay), previousDue, totalAmount, dueAmount: totalAmount, status: statusFor(totalAmount, 0) });
    for (const i of items) itemRows.push({ invoiceId: id, ...i });
  }
  if (invoiceRows.length > 0) await db.$transaction([db.invoice.createMany({ data: invoiceRows }), db.invoiceItem.createMany({ data: itemRows }), ...creditUpdates]);
  await audit(ownerId, "Generated invoices", `${month}: ${invoiceRows.length} created`);
  return { created: invoiceRows.length };
}

/** Renter submits a manual TrxID payment. Paying more than the due is allowed; the excess becomes advance credit once approved. */
export async function submitPayment(input: { invoiceId: string; paidAmount: number; transactionId: string; senderNumber: string; screenshotUrl?: string }) {
  const renter = await getRenter();
  if (!renter) throw new Error("Forbidden");
  const d = z.object({ invoiceId: z.string(), paidAmount: z.number().positive(), transactionId: z.string().min(4), senderNumber: phoneSchema, screenshotUrl: z.string().startsWith("/api/files/").optional() }).parse(input);
  const inv = await db.invoice.findFirst({ where: { id: d.invoiceId, flatId: renter.flatId } });
  if (!inv) throw new Error("Invoice not found");
  return db.payment.create({ data: { ...d, ownerId: inv.ownerId, renterName: renter.user.name, method: "TRX" } });
}

const snapshotOf = (inv: { items: { headName: string; amount: number }[]; previousDue: number; totalAmount: number }, dueAfter: number) =>
  ({ items: inv.items.map((i) => ({ name: i.headName, amount: i.amount })), previousDue: inv.previousDue, total: inv.totalAmount, dueAfter });

/** Approve: settles the invoice up to its due, keeps any excess as advance credit, all in one transaction. */
export async function approvePayment(paymentId: string) {
  const { ownerId, flat } = await requireScope("APPROVE_PAYMENTS");
  const res = await db.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id: paymentId, ownerId, status: "PENDING", invoice: { flat } }, include: { invoice: { include: { items: true, flat: true } } } });
    if (!p) throw new Error("Pending payment not found");
    const { applied, excess } = splitPayment(p.invoice.dueAmount, p.paidAmount);
    const paid = round2(p.invoice.paidAmount + applied);
    const dueAfter = Math.max(round2(p.invoice.totalAmount - paid), 0);
    await tx.payment.update({ where: { id: p.id }, data: { status: "APPROVED", approvedAt: new Date(), creditAdded: excess, snapshot: snapshotOf(p.invoice, dueAfter) } });
    if (excess > 0) await tx.flat.update({ where: { id: p.invoice.flatId }, data: { creditBalance: { increment: excess } } });
    await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidAmount: paid, dueAmount: dueAfter, status: statusFor(p.invoice.totalAmount, paid) } });
    return `flat ${p.invoice.flat.label} ${p.invoice.month}, ৳${p.paidAmount}, ${p.transactionId}`;
  });
  await audit(ownerId, "Approved payment", res);
}

export async function rejectPayment(paymentId: string, reason: string) {
  const { ownerId, flat } = await requireScope("APPROVE_PAYMENTS");
  const why = z.string().min(2).parse(reason);
  const r = await db.payment.updateMany({ where: { id: paymentId, ownerId, status: "PENDING", invoice: { flat } }, data: { status: "REJECTED", rejectReason: why } });
  if (!r.count) throw new Error("Pending payment not found");
  await audit(ownerId, "Rejected payment", why);
}

/** Records money received in person or outside the app (cash, bKash, bank) and approves it immediately. */
export async function recordPayment(input: { invoiceId: string; amount: number; method: string; reference?: string }) {
  const { ownerId, flat } = await requireScope("APPROVE_PAYMENTS");
  const d = z.object({ invoiceId: z.string(), amount: z.number().positive(), method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "UPAY", "BANK"]), reference: z.string().optional() }).parse(input);
  const by = (await auth())?.user?.name ?? null;
  const pid = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({ where: { id: d.invoiceId, ownerId, flat }, include: { items: true, flat: { include: { renter: { include: { user: true } } } } } });
    if (!inv) throw new Error("Invoice not found");
    const { applied, excess } = splitPayment(inv.dueAmount, d.amount);
    const paid = round2(inv.paidAmount + applied);
    const dueAfter = Math.max(round2(inv.totalAmount - paid), 0);
    const p = await tx.payment.create({
      data: {
        ownerId, invoiceId: inv.id, paidAmount: d.amount, transactionId: d.reference?.trim() || `${d.method}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        senderNumber: inv.flat.renter?.phone ?? "-", status: "APPROVED", approvedAt: new Date(), renterName: inv.flat.renter?.user.name ?? null,
        method: d.method, creditAdded: excess, recordedBy: by, snapshot: snapshotOf(inv, dueAfter),
      },
    });
    if (excess > 0) await tx.flat.update({ where: { id: inv.flatId }, data: { creditBalance: { increment: excess } } });
    await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, dueAmount: dueAfter, status: statusFor(inv.totalAmount, paid) } });
    return p.id;
  });
  await audit(ownerId, "Recorded payment", `${d.method} ৳${d.amount}`);
  return pid;
}

/** Changes one line item and recalculates the invoice total, due and status. */
export async function adjustInvoiceItem(itemId: string, amount: number) {
  const { ownerId, flat } = await requireScope("GENERATE_BILLS");
  z.number().min(-10_000_000).max(10_000_000).parse(amount);
  const note = await db.$transaction(async (tx) => {
    const item = await tx.invoiceItem.findFirst({ where: { id: itemId, invoice: { ownerId, flat } }, include: { invoice: { include: { flat: true } } } });
    if (!item) throw new Error("Item not found");
    await tx.invoiceItem.update({ where: { id: itemId }, data: { amount } });
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: item.invoiceId }, include: { items: true } });
    const total = invoiceTotal(inv.items.map((i) => i.amount), inv.previousDue);
    await tx.invoice.update({ where: { id: inv.id }, data: { totalAmount: total, dueAmount: Math.max(round2(total - inv.paidAmount), 0), status: statusFor(total, inv.paidAmount) } });
    return `flat ${item.invoice.flat.label} ${item.invoice.month}: ${item.headName} ৳${item.amount} to ৳${amount}`;
  });
  await audit(ownerId, "Adjusted invoice", note);
}

/** Adds the landlord's late fee, once, to each flat's latest unpaid invoice that is past its due date. */
export async function applyLateFees() {
  const { ownerId, flat } = await requireScope("GENERATE_BILLS");
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { lateFee: true } });
  if (owner.lateFee <= 0) throw new Error("Set a late fee under Setup, Rent rules first");
  const all = await db.invoice.findMany({ where: { ownerId, flat }, orderBy: { month: "desc" }, include: { items: true } });
  const latest = new Map<string, (typeof all)[number]>();
  for (const i of all) if (!latest.has(i.flatId)) latest.set(i.flatId, i);
  const now = new Date();
  let count = 0;
  for (const inv of latest.values()) {
    if (!inv.dueDate || inv.dueDate >= now || inv.dueAmount <= 0 || inv.items.some((i) => i.headName === "Late fee")) continue;
    const total = invoiceTotal([...inv.items.map((i) => i.amount), owner.lateFee], inv.previousDue);
    await db.$transaction([
      db.invoiceItem.create({ data: { invoiceId: inv.id, headName: "Late fee", amount: owner.lateFee } }),
      db.invoice.update({ where: { id: inv.id }, data: { totalAmount: total, dueAmount: Math.max(round2(total - inv.paidAmount), 0), status: statusFor(total, inv.paidAmount) } }),
    ]);
    count++;
  }
  await audit(ownerId, "Applied late fees", `${count} invoice(s), ৳${owner.lateFee} each`);
  return { count };
}

/** Sends an approved or rejected payment back to the pending queue, undoing its effect on the invoice and credit. */
export async function revertPayment(paymentId: string) {
  const { ownerId, flat } = await requireScope("APPROVE_PAYMENTS");
  const note = await db.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id: paymentId, ownerId, status: { not: "PENDING" }, invoice: { flat } }, include: { invoice: { include: { flat: true } } } });
    if (!p) throw new Error("Payment not found");
    if (p.status === "APPROVED") {
      if (p.creditAdded > p.invoice.flat.creditBalance + 0.001) throw new Error("The advance credit from this payment was already used on a later bill, so it cannot be undone");
      const paid = Math.max(round2(p.invoice.paidAmount - (p.paidAmount - p.creditAdded)), 0);
      if (p.creditAdded > 0) await tx.flat.update({ where: { id: p.invoice.flatId }, data: { creditBalance: { decrement: p.creditAdded } } });
      await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidAmount: paid, dueAmount: Math.max(round2(p.invoice.totalAmount - paid), 0), status: statusFor(p.invoice.totalAmount, paid) } });
    }
    await tx.payment.update({ where: { id: p.id }, data: { status: "PENDING", rejectReason: null, approvedAt: null, creditAdded: 0, snapshot: Prisma.JsonNull } });
    return `flat ${p.invoice.flat.label} ${p.invoice.month}, ৳${p.paidAmount}, ${p.transactionId}`;
  });
  await audit(ownerId, "Undid payment decision", note);
}
