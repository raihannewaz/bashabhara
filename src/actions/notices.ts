"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { runAction } from "@/lib/run";
import { audit } from "@/lib/audit";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function addNotice(f: FormData) {
  await runAction("/dashboard/notices", async () => {
    const ownerId = await requireTenant("MANAGE_PROPERTY");
    const d = z.object({ title: z.string().min(3).max(120), body: z.string().min(3).max(2000), buildingId: z.string().nullable() }).parse({ title: str(f, "title"), body: str(f, "body"), buildingId: str(f, "buildingId") || null });
    if (d.buildingId && !(await db.building.findFirst({ where: { id: d.buildingId, ownerId } }))) throw new Error("Building not found");
    await db.notice.create({ data: { ...d, ownerId } });
    await audit(ownerId, "Posted notice", d.title);
  });
}

export async function deleteNotice(f: FormData) {
  await runAction("/dashboard/notices", async () => {
    const ownerId = await requireTenant("MANAGE_PROPERTY");
    await db.notice.deleteMany({ where: { id: str(f, "id"), ownerId } });
  });
}
