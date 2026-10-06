import Compare from "@/components/analytics/screens/Compare";
import { requireAnalyticsManager } from "@/lib/server/analytics-access";

export const metadata = { title: "Analytics · Compare" };

export default async function Page() {
  await requireAnalyticsManager();
  return <Compare />;
}
