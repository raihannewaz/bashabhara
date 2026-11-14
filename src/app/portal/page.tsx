import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getRenter } from "@/lib/tenant";
import { getT, type Key } from "@/lib/i18n";
import { submitPayment } from "@/actions/billing";
import { createRequest } from "@/actions/requests";
import { saveUpload } from "@/lib/uploads";
import Flash from "@/components/Flash";
import Modal from "@/components/Modal";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Stat, StatusBadge, tk } from "@/components/ui/page";

export default async function Portal({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const renter = await getRenter();
  if (!renter) redirect("/login");
  const { t } = await getT();
  const { error, ok } = await searchParams;
  const ownerId = renter.ownerId;
  const st = (s: string) => t(`status.${s}` as Key);

  const [invoices, accounts, notices, requests] = await Promise.all([
    db.invoice.findMany({ where: { flatId: renter.flatId }, orderBy: { month: "desc" }, include: { items: true, payments: { orderBy: { createdAt: "desc" } } } }),
    db.paymentAccount.findMany({ where: { ownerId } }),
    db.notice.findMany({ where: { ownerId, OR: [{ buildingId: null }, { buildingId: renter.flat.buildingId }] }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.serviceRequest.findMany({ where: { flatId: renter.flatId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const totalDue = invoices[0]?.dueAmount ?? 0;

  async function pay(form: FormData) {
    "use server";
    let msg = "";
    try {
      await submitPayment({
        invoiceId: String(form.get("invoiceId")),
        paidAmount: Number(form.get("paidAmount")),
        transactionId: String(form.get("transactionId")).trim(),
        senderNumber: String(form.get("senderNumber")).trim(),
        screenshotUrl: await saveUpload(form.get("screenshot"), ownerId),
      });
    } catch (e) {
      msg = e instanceof Error ? e.message : "Could not submit payment";
      if (msg.includes("Unique constraint")) msg = "This TrxID has already been submitted";
      if (e && typeof e === "object" && "issues" in e) msg = "Please check the form fields, including the sender number";
    }
    redirect(msg ? `/portal?error=${encodeURIComponent(msg)}` : "/portal?ok=1");
  }

  return (
    <>
      <TopBar title="Renter portal" />
      <main>
        <Flash ok={ok} error={error} />
        <h1 className="!mb-1">{t("p.hello")}, {renter.user.name}</h1>
        <p className="mb-5 text-muted-foreground">{renter.flat.building.name}, {renter.flat.label}{renter.leaseEnd ? `. ${t("p.lease")} ${renter.leaseEnd.toISOString().slice(0, 10)}` : ""}</p>

        {notices.length > 0 && (
          <div className="mb-5 grid gap-2">
            {notices.map((n) => (
              <Card key={n.id} className="border-primary/40 p-4"><div className="font-semibold">{n.title}</div><p className="mt-1 whitespace-pre-line text-sm">{n.body}</p><div className="mt-1 text-xs text-muted-foreground">{n.createdAt.toISOString().slice(0, 10)}</div></Card>
            ))}
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">{t("p.balance")}</div>
            <div className={`text-3xl font-bold ${totalDue > 0 ? "text-destructive" : "text-primary"}`}>{tk(totalDue)}</div>
            {renter.flat.creditBalance > 0 && <div className="mt-1 text-sm text-muted-foreground">{t("p.credit")}: {tk(renter.flat.creditBalance)}</div>}
          </Card>
          <Card className="p-4">
            <div className="mb-1 text-sm text-muted-foreground">{t("p.sendTo")}</div>
            {accounts.length === 0 ? <p className="text-sm">{t("p.noAccounts")}</p> : accounts.map((a) => (
              <div key={a.id} className="text-sm"><span className="font-medium">{a.method}</span> {a.number ?? ""}{a.bankName ? `, ${a.bankName}${a.branch ? ` (${a.branch})` : ""}${a.routingNo ? `, routing ${a.routingNo}` : ""}` : ""}</div>
            ))}
          </Card>
        </div>

        <h2>{t("p.bills")}</h2>
        {invoices.length === 0 && <p className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">{t("p.noBills")}</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {invoices.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-center justify-between"><div className="text-lg font-semibold">{i.month}</div><StatusBadge status={i.status} label={st(i.status)} /></div>
              {i.dueDate && i.dueAmount > 0 && <div className="text-xs text-muted-foreground">{t("p.dueOn")} {i.dueDate.toISOString().slice(0, 10)}</div>}
              <div className="mt-3 divide-y text-sm">
                {i.items.map((it) => <div key={it.id} className="flex justify-between py-1.5"><span>{it.headName}{it.currentUnit != null ? ` (${it.previousUnit} to ${it.currentUnit})` : ""}</span><span>{tk(it.amount)}</span></div>)}
                {i.previousDue > 0 && <div className="flex justify-between py-1.5"><span>{t("p.prevDue")}</span><span>{tk(i.previousDue)}</span></div>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2"><Stat label={t("p.total")} value={tk(i.totalAmount)} /><Stat label={t("p.paid")} value={tk(i.paidAmount)} /><Stat label={t("p.due")} value={tk(i.dueAmount)} strong /></div>
              {i.payments.length > 0 && (
                <div className="mt-3 grid gap-1 border-t pt-3 text-sm">
                  {i.payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{tk(p.paidAmount)} <StatusBadge status={p.status} label={st(p.status)} className="ml-1" />{p.rejectReason ? ` ${p.rejectReason}` : ""}</span>
                      {p.status === "APPROVED" && <a href={`/api/receipt/${p.id}`} target="_blank" rel="noreferrer">{t("p.receipt")}</a>}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {i.dueAmount > 0 && (
                  <Modal trigger={t("p.pay")} title={`${t("p.pay")}: ${i.month}`} variant="default" small={false}>
                    <p className="mb-3 text-sm text-muted-foreground">{t("p.payHelp")}</p>
                    <form action={pay} className="grid gap-3">
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <Field label={t("p.amount")} hint={t("p.amountHint")}><input name="paidAmount" type="number" min={1} step="any" defaultValue={i.dueAmount} required /></Field>
                      <Field label={t("p.trx")}><input name="transactionId" required minLength={4} /></Field>
                      <Field label={t("p.sender")}><input name="senderNumber" placeholder="01XXXXXXXXX" required /></Field>
                      <Field label={t("p.shot")}><input name="screenshot" type="file" accept="image/*,application/pdf" /></Field>
                      <Button type="submit">{t("p.submit")}</Button>
                    </form>
                  </Modal>
                )}
                <a href={`/api/bill/${i.id}`} target="_blank" rel="noreferrer" className="text-sm">{t("p.billPdf")}</a>
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-2">
          <h2 className="!mb-0">{t("p.requests")}</h2>
          <Modal trigger={t("p.report")} title={t("p.report")} variant="outline" small={false}>
            <form action={createRequest} className="grid gap-3">
              <Field label={t("p.reportTitle")}><input name="title" required minLength={3} /></Field>
              <Field label={t("p.reportDetails")}><textarea name="details" rows={3} /></Field>
              <Button type="submit">{t("p.send")}</Button>
            </form>
          </Modal>
        </div>
        {requests.length === 0 ? <p className="text-sm text-muted-foreground">{t("p.noRequests")}</p> : (
          <div className="grid gap-2">
            {requests.map((r) => (
              <Card key={r.id} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{r.title}</span><StatusBadge status={r.status} label={st(r.status)} /></div>
                {r.response && <p className="mt-1 text-muted-foreground">{r.response}</p>}
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
