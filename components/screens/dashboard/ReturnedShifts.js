"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import { longDate } from "@/lib/format";
import { SHIFT_TYPES } from "@/lib/shifts";

const hrefFor = (row) => `/shift?date=${encodeURIComponent(row.date)}`;
const managerHref = (row) => `/shift/manage?user=${encodeURIComponent(row.userId)}&date=${encodeURIComponent(row.date)}`;
const shiftLabel = (type) => SHIFT_TYPES[type]?.label ?? type;

/** Analyst homepage: a prominent, direct link to EACH returned Shift Log. */
export function ReturnedShiftAlerts() {
  const { me } = useApp();
  const { data, error, reload } = useFetch(me.keepsShiftLog ? "/api/shift/backfill?scope=self" : null);
  if (!data?.count && !error) return null;
  return (
    <section data-testid="returned-shifts-card" aria-label="Returned shift logs">
      <Panel title="Returned Shift Logs" meta={data?.count ? `${data.count} shift logs returned for completion` : null}
        actions={data?.count ? <span className="badge dot warning">{data.count} to complete</span> : null}>
        {error ? <div className="panel-body"><p role="alert">{error.message}</p>
          <button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button></div> : (
          <div className="panel-body" style={{ display: "grid", gap: 10 }}>
            <p className="sec small">A manager returned these scheduled days to you. Open each day, record its shift activities, and select Complete shift. Completed days disappear automatically.</p>
            <div role="list" style={{ display: "grid", gap: 8 }}>
              {(data?.pending ?? []).map((item) => (
                <Link key={item.date} role="listitem" href={hrefFor(item)}
                  className="row" data-testid={`returned-shift-${item.date}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, gap: 12 }}>
                  <span><strong>{longDate(item.date)}</strong>
                    <span className="muted small" style={{ display: "block", marginTop: 4 }}>
                      {shiftLabel(item.shiftType)} · {item.hasLog ? "In progress" : "Not started"}
                    </span>
                  </span>
                  <span className="row" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="badge dot info">Returned</span><Icon name="arrowRight" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </section>
  );
}

/** Managers see ONLY outstanding returned days. Database audit retains completed days. */
export function ManagerReturnedQueue({ showEmpty = false, onPick = null }) {
  const { data, error, reload } = useFetch("/api/shift/backfill?scope=pending");
  useEffect(() => {
    // Refresh while a manager has the page open; another user may finish a shift.
    const timer = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 20000);
    const focus = () => reload();
    window.addEventListener("focus", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [reload]);
  if (!showEmpty && !data?.count && !error) return null;
  return (
    <section aria-label="Returned shift logs awaiting completion" data-testid="manager-returned-shifts">
      <Panel title="Returned Shift Logs · Awaiting Completion"
        meta={data ? `${data.count} outstanding` : "Checking returned shift logs"}
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>}>
        <div className="panel-body" style={{ display: "grid", gap: 8 }}>
          {error && <p role="alert">{error.message}</p>}
          {data?.count === 0 && <p className="muted small">No returned shift logs are awaiting completion.</p>}
          {(data?.pending ?? []).map((item) => (
            <Link key={`${item.userId}:${item.date}`} href={managerHref(item)}
              onClick={onPick ? () => onPick(item) : undefined}
              className="row" data-testid={`manager-returned-${item.userId}-${item.date}`}
              style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span><strong>{item.userName}</strong>
                <span className="muted small" style={{ display: "block" }}>{item.team} · {longDate(item.date)} · {shiftLabel(item.shiftType)}</span>
              </span>
              <span className="badge dot info">Awaiting analyst</span>
            </Link>
          ))}
        </div>
      </Panel>
    </section>
  );
}
