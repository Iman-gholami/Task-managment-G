import { redirect } from "next/navigation";
import { EmployeePerformance } from "@/components/screens/Performance";
import { getCurrentUser } from "@/lib/server/auth";
import { canViewManagementAnalytics } from "@/lib/roles";

export const metadata = { title: "Employee Performance" };

export default async function Page({ params }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (id !== me.id && !canViewManagementAnalytics(me)) redirect(`/performance/employees/${me.id}`);
  // `key` remounts the screen per employee so nothing from the previous person is kept.
  return <EmployeePerformance key={id} userId={id} />;
}
