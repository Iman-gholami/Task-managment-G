import Report from "@/components/analytics/screens/Report";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · Executive report" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Report />;
}
