"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { CX, PRIO, TODAY } from "@/lib/format";
import { isManager } from "@/lib/roles";

const blank = { title: "", description: "", prio: "normal", cx: 2, start: TODAY, due: "" };

export default function CreateTaskModal() {
  const { createOpen, setCreateOpen } = useApp();
  if (!createOpen) return null;
  return <CreateTaskDialog onClose={() => setCreateOpen(false)} />;
}

function CreateTaskDialog({ onClose }) {
  const { addTask, toast, me, users, peopleMap } = useApp();
  const manager = isManager(me);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...blank, a: manager ? "" : me.id });
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
    try {
      const task = await addTask({
        title: form.title.trim(),
        description: form.description.trim(),
        a: form.a,
        prio: form.prio,
        cx: form.cx,
        start: form.start,
        due: form.due,
      });
      toast(`${task.id} created and assigned to ${peopleMap[form.a].name}`);
      onClose();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const people = users
    .filter((u) => u.active !== false && u.id !== me.id)
    .concat(users.filter((u) => u.id === me.id));
  const dirty = form.title.trim() || form.description.trim() || form.due || form.start !== TODAY;

  return (
    <>
      <Dialog
        label="Create task"
        onClose={onClose}
        width={680}
        className="create-task-v2"
        dismissible={!dirty}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
      >
        <div className="create-task-v2__head">
          <div>
            <div className="create-task-v2__eyebrow">Task management</div>
            <h2>Create a task</h2>
          </div>
        </div>

        <div className="create-task-v2__body">
          <Field
            label="Task title"
            htmlFor="task-title"
            error={error === "title" ? "Add a title to create the task." : undefined}
          >
            <input
              id="task-title"
              ref={titleRef}
              className="input input-lg"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={(e) => { set({ title: e.target.value }); setError(null); }}
              maxLength={200}
              autoComplete="off"
            />
          </Field>

          <Field label="Description" htmlFor="task-description">
            <textarea
              id="task-description"
              className="textarea create-task-v2__description"
              placeholder="Give your team the context they need..."
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>

          <div className="create-task-v2__grid">
            <Field
              label="Assignee"
              htmlFor="task-assignee"
              error={error === "assignee" ? "Choose who this task is for." : undefined}
            >
              <select
                id="task-assignee"
                className="input"
                value={form.a}
                disabled={!manager}
                onChange={(e) => { set({ a: e.target.value }); setError(null); }}
              >
                {manager && <option value="">Select assignee</option>}
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name} · {person.team}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority" htmlFor="task-priority">
              <select id="task-priority" className="input" value={form.prio} onChange={(e) => set({ prio: e.target.value })}>
                {Object.entries(PRIO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>

            <Field label="Complexity" htmlFor="task-complexity">
              <select id="task-complexity" className="input" value={form.cx} onChange={(e) => set({ cx: Number(e.target.value) })}>
                {CX.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </Field>

            <Field label="Start date" htmlFor="task-start" hint="Defaults to today. Choose another date if this task is planned to start later.">
              <input
                id="task-start"
                className="input"
                type="date"
                value={form.start}
                onChange={(e) => {
                  const start = e.target.value;
                  set({ start, ...(form.due && start && form.due < start ? { due: "" } : {}) });
                }}
              />
            </Field>

            <Field label="Deadline" htmlFor="task-deadline">
              <input
                id="task-deadline"
                className="input"
                type="date"
                min={form.start || TODAY}
                value={form.due}
                onChange={(e) => set({ due: e.target.value })}
              />
            </Field>

            <div className="create-task-v2__review">
              <label>
                <input type="checkbox" className="cb" checked disabled readOnly />
                <span>
                  <b>Manager review required</b>
                  <small>Tasks must pass Review before they can be approved as Done.</small>
                </span>
              </label>
            </div>
          </div>

          <details className="create-task-v2__details">
            <summary>
              <span>Additional details</span>
              <small>Checklist &amp; references</small>
            </summary>
            <div>
              Checklist items, file attachments, references and comments can be added on the task page after the task is created.
            </div>
          </details>
        </div>

        <div className="create-task-v2__foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy} aria-busy={busy}>
            Create task <Icon name="arrowRight" />
          </button>
        </div>
      </Dialog>

      <style>{`
        .create-task-v2 {
          overflow: hidden;
          border-color: var(--border-strong);
          background: var(--surface-raised);
        }
        .create-task-v2 .modal-close {
          top: 16px;
          right: 18px;
          width: 42px;
          height: 42px;
          border: 1px solid color-mix(in oklab, var(--primary) 72%, var(--border-strong));
          border-radius: 12px;
          background: var(--surface-card);
          color: var(--text-2);
          box-shadow: 0 0 0 2px var(--primary-soft);
        }
        .create-task-v2 .modal-close:hover {
          background: var(--primary-soft);
          color: var(--text);
        }
        .create-task-v2__head {
          min-height: 82px;
          display: flex;
          align-items: center;
          padding: 14px 78px 14px 22px;
          border-bottom: 1px solid var(--divider);
        }
        .create-task-v2__eyebrow {
          margin-bottom: 7px;
          color: var(--text-3);
          font: var(--type-overline);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
        }
        .create-task-v2__head h2 {
          margin: 0;
          color: var(--text);
          font: var(--fw-semibold) var(--fs-22)/1.2 var(--font-sans);
          letter-spacing: var(--tracking-title);
        }
        .create-task-v2__body {
          display: grid;
          gap: 18px;
          padding: 22px;
        }
        .create-task-v2__description {
          min-height: 86px;
        }
        .create-task-v2__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 18px;
          align-items: start;
        }
        .create-task-v2__grid .input,
        .create-task-v2__body > .field .input,
        .create-task-v2__body > .field .textarea {
          border-color: var(--border-strong);
          background: var(--surface-input);
        }
        .create-task-v2__grid .input {
          height: 38px;
        }
        .create-task-v2__review {
          min-height: 62px;
          display: flex;
          align-items: center;
        }
        .create-task-v2__review label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: default;
          color: var(--text-2);
        }
        .create-task-v2__review .cb {
          margin-top: 2px;
          opacity: 1;
        }
        .create-task-v2__review b {
          display: block;
          margin-bottom: 3px;
          color: var(--text-2);
          font-size: var(--fs-13);
          font-weight: var(--fw-medium);
        }
        .create-task-v2__review small {
          display: block;
          color: var(--text-3);
          font-size: var(--fs-12);
          line-height: 1.4;
        }
        .create-task-v2__details {
          border-top: 1px solid var(--divider);
          padding-top: 14px;
        }
        .create-task-v2__details summary {
          display: flex;
          align-items: center;
          gap: 18px;
          min-height: 28px;
          color: var(--text-2);
          cursor: pointer;
          user-select: none;
          list-style: none;
        }
        .create-task-v2__details summary::-webkit-details-marker { display: none; }
        .create-task-v2__details summary::before {
          content: "›";
          display: inline-block;
          color: var(--text-3);
          transform: rotate(0deg);
          transition: transform var(--t-fast);
        }
        .create-task-v2__details[open] summary::before { transform: rotate(90deg); }
        .create-task-v2__details summary span {
          font-size: var(--fs-13);
        }
        .create-task-v2__details summary small {
          color: var(--text-3);
          font-size: var(--fs-12);
        }
        .create-task-v2__details > div {
          margin: 10px 0 0 20px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-inset);
          color: var(--text-3);
          font-size: var(--fs-12);
          line-height: 1.55;
        }
        .create-task-v2__foot {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          padding: 16px 22px;
          border-top: 1px solid var(--divider);
          background: var(--surface-inset);
        }
        .create-task-v2__foot .btn-primary {
          min-width: 122px;
        }
        .create-task-v2__foot .btn-primary svg {
          width: 15px;
          height: 15px;
        }
        @media (max-width: 639px) {
          .create-task-v2__head { padding-left: 18px; }
          .create-task-v2__body { padding: 18px; }
          .create-task-v2__grid { grid-template-columns: 1fr; }
          .create-task-v2__foot { padding: 14px 18px; }
          .create-task-v2__foot .btn { flex: initial; }
        }
      `}</style>
    </>
  );
}
