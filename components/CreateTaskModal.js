"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { FieldError } from "@/components/ui/Field";
import { Complexity, Priority, Who } from "@/components/ui/indicators";
import { cxItems, peopleItems, prioItems } from "@/components/ui/menus";
import { TODAY } from "@/lib/format";
import { isManager } from "@/lib/roles";

const blank = { title: "", description: "", prio: "normal", cx: 2, due: "" };

export default function CreateTaskModal() {
  const { createOpen, setCreateOpen } = useApp();
  if (!createOpen) return null;
  return <CreateTaskDialog onClose={() => setCreateOpen(false)} />;
}

function CreateTaskDialog({ onClose }) {
  const { addTask, toast, openPopover, me, users, peopleMap } = useApp();
  const manager = isManager(me);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...blank, a: manager ? "" : me.id });
  const [another, setAnother] = useState(false);
  const [error, setError] = useState(null); // "title" | "assignee" | null
  const titleRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => { titleRef.current?.focus(); }, []);

  const submit = async () => {
    if (!form.title.trim()) {
      setError("title");
      titleRef.current?.focus();
      return;
    }
    if (!form.a) return setError("assignee");
    if (busy) return;
    setBusy(true);
    let task;
    try {
      task = await addTask({ title: form.title.trim(), description: form.description, a: form.a, prio: form.prio, cx: form.cx, due: form.due });
    } catch (e) {
      toast(e.message, "error");
      return;
    } finally {
      setBusy(false);
    }
    toast(`${task.id} created and assigned to ${peopleMap[form.a].name}`);
    if (another) {
      setForm({ ...blank, a: form.a });
      titleRef.current?.focus();
    } else onClose();
  };

  const people = users.filter((u) => u.active !== false && u.id !== me.id).concat(users.filter((u) => u.id === me.id));
  const dirty = form.title.trim() || form.description.trim();

  return (
    <Dialog label="Create task" onClose={onClose} width={640} dismissible={!dirty} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}>
      <div className="modal-body" style={{ paddingTop: "var(--s-5)" }}>
        <div className="eyebrow" style={{ marginBottom: "var(--s-3)" }}>New task{form.a ? ` · ${peopleMap[form.a]?.team}` : ""}</div>
        <label htmlFor="task-title" className="sr-only">Title</label>
        <input id="task-title" ref={titleRef} className="title-input" placeholder="Task title" value={form.title} onChange={(e) => { set({ title: e.target.value }); setError(null); }} aria-invalid={error === "title"} aria-describedby={error === "title" ? "task-title-error" : undefined} maxLength={200} autoComplete="off" />
        {error === "title" && <div style={{ marginTop: "var(--s-1)" }}><FieldError id="task-title-error">Add a title to create the task.</FieldError></div>}
        <label htmlFor="task-desc" className="sr-only">Description</label>
        <textarea id="task-desc" className="desc-input" placeholder="Add a description (optional)" value={form.description} onChange={(e) => set({ description: e.target.value })} />

        <div className="prop-row" role="group" aria-label="Task details">
          <button type="button" className="prop" disabled={!manager} aria-invalid={error === "assignee" || undefined} data-tooltip={manager ? "Assignee" : "You can create tasks for yourself"}
            onClick={(e) => openPopover(e.currentTarget, { title: "Assign to", items: peopleItems(people), onPick: (a) => { set({ a }); setError(null); }, width: 320 })}>
            {form.a ? <Who id={form.a} size="sm" /> : <><Icon name="user" />Assign to…</>}
          </button>
          <button type="button" className="prop" aria-label={`Priority: ${form.prio}`} data-tooltip="Priority" onClick={(e) => openPopover(e.currentTarget, { title: "Priority", items: prioItems(), onPick: (prio) => set({ prio }) })}><Priority p={form.prio} /></button>
          <button type="button" className="prop" aria-label="Complexity" data-tooltip="Complexity" onClick={(e) => openPopover(e.currentTarget, { title: "Complexity", items: cxItems(), onPick: (cx) => set({ cx }) })}><Complexity c={form.cx} /></button>
          <label className="prop" data-tooltip="Deadline (optional)"><Icon name="cal" />
            <input type="date" value={form.due} min={TODAY} onChange={(e) => set({ due: e.target.value })} aria-label="Deadline" />
          </label>
        </div>
        {error === "assignee" && <div style={{ marginTop: "var(--s-3)" }} role="alert"><FieldError>Choose who this task is for.</FieldError></div>}
        <p className="muted small" style={{ marginTop: "var(--s-5)" }}>Checklist items, files and comments can be added on the task page after it&apos;s created.</p>
      </div>
      <div className="modal-foot">
        <label className="toggle-label lead">
          <input type="checkbox" role="switch" className="switch" checked={another} onChange={(e) => setAnother(e.target.checked)} />Create another
        </label>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy} aria-busy={busy}>Create task <kbd>⌘↵</kbd></button>
      </div>
    </Dialog>
  );
}
