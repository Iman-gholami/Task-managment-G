import { Suspense } from "react";
import Tasks from "@/components/screens/Tasks";

export const metadata = { title: "Team tasks" };

export default function Page() {
  return <Suspense><Tasks scope="team" /></Suspense>;
}
