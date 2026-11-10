"use client";

import { useI18n as useTaskI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import TaskTable, { useInlineEdit } from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import { PageHeader } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { Avatar, Due, Priority, Status } from "@/components/ui/indicators";
import { PRIO, STATUS, TODAY, addDays, dueLabel, isOpen, plural } from "@/lib/format";
import { taskDate } from "@/lib/task-date";
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
  const { t: __taskTr, locale, team: teamText, number } = useTaskI18n();
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
  const createButton = (size) => <button type="button" className={`btn btn-primary ${size ?? ""}`} onClick={() => setCreateOpen(true)}><Icon name="plus" />{"" + __taskTr("Create task") + ""}{!size && <kbd>C</kbd>}</button>;

  let body;
  if (base.length === 0) {
    body = <EmptyState icon="inbox" title={__taskTr(v.empty[0])} action={canCreate ? createButton("btn-sm") : null}>{__taskTr(v.empty[1])}</EmptyState>;
  } else if (list.length === 0) {
    body = activeFilters
      ? <EmptyState icon="search" title={__taskTr("No tasks match these filters")} action={<button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>{"" + __taskTr("Reset filters") + ""}</button>}>{"" + __taskTr("Nothing in “") + ""}{__taskTr(TABS.find((x) => x[0] === tab)[1])}{"" + __taskTr("” matches. Try another search or clear the filters.") + ""}</EmptyState>
      : <EmptyState icon="checkCircle" title={__taskTr(tabEmpty)}>{tab === "open" ? __taskTr("Everything here is done or cancelled.") : __taskTr("Switch tabs to see other tasks.")}</EmptyState>;
  } else if (view === "board") {
    body = <Board list={list} />;
  } else if (isGrouped) {
    body = (
      <TaskTable cols={cols} sort={sort} onSort={onSort} groups={groups.map(([id, items]) => {
        const review = items.filter((t) => t.status === "review").length;
        const returned = items.filter((t) => t.status === "returned").length;
        const blocked = items.filter((t) => t.status === "blocked").length;
        const late = items.filter(overdue).length;
        const hours = items.reduce((s, t) => s + (t.hours || 0), 0);
        const person = peopleMap[id];
        return {
          key: id,
          items,
          label: (
            <span className="lane">
              <span className="lane-who">
                <Avatar id={id} size="md" />
                <span className="lane-name">{person?.name ?? "Unknown"}</span>
                {person?.team && <span className="lane-team">{teamText(person.team)}</span>}
              </span>
              <span className="lane-facts">
                <MixBar items={items} />
                <span className="lane-count">{locale === "fa" ? `${number(items.length)} تسک` : plural(items.length, "task")}</span>
                {review > 0 && <span className="badge violet">{locale === "fa" ? `${number(review)} در انتظار بازبینی` : `${review} in review`}</span>}
                {returned > 0 && <span className="badge warning">{locale === "fa" ? `${number(returned)} بازگشت‌خورده` : `${returned} returned`}</span>}
                {blocked > 0 && <span className="badge danger">{locale === "fa" ? `${number(blocked)} متوقف` : `${blocked} blocked`}</span>}
                {late > 0 && <span className="badge danger">{locale === "fa" ? `${number(late)} سررسید گذشته` : `${late} overdue`}</span>}
                {hours > 0 && <span className="lane-hours">{locale === "fa" ? `${number(hours, { maximumFractionDigits: 1 })} ساعت ثبت‌شده` : `${number(hours, { maximumFractionDigits: 1 })} h logged`}</span>}
              </span>
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
        title={__taskTr(v.title)}
        meta={[__taskTr(v.sub), locale === "fa" ? `${base.filter(isOpen).length} تسک باز` : plural(base.filter(isOpen).length, "open task")]}
        actions={
          <>
            <Segmented label={__taskTr("Layout")} iconOnly value={view} onChange={setView} options={[{ value: "table", icon: "list", ariaLabel: __taskTr("Table view") }, { value: "board", icon: "board", ariaLabel: __taskTr("Board view") }]} />
            {canCreate && createButton()}
          </>
        }
      />

      {base.length > 0 && (
        <>
          <Pipeline base={base} />
          <div className="tabs-row">
            <Segmented
              kind="tabs"
              className="seg-line"
              label={__taskTr("Task status")}
              value={tab}
              onChange={(k) => { setTab(k); setKb(0); }}
              options={TABS.filter(([k]) => k !== "review" || manager || scope === "my").map(([k, label, pred]) => {
                const count = base.filter(pred).length;
                return { value: k, label: __taskTr(label), count: number(count), tone: count > 0 ? TAB_TONE[k] : undefined };
              })}
            />
          </div>
          <div className="toolbar" role="search" aria-label={__taskTr("Filter tasks")}>
            <div className="search">
              <Icon name="search" />
              <input id="task-search" type="search" className="input" placeholder={__taskTr("Search title or ID")} aria-label={__taskTr("Search tasks by title or ID")} aria-keyshortcuts="/" value={q} onChange={(e) => { setQ(e.target.value); setKb(0); }} onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()} />
            </div>
            {scope !== "my" && (
              <select className={`input ${assignee ? "is-set" : ""}`} style={{ width: 190 }} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label={__taskTr("Assignee")}>
                <option value="">{"" + __taskTr("All assignees") + ""}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <select className={`input ${prio ? "is-set" : ""}`} style={{ width: 150 }} value={prio} onChange={(e) => setPrio(e.target.value)} aria-label={__taskTr("Priority")}>
              <option value="">{"" + __taskTr("Any priority") + ""}</option>
              {Object.entries(PRIO).map(([k, l]) => <option key={k} value={k}>{__taskTr(l)}</option>)}
            </select>
            {activeFilters > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}><Icon name="x" />{"" + __taskTr("Reset filters (") + ""}{activeFilters})</button>}
            <div className="end">
              <span className="result-count" aria-live="polite">{list.length === inTab.length ? (locale === "fa" ? `${list.length} تسک` : plural(list.length, "task")) : locale === "fa" ? `${list.length} از ${inTab.length} تسک` : `${list.length} of ${inTab.length} tasks`}</span>
              {scope !== "my" && view === "table" && (
                <label className="toggle-label">
                  <input type="checkbox" role="switch" className="switch" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />{"" + __taskTr("Group by assignee") + ""}</label>
              )}
            </div>
          </div>
        </>
      )}

      {view === "board" && list.length > 0 ? body : <div className="panel task-list">{body}</div>}
    </div>
  );
}

// Tabs whose count asks for action get a tint: review waits on a manager, attention is late or stuck work.
const TAB_TONE = { review: "violet", attention: "danger" };

// Status buckets in workflow order. Backlog sits with To Do; cancelled work is left out.
const BUCKETS = [
  ["todo", (t) => t.status === "todo" || t.status === "backlog"],
  ["progress", (t) => t.status === "progress"],
  ["review", (t) => t.status === "review"],
  ["returned", (t) => t.status === "returned"],
  ["blocked", (t) => t.status === "blocked"],
  ["done", (t) => t.status === "done"],
];
const bucketCounts = (items) => BUCKETS.map(([s, pred]) => [s, items.filter(pred).length]);

/** Proportional status bar. Decorative: the same counts are always written next to it. */
function MixBar({ items, className = "" }) {
  return (
    <span className={`mix-bar ${className}`} aria-hidden="true">
      {bucketCounts(items).map(([s, n]) => n > 0 && <span key={s} data-s={s} style={{ flexGrow: n }} />)}
    </span>
  );
}

/**
 * Where the work in this view sits: the main flow (To Do → In Progress → Review → Done) on the left,
 * the exceptions that need a manager (returned, blocked, overdue) on the right, and one bar for the mix.
 */
function Pipeline({ base }) {
  const { t: __taskTr, locale, number } = useTaskI18n();
  const live = base.filter((t) => t.status !== "cancelled");
  const counts = Object.fromEntries(bucketCounts(live));
  const late = base.filter(overdue).length;
  const flags = [
    ["returned", counts.returned, locale === "fa" ? "بازگشت‌خورده" : "returned", "warning"],
    ["blocked", counts.blocked, locale === "fa" ? "متوقف" : "blocked", "danger"],
    ["overdue", late, locale === "fa" ? "سررسید گذشته" : "overdue", "danger"],
  ].filter(([, n]) => n > 0);
  return (
    <section className="pipeline" aria-label={__taskTr("Workflow overview")}>
      <ol className="pipeline-flow">
        {["todo", "progress", "review", "done"].map((s) => (
          <li key={s} data-s={s} data-empty={counts[s] === 0 ? "" : undefined}>
            <b className="num">{number(counts[s])}</b>
            <Status s={s} />
          </li>
        ))}
      </ol>
      <div className="pipeline-flags">
        {flags.length === 0
          ? <span className="pipeline-clear"><Icon name="checkCircle" size="sm" />{locale === "fa" ? "مورد معوق یا متوقفی نیست" : "Nothing late or stuck"}</span>
          : flags.map(([k, n, label, tone]) => <span key={k} className={`badge dot ${tone}`}>{number(n)} {label}</span>)}
      </div>
      <MixBar items={live} className="lg" />
    </section>
  );
}

const COLUMNS = ["todo", "progress", "review", "returned", "done"];

function Board({ list }) {
  const { t: __taskTr, locale } = useTaskI18n();
  return (
    <div className="board">
      {COLUMNS.map((s) => {
        const col = list.filter((t) => t.status === s || (s === "todo" && t.status === "backlog") || (s === "progress" && t.status === "blocked"));
        return (
          <section key={s} className="board-col" data-s={s} aria-label={`${__taskTr(STATUS[s])}: ${col.length}`}>
            <div className="board-col-head"><Status s={s} /><span className="board-count num">{col.length}</span></div>
            {col.length === 0 && <div className="board-empty">{"" + __taskTr("No tasks") + ""}</div>}
            {col.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="board-card" data-s={t.status} data-overdue={isOpen(t) && t.due !== "—" && t.due < TODAY ? "" : undefined}>
                <div className="board-card-top">
                  <span className="mono muted">{t.id}</span>
                  {t.status === "blocked" && <Status s="blocked" />}
                  {t.status === "backlog" && <span className="badge">{"" + __taskTr("Backlog") + ""}</span>}
                  <Avatar id={t.a} size="sm" label />
                </div>
                <div className="t">{t.title}</div>
                <div className="meta">
                  <Priority p={t.prio} />
                  {t.due !== "—" && isOpen(t) && <span className={`due ${t.due < TODAY ? "overdue" : "muted"}`}><Due task={t} /></span>}
                </div>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
