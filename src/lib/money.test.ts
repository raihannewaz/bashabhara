import assert from "node:assert/strict";
import { test } from "node:test";
import { carryOver, creditToApply, daysOverdue, dueDateFor, invoiceTotal, meteredAmount, splitPayment, statusFor } from "./money.ts";
import { isBdMobile, normalizePhone } from "./phone-core.ts";

test("status follows paid against total", () => {
  assert.equal(statusFor(1000, 0), "UNPAID");
  assert.equal(statusFor(1000, 400), "PARTIAL");
  assert.equal(statusFor(1000, 1000), "PAID");
  assert.equal(statusFor(1000, 1200), "PAID");
  assert.equal(statusFor(0, 0), "PAID");
});

test("a partial payment settles part of the invoice", () => {
  assert.deepEqual(splitPayment(1000, 400), { applied: 400, excess: 0 });
});

test("an overpayment becomes advance credit", () => {
  assert.deepEqual(splitPayment(1000, 1500), { applied: 1000, excess: 500 });
  assert.deepEqual(splitPayment(0, 700), { applied: 0, excess: 700 });
});

test("metered charge is units times rate plus demand charge", () => {
  assert.equal(meteredAmount(100, 160, 8.5, 150), 660);
  assert.equal(meteredAmount(100, 100, 8.5, 150), 150);
  assert.throws(() => meteredAmount(100, 90, 8.5, 150));
});

test("credit never exceeds the invoice or the balance held", () => {
  assert.equal(creditToApply(1000, 300), 300);
  assert.equal(creditToApply(1000, 5000), 1000);
  assert.equal(creditToApply(0, 500), 0);
  assert.equal(creditToApply(1000, -20), 0);
});

test("dues carry over only within the current renter's stay", () => {
  assert.equal(carryOver(null, "2026-01"), 0);
  assert.equal(carryOver({ month: "2026-02", dueAmount: 800 }, "2026-01"), 800);
  assert.equal(carryOver({ month: "2025-12", dueAmount: 800 }, "2026-01"), 0);
  assert.equal(carryOver({ month: "2025-12", dueAmount: 800 }, null), 800);
});

test("invoice total adds items and previous due", () => {
  assert.equal(invoiceTotal([12000, 990, 400, -500], 1000), 13890);
});

test("due date stays inside the month", () => {
  assert.equal(dueDateFor("2026-02", 10).toISOString().slice(0, 10), "2026-02-10");
  assert.equal(dueDateFor("2026-02", 31).toISOString().slice(0, 10), "2026-02-28");
  assert.equal(dueDateFor("2026-02", 0).toISOString().slice(0, 10), "2026-02-10");
});

test("overdue days count only unpaid invoices past their due date", () => {
  const due = new Date("2026-03-10T00:00:00.000Z");
  assert.equal(daysOverdue(due, 500, new Date("2026-03-15T12:00:00.000Z")), 5);
  assert.equal(daysOverdue(due, 0, new Date("2026-03-15T12:00:00.000Z")), 0);
  assert.equal(daysOverdue(due, 500, new Date("2026-03-09T12:00:00.000Z")), 0);
  assert.equal(daysOverdue(null, 500, new Date()), 0);
});

test("phone numbers are normalised to one form", () => {
  for (const p of ["01711000001", "+8801711000001", "8801711000001", "01711-000001", "1711000001"]) assert.equal(normalizePhone(p), "01711000001");
  assert.ok(isBdMobile("01711000001"));
  assert.ok(!isBdMobile("0171100000"));
  assert.ok(!isBdMobile("02711000001"));
});
