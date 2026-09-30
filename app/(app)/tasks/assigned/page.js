import { Suspense } from "react";
import Tasks from "@/components/screens/Tasks";

export const metadata = { title: "Assigned by me" };

export default function Page() {
  return <Suspense><Tasks scope="assigned" /></Suspense>;
}
