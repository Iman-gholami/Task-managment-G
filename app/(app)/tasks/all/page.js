import { redirect } from "next/navigation";

// "All Tasks" was merged into Team Tasks (a Security Manager's team is the whole department).
export default function Page() {
  redirect("/tasks/team");
}
