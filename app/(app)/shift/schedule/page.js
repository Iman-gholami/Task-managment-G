import { redirect } from "next/navigation";
import ShiftSchedule from "@/components/screens/ShiftSchedule";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export const metadata = { title: "Shift Schedule" };

export default async function Page() {
  if (!isManager(await getCurrentUser())) redirect("/dashboard");
  return <ShiftSchedule />;
}
