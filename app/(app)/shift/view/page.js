import { redirect } from "next/navigation";

// Shift logs belong to SOC analysts only. Managers review shift figures in Performance and Reports.
export default function Page() {
  redirect("/reports/shift");
}
