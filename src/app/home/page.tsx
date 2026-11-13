import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const role = (await auth())?.user?.role;
  if (role === "SUPER_ADMIN") redirect("/admin");
  if (role === "OWNER" || role === "STAFF") redirect("/dashboard");
  if (role === "RENTER") redirect("/portal");
  redirect("/login");
}
