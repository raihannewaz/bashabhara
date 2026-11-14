import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getT } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { t } = await getT();

  async function login(form: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        identifier: String(form.get("identifier")),
        password: String(form.get("password")),
        redirectTo: "/home",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>{t("login.title")}</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{t("login.wrong")}</p>}
          <form action={login} className="grid gap-3">
            <Input name="identifier" placeholder={t("login.id")} required />
            <Input name="password" type="password" placeholder={t("login.password")} required />
            <Button type="submit">{t("login.submit")}</Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">{t("login.forgot")}</p>
        </CardContent>
      </Card>
      <div className="fixed left-4 top-4"><LangToggle /></div>
    </div>
  );
}
