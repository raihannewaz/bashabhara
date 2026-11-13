import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { getAccess, type Permission } from "@/lib/tenant";
import NavLinks from "@/components/NavLinks";
import MobileBar from "@/components/MobileBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const a = await getAccess();
  if (!a) redirect("/login");
  const any = (...p: Permission[]) => p.some((x) => a.perms.includes(x));
  const links = [
    { href: "/dashboard", label: "Overview", icon: "overview", show: true },
    { href: "/dashboard/setup", label: "Setup", icon: "setup", show: any("VIEW_FLATS", "MANAGE_PROPERTY") },
    { href: "/dashboard/readings", label: "Meter & bills", icon: "readings", show: any("ENTER_METER_READING", "GENERATE_BILLS") },
    { href: "/dashboard/invoices", label: "Invoices", icon: "invoices", show: any("GENERATE_BILLS") },
    { href: "/dashboard/payments", label: "Payments", icon: "payments", show: any("APPROVE_PAYMENTS") },
    { href: "/dashboard/expenses", label: "Expenses", icon: "expenses", show: any("MANAGE_EXPENSES") },
    { href: "/dashboard/reports", label: "Reports", icon: "reports", show: any("VIEW_REPORTS") },
    { href: "/dashboard/staff", label: "Staff", icon: "staff", show: a.isOwner },
    { href: "/dashboard/plan", label: "Plan", icon: "plan", show: a.isOwner },
    { href: "/account", label: "Account", icon: "account", show: true },
  ].filter((l) => l.show);

  const logout = (
    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
      <button type="submit" className="flex w-full items-center justify-center gap-2" style={{ background: "transparent", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--input))" }}>
        <LogOut className="h-4 w-4" />Log out
      </button>
    </form>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:gap-2 md:border-r md:bg-card md:p-4">
        <div className="px-2 py-3 text-lg font-bold">BashaBhara</div>
        <NavLinks links={links} />
        <div className="mt-auto">{logout}</div>
      </aside>
      <MobileBar links={links}>{logout}</MobileBar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
