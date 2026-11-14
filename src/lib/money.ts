// Pure money and date rules. No imports, so they can be unit tested without a database.
export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function statusFor(total: number, paid: number): InvoiceStatus {
  if (total <= 0) return "PAID";
  if (paid <= 0) return "UNPAID";
  return paid >= total ? "PAID" : "PARTIAL";
}

/** Splits a payment into the part that settles the invoice and any excess that becomes advance credit. */
export function splitPayment(due: number, amount: number) {
  const applied = round2(Math.min(amount, Math.max(due, 0)));
  return { applied, excess: round2(Math.max(amount - applied, 0)) };
}

export function meteredAmount(previousUnit: number, currentUnit: number, unitRate: number, demandCharge: number) {
  if (currentUnit < previousUnit) throw new Error(`Current reading ${currentUnit} is below the previous reading ${previousUnit}`);
  return round2((currentUnit - previousUnit) * unitRate + demandCharge);
}

/** How much advance credit an invoice absorbs: never more than the invoice and never more than the credit held. */
export function creditToApply(subtotal: number, credit: number) {
  return round2(Math.min(Math.max(credit, 0), Math.max(subtotal, 0)));
}

/** Dues carry over only inside the current renter's stay, so a new renter never inherits an old balance. */
export function carryOver(previous: { month: string; dueAmount: number } | null, moveInMonth: string | null) {
  if (!previous) return 0;
  return moveInMonth === null || previous.month >= moveInMonth ? previous.dueAmount : 0;
}

export function invoiceTotal(itemAmounts: number[], previousDue: number) {
  return round2(itemAmounts.reduce((s, a) => s + a, 0) + previousDue);
}

/** Due date inside the invoice month; the day is kept between 1 and 28 so every month has it. */
export function dueDateFor(month: string, dueDay: number) {
  const d = Math.min(Math.max(Math.trunc(dueDay) || 10, 1), 28);
  return new Date(`${month}-${String(d).padStart(2, "0")}T00:00:00.000Z`);
}

export function daysOverdue(dueDate: Date | null, dueAmount: number, now: Date) {
  if (!dueDate || dueAmount <= 0) return 0;
  const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}
