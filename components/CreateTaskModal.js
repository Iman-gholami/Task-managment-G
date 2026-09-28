"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { Complexity, Priority, Who } from "@/components/ui/indicators";
import { cxItems, peopleItems, prioItems } from "@/components/ui/menus";

const blank = { title: "", description: "", prio: "normal", cx: 2, due: "" };

export default function CreateTaskModal() {
  const { createOpen, setCreateOpen } = useApp();
  if (!createOpen) return null;
  return <CreateTaskDialog onClose={() => setCreateOpen(false)} />;
}

function CreateTaskDialog({ onClose }) {
  const { addTask, toast, openPopover, me, users, peopleMap } = useApp();
  const manager = me.role === "soc_manager" || me.role === "security_manager";
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
      toast(e.message);
      return;
    } finally {
      setBusy(false);
    }
    toast(`Task ${task.id} created and assigned to ${peopleMap[form.a].name}`);
    if (another) {
      setForm({ ...blank, a: form.a });
      titleRef.current?.focus();
    } else onClose();
  };

  const people = users.filter((u) => u.active !== false && u.id !== me.id).concat(users.filter((u) => u.id === me.id));

  return (
    <Dialog label="Create task" onClose={onClose} width={640} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}>
      <div className="modal-body">
        <div className="eyebrow" style={{ marginBottom: "var(--s-4)" }}>New task{form.a ? ` · ${peopleMap[form.a]?.team}` : ""}</div>
        <label htmlFor="task-title" className="sr-only">Title</label>
        <input id="task-title" ref={titleRef} className="title-input" placeholder="Task title" value={form.title} onChange={(e) => { set({ title: e.target.value }); setError(null); }} aria-invalid={error === "title"} aria-describedby={error === "title" ? "task-title-error" : undefined} maxLength={200} />
        {error === "title" && <div id="task-title-error" className="field-error" style={{ marginTop: "var(--s-1)" }}>Add a title to create the task.</div>}
        <label htmlFor="task-desc" className="sr-only">Description</label>
        <textarea id="task-desc" className="desc-input" placeholder="Add a description (optional)" value={form.description} onChange={(e) => set({ description: e.target.value })} />

        <div className="prop-row" role="group" aria-label="Task details">
          <button type="button" className="prop" disabled={!manager} title={manager ? "Assignee" : "Analysts create tasks for themselves"}
            onClick={(e) => openPopover(e.currentTarget, { title: "Assign to", items: peopleItems(people), onPick: (a) => { set({ a }); setError(null); }, width: 320 })}
            style={error === "assignee" ? { boxShadow: "inset 0 0 0 1px var(--danger)" } : undefined}>
            {form.a ? <Who id={form.a} /> : <><Icon name="user" />Assign to…</>}
          </button>
          <button type="button" className="prop" title="Priority" onClick={(e) => openPopover(e.currentTarget, { title: "Priority", items: prioItems(), onPick: (prio) => set({ prio }) })}><Priority p={form.prio} /></button>
          <button type="button" className="prop" title="Complexity" onClick={(e) => openPopover(e.currentTarget, { title: "Complexity", items: cxItems(), onPick: (cx) => set({ cx }) })}><Complexity c={form.cx} /></button>
          <label className="prop"><Icon name="cal" /><span className="sr-only">Deadline</span>
            <input type="date" value={form.due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ due: e.target.value })} style={{ border: 0, background: "none", color: "inherit", font: "inherit", colorScheme: "inherit" }} aria-label="Deadline" />
          </label>
        </div>
        {error === "assignee" && <div className="field-error" style={{ marginTop: "var(--s-3)" }} role="alert">Choose who this task is for.</div>}
        <p className="muted" style={{ fontSize: "var(--fs-13)", marginTop: "var(--s-5)" }}>Checklist items, files and comments can be added on the task page after it&apos;s created.</p>
      </div>
      <div className="modal-foot">
        <label className="sec" style={{ fontSize: "var(--fs-13)", display: "flex", gap: "var(--s-2)", alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" className="switch" checked={another} onChange={(e) => setAnother(e.target.checked)} />Create another
        </label>
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy} aria-busy={busy}>Create Task <kbd>⌘↵</kbd></button>
      </div>
    </Dialog>
  );
}
