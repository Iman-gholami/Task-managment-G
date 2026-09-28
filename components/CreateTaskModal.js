"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Complexity, Priority, Who } from "@/components/ui/indicators";
import { cxItems, peopleItems, prioItems } from "@/components/ui/menus";
import { P } from "@/lib/data";

const blank = { title: "", description: "", a: "sr", prio: "normal", cx: 2, review: true, due: "" };

export default function CreateTaskModal() {
  const { createOpen, setCreateOpen, addTask, toast, openPopover } = useApp();
  const [form, setForm] = useState(blank);
  const [advanced, setAdvanced] = useState(false);
  const [another, setAnother] = useState(false);
  const [error, setError] = useState(false);
  const titleRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!createOpen) return;
    setForm(blank);
    setError(false);
    setAdvanced(false);
    setTimeout(() => titleRef.current?.focus());
  }, [createOpen]);

  if (!createOpen) return null;
  const close = () => setCreateOpen(false);

  const submit = () => {
    if (!form.title.trim()) {
      setError(true);
      titleRef.current?.focus();
      return;
    }
    const task = addTask({ title: form.title.trim(), a: form.a, prio: form.prio, cx: form.cx, due: form.due || "—" });
    toast(`Task ${task.id} created and assigned to ${P[form.a].name}`);
    if (another) {
      setForm({ ...blank, a: form.a });
      titleRef.current?.focus();
    } else close();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" && !document.querySelector(".pop")) close();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && close()} onKeyDown={onKeyDown}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Create task">
        <div className="modal-body">
          <div className="crumbs" style={{ marginBottom: 12 }}>
            <span className="badge">{P[form.a].team}</span><Icon name="chev" /><b>New task</b>
          </div>
          <input ref={titleRef} className="title-input" placeholder="Task title" value={form.title} onChange={(e) => { set({ title: e.target.value }); setError(false); }} aria-invalid={error} />
          {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 2 }}>Add a title to create the task.</div>}
          <textarea className="desc-input" placeholder="Add description…" value={form.description} onChange={(e) => set({ description: e.target.value })} />
          <div className="prop-row">
            <button className="prop" onClick={(e) => openPopover(e.currentTarget, { title: "Assignee", items: peopleItems(), onPick: (a) => set({ a }), width: 320 })}><Who id={form.a} /></button>
            <button className="prop" onClick={(e) => openPopover(e.currentTarget, { title: "Priority", items: prioItems(), onPick: (prio) => set({ prio }) })}><Priority p={form.prio} /></button>
            <button className="prop" onClick={(e) => openPopover(e.currentTarget, { title: "Complexity", items: cxItems(), onPick: (cx) => set({ cx }) })}><Complexity c={form.cx} /></button>
            <span className="prop"><Icon name="cal" />Start: Today</span>
            <label className="prop"><Icon name="flag" />Deadline<input type="date" value={form.due} onChange={(e) => set({ due: e.target.value })} style={{ border: 0, background: "none", colorScheme: "inherit", fontSize: 12 }} aria-label="Deadline" /></label>
            <label className="prop"><input type="checkbox" className="switch" checked={form.review} onChange={(e) => set({ review: e.target.checked })} />Review required</label>
          </div>
          <button className="disclose" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
            <Icon name={advanced ? "down" : "chev"} />Checklist, attachments, external reference
          </button>
          {advanced && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="field"><label>Checklist</label><input className="input" placeholder="Add first item and press Enter" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="field"><label>External reference</label><input className="input mono" placeholder="e.g. splunk/search/88213" /></div>
                <div className="field"><label>Attachments</label><button className="btn btn-secondary"><Icon name="clip" />Attach files</button></div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <label className="sec" style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" className="switch" checked={another} onChange={(e) => setAnother(e.target.checked)} />Create another
          </label>
          <span style={{ marginLeft: "auto" }} className="muted"><kbd>Esc</kbd></span>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Create Task <kbd style={{ borderColor: "rgba(255,255,255,.3)", color: "rgba(255,255,255,.8)" }}>⌘↵</kbd></button>
        </div>
      </div>
    </div>
  );
}
