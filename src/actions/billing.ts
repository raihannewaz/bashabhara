"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getRenter, requireTenant } from "@/lib/tenant";
import { phoneSchema } from "@/lib/phone";

const statusFor = (total: number, paid: number) => (paid <= 0 ? "UNPAID" : paid >= total ? "PAID" : "PARTIAL") as "UNPAID" | "PARTIAL" | "PAID";
const prevMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

type Item = { headName: string; amount: number; previousUnit?: number; currentUnit?: number; unitRate?: number; demandCharge?: number };

/** One-click bulk generator. readings maps flatId to the current meter unit for METERED heads. */
export async function generateBulkInvoices(month: string, readings: Record<string, number> = {}) {
  z.string().regex(/^\d{4}-\d{2}$/).parse(month);
  const ownerId = await requireTenant(["GENERATE_BILLS", "ENTER_METER_READING"]);
  const flats = await db.flat.findMany({ where: { ownerId, status: "OCCUPIED" }, include: { renter: true } });
  let created = 0;
  for (const flat of flats) {
    if (await db.invoice.findUnique({ where: { flatId_month: { flatId: flat.id, month } } })) continue;
    const heads = await db.billingHead.findMany({ where: { ownerId, OR: [{ flatId: flat.id }, { buildingId: flat.buildingId, flatId: null }] } });
    const prev = await db.invoice.findUnique({ where: { flatId_month: { flatId: flat.id, month: prevMonth(month) } }, include: { items: true } });
    // dues only carry over within the current renter's stay
    const carry = !!prev && (!flat.renter || prev.month >= flat.renter.moveInDate.toISOString().slice(0, 7));
    const previousDue = carry ? prev!.dueAmount : 0;
    const items: Item[] = [{ headName: "Base Rent", amount: flat.baseRent }];
    for (const h of heads) {
      if (h.type === "FIXED") { items.push({ headName: h.name, amount: h.fixedAmount }); continue; }
      const previousUnit = prev?.items.find((i) => i.headName === h.name)?.currentUnit ?? 0;
      const currentUnit = readings[flat.id] ?? previousUnit;
      if (currentUnit < previousUnit) throw new Error(`Meter reading for ${flat.label} is below the previous reading (${previousUnit})`);
      items.push({ headName: h.name, previousUnit, currentUnit, unitRate: h.unitRate, demandCharge: h.demandCharge, amount: (currentUnit - previousUnit) * h.unitRate + h.demandCharge });
    }
    const totalAmount = items.reduce((s, i) => s + i.amount, 0) + previousDue;
    await db.invoice.create({ data: { ownerId, flatId: flat.id, month, previousDue, totalAmount, dueAmount: totalAmount, items: { create: items } } });
    created++;
  }
  return { created };
}

/** Renter submits a manual TrxID payment; partial amounts are allowed. */
export async function submitPayment(input: { invoiceId: string; paidAmount: number; transactionId: string; senderNumber: string; screenshotUrl?: string }) {
  const renter = await getRenter();
  if (!renter) throw new Error("Forbidden");
  const d = z.object({ invoiceId: z.string(), paidAmount: z.number().positive(), transactionId: z.string().min(4), senderNumber: phoneSchema, screenshotUrl: z.string().startsWith("/api/files/").optional() }).parse(input);
  const inv = await db.invoice.findFirst({ where: { id: d.invoiceId, flatId: renter.flatId } });
  if (!inv) throw new Error("Invoice not found");
  if (d.paidAmount > inv.dueAmount) throw new Error("Amount exceeds the due balance");
  return db.payment.create({ data: { ...d, ownerId: inv.ownerId, renterName: renter.user.name } });
}

/** Approve: updates invoice paid, due and status atomically. */
export async function approvePayment(paymentId: string) {
  const ownerId = await requireTenant("APPROVE_PAYMENTS");
  return db.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id: paymentId, ownerId, status: "PENDING" }, include: { invoice: { include: { items: true } } } });
    if (!p) throw new Error("Pending payment not found");
    const paid = p.invoice.paidAmount + p.paidAmount;
    await tx.payment.update({ where: { id: p.id }, data: { status: "APPROVED", approvedAt: new Date(), snapshot: { items: p.invoice.items.map((i) => ({ name: i.headName, amount: i.amount })), previousDue: p.invoice.previousDue, total: p.invoice.totalAmount, dueAfter: Math.max(p.invoice.totalAmount - paid, 0) } } });
    return tx.invoice.update({ where: { id: p.invoiceId }, data: { paidAmount: paid, dueAmount: Math.max(p.invoice.totalAmount - paid, 0), status: statusFor(p.invoice.totalAmount, paid) } });
  });
}

export async function rejectPayment(paymentId: string, reason: string) {
  const ownerId = await requireTenant("APPROVE_PAYMENTS");
  const r = await db.payment.updateMany({ where: { id: paymentId, ownerId, status: "PENDING" }, data: { status: "REJECTED", rejectReason: z.string().min(2).parse(reason) } });
  if (!r.count) throw new Error("Pending payment not found");
}

/** Move-out: balance > 0 is refunded to the renter, balance < 0 is still owed by them. */
export async function moveOutSettlement(flatId: string) {
  const ownerId = await requireTenant("VIEW_FLATS");
  const renter = await db.renter.findFirst({ where: { flatId, ownerId } });
  if (!renter) throw new Error("No renter in this flat");
  const latest = await db.invoice.findFirst({ where: { flatId, ownerId }, orderBy: { month: "desc" } });
  const finalDue = latest?.dueAmount ?? 0; // dueAmount already carries earlier dues forward
  return { advanceDeposit: renter.advanceDeposit, finalDue, balance: renter.advanceDeposit - finalDue };
}

/** Changes one line item and recalculates the invoice total, due and status. */
export async function adjustInvoiceItem(itemId: string, amount: number) {
  const ownerId = await requireTenant("GENERATE_BILLS");
  z.number().min(0).parse(amount);
  await db.$transaction(async (tx) => {
    const item = await tx.invoiceItem.findFirst({ where: { id: itemId, invoice: { ownerId } } });
    if (!item) throw new Error("Item not found");
    await tx.invoiceItem.update({ where: { id: itemId }, data: { amount } });
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: item.invoiceId }, include: { items: true } });
    const total = inv.items.reduce((sum, i) => sum + i.amount, 0) + inv.previousDue;
    await tx.invoice.update({ where: { id: inv.id }, data: { totalAmount: total, dueAmount: Math.max(total - inv.paidAmount, 0), status: statusFor(total, inv.paidAmount) } });
  });
}

/** Sends an approved or rejected payment back to the pending queue, undoing its effect on the invoice. */
export async function revertPayment(paymentId: string) {
  const ownerId = await requireTenant("APPROVE_PAYMENTS");
  await db.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id: paymentId, ownerId, status: { not: "PENDING" } }, include: { invoice: true } });
    if (!p) throw new Error("Payment not found");
    if (p.status === "APPROVED") {
      const paid = Math.max(p.invoice.paidAmount - p.paidAmount, 0);
      await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidAmount: paid, dueAmount: Math.max(p.invoice.totalAmount - paid, 0), status: statusFor(p.invoice.totalAmount, paid) } });
    }
    await tx.payment.update({ where: { id: p.id }, data: { status: "PENDING", rejectReason: null, approvedAt: null, snapshot: Prisma.JsonNull } });
  });
}
