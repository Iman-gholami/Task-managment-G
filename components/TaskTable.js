"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Complexity, Due, EmptyState, Priority, Quality, Status, Who } from "@/components/ui/indicators";
import { prioItems, statusItems } from "@/components/ui/menus";
import { PRIO, STATUS } from "@/lib/format";

const HEAD = { title: "Task", a: "Assignee", team: "Team", status: "Status", prio: "Priority", cx: "Complexity", due: "Deadline", hours: "Hours", quality: "Quality", upd: "Updated" };

/** Opens the inline Status / Priority editor for a task. Shared by table rows, details and keyboard shortcuts. */
export function useInlineEdit() {
  const { openPopover, updateTask, toast } = useApp();
  return (anchor, field, task) =>
    openPopover(anchor, {
      title: field === "status" ? "Change status" : "Priority",
      items: field === "status" ? statusItems() : prioItems(),
      onPick: async (v) => {
        if (await updateTask(task, { [field]: v })) toast(`${task.id} → ${field === "status" ? STATUS[v] : PRIO[v]}`);
      },
    });
}

export default function TaskTable({ list, cols, compact, kb = -1, sort, onSort }) {
  const router = useRouter();
  const edit = useInlineEdit();

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
