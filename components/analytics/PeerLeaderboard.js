"use client";

import { useI18n as useExtraI18n } from "@/components/I18nProvider";

import useAnalyticsFormat from "@/components/analytics/useAnalyticsFormat";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

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
import { translate } from "@/lib/i18n/messages";

const CHARTS = [
  { key: "score", label: "امتیاز وزن‌دار", kind: "avg", question: "با درنظرگرفتن سختی، کیفیت، تأخیر ارسال و ارزیابی ماهانه شیفت‌لاگ، امتیاز هر کارشناس چقدر است؟", value: (row) => row.score },
  { key: "units", label: "حجم کار وزن‌دار", kind: "count", question: "شاخص آماری قبلی پیچیدگی (۱ تا ۴) برای اطلاع؛ در فرمول امتیاز استفاده نمی‌شود.", value: (row) => row.cur.units },
  { key: "hours", label: "ساعت ثبت‌شده روی تسک‌ها", kind: "count", question: "زمان ثبت‌شده فقط آماری است و در امتیاز وزن‌دار وارد نمی‌شود.", value: (row) => row.cur.hours },
];

const topBy = (rows, value, eligible = () => true, locale = "fa") => {
  const candidates = rows.filter((row) => eligible(row) && isNum(value(row)));
  if (!candidates.length) return "";
  const best = Math.max(...candidates.map(value));
  return candidates.filter((row) => value(row) === best).map((row) => row.person.name).join(locale === "fa" ? "، " : ", ");
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

const scoreFormula = (shift, locale) => {
  const separator = locale === "fa" ? "، " : ", ";
  const cx = Object.entries(SCORE.cxPoints).map(([key, value]) => `${translate(locale, CX_FA[Number(key) - 1])} ${fmtNum(value, 0, locale)}`).join(separator);
  const quality = Object.entries(SCORE.quality).map(([key, value]) => `${translate(locale, QUAL_FA[key])} ×${fmtNum(value, 1, locale)}`).join(separator);
  const late = fmtNum((1 - SCORE.lateFactor) * 100, 0, locale);
  const bases = Object.entries(SCORE.monthlyShiftBase).map(([level, base]) => `${level}: ${fmtNum(base, 0, locale)}`).join(separator);
  if (locale === "en") return `Task score = complexity points (${cx}) × quality factor (${quality}; unrated ×${fmtNum(SCORE.unrated, 1, locale)}); submitting for review after the deadline deducts ${late}%.${shift ? ` Monthly shift-log evaluation also adds points based on ${bases} and the quality factor.` : ""}`;
  const monthly = shift ? ` ارزیابی ماهانه شیفت‌لاگ نیز بر پایه ${bases} و ضریب کیفیت اضافه می‌شود.` : "";
  return `امتیاز هر تسک = امتیاز سختی (${cx}) × ضریب کیفیت (${quality}؛ بدون امتیاز کیفیت ×${fmtNum(SCORE.unrated, 1, locale)})؛ ارسال برای بازبینی بعد از ددلاین ${late}٪ کسر دارد.${monthly}`;
};

function Details({ row, shift }) {
  const { t: __extraTr } = useExtraI18n();
  const { fmtNum } = useAnalyticsFormat();
  const { t: __analyticsTr, locale } = useAnalyticsI18n();
  const taskColumns = [
    { key: "title", label: __analyticsTr("تسک"), value: (t) => t.title },
    { key: "cx", label: __extraTr("سختی"), value: (t) => __analyticsTr(CX_FA[t.cx - 1] ?? "—") },
    { key: "q", label: __extraTr("کیفیت"), value: (t) => __analyticsTr(t.quality ? QUAL_FA[t.quality] : "ثبت نشده") },
    { key: "late", label: __extraTr("ارسال"), value: (t) => __analyticsTr(!t.due ? "بدون ددلاین" : t.scoring.late ? "دیر" : "به‌موقع") },
    { key: "score", label: __extraTr("امتیاز"), kind: "avg", value: (t) => t.scoring.score },
  ];
  const reviewColumns = [
    { key: "month", label: __extraTr("ماه"), value: (r) => locale === "fa" ? faDigits(r.month) : r.month },
    { key: "rating", label: __extraTr("کیفیت"), value: (r) => __analyticsTr(QUAL_FA[r.rating] ?? r.rating) },
    { key: "points", label: __extraTr("امتیاز"), kind: "avg", value: (r) => r.points },
    { key: "by", label: __extraTr("ثبت‌کننده"), value: (r) => r.byName ?? "—" },
  ];
  return (
    <Panel title={locale === "fa" ? `جزئیات امتیاز — ${row.person.name}` : `Score details — ${row.person.name}`} meta={`${locale === "fa" ? "امتیاز کل" : "Total score"} ${fmtNum(row.score, 1)} · ${locale === "fa" ? "تسک‌ها" : "Tasks"} ${fmtNum(row.taskScore, 1)}${shift ? ` · ${locale === "fa" ? "ارزیابی شیفت" : "Shift evaluation"} ${fmtNum(row.reviewScore, 1)}` : ""}`}>
      {row.scoredTasks.length
        ? <DataTable columns={taskColumns} rows={row.scoredTasks} caption={`تسک‌های امتیازدار ${row.person.name}`} />
        : <p className="panel-body muted">{"" + __analyticsTr("در این بازه تسک تأییدشده‌ای برای امتیاز وجود ندارد.") + ""}</p>}
      {shift && (
        <>
          <div className="panel-head"><h3>{"" + __analyticsTr("ارزیابی‌های ماهانه شیفت‌لاگ") + ""}</h3></div>
          {row.scoredReviews.length
            ? <DataTable columns={reviewColumns} rows={row.scoredReviews} caption={`ارزیابی‌های شیفت ${row.person.name}`} />
            : <p className="panel-body muted">{"" + __analyticsTr("در ماه‌های هم‌پوشان این بازه ارزیابی ثبت نشده است؛ ماه بدون ارزیابی امتیاز صفر و جریمه ندارد.") + ""}</p>}
        </>
      )}
    </Panel>
  );
}

export default function PeerLeaderboard() {
  const { t: __extraTr } = useExtraI18n();
  const { t: __analyticsTr, locale, number, team: teamText, role: roleText } = useAnalyticsI18n();
  const { view, range, params, setParam } = useAnalytics();
  const [selected, setSelected] = useState(null);
  const board = useMemo(
    () => scoreLeaderboard(view, range, params.get("cohort")),
    [view, range, params],
  );

  if (!board.cohort || !board.rows.length) return null;

  const { rows, cohort, cohorts, shift } = board;
  const cohortName = (item) => {
    const p = item.rows[0]?.person;
    return p ? [teamText(p.group), p.level ?? roleText(p.role)].filter(Boolean).join(" · ") : item.label;
  };
  const chartHeight = Math.max(220, Math.min(440, 88 + rows.length * 38));
  const selectedRow = rows.find((row) => row.person.id === selected) ?? null;
  const leaders = [
    [locale === "fa" ? "اول از نظر امتیاز وزن‌دار" : "Highest weighted score", rows.filter((row) => row.rank === 1).map((row) => row.person.name).join(locale === "fa" ? "، " : ", ")],
    [locale === "fa" ? "اول از نظر سهم کیفیت عالی و خوب" : "Highest excellent/good quality share", topBy(rows, (row) => row.cur.highQualityShare, (row) => row.cur.qualityN >= MIN_SAMPLE, locale)],
  ].filter(([, names]) => names);

  const columns = [
    { key: "rank", label: __extraTr("رتبه"), kind: "count", value: (row) => row.rank, sort: false },
    {
      key: "name",
      label: __analyticsTr("کارشناس"),
      value: (row) => row.person.name,
      render: (row) => (
        <span className="an-person">
          {row.person.name}
          <small>{[teamText(row.person.group), row.person.level, roleText(row.person.role)].filter(Boolean).join(" · ")}</small>
        </span>
      ),
    },
    { key: "score", label: __extraTr("امتیاز"), kind: "avg", value: (row) => row.score, title: __extraTr("فقط داخل همین گروه هم‌سطح قابل مقایسه است") },
    { key: "ratio", label: __extraTr("نسبت به نفر اول"), kind: "rate", value: (row) => row.leaderRatio },
    { key: "taskScore", label: __extraTr("امتیاز تسک‌ها"), kind: "avg", value: (row) => row.taskScore },
    { key: "late", label: __extraTr("کسر تأخیر"), kind: "avg", value: (row) => row.lateDeduction },
    ...(shift ? [{ key: "review", label: __extraTr("ارزیابی شیفت‌لاگ"), kind: "avg", value: (row) => row.reviewScore }] : []),
    { key: "tasks", label: __analyticsTr("تسک"), kind: "count", value: (row) => row.cur.completed },
    { key: "units", label: __extraTr("حجم وزن‌دار"), kind: "count", value: (row) => row.cur.units },
    { key: "hours", label: __extraTr("ساعت"), kind: "count", value: (row) => row.cur.hours },
    { key: "onTime", label: __extraTr("به‌موقع"), kind: "rate", value: (row) => row.cur.onTimeRate },
    { key: "quality", label: __extraTr("کیفیت عالی/خوب"), kind: "rate", value: (row) => row.cur.highQualityShare },
    { key: "returns", label: __extraTr("برگشتی"), kind: "rate", value: (row) => row.cur.returnShare },
    ...(shift ? [
      { key: "shifts", label: __analyticsTr("شیفت"), kind: "count", value: (row) => row.cur.shifts },
      { key: "iocs", label: "IOC", kind: "count", value: (row) => row.cur.iocs },
      { key: "tickets", label: __analyticsTr("تیکت"), kind: "count", value: (row) => row.cur.tickets },
    ] : []),
  ];

  return (
    <>
      <Panel
        title={__analyticsTr("رتبه‌بندی کارشناسان هم‌سطح")}
        meta={`${number(rows.length)} ${__analyticsTr("نفر")} · ${cohortName(cohort)}`}
        actions={
          <select
            className="input input-sm"
            style={{ width: 220 }}
            value={cohort.key}
            onChange={(e) => { setSelected(null); setParam("cohort", e.target.value); }}
            aria-label={__analyticsTr("گروه هم‌سطح برای رتبه‌بندی")}
            data-testid="peer-cohort"
          >
            {cohorts.map((item) => <option key={item.key} value={item.key}>{cohortName(item)} · {number(item.rows.length)}{" " + __analyticsTr("نفر") + ""}</option>)}
          </select>
        }
      >
        <div className="an-note" role="note">
          <Icon name="info" />
          <span>{"" + __analyticsTr("مقایسه فقط داخل") + " "}<b>{cohortName(cohort)}</b>{" " + __analyticsTr("انجام می‌شود؛ L1 با L1، L2 با L2 و سایر نقش‌ها با هم‌گروه خودشان.") + " "}{scoreFormula(shift, locale)}
            {" "}{"" + __analyticsTr("تعداد تسک، ساعت، اولویت، برگشت، سازنده تسک، شیفت‌لاگ روزانه، روتین، نرخ بستن لاگ، شیفت جامانده، IOC، تیکت، گزارش ترافیک و Issue عمداً در امتیاز نیستند و فقط آماری می‌مانند.") + ""}</span>
        </div>
        <div className="panel-body an-compare-chips" aria-label={__analyticsTr("نفرات برتر")}>
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
                { key: "name", label: __analyticsTr("کارشناس"), value: (row) => row.person.name },
                { key: "value", label: __analyticsTr(def.label), kind: def.kind, value: def.value },
              ],
              rows: [...rows].sort((a, b) => (def.value(b) ?? -Infinity) - (def.value(a) ?? -Infinity)),
            }}
            fileName={"peer-" + def.key}
          />
        ))}
      </div>

      <Panel
        title={__analyticsTr("جدول رتبه‌بندی مدیریتی")}
        meta={__analyticsTr("ترتیب اولیه بر اساس امتیاز وزن‌دار است؛ برای دیدن اجزای امتیاز روی ردیف کلیک کنید.")}
      >
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => setSelected(row.person.id)}
          caption={(locale === "fa" ? "رتبه‌بندی کارشناسان " : "Peer ranking: ") + cohortName(cohort)}
          testId="peer-ranking-table"
        />
      </Panel>
      {selectedRow && <Details row={selectedRow} shift={shift} />}
    </>
  );
}
