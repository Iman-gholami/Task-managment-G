import { redirect } from "next/navigation";
import { Admin } from "@/components/screens/Misc";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export const metadata = { title: "Administration" };

export default async function Page() {
  if (!isManager(await getCurrentUser())) redirect("/dashboard");
  return <Admin />;
}
