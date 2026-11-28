import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { isTaskManager } from "@/lib/roles";

export default async function Page() {
  redirect(isTaskManager(await getCurrentUser()) ? "/tasks/assigned" : "/tasks/my");
}
