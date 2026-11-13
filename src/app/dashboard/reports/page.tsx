import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { Card } from "@/components/ui/card";
import { PageHeader, tk } from "@/components/ui/page";

export default async function Reports() {
  const ownerId = await requireTenant("VIEW_REPORTS");
  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { ownerId, status: "APPROVED" } }),
    db.expense.findMany({ where: { ownerId } }),
  ]);
  const rows = new Map<string, { income: number; expense: number }>();
  const row = (m: string) => {
    let r = rows.get(m);
    if (!r) { r = { income: 0, expense: 0 }; rows.set(m, r); }
    return r;
  };
  for (const p of payments) row((p.approvedAt ?? p.createdAt).toISOString().slice(0, 7)).income += p.paidAmount;
  for (const e of expenses) row(e.date.toISOString().slice(0, 7)).expense += e.amount;
  const months = [...rows.keys()].sort().reverse();
  const tot = months.reduce((t, m) => ({ income: t.income + rows.get(m)!.income, expense: t.expense + rows.get(m)!.expense }), { income: 0, expense: 0 });
  const net = tot.income - tot.expense;

  return (
    <main>
      <PageHeader title="Income vs expenses" subtitle="Income counts approved payments in the month they were approved." />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">Total income</div><div className="text-2xl font-bold">{tk(tot.income)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Total expenses</div><div className="text-2xl font-bold">{tk(tot.expense)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Net profit</div><div className={`text-2xl font-bold ${net < 0 ? "text-destructive" : "text-primary"}`}>{tk(net)}</div></Card>
      </div>
      {months.length === 0 ? <p className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">No income or expenses yet.</p> : (
        <Card className="overflow-x-auto">
          <table>
            <thead><tr><th className="p-3">Month</th><th className="p-3 text-right">Income</th><th className="p-3 text-right">Expenses</th><th className="p-3 text-right">Net profit</th></tr></thead>
            <tbody>
              {months.map((m) => {
                const r = rows.get(m)!;
                const n = r.income - r.expense;
                return <tr key={m}><td className="p-3">{m}</td><td className="p-3 text-right">{tk(r.income)}</td><td className="p-3 text-right">{tk(r.expense)}</td><td className={`p-3 text-right font-semibold ${n < 0 ? "text-destructive" : ""}`}>{tk(n)}</td></tr>;
              })}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
