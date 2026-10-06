import People from "@/components/analytics/screens/People";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · People" };

export default async function Page() {
  await requireAnalyticsManager();
  return <People />;
}
