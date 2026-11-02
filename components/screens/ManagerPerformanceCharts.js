"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import { Panel } from "@/components/ui/layout";
import { CompareBars, CxLegend, Distribution, DonutBreakdown } from "@/components/ui/charts";
import { fmtRange } from "@/lib/format";
import styles from "./Performance.module.css";

const teamRows = (teams, field) => teams.map((team) => ({ label: team.team, value: team[field] ?? 0 }));

export default function ManagerPerformanceCharts({ data, loading }) {
  const { t: __sharedTr } = useSharedI18n();
  if (loading || !data?.teams?.length) return null;

  const teams = data.teams;
  const delivery = teams.map((team) => ({
    label: team.team,
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
        <Panel title={__sharedTr("Team output")} meta={`${fmtRange(data.period.from, data.period.to)} · fixed team order, not a ranking`}>
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Completed tasks") + ""}</span><small>{"" + __sharedTr("Approved") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "completed")} name="Completed tasks by team" />
            </div>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Task hours") + ""}</span><small>{"" + __sharedTr("Completed work") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "hours")} name="Task hours by team" unit="h" />
            </div>
          </div>
        </Panel>

        <Panel title={__sharedTr("Workload health")} meta={__sharedTr("Current open work · independent of the selected reporting period")}>
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Active tasks") + ""}</span><small>{"" + __sharedTr("In execution") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "active")} name="Current active tasks by team" />
            </div>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Overdue tasks") + ""}</span><small>{"" + __sharedTr("Needs attention") + ""}</small></div>
              <CompareBars rows={teamRows(teams, "overdue")} name="Current overdue tasks by team" />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title={__sharedTr("Department complexity mix")} meta={totalCompleted ? `${totalCompleted} completed tasks in the selected period` : "No completed tasks in the selected period"}>
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
