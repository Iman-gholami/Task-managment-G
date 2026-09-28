import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShiftHistory } from "@/components/screens/ShiftLog";
import { getCurrentUser } from "@/lib/server/auth";
import { isShiftAnalyst } from "@/lib/server/stats";

export const metadata = { title: "Shift Log History" };

export default async function Page() {
  if (!isShiftAnalyst(await getCurrentUser())) redirect("/dashboard");
  return <Suspense><ShiftHistory /></Suspense>;
}
