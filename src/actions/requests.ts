"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRenter, requireScope } from "@/lib/tenant";
import { runAction } from "@/lib/run";
import { audit } from "@/lib/audit";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** A renter reports a problem with their flat. */
export async function createRequest(f: FormData) {
  await runAction("/portal", async () => {
    const r = await getRenter();
    if (!r) throw new Error("Forbidden");
    const d = z.object({ title: z.string().min(3).max(120), details: z.string().max(1000).nullable() }).parse({ title: str(f, "title"), details: str(f, "details") || null });
    await db.serviceRequest.create({ data: { ownerId: r.ownerId, flatId: r.flatId, buildingId: r.flat.buildingId, flatLabel: r.flat.label, renterName: r.user.name, ...d } });
  });
}

/** The landlord or caretaker updates the status of a request and replies to the renter. */
export async function updateRequest(f: FormData) {
  await runAction("/dashboard/requests", async () => {
    const { ownerId, buildingIds } = await requireScope(["VIEW_FLATS", "MANAGE_PROPERTY"]);
    const d = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]), response: z.string().max(500).nullable() }).parse({ status: str(f, "status"), response: str(f, "response") || null });
    const r = await db.serviceRequest.updateMany({ where: { id: str(f, "id"), ownerId, ...(buildingIds ? { buildingId: { in: buildingIds } } : {}) }, data: d });
    if (!r.count) throw new Error("Request not found");
    await audit(ownerId, "Updated repair request", d.status);
  });
}
