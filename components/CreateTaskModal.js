"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { Field, FormAlert } from "@/components/ui/Field";
import AssigneePicker from "@/components/ui/AssigneePicker";
import { CX, PRIO, TODAY } from "@/lib/format";
import { canAssignTask, isManager } from "@/lib/roles";
import { MAX_UPLOAD, MAX_TASK_FILES, MAX_TASK_UPLOAD_TOTAL } from "@/lib/task-upload";
import styles from "./CreateTaskModal.module.css";

const blank = { title: "", description: "", prio: "normal", cx: 2, start: TODAY, due: "", reviewRequired: true };
const size = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

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
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [preview, setPreview] = useState(false);
  const titleRef = useRef(null);
  const fileRef = useRef(null);
  const fileSequence = useRef(0);
  const keepRef = useRef(null);
  const previewRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = !!(form.title.trim() || form.description.trim() || form.due || form.start !== TODAY ||
    form.prio !== blank.prio || form.cx !== blank.cx || !form.reviewRequired || (manager && form.a) || files.length);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => { if (confirmDiscard) keepRef.current?.focus(); }, [confirmDiscard]);
  useEffect(() => { if (preview) previewRef.current?.focus(); }, [preview]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const addFiles = (incoming) => {
    const next = Array.from(incoming || []);
    if (!next.length) return;
    if (files.length + next.length > MAX_TASK_FILES) {
      setFileError(`Add up to ${MAX_TASK_FILES} files when creating a task.`);
      return;
    }
    if (next.some((file) => !file.size || file.size > MAX_UPLOAD)) {
      setFileError("Each file must be non-empty and no larger than 20 MB.");
      return;
    }
    if ([...files.map((item) => item.file), ...next].reduce((sum, file) => sum + file.size, 0) > MAX_TASK_UPLOAD_TOTAL) {
      setFileError("Selected files must be 40 MB or less in total.");
      return;
    }
    setFileError("");
    setFiles((current) => [...current, ...next.map((file) => ({ key: ++fileSequence.current, file }))]);
  };

  const validate = () => {
    if (!form.title.trim()) { setError("title"); titleRef.current?.focus(); return; }
    if (!form.a) { setError("assignee"); document.getElementById("task-assignee")?.focus(); return false; }
    return !fileError;
  };

  const submit = async () => {
    if (busy || confirmDiscard) return;
    if (!preview) { if (validate()) setPreview(true); return; }
    setBusy(true);
    setSubmitError("");
    try {
      const payload = {
        title: form.title.trim(), description: form.description.trim(), a: form.a,
        prio: form.prio, cx: form.cx, reviewRequired: manager ? form.reviewRequired : true,
        start: form.start, due: form.due,
      };
      const body = new FormData();
      body.append("task", JSON.stringify(payload));
      files.forEach(({ file }) => body.append("files", file));
      const task = await addTask(body);
      toast(`${task.id} created and assigned to ${peopleMap[form.a]?.name ?? "the assignee"}`);
      onClose();
    } catch (e) {
      setSubmitError(e.message || "The task could not be created. Try again.");
    } finally { setBusy(false); }
  };

  const people = users.filter((u) => u.active !== false && canAssignTask(me, u));

  return (
    <Dialog label="Create task" onClose={requestClose} width={940} className={styles.dialog} dismissible={!dirty && !busy}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <header className={styles.header}>
          <span className={styles.headerIcon}><Icon name="tasks" /></span>
          <div><span className={styles.eyebrow}>Task workspace</span><h2>{preview ? "Confirm task details" : "Create a task"}</h2><p>{preview ? "Check the details before assigning this task." : "Give the assignee everything they need before work begins."}</p></div>
        </header>

        {!preview && <fieldset className={styles.layout} disabled={busy} aria-label="Task details and settings">
          <div className={styles.main}>
            <div className={styles.sectionTitle}><strong>Task details</strong><span>What needs to be done?</span></div>
            <Field label="Task title" htmlFor="task-title" error={error === "title" ? "Add a title to create the task." : undefined}>
              <input id="task-title" ref={titleRef} className="input input-lg" dir="auto" placeholder="Give this task a clear title" value={form.title}
                onChange={(e) => { set({ title: e.target.value }); setError(null); }} maxLength={200} autoComplete="off" />
            </Field>
            <Field label="Description" htmlFor="task-description">
              <textarea id="task-description" className={`textarea ${styles.description}`} dir="auto" placeholder="Add context, the expected outcome, and anything the assignee should know."
                value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>

            <div className={styles.attachments}>
              <div className={styles.sectionTitle}><strong>Attachments</strong><span>{files.length ? `${files.length} selected` : "Optional"}</span></div>
              <input ref={fileRef} type="file" multiple hidden aria-label="Files for new task" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" className={`${styles.dropzone} ${dragOver ? styles.over : ""}`} onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}>
                <span className={styles.fileIcon}><Icon name="clip" /></span>
                <span><b>Choose files or drop them here</b><small>Up to {MAX_TASK_FILES} files · 20 MB each · 40 MB total</small></span>
              </button>
              {fileError && <p className={styles.fileError} role="alert">{fileError} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFileError("")}>Dismiss</button></p>}
              {files.length > 0 && <ul className={styles.fileList} aria-label="Selected files">
                {files.map(({ key, file }) => <li key={key}><Icon name="sheet" /><span><b>{file.name}</b><small>{size(file.size)}</small></span>
                  <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={`Remove ${file.name}`} onClick={() => { setFiles((current) => current.filter((item) => item.key !== key)); setFileError(""); }}><Icon name="x" /></button></li>)}
              </ul>}
            </div>
          </div>

          <aside className={styles.settings} aria-label="Task settings">
            <div className={styles.sectionTitle}><strong>Assignment</strong><span>Who and when</span></div>
            <Field label="Assignee" htmlFor="task-assignee" error={error === "assignee" ? "Choose who this task is for." : undefined}>
              <AssigneePicker id="task-assignee" value={form.a} people={people} disabled={!manager}
                onSelect={(id) => { set({ a: id }); setError(null); }} onClear={() => { set({ a: "" }); setError(null); }} />
            </Field>
            <div className={styles.settingsGrid}>
              <Field label="Priority" htmlFor="task-priority"><select id="task-priority" className="input" value={form.prio} onChange={(e) => set({ prio: e.target.value })}>{Object.entries(PRIO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Complexity" htmlFor="task-complexity"><select id="task-complexity" className="input" value={form.cx} onChange={(e) => set({ cx: Number(e.target.value) })}>{CX.slice(1).map((label, i) => <option key={label} value={i + 1}>{label}</option>)}</select></Field>
              <Field label="Start date" htmlFor="task-start"><input id="task-start" className="input" type="date" value={form.start} onChange={(e) => { const start = e.target.value; set({ start, ...(form.due && start && form.due < start ? { due: "" } : {}) }); }} /></Field>
              <Field label="Deadline" htmlFor="task-deadline"><input id="task-deadline" className="input" type="date" min={form.start || TODAY} value={form.due} onChange={(e) => set({ due: e.target.value })} /></Field>
            </div>
            <label className={styles.review}>
              <input type="checkbox" className="cb" checked={manager ? form.reviewRequired : true} disabled={!manager}
                onChange={(e) => set({ reviewRequired: e.target.checked })} aria-label="Manager review required" />
              <span><b>Manager review required</b><small>{manager ? "Turn off to let the assignee complete the task without review." : "A manager will review this task before completion."}</small></span>
            </label>
          </aside>
        </fieldset>}

        {preview && <section className={styles.preview} aria-label="Task preview">
          <div className={styles.previewHeading} tabIndex={-1} ref={previewRef}>
            <span className={styles.headerIcon}><Icon name="review" /></span>
            <span><strong>Ready to assign?</strong><small>The task and its files will become visible after you create it.</small></span>
          </div>
          <div className={styles.previewGrid}>
            <div className={styles.previewBrief}>
              <span className={styles.eyebrow}>Task</span>
              <h3 dir="auto">{form.title.trim()}</h3>
              <p dir="auto">{form.description.trim() || "No description added."}</p>
            </div>
            <dl className={styles.previewFacts}>
              <div><dt>Assignee</dt><dd dir="auto">{peopleMap[form.a]?.name ?? "—"}</dd></div>
              <div><dt>Priority</dt><dd>{PRIO[form.prio]}</dd></div>
              <div><dt>Complexity</dt><dd>{CX[form.cx]}</dd></div>
              <div><dt>Start date</dt><dd>{form.start || "Not set"}</dd></div>
              <div><dt>Deadline</dt><dd>{form.due || "Not set"}</dd></div>
              <div><dt>Manager review</dt><dd>{form.reviewRequired ? "Required" : "Not required"}</dd></div>
            </dl>
          </div>
          <div className={styles.previewAttachments}>
            <div className={styles.sectionTitle}><strong>Attachments</strong><span>{files.length} selected</span></div>
            {files.length ? <ul className={styles.previewFiles}>{files.map(({ key, file }) => <li key={key}><Icon name="clip" /><span>{file.name}</span><small>{size(file.size)}</small></li>)}</ul>
              : <p className={styles.noFiles}><Icon name="info" />No files selected. Go back if you need to add any.</p>}
          </div>
        </section>}

        {submitError && <div className={styles.formError}><FormAlert>{submitError}</FormAlert></div>}
        {confirmDiscard ? (
          <div className={styles.discard} role="alert">
            <span><b>Discard this task?</b><small>Your unsaved details and selected files will be removed.</small></span>
            <button ref={keepRef} type="button" className="btn btn-secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
            <button type="button" className="btn btn-danger" onClick={onClose}>Discard</button>
          </div>
        ) : (
          <footer className={styles.footer}>
            <span><Icon name="info" />{preview ? "The assignee can start after creation." : "Files are attached before the task is assigned."}</span>
            {preview ? <button type="button" className="btn btn-secondary" onClick={() => { setPreview(false); setSubmitError(""); }} disabled={busy}>Back to editing</button>
              : <button type="button" className="btn btn-secondary" onClick={requestClose} disabled={busy}>Cancel</button>}
            <button type="submit" className="btn btn-primary" disabled={busy || !!fileError} aria-busy={busy}>{preview ? "Create task" : "Review details"}</button>
          </footer>
        )}
      </form>
    </Dialog>
  );
}
