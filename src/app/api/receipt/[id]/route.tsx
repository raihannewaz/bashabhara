import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getRenter, requireTenant } from "@/lib/tenant";
import { receiptDoc } from "@/lib/receipt";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = (await auth())?.user;
  if (!u) return new Response("Unauthorized", { status: 401 });

  const p = await db.payment.findFirst({
    where: { id, status: "APPROVED" },
    include: { invoice: { include: { items: true, flat: { include: { building: true, renter: { include: { user: true } } } } } } },
  });
  if (!p) return new Response("Receipt not found", { status: 404 });

  if (u.role === "RENTER") {
    const r = await getRenter();
    if (!r || r.flatId !== p.invoice.flatId) return new Response("Forbidden", { status: 403 });
  } else {
    try {
      if ((await requireTenant(["APPROVE_PAYMENTS", "GENERATE_BILLS"])) !== p.ownerId) return new Response("Forbidden", { status: 403 });
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const inv = p.invoice;
  const snap = p.snapshot as { items: { name: string; amount: number }[]; previousDue: number; total: number; dueAfter: number } | null;
  const when = p.approvedAt ?? p.createdAt;
  const buf = await renderToBuffer(receiptDoc({
    receiptNo: p.id.slice(-8).toUpperCase(), date: when.toISOString().slice(0, 10),
    building: inv.flat.building.name, flat: inv.flat.label, renter: p.renterName ?? inv.flat.renter?.user.name ?? "-", month: inv.month,
    items: snap?.items ?? inv.items.map((i) => ({ name: i.headName, amount: i.amount })), previousDue: snap?.previousDue ?? inv.previousDue, total: snap?.total ?? inv.totalAmount,
    paid: p.paidAmount, remaining: snap?.dueAfter ?? inv.dueAmount, trxId: p.transactionId, status: inv.status,
  }));
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${p.id.slice(-8)}.pdf"` } });
}
