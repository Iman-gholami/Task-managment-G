import { Suspense } from "react";
import { EmployeePerformance } from "@/components/screens/Performance";

export const metadata = { title: "Employee Performance" };

export default function Page() {
  return <Suspense><EmployeePerformance /></Suspense>;
}
