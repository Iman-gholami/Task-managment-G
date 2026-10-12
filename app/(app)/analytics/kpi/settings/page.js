import KpiSettings from "@/components/analytics/screens/KpiSettings";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · KPI settings" };

export default async function Page() {
  await requireAnalyticsManager();
  return <KpiSettings />;
}
