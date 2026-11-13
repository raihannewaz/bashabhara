import fs from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccess, getRenter } from "@/lib/tenant";
import { KEY_RE, MIME, UPLOAD_DIR } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const k = (await ctx.params).key.join("/");
  if (!KEY_RE.test(k)) return new Response("Not found", { status: 404 });
  const u = (await auth())?.user;
  if (!u) return new Response("Unauthorized", { status: 401 });

  const ownerId = k.split("/")[0];
  const url = `/api/files/${k}`;
  let allowed = false;
  if (u.role === "OWNER" || u.role === "STAFF") {
    const a = await getAccess();
    allowed = !!a && a.ownerId === ownerId && (a.isOwner || a.perms.some((p) => p === "VIEW_FLATS" || p === "MANAGE_PROPERTY" || p === "APPROVE_PAYMENTS"));
  } else if (u.role === "RENTER") {
    const r = await getRenter();
    if (r && r.ownerId === ownerId) {
      allowed = r.nidFrontUrl === url || r.nidBackUrl === url || !!(await db.payment.findFirst({ where: { screenshotUrl: url, invoice: { flatId: r.flatId } } }));
    }
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, k));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": MIME[k.split(".").pop()!], "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
