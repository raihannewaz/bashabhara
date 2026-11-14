import { runAction } from "@/lib/run";
import { recordPayment } from "@/actions/billing";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Field, tk } from "@/components/ui/page";

/** Landlord or caretaker records money received in person or outside the app. It is approved immediately. */
export default function RecordPayment({ invoiceId, due, title, redirectTo }: { invoiceId: string; due: number; title: string; redirectTo: string }) {
  async function record(f: FormData) {
    "use server";
    await runAction(redirectTo, () => recordPayment({ invoiceId: String(f.get("invoiceId")), amount: Number(f.get("amount")), method: String(f.get("method")), reference: String(f.get("reference") ?? "") }));
  }
  return (
    <Modal trigger="Receive payment" title={title} variant="default">
      <form action={record} className="grid gap-3">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <p className="text-sm text-muted-foreground">Amount due now: {tk(due)}. Paying more is kept as the renter&apos;s advance credit.</p>
        <Field label="Amount received (৳)"><input name="amount" type="number" min={1} step="any" defaultValue={due > 0 ? due : undefined} required /></Field>
        <Field label="How was it paid?"><select name="method"><option value="CASH">Cash</option><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="ROCKET">Rocket</option><option value="UPAY">Upay</option><option value="BANK">Bank</option></select></Field>
        <Field label="Reference (optional)" hint="TrxID or cheque number. Leave blank for cash."><input name="reference" /></Field>
        <Button type="submit">Record and approve</Button>
      </form>
    </Modal>
  );
}
