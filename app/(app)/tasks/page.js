import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export default async function Page() {
  redirect(isManager(await getCurrentUser()) ? "/tasks/assigned" : "/tasks/my");
}
