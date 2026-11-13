import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { authConfig } from "./auth.config";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { identifier: {}, password: {} },
      async authorize(raw) {
        const p = z.object({ identifier: z.string().min(3), password: z.string().min(6) }).safeParse(raw);
        if (!p.success) return null;
        const { password } = p.data;
        const identifier = p.data.identifier.includes("@") ? p.data.identifier.trim() : normalizePhone(p.data.identifier);
        const u = await db.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
        if (!u || !u.active) return null;
        if (u.lockedUntil && u.lockedUntil > new Date()) return null;
        if (!(await bcrypt.compare(password, u.password))) {
          const n = u.failedLogins + 1;
          await db.user.update({ where: { id: u.id }, data: n >= MAX_ATTEMPTS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: n } });
          return null;
        }
        if (u.failedLogins || u.lockedUntil) await db.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null } });
        const owner = u.role === "OWNER" ? u : u.ownerId ? await db.user.findUnique({ where: { id: u.ownerId } }) : null;
        if (owner && !owner.active) return null;
        return { id: u.id, name: u.name, email: u.email, role: u.role, ownerId: u.role === "OWNER" ? u.id : u.ownerId, permissions: [] } as never;
      },
    }),
  ],
});
