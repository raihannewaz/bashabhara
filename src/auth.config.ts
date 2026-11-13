import type { NextAuthConfig } from "next-auth";

export type AppRole = "SUPER_ADMIN" | "OWNER" | "STAFF" | "RENTER";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: AppRole; ownerId: string | null; permissions: string[] };
        token.role = u.role; token.ownerId = u.ownerId; token.permissions = u.permissions;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role as AppRole;
      session.user.ownerId = token.ownerId as string | null;
      session.user.permissions = (token.permissions as string[]) ?? [];
      return session;
    },
  },
} satisfies NextAuthConfig;
