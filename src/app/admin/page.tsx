import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ALL_PERMISSIONS, PERMISSION_LABELS, listOrAll, type Permission } from "@/lib/tenant";
import Flash from "@/components/Flash";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader, Stat, StatusBadge, tk } from "@/components/ui/page";
import { approveSubscription, createOwner, rejectSubscription, updateOwner } from "@/actions/admin";

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if ((await auth())?.user?.role !== "SUPER_ADMIN") redirect("/login");
  const { error, ok } = await searchParams;
  const [owners, pending, flatCounts] = await Promise.all([
    db.user.findMany({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } }),
    db.subscriptionPayment.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.flat.groupBy({ by: ["ownerId"], _count: true }),
  ]);
  const flats = (id: string) => flatCounts.find((c) => c.ownerId === id)?._count ?? 0;
  const name = (id: string) => owners.find((o) => o.id === id)?.name ?? id;

  const form = (o?: (typeof owners)[number]) => {
    const granted: Permission[] = o ? listOrAll(o.permissions) : [...ALL_PERMISSIONS];
    return (
      <form action={o ? updateOwner : createOwner} className="grid gap-3">
        {o && <input type="hidden" name="id" value={o.id} />}
        <Field label="Full name"><input name="name" defaultValue={o?.name} required /></Field>
        <Field label="Phone (also the login)"><input name="phone" defaultValue={o?.phone ?? ""} placeholder="01XXXXXXXXX" required /></Field>
        <Field label="Email (optional)"><input name="email" type="email" defaultValue={o?.email ?? ""} /></Field>
        <Field label={o ? "New password" : "Login password"} hint={o ? "Leave blank to keep the current one" : "At least 6 characters"}><input name="password" minLength={6} required={!o} /></Field>
        <Field label="Plan"><select name="plan" defaultValue={o?.plan ?? "FREE"}><option value="FREE">Free (up to 5 flats)</option><option value="PRO">Pro (unlimited flats)</option></select></Field>
        <Field label="Custom flat limit" hint="Optional. Overrides the plan's limit when filled in."><input name="flatLimit" type="number" min={0} defaultValue={o?.flatLimit ?? ""} /></Field>
        <div className="grid gap-2 rounded-lg border p-3">
          <span className="text-sm text-muted-foreground">Features this landlord and their staff may use</span>
          {ALL_PERMISSIONS.map((p) => <label key={p} className="flex items-start gap-2"><input type="checkbox" name="perm" value={p} defaultChecked={granted.includes(p)} className="mt-1" />{PERMISSION_LABELS[p]}</label>)}
        </div>
        {o && <label className="flex items-start gap-2"><input type="checkbox" name="active" defaultChecked={o.active} className="mt-1" />Active (untick to suspend; this also blocks their staff and renters)</label>}
        <Button type="submit">Save</Button>
      </form>
    );
  };

  return (
    <>
      <TopBar title="Super admin" />
      <main>
        <Flash ok={ok} error={error} />
        <PageHeader title="Landlords" subtitle="Only you can create landlord accounts and decide what they can use" action={<Modal trigger={<><Plus className="h-4 w-4" />Add landlord</>} title="Add landlord" variant="default" small={false}>{form()}</Modal>} />

        {pending.length > 0 && (
          <>
            <h2>Pro payments to verify ({pending.length})</h2>
            <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="font-semibold">{name(p.ownerId)}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2"><Stat label="Amount" value={tk(p.amount)} strong /><Stat label="TrxID" value={p.transactionId} /><Stat label="From" value={p.senderNumber} /></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={approveSubscription}><input type="hidden" name="id" value={p.id} /><Button type="submit">Approve</Button></form>
                    <Modal trigger="Reject" title="Reject payment" variant="ghost">
                      <form action={rejectSubscription} className="grid gap-3"><input type="hidden" name="id" value={p.id} /><Field label="Reason"><input name="reason" required minLength={2} /></Field><Button type="submit" variant="destructive">Reject</Button></form>
                    </Modal>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        <FilterableList groups={["ACTIVE", "SUSPENDED"]} groupLabel="All" placeholder="Search landlords" empty="No landlords yet." items={owners.map((o) => ({
          id: o.id, group: o.active ? "ACTIVE" : "SUSPENDED", search: `${o.name} ${o.phone ?? ""} ${o.email ?? ""}`,
          node: (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{o.name}</div><div className="text-sm text-muted-foreground">{o.phone}</div></div><StatusBadge status={o.active ? "ACTIVE" : "SUSPENDED"} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2"><Stat label="Plan" value={o.plan} /><Stat label="Flats" value={`${flats(o.id)}${o.flatLimit != null ? ` / ${o.flatLimit}` : ""}`} /><Stat label="Features" value={`${listOrAll(o.permissions).length} of ${ALL_PERMISSIONS.length}`} /></div>
              <div className="mt-3"><Modal trigger="Manage" title={`Manage ${o.name}`}>{form(o)}</Modal></div>
            </Card>
          ),
        }))} />
      </main>
    </>
  );
}
