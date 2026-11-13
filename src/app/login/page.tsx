import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

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
        <CardHeader><CardTitle>Log in to BashaBhara</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">Wrong email, phone or password, or the account is locked for 15 minutes after 5 failed attempts.</p>}
          <form action={login} className="grid gap-3">
            <Input name="identifier" placeholder="Email or phone" required />
            <Input name="password" type="password" placeholder="Password" required />
            <Button type="submit">Log in</Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">Forgot your password? Renters and staff: ask your landlord to reset it. Landlords: ask the administrator.</p>
        </CardContent>
      </Card>
    </div>
  );
}
