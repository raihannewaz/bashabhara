import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Runs an action, then redirects back to `path` with ?ok=1 or ?error=message (path may already hold a query). */
export async function runAction(path: string, fn: () => Promise<unknown>): Promise<void> {
  let error = "";
  try {
    await fn();
  } catch (e) {
    if (e instanceof z.ZodError) error = e.issues.find((i) => i.code === "custom")?.message ?? "Please check the form fields";
    else error = e instanceof Error ? e.message : "Something went wrong";
    if (error.includes("Unique constraint")) error = "That phone, email or TrxID is already in use";
  }
  revalidatePath("/dashboard", "layout");
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}error=${encodeURIComponent(error)}` : `${path}${sep}ok=1`);
}
