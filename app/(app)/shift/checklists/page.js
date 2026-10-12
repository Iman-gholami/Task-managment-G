import { redirect } from "next/navigation";
import ShiftChecklists from "@/components/screens/ShiftChecklists";
import { getCurrentUser } from "@/lib/server/auth";
import { canManageChecklists } from "@/lib/roles";

export const metadata = { title: "Shift Log Checklists" };

export default async function Page() {
  if (!canManageChecklists(await getCurrentUser())) redirect("/dashboard");
  return <ShiftChecklists />;
}
