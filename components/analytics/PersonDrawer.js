"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import Chart from "@/components/analytics/Chart";
import { lineOption } from "@/components/analytics/chartOptions";
import { personModel, StatusFa } from "@/components/analytics/model";
import { Delta, Drawer, Stat } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { faDate, faDigits } from "@/lib/analytics/calendar";
import { fmtDays, fmtInt, fmtNum, fmtPct } from "@/lib/analytics/format";
import { ROLE_FA, groupFa } from "@/lib/analytics/labels";

const med = (m, k, f) => (m && m[k] !== null && m[k] !== undefined ? `میانه تیم: ${f(m[k])}` : null);

/** Quick look at one expert: key figures against the comparison period and the team median. */
export default function PersonDrawer({ id, onClose }) {
  const a = useAnalytics();
  const m = useMemo(() => personModel(a.view, id, a.range, a.cmp, a.gran), [a.view, id, a.range, a.cmp, a.gran]);
  const build = useCallback((t) => lineOption(t, {
    labels: m.b.map((x) => x.label), bars: true,
    series: [{ name: "تکمیل‌شده", data: m.bs.map((x) => x.completed) }],
    prev: a.cmp ? { name: "دوره مقایسه", data: m.pbs.map((x) => x.completed), labels: m.pb.map((x) => x.label) } : null,
  }), [m, a.cmp]);
  if (!m) return null;
  const { p, cur, prev, medians, open } = m;
  const short = a.cmp?.short;
  return (
    <Drawer
      title={p.name}
      subtitle={[groupFa(p.group), p.level, ROLE_FA[p.role], p.active ? null : "غیرفعال"].filter(Boolean).join(" · ")}
      onClose={onClose}
      label={`خلاصه ${p.name}`}
      width={500}
      footer={
        <>
          <Link className="btn btn-primary" href={a.href(`/analytics/people/${encodeURIComponent(p.id)}`)}>پروفایل کامل<Icon name="left" /></Link>
          <a className="btn btn-secondary" href={a.exportUrl("person", { id: p.id })} download><Icon name="sheet" />Excel</a>
        </>
      }
    >
      <div className="an-stats">
        <Stat label="تسک تکمیل‌شده" value={fmtInt(cur.completed)} sub={prev ? <Delta now={cur.completed} before={prev.completed} label={short} /> : med(medians, "completed", fmtNum)} />
        <Stat label="حجم کار وزن‌دار" value={fmtInt(cur.units)} sub={med(medians, "units", fmtNum)} />
        <Stat label="ساعت ثبت‌شده" value={fmtNum(cur.hours, 0)} sub={med(medians, "hours", (v) => fmtNum(v, 0))} />
        <Stat label="تحویل به‌موقع" value={fmtPct(cur.onTimeRate)} sub={cur.onTimeRate === null ? `${faDigits(cur.onTimeN)} تسک دارای ددلاین` : med(medians, "onTimeRate", fmtPct)} />
        <Stat label="میانه زمان انجام" value={fmtDays(cur.cycleMedian)} sub={med(medians, "cycleMedian", fmtDays)} />
        <Stat label="صف باز (اکنون)" value={fmtInt(open.open)} sub={`${faDigits(open.overdue)} معوق · ${faDigits(open.blocked)} مسدود`} />
        {p.shift && (
          <>
            <Stat label="شیفت" value={fmtInt(cur.shifts)} sub={`بسته‌شدن لاگ ${fmtPct(cur.closureRate)}`} />
            <Stat label="انجام روتین" value={fmtPct(cur.routineRate)} sub={`IOC ${faDigits(cur.iocs)} · تیکت ${faDigits(cur.tickets)}`} />
          </>
        )}
      </div>
      <div>
        <p className="an-subhead">تسک‌های تکمیل‌شده در هر بازه</p>
        <Chart build={build} height={170} label={`روند تسک‌های تکمیل‌شده ${p.name}`} />
      </div>
      {m.openTasks.length > 0 && (
        <div>
          <p className="an-subhead">کار باز ({faDigits(m.openTasks.length)})</p>
          <ul className="an-mini-list">
            {m.openTasks.slice(0, 6).map((t) => (
              <li key={t.id}>
                <span className="truncate">{t.title}</span>
                <StatusFa s={t.status} />
                {t.due && <span className={t.due < a.today ? "overdue" : "muted"}>{faDate(t.due, { year: false })}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
