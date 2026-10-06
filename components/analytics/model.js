"use client";

import Link from "next/link";
import { diffDays, faDate } from "@/lib/analytics/calendar";
import { fmtInt } from "@/lib/analytics/format";
import { CX_FA, OPEN_STATUSES, PRIO_FA, QUAL_FA, STATUS_FA } from "@/lib/analytics/labels";
import { METRICS, bucketStats, openStats, peerMedian, stats } from "@/lib/analytics/metrics";
import { buckets } from "@/lib/analytics/periods";

/** Everything the person drawer and profile show for one expert. Null when the person isn't in view. */
export function personModel(facts, id, range, cmp, gran) {
  const p = facts.people.find((x) => x.id === id);
  if (!p) return null;
  const team = facts.people.filter((x) => x.group === p.group && !x.manager);
  const medians = facts.peers
    ? (facts.peers.hidden ? null : facts.peers.range ?? null)
    : team.length > 1 ? Object.fromEntries(Object.keys(METRICS).map((k) => [k, peerMedian(facts, team, range, k)])) : null;
  const b = buckets(range.from, range.end, gran);
  const pb = cmp ? buckets(cmp.from, cmp.to, gran) : [];
  const mine = facts.tasks.filter((t) => t.a === id);
  return {
    p, team, medians, b, pb,
    cur: stats(facts, [id], range),
    prev: cmp ? stats(facts, [id], cmp) : null,
    bs: bucketStats(facts, [id], b),
    pbs: bucketStats(facts, [id], pb),
    open: openStats(facts, [id]),
    openTasks: mine.filter((t) => OPEN_STATUSES.includes(t.status)).sort((x, y) => (x.due ?? "9999").localeCompare(y.due ?? "9999")),
    doneTasks: mine.filter((t) => t.completed && t.completed >= range.from && t.completed <= range.end).sort((x, y) => y.completed.localeCompare(x.completed)),
  };
}

export const StatusFa = ({ s }) => <span className="status" data-s={s}>{STATUS_FA[s]}</span>;
export const PrioFa = ({ p }) => <span className="prio" data-p={p}><i aria-hidden="true">{p === "critical" ? "!" : <><b /><b /><b /></>}</i>{PRIO_FA[p]}</span>;
export const CxFa = ({ c }) => <span className="cx" data-c={c}><i aria-hidden="true"><b /><b /><b /><b /></i>{CX_FA[c - 1]}</span>;

/** Columns for task lists (open work, completed in period). Task pages exist only for real data. */
export function taskColumns({ demo, today, done = false }) {
  const title = (t) => (demo ? t.title : <Link href={`/tasks/${t.id}`}>{t.title}</Link>);
  return [
    { key: "title", label: "تسک", value: (t) => t.title, render: (t) => <span className="an-person"><span className="mono muted">{t.id}</span>{title(t)}</span> },
    ...(done ? [] : [{ key: "status", label: "وضعیت", value: (t) => STATUS_FA[t.status], render: (t) => <StatusFa s={t.status} /> }]),
    { key: "prio", label: "اولویت", value: (t) => ["low", "normal", "high", "critical"].indexOf(t.prio), render: (t) => <PrioFa p={t.prio} /> },
    { key: "cx", label: "پیچیدگی", value: (t) => t.cx, render: (t) => <CxFa c={t.cx} /> },
    ...(done
      ? [
        { key: "completed", label: "تأیید", value: (t) => t.completed, render: (t) => faDate(t.completed, { year: false }) },
        { key: "quality", label: "کیفیت", value: (t) => (t.quality ? QUAL_FA[t.quality] : null) },
        { key: "hours", label: "ساعت", kind: "count", value: (t) => t.hours },
        { key: "cycle", label: "زمان انجام", kind: "days", value: (t) => t.cycle },
        { key: "late", label: "به‌موقع", value: (t) => (t.due ? (t.completed <= t.due ? "بله" : "خیر") : null) },
      ]
      : [
        { key: "due", label: "ددلاین", value: (t) => t.due, render: (t) => (t.due ? <span className={t.due < today ? "overdue" : ""}>{faDate(t.due, { year: false })}{t.due < today ? ` · ${fmtInt(diffDays(t.due, today))} روز تأخیر` : ""}</span> : <span className="muted">بدون ددلاین</span>) },
      ]),
  ];
}
