import { db } from "@/lib/db";
import { requireScope, type Permission } from "@/lib/tenant";

export const runtime = "nodejs";

const esc = (v: string | number | null) => {
  if (v === null) return "";
  let t = String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(t)) t = `'${t}`; // stops spreadsheet formula injection
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const toCsv = (rows: (string | number | null)[][]) => "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  const month = new URL(req.url).searchParams.get("month");
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const perms: Record<string, Permission[]> = { invoices: ["GENERATE_BILLS"], payments: ["APPROVE_PAYMENTS"], expenses: ["MANAGE_EXPENSES", "VIEW_REPORTS"] };
  if (!perms[type]) return new Response("Not found", { status: 404 });

  let ownerId: string, flat: object;
  try {
    ({ ownerId, flat } = await requireScope(perms[type]));
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  let rows: (string | number | null)[][] = [];
  if (type === "invoices") {
    const list = await db.invoice.findMany({ where: { ownerId, flat, ...(m ? { month: m } : {}) }, orderBy: [{ month: "desc" }], include: { flat: { include: { building: true, renter: { include: { user: true } } } } } });
    rows = [["Month", "Building", "Flat", "Renter", "Due date", "Previous due", "Total", "Paid", "Due", "Status"], ...list.map((i) => [i.month, i.flat.building.name, i.flat.label, i.flat.renter?.user.name ?? "", day(i.dueDate), i.previousDue, i.totalAmount, i.paidAmount, i.dueAmount, i.status])];
  } else if (type === "payments") {
    const list = await db.payment.findMany({ where: { ownerId, invoice: { flat } }, orderBy: { createdAt: "desc" }, include: { invoice: { include: { flat: { include: { building: true } } } } } });
    const shown = m ? list.filter((p) => (p.approvedAt ?? p.createdAt).toISOString().startsWith(m)) : list;
    rows = [["Date", "Invoice month", "Building", "Flat", "Renter", "Method", "TrxID", "Sender", "Amount", "Added to credit", "Status", "Recorded by"], ...shown.map((p) => [day(p.approvedAt ?? p.createdAt), p.invoice.month, p.invoice.flat.building.name, p.invoice.flat.label, p.renterName ?? "", p.method ?? "", p.transactionId, p.senderNumber, p.paidAmount, p.creditAdded, p.status, p.recordedBy ?? ""])];
  } else {
    const [list, buildings] = await Promise.all([db.expense.findMany({ where: { ownerId }, orderBy: { date: "desc" } }), db.building.findMany({ where: { ownerId } })]);
    const shown = m ? list.filter((e) => e.date.toISOString().startsWith(m)) : list;
    rows = [["Date", "Category", "Building", "Amount", "Note"], ...shown.map((e) => [day(e.date), e.category, buildings.find((b) => b.id === e.buildingId)?.name ?? "All buildings", e.amount, e.note ?? ""])];
  }
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}${m ? `-${m}` : ""}.csv"` } });
}
