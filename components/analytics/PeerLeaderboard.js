"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { hbarOption } from "@/components/analytics/chartOptions";
import { ChartPanel, DataTable } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import { faDigits } from "@/lib/analytics/calendar";
import { isNum } from "@/lib/analytics/format";
import { ROLE_FA, groupFa } from "@/lib/analytics/labels";
import { ACTIVITY_WEIGHTS, activityLeaderboard } from "@/lib/analytics/performance";

const BASE_CHARTS = [
  { key: "completed", label: "تعداد تسک تکمیل‌شده", kind: "count", question: "چه کسی تعداد بیشتری تسک را در همین بازه به پایان رسانده است؟" },
  { key: "units", label: "حجم کار وزن‌دار", kind: "count", question: "با درنظرگرفتن پیچیدگی تسک‌ها، حجم خروجی هر کارشناس چقدر بوده است؟" },
  { key: "hours", label: "ساعت ثبت‌شده روی تسک‌ها", kind: "count", question: "چه میزان زمان ثبت‌شده برای تسک‌های تکمیل‌شده وجود دارد؟ این شاخص دستی است و در امتیاز فعالیت وارد نمی‌شود." },
];

const SHIFT_CHARTS = [
  { key: "actsDone", label: "فعالیت‌های روتین شیفت انجام‌شده", kind: "count", question: "چه کسی تعداد بیشتری از فعالیت‌های منظم شیفت را انجام داده است؟" },
  { key: "closureRate", label: "نرخ بستن لاگ شیفت", kind: "rate", question: "از شیفت‌های گذشته، چه سهمی با لاگ کامل بسته شده است؟" },
];

const topNames = (rows, key) => rows.filter((row) => row.ranks[key] === 1).map((row) => row.person.name).join("، ");

function barBuild(rows, def) {
  const sorted = [...rows].sort((a, b) => {
    const av = isNum(a.cur[def.key]) ? a.cur[def.key] : -Infinity;
    const bv = isNum(b.cur[def.key]) ? b.cur[def.key] : -Infinity;
    return bv - av || a.person.name.localeCompare(b.person.name, "fa");
  });
  return (t) => hbarOption(t, {
    kind: def.kind,
    rows: sorted.map((row) => ({ id: row.person.id, label: row.person.name, value: row.cur[def.key] })),
    labelWidth: 170,
  });
}

export default function PeerLeaderboard() {
  const { view, range, params, setParam } = useAnalytics();
  const board = useMemo(
    () => activityLeaderboard(view, range, params.get("cohort")),
    [view, range, params],
  );

  if (!board.cohort || !board.rows.length) return null;

  const { rows, cohort, cohorts, shift } = board;
  const charts = [...BASE_CHARTS, ...(shift ? SHIFT_CHARTS : [])];
  const chartHeight = Math.max(220, Math.min(440, 88 + rows.length * 38));
  const weights = shift ? ACTIVITY_WEIGHTS.shift : ACTIVITY_WEIGHTS.standard;
  const weightText = shift
    ? "شاخص فعالیت: حجم وزن‌دار ۵۰٪، تعداد تسک ۲۵٪، فعالیت‌های روتین ۱۵٪ و بستن لاگ ۱۰٪."
    : "شاخص فعالیت: حجم وزن‌دار ۷۰٪ و تعداد تسک ۳۰٪.";

  const leaders = [
    ["اول از نظر تعداد تسک", topNames(rows, "completed")],
    ["اول از نظر حجم وزن‌دار", topNames(rows, "units")],
    ...(shift ? [
      ["اول از نظر روتین شیفت", topNames(rows, "actsDone")],
      ["اول از نظر بستن لاگ", topNames(rows, "closureRate")],
    ] : []),
  ].filter(([, names]) => names);

  const columns = [
    { key: "rank", label: "رتبه کلی", kind: "count", value: (row) => row.rank, sort: false },
    {
      key: "name",
      label: "کارشناس",
      value: (row) => row.person.name,
      render: (row) => (
        <span className="an-person">
          {row.person.name}
          <small>{[groupFa(row.person.group), row.person.level, ROLE_FA[row.person.role]].filter(Boolean).join(" · ")}</small>
        </span>
      ),
    },
    { key: "score", label: "شاخص فعالیت", kind: "avg", value: (row) => row.score, title: "۰ تا ۱۰۰؛ فقط داخل همین گروه هم‌سطح قابل مقایسه است" },
    { key: "tasks", label: "تسک", kind: "count", value: (row) => row.cur.completed },
    { key: "taskRank", label: "رتبه تسک", kind: "count", value: (row) => row.ranks.completed },
    { key: "units", label: "حجم وزن‌دار", kind: "count", value: (row) => row.cur.units },
    { key: "unitRank", label: "رتبه حجم", kind: "count", value: (row) => row.ranks.units },
    { key: "hours", label: "ساعت", kind: "count", value: (row) => row.cur.hours },
    { key: "onTime", label: "به‌موقع", kind: "rate", value: (row) => row.cur.onTimeRate },
    { key: "quality", label: "کیفیت عالی/خوب", kind: "rate", value: (row) => row.cur.highQualityShare },
    { key: "returns", label: "برگشتی", kind: "rate", value: (row) => row.cur.returnShare },
    ...(shift ? [
      { key: "shifts", label: "شیفت", kind: "count", value: (row) => row.cur.shifts },
      { key: "acts", label: "روتین انجام‌شده", kind: "count", value: (row) => row.cur.actsDone },
      { key: "actsRank", label: "رتبه روتین", kind: "count", value: (row) => row.ranks.actsDone },
      { key: "routineRate", label: "نرخ روتین", kind: "rate", value: (row) => row.cur.routineRate },
      { key: "closure", label: "بستن لاگ", kind: "rate", value: (row) => row.cur.closureRate },
      { key: "closureRank", label: "رتبه لاگ", kind: "count", value: (row) => row.ranks.closureRate },
      { key: "iocs", label: "IOC", kind: "count", value: (row) => row.cur.iocs },
      { key: "tickets", label: "تیکت", kind: "count", value: (row) => row.cur.tickets },
    ] : []),
  ];

  return (
    <>
      <Panel
        title="رتبه‌بندی کارشناسان هم‌سطح"
        meta={faDigits(rows.length) + " نفر · " + cohort.label}
        actions={
          <select
            className="input input-sm"
            style={{ width: 220 }}
            value={cohort.key}
            onChange={(e) => setParam("cohort", e.target.value)}
            aria-label="گروه هم‌سطح برای رتبه‌بندی"
            data-testid="peer-cohort"
          >
            {cohorts.map((item) => <option key={item.key} value={item.key}>{item.label} · {faDigits(item.rows.length)} نفر</option>)}
          </select>
        }
      >
        <div className="an-note" role="note">
          <Icon name="info" />
          <span>
            مقایسه فقط داخل <b>{cohort.label}</b> انجام می‌شود؛ L1 با L1، L2 با L2 و سایر نقش‌ها با هم‌گروه خودشان. {weightText}
            کیفیت، تحویل به‌موقع و برگشت کار در جدول دیده می‌شوند اما عمداً وارد شاخص فعالیت نشده‌اند تا «حجم کار» با «کیفیت کار» قاطی نشود.
          </span>
        </div>
        <div className="panel-body an-compare-chips" aria-label="نفرات برتر">
          {leaders.map(([label, names]) => <span className="an-chip" key={label}><b>{label}:</b>&nbsp;{names}</span>)}
        </div>
      </Panel>

      <div className="an-row">
        {charts.map((def) => (
          <ChartPanel
            key={def.key}
            title={def.label}
            question={def.question}
            build={barBuild(rows, def)}
            height={chartHeight}
            table={{
              columns: [
                { key: "name", label: "کارشناس", value: (row) => row.person.name },
                { key: "value", label: def.label, kind: def.kind, value: (row) => row.cur[def.key] },
              ],
              rows: [...rows].sort((a, b) => (b.cur[def.key] ?? -Infinity) - (a.cur[def.key] ?? -Infinity)),
            }}
            fileName={"peer-" + def.key}
          />
        ))}
      </div>

      <Panel
        title="جدول رتبه‌بندی مدیریتی"
        meta="ترتیب اولیه بر اساس شاخص فعالیت است؛ هر ستون را هم می‌توانید جداگانه مرتب کنید."
      >
        <DataTable
          columns={columns}
          rows={rows}
          caption={"رتبه‌بندی کارشناسان " + cohort.label}
          testId="peer-ranking-table"
        />
      </Panel>
    </>
  );
}
