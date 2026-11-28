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

const text = (fa, persian, english) => fa ? persian : english;
const needsAttention = (status) => ["blocked", "returned", "review"].includes(status);
const viewFor = (status) => status === "done" || status === "cancelled" ? "finished" : needsAttention(status) ? "attention" : "active";

function nextAction(status, fa, isOwnTask) {
  switch (status) {
    case "backlog": case "todo": return text(fa, isOwnTask ? "آمادهٔ شروع توسط شما" : "در انتظار شروع مسئول", isOwnTask ? "Ready for you to start" : "Waiting for assignee to start");
    case "progress": return text(fa, isOwnTask ? "گزارش کارتان را تکمیل کنید" : "در حال انجام توسط مسئول", isOwnTask ? "Continue your work report" : "Assignee is working");
    case "blocked": return text(fa, "نیازمند رفع مانع", "Needs an unblock decision");
    case "returned": return text(fa, "منتظر اصلاح و ارسال دوباره", "Waiting for an updated report");
    case "review": return text(fa, "آمادهٔ بازبینی مدیر", "Ready for manager review");
    case "done": return text(fa, "تأیید و تکمیل شده", "Approved and complete");
    case "cancelled": return text(fa, "لغو شده", "Cancelled");
    default: return text(fa, "در صف انجام", "In the queue");
  }
}

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
  const [view, setView] = useState("all");
  const items = data?.subtasks ?? [];
  const active = items.filter((item) => item.relation === "active");
  const promoted = items.filter((item) => item.relation === "promoted");
  const done = active.filter((item) => item.status === "done").length;
  const percent = active.length ? Math.round(done * 100 / active.length) : 0;
  const attentionCount = active.filter((item) => needsAttention(item.status)).length;
  const activeCount = active.filter((item) => viewFor(item.status) === "active").length;
  const visible = active.filter((item) => view === "all" || viewFor(item.status) === view);
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
        <span className={styles.eyebrow}><Icon name="board" />{text(fa, "فضای اجرای بخش‌های کار", "WORK PACKAGES")}</span>
        <h2>{text(fa, "زیرتسک‌های این کار", "Work packages for this task")}</h2>
        <p>{manager ? text(fa, "کارها را به افراد بسپارید، گلوگاه‌ها را ببینید و هر بخش را جداگانه پیگیری کنید.", "Delegate work, spot bottlenecks, and follow each assignment independently.") : text(fa, "وضعیت بخش‌هایی که به آن‌ها دسترسی دارید در اینجا مشخص است.", "See the linked work packages you can access.")}</p>
      </div>
      <div className={styles.headActions}>
        {active.length > 0 && <div className={styles.progressSummary}><strong>{number(percent)}{fa ? "٪" : "%"}</strong><small>{text(fa, "پیشرفت تأییدشده", "approved progress")}</small></div>}
        {manager && !["review", "done", "cancelled"].includes(task.status) && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setMessage(""); setAdding(true); }}><Icon name="plus" />{text(fa, "افزودن زیرتسک", "Add subtask")}</button>}
        {manager && ["review", "done", "cancelled"].includes(task.status) && <span className={styles.createPaused}><Icon name="lock" />{text(fa, "در این وضعیت امکان افزودن نیست", "Adding is paused at this stage")}</span>}
      </div>
    </div>
    {active.length > 0 && <div className={styles.globalTrack} role="progressbar" aria-label={text(fa, "پیشرفت زیرتسک‌ها", "Subtask completion")} aria-valuenow={done} aria-valuemin={0} aria-valuemax={active.length}><span style={{ width: `${percent}%` }} /></div>}
    {active.length > 0 && <div className={styles.overview} aria-label={text(fa, "نمای کلی زیرتسک‌ها", "Work package overview")}>
      <div className={styles.overviewItem}><span className={styles.overviewIcon}><Icon name="list" /></span><strong>{number(active.length)}</strong><span>{text(fa, "بخش تعریف‌شده", "assignments")}</span></div>
      <div className={styles.overviewItem}><span className={`${styles.overviewIcon} ${styles.iconActive}`}><Icon name="activity" /></span><strong>{number(activeCount)}</strong><span>{text(fa, "در صف یا در جریان", "ready or working")}</span></div>
      <div className={styles.overviewItem}><span className={`${styles.overviewIcon} ${styles.iconAttention}`}><Icon name="review" /></span><strong>{number(attentionCount)}</strong><span>{text(fa, "نیازمند پیگیری", "needs attention")}</span></div>
      <div className={styles.overviewItem}><span className={`${styles.overviewIcon} ${styles.iconDone}`}><Icon name="checkCircle" /></span><strong>{number(done)}</strong><span>{text(fa, "تکمیل‌شده", "completed")}</span></div>
    </div>}
    {loading && !data && <div className={styles.notice} role="status"><Icon name="refresh" />{text(fa, "در حال دریافت زیرتسک‌ها…", "Loading subtasks…")}</div>}
    {error && <div className={styles.alert} role="alert">{text(fa, "بارگذاری زیرتسک‌ها انجام نشد.", "Could not load the subtasks.")} <button type="button" onClick={reload} className="btn btn-ghost btn-sm">{text(fa, "تلاش دوباره", "Retry")}</button></div>}
    {!loading && !error && !items.length && <div className={styles.empty}>
      <span className={styles.emptyIcon}><Icon name="list" /></span>
      <div><strong>{text(fa, "کار هنوز به بخش‌های کوچک‌تر تقسیم نشده", "No work packages yet")}</strong><p>{manager ? text(fa, "اولین زیرتسک را بسازید و مسئول انجامش را مشخص کنید.", "Create a subtask, assign an owner, and track its progress.") : text(fa, "مدیر می‌تواند مراحل اجرایی این کار را تعریف کند.", "A manager can break this work into smaller tasks.")}</p></div>
    </div>}
    {active.length > 0 && <>
      <div className={styles.listHeader}>
        <h3>{text(fa, "پیگیری بخش‌ها", "Track assignments")}</h3>
        <div className={styles.filters} role="group" aria-label={text(fa, "فیلتر وضعیت", "Filter by status")}>
          {[["all", text(fa, "همه", "All"), active.length], ["active", text(fa, "در جریان", "Active"), activeCount], ["attention", text(fa, "نیاز به پیگیری", "Attention"), attentionCount], ["finished", text(fa, "پایان‌یافته", "Finished"), active.length - activeCount - attentionCount]].map(([key, label, count]) => <button key={key} type="button" className={`${styles.filter} ${view === key ? styles.selected : ""}`} aria-pressed={view === key} onClick={() => setView(key)}>{label}<span>{number(count)}</span></button>)}
        </div>
      </div>
      {visible.length ? <div className={styles.branch}>
        {visible.map((item) => <SubtaskRow key={item.id} item={item} fa={fa} locale={locale} t={t} peopleMap={peopleMap} own={item.a === me.id} manager={manager && canReviewTask(me, item)} onPromote={() => { setMessage(""); setPromoting(item); }} />)}
      </div> : <div className={styles.filterEmpty} role="status"><Icon name="checkCircle" />{text(fa, "در این وضعیت، زیرتسکی وجود ندارد.", "No work packages in this status.")}<button type="button" onClick={() => setView("all")}>{text(fa, "نمایش همه", "Show all")}</button></div>}
    </>}
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

function SubtaskRow({ item, fa, locale, t, peopleMap, own, manager, onPromote }) {
  const assignee = peopleMap[item.a]?.name ?? item.a;
  return <article className={styles.row} data-state={item.status}>
    <span className={styles.node} aria-hidden="true"><Icon name={item.status === "done" ? "check" : needsAttention(item.status) ? "alert" : "list"} /></span>
    <div className={styles.rowBody}>
      <div className={styles.rowMain}>
        <div className={styles.rowIdentity}>
          <span className={styles.id}>{text(fa, "بخش کاری", "WORK PACKAGE")} · {item.id}</span>
          <Link className={styles.titleLink} href={`/tasks/${item.id}`} dir="auto">{item.title}<Icon name="arrowRight" /></Link>
          {item.description && <p dir="auto">{item.description}</p>}
        </div>
        <div className={styles.rowMeta}>
          <span className={`${styles.status} ${item.status === "done" ? styles.complete : item.status === "blocked" || item.status === "returned" ? styles.attention : ""}`}><span className={styles.statusDot} />{t(STATUS[item.status] ?? item.status)}</span>
        </div>
      </div>
      <div className={styles.rowFoot}>
        <span className={styles.owner} title={assignee}><span className={styles.avatar} aria-hidden="true">{assignee.slice(0, 1).toUpperCase()}</span><span><small>{text(fa, "مسئول", "ASSIGNEE")}</small><strong>{own ? text(fa, "شما", "You") : assignee}</strong></span></span>
        <span className={`${styles.nextAction} ${needsAttention(item.status) ? styles.nextAttention : ""}`}><Icon name={needsAttention(item.status) ? "alert" : item.status === "done" ? "checkCircle" : "arrowRight"} />{nextAction(item.status, fa, own)}</span>
        {item.due && item.due !== "—" && <span className={styles.due}><Icon name="cal" />{taskDate(item.due, locale)}</span>}
        <Link className={styles.openButton} href={`/tasks/${item.id}`}>{own ? text(fa, "ادامهٔ کار", "Open my work") : item.status === "review" ? text(fa, "بررسی گزارش", "Review report") : text(fa, "مشاهدهٔ کار", "Open task")}<Icon name="arrowRight" /></Link>
        {manager && <button type="button" className={styles.promoteButton} onClick={onPromote}><Icon name="arrowUp" />{text(fa, "مستقل کردن", "Make independent")}</button>}
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
  const ownerName = people.find((person) => person.id === owner)?.name ?? text(fa, "هنوز انتخاب نشده", "Not selected");
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
  return <Dialog label={text(fa, "ایجاد زیرتسک", "Create subtask")} title={text(fa, "واگذاری یک بخش از کار", "Assign a work package")} description={text(fa, "کار را روشن تعریف کنید و به مسئولش بسپارید؛ حتی پس از شروع تسک مادر هم می‌توانید بخش تازه اضافه کنید.", "Define the outcome and choose who owns it. You can add work packages even after the parent task starts.")} onClose={dismiss} dismissible={!dirty && !busy} width={700}>
    <form noValidate onSubmit={submit}>
      <div className={`${styles.createBody} modal-body`}>
        {discard ? <div className={styles.discard}><Icon name="alert" /><strong>{text(fa, "تغییرات ذخیره نشده‌اند", "Discard unsaved changes?")}</strong><p>{text(fa, "اگر خارج شوید، اطلاعات واردشده از بین می‌رود.", "Your entered details will be lost.")}</p><div className={styles.actions}><button type="button" className="btn btn-secondary" onClick={() => setDiscard(false)}>{text(fa, "ادامه ویرایش", "Keep editing")}</button><button type="button" className="btn btn-ghost" onClick={onClose}>{text(fa, "خروج بدون ذخیره", "Discard")}</button></div></div> : <>
          <div className={styles.parentInfo}><Icon name="list" /><span>{text(fa, "زیرمجموعهٔ", "Under")}</span><strong dir="auto">{task.title}</strong><code>{task.id}</code></div>
          <div className={styles.formSection}>
            <div className={styles.formSectionHead}><span className={styles.formStep}>{fa ? "۱" : "1"}</span><div><strong>{text(fa, "چه کاری باید انجام شود؟", "What needs to be done?")}</strong><small>{text(fa, "به جای یک عنوان کلی، خروجی قابل تحویل را بنویسید.", "Describe the actual deliverable, not just a vague activity.")}</small></div></div>
            <Field label={text(fa, "عنوان زیرتسک", "Subtask title")} htmlFor="subtask-title" error={invalid === "title" ? error : null}><input id="subtask-title" className="input" maxLength={200} autoFocus value={title} placeholder={text(fa, "مثلاً تنظیم هشدارهای سرورها", "e.g. Configure server alerts")} onChange={(e) => { setTitle(e.target.value); setInvalid(""); setError(""); }} /></Field>
            <Field label={text(fa, "شرح کار و خروجی مورد انتظار", "Scope and expected result")} htmlFor="subtask-description" hint={text(fa, "کارشناس با این توضیح می‌فهمد دقیقاً چه چیزی باید تحویل دهد.", "The assignee will see this in their task brief.")}><textarea id="subtask-description" className={`textarea ${styles.description}`} maxLength={10000} value={description} placeholder={text(fa, "مراحل مهم، معیار پذیرش و خروجی مورد انتظار…", "Key steps, acceptance criteria, and expected result…")} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <div className={styles.formSection}>
            <div className={styles.formSectionHead}><span className={styles.formStep}>{fa ? "۲" : "2"}</span><div><strong>{text(fa, "چه کسی و تا چه زمانی؟", "Who owns it and by when?")}</strong><small>{text(fa, "مسئول می‌تواند این کار را مستقل از تسک مادر شروع کند.", "The assignee can start this work independently of the parent.")}</small></div></div>
            <div className={styles.formGrid}>
              <Field label={text(fa, "مسئول انجام", "Assignee")} htmlFor="subtask-owner" error={invalid === "owner" ? error : null}><AssigneePicker id="subtask-owner" value={owner} people={people} onSelect={(value) => { setOwner(value); setInvalid(""); setError(""); }} onClear={() => setOwner("")} /></Field>
              <Field label={text(fa, "مهلت انجام", "Deadline")} htmlFor="subtask-due" error={invalid === "due" ? error : null}><TaskDateInput id="subtask-due" value={due} onChange={(value) => { setDue(value); setInvalid(""); }} onValidityChange={setDateError} calendarLabel={text(fa, "انتخاب مهلت", "Choose deadline")} commitOnBlur /></Field>
            </div>
          </div>
          <div className={styles.assignmentPreview} aria-label={text(fa, "پیش‌نمایش واگذاری", "Assignment preview")}>
            <div className={styles.previewHeader}><Icon name="eye" /><strong>{text(fa, "آنچه کارشناس دریافت می‌کند", "What the assignee will see")}</strong></div>
            <div className={styles.previewContent}><span className={styles.previewDot}><Icon name="tasks" /></span><div><strong dir="auto">{title.trim() || text(fa, "عنوان زیرتسک شما", "Your work package title")}</strong><p>{text(fa, "مسئول", "Assignee")}: {ownerName} · {text(fa, "مهلت", "Due")}: {due || text(fa, "بدون مهلت", "No deadline")}</p></div><span className={styles.previewState}>{text(fa, "آمادهٔ شروع", "Ready to start")}</span></div>
            <p className={styles.formNote}><Icon name="info" />{text(fa, "اولویت از تسک مادر گرفته می‌شود. گزارش، ساعت و فایل‌های این بخش مستقل ثبت می‌شوند.", "Priority follows the parent. Reports, hours, and attachments are tracked separately.")}</p>
          </div>
          {error && !["title", "owner", "due"].includes(invalid) && <FormAlert>{error}</FormAlert>}
        </>}
      </div>
      {!discard && <div className="modal-foot"><button type="button" className="btn btn-secondary" disabled={busy} onClick={dismiss}>{text(fa, "انصراف", "Cancel")}</button><button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}><Icon name="plus" />{text(fa, "ایجاد زیرتسک", "Create subtask")}</button></div>}
    </form>
  </Dialog>;
}

/** Context for the assignee on a child task, with an actionable route into their own work. */
export function SubtaskOriginBanner({ task, parent, isAssignee }) {
  const { locale, t } = useI18n();
  const fa = locale === "fa";
  const linked = Boolean(task.parentTaskId);
  const canWork = linked && isAssignee && ["backlog", "todo", "progress", "returned", "blocked"].includes(task.status);
  return <aside className={`${styles.origin} ${!linked ? styles.originPromoted : ""}`} aria-label={linked ? text(fa, "راهنمای زیرتسک شما", "Your work package") : text(fa, "سابقهٔ زیرتسک", "Subtask history")}>
    <div className={styles.originMark}><Icon name={linked ? "list" : "arrowUp"} /></div>
    <div className={styles.originContent}>
      <span className={styles.originEyebrow}>{linked ? text(fa, "بخشی از یک کار بزرگ‌تر", "PART OF A LARGER TASK") : text(fa, "از زیرتسک به تسک مستقل", "PROMOTED TASK")}</span>
      <strong>{linked ? isAssignee ? text(fa, "این بخش به شما سپرده شده", "This assignment belongs to you") : text(fa, "این بخش، مسیر اجرای خودش را دارد", "This work package has its own workflow") : text(fa, "این تسک حالا مستقل است", "This task now stands on its own")}</strong>
      <p>{linked ? isAssignee ? text(fa, "شرح کار را بخوانید، کارتان را شروع کنید و گزارش، زمان و مستندات همین بخش را ثبت کنید.", "Read the brief, start your work, and log the report, hours, and evidence for this package.") : text(fa, "گزارش، مسئول و وضعیت این بخش جدا از کار اصلی پیگیری می‌شود.", "Its owner, report, and status are tracked separately from the main task.") : text(fa, "گزارش‌ها، زمان و فایل‌های قبلی حفظ شده‌اند و کار بدون وابستگی به تسک مادر ادامه دارد.", "Existing reports, hours, and files are preserved; work continues without the parent dependency.")}</p>
      <div className={styles.originMeta}>
        <span><Icon name="activity" />{t(STATUS[task.status] ?? task.status)}</span>
        {linked && <span><Icon name="arrowRight" />{nextAction(task.status, fa, isAssignee)}</span>}
      </div>
    </div>
    <div className={styles.originActions}>
      {canWork && <a href="#task-work" className="btn btn-primary btn-sm">{["backlog", "todo"].includes(task.status) ? text(fa, "رفتن به مرحلهٔ شروع", "Go to start step") : text(fa, "ادامهٔ گزارش کار", "Continue work report")}<Icon name="arrowRight" /></a>}
      {parent && <Link href={`/tasks/${parent.id}`} className="btn btn-secondary btn-sm"><Icon name="list" />{text(fa, "مشاهدهٔ تسک مادر", "View parent task")}</Link>}
    </div>
  </aside>;
}
