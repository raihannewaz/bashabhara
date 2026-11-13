import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);
const area: Record<string, string[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/dashboard": ["OWNER", "STAFF"],
  "/portal": ["RENTER"],
};

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const rule = Object.keys(area).find((p) => path.startsWith(p));
  if (!rule) return;
  const role = req.auth?.user?.role;
  if (!role || !area[rule].includes(role)) return NextResponse.redirect(new URL("/login", req.url));
});

export const config = { matcher: ["/admin/:path*", "/dashboard/:path*", "/portal/:path*"] };
