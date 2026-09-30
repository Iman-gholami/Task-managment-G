"use client";

import { Panel } from "@/components/ui/layout";
import { CompareBars, CxLegend, Distribution, DonutBreakdown } from "@/components/ui/charts";
import { fmtRange } from "@/lib/format";
import styles from "./Performance.module.css";

const teamRows = (teams, field) => teams.map((team) => ({ label: team.team, value: team[field] ?? 0 }));

export default function ManagerPerformanceCharts({ data, loading }) {
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
    <section className={styles.managerCharts} aria-label="Manager performance charts">
      <Panel title="Delivery mix" meta="Share of completed tasks · last 6 calendar months">
        <div className={styles.chartBody}>
          <DonutBreakdown
            name="Six-month completed-task share by team"
            rows={delivery}
          />
        </div>
      </Panel>

      <div className={styles.chartGrid}>
        <Panel title="Team output" meta={`${fmtRange(data.period.from, data.period.to)} · fixed team order, not a ranking`}>
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>Completed tasks</span><small>Approved</small></div>
              <CompareBars rows={teamRows(teams, "completed")} name="Completed tasks by team" />
            </div>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>Task hours</span><small>Completed work</small></div>
              <CompareBars rows={teamRows(teams, "hours")} name="Task hours by team" unit="h" />
            </div>
          </div>
        </Panel>

        <Panel title="Workload health" meta="Current open work · independent of the selected reporting period">
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>Active tasks</span><small>In execution</small></div>
              <CompareBars rows={teamRows(teams, "active")} name="Current active tasks by team" />
            </div>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>Overdue tasks</span><small>Needs attention</small></div>
              <CompareBars rows={teamRows(teams, "overdue")} name="Current overdue tasks by team" />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Department complexity mix" meta={totalCompleted ? `${totalCompleted} completed tasks in the selected period` : "No completed tasks in the selected period"}>
        <div className={styles.complexityBody}>
          <div className={styles.complexityBar}>
            {totalCompleted ? <Distribution parts={complexity} name="Department complexity mix" /> : <div className="muted small">Complete and approve tasks to build a complexity profile.</div>}
          </div>
          {totalCompleted > 0 && <CxLegend counts={complexity} />}
        </div>
      </Panel>
    </section>
  );
}
