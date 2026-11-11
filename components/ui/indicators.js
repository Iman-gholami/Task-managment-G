"use client";

import { useI18n as useTaskI18n } from "@/components/I18nProvider";

import { useApp } from "@/components/AppProvider";
import { CX, PRIO, QUAL, STATUS, TODAY, addDays, dueLabel, initials, isOpen } from "@/lib/format";
import { taskDate } from "@/lib/task-date";
import { isTaskPendingSubmission } from "@/lib/task-deadline";

// Status, priority and complexity each use a different shape, so none depends on colour alone.

export function Status({ s, label }) {
  const { t: __taskTr } = useTaskI18n();
  return <span className="status" data-s={s}>{label ?? __taskTr(STATUS[s])}</span>;
}

export function Priority({ p }) {
  const { t: __taskTr } = useTaskI18n();
  return (
    <span className="prio" data-p={p}>
      <i aria-hidden="true">{p === "critical" ? "!" : <><b /><b /><b /></>}</i>
      {__taskTr(PRIO[p])}
    </span>
  );
}

export function Complexity({ c }) {
  const { t: __taskTr } = useTaskI18n();
  return (
    <span className="cx" data-c={c}>
      <i aria-hidden="true"><b /><b /><b /><b /></i>
      {__taskTr(CX[c])}
    </span>
  );
}

export function Quality({ q }) {
  const { t: __taskTr } = useTaskI18n();
  return q ? <span className="q" data-q={q}>{__taskTr(QUAL[q])}</span> : <span className="muted">—</span>;
}

const FALLBACK = { name: "Unknown", color: "#7F8790" };
function usePerson(id) {
  const app = useApp();
  return app?.peopleMap?.[id] ?? FALLBACK;
}

/** Initials avatar. Decorative next to a visible name; pass `label` when it stands alone. */
export function Avatar({ id, size, label }) {
  const p = usePerson(id);
  const a11y = label ? { role: "img", "aria-label": p.name, "data-tooltip": p.name } : { "aria-hidden": true };
  return (
    <span className={`avatar ${size ?? ""}`} style={{ background: p.color }} {...a11y}>
      {initials(p.name)}
    </span>
  );
}

export function Who({ id, short, size }) {
  const p = usePerson(id);
  return (
    <span className="who">
      <Avatar id={id} size={size} />
      <span>{short ? p.name.split(" ")[0] : p.name}</span>
    </span>
  );
}

/** Deadline in words; amber within 48h, red when overdue (open tasks only). Full date on hover. */
export function Due({ task }) {
  const { t: __taskTr, locale } = useTaskI18n();
  if (task.due === "—") return <span className="muted">{"" + __taskTr("No deadline") + ""}</span>;
  const open = isTaskPendingSubmission(task);
  const cls = open && task.due < TODAY ? "overdue" : open && task.due <= addDays(TODAY, 2) ? "soon" : "num";
  const days = Math.round((Date.parse(task.due + "T00:00:00Z") - Date.parse(TODAY + "T00:00:00Z")) / 864e5);
  const relative = open && days <= 7 ? (locale === "fa" ? days < 0 ? `${-days} روز از سررسید گذشته` : days === 0 ? "سررسید امروز" : days === 1 ? "سررسید فردا" : `${days} روز دیگر` : dueLabel(task.due, open)) : null;
  return <span className={`${cls} task-deadline`} data-tooltip={`${__taskTr("Deadline")} ${taskDate(task.due, locale)}`}><span>{taskDate(task.due, locale)}</span>{relative && <small>{relative}</small>}</span>;
}
