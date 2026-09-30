"use client";

import { useApp } from "@/components/AppProvider";
import { CX, PRIO, QUAL, STATUS, TODAY, addDays, dueLabel, initials, isOpen, longDate } from "@/lib/format";

// Status, priority and complexity each use a different shape, so none depends on colour alone.

export function Status({ s, label }) {
  return <span className="status" data-s={s}>{label ?? STATUS[s]}</span>;
}

export function Priority({ p }) {
  return (
    <span className="prio" data-p={p}>
      <i aria-hidden="true">{p === "critical" ? "!" : <><b /><b /><b /></>}</i>
      {PRIO[p]}
    </span>
  );
}

export function Complexity({ c }) {
  return (
    <span className="cx" data-c={c}>
      <i aria-hidden="true"><b /><b /><b /><b /></i>
      {CX[c]}
    </span>
  );
}

export function Quality({ q }) {
  return q ? <span className="q" data-q={q}>{QUAL[q]}</span> : <span className="muted">—</span>;
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
  if (task.due === "—") return <span className="muted">No deadline</span>;
  const open = isOpen(task);
  const cls = open && task.due < TODAY ? "overdue" : open && task.due <= addDays(TODAY, 2) ? "soon" : "num";
  return <span className={cls} data-tooltip={`Deadline ${longDate(task.due)}`}>{dueLabel(task.due, open)}</span>;
}
