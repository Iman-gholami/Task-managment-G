"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp, api } from "@/components/AppProvider";
import { useI18n } from "@/components/I18nProvider";
import useFetch from "@/components/useFetch";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import AssigneePicker from "@/components/ui/AssigneePicker";
import TaskDateInput from "@/components/ui/TaskDateInput";
import { Field, FormAlert } from "@/components/ui/Field";
import { canAssignTask, canReviewTask } from "@/lib/roles";
import { STATUS } from "@/lib/format";
import { taskDate } from "@/lib/task-date";
import styles from "./TaskSubtasks.module.css";

const stageFor = (status) => ({ backlog: 0, todo: 0, progress: 1, blocked: 1, returned: 1, review: 2, done: 4, cancelled: 0 })[status] ?? 0;
const text = (fa, persian, english) => fa ? persian : english;

export default function TaskSubtasks({ task }) {
  const { me, members, peopleMap, dispatch, toast } = useApp();
  const { locale, number, t } = useI18n();
  const fa = locale === "fa";
  const manager = canReviewTask(me, task);
  const { data, error, loading, reload, setData } = useFetch(!task.parentTaskId ? `/api/tasks/${task.id}/subtasks` : null, { keepDataOnError: true });
  const [adding, setAdding] = useState(false);
  const [promoting, setPromoting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const items = data?.subtasks ?? [];
  const active = items.filter((item) => item.relation === "active");
  const promoted = items.filter((item) => item.relation === "promoted");
  const done = active.filter((item) => item.status === "done").length;
  const percent = active.length ? Math.round(done * 100 / active.length) : 0;
  const eligible = members.filter((person) => person.active !== false && canAssignTask(me, person));

  // A regular assignee with no visible work packages has no additional panel to scan.
  if (task.parentTaskId || (!manager && !loading && !error && !items.length)) return null;

  const promote = async () => {
    if (!promoting || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { task: child } = await api(`/api/tasks/${task.id}/subtasks/${promoting.id}/promote`, { method: "POST" });
      dispatch({ type: "task/update", id: child.id, patch: child });
      setData((current) => current && ({ ...current, subtasks: current.subtasks.map((item) => item.id === child.id ? { ...child, relation: "promoted" } : item) }));
      toast(text(fa, "زیرتسک به تسک مستقل تبدیل شد.", "Subtask promoted to an independent task."));
      setPromoting(null);
      reload();
    } catch (failure) {
      setMessage(failure.status === 409 ? text(fa, "این زیرتسک قبلاً تغییر کرده است. فهرست را به‌روزرسانی کنید.", "This subtask has changed. Refresh the list.") : failure.message);
    } finally { setBusy(false); }
  };

  return <section className={styles.panel} data-testid="task-subtasks" aria-label={text(fa, "زیرتسک‌های این تسک", "Task subtasks")}>
    <div className={styles.head}>
      <div className={styles.headCopy}>
        <span className={styles.eyebrow}><Icon name="list" />{text(fa, "ساختار اجرای کار", "WORK BREAKDOWN")}</span>
        <h2>{text(fa, "زیرتسک‌ها", "Subtasks")}</h2>
        <p>{text(fa, "هر بخش، مسئول و مسیر انجام مستقل دارد؛ همه در همین‌جا کنار هم دیده می‌شوند.", "Separate owners and work journeys, connected in one clear view.")}</p>
      </div>
      <div className={styles.headActions}>
        {active.length > 0 && <div className={styles.progressSummary}>
          <strong>{number(done)}<span> / {number(active.length)}</span></strong>
          <small>{text(fa, "تکمیل‌شده", "complete")}</small>
        </div>}
        {manager && !["review", "done", "cancelled"].includes(task.status) && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setMessage(""); setAdding(true); }}><Icon name="plus" />{text(fa, "افزودن زیرتسک", "Add subtask")}</button>}
      </div>
    </div>
    {active.length > 0 && <div className={styles.globalTrack} role="progressbar" aria-label={text(fa, "پیشرفت زیرتسک‌ها", "Subtask completion")} aria-valuenow={done} aria-valuemin={0} aria-valuemax={active.length}><span style={{ width: `${percent}%` }} /></div>}
    {loading && !data && <div className={styles.notice} role="status"><Icon name="refresh" />{text(fa, "در حال دریافت زیرتسک‌ها…", "Loading subtasks…")}</div>}
    {error && <div className={styles.alert} role="alert">{text(fa, "بارگذاری زیرتسک‌ها انجام نشد.", "Could not load the subtasks.")} <button type="button" onClick={reload} className="btn btn-ghost btn-sm">{text(fa, "تلاش دوباره", "Retry")}</button></div>}
    {!loading && !error && !items.length && <div className={styles.empty}>
      <span className={styles.emptyIcon}><Icon name="list" /></span>
      <div><strong>{text(fa, "کار هنوز به بخش‌های کوچک‌تر تقسیم نشده", "No work packages yet")}</strong><p>{manager ? text(fa, "اولین زیرتسک را بسازید و مسئول انجامش را مشخص کنید.", "Create a subtask, assign an owner, and track its progress.") : text(fa, "مدیر می‌تواند مراحل اجرایی این کار را تعریف کند.", "A manager can break this work into smaller tasks.")}</p></div>
    </div>}
    {active.length > 0 && <div className={styles.branch}>
      {active.map((item, index) => <SubtaskRow key={item.id} item={item} index={index} fa={fa} locale={locale} t={t} peopleMap={peopleMap} manager={manager && canReviewTask(me, item)} onPromote={() => { setMessage(""); setPromoting(item); }} />)}
    </div>}
    {promoted.length > 0 && <div className={styles.promotedBlock}>
      <div className={styles.promotedHeading}><Icon name="arrowUp" />{text(fa, "تبدیل‌شده به تسک مستقل", "Promoted to independent tasks")}<span>{number(promoted.length)}</span></div>
      {promoted.map((item) => <Link key={item.id} href={`/tasks/${item.id}`} className={styles.promotedLink}>
        <span className={styles.promotedId}>{item.id}</span><span dir="auto">{item.title}</span><span className={styles.promotedArrow}><Icon name="arrowRight" /></span>
      </Link>)}
    </div>}
    {adding && <CreateSubtaskDialog key={task.id} task={task} people={eligible} fa={fa} onClose={() => setAdding(false)} onCreated={({ task: child, subtasks }) => {
      dispatch({ type: "task/add", task: child });
      setData({ subtasks });
      setAdding(false);
      toast(text(fa, "زیرتسک ایجاد شد؛ مسئول آن می‌تواند کار را شروع کند.", "Subtask created. Its assignee can start working."));
    }} />}
    {promoting && <Dialog label={text(fa, "تبدیل به تسک مستقل", "Promote to independent task")} title={text(fa, "این زیرتسک مستقل شود؟", "Make this an independent task?")} description={text(fa, "همین شناسه، گزارش‌ها، ساعت‌های ثبت‌شده و فایل‌ها باقی می‌مانند؛ فقط ارتباط اجرایی با تسک مادر برداشته می‌شود.", "The task ID, reports, recorded hours and files stay intact. Only the active parent relationship is removed.")} onClose={() => !busy && setPromoting(null)} dismissible={!busy} width={490}>
      <div className={styles.confirmBody}><span className={styles.confirmId}>{promoting.id}</span><strong dir="auto">{promoting.title}</strong><span>{text(fa, "پس از تبدیل، این تسک با وضعیت فعلی خود ادامه می‌دهد.", "It keeps its current status and workflow.")}</span>{message && <FormAlert>{message}</FormAlert>}</div>
      <div className="modal-foot"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setPromoting(null)}>{text(fa, "انصراف", "Cancel")}</button><button type="button" className="btn btn-primary" disabled={busy} aria-busy={busy} onClick={promote}><Icon name="arrowUp" />{text(fa, "تبدیل به تسک مستقل", "Promote task")}</button></div>
    </Dialog>}
  </section>;
}

function SubtaskRow({ item, index, fa, locale, t, peopleMap, manager, onPromote }) {
  const stage = stageFor(item.status);
  const assignee = peopleMap[item.a]?.name ?? item.a;
  return <article className={styles.row} data-state={item.status}>
    <span className={styles.node} aria-hidden="true">{item.status === "done" ? <Icon name="check" /> : String(index + 1).padStart(2, "0")}</span>
    <div className={styles.rowBody}>
      <div className={styles.rowMain}>
        <div className={styles.rowIdentity}>
          <span className={styles.id}>{item.id}</span>
          <Link className={styles.titleLink} href={`/tasks/${item.id}`} dir="auto">{item.title}<Icon name="arrowRight" /></Link>
          {item.description && <p dir="auto">{item.description}</p>}
        </div>
        <div className={styles.rowMeta}>
          <span className={`${styles.status} ${item.status === "done" ? styles.complete : item.status === "blocked" || item.status === "returned" ? styles.attention : ""}`}><span className={styles.statusDot} />{t(STATUS[item.status] ?? item.status)}</span>
          <span className={styles.owner} title={assignee}><span className={styles.avatar} aria-hidden="true">{assignee.slice(0, 1).toUpperCase()}</span><span>{assignee}</span></span>
        </div>
      </div>
      <div className={styles.rowFoot}>
        <div className={styles.stages} role="img" aria-label={text(fa, `مرحله ${stage === 4 ? 4 : stage + 1} از ۴`, `Stage ${stage === 4 ? 4 : stage + 1} of 4`)}>
          {[1, 2, 3, 4].map((n) => <span key={n} className={n <= stage ? styles.stageFilled : ""} />)}
        </div>
        {item.due && item.due !== "—" && <span className={styles.due}><Icon name="cal" />{taskDate(item.due, locale)}</span>}
        {manager && <button type="button" className={styles.promoteButton} onClick={onPromote}><Icon name="arrowUp" />{text(fa, "تبدیل به تسک مستقل", "Promote to task")}</button>}
      </div>
    </div>
  </article>;
}

function CreateSubtaskDialog({ task, people, fa, onClose, onCreated }) {
  const initialOwner = people.some((person) => person.id === task.a) ? task.a : people[0]?.id ?? "";
  const initialDue = task.due === "—" ? "" : task.due;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState(initialOwner);
  const [due, setDue] = useState(initialDue);
  const [dateError, setDateError] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty = !!title.trim() || !!description.trim() || owner !== initialOwner || due !== initialDue;
  const dismiss = () => { if (busy) return; if (dirty && !discard) setDiscard(true); else onClose(); };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) { setInvalid("title"); setError(text(fa, "عنوان زیرتسک را وارد کنید.", "Enter a subtask title.")); document.getElementById("subtask-title")?.focus(); return; }
    if (!owner) { setInvalid("owner"); setError(text(fa, "یک مسئول انتخاب کنید.", "Choose an assignee.")); document.getElementById("subtask-owner")?.focus(); return; }
    if (dateError) { setInvalid("due"); setError(text(fa, "تاریخ را اصلاح کنید.", "Correct the deadline.")); document.getElementById("subtask-due")?.focus(); return; }
    setBusy(true); setInvalid(""); setError("");
    try {
      const result = await api(`/api/tasks/${task.id}/subtasks`, { method: "POST", body: {
        title: title.trim(), description: description.trim(), a: owner, due,
        prio: task.prio, cx: task.cx,
      } });
      onCreated(result);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  return <Dialog label={text(fa, "ایجاد زیرتسک", "Create subtask")} title={text(fa, "یک بخش تازه از کار", "Create a work package")} description={text(fa, "آن را به یک نفر بسپارید؛ گزارش و زمان این بخش جداگانه ثبت می‌شود.", "Give it an owner. Its hours and report are tracked independently.")} onClose={dismiss} dismissible={!dirty && !busy} width={570}>
    <form noValidate onSubmit={submit}>
      <div className={`${styles.createBody} modal-body`}>
        {discard ? <div className={styles.discard}><Icon name="alert" /><strong>{text(fa, "تغییرات ذخیره نشده‌اند", "Discard unsaved changes?")}</strong><p>{text(fa, "اگر خارج شوید، اطلاعات واردشده از بین می‌رود.", "Your entered details will be lost.")}</p><div className={styles.actions}><button type="button" className="btn btn-secondary" onClick={() => setDiscard(false)}>{text(fa, "ادامه ویرایش", "Keep editing")}</button><button type="button" className="btn btn-ghost" onClick={onClose}>{text(fa, "خروج بدون ذخیره", "Discard")}</button></div></div> : <>
          <div className={styles.parentInfo}><Icon name="list" /><span>{text(fa, "زیرمجموعهٔ", "Under")}</span><strong dir="auto">{task.title}</strong><code>{task.id}</code></div>
          <Field label={text(fa, "عنوان زیرتسک", "Subtask title")} htmlFor="subtask-title" error={invalid === "title" ? error : null}><input id="subtask-title" className="input" maxLength={200} autoFocus value={title} placeholder={text(fa, "مثلاً تنظیم هشدارهای سرورها", "e.g. Configure server alerts")} onChange={(e) => { setTitle(e.target.value); setInvalid(""); setError(""); }} /></Field>
          <Field label={text(fa, "شرح کار", "Description")} htmlFor="subtask-description"><textarea id="subtask-description" className={`textarea ${styles.description}`} maxLength={10000} value={description} placeholder={text(fa, "خروجی مورد انتظار این بخش را مشخص کنید…", "What should this work package deliver?")} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className={styles.formGrid}>
            <Field label={text(fa, "مسئول انجام", "Assignee")} htmlFor="subtask-owner" error={invalid === "owner" ? error : null}><AssigneePicker id="subtask-owner" value={owner} people={people} onSelect={setOwner} onClear={() => setOwner("")} /></Field>
            <Field label={text(fa, "مهلت انجام", "Deadline")} htmlFor="subtask-due"><TaskDateInput id="subtask-due" value={due} onChange={setDue} onValidityChange={setDateError} calendarLabel="Choose deadline" commitOnBlur /></Field>
          </div>
          <p className={styles.formNote}><Icon name="info" />{text(fa, "اولویت و پیچیدگی از تسک مادر گرفته می‌شود؛ بعداً قابل ویرایش است.", "Priority and complexity are inherited; you can change them later.")}</p>
          {error && !["title", "owner"].includes(invalid) && <FormAlert>{error}</FormAlert>}
        </>}
      </div>
      {!discard && <div className="modal-foot"><button type="button" className="btn btn-secondary" disabled={busy} onClick={dismiss}>{text(fa, "انصراف", "Cancel")}</button><button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}><Icon name="plus" />{text(fa, "ایجاد زیرتسک", "Create subtask")}</button></div>}
    </form>
  </Dialog>;
}
