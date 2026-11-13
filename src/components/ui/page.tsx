import { cn } from "@/lib/utils";

export const tk = (n: number) => `৳${n.toLocaleString("en-US")}`;

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="!mb-0">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1"><span className="text-sm text-muted-foreground">{label}</span>{children}{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</label>;
}

const tones: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  slate: "bg-muted text-muted-foreground",
};
const toneOf: Record<string, string> = { PAID: "green", APPROVED: "green", OCCUPIED: "green", ACTIVE: "green", PRO: "green", PARTIAL: "amber", PENDING: "amber", MAINTENANCE: "amber", UNPAID: "red", REJECTED: "red", SUSPENDED: "red" };

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tones[toneOf[status] ?? "slate"], className)}>{status}</span>;
}

/** Small label and value pair used inside cards. */
export function Stat({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className={cn("text-sm", strong && "font-semibold")}>{value}</div></div>;
}
