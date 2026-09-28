"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Complexity, Due, EmptyState, Priority, Quality, Status, Who } from "@/components/ui/indicators";
import { prioItems } from "@/components/ui/menus";
import { PRIO, QUAL, STATUS } from "@/lib/format";
import { actionLabel, allowedTransitions } from "@/lib/workflow";

const HEAD = { title: "Task", a: "Assignee", team: "Team", status: "Status", prio: "Priority", cx: "Complexity", due: "Deadline", hours: "Hours", quality: "Quality", upd: "Updated" };

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
        items: qualityItems(),
        onPick: async (quality) => {
          if (await updateTask(task, { status: "done", quality })) toast(`${task.id} approved · ${QUAL[quality]}`);
        },
      });
    }
    if (await updateTask(task, { status: to })) toast(`${task.id} → ${STATUS[to]}`);
  };

  const edit = (anchor, field, task) => {
    if (field === "prio") {
      if (["done", "cancelled"].includes(task.status)) return toast("Closed tasks can't be changed.");
      if (task.a !== me.id && !["soc_manager", "security_manager"].includes(me.role)) return toast("You can only edit your own tasks.");
      return openPopover(anchor, { title: "Priority", items: prioItems(), onPick: async (v) => { if (await updateTask(task, { prio: v })) toast(`${task.id} → ${PRIO[v]}`); } });
    }
    const next = allowedTransitions(me, task);
    if (!next.length) {
      return toast(task.status === "done" ? "Approved tasks are closed." : task.status === "review" ? "Waiting for a reviewer." : "No status changes available to you.");
    }
    openPopover(anchor, {
      title: "Move task",
      items: next.map((s, i) => ({ value: s, label: <><Status s={s} /><span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>{actionLabel(task.status, s)}</span></>, kbd: String(i + 1) })),
      onPick: (to) => move(anchor, task, to),
    });
  };

  return { edit, move };
}

/** Back-compat alias used by keyboard shortcuts. */
export const useInlineEdit = () => useTaskActions().edit;

export default function TaskTable({ list, cols, compact, kb = -1, sort, onSort }) {
  const router = useRouter();
  const { edit } = useTaskActions();

  const editable = (field, task, node) => (
    <span className="cell-edit" data-edit={field} role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); edit(e.currentTarget, field, task); }}>
      {node}
    </span>
  );

  const cell = (t, c) => {
    switch (c) {
      case "title": return <td key={c} className="title"><span className="id">{t.id}</span>{t.title}</td>;
      case "a": return <td key={c}><Who id={t.a} /></td>;
      case "team": return <td key={c}>{t.team}</td>;
      case "status": return <td key={c}>{editable("status", t, <Status s={t.status} />)}</td>;
      case "prio": return <td key={c}>{editable("prio", t, <Priority p={t.prio} />)}</td>;
      case "cx": return <td key={c}><Complexity c={t.cx} /></td>;
      case "due": return <td key={c}><Due task={t} /></td>;
      case "hours": return <td key={c} className="r num">{t.hours ? t.hours.toFixed(1) : <span className="muted">—</span>}</td>;
      case "quality": return <td key={c}><Quality q={t.quality} /></td>;
      case "upd": return <td key={c} className="muted num">{t.upd}</td>;
      default: return null;
    }
  };

  return (
    <div className="table-wrap" style={compact ? { border: 0 } : undefined}>
      <table className="dt">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className={`${c === "hours" ? "r" : ""} ${sort?.k === c ? "sorted" : ""}`} onClick={() => onSort?.(c)} aria-sort={sort?.k === c ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                {HEAD[c]}{sort?.k === c ? (sort.dir > 0 ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.length ? (
            list.map((t, i) => (
              <tr key={t.id} className={i === kb ? "kb" : ""} onClick={() => router.push(`/tasks/${t.id}`)}>
                {cols.map((c) => cell(t, c))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={cols.length}>
                <EmptyState icon={<Icon name="check" />} title="You're all caught up.">No tasks match this view.</EmptyState>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
