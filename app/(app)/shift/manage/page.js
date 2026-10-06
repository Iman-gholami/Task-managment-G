import { redirect } from "next/navigation";
import ShiftLogManager from "@/components/screens/ShiftLogManager";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export const metadata = { title: "Shift Log Corrections" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!isManager(user)) redirect("/dashboard");
  return <ShiftLogManager />;
}
