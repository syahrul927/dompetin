import { redirect } from "next/navigation";

export default function Home() {
  // Since we rely on middleware for auth checking and routing,
  // anyone hitting the root `/` can just be redirected to login.
  // The middleware will catch authenticated users and redirect them to `/dashboard`.
  redirect("/login");
}
