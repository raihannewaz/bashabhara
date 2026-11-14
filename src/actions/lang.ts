"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setLang(f: FormData) {
  const lang = String(f.get("lang")) === "bn" ? "bn" : "en";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
