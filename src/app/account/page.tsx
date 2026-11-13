import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { changePassword } from "@/actions/account";
import Flash from "@/components/Flash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/page";

export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const u = (await auth())?.user;
  if (!u) redirect("/login");
  const { error, ok } = await searchParams;
  return (
    <main className="max-w-md">
      <Flash ok={ok} error={error} />
      <Link href="/home" className="text-sm">&larr; Back</Link>
      <h1 className="mt-2">My account</h1>
      <p className="mb-4 text-muted-foreground">{u.name}</p>
      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <form action={changePassword} className="grid gap-3">
            <Field label="Current password"><input name="current" type="password" required /></Field>
            <Field label="New password" hint="At least 6 characters"><input name="next" type="password" required minLength={6} /></Field>
            <Field label="Repeat new password"><input name="confirm" type="password" required minLength={6} /></Field>
            <Button type="submit">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
