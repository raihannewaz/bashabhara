import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/tenant";
import FilterableList from "@/components/FilterableList";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";

export default async function Audit() {
  const a = await getAccess();
  if (!a?.isOwner) redirect("/dashboard");
  const logs = await db.auditLog.findMany({ where: { ownerId: a.ownerId }, orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <main>
      <PageHeader title="Activity log" subtitle="Who did what, newest first. Entries cannot be edited or deleted." />
      <FilterableList cols="grid-cols-1" placeholder="Search by person, action or detail" empty="Nothing recorded yet." items={logs.map((l) => ({
        id: l.id, search: `${l.userName} ${l.action} ${l.detail ?? ""}`,
        node: (
          <Card className="flex flex-wrap items-start justify-between gap-2 p-3">
            <div><div className="font-medium">{l.action}</div>{l.detail && <div className="text-sm text-muted-foreground">{l.detail}</div>}</div>
            <div className="text-right text-xs text-muted-foreground"><div>{l.userName}</div><div>{l.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</div></div>
          </Card>
        ),
      }))} />
    </main>
  );
}
