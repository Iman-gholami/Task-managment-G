"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import { Panel } from "@/components/ui/layout";
import { CompareBars, CxLegend, Distribution, DonutBreakdown } from "@/components/ui/charts";
import { fmtRange } from "@/lib/format";
import { dashboardRange } from "@/lib/i18n/presentation";
import styles from "./Performance.module.css";

const teamRows = (teams, field, teamText) => teams.map((team) => ({ label: teamText(team.team), value: team[field] ?? 0 }));

export default function ManagerPerformanceCharts({ data, loading }) {
  const { t: __sharedTr, locale, number, team: teamText } = useSharedI18n();
  if (loading || !data?.teams?.length) return null;

  const teams = data.teams;
  const delivery = teams.map((team) => ({
    label: teamText(team.team),
    value: (team.trend ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0),
  }));
  const complexity = teams.reduce(
    (total, team) => total.map((n, i) => n + (team.complexity?.[i] ?? 0)),
    [0, 0, 0, 0]
  );
  const totalCompleted = complexity.reduce((sum, n) => sum + n, 0);

  return (
    <section className={styles.managerCharts} aria-label={__sharedTr("Manager performance charts")}>
      <Panel title={__sharedTr("Delivery mix")} meta={__sharedTr("Share of completed tasks · last 6 calendar months")}>
        <div className={styles.chartBody}>
          <DonutBreakdown
            name="Six-month completed-task share by team"
            rows={delivery}
          />
        </div>
      </Panel>

      <div className={styles.chartGrid}>
        <Panel title={__sharedTr("Team output")} meta={`${dashboardRange(data.period.from, data.period.to, locale)} · ${locale === "fa" ? "ترتیب ثابت تیم‌ها، بدون رتبه‌بندی" : "fixed team order, not a ranking"}`}>
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Completed tasks") + ""}</span><small>{"" + __sharedTr("Approved") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "completed", teamText)} name={locale === "fa" ? "تسک‌های تکمیل‌شده هر تیم" : "Completed tasks by team"} />
            </div>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Task hours") + ""}</span><small>{"" + __sharedTr("Completed work") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "hours", teamText)} name={locale === "fa" ? "ساعت تسک هر تیم" : "Task hours by team"} unit={locale === "fa" ? " ساعت" : "h"} />
            </div>
          </div>
        </Panel>

        <Panel title={__sharedTr("Workload health")} meta={__sharedTr("Current open work · independent of the selected reporting period")}>
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Active tasks") + ""}</span><small>{"" + __sharedTr("In execution") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "active", teamText)} name={locale === "fa" ? "تسک‌های فعال هر تیم" : "Current active tasks by team"} />
            </div>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Overdue tasks") + ""}</span><small>{"" + __sharedTr("Needs attention") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "overdue", teamText)} name={locale === "fa" ? "تسک‌های سررسیدگذشته هر تیم" : "Current overdue tasks by team"} />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title={__sharedTr("Department complexity mix")} meta={totalCompleted ? locale === "fa" ? `${number(totalCompleted)} تسک تکمیل‌شده در بازه انتخابی` : `${totalCompleted} completed tasks in the selected period` : locale === "fa" ? "تسکی در بازه انتخابی تکمیل نشده است" : "No completed tasks in the selected period"}>
        <div className={styles.complexityBody}>
          <div className={styles.complexityBar}>
            {totalCompleted ? <Distribution parts={complexity} name="Department complexity mix" /> : <div className="muted small">{"" + __sharedTr("Complete and approve tasks to build a complexity profile.") + ""}</div>}
          </div>
          {totalCompleted > 0 && <CxLegend counts={complexity} />}
        </div>
      </Panel>
    </section>
  );
}
