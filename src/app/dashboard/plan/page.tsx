import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/tenant";
import { PRO_PRICE, SAAS_PAYMENT_INFO, getFlatLimit } from "@/lib/plan";
import Flash from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, PageHeader, StatusBadge, tk } from "@/components/ui/page";
import { submitSubscription } from "@/actions/plan";

export default async function Plan({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const a = await getAccess();
  if (!a?.isOwner) redirect("/dashboard");
  const { error, ok } = await searchParams;
  const [me, flats, subs] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: a.ownerId } }),
    db.flat.count({ where: { ownerId: a.ownerId } }),
    db.subscriptionPayment.findMany({ where: { ownerId: a.ownerId }, orderBy: { createdAt: "desc" } }),
  ]);
  const limit = getFlatLimit(me);

  return (
    <main className="max-w-2xl">
      <Flash ok={ok} error={error} />
      <PageHeader title="Plan" subtitle="Your plan and flat limit" />
      <Card className="mb-4 p-5">
        <div className="flex items-center justify-between"><div><div className="text-sm text-muted-foreground">Current plan</div><div className="text-xl font-bold">{me.plan}</div></div><StatusBadge status={me.plan} /></div>
        <p className="mt-3 text-sm">Flats used: {flats} of {limit === Infinity ? "unlimited" : limit}</p>
      </Card>
      {limit !== Infinity && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Upgrade to Pro (unlimited flats)</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm">Send {tk(PRO_PRICE)} to: {SAAS_PAYMENT_INFO}. Then enter the TrxID below. The administrator verifies it and activates Pro.</p>
            <form action={submitSubscription} className="grid gap-3">
              <Field label="Amount sent (৳)"><input name="amount" type="number" min={1} defaultValue={PRO_PRICE} required /></Field>
              <Field label="TrxID"><input name="transactionId" required minLength={4} /></Field>
              <Field label="Number you sent from"><input name="senderNumber" placeholder="01XXXXXXXXX" required /></Field>
              <Button type="submit">Submit payment</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {subs.length > 0 && <h2>Your payments</h2>}
      <div className="grid gap-2">
        {subs.map((s) => <Card key={s.id} className="flex items-center justify-between p-3 text-sm"><span>{tk(s.amount)}, {s.transactionId}{s.rejectReason ? ` (${s.rejectReason})` : ""}</span><StatusBadge status={s.status} /></Card>)}
      </div>
    </main>
  );
}
