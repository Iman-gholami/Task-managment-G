"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import TaskTable, { useInlineEdit } from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import { Avatar, Priority, Status } from "@/components/ui/indicators";
import { prioItems, statusItems } from "@/components/ui/menus";
import { PRIO, STATUS } from "@/lib/format";

const TITLES = { my: "My Tasks", team: "Team Tasks", all: "All Tasks" };
const ORDER = { status: Object.keys(STATUS), prio: Object.keys(PRIO) };

export default function Tasks({ scope }) {
  const { tasks, setCreateOpen, openPopover, me, peopleMap } = useApp();
  const router = useRouter();
  const edit = useInlineEdit();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ status: null, prio: null });
  const [sort, setSort] = useState({ k: "due", dir: 1 });
  const [view, setView] = useState("table");
  const [kb, setKb] = useState(0);

  const list = useMemo(() => {
    let l = tasks.filter((t) => (scope === "my" ? t.a === me.id : scope === "team" ? t.team.startsWith("SOC") : true));
    if (q) l = l.filter((t) => (t.title + t.id).toLowerCase().includes(q.toLowerCase()));
    if (filters.status) l = l.filter((t) => t.status === filters.status);
    if (filters.prio) l = l.filter((t) => t.prio === filters.prio);
    const val = (t) => (ORDER[sort.k] ? ORDER[sort.k].indexOf(t[sort.k]) : sort.k === "a" ? peopleMap[t.a]?.name : t[sort.k] ?? "");
    return [...l].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [tasks, scope, q, filters, sort, me.id, peopleMap]);

  const cols = scope === "my" ? ["title", "status", "prio", "cx", "due", "hours", "quality", "upd"] : ["title", "a", "status", "prio", "cx", "due", "hours", "quality"];
  const active = Object.entries(filters).filter(([, v]) => v);

  // Keyboard triage: J/K (or arrows) move, Enter opens, S opens the status menu, / focuses search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || document.querySelector(".pop, .scrim")) return;
      if (view !== "table") return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setKb((k) => Math.min(list.length - 1, k + 1)); }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setKb((k) => Math.max(0, k - 1)); }
      if (e.key === "Enter" && list[kb]) router.push(`/tasks/${list[kb].id}`);
      if (e.key === "/") { e.preventDefault(); document.getElementById("task-search")?.focus(); }
      if ((e.key === "s" || e.key === "p") && list[kb]) {
        const field = e.key === "s" ? "status" : "prio";
        const anchor = document.querySelector(`tr.kb [data-edit=${field}]`);
        if (anchor) edit(anchor, field, list[kb]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [list, kb, view, router, edit]);

  const addFilter = (key) => (e) =>
    openPopover(e.currentTarget, { title: key === "status" ? "Status" : "Priority", items: key === "status" ? statusItems() : prioItems(), onPick: (v) => setFilters((f) => ({ ...f, [key]: v })) });

  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="page-head" style={{ marginBottom: 16 }}>
          <div><h1>{TITLES[scope]}</h1><p className="num">{list.length} tasks{scope === "team" ? " · SOC" : ""}</p></div>
          <div className="actions">
            <div className="seg" aria-label="View">
              <button className={view === "table" ? "on" : ""} onClick={() => setView("table")} aria-label="Table view"><Icon name="list" /></button>
              <button className={view === "board" ? "on" : ""} onClick={() => setView("board")} aria-label="Board view"><Icon name="board" /></button>
            </div>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" />Create Task<kbd style={{ borderColor: "rgba(255,255,255,.3)", color: "rgba(255,255,255,.8)" }}>C</kbd></button>
          </div>
        </div>
        <div className="toolbar">
          <div className="search"><Icon name="search" /><input id="task-search" className="input" placeholder="Filter by title or ID" value={q} onChange={(e) => { setQ(e.target.value); setKb(0); }} onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()} /></div>
          {active.map(([k, v]) => (
            <button key={k} className="chip active" onClick={() => setFilters((f) => ({ ...f, [k]: null }))} aria-label={`Remove ${k} filter`}>
              {k === "status" ? "Status" : "Priority"} is <b>{k === "status" ? STATUS[v] : PRIO[v]}</b><span className="x"><Icon name="x" /></span>
            </button>
          ))}
          {!filters.status && <button className="chip" onClick={addFilter("status")}><Icon name="plus" />Status</button>}
          {!filters.prio && <button className="chip" onClick={addFilter("prio")}><Icon name="plus" />Priority</button>}
          <button className="chip"><Icon name="plus" />Complexity</button>
          {scope !== "my" && <button className="chip"><Icon name="plus" />Assignee</button>}
          <button className="chip"><Icon name="cal" />Deadline</button>
          {(active.length > 0 || q) && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setFilters({ status: null, prio: null }); }}>Reset</button>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}><kbd>J</kbd> <kbd>K</kbd> navigate · <kbd>↵</kbd> open · <kbd>S</kbd> status</span>
            <button className="btn btn-ghost btn-sm"><Icon name="cols" />Columns</button>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        {view === "board" ? (
          <Board list={list} onOpen={(id) => router.push(`/tasks/${id}`)} />
        ) : (
          <TaskTable list={list} cols={cols} kb={kb} sort={sort} onSort={(k) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }))} />
        )}
      </div>
      {view === "table" && <div className="table-foot" style={{ padding: "10px 32px" }}><span className="num">{list.length ? `1–${list.length} of ${list.length}` : "0 results"}</span><span>Rows: 50</span></div>}
    </>
  );
}

function Board({ list, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(220px,1fr))", gap: 12, paddingTop: 12, paddingBottom: 24 }}>
      {["backlog", "todo", "progress", "review", "done"].map((s) => {
        const col = list.filter((t) => t.status === s);
        return (
          <div key={s} className="panel-2" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 4px 10px" }}><Status s={s} /><span className="muted num">{col.length}</span></div>
            {col.map((t) => (
              <div key={t.id} className="panel" onClick={() => onOpen(t.id)} style={{ padding: "10px 12px", marginBottom: 8, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
                <div className="mono muted">{t.id}</div>
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
