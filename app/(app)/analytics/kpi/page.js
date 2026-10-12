import KpiEvaluation from "@/components/analytics/screens/KpiEvaluation";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · KPI evaluation" };

export default async function Page() {
  await requireAnalyticsManager();
  return <KpiEvaluation />;
}
