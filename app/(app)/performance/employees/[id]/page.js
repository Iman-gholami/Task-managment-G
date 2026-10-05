import { redirect } from "next/navigation";
import { EmployeePerformance } from "@/components/screens/Performance";
import { getCurrentUser } from "@/lib/server/auth";
import { getUser } from "@/lib/server/repo";
import { inReportScope, isManager } from "@/lib/roles";

export const metadata = { title: "Employee Performance" };

export default async function Page({ params }) {
  const { id } = await params;
  const me = await getCurrentUser();
  // People outside the viewer's report scope (see inReportScope) are not shown.
  if (!inReportScope(me, getUser(id))) redirect(isManager(me) ? "/performance/overview" : `/performance/employees/${me.id}`);
  // `key` remounts the screen per employee so nothing from the previous person is kept.
  return <EmployeePerformance key={id} userId={id} />;
}
