import { redirect } from "next/navigation";
import { Vazirmatn } from "next/font/google";
import ShiftSchedule from "@/components/screens/ShiftSchedule";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-vazirmatn",
});

export const metadata = { title: "Shift Schedule" };

export default async function Page() {
  if (!isManager(await getCurrentUser())) redirect("/dashboard");
  return (
    <div className={vazirmatn.variable}>
      <ShiftSchedule />
    </div>
  );
}
