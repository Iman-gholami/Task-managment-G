"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import { Panel } from "@/components/ui/layout";
import { CompareBars, DonutBreakdown, Meter } from "@/components/ui/charts";
import { CX, QUAL, fmtDate } from "@/lib/format";
import styles from "./Performance.module.css";

const DAY = 864e5;

function deliveryRows(tasks, period) {
  if (!period?.from || !period?.to) return [];
  const start = Date.parse(`${period.from}T00:00:00Z`);
  const end = Date.parse(`${period.to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

  const days = Math.floor((end - start) / DAY) + 1;
  const bucketCount = Math.min(6, Math.max(1, days));
  const bucketDays = Math.ceil(days / bucketCount);
  const rows = [];

  for (let i = 0; i < bucketCount; i++) {
    const fromMs = start + i * bucketDays * DAY;
    if (fromMs > end) break;
    const toMs = Math.min(end, fromMs + (bucketDays - 1) * DAY);
    const from = new Date(fromMs).toISOString().slice(0, 10);
    const to = new Date(toMs).toISOString().slice(0, 10);
    const value = (tasks ?? []).filter((task) => {
      const completed = task.completed_at?.slice(0, 10);
      return completed && completed >= from && completed <= to;
    }).length;
    rows.push({ label: from === to ? fmtDate(from) : `${fmtDate(from)}–${fmtDate(to)}`, value });
  }

  return rows;
}

export default function EmployeePerformanceCharts({ data }) {
  const { t: __sharedTr } = useSharedI18n();
  if (!data) return null;

  const complexityRows = CX.slice(1).map((label, i) => ({ label, value: data.complexity?.[i] ?? 0 }));
  const qualityRows = Object.values(QUAL).map((label, i) => ({ label, value: data.quality?.[i] ?? 0 }));
  const complexityTotal = complexityRows.reduce((sum, row) => sum + row.value, 0);
  const qualityTotal = qualityRows.reduce((sum, row) => sum + row.value, 0);
  const cadence = deliveryRows(data.tasks, data.period);
  const routine = data.routine;
  const miniStatsStyle = { display: "grid", gap: "var(--s-3)" };
  const miniStatStyle = { display: "grid", gap: 8, padding: "12px 14px", border: "1px solid var(--divider)", borderRadius: "var(--r-md)", background: "var(--surface-inset)" };

  return (
    <section className={styles.managerCharts} aria-label={__sharedTr("Employee performance charts")}>
      <Panel title={__sharedTr("Work profile")} meta={__sharedTr("Completed work in the selected reporting period")}>
        <div className={`${styles.chartBody} ${styles.chartSplit}`}>
          <div className={styles.chartSection}>
            <div className={styles.chartLabel}><span>{"" + __sharedTr("Complexity mix") + ""}</span><small>{complexityTotal}{" " + __sharedTr("completed") + ""}</small></div>
            {complexityTotal ? (
              <DonutBreakdown rows={complexityRows} name="Completed work by complexity" unit=" tasks" />
            ) : (
              <div className="muted small">{"" + __sharedTr("No completed tasks in this period.") + ""}</div>
            )}
          </div>

          <div className={styles.chartSection}>
            <div className={styles.chartLabel}><span>{"" + __sharedTr("Quality mix") + ""}</span><small>{"" + __sharedTr("Manager review outcomes") + ""}</small></div>
            {qualityTotal ? (
              <DonutBreakdown rows={qualityRows} name="Completed work by quality" unit=" ratings" />
            ) : (
              <div className="muted small">{"" + __sharedTr("No quality ratings in this period.") + ""}</div>
            )}
          </div>
        </div>
      </Panel>

      <Panel title={__sharedTr("Delivery cadence")} meta={__sharedTr("Completed tasks distributed across the selected period")}>
        <div className={styles.chartBody}>
          {cadence.length ? (
            <CompareBars rows={cadence} name="Completed tasks across the selected period" />
          ) : (
            <div className="muted small">{"" + __sharedTr("No delivery data for this period.") + ""}</div>
          )}
        </div>
      </Panel>

      {routine && (
        <Panel title={__sharedTr("Routine performance")} meta={__sharedTr("Shift activity for this analyst in the selected period")}>
          <div className={`${styles.chartBody} ${styles.chartSplit}`}>
            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Completion") + ""}</span><small>{"" + __sharedTr("Shift discipline") + ""}</small></div>
              <div style={miniStatsStyle}>
                <div style={miniStatStyle}>
                  <span className="muted small">{"" + __sharedTr("Routine completion") + ""}</span>
                  <Meter value={routine.completion ?? 0} max={100} label={__sharedTr("Routine completion")} readout={`${routine.completion ?? 0}%`} />
                </div>
                <div style={miniStatStyle}>
                  <span className="muted small">{"" + __sharedTr("Shift logs completed") + ""}</span>
                  <Meter value={routine.completed ?? 0} max={Math.max(1, routine.logs ?? 0)} label={__sharedTr("Shift logs completed")} readout={`${routine.completed ?? 0} / ${routine.logs ?? 0}`} />
                </div>
              </div>
            </div>

            <div className={styles.chartSection}>
              <div className={styles.chartLabel}><span>{"" + __sharedTr("Routine volume") + ""}</span><small>{"" + __sharedTr("Recorded shift output") + ""}</small></div>
              <CompareBars
                name="Routine activity volume"
                rows={[
                  { label: __sharedTr("MISP IOCs"), value: routine.iocs ?? 0 },
                  { label: __sharedTr("Tickets"), value: routine.tickets ?? 0 },
                  { label: "Traffic reports", value: routine.reports ?? 0 },
                  { label: "Issues reported", value: routine.issues ?? 0 },
                ]}
              />
            </div>
          </div>
        </Panel>
      )}
    </section>
  );
}
