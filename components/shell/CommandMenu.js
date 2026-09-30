"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import useFocusTrap from "@/components/useFocusTrap";
import Icon from "@/components/ui/Icon";
import { Avatar, Status } from "@/components/ui/indicators";
import { pagesFor } from "@/components/shell/nav";
import { inTeamScope, isManager } from "@/lib/roles";

const norm = (s) => s.toLowerCase();

/**
 * ⌘K: search tasks (by ID or title) within the viewer's scope, people (managers), and pages;
 * plus the Create task action. ↑/↓ move, Enter opens, Esc closes.
 */
export default function CommandMenu({ onClose }) {
  const { me, tasks, members, peopleMap, setCreateOpen } = useApp();
  const router = useRouter();
  const ref = useFocusTrap(onClose);
  const listId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const manager = isManager(me);

  const groups = useMemo(() => {
    const term = norm(q.trim());
    const match = (s) => !term || norm(s).includes(term);
    const out = [];
    const actions = [{ key: "create", label: "Create task", icon: "plus", hint: "C", run: () => setCreateOpen(true) }].filter((a) => match(a.label));
    if (actions.length) out.push(["Actions", actions]);
    if (term) {
      const visible = tasks.filter((t) => t.a === me.id || t.createdBy === me.id || inTeamScope(me, peopleMap[t.a]));
      const found = visible.filter((t) => match(`${t.id} ${t.title}`)).slice(0, 8);
      if (found.length) {
        out.push(["Tasks", found.map((t) => ({
          key: t.id,
          label: <><span className="mono muted">{t.id}</span><span className="title">{t.title}</span></>,
          hint: <Status s={t.status} />,
          run: () => router.push(`/tasks/${t.id}`),
        }))]);
      }
      if (manager) {
        const people = members.filter((p) => p.role !== "security_manager" && match(p.name)).slice(0, 5);
        if (people.length) out.push(["People", people.map((p) => ({ key: p.id, label: <span className="title">{p.name}</span>, lead: <Avatar id={p.id} size="sm" />, hint: p.team, run: () => router.push(`/performance/employees/${p.id}`) }))]);
      }
    }
    const pages = pagesFor(me).filter((p) => match(p.label)).slice(0, term ? 6 : 20);
    if (pages.length) out.push(["Go to", pages.map((p) => ({ key: p.href, label: <span className="title">{p.label}</span>, icon: p.icon, run: () => router.push(p.href) }))]);
    return out;
  }, [q, tasks, me, peopleMap, members, manager, router, setCreateOpen]);

  const flat = groups.flatMap(([, items]) => items);
  const current = Math.min(active, Math.max(0, flat.length - 1));
  const run = (item) => { onClose(); item.run(); };
  const optionId = (i) => `${listId}-${i}`;

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((current + 1) % Math.max(1, flat.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((current - 1 + flat.length) % Math.max(1, flat.length)); }
    else if (e.key === "Enter" && flat[current]) { e.preventDefault(); run(flat[current]); }
  };
  // Keep the highlighted option in view.
  const scrollIntoView = (el) => el?.scrollIntoView({ block: "nearest" });

  let i = -1;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal cmd" role="dialog" aria-modal="true" aria-label="Search and commands">
        <div className="cmd-input">
          <Icon name="search" />
          <input
            autoFocus
            data-autofocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat.length ? optionId(current) : undefined}
            aria-autocomplete="list"
            aria-label="Search tasks, people and pages"
            placeholder={manager ? "Search tasks, people and pages…" : "Search tasks and pages…"}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmd-list" id={listId} role="listbox" aria-label="Results">
          {flat.length === 0 && (
            <div className="empty compact"><h3>No matches for “{q.trim()}”</h3><p>Try a task ID such as T-1001, part of a title, or a page name.</p></div>
          )}
          {groups.map(([name, items]) => (
            <div key={name} role="group" aria-label={name}>
              <div className="cmd-group" aria-hidden="true">{name}</div>
              {items.map((it) => {
                const idx = ++i;
                const sel = idx === current;
                return (
                  <div
                    key={it.key}
                    id={optionId(idx)}
                    ref={sel ? scrollIntoView : undefined}
                    role="option"
                    aria-selected={sel}
                    className="cmd-item"
                    onMouseMove={() => idx !== current && setActive(idx)}
                    onClick={() => run(it)}
                  >
                    {it.lead ?? (it.icon && <Icon name={it.icon} />)}
                    {it.label}
                    {it.hint && <span className="hint">{typeof it.hint === "string" && it.hint.length === 1 ? <kbd>{it.hint}</kbd> : it.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmd-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd>Navigate</span>
          <span><kbd>↵</kbd>Open</span>
          <span><kbd>Esc</kbd>Close</span>
        </div>
      </div>
    </div>
  );
}
