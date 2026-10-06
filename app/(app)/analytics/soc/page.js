import Soc from "@/components/analytics/screens/Soc";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · SOC" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Soc />;
}
