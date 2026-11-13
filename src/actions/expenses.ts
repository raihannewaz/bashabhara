"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { runAction } from "@/lib/run";

const run = (fn: () => Promise<unknown>) => runAction("/dashboard/expenses", fn);
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const schema = z.object({ category: z.string().min(2), amount: z.number().positive(), note: z.string().nullable(), date: z.string().min(8), buildingId: z.string().nullable() });
const read = (f: FormData) => ({ category: str(f, "category"), amount: Number(f.get("amount") || 0), note: str(f, "note") || null, date: str(f, "date"), buildingId: str(f, "buildingId") || null });

async function check(ownerId: string, buildingId: string | null) {
  if (buildingId && !(await db.building.findFirst({ where: { id: buildingId, ownerId } }))) throw new Error("Building not found");
}
export async function addExpense(f: FormData) {
  await run(async () => {
    const ownerId = await requireTenant("MANAGE_EXPENSES");
    const d = schema.parse(read(f));
    await check(ownerId, d.buildingId);
    await db.expense.create({ data: { ...d, date: new Date(d.date), ownerId } });
  });
}
export async function updateExpense(f: FormData) {
  await run(async () => {
    const ownerId = await requireTenant("MANAGE_EXPENSES");
    const d = schema.parse(read(f));
    await check(ownerId, d.buildingId);
    const r = await db.expense.updateMany({ where: { id: str(f, "id"), ownerId }, data: { ...d, date: new Date(d.date) } });
    if (!r.count) throw new Error("Expense not found");
  });
}
