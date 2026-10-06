import { Suspense } from "react";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsContext";

// The provider persists across the analytics tabs, so switching tabs keeps the loaded data and filters.
export default function AnalyticsLayout({ children }) {
  return (
    <Suspense>
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </Suspense>
  );
}
