import { Suspense } from "react";
import { ShiftHistory } from "@/components/screens/ShiftLog";

export const metadata = { title: "Shift Log History" };

export default function Page() {
  return <Suspense><ShiftHistory /></Suspense>;
}
