"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runAction } from "@/lib/run";

export async function changePassword(f: FormData) {
  await runAction("/account", async () => {
    const u = (await auth())?.user;
    if (!u) throw new Error("Please log in again");
    const d = z.object({ current: z.string().min(1), next: z.string().min(6, "New password needs at least 6 characters"), confirm: z.string() })
      .refine((x) => x.next === x.confirm, "New passwords do not match")
      .parse({ current: String(f.get("current") ?? ""), next: String(f.get("next") ?? ""), confirm: String(f.get("confirm") ?? "") });
    const row = await db.user.findUnique({ where: { id: u.id } });
    if (!row || !(await bcrypt.compare(d.current, row.password))) throw new Error("Current password is wrong");
    await db.user.update({ where: { id: u.id }, data: { password: await bcrypt.hash(d.next, 10) } });
  });
}
