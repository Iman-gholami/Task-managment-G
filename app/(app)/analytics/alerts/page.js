import Alerts from "@/components/analytics/screens/Alerts";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · Alerts" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Alerts />;
}
