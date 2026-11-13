import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getRenter } from "@/lib/tenant";
import { submitPayment } from "@/actions/billing";
import { saveUpload } from "@/lib/uploads";
import Flash from "@/components/Flash";
import Modal from "@/components/Modal";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Stat, StatusBadge, tk } from "@/components/ui/page";

export default async function Portal({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const renter = await getRenter();
  if (!renter) redirect("/login");
  const { error, ok } = await searchParams;
  const ownerId = renter.ownerId;

  const [invoices, accounts] = await Promise.all([
    db.invoice.findMany({ where: { flatId: renter.flatId }, orderBy: { month: "desc" }, include: { items: true, payments: { orderBy: { createdAt: "desc" } } } }),
    db.paymentAccount.findMany({ where: { ownerId } }),
  ]);
  const totalDue = invoices[0]?.dueAmount ?? 0;

  async function pay(form: FormData) {
    "use server";
    let msg = "";
    try {
      await submitPayment({
        invoiceId: String(form.get("invoiceId")),
        paidAmount: Number(form.get("paidAmount")),
        transactionId: String(form.get("transactionId")).trim(),
        senderNumber: String(form.get("senderNumber")).trim(),
        screenshotUrl: await saveUpload(form.get("screenshot"), ownerId),
      });
    } catch (e) {
      msg = e instanceof Error ? e.message : "Could not submit payment";
      if (msg.includes("Unique constraint")) msg = "This TrxID has already been submitted";
      if (e && typeof e === "object" && "issues" in e) msg = "Please check the form fields, including the sender number";
    }
    redirect(msg ? `/portal?error=${encodeURIComponent(msg)}` : "/portal?ok=1");
  }

  return (
    <>
      <TopBar title="Renter portal" />
      <main>
        <Flash ok={ok} error={error} />
        <h1 className="!mb-1">Hello, {renter.user.name}</h1>
        <p className="mb-5 text-muted-foreground">{renter.flat.building.name}, flat {renter.flat.label}</p>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Card className="p-4"><div className="text-sm text-muted-foreground">Current balance due</div><div className={`text-3xl font-bold ${totalDue > 0 ? "text-destructive" : "text-primary"}`}>{tk(totalDue)}</div></Card>
          <Card className="p-4">
            <div className="mb-1 text-sm text-muted-foreground">Send your payment to</div>
            {accounts.length === 0 ? <p className="text-sm">Your landlord has not added a payment account yet.</p> : accounts.map((a) => (
              <div key={a.id} className="text-sm"><span className="font-medium">{a.method}</span> {a.number ?? ""}{a.bankName ? `, ${a.bankName}${a.branch ? ` (${a.branch})` : ""}${a.routingNo ? `, routing ${a.routingNo}` : ""}` : ""}</div>
            ))}
          </Card>
        </div>

        <h2>Bills</h2>
        {invoices.length === 0 && <p className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">No bills yet.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {invoices.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-center justify-between"><div className="text-lg font-semibold">{i.month}</div><StatusBadge status={i.status} /></div>
              <div className="mt-3 divide-y text-sm">
                {i.items.map((it) => <div key={it.id} className="flex justify-between py-1.5"><span>{it.headName}{it.currentUnit != null ? ` (${it.previousUnit} to ${it.currentUnit} units)` : ""}</span><span>{tk(it.amount)}</span></div>)}
                {i.previousDue > 0 && <div className="flex justify-between py-1.5"><span>Previous due</span><span>{tk(i.previousDue)}</span></div>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2"><Stat label="Total" value={tk(i.totalAmount)} /><Stat label="Paid" value={tk(i.paidAmount)} /><Stat label="Due" value={tk(i.dueAmount)} strong /></div>
              {i.payments.length > 0 && (
                <div className="mt-3 grid gap-1 border-t pt-3 text-sm">
                  {i.payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{tk(p.paidAmount)} <StatusBadge status={p.status} className="ml-1" />{p.rejectReason ? ` ${p.rejectReason}` : ""}</span>
                      {p.status === "APPROVED" && <a href={`/api/receipt/${p.id}`} target="_blank" rel="noreferrer">Receipt (রশিদ)</a>}
                    </div>
                  ))}
                </div>
              )}
              {i.dueAmount > 0 && (
                <div className="mt-3">
                  <Modal trigger="Pay this bill" title={`Pay ${i.month} bill`} variant="default" small={false}>
                    <p className="mb-3 text-sm text-muted-foreground">First send the money with bKash, Nagad or bank transfer, then enter the TrxID here.</p>
                    <form action={pay} className="grid gap-3">
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <Field label="Amount you sent (৳)" hint="You can pay part of the bill"><input name="paidAmount" type="number" min={1} max={i.dueAmount} step="any" defaultValue={i.dueAmount} required /></Field>
                      <Field label="TrxID"><input name="transactionId" required minLength={4} /></Field>
                      <Field label="Number you sent from"><input name="senderNumber" placeholder="01XXXXXXXXX" required /></Field>
                      <Field label="Screenshot (optional)"><input name="screenshot" type="file" accept="image/*,application/pdf" /></Field>
                      <Button type="submit">Submit payment</Button>
                    </form>
                  </Modal>
                </div>
              )}
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
