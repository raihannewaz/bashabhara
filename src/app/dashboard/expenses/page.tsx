import { Download, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import Flash from "@/components/Flash";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader, tk } from "@/components/ui/page";
import { addExpense, updateExpense } from "@/actions/expenses";

const CATEGORIES = ["Guard salary", "Plumbing", "Electrical", "Repair", "Cleaning", "Other"];

export default async function Expenses({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ownerId = await requireTenant("MANAGE_EXPENSES");
  const { error, ok } = await searchParams;
  const [expenses, buildings] = await Promise.all([
    db.expense.findMany({ where: { ownerId }, orderBy: { date: "desc" }, take: 300 }),
    db.building.findMany({ where: { ownerId } }),
  ]);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = expenses.filter((e) => e.date.toISOString().startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const bName = (id: string | null) => buildings.find((b) => b.id === id)?.name ?? "All buildings";
  const form = (e?: (typeof expenses)[number]) => (
    <form action={e ? updateExpense : addExpense} className="grid gap-3">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Field label="Category"><input name="category" list="cats" defaultValue={e?.category} required /></Field>
      <Field label="Amount (৳)"><input name="amount" type="number" min={1} step="any" defaultValue={e?.amount} required /></Field>
      <Field label="Date"><input name="date" type="date" defaultValue={e ? e.date.toISOString().slice(0, 10) : undefined} required /></Field>
      <Field label="Building"><select name="buildingId" defaultValue={e?.buildingId ?? ""}><option value="">All buildings</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Note"><input name="note" defaultValue={e?.note ?? ""} /></Field>
      <Button type="submit">Save</Button>
    </form>
  );

  return (
    <main>
      <Flash ok={ok} error={error} />
      <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      <PageHeader title="Expenses" subtitle={`Spent this month: ${tk(thisMonth)}`} action={<><a href="/api/export/expenses" style={{ textDecoration: "none", color: "hsl(var(--foreground))" }} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"><Download className="h-4 w-4" />Export CSV</a><Modal trigger={<><Plus className="h-4 w-4" />Add expense</>} title="Add expense" variant="default" small={false}>{form()}</Modal></>} />
      <FilterableList groups={[...new Set(expenses.map((e) => e.category))]} groupLabel="All categories" placeholder="Search expenses" empty="No expenses yet." items={expenses.map((e) => ({
        id: e.id, group: e.category, search: `${e.category} ${e.note ?? ""} ${e.date.toISOString().slice(0, 10)} ${bName(e.buildingId)}`,
        node: (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{e.category}</div><div className="text-sm text-muted-foreground">{e.date.toISOString().slice(0, 10)}, {bName(e.buildingId)}</div></div><div className="font-semibold">{tk(e.amount)}</div></div>
            {e.note && <div className="mt-2 text-sm text-muted-foreground">{e.note}</div>}
            <div className="mt-3"><Modal trigger="Edit" title="Edit expense">{form(e)}</Modal></div>
          </Card>
        ),
      }))} />
    </main>
  );
}
