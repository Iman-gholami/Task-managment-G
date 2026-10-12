"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { hbarOption } from "@/components/analytics/chartOptions";
import { ChartPanel, DataTable } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import { faDigits } from "@/lib/analytics/calendar";
import { MIN_SAMPLE, SCORE } from "@/lib/analytics/config";
import { fmtNum, fmtPct, isNum } from "@/lib/analytics/format";
import { CX_FA, QUAL_FA, ROLE_FA, groupFa } from "@/lib/analytics/labels";
import { scoreLeaderboard } from "@/lib/analytics/performance";

const CHARTS = [
  { key: "score", label: "امتیاز وزن‌دار", kind: "avg", question: "با درنظرگرفتن سختی، کیفیت، تأخیر ارسال و ارزیابی ماهانه شیفت‌لاگ، امتیاز هر کارشناس چقدر است؟", value: (row) => row.score },
  { key: "units", label: "حجم کار وزن‌دار", kind: "count", question: "شاخص آماری قبلی پیچیدگی (۱ تا ۴) برای اطلاع؛ در فرمول امتیاز استفاده نمی‌شود.", value: (row) => row.cur.units },
  { key: "hours", label: "ساعت ثبت‌شده روی تسک‌ها", kind: "count", question: "زمان ثبت‌شده فقط آماری است و در امتیاز وزن‌دار وارد نمی‌شود.", value: (row) => row.cur.hours },
];

const topBy = (rows, value, eligible = () => true) => {
  const candidates = rows.filter((row) => eligible(row) && isNum(value(row)));
  if (!candidates.length) return "";
  const best = Math.max(...candidates.map(value));
  return candidates.filter((row) => value(row) === best).map((row) => row.person.name).join("، ");
};

function barBuild(rows, def) {
  const sorted = [...rows].sort((a, b) => {
    const av = isNum(def.value(a)) ? def.value(a) : -Infinity;
    const bv = isNum(def.value(b)) ? def.value(b) : -Infinity;
    return bv - av || a.person.name.localeCompare(b.person.name, "fa");
  });
  return (t) => hbarOption(t, {
    kind: def.kind,
    rows: sorted.map((row) => ({ id: row.person.id, label: row.person.name, value: def.value(row) })),
    labelWidth: 170,
  });
}

const scoreFormula = (shift) => {
  const cx = Object.entries(SCORE.cxPoints).map(([key, value]) => `${CX_FA[Number(key) - 1]} ${fmtNum(value, 0)}`).join("، ");
  const quality = Object.entries(SCORE.quality).map(([key, value]) => `${QUAL_FA[key]} ×${fmtNum(value, 1)}`).join("، ");
  const late = fmtNum((1 - SCORE.lateFactor) * 100, 0);
  const monthly = shift ? ` ارزیابی ماهانه شیفت‌لاگ نیز بر پایه ${Object.entries(SCORE.monthlyShiftBase).map(([level, base]) => `${level}: ${fmtNum(base, 0)}`).join("، ")} و ضریب کیفیت اضافه می‌شود.` : "";
  return `امتیاز هر تسک = امتیاز سختی (${cx}) × ضریب کیفیت (${quality}؛ بدون امتیاز کیفیت ×${fmtNum(SCORE.unrated, 1)})؛ ارسال برای بازبینی بعد از ددلاین ${late}٪ کسر دارد.${monthly}`;
};

function Details({ row, shift }) {
  const taskColumns = [
    { key: "title", label: "تسک", value: (t) => t.title },
    { key: "cx", label: "سختی", value: (t) => CX_FA[t.cx - 1] ?? "—" },
    { key: "q", label: "کیفیت", value: (t) => t.quality ? QUAL_FA[t.quality] : "ثبت نشده" },
    { key: "late", label: "ارسال", value: (t) => !t.due ? "بدون ددلاین" : t.scoring.late ? "دیر" : "به‌موقع" },
    { key: "score", label: "امتیاز", kind: "avg", value: (t) => t.scoring.score },
  ];
  const reviewColumns = [
    { key: "month", label: "ماه", value: (r) => faDigits(r.month) },
    { key: "rating", label: "کیفیت", value: (r) => QUAL_FA[r.rating] ?? r.rating },
    { key: "points", label: "امتیاز", kind: "avg", value: (r) => r.points },
    { key: "by", label: "ثبت‌کننده", value: (r) => r.byName ?? "—" },
  ];
  return (
    <Panel title={`جزئیات امتیاز — ${row.person.name}`} meta={`امتیاز کل ${fmtNum(row.score, 1)} · تسک‌ها ${fmtNum(row.taskScore, 1)}${shift ? ` · ارزیابی شیفت ${fmtNum(row.reviewScore, 1)}` : ""}`}>
      {row.scoredTasks.length
        ? <DataTable columns={taskColumns} rows={row.scoredTasks} caption={`تسک‌های امتیازدار ${row.person.name}`} />
        : <p className="panel-body muted">در این بازه تسک تأییدشده‌ای برای امتیاز وجود ندارد.</p>}
      {shift && (
        <>
          <div className="panel-head"><h3>ارزیابی‌های ماهانه شیفت‌لاگ</h3></div>
          {row.scoredReviews.length
            ? <DataTable columns={reviewColumns} rows={row.scoredReviews} caption={`ارزیابی‌های شیفت ${row.person.name}`} />
            : <p className="panel-body muted">در ماه‌های هم‌پوشان این بازه ارزیابی ثبت نشده است؛ ماه بدون ارزیابی امتیاز صفر و جریمه ندارد.</p>}
        </>
      )}
    </Panel>
  );
}

export default function PeerLeaderboard() {
  const { view, range, params, setParam } = useAnalytics();
  const [selected, setSelected] = useState(null);
  const board = useMemo(
    () => scoreLeaderboard(view, range, params.get("cohort")),
    [view, range, params],
  );

  if (!board.cohort || !board.rows.length) return null;

  const { rows, cohort, cohorts, shift } = board;
  const chartHeight = Math.max(220, Math.min(440, 88 + rows.length * 38));
  const selectedRow = rows.find((row) => row.person.id === selected) ?? null;
  const leaders = [
    ["اول از نظر امتیاز وزن‌دار", rows.filter((row) => row.rank === 1).map((row) => row.person.name).join("، ")],
    ["اول از نظر سهم کیفیت عالی و خوب", topBy(rows, (row) => row.cur.highQualityShare, (row) => row.cur.qualityN >= MIN_SAMPLE)],
  ].filter(([, names]) => names);

  const columns = [
    { key: "rank", label: "رتبه", kind: "count", value: (row) => row.rank, sort: false },
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
    { key: "score", label: "امتیاز", kind: "avg", value: (row) => row.score, title: "فقط داخل همین گروه هم‌سطح قابل مقایسه است" },
    { key: "ratio", label: "نسبت به نفر اول", kind: "rate", value: (row) => row.leaderRatio },
    { key: "taskScore", label: "امتیاز تسک‌ها", kind: "avg", value: (row) => row.taskScore },
    { key: "late", label: "کسر تأخیر", kind: "avg", value: (row) => row.lateDeduction },
    ...(shift ? [{ key: "review", label: "ارزیابی شیفت‌لاگ", kind: "avg", value: (row) => row.reviewScore }] : []),
    { key: "tasks", label: "تسک", kind: "count", value: (row) => row.cur.completed },
    { key: "units", label: "حجم وزن‌دار", kind: "count", value: (row) => row.cur.units },
    { key: "hours", label: "ساعت", kind: "count", value: (row) => row.cur.hours },
    { key: "onTime", label: "به‌موقع", kind: "rate", value: (row) => row.cur.onTimeRate },
    { key: "quality", label: "کیفیت عالی/خوب", kind: "rate", value: (row) => row.cur.highQualityShare },
    { key: "returns", label: "برگشتی", kind: "rate", value: (row) => row.cur.returnShare },
    ...(shift ? [
      { key: "shifts", label: "شیفت", kind: "count", value: (row) => row.cur.shifts },
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
            onChange={(e) => { setSelected(null); setParam("cohort", e.target.value); }}
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
            مقایسه فقط داخل <b>{cohort.label}</b> انجام می‌شود؛ L1 با L1، L2 با L2 و سایر نقش‌ها با هم‌گروه خودشان. {scoreFormula(shift)}
            {" "}تعداد تسک، ساعت، اولویت، برگشت، سازنده تسک، شیفت‌لاگ روزانه، روتین، نرخ بستن لاگ، شیفت جامانده، IOC، تیکت، گزارش ترافیک و Issue عمداً در امتیاز نیستند و فقط آماری می‌مانند.
          </span>
        </div>
        <div className="panel-body an-compare-chips" aria-label="نفرات برتر">
          {leaders.map(([label, names]) => <span className="an-chip" key={label}><b>{label}:</b>&nbsp;{names}</span>)}
        </div>
      </Panel>

      <div className="an-row">
        {CHARTS.map((def) => (
          <ChartPanel
            key={def.key}
            title={def.label}
            question={def.question}
            build={barBuild(rows, def)}
            height={chartHeight}
            table={{
              columns: [
                { key: "name", label: "کارشناس", value: (row) => row.person.name },
                { key: "value", label: def.label, kind: def.kind, value: def.value },
              ],
              rows: [...rows].sort((a, b) => (def.value(b) ?? -Infinity) - (def.value(a) ?? -Infinity)),
            }}
            fileName={"peer-" + def.key}
          />
        ))}
      </div>

      <Panel
        title="جدول رتبه‌بندی مدیریتی"
        meta="ترتیب اولیه بر اساس امتیاز وزن‌دار است؛ برای دیدن اجزای امتیاز روی ردیف کلیک کنید."
      >
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => setSelected(row.person.id)}
          caption={"رتبه‌بندی کارشناسان " + cohort.label}
          testId="peer-ranking-table"
        />
      </Panel>
      {selectedRow && <Details row={selectedRow} shift={shift} />}
    </>
  );
}
