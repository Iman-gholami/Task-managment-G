"use client";

import { useI18n as useTaskI18n } from "@/components/I18nProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { Field, FormAlert } from "@/components/ui/Field";
import AssigneePicker from "@/components/ui/AssigneePicker";
import TaskDateInput from "@/components/ui/TaskDateInput";
import { taskDate } from "@/lib/task-date";
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
  const { t: __taskTr, locale, number } = useTaskI18n();
  const { addTask, toast, me, users, peopleMap } = useApp();
  const manager = isManager(me);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...blank, a: manager ? "" : me.id });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [dateErrors, setDateErrors] = useState({ start: "", due: "" });
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [preview, setPreview] = useState(false);
  const [textDirty, setTextDirty] = useState(false);
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const textDirtyRef = useRef(false);
  const fileRef = useRef(null);
  const fileSequence = useRef(0);
  const keepRef = useRef(null);
  const previewRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = !!(textDirty || dateErrors.start || dateErrors.due || form.due || form.start !== TODAY ||
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
      setFileError(locale === "fa" ? `برای ایجاد تسک حداکثر ${MAX_TASK_FILES} فایل اضافه کنید.` : `Add up to ${MAX_TASK_FILES} files when creating a task.`);
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

  // The browser owns these text fields while editing; the complete values are
  // collected before preview so typing doesn't redraw the whole workspace.
  const trackText = () => {
    const next = !!(titleRef.current?.value.trim() || descriptionRef.current?.value.trim());
    if (textDirtyRef.current !== next) { textDirtyRef.current = next; setTextDirty(next); }
    if (error) setError(null);
  };

  const validate = (title) => {
    if (!title.trim()) { setError("title"); titleRef.current?.focus(); return false; }
    if (!form.a) { setError("assignee"); document.getElementById("task-assignee")?.focus(); return false; }
    if (dateErrors.start || dateErrors.due) { document.getElementById(dateErrors.start ? "task-start" : "task-deadline")?.focus(); return false; }
    if (form.due && form.due < (form.start || TODAY)) { setSubmitError("The deadline cannot be before the start date."); document.getElementById("task-deadline")?.focus(); return false; }
    setSubmitError("");
    return !fileError;
  };

  const submit = async () => {
    if (busy || confirmDiscard) return;
    if (!preview) {
      const title = titleRef.current?.value ?? form.title;
      const description = descriptionRef.current?.value ?? form.description;
      if (validate(title)) { setForm((current) => ({ ...current, title, description })); setPreview(true); }
      return;
    }
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
      toast(locale === "fa" ? `${task.id} ایجاد و به ${peopleMap[form.a]?.name ?? __taskTr("the assignee")} واگذار شد` : `${task.id} created and assigned to ${peopleMap[form.a]?.name ?? "the assignee"}`);
      onClose();
    } catch (e) {
      setSubmitError(e.message || "The task could not be created. Try again.");
    } finally { setBusy(false); }
  };

  const people = useMemo(() => users.filter((u) => u.active !== false && canAssignTask(me, u)), [users, me]);

  return (
    <Dialog label={__taskTr("Create task")} onClose={requestClose} width={980} className={styles.dialog} scrimClassName={styles.scrim} dismissible={!dirty && !busy}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <header className={styles.header}>
          <span className={styles.headerIcon}><Icon name="tasks" /></span>
          <div className={styles.headerCopy}><span className={styles.eyebrow}>{"" + __taskTr("Task workspace") + ""}</span><h2>{preview ? __taskTr("Confirm task details") : __taskTr("Create a task")}</h2><p>{preview ? __taskTr("Check the details before assigning this task.") : __taskTr("Give the assignee everything they need before work begins.")}</p></div>
          <ol className={styles.steps} aria-label={__taskTr("Task creation steps")}>
            <li className={!preview ? styles.currentStep : styles.completedStep} aria-current={!preview ? "step" : undefined}><span>1</span>{"" + __taskTr("Details") + ""}</li>
            <li className={preview ? styles.currentStep : undefined} aria-current={preview ? "step" : undefined}><span>2</span>{"" + __taskTr("Confirm") + ""}</li>
          </ol>
        </header>

        {!preview && <fieldset className={styles.layout} disabled={busy} aria-label={__taskTr("Task details and settings")}>
          <div className={styles.main}>
            <div className={styles.sectionTitle}><strong>{"" + __taskTr("Task details") + ""}</strong><span>{"" + __taskTr("What needs to be done?") + ""}</span></div>
            <Field label={__taskTr("Task title")} htmlFor="task-title" error={error === "title" ? __taskTr("Add a title to create the task.") : undefined}>
              <input id="task-title" ref={titleRef} className="input input-lg" dir="auto" placeholder={__taskTr("Give this task a clear title")} defaultValue={form.title}
                onChange={trackText} maxLength={200} autoComplete="off" />
            </Field>
            <Field label={__taskTr("Description")} htmlFor="task-description">
              <textarea id="task-description" ref={descriptionRef} className={`textarea ${styles.description}`} dir="auto" placeholder={__taskTr("Add context, the expected outcome, and anything the assignee should know.")}
                defaultValue={form.description} onChange={trackText} />
            </Field>

            <div className={styles.attachments}>
              <div className={styles.sectionTitle}><strong>{"" + __taskTr("Attachments") + ""}</strong><span>{files.length ? `${number(files.length)} ${__taskTr("selected")}` : __taskTr("Optional")}</span></div>
              <input ref={fileRef} type="file" multiple hidden aria-label={__taskTr("Files for new task")} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" className={`${styles.dropzone} ${dragOver ? styles.over : ""}`} onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}>
                <span className={styles.fileIcon}><Icon name="clip" /></span>
                <span><b>{"" + __taskTr("Choose files or drop them here") + ""}</b><small>{"" + __taskTr("Up to") + " "}{MAX_TASK_FILES}{" " + __taskTr("files · 20 MB each · 40 MB total") + ""}</small></span>
              </button>
              {fileError && <p className={styles.fileError} role="alert">{__taskTr(fileError)} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFileError("")}>{"" + __taskTr("Dismiss") + ""}</button></p>}
              {files.length > 0 && <ul className={styles.fileList} aria-label={__taskTr("Selected files")}>
                {files.map(({ key, file }) => <li key={key}><Icon name="sheet" /><span><b>{file.name}</b><small>{size(file.size)}</small></span>
                  <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={locale === "fa" ? `حذف ${file.name}` : `Remove ${file.name}`} onClick={() => { setFiles((current) => current.filter((item) => item.key !== key)); setFileError(""); }}><Icon name="x" /></button></li>)}
              </ul>}
            </div>
          </div>

          <aside className={styles.settings} aria-label={__taskTr("Task settings")}>
            <div className={styles.sectionTitle}><strong>{"" + __taskTr("Assignment") + ""}</strong><span>{"" + __taskTr("Who and when") + ""}</span></div>
            <Field label={__taskTr("Assignee")} htmlFor="task-assignee" error={error === "assignee" ? "Choose who this task is for." : undefined}>
              <AssigneePicker id="task-assignee" value={form.a} people={people} disabled={!manager} overlayOptions
                onSelect={(id) => { set({ a: id }); setError(null); }} onClear={() => { if (form.a) set({ a: "" }); if (error) setError(null); }} />
            </Field>
            <div className={styles.settingsGrid}>
              <Field label={__taskTr("Priority")} htmlFor="task-priority"><select id="task-priority" className="input" value={form.prio} onChange={(e) => set({ prio: e.target.value })}>{Object.entries(PRIO).map(([value, label]) => <option key={value} value={value}>{__taskTr(label)}</option>)}</select></Field>
              <Field label={__taskTr("Complexity")} htmlFor="task-complexity"><select id="task-complexity" className="input" value={form.cx} onChange={(e) => set({ cx: Number(e.target.value) })}>{CX.slice(1).map((label, i) => <option key={label} value={i + 1}>{__taskTr(label)}</option>)}</select></Field>
              <Field label={__taskTr("Start date (Solar Hijri)")} htmlFor="task-start"><TaskDateInput id="task-start" calendarLabel="Choose start date" value={form.start} onValidityChange={(start) => setDateErrors((current) => ({ ...current, start }))} onChange={(start) => { set({ start, ...(form.due && start && form.due < start ? { due: "" } : {}) }); }} /></Field>
              <Field label={__taskTr("Deadline (Solar Hijri)")} htmlFor="task-deadline"><TaskDateInput id="task-deadline" calendarLabel="Choose deadline" min={form.start || TODAY} value={form.due} onValidityChange={(due) => setDateErrors((current) => ({ ...current, due }))} onChange={(due) => set({ due })} /></Field>
            </div>
            <label className={styles.review}>
              <input type="checkbox" className="cb" checked={manager ? form.reviewRequired : true} disabled={!manager}
                onChange={(e) => set({ reviewRequired: e.target.checked })} aria-label={__taskTr("Manager review required")} />
              <span><b>{"" + __taskTr("Manager review required") + ""}</b><small>{manager ? __taskTr("Turn off to let the assignee complete the task without review.") : __taskTr("A manager will review this task before completion.")}</small></span>
            </label>
          </aside>
        </fieldset>}

        {preview && <section className={styles.preview} aria-label={__taskTr("Task preview")}>
          <div className={styles.previewHeading} tabIndex={-1} ref={previewRef}>
            <span className={styles.headerIcon}><Icon name="review" /></span>
            <span><strong>{"" + __taskTr("Ready to assign?") + ""}</strong><small>{"" + __taskTr("The task and its files will become visible after you create it.") + ""}</small></span>
          </div>
          <div className={styles.previewGrid}>
            <div className={styles.previewBrief}>
              <span className={styles.eyebrow}>{"" + __taskTr("Task") + ""}</span>
              <h3 dir="auto">{form.title.trim()}</h3>
              <p dir="auto">{form.description.trim() || __taskTr("No description added.")}</p>
            </div>
            <dl className={styles.previewFacts}>
              <div><dt>{"" + __taskTr("Assignee") + ""}</dt><dd dir="auto">{peopleMap[form.a]?.name ?? "—"}</dd></div>
              <div><dt>{"" + __taskTr("Priority") + ""}</dt><dd>{__taskTr(PRIO[form.prio])}</dd></div>
              <div><dt>{"" + __taskTr("Complexity") + ""}</dt><dd>{__taskTr(CX[form.cx])}</dd></div>
              <div><dt>{"" + __taskTr("Start date") + ""}</dt><dd>{form.start ? taskDate(form.start, locale) : __taskTr("Not set")}</dd></div>
              <div><dt>{"" + __taskTr("Deadline") + ""}</dt><dd>{form.due ? taskDate(form.due, locale) : __taskTr("Not set")}</dd></div>
              <div><dt>{"" + __taskTr("Manager review") + ""}</dt><dd>{form.reviewRequired ? __taskTr("Required") : __taskTr("Not required")}</dd></div>
            </dl>
          </div>
          <div className={styles.previewAttachments}>
            <div className={styles.sectionTitle}><strong>{"" + __taskTr("Attachments") + ""}</strong><span>{number(files.length)}{" " + __taskTr("selected") + ""}</span></div>
            {files.length ? <ul className={styles.previewFiles}>{files.map(({ key, file }) => <li key={key}><Icon name="clip" /><span>{file.name}</span><small>{size(file.size)}</small></li>)}</ul>
              : <p className={styles.noFiles}><Icon name="info" />{"" + __taskTr("No files selected. Go back if you need to add any.") + ""}</p>}
          </div>
        </section>}

        {submitError && <div className={styles.formError}><FormAlert>{__taskTr(submitError)}</FormAlert></div>}
        {confirmDiscard ? (
          <div className={styles.discard} role="alert">
            <span><b>{"" + __taskTr("Discard this task?") + ""}</b><small>{"" + __taskTr("Your unsaved details and selected files will be removed.") + ""}</small></span>
            <button ref={keepRef} type="button" className="btn btn-secondary" onClick={() => setConfirmDiscard(false)}>{"" + __taskTr("Keep editing") + ""}</button>
            <button type="button" className="btn btn-danger" onClick={onClose}>{"" + __taskTr("Discard") + ""}</button>
          </div>
        ) : (
          <footer className={styles.footer}>
            <span><Icon name="info" />{preview ? __taskTr("The assignee can start after creation.") : __taskTr("Files are attached before the task is assigned.")}</span>
            {preview ? <button type="button" className="btn btn-secondary" onClick={() => { setPreview(false); setSubmitError(""); }} disabled={busy}>{"" + __taskTr("Back to editing") + ""}</button>
              : <button type="button" className="btn btn-secondary" onClick={requestClose} disabled={busy}>{"" + __taskTr("Cancel") + ""}</button>}
            <button type="submit" className="btn btn-primary" disabled={busy || !!fileError} aria-busy={busy}>{preview ? __taskTr("Create task") : __taskTr("Review details")}</button>
          </footer>
        )}
      </form>
    </Dialog>
  );
}
