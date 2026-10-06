import Trends from "@/components/analytics/screens/Trends";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · Trends" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Trends />;
}
