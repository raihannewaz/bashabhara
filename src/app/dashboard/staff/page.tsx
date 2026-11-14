import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { PERMISSION_LABELS, getAccess, type Permission } from "@/lib/tenant";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader, StatusBadge } from "@/components/ui/page";
import { addStaff, deleteStaff, updateStaff } from "@/actions/staff";

export default async function Staff({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const a = await getAccess();
  if (!a?.isOwner) redirect("/dashboard");
  const { error, ok } = await searchParams;
  const [staff, buildings] = await Promise.all([
    db.user.findMany({ where: { ownerId: a.ownerId, role: "STAFF" }, orderBy: { createdAt: "asc" } }),
    db.building.findMany({ where: { ownerId: a.ownerId } }),
  ]);
  const ids = (s: (typeof staff)[number]) => ((s.buildingIds as string[] | null) ?? []);
  const have = (s: (typeof staff)[number]) => ((s.permissions as Permission[] | null) ?? []);

  const checks = (granted: Permission[]) => (
    <div className="grid gap-2 rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">What this person can do</span>
      {a.perms.map((p) => <label key={p} className="flex items-start gap-2"><input type="checkbox" name="perm" value={p} defaultChecked={granted.includes(p)} className="mt-1" />{PERMISSION_LABELS[p]}</label>)}
    </div>
  );
  const scopeBox = (picked: string[]) => (
    <div className="grid gap-2 rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">Limit to certain buildings</span>
      {buildings.map((b) => <label key={b.id} className="flex items-center gap-2"><input type="checkbox" name="building" value={b.id} defaultChecked={picked.includes(b.id)} />{b.name}</label>)}
      <span className="text-xs text-muted-foreground">Tick none for all buildings. Staff limited to buildings cannot manage property, expenses or reports, because those cover the whole business.</span>
    </div>
  );
  const form = (s?: (typeof staff)[number]) => (
    <form action={s ? updateStaff : addStaff} className="grid gap-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Full name"><input name="name" defaultValue={s?.name} required /></Field>
      <Field label="Phone (also the login)"><input name="phone" defaultValue={s?.phone ?? ""} placeholder="01XXXXXXXXX" required /></Field>
      <Field label={s ? "New password" : "Login password"} hint={s ? "Leave blank to keep the current one" : "At least 6 characters"}><input name="password" minLength={6} required={!s} /></Field>
      {s && <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={s.active} />Active (untick to suspend)</label>}
      {checks(s ? have(s) : [])}
      {buildings.length > 0 && scopeBox(s ? ids(s) : [])}
      <Button type="submit">Save</Button>
    </form>
  );

  return (
    <main>
      <Flash ok={ok} error={error} />
      <PageHeader title="Staff" subtitle="Caretakers and managers who can use parts of your dashboard" action={<Modal trigger={<><Plus className="h-4 w-4" />Add staff</>} title="Add staff" variant="default" small={false}>{form()}</Modal>} />
      <FilterableList placeholder="Search staff" empty="No staff yet." items={staff.map((s) => ({
        id: s.id, search: `${s.name} ${s.phone ?? ""}`,
        node: (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{s.name}</div><div className="text-sm text-muted-foreground">{s.phone}</div></div><StatusBadge status={s.active ? "ACTIVE" : "SUSPENDED"} /></div>
            <div className="mt-2 text-sm text-muted-foreground">{have(s).length} of {a.perms.length} permissions, {ids(s).length ? `${ids(s).length} building(s)` : "all buildings"}</div>
            <div className="mt-3">
              <Modal trigger="Edit" title={`Edit ${s.name}`}>
                {form(s)}
                <form action={deleteStaff} className="mt-4 border-t pt-4"><input type="hidden" name="id" value={s.id} /><ConfirmButton message={`Delete ${s.name}'s account?`}>Delete</ConfirmButton></form>
              </Modal>
            </div>
          </Card>
        ),
      }))} />
    </main>
  );
}
