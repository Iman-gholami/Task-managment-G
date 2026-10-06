"use client";

import { useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { AlertList, InsightList, StatusBanner } from "@/components/analytics/blocks";
import { Panel } from "@/components/ui/layout";
import Segmented from "@/components/ui/Segmented";
import { buildAlerts, overallStatus } from "@/lib/analytics/alerts";
import { faDigits } from "@/lib/analytics/calendar";
import { ALERTS } from "@/lib/analytics/config";
import { buildInsights } from "@/lib/analytics/insights";

const n = faDigits;
/** The rules, stated with their live thresholds, so every alert can be traced. */
const RULES = [
  ["بحرانی", `تسک معوق با اولویت بالا یا بحرانی؛ تسک بیش از ${n(ALERTS.overdueOldDays)} روز معوق؛ شیفت‌لاگ کامل‌نشده در ${n(ALERTS.missedLogDays)} روز گذشته`],
  ["نیازمند توجه", `تسک بیش از ${n(ALERTS.blockedDays)} روز مسدود؛ بیش از ${n(ALERTS.reviewDays)} روز منتظر بازبینی؛ ورودی بیشتر از خروجی در ${n(ALERTS.growthWeeks)} هفته کامل اخیر؛ صف باز یک نفر ≥ ${n(ALERTS.loadFactor)} برابر میانه تیم و حداقل ${n(ALERTS.loadMin)}؛ سایر تسک‌های معوق`],
  ["اطلاع", `کارشناس بدون تسک باز (به جز تحلیلگران شیفت)؛ IOC به ازای شیفت ≥ ${n(Math.round(ALERTS.iocDrop * 100))}٪ کمتر از دوره مقایسه (حداقل ${n(ALERTS.iocMinShifts)} شیفت)`],
];

export default function Alerts() {
  return (
    <AnalyticsFrame title="هشدارها و بینش‌ها">
      <AlertsBody />
    </AnalyticsFrame>
  );
}

function AlertsBody() {
  const { view, range, cmp } = useAnalytics();
  const [level, setLevel] = useState("all");
  const m = useMemo(() => {
    const alerts = buildAlerts(view, { range, cmp });
    return { alerts, status: overallStatus(alerts), insights: buildInsights(view, { range, cmp }) };
  }, [view, range, cmp]);
  const count = (l) => m.alerts.filter((x) => x.level === l).length;
  const shown = level === "all" ? m.alerts : m.alerts.filter((x) => x.level === level);

  return (
    <>
      <StatusBanner status={m.status} compact />
      <div className="an-row wide-first">
        <Panel
          title="هشدارها"
          meta="وضعیت اکنون، مستقل از بازه (به جز افت IOC)"
          actions={
            <Segmented
              label="سطح هشدار"
              kind="tabs"
              value={level}
              onChange={setLevel}
              options={[
                { value: "all", label: "همه", count: n(m.alerts.length) },
                { value: "critical", label: "بحرانی", count: n(count("critical")) },
                { value: "warning", label: "نیازمند توجه", count: n(count("warning")) },
                { value: "info", label: "اطلاع", count: n(count("info")) },
              ]}
            />
          }
        >
          <AlertList alerts={shown} emptyText={level === "all" ? "موردی برای پیگیری نیست." : "هشداری در این سطح نیست."} />
        </Panel>
        <Panel title="بینش‌های خودکار" meta={cmp ? `${range.label} نسبت به ${cmp.label}` : range.label}>
          <InsightList insights={m.insights} />
        </Panel>
      </div>
      <Panel title="قواعد هشدار" meta="هشدار و بینش با قاعده‌های ثابت و قابل بررسی ساخته می‌شوند، نه با حدس">
        <dl className="an-rules">
          {RULES.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          <div><dt>بینش</dt><dd>تغییر محسوس نسبت به دوره مقایسه (با حداقل نمونه)، روند سه‌هفته‌ای پیوسته، حجم بیشتر با کیفیت کمتر، تمرکز صف کار روی یک نفر، فعالیت روتینی که کمتر انجام می‌شود، روز غیرعادی تیکت. ارزیابی افراد در آن نیست.</dd></div>
        </dl>
      </Panel>
    </>
  );
}
