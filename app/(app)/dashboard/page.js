import Dashboard from "@/components/screens/Dashboard";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  if ((await getCurrentUser())?.role === "observer") redirect("/analytics");
  return <Dashboard />;
}
