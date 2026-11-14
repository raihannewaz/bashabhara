import { MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getAccess, flatScope } from "@/lib/tenant";
import { daysOverdue } from "@/lib/money";
import { reminderMessage, waLink } from "@/lib/whatsapp";
import { runAction } from "@/lib/run";
import { applyLateFees } from "@/actions/billing";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import FilterableList from "@/components/FilterableList";
import RecordPayment from "@/components/RecordPayment";
import { Card } from "@/components/ui/card";
import { PageHeader, Stat, StatusBadge, tk } from "@/components/ui/page";

export default async function Overdue({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const a = await getAccess();
  if (!a || !(a.perms.includes("GENERATE_BILLS") || a.perms.includes("APPROVE_PAYMENTS"))) return <main><h1>Overdue</h1><p>You do not have access.</p></main>;
  const { error, ok } = await searchParams;
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 4);
  const since = d.toISOString().slice(0, 7);
  const [invoices, owner] = await Promise.all([
    db.invoice.findMany({ where: { ownerId: a.ownerId, flat: flatScope(a), month: { gte: since } }, orderBy: { month: "desc" }, include: { flat: { include: { building: true, renter: { include: { user: true } } } } } }),
    db.user.findUniqueOrThrow({ where: { id: a.ownerId }, select: { lateFee: true } }),
  ]);
  const now = new Date();
  const latest = new Map<string, (typeof invoices)[number]>();
  for (const i of invoices) if (!latest.has(i.flatId)) latest.set(i.flatId, i);
  const rows = [...latest.values()].filter((i) => i.dueAmount > 0 && i.flat.renter).map((i) => ({ i, late: daysOverdue(i.dueDate, i.dueAmount, now) })).sort((x, y) => y.late - x.late);
  const total = rows.reduce((s, r) => s + r.i.dueAmount, 0);
  const canFee = a.perms.includes("GENERATE_BILLS") && owner.lateFee > 0;
  const canRecord = a.perms.includes("APPROVE_PAYMENTS");

  async function fees() {
    "use server";
    await runAction("/dashboard/overdue", () => applyLateFees());
  }

  return (
    <main>
      <Flash ok={ok} error={error} />
      <PageHeader title="Overdue and unpaid" subtitle={`${rows.length} flat(s) owe ${tk(total)} in total. Send a WhatsApp reminder to each.`} action={canFee ? (
        <form action={fees}><ConfirmButton message={`Add a ${tk(owner.lateFee)} late fee to every overdue flat that has none yet?`}>Apply late fees</ConfirmButton></form>
      ) : undefined} />
      <FilterableList groups={["Overdue", "Not yet due"]} groupLabel="All" placeholder="Search flat or renter" empty="Nobody owes anything right now." items={rows.map(({ i, late }) => {
        const r = i.flat.renter!;
        const dueDate = i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "-";
        return {
          id: i.id, group: late > 0 ? "Overdue" : "Not yet due", search: `${i.flat.label} ${r.user.name} ${i.flat.building.name}`,
          node: (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">Flat {i.flat.label}, {r.user.name}</div><div className="text-sm text-muted-foreground">{i.flat.building.name}, {i.month}</div></div>
                {late > 0 ? <StatusBadge status="UNPAID" className="whitespace-nowrap">{`${late} days late`}</StatusBadge> : <StatusBadge status="PENDING">Not yet due</StatusBadge>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Amount due" value={tk(i.dueAmount)} strong /><Stat label="Due date" value={dueDate} /></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={waLink(r.whatsappNumber, reminderMessage({ name: r.user.name, flat: i.flat.label, month: i.month, due: i.dueAmount, dueDate, daysLate: late }))} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "hsl(var(--foreground))" }} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"><MessageCircle className="h-4 w-4" />Remind</a>
                {canRecord && <RecordPayment invoiceId={i.id} due={i.dueAmount} title={`Receive payment, flat ${i.flat.label}`} redirectTo="/dashboard/overdue" />}
              </div>
            </Card>
          ),
        };
      })} />
    </main>
  );
}
