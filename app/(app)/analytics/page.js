import Overview from "@/components/analytics/screens/Overview";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Overview />;
}
