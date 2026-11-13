import type { DefaultSession } from "next-auth";
import type { AppRole } from "./auth.config";
declare module "next-auth" {
  interface Session { user: { id: string; role: AppRole; ownerId: string | null; permissions: string[] } & DefaultSession["user"] }
}
