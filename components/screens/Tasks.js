"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import TaskTable, { useInlineEdit } from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import { Avatar, EmptyState, Priority, Status } from "@/components/ui/indicators";
import { PRIO, STATUS, TODAY, isOpen } from "@/lib/format";
import { isManager } from "@/lib/roles";

const ORDER = { status: Object.keys(STATUS), prio: Object.keys(PRIO) };
const teamKey = (team = "") => (team.startsWith("SOC") ? "SOC" : team);

/** Whose tasks count as "my team" for the viewer. */
export function inTeamScope(viewer, user) {
  if (!user) return false;
  if (viewer.role === "security_manager") return true;
  return teamKey(user.team) === teamKey(viewer.team) || (viewer.role === "soc_manager" && teamKey(user.assist ?? "") === "SOC");
}

const overdue = (t) => isOpen(t) && t.due !== "—" && t.due < TODAY;

// Status tabs: each is a predicate over tasks.
const TABS = [
  ["open", "Open", (t) => isOpen(t)],
  ["review", "Needs review", (t) => t.status === "review"],
  ["attention", "Overdue / Blocked", (t) => overdue(t) || t.status === "blocked" || t.status === "returned"],
  ["done", "Done", (t) => t.status === "done"],
  ["all", "All", () => true],
];

const VIEWS = {
  my: { title: "My Tasks", sub: "Work assigned to you" },
  assigned: { title: "Assigned by Me", sub: "Tasks you created for other people — grouped by assignee" },
  team: { title: "Team Tasks", sub: "Everything your team is working on" },
};

export default function Tasks({ scope }) {
  const { tasks, setCreateOpen, me, peopleMap, members } = useApp();
  const router = useRouter();
  const edit = useInlineEdit();
  const manager = isManager(me);
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("");
  const [prio, setPrio] = useState("");
  const [sort, setSort] = useState({ k: "due", dir: 1 });
  const [grouped, setGrouped] = useState(scope !== "my");
  const [view, setView] = useState("table");
  const [kb, setKb] = useState(0);

  const base = useMemo(() => tasks.filter((t) =>
    scope === "my" ? t.a === me.id
      : scope === "assigned" ? t.createdBy === me.id && t.a !== me.id
      : inTeamScope(me, peopleMap[t.a])
  ), [tasks, scope, me, peopleMap]);

  const tabPred = TABS.find((x) => x[0] === tab)[2];
  const list = useMemo(() => {
    let l = base.filter(tabPred);
    if (q) l = l.filter((t) => (t.title + t.id).toLowerCase().includes(q.toLowerCase()));
    if (assignee) l = l.filter((t) => t.a === assignee);
    if (prio) l = l.filter((t) => t.prio === prio);
    const val = (t) => (ORDER[sort.k] ? ORDER[sort.k].indexOf(t[sort.k]) : sort.k === "a" ? peopleMap[t.a]?.name : t[sort.k] ?? "");
    return [...l].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [base, tabPred, q, assignee, prio, sort, peopleMap]);

  const groups = useMemo(() => {
    const by = new Map();
    for (const t of list) by.set(t.a, [...(by.get(t.a) ?? []), t]);
    return [...by.entries()].sort((a, b) => (peopleMap[a[0]]?.name ?? "").localeCompare(peopleMap[b[0]]?.name ?? ""));
  }, [list, peopleMap]);

  const cols = scope === "my" ? ["title", "status", "prio", "cx", "due", "hours", "quality", "upd"] : grouped ? ["title", "status", "prio", "cx", "due", "hours", "quality", "upd"] : ["title", "a", "status", "prio", "cx", "due", "hours", "quality"];
  const people = [...new Set(base.map((t) => t.a))].map((id) => peopleMap[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const filtered = q || assignee || prio;
  const showKb = view === "table" && !grouped;

  // Keyboard triage in the flat table: J/K move, Enter opens, S opens the status menu, / focuses search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || document.querySelector(".pop, .scrim")) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("task-search")?.focus(); return; }
      if (!showKb) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setKb((k) => Math.min(list.length - 1, k + 1)); }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setKb((k) => Math.max(0, k - 1)); }
      if (e.key === "Enter" && list[kb]) router.push(`/tasks/${list[kb].id}`);
      if ((e.key === "s" || e.key === "p") && list[kb]) {
        const field = e.key === "s" ? "status" : "prio";
        const anchor = document.querySelector(`tr.kb [data-edit=${field}]`);
        if (anchor) edit(anchor, field, list[kb]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [list, kb, showKb, router, edit]);

  const onSort = (k) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }));
  const v = VIEWS[scope];

  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="page-head" style={{ marginBottom: 16 }}>
          <div><h1>{v.title}</h1><p>{v.sub}</p></div>
          <div className="actions">
            <div className="seg" aria-label="View">
              <button className={view === "table" ? "on" : ""} onClick={() => setView("table")} aria-label="Table view"><Icon name="list" /></button>
              <button className={view === "board" ? "on" : ""} onClick={() => setView("board")} aria-label="Board view"><Icon name="board" /></button>
            </div>
            {(manager || scope === "my") && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" />Create Task<kbd style={{ borderColor: "rgba(255,255,255,.3)", color: "rgba(255,255,255,.8)" }}>C</kbd></button>}
          </div>
        </div>

        <div className="seg" role="tablist" aria-label="Task status" style={{ marginBottom: 12 }}>
          {TABS.filter(([k]) => k !== "review" || manager || scope === "my").map(([k, label, pred]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setKb(0); }}>
              {label} <span className="muted num" style={{ marginLeft: 4 }}>{base.filter(pred).length}</span>
            </button>
          ))}
        </div>

        <div className="toolbar">
          <div className="search"><Icon name="search" /><input id="task-search" className="input" placeholder="Search title or ID" value={q} onChange={(e) => { setQ(e.target.value); setKb(0); }} onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()} /></div>
          {scope !== "my" && (
            <select className="input" style={{ width: 190, height: 30 }} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
              <option value="">All assignees</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select className="input" style={{ width: 150, height: 30 }} value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Priority">
            <option value="">Any priority</option>
            {Object.entries(PRIO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {filtered && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setAssignee(""); setPrio(""); }}>Reset</button>}
          {scope !== "my" && view === "table" && (
            <label className="sec" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input type="checkbox" className="switch" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />Group by assignee
            </label>
          )}
        </div>
      </div>

      <div style={{ padding: "0 20px 32px" }}>
        {list.length === 0 ? (
          <EmptyState icon={<Icon name="check" />} title={base.length ? "Nothing here" : scope === "assigned" ? "You haven't assigned any tasks yet" : "You're all caught up."}
            action={manager && !base.length ? <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>Create Task</button> : null}>
            {base.length ? "No tasks match this tab or filter." : scope === "assigned" ? "Tasks you create for your team will appear here." : "No tasks yet."}
          </EmptyState>
        ) : view === "board" ? (
          <Board list={list} onOpen={(id) => router.push(`/tasks/${id}`)} />
        ) : grouped && scope !== "my" ? (
          <TaskTable cols={cols} sort={sort} onSort={onSort} groups={groups.map(([id, items]) => ({
            key: id,
            items,
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Avatar id={id} />{peopleMap[id]?.name ?? "Unknown"}
                <span className="muted" style={{ fontWeight: 400 }}>
                  {items.length} task{items.length === 1 ? "" : "s"}
                  {items.filter((t) => t.status === "review").length > 0 && ` · ${items.filter((t) => t.status === "review").length} in review`}
                </span>
                {items.filter(overdue).length > 0 && <span className="overdue" style={{ fontWeight: 400 }}>· {items.filter(overdue).length} overdue</span>}
              </span>
            ),
          }))} />
        ) : (
          <TaskTable list={list} cols={cols} kb={showKb ? kb : -1} sort={sort} onSort={onSort} />
        )}
      </div>
    </>
  );
}

function Board({ list, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(220px,1fr))", gap: 12, paddingTop: 12, paddingBottom: 24 }}>
      {["todo", "progress", "review", "returned", "done"].map((s) => {
        const col = list.filter((t) => t.status === s || (s === "todo" && t.status === "backlog") || (s === "progress" && t.status === "blocked"));
        return (
          <div key={s} className="panel-2" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 4px 10px" }}><Status s={s} /><span className="muted num">{col.length}</span></div>
            {col.map((t) => (
              <div key={t.id} className="panel" onClick={() => onOpen(t.id)} style={{ padding: "10px 12px", marginBottom: 8, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
                <div className="mono muted">{t.id}{t.status === "blocked" ? " · blocked" : ""}</div>
                <div style={{ fontWeight: 500, margin: "4px 0 10px", fontSize: 13 }}>{t.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Priority p={t.prio} /><span style={{ marginLeft: "auto" }}><Avatar id={t.a} /></span></div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
