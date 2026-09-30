import { Suspense } from "react";
import Tasks from "@/components/screens/Tasks";

export const metadata = { title: "My tasks" };

export default function Page() {
  return <Suspense><Tasks scope="my" /></Suspense>;
}
