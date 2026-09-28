import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export default async function Page() {
  const me = await getCurrentUser();
  redirect(isManager(me) ? "/performance/overview" : `/performance/employees/${me.id}`);
}
