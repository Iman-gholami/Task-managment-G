import KpiPreview from "@/components/analytics/screens/KpiPreview";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · KPI evaluation preview" };

export default async function Page() {
  await requireAnalyticsManager();
  return <KpiPreview />;
}
