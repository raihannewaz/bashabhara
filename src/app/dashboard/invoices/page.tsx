import { Download, FileText, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { flatScope, getAccess } from "@/lib/tenant";
import { runAction } from "@/lib/run";
import { billMessage, receiptMessage, waLink } from "@/lib/whatsapp";
import Flash from "@/components/Flash";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import RecordPayment from "@/components/RecordPayment";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, Stat, StatusBadge, tk } from "@/components/ui/page";
import { adjustInvoiceItem } from "@/actions/billing";

const link = { textDecoration: "none", color: "hsl(var(--foreground))" } as const;
const linkCls = "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted";

export default async function Invoices({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const a = await getAccess();
  if (!a?.perms.includes("GENERATE_BILLS")) return <main><h1>Invoices</h1><p>You do not have access.</p></main>;
  const { error, ok } = await searchParams;
  const canRecord = a.perms.includes("APPROVE_PAYMENTS");
  const invoices = await db.invoice.findMany({
    where: { ownerId: a.ownerId, flat: flatScope(a) }, orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    include: { items: true, flat: { include: { building: true, renter: { include: { user: true } } } } },
  });

  async function adjust(f: FormData) {
    "use server";
    await runAction("/dashboard/invoices", () => adjustInvoiceItem(String(f.get("itemId")), Number(f.get("amount"))));
  }

  return (
    <main>
      <Flash ok={ok} error={error} />
      <PageHeader title="Invoices" subtitle="Search by month, flat or renter. Generate new invoices from Meter & bills." action={
        <a href="/api/export/invoices" style={link} className={linkCls}><Download className="h-4 w-4" />Export CSV</a>
      } />
      <FilterableList groups={["UNPAID", "PARTIAL", "PAID"]} groupLabel="All statuses" placeholder="Search month, flat or renter" empty="No invoices yet." items={invoices.map((i) => {
        const r = i.flat.renter;
        const base = { name: r?.user.name ?? "", flat: i.flat.label, month: i.month };
        return {
          id: i.id, group: i.status, search: `${i.month} ${i.flat.label} ${i.flat.building.name} ${r?.user.name ?? ""}`,
          node: (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{i.month}, flat {i.flat.label}</div><div className="text-sm text-muted-foreground">{r?.user.name ?? "No current renter"}</div></div><StatusBadge status={i.status} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2"><Stat label="Total" value={tk(i.totalAmount)} /><Stat label="Paid" value={tk(i.paidAmount)} /><Stat label="Due" value={tk(i.dueAmount)} strong /></div>
              <div className="mt-1 text-xs text-muted-foreground">Due date {i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "-"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {canRecord && i.dueAmount > 0 && <RecordPayment invoiceId={i.id} due={i.dueAmount} title={`Receive payment, ${i.month} flat ${i.flat.label}`} redirectTo="/dashboard/invoices" />}
                <a href={`/api/bill/${i.id}`} target="_blank" rel="noreferrer" style={link} className={linkCls}><FileText className="h-4 w-4" />Bill PDF</a>
                {r && <a href={waLink(r.whatsappNumber, billMessage({ ...base, total: i.totalAmount, due: i.dueAmount }))} target="_blank" rel="noreferrer" style={link} className={linkCls}><MessageCircle className="h-4 w-4" />Send bill</a>}
                {r && i.paidAmount > 0 && <a href={waLink(r.whatsappNumber, receiptMessage({ ...base, paid: i.paidAmount, due: i.dueAmount }))} target="_blank" rel="noreferrer" style={link} className={linkCls}><MessageCircle className="h-4 w-4" />Send receipt</a>}
                <Modal trigger="Adjust" title={`Adjust ${i.month}, flat ${i.flat.label}`} variant="ghost">
                  <div className="grid gap-3">
                    {i.items.map((it) => (
                      <form key={it.id} action={adjust} className="flex items-end gap-2">
                        <input type="hidden" name="itemId" value={it.id} />
                        <label className="grid flex-1 gap-1"><span className="text-sm text-muted-foreground">{it.headName}{it.currentUnit != null ? ` (${it.previousUnit} to ${it.currentUnit} units)` : ""}</span><input name="amount" type="number" step="any" defaultValue={it.amount} /></label>
                        <Button type="submit">Update</Button>
                      </form>
                    ))}
                    {i.previousDue > 0 && <p className="text-sm text-muted-foreground">Previous due carried forward: {tk(i.previousDue)}</p>}
                  </div>
                </Modal>
              </div>
            </Card>
          ),
        };
      })} />
    </main>
  );
}
