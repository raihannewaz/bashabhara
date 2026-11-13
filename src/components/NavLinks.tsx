"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CreditCard, FileText, Gauge, LayoutDashboard, Receipt, UserCog, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = { overview: LayoutDashboard, setup: Building2, readings: Gauge, invoices: FileText, payments: Wallet, expenses: Receipt, reports: BarChart3, staff: Users, plan: CreditCard, account: UserCog };

export default function NavLinks({ links, onNavigate }: { links: { href: string; label: string; icon: string }[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const Icon = icons[l.icon];
        const active = l.href === "/dashboard" ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            style={{ textDecoration: "none", color: active ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))", background: active ? "hsl(var(--primary))" : undefined }}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", !active && "hover:bg-muted")}
          >
            <Icon className="h-4 w-4" />{l.label}
          </Link>
        );
      })}
    </nav>
  );
}
