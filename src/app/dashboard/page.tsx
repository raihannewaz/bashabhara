import { AlarmClock, Building2, DoorClosed, DoorOpen, Hourglass, Percent, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { flatScope, getAccess } from "@/lib/tenant";
import { getT } from "@/lib/i18n";
import { daysOverdue } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { PageHeader, tk } from "@/components/ui/page";

export default async function Overview() {
  const a = await getAccess();
  const { t } = await getT();
  if (!a?.perms.includes("VIEW_FLATS")) return <main><h1>Welcome</h1><p>Use the menu to open the sections you have access to.</p></main>;
  const { ownerId } = a;
  const scope = flatScope(a);
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)); return d.toISOString().slice(0, 7); });
  const sixAgo = new Date(`${months[0]}-01T00:00:00.000Z`);
  const soon = new Date(now.getTime() + 60 * 86_400_000);
  const showMoney = a.perms.includes("VIEW_REPORTS");
  const since = (() => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 4); return d.toISOString().slice(0, 7); })(); // only recent invoices are needed to find each flat's latest

  const [flats, invoices, pending, leases, payments, expenses] = await Promise.all([
    db.flat.findMany({ where: { ownerId, ...scope } }),
    db.invoice.findMany({ where: { ownerId, flat: scope, month: { gte: since } }, orderBy: { month: "desc" } }),
    db.payment.count({ where: { ownerId, status: "PENDING", invoice: { flat: scope } } }),
    db.renter.findMany({ where: { ownerId, flat: scope, leaseEnd: { gte: now, lte: soon } }, include: { user: true, flat: true }, orderBy: { leaseEnd: "asc" } }),
    db.payment.findMany({ where: { ownerId, status: "APPROVED", createdAt: { gte: sixAgo }, invoice: { flat: scope } } }),
    db.expense.findMany({ where: { ownerId, date: { gte: sixAgo } } }),
  ]);

  const latest = new Map<string, (typeof invoices)[number]>();
  for (const i of invoices) if (!latest.has(i.flatId)) latest.set(i.flatId, i);
  const due = [...latest.values()].reduce((s, i) => s + i.dueAmount, 0);
  const overdue = [...latest.values()].filter((i) => daysOverdue(i.dueDate, i.dueAmount, now) > 0);
  const overdueAmt = overdue.reduce((s, i) => s + i.dueAmount, 0);
  const thisMonth = invoices.filter((i) => i.month === month);
  const billed = thisMonth.reduce((s, i) => s + i.totalAmount, 0);
  const collected = thisMonth.reduce((s, i) => s + i.paidAmount, 0);
  const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const income = months.map((m) => payments.filter((p) => (p.approvedAt ?? p.createdAt).toISOString().startsWith(m)).reduce((s, p) => s + p.paidAmount, 0));
  const spent = months.map((m) => expenses.filter((e) => e.date.toISOString().startsWith(m)).reduce((s, e) => s + e.amount, 0));
  const max = Math.max(1, ...income, ...spent);

  const kpis = [
    { label: t("ov.flats"), value: flats.length, icon: Building2 },
    { label: t("ov.occupied"), value: flats.filter((f) => f.status === "OCCUPIED").length, icon: DoorClosed },
    { label: t("ov.vacant"), value: flats.filter((f) => f.status === "VACANT").length, icon: DoorOpen },
    { label: t("ov.toVerify"), value: pending, icon: Hourglass },
    { label: t("ov.outstanding"), value: tk(due), icon: Wallet },
    { label: t("ov.overdue"), value: `${overdue.length} (${tk(overdueAmt)})`, icon: AlarmClock },
    { label: t("ov.collection"), value: `${rate}%`, icon: Percent },
  ];

  return (
    <main>
      <PageHeader title={t("ov.title")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">{k.label}<k.icon className="h-4 w-4 shrink-0" /></div>
            <div className="mt-2 text-xl font-bold">{k.value}</div>
          </Card>
        ))}
      </div>

      {showMoney && (
        <Card className="mt-5 p-4">
          <h2>{t("ov.income")}</h2>
          <div className="flex h-40 items-end gap-2 sm:gap-4">
            {months.map((m, i) => (
              <div key={m} className="flex h-full flex-1 flex-col justify-end gap-1">
                <div className="flex flex-1 items-end justify-center gap-1">
                  <div title={`Income ${tk(income[i])}`} className="w-1/2 max-w-6 rounded-t bg-primary" style={{ height: `${(income[i] / max) * 100}%` }} />
                  <div title={`Expenses ${tk(spent[i])}`} className="w-1/2 max-w-6 rounded-t bg-destructive/70" style={{ height: `${(spent[i] / max) * 100}%` }} />
                </div>
                <div className="text-center text-xs text-muted-foreground">{m.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary" />Income</span><span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-destructive/70" />Expenses</span></div>
        </Card>
      )}

      {leases.length > 0 && (
        <Card className="mt-5 p-4">
          <h2>{t("ov.leases")}</h2>
          <div className="divide-y text-sm">
            {leases.map((r) => <div key={r.id} className="flex justify-between gap-2 py-2"><span>{r.user.name}, flat {r.flat.label}</span><span className="text-muted-foreground">{r.leaseEnd!.toISOString().slice(0, 10)}</span></div>)}
          </div>
        </Card>
      )}
    </main>
  );
}
