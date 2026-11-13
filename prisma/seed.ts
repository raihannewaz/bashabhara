import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash("password123", 10);
  await db.user.upsert({ where: { email: "admin@basha.test" }, update: {}, create: { name: "Super Admin", email: "admin@basha.test", password: pw, role: "SUPER_ADMIN" } });
  const owner = await db.user.upsert({ where: { email: "owner@basha.test" }, update: {}, create: { name: "Rahim Uddin", email: "owner@basha.test", phone: "01711000001", password: pw, role: "OWNER" } });
  if (await db.building.findFirst({ where: { ownerId: owner.id, name: "Rahim Villa" } })) return; // already seeded
  const b = await db.building.create({ data: { ownerId: owner.id, name: "Rahim Villa", address: "Panchlaish, Chattogram" } });
  const flat = await db.flat.create({ data: { ownerId: owner.id, buildingId: b.id, label: "2B", baseRent: 12000, status: "OCCUPIED" } });
  const tUser = await db.user.create({ data: { name: "Karim Hossain", phone: "01811000002", password: pw, role: "RENTER", ownerId: owner.id } });
  await db.renter.create({ data: { ownerId: owner.id, userId: tUser.id, flatId: flat.id, phone: "01811000002", whatsappNumber: "01811000002", moveInDate: new Date("2026-01-01"), advanceDeposit: 24000 } });
  await db.billingHead.createMany({ data: [
    { ownerId: owner.id, buildingId: b.id, name: "Titas Gas", type: "FIXED", fixedAmount: 990 },
    { ownerId: owner.id, buildingId: b.id, name: "Water/WASA", type: "FIXED", fixedAmount: 400 },
    { ownerId: owner.id, buildingId: b.id, name: "Electricity", type: "METERED", unitRate: 8.5, demandCharge: 150 },
  ] });
  await db.paymentAccount.create({ data: { ownerId: owner.id, method: "bKash", number: "01711000001" } });
}
main().finally(() => db.$disconnect());
