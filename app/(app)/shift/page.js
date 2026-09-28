import { redirect } from "next/navigation";
import ShiftLog from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Log" };

// Shift logs are kept by SOC analysts only.
export default async function Page() {
  if (!isShiftAnalyst(await getCurrentUser())) redirect("/dashboard");
  return <ShiftLog />;
}
