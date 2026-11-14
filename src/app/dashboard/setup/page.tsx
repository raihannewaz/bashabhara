import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { flatScope, getAccess } from "@/lib/tenant";
import Flash from "@/components/Flash";
import ConfirmButton from "@/components/ConfirmButton";
import FilterableList from "@/components/FilterableList";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, PageHeader, Stat, StatusBadge, tk } from "@/components/ui/page";
import * as A from "@/actions/setup";

const TABS = [["buildings", "Buildings"], ["flats", "Flats"], ["renters", "Renters"], ["heads", "Billing heads"], ["accounts", "Payment accounts"], ["settings", "Rent rules"], ["former", "Former renters"]] as const;
const METHODS = ["bKash", "Nagad", "Rocket", "Upay", "Bank", "Cash"];
const add = (label: string) => <><Plus className="h-4 w-4" />{label}</>;
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function Setup({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; ok?: string }> }) {
  const a = await getAccess();
  if (!a || !(a.perms.includes("VIEW_FLATS") || a.perms.includes("MANAGE_PROPERTY"))) return <main><h1>Setup</h1><p>You do not have access.</p></main>;
  const can = a.perms.includes("MANAGE_PROPERTY");
  const ownerId = a.ownerId;
  const sp = await searchParams;
  const restricted = a.buildingIds !== null;
  const tabs = TABS.filter(([k]) => !(restricted && (k === "former" || k === "settings")));
  const tab = tabs.some((t) => t[0] === sp.tab) ? sp.tab! : "buildings";
  const scope = flatScope(a);
  const bScope = a.buildingIds ? { buildingId: { in: a.buildingIds } } : {};

  const [buildings, flats, renters, heads, accounts, invoices, former, rentChanges, settings] = await Promise.all([
    db.building.findMany({ where: { ownerId, ...(a.buildingIds ? { id: { in: a.buildingIds } } : {}) } }),
    db.flat.findMany({ where: { ownerId, ...scope }, include: { building: true, renter: { include: { user: true } } }, orderBy: { label: "asc" } }),
    db.renter.findMany({ where: { ownerId, flat: scope }, include: { user: true, flat: { include: { building: true } } } }),
    db.billingHead.findMany({ where: { ownerId, ...bScope } }),
    db.paymentAccount.findMany({ where: { ownerId } }),
    db.invoice.findMany({ where: { ownerId, flat: scope }, orderBy: { month: "desc" } }),
    db.formerRenter.findMany({ where: { ownerId }, orderBy: { moveOutDate: "desc" } }),
    db.rentChange.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } }),
    db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { dueDay: true, lateFee: true } }),
  ]);
  const lastDue = new Map<string, number>();
  for (const i of invoices) if (!lastDue.has(i.flatId)) lastDue.set(i.flatId, i.dueAmount);
  const vacant = flats.filter((f) => f.status === "VACANT");
  const bName = (id: string | null) => buildings.find((b) => b.id === id)?.name ?? "-";
  const bOpts = buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>);
  const T = <input type="hidden" name="tab" value={tab} />;
  const del = (action: (f: FormData) => Promise<void>, id: string, msg: string) => (
    <form action={action} className="mt-4 border-t pt-4"><input type="hidden" name="id" value={id} />{T}<ConfirmButton message={msg}>Delete</ConfirmButton></form>
  );
  const nidLinks = (front: string | null, back: string | null, nid: string | null) => (
    <div className="mt-2 text-sm">NID {nid ?? "-"}{front && <> · <a href={front} target="_blank" rel="noreferrer">front</a></>}{back && <> · <a href={back} target="_blank" rel="noreferrer">back</a></>}</div>
  );

  const buildingForm = (b?: (typeof buildings)[number]) => (
    <form action={b ? A.updateBuilding : A.addBuilding} className="grid gap-3">
      {T}{b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Building name"><input name="name" defaultValue={b?.name} required /></Field>
      <Field label="Address"><input name="address" defaultValue={b?.address} required /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
  const flatForm = (f?: (typeof flats)[number]) => (
    <form action={f ? A.updateFlat : A.addFlat} className="grid gap-3">
      {T}{f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Building"><select name="buildingId" defaultValue={f?.buildingId} required>{bOpts}</select></Field>
      <Field label="Flat label" hint="For example 1A, 2B or Ground Floor"><input name="label" defaultValue={f?.label} required /></Field>
      <Field label="Base rent (৳)"><input name="baseRent" type="number" min={0} defaultValue={f?.baseRent} required /></Field>
      {f && <Field label="Status"><select name="status" defaultValue={f.status}><option>VACANT</option><option>OCCUPIED</option><option>MAINTENANCE</option></select></Field>}
      <Button type="submit">Save</Button>
    </form>
  );
  const renterForm = (r?: (typeof renters)[number]) => (
    <form action={r ? A.updateRenter : A.addRenter} className="grid gap-3">
      {T}{r && <input type="hidden" name="id" value={r.id} />}
      {!r && <Field label="Vacant flat"><select name="flatId" required>{vacant.map((f) => <option key={f.id} value={f.id}>{f.building.name} {f.label}</option>)}</select></Field>}
      <Field label="Full name"><input name="name" defaultValue={r?.user.name} required /></Field>
      <Field label="Phone (also the login)"><input name="phone" defaultValue={r?.phone} placeholder="01XXXXXXXXX" required /></Field>
      <Field label="WhatsApp number" hint="Leave blank to use the phone number"><input name="whatsappNumber" defaultValue={r?.whatsappNumber} /></Field>
      <Field label={r ? "New password" : "Login password"} hint={r ? "Leave blank to keep the current one" : "At least 6 characters"}><input name="password" minLength={6} required={!r} /></Field>
      <Field label="NID number"><input name="nidNumber" defaultValue={r?.nidNumber ?? ""} /></Field>
      <Field label="Emergency contact"><input name="emergencyContact" defaultValue={r?.emergencyContact ?? ""} /></Field>
      <Field label="Move-in date"><input name="moveInDate" type="date" defaultValue={r ? day(r.moveInDate) : undefined} required /></Field>
      <Field label="Lease end date" hint="Optional. You are reminded 60 days before."><input name="leaseEnd" type="date" defaultValue={r?.leaseEnd ? day(r.leaseEnd) : undefined} /></Field>
      <Field label="Advance deposit (৳)"><input name="advanceDeposit" type="number" min={0} defaultValue={r?.advanceDeposit} /></Field>
      <Field label="NID front (photo or PDF)"><input name="nidFront" type="file" accept="image/*,application/pdf" /></Field>
      <Field label="NID back (photo or PDF)"><input name="nidBack" type="file" accept="image/*,application/pdf" /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
  const headForm = (h?: (typeof heads)[number]) => (
    <form action={h ? A.updateBillingHead : A.addBillingHead} className="grid gap-3">
      {T}{h && <input type="hidden" name="id" value={h.id} />}
      <Field label="Building"><select name="buildingId" defaultValue={h?.buildingId ?? undefined} required>{bOpts}</select></Field>
      <Field label="Name" hint="For example Service Charge, Guard, Garbage or Electricity"><input name="name" defaultValue={h?.name} required /></Field>
      <Field label="Type"><select name="type" defaultValue={h?.type}><option value="FIXED">Fixed charge</option><option value="METERED">Metered (electricity)</option></select></Field>
      <Field label="Fixed amount (৳)" hint="Used by fixed charges"><input name="fixedAmount" type="number" min={0} step="any" defaultValue={h?.fixedAmount} /></Field>
      <Field label="Unit rate (৳)" hint="Used by metered charges"><input name="unitRate" type="number" min={0} step="any" defaultValue={h?.unitRate} /></Field>
      <Field label="Demand charge (৳)" hint="Used by metered charges"><input name="demandCharge" type="number" min={0} step="any" defaultValue={h?.demandCharge} /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
  const accountForm = (c?: (typeof accounts)[number]) => (
    <form action={c ? A.updatePaymentAccount : A.addPaymentAccount} className="grid gap-3">
      {T}{c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Method"><select name="method" defaultValue={c?.method}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
      <Field label="Mobile or account number"><input name="number" defaultValue={c?.number ?? ""} /></Field>
      <Field label="Bank name" hint="Bank only"><input name="bankName" defaultValue={c?.bankName ?? ""} /></Field>
      <Field label="Branch" hint="Bank only"><input name="branch" defaultValue={c?.branch ?? ""} /></Field>
      <Field label="Routing number" hint="Bank only"><input name="routingNo" defaultValue={c?.routingNo ?? ""} /></Field>
      <Button type="submit">Save</Button>
    </form>
  );

  let action: React.ReactNode = null;
  let body: React.ReactNode = null;

  if (tab === "buildings") {
    action = can && <Modal trigger={add("Add building")} title="Add building" variant="default" small={false}>{buildingForm()}</Modal>;
    body = <FilterableList empty="No buildings yet. Add your first building." items={buildings.map((b) => ({
      id: b.id, search: `${b.name} ${b.address}`,
      node: (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{b.name}</div><div className="text-sm text-muted-foreground">{b.address}</div></div><StatusBadge status={`${flats.filter((f) => f.buildingId === b.id).length} flats`} /></div>
          {can && <div className="mt-3"><Modal trigger="Edit" title="Edit building">{buildingForm(b)}{del(A.deleteBuilding, b.id, `Delete ${b.name}? This only works when none of its flats has a renter or billing history.`)}</Modal></div>}
        </Card>
      ),
    }))} />;
  } else if (tab === "flats") {
    action = can && buildings.length > 0 && <Modal trigger={add("Add flat")} title="Add flat" variant="default" small={false}>{flatForm()}</Modal>;
    body = <FilterableList groups={["VACANT", "OCCUPIED", "MAINTENANCE"]} groupLabel="All statuses" placeholder="Search flats or renters" empty={buildings.length ? "No flats yet." : "Add a building first."} items={flats.map((f) => ({
      id: f.id, group: f.status, search: `${f.building.name} ${f.label} ${f.renter?.user.name ?? ""}`,
      node: (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">Flat {f.label}</div><div className="text-sm text-muted-foreground">{f.building.name}</div></div><StatusBadge status={f.status} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Base rent" value={tk(f.baseRent)} strong /><Stat label="Renter" value={f.renter?.user.name ?? "-"} />{f.creditBalance > 0 && <Stat label="Advance credit" value={tk(f.creditBalance)} />}</div>
          {can && <div className="mt-3"><Modal trigger="Edit" title={`Edit flat ${f.label}`}>{flatForm(f)}{rentChanges.filter((c) => c.flatId === f.id).length > 0 && <div className="mt-4 border-t pt-3 text-sm"><div className="mb-1 font-medium">Rent history</div>{rentChanges.filter((c) => c.flatId === f.id).slice(0, 8).map((c) => <div key={c.id} className="text-muted-foreground">{day(c.createdAt)}: {tk(c.oldRent)} to {tk(c.newRent)}</div>)}</div>}{del(A.deleteFlat, f.id, `Delete flat ${f.label}? This only works when it has no renter or billing history.`)}</Modal></div>}
        </Card>
      ),
    }))} />;
  } else if (tab === "renters") {
    action = can && vacant.length > 0 && <Modal trigger={add("Add renter")} title="Add renter" variant="default" small={false}>{renterForm()}</Modal>;
    body = (
      <>
        {can && vacant.length === 0 && <p className="mb-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">There is no vacant flat to add a renter to.</p>}
        <FilterableList placeholder="Search by name, phone or flat" empty="No renters yet." items={renters.map((r) => {
          const due = lastDue.get(r.flatId) ?? 0;
          const credit = r.flat.creditBalance;
          const bal = r.advanceDeposit + credit - due;
          return {
            id: r.id, search: `${r.user.name} ${r.phone} ${r.flat.label} ${r.flat.building.name}`,
            node: (
              <Card className="p-4">
                <div className="font-semibold">{r.user.name}</div>
                <div className="text-sm text-muted-foreground">{r.flat.building.name}, flat {r.flat.label}</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Phone" value={r.phone} /><Stat label="Advance deposit" value={tk(r.advanceDeposit)} strong />{credit > 0 && <Stat label="Advance credit" value={tk(credit)} />}{r.leaseEnd && <Stat label="Lease ends" value={day(r.leaseEnd)} />}</div>
                {nidLinks(r.nidFrontUrl, r.nidBackUrl, r.nidNumber)}
                {can && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Modal trigger="Edit" title={`Edit ${r.user.name}`}>{renterForm(r)}</Modal>
                    <Modal trigger="Move out" title={`Move out ${r.user.name}`} variant="ghost">
                      <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 sm:grid-cols-4"><Stat label="Deposit" value={tk(r.advanceDeposit)} /><Stat label="Advance credit" value={tk(credit)} /><Stat label="Due" value={tk(due)} /><Stat label={bal >= 0 ? "Refund due" : "Renter owes"} value={tk(Math.abs(bal))} strong /></div>
                      <form action={A.moveOut} className="grid gap-3">
                        {T}<input type="hidden" name="flatId" value={r.flatId} />
                        <Field label="Refund paid to renter (৳)" hint="Record what you actually returned"><input name="refund" type="number" min={0} max={r.advanceDeposit + credit} step="any" defaultValue={Math.max(bal, 0)} required /></Field>
                        <Field label="Note"><input name="note" placeholder="For example deducted for repairs" /></Field>
                        <ConfirmButton message={`Move ${r.user.name} out? Their login is removed and the flat becomes vacant. Their details move to Former renters.`}>Complete move-out</ConfirmButton>
                      </form>
                    </Modal>
                  </div>
                )}
              </Card>
            ),
          };
        })} />
      </>
    );
  } else if (tab === "heads") {
    action = can && buildings.length > 0 && <Modal trigger={add("Add billing head")} title="Add billing head" variant="default" small={false}>{headForm()}</Modal>;
    body = <FilterableList empty="No billing heads yet. Add gas, water, service charge or electricity." items={heads.map((h) => ({
      id: h.id, search: `${h.name} ${bName(h.buildingId)}`,
      node: (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{h.name}</div><div className="text-sm text-muted-foreground">{bName(h.buildingId)}</div></div><StatusBadge status={h.type} /></div>
          <div className="mt-3 text-sm">{h.type === "FIXED" ? tk(h.fixedAmount) : `${tk(h.unitRate)} per unit + ${tk(h.demandCharge)} demand`}</div>
          {can && <div className="mt-3"><Modal trigger="Edit" title={`Edit ${h.name}`}>{headForm(h)}{del(A.deleteBillingHead, h.id, `Delete ${h.name}? Existing invoices are not changed.`)}</Modal></div>}
        </Card>
      ),
    }))} />;
  } else if (tab === "accounts") {
    action = can && <Modal trigger={add("Add account")} title="Add payment account" variant="default" small={false}>{accountForm()}</Modal>;
    body = <FilterableList empty="No payment accounts yet. Renters need these to know where to send money." items={accounts.map((c) => ({
      id: c.id, search: `${c.method} ${c.number ?? ""} ${c.bankName ?? ""}`,
      node: (
        <Card className="p-4">
          <div className="font-semibold">{c.method}</div>
          <div className="text-sm text-muted-foreground">{c.number ?? "-"}{c.bankName ? `, ${c.bankName}` : ""}{c.branch ? ` (${c.branch})` : ""}{c.routingNo ? `, routing ${c.routingNo}` : ""}</div>
          {can && <div className="mt-3"><Modal trigger="Edit" title={`Edit ${c.method}`}>{accountForm(c)}{del(A.deletePaymentAccount, c.id, "Delete this payment account?")}</Modal></div>}
        </Card>
      ),
    }))} />;
  } else if (tab === "settings") {
    body = (
      <Card className="max-w-md p-5">
        <form action={A.updateSettings} className="grid gap-3">
          {T}
          <Field label="Rent due on day of month" hint="1 to 28. Invoices get this due date."><input name="dueDay" type="number" min={1} max={28} defaultValue={settings.dueDay} required disabled={!can} /></Field>
          <Field label="Late fee (৳)" hint="Added once to a flat's unpaid invoice when you press Apply late fees on the Overdue page. 0 means no late fee."><input name="lateFee" type="number" min={0} step="any" defaultValue={settings.lateFee} required disabled={!can} /></Field>
          {can && <Button type="submit">Save</Button>}
        </form>
      </Card>
    );
  } else {
    body = <FilterableList placeholder="Search former renters" empty="No former renters yet. Renters you move out are kept here." items={former.map((r) => ({
      id: r.id, search: `${r.name} ${r.phone} ${r.flatLabel} ${r.buildingName}`,
      node: (
        <Card className="p-4">
          <div className="font-semibold">{r.name}</div>
          <div className="text-sm text-muted-foreground">{r.buildingName}, flat {r.flatLabel}</div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="Stay" value={`${day(r.moveInDate)} to ${day(r.moveOutDate)}`} /><Stat label="Phone" value={r.phone} /><Stat label="Deposit / final due" value={`${tk(r.advanceDeposit)} / ${tk(r.finalDue)}`} /><Stat label="Refund paid" value={tk(r.refundPaid)} strong /></div>
          {r.settlementNote && <div className="mt-2 text-sm text-muted-foreground">{r.settlementNote}</div>}
          {nidLinks(r.nidFrontUrl, r.nidBackUrl, r.nidNumber)}
        </Card>
      ),
    }))} />;
  }

  return (
    <main>
      <Flash ok={sp.ok} error={sp.error} />
      <PageHeader title="Setup" subtitle="Buildings, flats, renters and billing rules" action={action} />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/dashboard/setup?tab=${k}`} style={{ textDecoration: "none", color: tab === k ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", borderBottom: tab === k ? "2px solid hsl(var(--primary))" : "2px solid transparent" }} className="shrink-0 px-3 py-2 text-sm font-medium">{label}</Link>
        ))}
      </div>
      {body}
    </main>
  );
}
