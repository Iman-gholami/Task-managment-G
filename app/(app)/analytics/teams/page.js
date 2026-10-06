import Teams from "@/components/analytics/screens/Teams";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · Teams" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Teams />;
}
