"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import { Panel } from "@/components/ui/layout";
import { Notice } from "@/components/ui/states";
import { Who } from "@/components/ui/indicators";
import { TODAY, dueLabel, isOpen, plural } from "@/lib/format";

// Reasons a task needs a manager, most urgent first. Only states the product records are used.
const REASONS = {
  blocked: { rank: 0, tone: "danger", icon: "blocked", label: () => "Blocked", filter: "Blocked" },
  overdue: { rank: 1, tone: "danger", icon: "flag", label: (t) => dueLabel(t.due), filter: "Overdue" },
  review: { rank: 2, tone: "violet", icon: "review", label: () => "Needs review", filter: "Review" },
};

export const socScope = (u) => (u.team ?? "").startsWith("SOC");
export const allScope = () => true;

/**
 * Tasks in `scope` (a stable predicate over the assignee) that need a manager: waiting for review,
 * overdue, or blocked. One entry per task with every reason it qualifies, sorted by urgency.
 */
export function useAttention(scope) {
  const { tasks, me, peopleMap } = useApp();
  return useMemo(() => {
    const byTask = new Map();
    const add = (t, reason) => {
      const entry = byTask.get(t.id) ?? { t, reasons: [] };
      entry.reasons.push(reason);
      byTask.set(t.id, entry);
    };
    for (const t of tasks) {
      if (!scope(peopleMap[t.a] ?? { team: t.team })) continue;
      if (t.status === "blocked") add(t, "blocked");
      if (isOpen(t) && t.due !== "—" && t.due < TODAY) add(t, "overdue");
      if (t.status === "review" && t.a !== me.id) add(t, "review");
    }
    const rank = (e) => Math.min(...e.reasons.map((r) => REASONS[r].rank));
    // Most severe reason first, then tasks with more reasons, then the oldest deadline.
    const byDue = (a, b) => (a.t.due < b.t.due ? -1 : a.t.due > b.t.due ? 1 : 0);
    return [...byTask.values()].sort((a, b) => rank(a) - rank(b) || b.reasons.length - a.reasons.length || byDue(a, b));
  }, [tasks, me.id, peopleMap, scope]);
}

export const countReason = (items, reason) => items.filter((e) => e.reasons.includes(reason)).length;

/** Operational priority list. Compact one-line state when nothing needs attention. */
export function AttentionList({ items, limit = 6 }) {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const available = Object.keys(REASONS).filter((r) => countReason(items, r) > 0);
  const current = filter === "all" || available.includes(filter) ? filter : "all";
  const list = current === "all" ? items : items.filter((e) => e.reasons.includes(current));
  const shown = expanded ? list : list.slice(0, limit);

  return (
    <Panel
      title="Needs your attention"
      meta={items.length ? plural(items.length, "task") : null}
      actions={available.length > 1 && (
        <Segmented
          label="Filter attention items"
          value={current}
          onChange={(v) => { setFilter(v); setExpanded(false); }}
          options={[{ value: "all", label: "All", count: items.length }, ...available.map((r) => ({ value: r, label: REASONS[r].filter, count: countReason(items, r) }))]}
        />
      )}
      className="attn-list"
    >
      {items.length === 0 ? (
        <Notice><b>All clear.</b> No reviews waiting, nothing overdue or blocked.</Notice>
      ) : (
        <>
          <div role="list">
            {shown.map(({ t, reasons }) => {
              const lead = REASONS[reasons.slice().sort((a, b) => REASONS[a].rank - REASONS[b].rank)[0]];
              return (
                <Link key={t.id} href={`/tasks/${t.id}`} className="attn" role="listitem" style={{ "--tone": `var(--${lead.tone})` }}>
                  <span className="ic" aria-hidden="true"><Icon name={lead.icon} /></span>
                  <span className="attn-title"><span className="id">{t.id}</span><span className="t">{t.title}</span></span>
                  <span className="attn-who"><Who id={t.a} size="sm" /></span>
                  <span className="attn-why">
                    {reasons.map((r) => <span key={r} className={`badge ${REASONS[r].tone}`}>{REASONS[r].label(t)}</span>)}
                  </span>
                  <span className="attn-go"><span className="btn btn-ghost btn-sm">{reasons.includes("review") ? "Review" : "Open"}</span></span>
                </Link>
              );
            })}
          </div>
          {list.length > limit && (
            <div className="attn-more">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>
                {expanded ? "Show fewer" : `Show all ${list.length}`}<Icon name={expanded ? "up" : "down"} />
              </button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
