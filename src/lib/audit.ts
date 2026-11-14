import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Records who did what. Never throws, so a logging problem cannot block real work. */
export async function audit(ownerId: string, action: string, detail?: string) {
  try {
    const u = (await auth())?.user;
    await db.auditLog.create({ data: { ownerId, userName: u?.name ?? "System", action, detail: detail?.slice(0, 300) ?? null } });
  } catch {
    /* ignore */
  }
}
