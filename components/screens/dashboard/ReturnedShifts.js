"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { longDate } from "@/lib/format";
import { SHIFT_TYPES } from "@/lib/shifts";
import styles from "@/components/screens/ShiftBackfill.module.css";

const PREVIEW_LIMIT = 6;
const hrefFor = (row) => `/shift?date=${encodeURIComponent(row.date)}`;
const managerHref = (row) => `/shift/manage?user=${encodeURIComponent(row.userId)}&date=${encodeURIComponent(row.date)}#shift-log-details`;
const shiftLabel = (type) => SHIFT_TYPES[type]?.label ?? type;

/** Refresh outstanding work when the page is visible or the user returns to it. */
function useReturnedShifts(url, refreshKey = 0) {
  const result = useFetch(url);
  const { reload } = result;
  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);
  useEffect(() => {
    if (!url) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 20000);
    const focus = () => reload();
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [url, reload]);
  return result;
}

function QueueError({ error, reload, testId }) {
  return (
    <section className={styles.queueError} data-testid={testId} aria-label="Returned shift logs">
      <div><strong>Could not load returned Shift Logs</strong><p role="alert">{error.message}</p></div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>
    </section>
  );
}

/** Analyst homepage: the count stays visible and each day has a direct link. */
export function ReturnedShiftAlerts() {
  const { me } = useApp();
  const { data, error, reload } = useReturnedShifts(me.keepsShiftLog ? "/api/shift/backfill?scope=self" : null);
  const [showAll, setShowAll] = useState(false);
  if (error) return <QueueError error={error} reload={reload} testId="returned-shifts-card" />;
  if (!data?.count) return null;
  const pending = data.pending ?? [];
  const visible = showAll ? pending : pending.slice(0, PREVIEW_LIMIT);
  return (
    <details className={`${styles.queue} ${styles.analystQueue}`} data-testid="returned-shifts-card">
      <summary className={styles.queueSummary}>
        <span className={styles.queueIcon}><Icon name="shift" /></span>
        <span className={styles.queueHeading}>
          <strong>Returned Shift Logs</strong>
          <span>{data.count} shift {data.count === 1 ? "log" : "logs"} returned for completion</span>
        </span>
        <span className={styles.queueAction}>View shifts <Icon name="down" /></span>
      </summary>
      <div className={styles.queueBody}>
        <p className={styles.queueHint}>Open a day, record its activities, then complete the shift.</p>
        <ul className={styles.queueList} aria-label="Your returned Shift Logs">
          {visible.map((item) => (
            <li key={item.date}>
              <Link href={hrefFor(item)} className={styles.queueRow} data-testid={`returned-shift-${item.date}`}>
                <span className={styles.rowMain}><strong><time dateTime={item.date}>{longDate(item.date)}</time></strong>
                  <span>{shiftLabel(item.shiftType)} · {item.hasLog ? "In progress" : "Not started"}</span></span>
                <span className={styles.rowAction}>Open <Icon name="arrowRight" /></span>
              </Link>
            </li>
          ))}
        </ul>
        {pending.length > PREVIEW_LIMIT && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${pending.length} shifts`}</button>}
      </div>
    </details>
  );
}

/** Managers see outstanding returned days; completed days remain in the audit. */
export function ManagerReturnedQueue({ showEmpty = false, onPick = null, refreshKey = 0, disabled = false }) {
  const { data, error, loading, reload } = useReturnedShifts("/api/shift/backfill?scope=pending", refreshKey);
  const [showAll, setShowAll] = useState(false);
  if (error) return <QueueError error={error} reload={reload} testId="manager-returned-shifts" />;
  if (!data?.count) {
    if (!showEmpty) return null;
    return (
      <section className={styles.emptyQueue} data-testid="manager-returned-shifts" aria-label="Returned shift logs awaiting completion">
        <span><Icon name="checkCircle" />{loading ? "Checking returned Shift Logs…" : "No returned Shift Logs awaiting completion"}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}><Icon name="refresh" />Refresh</button>
      </section>
    );
  }
  const pending = data.pending ?? [];
  const visible = showAll ? pending : pending.slice(0, PREVIEW_LIMIT);
  return (
    <details className={`${styles.queue} ${styles.managerQueue}`} data-testid="manager-returned-shifts">
      <summary className={styles.queueSummary}>
        <span className={styles.queueIcon}><Icon name="clock" /></span>
        <span className={styles.queueHeading}>
          <strong>Returned Shift Logs</strong>
          <span>{data.count} {data.count === 1 ? "shift is" : "shifts are"} awaiting completion</span>
        </span>
        <span className={styles.queueAction}>View shifts <Icon name="down" /></span>
      </summary>
      <div className={styles.queueBody}>
        <div className={styles.queueToolbar}>
          <p className={styles.queueHint}>{disabled ? "Wait for the current action to finish." : "Completed shifts leave this list automatically."}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}><Icon name="refresh" />Refresh</button>
        </div>
        <ul className={styles.queueList} aria-label="Returned Shift Logs awaiting completion">
          {visible.map((item) => (
            <li key={`${item.userId}:${item.date}`}>
              <Link href={managerHref(item)} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
                onClick={(event) => { if (disabled) event.preventDefault(); else onPick?.(item); }}
                className={`${styles.queueRow} ${disabled ? styles.disabledRow : ""}`} data-testid={`manager-returned-${item.userId}-${item.date}`}>
                <span className={styles.rowMain}><strong><bdi>{item.userName}</bdi></strong>
                  <span><bdi>{item.team}</bdi> · {longDate(item.date)} · {shiftLabel(item.shiftType)}</span></span>
                <span className={styles.rowAction}>Open <Icon name="arrowRight" /></span>
              </Link>
            </li>
          ))}
        </ul>
        {pending.length > PREVIEW_LIMIT && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${pending.length} shifts`}</button>}
      </div>
    </details>
  );
}
