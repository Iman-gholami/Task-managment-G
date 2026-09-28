import { redirect } from "next/navigation";
import { PerformanceOverview } from "@/components/screens/Performance";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export const metadata = { title: "Performance Overview" };

export default async function Page() {
  if (!isManager(await getCurrentUser())) redirect("/performance/employees");
  return <PerformanceOverview />;
}
