"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccess } from "@/lib/tenant";
import { runAction } from "@/lib/run";
import { phoneSchema } from "@/lib/phone";

export async function submitSubscription(f: FormData) {
  await runAction("/dashboard/plan", async () => {
    const a = await getAccess();
    if (!a?.isOwner) throw new Error("Only the landlord can upgrade the plan");
    const d = z.object({ amount: z.number().positive(), transactionId: z.string().min(4), senderNumber: phoneSchema })
      .parse({ amount: Number(f.get("amount") || 0), transactionId: String(f.get("transactionId") ?? "").trim(), senderNumber: String(f.get("senderNumber") ?? "").trim() });
    await db.subscriptionPayment.create({ data: { ...d, ownerId: a.ownerId } });
  });
}
