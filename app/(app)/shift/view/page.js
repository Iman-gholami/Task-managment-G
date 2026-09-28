import { Suspense } from "react";
import { ShiftView } from "@/components/screens/ShiftLog";

export const metadata = { title: "Shift Log" };

export default function Page() {
  return <Suspense><ShiftView /></Suspense>;
}
