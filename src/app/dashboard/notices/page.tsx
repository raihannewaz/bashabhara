import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { addNotice, deleteNotice } from "@/actions/notices";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader } from "@/components/ui/page";

export default async function Notices({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ownerId = await requireTenant("MANAGE_PROPERTY");
  const { error, ok } = await searchParams;
  const [notices, buildings] = await Promise.all([
    db.notice.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.building.findMany({ where: { ownerId } }),
  ]);
  const bName = (id: string | null) => (id ? buildings.find((b) => b.id === id)?.name ?? "Building" : "All buildings");

  return (
    <main>
      <Flash ok={ok} error={error} />
      <PageHeader title="Notices" subtitle="Messages your renters see at the top of their portal" action={
        <Modal trigger={<><Plus className="h-4 w-4" />New notice</>} title="New notice" variant="default" small={false}>
          <form action={addNotice} className="grid gap-3">
            <Field label="Title"><input name="title" required minLength={3} placeholder="For example Water supply off on Friday" /></Field>
            <Field label="Message"><textarea name="body" required minLength={3} rows={4} /></Field>
            <Field label="Send to"><select name="buildingId"><option value="">All buildings</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Button type="submit">Post notice</Button>
          </form>
        </Modal>
      } />
      <FilterableList cols="grid-cols-1 lg:grid-cols-2" placeholder="Search notices" empty="No notices yet." items={notices.map((n) => ({
        id: n.id, search: `${n.title} ${n.body}`,
        node: (
          <Card className="p-4">
            <div className="font-semibold">{n.title}</div>
            <div className="text-sm text-muted-foreground">{bName(n.buildingId)}, {n.createdAt.toISOString().slice(0, 10)}</div>
            <p className="mt-2 whitespace-pre-line text-sm">{n.body}</p>
            <form action={deleteNotice} className="mt-3"><input type="hidden" name="id" value={n.id} /><ConfirmButton message="Remove this notice from your renters' portal?">Remove</ConfirmButton></form>
          </Card>
        ),
      }))} />
    </main>
  );
}
