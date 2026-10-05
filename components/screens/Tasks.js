"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import TaskTable, { useInlineEdit } from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import { PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Avatar, Priority, Status } from "@/components/ui/indicators";
import { PRIO, STATUS, TODAY, dueLabel, isOpen, plural } from "@/lib/format";
import { inTeamScope, isManager } from "@/lib/roles";

export { inTeamScope };

const ORDER = { status: Object.keys(STATUS), prio: Object.keys(PRIO) };
const overdue = (t) => isOpen(t) && t.due !== "—" && t.due < TODAY;

// Status tabs: each is a predicate over tasks, with its own empty-state copy.
const TABS = [
  ["open", "Open", (t) => isOpen(t), "No open tasks"],
  ["review", "Needs review", (t) => t.status === "review", "Nothing waiting for review"],
  ["attention", "Overdue / Blocked", (t) => overdue(t) || t.status === "blocked" || t.status === "returned", "Nothing overdue, blocked or returned"],
  ["done", "Done", (t) => t.status === "done", "No completed tasks yet"],
  ["all", "All", () => true, "No tasks"],
];

const VIEWS = {
  my: { title: "My tasks", sub: "Work assigned to you", empty: ["Nothing assigned to you", "When someone assigns you a task — or you create one for yourself — it shows up here."] },
  assigned: { title: "Assigned by me", sub: "Tasks you created for other people, grouped by assignee", empty: ["You haven't assigned any tasks yet", "Tasks you create for your team appear here, grouped by person, so you can follow them up."] },
  team: { title: "Team tasks", sub: "Everything your team is working on", empty: ["No team tasks yet", "Tasks assigned to people in your team will appear here."] },
};

export default function Tasks({ scope }) {
  const { tasks, setCreateOpen, me, peopleMap } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const edit = useInlineEdit();
  const manager = isManager(me);
  const [tab, setTab] = useState(() => (TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "open"));
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("");
  const [prio, setPrio] = useState("");
  const [sort, setSort] = useState({ k: "due", dir: 1 });
  const [grouped, setGrouped] = useState(scope !== "my");
  const [view, setView] = useState("table");
  const [kb, setKb] = useState(0);
  const [kbOn, setKbOn] = useState(false); // the row cursor appears once J/K is used

  const base = useMemo(() => tasks.filter((t) =>
    scope === "my" ? t.a === me.id
      : scope === "assigned" ? t.createdBy === me.id && t.a !== me.id
      : inTeamScope(me, peopleMap[t.a])
  ), [tasks, scope, me, peopleMap]);

  const [, , tabPred, tabEmpty] = TABS.find((x) => x[0] === tab);
  const inTab = useMemo(() => base.filter(tabPred), [base, tabPred]);
  const list = useMemo(() => {
    let l = inTab;
    if (q) l = l.filter((t) => (t.title + t.id).toLowerCase().includes(q.toLowerCase()));
    if (assignee) l = l.filter((t) => t.a === assignee);
    if (prio) l = l.filter((t) => t.prio === prio);
    const val = (t) => (ORDER[sort.k] ? ORDER[sort.k].indexOf(t[sort.k]) : sort.k === "a" ? peopleMap[t.a]?.name : t[sort.k] ?? "");
    return [...l].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [inTab, q, assignee, prio, sort, peopleMap]);

  const groups = useMemo(() => {
    const by = new Map();
    for (const t of list) by.set(t.a, [...(by.get(t.a) ?? []), t]);
    return [...by.entries()].sort((a, b) => (peopleMap[a[0]]?.name ?? "").localeCompare(peopleMap[b[0]]?.name ?? ""));
  }, [list, peopleMap]);

  const isGrouped = grouped && scope !== "my";
  const cols = isGrouped || scope === "my" ? ["title", "status", "prio", "cx", "due", "hours", "quality", "upd"] : ["title", "a", "status", "prio", "cx", "due", "hours", "quality"];
  const people = [...new Set(base.map((t) => t.a))].map((id) => peopleMap[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const activeFilters = [q, assignee, prio].filter(Boolean).length;
  const resetFilters = () => { setQ(""); setAssignee(""); setPrio(""); };
  const showKb = view === "table" && !isGrouped;
  const canCreate = manager || scope === "my";

  // Keyboard triage in the flat table: J/K move, Enter opens, S/P open status/priority, / focuses search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || document.querySelector(".pop, .scrim")) return;
      if (e.target.closest('[role="tablist"], [role="radiogroup"]')) return; // arrows belong to the control
      if (e.key === "/") { e.preventDefault(); document.getElementById("task-search")?.focus(); return; }
      if (!showKb) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setKbOn(true); setKb((k) => (kbOn ? Math.min(list.length - 1, k + 1) : k)); }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setKbOn(true); setKb((k) => Math.max(0, k - 1)); }
      if (!kbOn) return;
      if (e.key === "Enter" && list[kb] && !e.target.closest("a, button")) router.push(`/tasks/${list[kb].id}`);
      if ((e.key === "s" || e.key === "p") && list[kb]) {
        const field = e.key === "s" ? "status" : "prio";
        const anchor = document.querySelector(`tr.kb [data-edit=${field}]`);
        if (anchor) edit(anchor, field, list[kb]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [list, kb, kbOn, showKb, router, edit]);
  useEffect(() => { document.querySelector("tr.kb")?.scrollIntoView({ block: "nearest" }); }, [kb]);

  const onSort = (k) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }));
  const v = VIEWS[scope];
  const createButton = (size) => <button type="button" className={`btn btn-primary ${size ?? ""}`} onClick={() => setCreateOpen(true)}><Icon name="plus" />Create task{!size && <kbd>C</kbd>}</button>;

  let body;
  if (base.length === 0) {
    body = <EmptyState icon="inbox" title={v.empty[0]} action={canCreate ? createButton("btn-sm") : null}>{v.empty[1]}</EmptyState>;
  } else if (list.length === 0) {
    body = activeFilters
      ? <EmptyState icon="search" title="No tasks match these filters" action={<button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>Reset filters</button>}>Nothing in “{TABS.find((x) => x[0] === tab)[1]}” matches. Try another search or clear the filters.</EmptyState>
      : <EmptyState icon="checkCircle" title={tabEmpty}>{tab === "open" ? "Everything here is done or cancelled." : "Switch tabs to see other tasks."}</EmptyState>;
  } else if (view === "board") {
    body = <Board list={list} />;
  } else if (isGrouped) {
    body = (
      <TaskTable cols={cols} sort={sort} onSort={onSort} groups={groups.map(([id, items]) => {
        const review = items.filter((t) => t.status === "review").length;
        const late = items.filter(overdue).length;
        return {
          key: id,
          items,
          label: (
            <span className="who">
              <Avatar id={id} />
              <span>{peopleMap[id]?.name ?? "Unknown"}</span>
              <span className="muted">{plural(items.length, "task")}{review > 0 && ` · ${review} in review`}</span>
              {late > 0 && <span className="overdue" style={{ fontWeight: 400 }}>· {late} overdue</span>}
            </span>
          ),
        };
      })} />
    );
  } else {
    body = <TaskTable list={list} cols={cols} kb={showKb && kbOn ? kb : -1} sort={sort} onSort={onSort} />;
  }

  return (
    <div className="page">
      <PageHeader
        title={v.title}
        meta={[v.sub, plural(base.filter(isOpen).length, "open task")]}
        actions={
          <>
            <Segmented label="Layout" iconOnly value={view} onChange={setView} options={[{ value: "table", icon: "list", ariaLabel: "Table view" }, { value: "board", icon: "board", ariaLabel: "Board view" }]} />
            {canCreate && createButton()}
          </>
        }
      />

      {base.length > 0 && (
        <>
          <div className="tabs-row">
            <Segmented
              kind="tabs"
              label="Task status"
              value={tab}
              onChange={(k) => { setTab(k); setKb(0); }}
              options={TABS.filter(([k]) => k !== "review" || manager || scope === "my").map(([k, label, pred]) => ({ value: k, label, count: base.filter(pred).length }))}
            />
          </div>
          <div className="toolbar" role="search" aria-label="Filter tasks">
            <div className="search">
              <Icon name="search" />
              <input id="task-search" type="search" className="input" placeholder="Search title or ID" aria-label="Search tasks by title or ID" aria-keyshortcuts="/" value={q} onChange={(e) => { setQ(e.target.value); setKb(0); }} onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()} />
            </div>
            {scope !== "my" && (
              <select className={`input ${assignee ? "is-set" : ""}`} style={{ width: 190 }} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
                <option value="">All assignees</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <select className={`input ${prio ? "is-set" : ""}`} style={{ width: 150 }} value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Priority">
              <option value="">Any priority</option>
              {Object.entries(PRIO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {activeFilters > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><Icon name="x" />Reset filters ({activeFilters})</button>}
            <div className="end">
              <span className="result-count" aria-live="polite">{list.length === inTab.length ? plural(list.length, "task") : `${list.length} of ${inTab.length} tasks`}</span>
              {scope !== "my" && view === "table" && (
                <label className="toggle-label">
                  <input type="checkbox" role="switch" className="switch" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />Group by assignee
                </label>
              )}
            </div>
          </div>
        </>
      )}

      {view === "board" && list.length > 0 ? body : <div className="panel">{body}</div>}
    </div>
  );
}

const COLUMNS = ["todo", "progress", "review", "returned", "done"];

function Board({ list }) {
  return (
    <div className="board">
      {COLUMNS.map((s) => {
        const col = list.filter((t) => t.status === s || (s === "todo" && t.status === "backlog") || (s === "progress" && t.status === "blocked"));
        return (
          <section key={s} className="board-col" data-s={s} aria-label={`${STATUS[s]}: ${col.length}`}>
            <div className="board-col-head"><Status s={s} /><span className="board-count num">{col.length}</span></div>
            {col.length === 0 && <div className="board-empty">No tasks</div>}
            {col.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="board-card" data-s={t.status} data-overdue={isOpen(t) && t.due !== "—" && t.due < TODAY ? "" : undefined}>
                <div className="board-card-top">
                  <span className="mono muted">{t.id}</span>
                  {t.status === "blocked" && <Status s="blocked" />}
                  {t.status === "backlog" && <span className="badge">Backlog</span>}
                  <Avatar id={t.a} size="sm" label />
                </div>
                <div className="t">{t.title}</div>
                <div className="meta">
                  <Priority p={t.prio} />
                  {t.due !== "—" && isOpen(t) && <span className={`due ${t.due < TODAY ? "overdue" : "muted"}`}>{dueLabel(t.due)}</span>}
                </div>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
