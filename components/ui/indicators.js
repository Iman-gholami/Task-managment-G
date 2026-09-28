"use client";

import { useApp } from "@/components/AppProvider";
import { CX, PRIO, QUAL, STATUS, TODAY, addDays, dueLabel, fmtDate, initials, isOpen } from "@/lib/format";

export function Status({ s, label }) {
  return <span className="status" data-s={s}>{label ?? STATUS[s]}</span>;
}

export function Priority({ p }) {
  return (
    <span className="prio" data-p={p}>
      <i>{p === "critical" ? "!" : <><b /><b /><b /></>}</i>
      {PRIO[p]}
    </span>
  );
}

export function Complexity({ c }) {
  return (
    <span className="cx" data-c={c}>
      <i><b /><b /><b /><b /></i>
      {CX[c]}
    </span>
  );
}

export function Quality({ q }) {
  return q ? <span className="q" data-q={q}>{QUAL[q]}</span> : <span className="muted">—</span>;
}

const FALLBACK = { name: "Unknown", color: "var(--ink-500)" };
function usePerson(id) {
  const app = useApp();
  return app?.peopleMap?.[id] ?? FALLBACK;
}

export function Avatar({ id, size }) {
  const p = usePerson(id);
  return (
    <span className={`avatar ${size === "lg" ? "lg" : ""}`} style={{ background: p.color }} title={p.name}>
      {initials(p.name)}
    </span>
  );
}

export function Who({ id, short }) {
  const p = usePerson(id);
  return (
    <span className="who">
      <Avatar id={id} />
      {short ? p.name.split(" ")[0] : p.name}
    </span>
  );
}

export function Due({ task }) {
  if (task.due === "—") return <span className="muted">No deadline</span>;
  const open = isOpen(task);
  const label = dueLabel(task.due, open);
  const cls = open && task.due < TODAY ? "overdue" : open && task.due <= addDays(TODAY, 2) ? "soon" : "num";
  return <span className={cls} title={fmtDate(task.due)}>{label}</span>;
}

export function Spark({ values, width = 120, height = 28, color = "var(--primary)" }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / (max - min || 1)) * (height - 4)]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

export function Distribution({ parts }) {
  return (
    <div className="dist">
      {parts.map((n, i) => <span key={i} style={{ flex: n, background: `var(--viz-${i + 1})` }} />)}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, danger }) {
  return (
    <div className="empty">
      <div className="glyph" style={danger ? { color: "var(--danger)" } : undefined}>{icon}</div>
      <h3>{title}</h3>
      {children}
      {action && <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center" }}>{action}</div>}
    </div>
  );
}
