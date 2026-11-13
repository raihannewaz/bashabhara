import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import Flash from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/ui/page";
import { generateBulkInvoices } from "@/actions/billing";

export default async function Readings({ searchParams }: { searchParams: Promise<{ month?: string; error?: string; ok?: string }> }) {
  const ownerId = await requireTenant(["ENTER_METER_READING", "GENERATE_BILLS"]);
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : new Date().toISOString().slice(0, 7);

  const [flats, heads, invoices] = await Promise.all([
    db.flat.findMany({ where: { ownerId, status: "OCCUPIED" }, include: { building: true, renter: { include: { user: true } } }, orderBy: { label: "asc" } }),
    db.billingHead.findMany({ where: { ownerId, type: "METERED" } }),
    db.invoice.findMany({ where: { ownerId }, orderBy: { month: "desc" }, include: { items: true } }),
  ]);
  const metered = (buildingId: string, flatId: string) => heads.some((h) => h.flatId === flatId || (h.buildingId === buildingId && !h.flatId));
  const prevUnit = (flatId: string) => invoices.find((i) => i.flatId === flatId && i.month < month && i.items.some((x) => x.currentUnit != null))?.items.find((x) => x.currentUnit != null)?.currentUnit ?? 0;
  const done = (flatId: string) => invoices.some((i) => i.flatId === flatId && i.month === month);

  async function generate(f: FormData) {
    "use server";
    const m = String(f.get("month"));
    const readings: Record<string, number> = {};
    for (const [k, v] of f.entries()) if (k.startsWith("reading_") && String(v).trim() !== "") readings[k.slice(8)] = Number(v);
    let url = "";
    try {
      const r = await generateBulkInvoices(m, readings);
      url = `/dashboard/readings?month=${m}&ok=${r.created}`;
    } catch (e) {
      url = `/dashboard/readings?month=${m}&error=${encodeURIComponent(e instanceof Error ? e.message : "Failed")}`;
    }
    redirect(url);
  }

  return (
    <main>
      <Flash error={sp.error} />
      {sp.ok && <Flash ok="1" />}
      <PageHeader title="Meter readings and bills" subtitle="Enter this month's electricity reading for each flat, then generate all bills at once." />
      {sp.ok && <p className="mb-4 rounded-lg bg-muted p-3 text-sm">{sp.ok} new invoice(s) generated for {month}.</p>}
      <form method="get" className="mb-5 flex items-end gap-2">
        <label className="grid gap-1"><span className="text-sm text-muted-foreground">Month</span><input type="month" name="month" defaultValue={month} /></label>
        <Button type="submit" variant="outline">Show</Button>
      </form>
      <form action={generate}>
        <input type="hidden" name="month" value={month} />
        {flats.length === 0 && <p className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">No occupied flats yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flats.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">Flat {f.label}</div><div className="text-sm text-muted-foreground">{f.building.name}, {f.renter?.user.name ?? "-"}</div></div>{done(f.id) && <StatusBadge status="BILLED" />}</div>
              <div className="mt-3 text-sm">
                {done(f.id) ? <span className="text-muted-foreground">Invoice already generated</span> : metered(f.buildingId, f.id) ? (
                  <label className="grid gap-1"><span className="text-muted-foreground">Previous reading {prevUnit(f.id)}. Current reading:</span><input name={`reading_${f.id}`} type="number" min={prevUnit(f.id)} step="any" placeholder="Units" /></label>
                ) : <span className="text-muted-foreground">No metered charge</span>}
              </div>
            </Card>
          ))}
        </div>
        {flats.length > 0 && (
          <div className="sticky bottom-0 mt-5 border-t bg-background/90 py-3 backdrop-blur">
            <Button type="submit" className="w-full sm:w-auto">Generate invoices for {month}</Button>
            <p className="mt-2 text-xs text-muted-foreground">Flats left blank are billed with zero units. Bills cannot be deleted; fix mistakes with Adjust on the Invoices page.</p>
          </div>
        )}
      </form>
    </main>
  );
}
