import { Download, Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { requireScope } from "@/lib/tenant";
import { runAction } from "@/lib/run";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader, Stat, StatusBadge, tk } from "@/components/ui/page";
import { approvePayment, rejectPayment, revertPayment } from "@/actions/billing";

export default async function Payments({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { ownerId, flat } = await requireScope("APPROVE_PAYMENTS");
  const { error, ok } = await searchParams;
  const include = { invoice: { include: { flat: true } } };
  const [pending, decided] = await Promise.all([
    db.payment.findMany({ where: { ownerId, status: "PENDING", invoice: { flat } }, orderBy: { createdAt: "asc" }, include }),
    db.payment.findMany({ where: { ownerId, status: { not: "PENDING" }, invoice: { flat } }, orderBy: { createdAt: "desc" }, take: 100, include }),
  ]);

  async function approve(f: FormData) { "use server"; await runAction("/dashboard/payments", () => approvePayment(String(f.get("id")))); }
  async function reject(f: FormData) { "use server"; await runAction("/dashboard/payments", () => rejectPayment(String(f.get("id")), String(f.get("reason")))); }
  async function revert(f: FormData) { "use server"; await runAction("/dashboard/payments", () => revertPayment(String(f.get("id")))); }

  return (
    <main>
      <Flash ok={ok} error={error} />
      <PageHeader title="Payments" subtitle="Check each TrxID against your bKash, Nagad or bank statement before approving. To record cash or money received in person, use Receive payment on an invoice." action={<a href="/api/export/payments" style={{ textDecoration: "none", color: "hsl(var(--foreground))" }} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"><Download className="h-4 w-4" />Export CSV</a>} />
      <h2>Waiting for verification ({pending.length})</h2>
      {pending.length === 0 ? <p className="mb-6 rounded-xl border border-dashed py-8 text-center text-muted-foreground">Nothing waiting.</p> : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">Flat {p.invoice.flat.label}, {p.invoice.month}</div><div className="text-sm text-muted-foreground">{p.renterName ?? "Renter"}</div></div><StatusBadge status="PENDING" /></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Amount sent" value={tk(p.paidAmount)} strong /><Stat label="Invoice due" value={tk(p.invoice.dueAmount)} /><Stat label="TrxID" value={p.transactionId} /><Stat label="From" value={p.senderNumber} /></div>
              {p.screenshotUrl && <a href={p.screenshotUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm"><Paperclip className="h-4 w-4" />View screenshot</a>}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={approve}><input type="hidden" name="id" value={p.id} /><Button type="submit">Approve</Button></form>
                <Modal trigger="Reject" title="Reject payment" variant="ghost">
                  <form action={reject} className="grid gap-3"><input type="hidden" name="id" value={p.id} /><Field label="Reason shown to the renter"><input name="reason" required minLength={2} placeholder="For example TrxID not found" /></Field><Button type="submit" variant="destructive">Reject payment</Button></form>
                </Modal>
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2>Recent decisions</h2>
      <FilterableList groups={["APPROVED", "REJECTED"]} groupLabel="All" placeholder="Search flat, TrxID or renter" empty="No decisions yet." items={decided.map((p) => ({
        id: p.id, group: p.status, search: `${p.invoice.flat.label} ${p.invoice.month} ${p.transactionId} ${p.renterName ?? ""}`,
        node: (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">Flat {p.invoice.flat.label}, {p.invoice.month}</div><div className="text-sm text-muted-foreground">{p.transactionId}</div></div><StatusBadge status={p.status} /></div>
            <div className="mt-2 text-sm">{tk(p.paidAmount)}{p.method && p.method !== "TRX" ? ` by ${p.method.toLowerCase()}${p.recordedBy ? `, recorded by ${p.recordedBy}` : ""}` : ""}{p.creditAdded > 0 ? `, ${tk(p.creditAdded)} kept as credit` : ""}{p.rejectReason ? ` rejected: ${p.rejectReason}` : ""}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.status === "APPROVED" && <a href={`/api/receipt/${p.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "hsl(var(--foreground))" }} className="inline-flex rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">Receipt PDF</a>}
              <form action={revert}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Send this payment back to the waiting list and undo its effect on the invoice?">Undo</ConfirmButton></form>
            </div>
          </Card>
        ),
      }))} />
    </main>
  );
}
