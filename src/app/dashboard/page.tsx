import { Building2, DoorClosed, DoorOpen, Hourglass, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/tenant";
import { Card } from "@/components/ui/card";

export default async function Overview() {
  const a = await getAccess();
  if (!a?.perms.includes("VIEW_FLATS")) return <main><h1>Welcome</h1><p>Use the menu to open the sections you have access to.</p></main>;
  const ownerId = a.ownerId;
  const [flats, invoices, pending] = await Promise.all([
    db.flat.findMany({ where: { ownerId } }),
    db.invoice.findMany({ where: { ownerId }, orderBy: { month: "desc" } }),
    db.payment.count({ where: { ownerId, status: "PENDING" } }),
  ]);
  const latest = new Map<string, number>();
  for (const i of invoices) if (!latest.has(i.flatId)) latest.set(i.flatId, i.dueAmount);
  const due = [...latest.values()].reduce((s, v) => s + v, 0);
  const kpis = [
    { label: "Flats", value: flats.length, icon: Building2 },
    { label: "Occupied", value: flats.filter((f) => f.status === "OCCUPIED").length, icon: DoorClosed },
    { label: "Vacant", value: flats.filter((f) => f.status === "VACANT").length, icon: DoorOpen },
    { label: "Payments to verify", value: pending, icon: Hourglass },
    { label: "Outstanding", value: `৳${due.toLocaleString("en-US")}`, icon: Wallet },
  ];
  return (
    <main>
      <h1>Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">{k.label}<k.icon className="h-4 w-4" /></div>
            <div className="mt-2 text-2xl font-bold">{k.value}</div>
          </Card>
        ))}
      </div>
    </main>
  );
}
