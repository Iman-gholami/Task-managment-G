import { redirect } from "next/navigation";

export const metadata = { title: "Shift Schedule" };

export default function Page() {
  redirect("/shifts");
}
