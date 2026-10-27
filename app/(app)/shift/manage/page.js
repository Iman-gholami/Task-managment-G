import { redirect } from "next/navigation";
import ShiftLogManager from "@/components/screens/ShiftLogManager";
import { getCurrentUser } from "@/lib/server/auth";
import { isManager } from "@/lib/roles";

export const metadata = { title: "Shift Log Corrections" };

export default async function Page({ searchParams }) {
  const user = await getCurrentUser();
  if (!isManager(user)) redirect("/dashboard");
  const params = await searchParams;
  return <ShiftLogManager initialSelection={{ user: params?.user ?? "", date: params?.date ?? "" }} />;
}
