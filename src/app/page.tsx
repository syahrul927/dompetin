import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";

export default async function Home() {
  const session = await getSession();

  // Redirect authenticated users to dashboard
  if (session) {
    redirect("/dashboard");
  }

  // Redirect unauthenticated users to login
  redirect("/login");
}
