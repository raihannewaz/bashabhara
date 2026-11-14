import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getRenter, requireScope } from "@/lib/tenant";
import { billDoc } from "@/lib/bill";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = (await auth())?.user;
  if (!u) return new Response("Unauthorized", { status: 401 });

  let where: { id: string; flatId?: string; ownerId?: string; flat?: object } = { id };
  if (u.role === "RENTER") {
    const r = await getRenter();
    if (!r) return new Response("Forbidden", { status: 403 });
    where = { id, flatId: r.flatId };
  } else {
    try {
      const sc = await requireScope(["GENERATE_BILLS", "APPROVE_PAYMENTS"]);
      where = { id, ownerId: sc.ownerId, flat: sc.flat };
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }
  const inv = await db.invoice.findFirst({ where, include: { items: true, flat: { include: { building: true, renter: { include: { user: true } } } } } });
  if (!inv) return new Response("Bill not found", { status: 404 });
  const accounts = await db.paymentAccount.findMany({ where: { ownerId: inv.ownerId } });

  const buf = await renderToBuffer(billDoc({
    building: inv.flat.building.name, flat: inv.flat.label, renter: inv.flat.renter?.user.name ?? "-", month: inv.month,
    dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "-",
    items: inv.items.map((i) => ({ name: i.headName, amount: i.amount })), previousDue: inv.previousDue, total: inv.totalAmount, paid: inv.paidAmount, due: inv.dueAmount,
    accounts: accounts.map((a) => `${a.method} ${a.number ?? ""}${a.bankName ? ` ${a.bankName}${a.branch ? ` (${a.branch})` : ""}${a.routingNo ? ` routing ${a.routingNo}` : ""}` : ""}`.trim()),
  }));
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="bill-${inv.month}-${inv.flat.label}.pdf"` } });
}
