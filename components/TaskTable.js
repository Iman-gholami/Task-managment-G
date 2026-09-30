"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Complexity, Due, Priority, Quality, Status, Who } from "@/components/ui/indicators";
import { EmptyState } from "@/components/ui/states";
import { prioItems } from "@/components/ui/menus";
import { PRIO, QUAL, STATUS } from "@/lib/format";
import { isManager } from "@/lib/roles";
import { actionLabel, allowedTransitions } from "@/lib/workflow";

// Fixed widths keep columns aligned across several tables on one page (e.g. grouped by assignee).
const WIDTH = { a: 180, team: 140, status: 132, prio: 104, cx: 124, due: 136, hours: 72, quality: 136, upd: 88 };
const HEAD = { title: "Task", a: "Assignee", team: "Team", status: "Status", prio: "Priority", cx: "Complexity", due: "Deadline", hours: "Hours", quality: "Quality", upd: "Updated" };
// Columns that stay visible on phones (the rest collapse into the card layout).
const PRIMARY = new Set(["title", "status", "prio", "due", "a"]);

export const qualityItems = () => Object.entries(QUAL).map(([v, l], i) => ({ value: v, label: <Quality q={v} />, kbd: String(i + 1) }));

/**
 * Workflow-aware status/priority editing shared by the table, details and keyboard shortcuts.
 * Only transitions the current user is allowed to make are offered; approving asks for quality.
 */
export function useTaskActions() {
  const { openPopover, updateTask, toast, me } = useApp();

  const move = async (anchor, task, to) => {
    if (task.status === "review" && to === "done") {
      return openPopover(anchor, {
        title: "Approve with quality",
        force: true,
        items: qualityItems(),
        onPick: async (quality) => {
          if (await updateTask(task, { status: "done", quality })) toast(`${task.id} approved · ${QUAL[quality]}`);
        },
      });
    }
    if (await updateTask(task, { status: to })) toast(`${task.id} moved to ${STATUS[to]}`);
  };

  const edit = (anchor, field, task) => {
    if (field === "prio") {
      if (["done", "cancelled"].includes(task.status)) return toast("Closed tasks can't be changed.", "info");
      if (task.a !== me.id && !isManager(me)) return toast("You can only edit your own tasks.", "info");
      return openPopover(anchor, { title: "Priority", items: prioItems(), onPick: async (v) => { if (await updateTask(task, { prio: v })) toast(`${task.id} priority set to ${PRIO[v]}`); } });
    }
    const next = allowedTransitions(me, task);
    if (!next.length) {
      return toast(task.status === "done" ? "Approved tasks are closed. A manager can reopen them." : task.status === "review" ? "Waiting for a reviewer." : "No status changes are available to you.", "info");
    }
    openPopover(anchor, {
      title: "Move task",
      items: next.map((s, i) => ({ value: s, label: <Status s={s} />, hint: actionLabel(task.status, s), kbd: String(i + 1) })),
      onPick: (to) => move(anchor, task, to),
    });
  };

  return { edit, move };
}

/** Back-compat alias used by keyboard shortcuts. */
export const useInlineEdit = () => useTaskActions().edit;

/**
 * Task table. `groups` (optional): [{ key, label, items }] renders one table with a header row per group.
 * Sortable when `onSort` is given. Rows open the task on click; the title is a real link for keyboard users.
 */
export default function TaskTable({ list, groups, cols, kb = -1, sort, onSort, empty }) {
  const router = useRouter();
  const { edit } = useTaskActions();

  const editable = (field, task, node) => (
    <span className="cell-edit" data-edit={field} role="button" tabIndex={-1} aria-label={`Change ${field === "prio" ? "priority" : "status"}`} onClick={(e) => { e.stopPropagation(); edit(e.currentTarget, field, task); }}>
      {node}
    </span>
  );

  const cell = (t, c) => {
    const cls = PRIMARY.has(c) ? "" : "opt";
    switch (c) {
      case "title": return <td key={c} className="title" data-col={c} title={t.title}><span className="id">{t.id}</span><Link href={`/tasks/${t.id}`}>{t.title}</Link></td>;
      case "a": return <td key={c} data-col={c}><Who id={t.a} /></td>;
      case "team": return <td key={c} className={cls} data-col={c}>{t.team}</td>;
      case "status": return <td key={c} data-col={c}>{editable("status", t, <Status s={t.status} />)}</td>;
      case "prio": return <td key={c} data-col={c}>{editable("prio", t, <Priority p={t.prio} />)}</td>;
      case "cx": return <td key={c} className={cls} data-col={c}><Complexity c={t.cx} /></td>;
      case "due": return <td key={c} data-col={c}><Due task={t} /></td>;
      case "hours": return <td key={c} className={`r ${cls}`} data-col={c}>{t.hours ? t.hours.toFixed(1) : <span className="zero">—</span>}</td>;
      case "quality": return <td key={c} className={cls} data-col={c}><Quality q={t.quality} /></td>;
      case "upd": return <td key={c} className={`muted ${cls}`} data-col={c}>{t.upd}</td>;
      default: return null;
    }
  };

  const open = (e, t) => { if (!e.target.closest("a, button, [data-edit]")) router.push(`/tasks/${t.id}`); };
  const row = (t, i) => (
    <tr key={t.id} className={`is-link ${i >= 0 && i === kb ? "kb" : ""}`} onClick={(e) => open(e, t)}>
      {cols.map((c) => cell(t, c))}
    </tr>
  );

  const header = (c) => {
    const sorted = sort?.k === c;
    const label = HEAD[c];
    return (
      <th key={c} scope="col" className={c === "hours" ? "r" : ""} aria-sort={sorted ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
        {onSort ? (
          <button type="button" className="sort" onClick={() => onSort(c)}>
            {label}<Icon name={sorted ? (sort.dir > 0 ? "arrowUp" : "arrowDown") : "sort"} />
          </button>
        ) : label}
      </th>
    );
  };

  const hasRows = groups ? groups.length > 0 : list.length > 0;

  return (
    <div className="table-wrap">
      <table className="dt fixed cards">
        <colgroup>{cols.map((c) => <col key={c} style={WIDTH[c] ? { width: WIDTH[c] } : undefined} />)}</colgroup>
        <thead><tr>{cols.map(header)}</tr></thead>
        <tbody>
          {groups ? groups.map((g) => (
            <Fragment key={g.key}>
              <tr className="group-row" data-testid={`group-${g.key}`}><td colSpan={cols.length}>{g.label}</td></tr>
              {g.items.map((t) => row(t, -1))}
            </Fragment>
          )) : list.map((t, i) => row(t, i))}
          {!hasRows && (
            <tr>
              <td colSpan={cols.length} style={{ height: "auto", whiteSpace: "normal" }}>
                <EmptyState compact icon="checkCircle" title={empty?.title ?? "No tasks here"}>{empty?.body ?? "No tasks match this view."}</EmptyState>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
