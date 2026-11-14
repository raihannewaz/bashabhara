import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { getAccess, type Permission } from "@/lib/tenant";
import { getT } from "@/lib/i18n";
import NavLinks from "@/components/NavLinks";
import MobileBar from "@/components/MobileBar";
import LangToggle from "@/components/LangToggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const a = await getAccess();
  if (!a) redirect("/login");
  const { t } = await getT();
  const any = (...p: Permission[]) => p.some((x) => a.perms.includes(x));
  const links = [
    { href: "/dashboard", label: t("nav.overview"), icon: "overview", show: true },
    { href: "/dashboard/setup", label: t("nav.setup"), icon: "setup", show: any("VIEW_FLATS", "MANAGE_PROPERTY") },
    { href: "/dashboard/readings", label: t("nav.readings"), icon: "readings", show: any("ENTER_METER_READING", "GENERATE_BILLS") },
    { href: "/dashboard/invoices", label: t("nav.invoices"), icon: "invoices", show: any("GENERATE_BILLS") },
    { href: "/dashboard/overdue", label: t("nav.overdue"), icon: "overdue", show: any("GENERATE_BILLS", "APPROVE_PAYMENTS") },
    { href: "/dashboard/payments", label: t("nav.payments"), icon: "payments", show: any("APPROVE_PAYMENTS") },
    { href: "/dashboard/requests", label: t("nav.requests"), icon: "requests", show: any("VIEW_FLATS", "MANAGE_PROPERTY") },
    { href: "/dashboard/notices", label: t("nav.notices"), icon: "notices", show: any("MANAGE_PROPERTY") },
    { href: "/dashboard/expenses", label: t("nav.expenses"), icon: "expenses", show: any("MANAGE_EXPENSES") },
    { href: "/dashboard/reports", label: t("nav.reports"), icon: "reports", show: any("VIEW_REPORTS") },
    { href: "/dashboard/audit", label: t("nav.audit"), icon: "audit", show: a.isOwner },
    { href: "/dashboard/staff", label: t("nav.staff"), icon: "staff", show: a.isOwner },
    { href: "/dashboard/plan", label: t("nav.plan"), icon: "plan", show: a.isOwner },
    { href: "/account", label: t("nav.account"), icon: "account", show: true },
  ].filter((l) => l.show);

  const bottom = (
    <div className="grid gap-2">
      <LangToggle />
      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button type="submit" className="flex w-full items-center justify-center gap-2" style={{ background: "transparent", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--input))" }}>
          <LogOut className="h-4 w-4" />{t("nav.logout")}
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:gap-2 md:overflow-y-auto md:border-r md:bg-card md:p-4">
        <div className="px-2 py-3 text-lg font-bold">BashaBhara</div>
        <NavLinks links={links} />
        <div className="mt-auto pt-3">{bottom}</div>
      </aside>
      <MobileBar links={links}>{bottom}</MobileBar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
