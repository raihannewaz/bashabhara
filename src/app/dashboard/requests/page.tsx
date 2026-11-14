import { db } from "@/lib/db";
import { getAccess } from "@/lib/tenant";
import { updateRequest } from "@/actions/requests";
import Flash from "@/components/Flash";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader, StatusBadge } from "@/components/ui/page";

export default async function Requests({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const a = await getAccess();
  if (!a || !(a.perms.includes("VIEW_FLATS") || a.perms.includes("MANAGE_PROPERTY"))) return <main><h1>Repair requests</h1><p>You do not have access.</p></main>;
  const { error, ok } = await searchParams;
  const list = await db.serviceRequest.findMany({ where: { ownerId: a.ownerId, ...(a.buildingIds ? { buildingId: { in: a.buildingIds } } : {}) }, orderBy: { createdAt: "desc" }, take: 300 });
  const open = list.filter((r) => r.status !== "DONE").length;

  return (
    <main>
      <Flash ok={ok} error={error} />
      <PageHeader title="Repair requests" subtitle={`${open} open. Renters report problems from their portal.`} />
      <FilterableList groups={["OPEN", "IN_PROGRESS", "DONE"]} groupLabel="All statuses" placeholder="Search requests" empty="No requests yet." items={list.map((r) => ({
        id: r.id, group: r.status, search: `${r.title} ${r.details ?? ""} ${r.flatLabel} ${r.renterName}`,
        node: (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{r.title}</div><div className="text-sm text-muted-foreground">Flat {r.flatLabel}, {r.renterName}, {r.createdAt.toISOString().slice(0, 10)}</div></div><StatusBadge status={r.status} /></div>
            {r.details && <p className="mt-2 text-sm">{r.details}</p>}
            {r.response && <p className="mt-2 rounded-lg bg-muted p-2 text-sm">Reply: {r.response}</p>}
            <div className="mt-3">
              <Modal trigger="Update" title={r.title}>
                <form action={updateRequest} className="grid gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <Field label="Status"><select name="status" defaultValue={r.status}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></Field>
                  <Field label="Reply to the renter" hint="The renter sees this in their portal"><input name="response" defaultValue={r.response ?? ""} /></Field>
                  <Button type="submit">Save</Button>
                </form>
              </Modal>
            </div>
          </Card>
        ),
      }))} />
    </main>
  );
}
