import Link from "next/link";
import { LogOut, UserCog } from "lucide-react";
import { signOut } from "@/auth";
import { getT } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";

/** Header for the renter portal and the admin area. */
export default async function TopBar({ title }: { title: string }) {
  const { t } = await getT();
  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <div><span className="font-bold">BashaBhara</span><span className="ml-2 hidden text-sm text-muted-foreground sm:inline">{title}</span></div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link href="/account" style={{ textDecoration: "none", color: "hsl(var(--foreground))" }} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"><UserCog className="h-4 w-4" /><span className="hidden sm:inline">{t("nav.account")}</span></Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="flex items-center gap-2" style={{ background: "transparent", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--input))", padding: "6px 12px" }}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">{t("nav.logout")}</span></button>
          </form>
        </div>
      </div>
    </header>
  );
}
