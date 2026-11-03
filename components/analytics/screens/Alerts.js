"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

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
  const { t: __analyticsTr } = useAnalyticsI18n();
  return (
    <AnalyticsFrame title={__analyticsTr("هشدارها و بینش‌ها")}>
      <AlertsBody />
    </AnalyticsFrame>
  );
}

function AlertsBody() {
  const { t: __extraTr } = useExtraI18n();
  const { t: __analyticsTr } = useAnalyticsI18n();
  const { view, range, cmp, locale } = useAnalytics();
  const countText = (value) => locale === "fa" ? faDigits(value) : String(value);
  const [level, setLevel] = useState("all");
  const m = useMemo(() => {
    const alerts = buildAlerts(view, { range, cmp, locale });
    return { alerts, status: overallStatus(alerts), insights: buildInsights(view, { range, cmp, locale }) };
  }, [view, range, cmp, locale]);
  const count = (l) => m.alerts.filter((x) => x.level === l).length;
  const shown = level === "all" ? m.alerts : m.alerts.filter((x) => x.level === level);

  return (
    <>
      <StatusBanner status={m.status} compact />
      <div className="an-row wide-first">
        <Panel
          title={__analyticsTr("هشدارها")}
          meta={__analyticsTr("وضعیت اکنون، مستقل از بازه (به جز افت IOC)")}
          actions={
            <Segmented
              label={__analyticsTr("سطح هشدار")}
              kind="tabs"
              value={level}
              onChange={setLevel}
              options={[
                { value: "all", label: __analyticsTr("همه"), count: countText(m.alerts.length) },
                { value: "critical", label: __extraTr("بحرانی"), count: countText(count("critical")) },
                { value: "warning", label: __extraTr("نیازمند توجه"), count: countText(count("warning")) },
                { value: "info", label: __extraTr("اطلاع"), count: countText(count("info")) },
              ]}
            />
          }
        >
          <AlertList alerts={shown} emptyText={level === "all" ? "موردی برای پیگیری نیست." : "هشداری در این سطح نیست."} />
        </Panel>
        <Panel title={__analyticsTr("بینش‌های خودکار")} meta={cmp ? `${range.label} نسبت به ${cmp.label}` : range.label}>
          <InsightList insights={m.insights} />
        </Panel>
      </div>
      <Panel title={__analyticsTr("قواعد هشدار")} meta={__analyticsTr("هشدار و بینش با قاعده‌های ثابت و قابل بررسی ساخته می‌شوند، نه با حدس")}>
        <dl className="an-rules">
          {(locale === "fa" ? RULES : [
            ["Critical", `High-priority or critical overdue tasks; tasks overdue by more than ${ALERTS.overdueOldDays} days; incomplete shift logs in the last ${ALERTS.missedLogDays} days`],
            ["Needs attention", `Tasks blocked for more than ${ALERTS.blockedDays} days or awaiting review for more than ${ALERTS.reviewDays} days; incoming work exceeding completed work for ${ALERTS.growthWeeks} full weeks; one person's open queue at least ${ALERTS.loadFactor} times the team median and at least ${ALERTS.loadMin}; other overdue tasks`],
            ["Information", `Analysts without open tasks, excluding shift analysts; IOC per shift at least ${Math.round(ALERTS.iocDrop * 100)}% below the comparison period (minimum ${ALERTS.iocMinShifts} shifts)`],
          ]).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          <div><dt>{"" + __analyticsTr("بینش") + ""}</dt><dd>{"" + __analyticsTr("تغییر محسوس نسبت به دوره مقایسه (با حداقل نمونه)، روند سه‌هفته‌ای پیوسته، حجم بیشتر با کیفیت کمتر، تمرکز صف کار روی یک نفر، فعالیت روتینی که کمتر انجام می‌شود، روز غیرعادی تیکت. ارزیابی افراد در آن نیست.") + ""}</dd></div>
        </dl>
      </Panel>
    </>
  );
}
