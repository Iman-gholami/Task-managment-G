"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, api } from "@/components/AppProvider";
import { useI18n } from "@/components/I18nProvider";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { Field, FormAlert } from "@/components/ui/Field";
import { canAssignTask, canReviewTask } from "@/lib/roles";
import { taskDate, taskWhen } from "@/lib/task-date";
import { parseTaskHours, TaskFlowStep } from "@/components/screens/TaskWorkPanel";
import styles from "./TaskCollaboration.module.css";

const stateLabels = {
  pending: ["شروع‌نشده", "Not started"],
  working: ["در حال انجام", "Working"], submitted: ["تحویل‌شده", "Submitted"],
  approved: ["تأییدشده", "Approved"], returned: ["نیازمند اصلاح", "Changes requested"],
};

/** Also used in the Create Task modal: team selection is separate from work submissions. */
export function CollaborationSettings({ primaryId, mode, members, leadResponsibility = "", onChange, people, locale = "fa", disabled = false, allowSolo = true }) {
  const fa = locale === "fa";
  const selected = new Set(members.map((m) => m.userId));
  const choices = [
    { id: "solo", icon: "user", title: fa ? "انفرادی" : "Individual", subtitle: fa ? "یک مسئول و یک گزارش" : "One assignee, one report" },
    { id: "free", icon: "team", title: fa ? "همکاری آزاد" : "Shared work", subtitle: fa ? "اعضای برابر · شروع مستقل · تحویل گروهی" : "Equal members · own starts · team handover" },
    { id: "split", icon: "list", title: fa ? "تقسیم مسئولیت" : "Divided work", subtitle: fa ? "مسئول مشخص · وظایف و تأیید مستقل" : "Assigned lead · separate review" },
  ];
  return <section className={styles.settings} aria-label={fa ? "نوع همکاری" : "Collaboration mode"}>
    <div className={styles.modeChoices}>{choices.filter((item) => allowSolo || item.id !== "solo").map((item) => <label key={item.id} className={`${styles.mode} ${mode === item.id ? styles.selected : ""}`}>
      <input type="radio" name="task-collaboration-mode" checked={mode === item.id} disabled={disabled} onChange={() => onChange({ mode: item.id, members: item.id === "solo" ? [] : item.id === "split" ? members.filter((m) => m.userId !== primaryId) : [...members, ...(mode === "split" && primaryId && !selected.has(primaryId) ? [{ userId: primaryId, responsibility: "", due: null }] : [])], leadResponsibility })} />
      <Icon name={item.icon} /><strong>{item.title}</strong><small>{item.subtitle}</small>
    </label>)}</div>
    {mode !== "solo" && <div className={styles.memberPicker}>
      <div className={styles.sectionHeading}><strong>{mode === "free" ? (fa ? "اعضای گروه" : "Team members") : (fa ? "همکاران" : "Collaborators")}</strong><small>{mode === "free" ? (fa ? "حداقل ۲ نفر؛ هیچ مسئول اصلی تعیین نمی‌شود." : "At least 2 people; no designated lead.") : (fa ? "مسئول اصلی را در بخش واگذاری مشخص کنید." : "Choose a lead in assignment settings.")}</small></div>
      {mode === "split" && <label className={styles.leadField}>{fa ? "مسئولیت فرد اصلی" : "Lead's responsibility"}<input className="input" disabled={disabled} maxLength={2000} value={leadResponsibility} placeholder={fa ? "سهم مسئول اصلی را مشخص کنید" : "Define the lead's part"} onChange={(e) => onChange({ mode, members, leadResponsibility: e.target.value })} /></label>}
      <div className={styles.membersList}>
        {people.filter((person) => mode === "free" || person.id !== primaryId).map((person) => <div className={styles.memberOption} key={person.id}>
          <label><input type="checkbox" checked={selected.has(person.id)} disabled={disabled} onChange={(e) => onChange({ mode, leadResponsibility, members: e.target.checked ? [...members, { userId: person.id, responsibility: "", due: null }] : members.filter((m) => m.userId !== person.id) })} /><span>{person.name}</span><small>{person.team}</small></label>
          {selected.has(person.id) && <input className="input" disabled={disabled} maxLength={2000} value={members.find((m) => m.userId === person.id)?.responsibility ?? ""} placeholder={mode === "free" ? (fa ? "این نفر قرار است چه کاری انجام دهد؟ (اختیاری)" : "Planned work for this member (optional)") : (fa ? "مسئولیت این فرد را مشخص کنید" : "Define this person's responsibility")} aria-label={`${person.name} — ${fa ? "شرح سهم کار" : "Work scope"}`} onChange={(e) => onChange({ mode, leadResponsibility, members: members.map((m) => m.userId === person.id ? { ...m, responsibility: e.target.value } : m) })} />}
        </div>)}
      </div>
      <p className={styles.helper}>{mode === "free" ? (fa ? "هر نفر در زمان خودش شروع و گزارشش را تحویل می‌دهد؛ پس از تحویل همه، گزارش مشترک برای مدیر ارسال می‌شود." : "Everyone starts and submits independently. The complete team report reaches the manager only when everyone submits.") : (fa ? "هر همکار گزارش خود را تحویل می‌دهد؛ مدیر می‌تواند همان بخش را مستقل تأیید یا برگشت بزند." : "Each collaborator submits their own report for separate manager review.")}</p>
    </div>}
  </section>;
}

const memberStarted = (member) => !!(member?.startedAt || member?.revision);
const memberSteps = (member) => [
  memberStarted(member), !!member.workPerformed, !!member.outcome,
  !!member.hoursRecorded, ["submitted", "approved"].includes(member.state)
];
const memberProgress = (member) => memberSteps(member).filter(Boolean).length;
const memberTone = (member) => member.state === "returned" ? "returned"
  : member.state === "approved" ? "approved"
    : member.state === "submitted" ? "submitted"
      : memberStarted(member) ? "working" : "pending";
const memberStatus = (member, fa) => member.removed ? (fa ? "خارج‌شده" : "Removed")
  : stateLabels[member.state === "working" && !memberStarted(member) ? "pending" : member.state]?.[fa ? 0 : 1];

function evidenceLinks(value) {
  const rows = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length > 10) return null;
  for (const line of rows) {
    try {
      const url = new URL(line);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password || line.length > 2048) return null;
    } catch { return null; }
  }
  return rows;
}

export default function TaskCollaboration({ task, details, setData }) {
  const { me, users, dispatch, toast } = useApp();
  const { locale, number } = useI18n();
  const router = useRouter();
  const fa = locale === "fa";
  const { mode, members } = details.collaboration;
  const active = members.filter((member) => !member.removed);
  const current = active.find((member) => member.userId === me.id);
  const manager = canReviewTask(me, task);
  const [editing, setEditing] = useState(false);
  const [configuration, setConfiguration] = useState({
    mode, leadResponsibility: members.find((member) => member.isLead)?.responsibility || "",
    members: active.filter((member) => mode === "free" || !member.isLead)
      .map((member) => ({ userId: member.userId, responsibility: member.responsibility, due: member.due }))
  });
  const initialHours = current?.hoursRecorded ? String(current.hours) : "";
  const [work, setWork] = useState(current?.workPerformed ?? "");
  const [outcome, setOutcome] = useState(current?.outcome ?? "");
  const [hours, setHours] = useState(initialHours);
  const [links, setLinks] = useState((current?.links ?? []).join("\n"));
  const [stage, setStage] = useState(() => !memberStarted(current) ? "start"
    : !current.workPerformed ? "work" : !current.outcome ? "outcome"
      : !current.hoursRecorded ? "hours" : "handover");
  const [returning, setReturning] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const saved = useRef({ work, outcome, hours, links });
  const allowLeave = useRef(false);
  const available = useMemo(() => users.filter((user) => user.active !== false && canAssignTask(me, user)), [users, me]);
  const dirty = work !== saved.current.work || outcome !== saved.current.outcome || hours !== saved.current.hours || links !== saved.current.links;
  const started = memberStarted(current);
  const canStart = !!current && me.role !== "observer" && !started && current.state === "working" && ["backlog", "todo", "progress", "returned"].includes(task.status);
  const canWrite = !!current && started && ["working", "returned"].includes(current.state) && ["progress", "returned"].includes(task.status);
  const canConfigure = manager && ["backlog", "todo", "progress", "returned"].includes(task.status);
  const submitted = active.filter((member) => ["submitted", "approved"].includes(member.state)).length;
  const allSubmitted = active.length > 0 && submitted === active.length;
  const remaining = active.length - submitted;
  const disabled = busy || conflict;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ""; } };
    const intercept = (event) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTarget(target.href);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", intercept, true); };
  }, [dirty]);

  const clearError = () => { setError(""); setInvalidField(""); setMessage(""); setConflict(false); };
  const save = async (body, nextStage) => {
    if (busy || conflict) return false;
    setBusy(true);
    setError("");
    setInvalidField("");
    try {
      const result = await api("/api/tasks/" + task.id + "/collaboration", { method: "PATCH", body });
      if (["save", "submit"].includes(body.action)) saved.current = { work, outcome, hours, links };
      dispatch({ type: "task/update", id: task.id, patch: result.task });
      setData((previous) => previous ? ({ ...previous, details: result.details, transitions: result.transitions }) : previous);
      if (nextStage) setStage(nextStage);
      setMessage(body.action === "start" ? (fa ? "بخش شما شروع شد." : "Your work has started.")
        : body.action === "submit" ? (fa ? "گزارش شما تحویل شد." : "Your report was submitted.")
          : (fa ? "پیش‌نویس ذخیره شد." : "Draft saved."));
      if (body.action === "submit" || body.action === "start") toast(body.action === "start" ? (fa ? "شروع کار ثبت شد" : "Work started") : (fa ? "گزارش شما تحویل داده شد" : "Report submitted"));
      return true;
    } catch (failure) {
      setError(failure.message || (fa ? "ذخیره انجام نشد؛ دوباره تلاش کنید." : "Could not save. Try again."));
      if (failure.status === 409 || failure.message?.toLowerCase().includes("refresh")) setConflict(true);
      return false;
    } finally { setBusy(false); }
  };

  const validate = (through) => {
    if (through !== "save" && !work.trim()) {
      setInvalidField("work"); setError(fa ? "ابتدا اقدامات انجام‌شده را بنویسید." : "Describe what you did first."); setStage("work"); return false;
    }
    if (["hours", "handover"].includes(through) && !outcome.trim()) {
      setInvalidField("outcome"); setError(fa ? "نتیجه کار را تکمیل کنید." : "Complete the outcome."); setStage("outcome"); return false;
    }
    if (hours.trim() && parseTaskHours(hours) === null || through === "handover" && parseTaskHours(hours) === null) {
      setInvalidField("hours"); setError(fa ? "ساعت را بین ۰ تا ۱۰۰۰ وارد کنید؛ مثلاً ۱٫۵." : "Enter 0–1000 hours, e.g. 1.5."); setStage("hours"); return false;
    }
    if (!evidenceLinks(links)) {
      setInvalidField("links"); setError(fa ? "حداکثر ۱۰ لینک معتبر http یا https وارد کنید." : "Enter up to 10 valid http(s) evidence links."); setStage("outcome"); return false;
    }
    setInvalidField(""); setError("");
    return true;
  };

  const saveReport = (nextStage, action = "save") => {
    if (!current || !validate(action === "submit" ? "handover" : nextStage || "save")) return;
    save({
      action, revision: current.revision, workPerformed: work, outcome,
      hours: hours.trim() ? parseTaskHours(hours) : null, links: evidenceLinks(links)
    }, nextStage);
  };

  const handleConfiguration = async () => {
    if (configuration.mode === "free" && configuration.members.length < 2 || configuration.mode === "split" && !configuration.members.length) {
      setError(fa ? "حداقل تعداد اعضا را انتخاب کنید." : "Select enough team members."); return;
    }
    if (configuration.mode === "split" && (!configuration.leadResponsibility.trim() || configuration.members.some((member) => !member.responsibility.trim()))) {
      setError(fa ? "مسئولیت هر نفر را مشخص کنید." : "Define each person's responsibility."); return;
    }
    if (await save({ action: "configure", collaboration: {
      ...configuration, ...(configuration.mode === "free" ? { allMembers: true } : {})
    } })) setEditing(false);
  };

  const open = (next) => canWrite ? () => { clearError(); setStage(next); } : undefined;
  const stepState = (next, complete) => canWrite && stage === next ? "active" : complete ? "done" : "upcoming";
  const savedWork = current?.workPerformed || "";
  const savedOutcome = current?.outcome || "";
  const savedHours = current?.hoursRecorded ? (fa ? number(current.hours) + " ساعت" : number(current.hours) + " hrs") : "";
  const reportSent = !!current && ["submitted", "approved"].includes(current.state);

  return <section className={styles.wrapper} aria-label={fa ? "همکاری روی تسک" : "Task collaboration"} data-testid="task-collaboration">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>{fa ? "فضای همکاری تیم" : "TEAM WORKSPACE"}</span>
        <h2>{mode === "free" ? (fa ? "همکاری آزاد" : "Shared work") : (fa ? "تقسیم مسئولیت" : "Divided responsibilities")}</h2>
        <p>{mode === "free"
          ? (fa ? "همه اعضا برابرند. هر نفر مستقل شروع می‌کند؛ گزارش گروه پس از تحویل همه به مدیر می‌رسد." : "Everyone is equal. Start independently; the manager receives the team report when everyone submits.")
          : (fa ? "هر نفر مسئول بخش مشخصی است و گزارش او جداگانه توسط مدیر تأیید می‌شود." : "Each person owns an assigned part, reviewed independently by a manager.")}</p>
      </div>
      {canConfigure && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setEditing(!editing); setError(""); }}><Icon name="edit" />{fa ? "ویرایش تیم" : "Edit team"}</button>}
    </header>
    <div className={styles.teamPulse} aria-label={fa ? "پیشرفت تیم" : "Team progress"}>
      <div><strong>{number(submitted)} <span>/ {number(active.length)}</span></strong><span>{fa ? "گزارش تحویل‌شده" : "reports submitted"}</span></div>
      <div className={styles.pulseTrack} role="progressbar" aria-label={fa ? "پیشرفت تحویل تیم" : "Team handover progress"} aria-valuemin={0} aria-valuemax={active.length} aria-valuenow={submitted}><span style={{ width: (active.length ? submitted / active.length * 100 : 0) + "%" }} /></div>
      <p>{allSubmitted ? (fa ? "گزارش‌ها کامل‌اند؛ نوبت بازبینی مدیر است." : "All reports in. Ready for manager review.")
        : mode === "free" ? (fa ? number(remaining) + " نفر دیگر باید گزارش خود را تحویل دهند." : number(remaining) + " members still need to submit.")
          : (fa ? number(remaining) + " بخش هنوز تحویل نشده است." : number(remaining) + " parts not yet submitted.")}</p>
    </div>

    {editing && <div className={styles.editBox}>
      <CollaborationSettings primaryId={task.a} people={available} locale={locale} mode={configuration.mode} members={configuration.members} leadResponsibility={configuration.leadResponsibility} onChange={setConfiguration} disabled={busy} allowSolo={false} />
      <div className={styles.actions}><button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>{fa ? "انصراف" : "Cancel"}</button><button type="button" className="btn btn-primary" disabled={busy} onClick={handleConfiguration}>{fa ? "ذخیره اعضا" : "Save team"}</button></div>
    </div>}

    {current && <div className={styles.myWorkspace}>
      <div className={styles.personalHeader}>
        <span className={styles.personalIcon}><Icon name="user" /></span>
        <div><span className={styles.eyebrow}>{fa ? "مسیر کار من" : "MY WORKFLOW"}</span><h3>{fa ? "گزارش " + me.name : me.name + "'s report"}</h3>
          <p>{mode === "split" ? current.responsibility || (fa ? "سهم کاری من" : "My responsibility")
            : fa ? "کار خود را مرحله‌به‌مرحله ثبت و مستقل تحویل دهید." : "Record each step of your work, then submit your own report."}</p></div>
        <span className={styles.state + " " + (styles[current.state] || "")}>{memberStatus(current, fa)}</span>
      </div>
      {current.state === "returned" && <div className={styles.returnNote} role="status"><strong>{fa ? "اصلاح گزارش" : "Changes requested"}</strong><p dir="auto">{current.returnReason || (fa ? "لطفاً گزارش خود را بازبینی کنید." : "Please review your report.")}</p></div>}
      {reportSent ? <div className={styles.submittedBox} role="status">
        <Icon name="checkCircle" />
        <div><strong>{current.state === "approved" ? (fa ? "بخش شما تأیید شد" : "Your part is approved") : (fa ? "گزارش شما تحویل شد" : "Your report is submitted")}</strong>
          <p>{mode === "free" && !allSubmitted ? (fa ? "گزارش شما محفوظ است؛ منتظر تحویل بقیه اعضا هستیم." : "Your report is saved; we're waiting for the rest of the team.")
            : (fa ? "گزارش شما ثبت شده است و نیاز به ارسال دوباره ندارد." : "Your work has been recorded. No need to resubmit.")}</p></div>
      </div> : <ol className="task-flow-list" aria-label={fa ? "مراحل گزارش من" : "My report steps"}>
        <TaskFlowStep number={1} title={fa ? "شروع بخش من" : "Start my work"} note={fa ? "اولین قدم" : "First step"} state={started ? "done" : "active"} preview={started && current.startedAt ? taskWhen(current.startedAt, locale) : null}>
          <p className="task-flow-lead">{fa ? "پس از بررسی توضیحات تسک، بخش خود را شروع کنید تا فرم گزارش فعال شود." : "Read the task brief, then start your part to unlock the report."}</p>
          <div className="task-flow-actions is-start">{canStart ? <button type="button" className="btn btn-primary" disabled={disabled} aria-busy={busy} onClick={() => save({ action: "start" }, "work")}>{fa ? "شروع کار من" : "Start my work"}<Icon name="arrowRight" size="sm" /></button>
            : <span className={styles.muted}>{fa ? "شروع در وضعیت فعلی تسک امکان‌پذیر نیست." : "Starting is unavailable at this task stage."}</span>}</div>
        </TaskFlowStep>
        <TaskFlowStep number={2} title={fa ? "اقدامات انجام‌شده" : "Work performed"} note={fa ? "الزامی" : "Required"} state={stepState("work", !!savedWork)} onOpen={open("work")} preview={savedWork && <p dir="auto">{savedWork}</p>}>
          <Field label={fa ? "چه کارهایی انجام دادید؟" : "What did you do?"} htmlFor="collab-work" error={invalidField === "work" ? error : null} hint={fa ? "اقدامات خودتان را بنویسید، نه کل تیم." : "Describe your own actions, not the whole team's."}>
            <textarea id="collab-work" className="textarea" rows={4} maxLength={10000} value={work} dir="auto" disabled={disabled} onChange={(event) => { setWork(event.target.value); clearError(); }} />
          </Field>
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled || !dirty} onClick={() => saveReport()}>{fa ? "ذخیره پیش‌نویس" : "Save draft"}</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveReport("outcome")}>{fa ? "ادامه" : "Continue"}<Icon name="arrowRight" size="sm" /></button></div>
        </TaskFlowStep>
        <TaskFlowStep number={3} title={fa ? "نتیجه و مستندات" : "Outcome & evidence"} note={fa ? "نتیجه الزامی · لینک اختیاری" : "Result required · Link optional"} state={stepState("outcome", !!savedOutcome)} onOpen={open("outcome")} preview={savedOutcome && <p dir="auto">{savedOutcome}</p>}>
          <Field label={fa ? "نتیجه کار شما چه بود؟" : "What was your outcome?"} htmlFor="collab-outcome" error={invalidField === "outcome" ? error : null}>
            <textarea id="collab-outcome" className="textarea" rows={3} maxLength={10000} value={outcome} dir="auto" disabled={disabled} onChange={(event) => { setOutcome(event.target.value); clearError(); }} />
          </Field>
          <Field label={fa ? "لینک شواهد (اختیاری)" : "Evidence links (optional)"} htmlFor="collab-links" hint={fa ? "هر لینک در یک خط؛ حداکثر ۱۰ لینک." : "One per line, up to 10 links."} error={invalidField === "links" ? error : null}>
            <textarea id="collab-links" className="textarea" rows={2} value={links} dir="ltr" disabled={disabled} placeholder="https://…" onChange={(event) => { setLinks(event.target.value); clearError(); }} />
          </Field>
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setStage("work")}>{fa ? "بازگشت" : "Back"}</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveReport("hours")}>{fa ? "ادامه" : "Continue"}<Icon name="arrowRight" size="sm" /></button></div>
        </TaskFlowStep>
        <TaskFlowStep number={4} title={fa ? "زمان فعالیت" : "Time spent"} note={fa ? "ثبت ساعت واقعی" : "Actual hours"} state={stepState("hours", !!current.hoursRecorded)} onOpen={open("hours")} preview={savedHours}>
          <Field label={fa ? "مجموع ساعت کار شما" : "Your total hours"} htmlFor="collab-hours" hint={fa ? "مثلاً ۱٫۵ برای یک ساعت و نیم. اگر زمان صفر بوده، ۰ وارد کنید." : "For 90 minutes enter 1.5. Enter 0 if no time was spent."} error={invalidField === "hours" ? error : null}>
            <input id="collab-hours" className="input task-hours-input" type="text" inputMode="decimal" value={hours} disabled={disabled} onChange={(event) => { setHours(event.target.value); clearError(); }} />
          </Field>
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled || !dirty} onClick={() => saveReport()}>{fa ? "ذخیره پیش‌نویس" : "Save draft"}</button><button type="button" className="btn btn-primary" disabled={disabled} onClick={() => saveReport("handover")}>{fa ? "بازبینی گزارش" : "Review report"}<Icon name="arrowRight" size="sm" /></button></div>
        </TaskFlowStep>
        <TaskFlowStep number={5} title={fa ? "بازبینی و تحویل من" : "Review & hand over"} note={fa ? "گزارش خودم، نه دیگران" : "Only your report"} state={stepState("handover", false)} onOpen={open("handover")}>
          <dl className="task-report-facts">
            <div><dt>{fa ? "اقدامات" : "Work"}</dt><dd dir="auto">{work || "—"}</dd></div>
            <div><dt>{fa ? "نتیجه" : "Outcome"}</dt><dd dir="auto">{outcome || "—"}</dd></div>
            <div><dt>{fa ? "زمان" : "Time"}</dt><dd>{hours || "—"} {fa ? "ساعت" : "hrs"}</dd></div>
            <div><dt>{fa ? "تعداد لینک‌ها" : "Evidence links"}</dt><dd>{number(links.split(/\r?\n/).filter(Boolean).length)}</dd></div>
          </dl>
          <p className={styles.handoverNote}>{mode === "free"
            ? (fa ? "با تحویل شما، فقط بخش خودتان ثبت می‌شود. بعد از تحویل تمام اعضا، گزارش مشترک به مدیر می‌رسد." : "Submitting saves only your part. The manager receives the combined report after everyone submits.")
            : (fa ? "بخش شما مستقلاً برای تأیید مدیر آماده می‌شود." : "Your part will be reviewed independently by a manager.")}</p>
          <div className="task-flow-actions"><button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setStage("hours")}>{fa ? "بازگشت" : "Back"}</button><button type="button" className="btn btn-primary" disabled={disabled} aria-busy={busy} onClick={() => saveReport(undefined, "submit")}>{fa ? "تحویل گزارش من" : "Submit my report"}</button></div>
        </TaskFlowStep>
      </ol>}
      {canWrite && <p className={styles.draftStatus} role="status">{message || (dirty ? (fa ? "تغییرات ذخیره‌نشده دارید" : "Unsaved changes") : (fa ? "تغییرات ذخیره شده‌اند" : "All changes saved"))}</p>}
    </div>}

    <section className={styles.teamSection} aria-label={fa ? "اعضای تیم و گزارش‌ها" : "Team members and reports"}>
      <div className={styles.sectionHeading}>
        <div><h3>{fa ? "اعضا و سهم هر نفر" : "Members & contributions"}</h3><p>{fa ? "گزارش هر نفر را باز کنید و جزئیات کارش را ببینید." : "Open a member to see their work and evidence."}</p></div>
        <span className={styles.teamCount}><Icon name="team" size="sm" />{number(active.length)} {fa ? "عضو" : "members"}</span>
      </div>
      <div className={styles.entries}>{active.map((member) => <details className={styles.member + (member.userId === me.id ? " " + styles.mine : "")} key={member.userId} data-tone={memberTone(member)}>
        <summary className={styles.memberHeader}>
          <span className={styles.memberIdentity}>
            <span className={styles.avatar} aria-hidden="true">{member.name?.trim()?.[0] || "?"}</span>
            <span className={styles.memberName}>
              <span className={styles.memberTitle}><strong dir="auto">{member.name}</strong>{member.userId === me.id && <small className={styles.youBadge}>{fa ? "شما" : "You"}</small>}</span>
              {mode === "split" && member.isLead && <small className={styles.coordinator}><Icon name="team" size="sm" />{fa ? "هماهنگ‌کننده" : "Coordinator"}</small>}
              {member.responsibility && <span className={styles.memberScope} dir="auto">{member.responsibility}</span>}
            </span>
          </span>
          <span className={styles.memberSteps}>
            <span className={styles.progressLabel}><strong>{number(memberProgress(member))} <span>/ {number(5)}</span></strong>{fa ? " مرحله ثبت‌شده" : " steps recorded"}</span>
            <span className={styles.memberRail} role="img" aria-label={fa ? number(memberProgress(member)) + " مرحله از ۵ مرحله گزارش ثبت شده است" : memberProgress(member) + " of 5 report steps recorded"}>
              {memberSteps(member).map((done, index) => <span key={index} data-complete={done ? "true" : "false"} className={done ? styles.railDone : ""} aria-hidden="true" />)}
            </span>
          </span>
          <span className={styles.memberState}><Icon name={member.state === "returned" ? "alert" : ["submitted", "approved"].includes(member.state) ? "checkCircle" : "clock"} size="sm" />{memberStatus(member, fa)}</span>
          <span className={styles.memberToggle} aria-hidden="true"><Icon name="down" size="sm" /></span>
        </summary>
        <div className={styles.memberBody}>
          {member.responsibility && <div className={styles.memberBrief}><span>{fa ? "سهم کار" : "Assigned scope"}</span><p dir="auto">{member.responsibility}</p></div>}
          {mode === "split" && member.due && <p className={styles.muted}>{fa ? "مهلت: " : "Due: "}{taskDate(member.due, locale)}</p>}
          {member.workPerformed || member.outcome || member.hoursRecorded || member.links.length ? <dl className={styles.memberReport}>
            <div><dt>{fa ? "اقدامات" : "Work"}</dt><dd dir="auto">{member.workPerformed || "—"}</dd></div>
            <div><dt>{fa ? "نتیجه" : "Outcome"}</dt><dd dir="auto">{member.outcome || "—"}</dd></div>
            <div><dt>{fa ? "زمان" : "Time"}</dt><dd>{member.hoursRecorded ? number(member.hours) + (fa ? " ساعت" : " hrs") : "—"}</dd></div>
            {member.links.length > 0 && <div><dt>{fa ? "شواهد" : "Evidence"}</dt><dd>{member.links.map((url) => <a key={url} href={url} rel="noopener noreferrer" target="_blank" className={styles.link} dir="ltr"><Icon name="link" size="sm" />{url}</a>)}</dd></div>}
          </dl> : <p className={styles.muted}>{fa ? "هنوز گزارشی ثبت نکرده است." : "No report recorded yet."}</p>}
          {member.returnReason && member.state === "returned" && <p className={styles.returnNote} dir="auto">{fa ? "درخواست اصلاح: " : "Changes requested: "}{member.returnReason}</p>}
          {manager && mode === "split" && member.state === "submitted" && <div className={styles.actions}>
            <button className="btn btn-secondary btn-sm" disabled={busy || member.userId === me.id} onClick={() => { setReturning(member.userId); setReturnReason(""); }} type="button">{fa ? "درخواست اصلاح" : "Request changes"}</button>
            <button className="btn btn-primary btn-sm" disabled={busy || member.userId === me.id} onClick={() => save({ action: "approve", userId: member.userId })} type="button">{fa ? "تأیید این بخش" : "Approve part"}</button>
          </div>}
          {returning === member.userId && <div className={styles.returnBox}><textarea className="textarea" dir="auto" rows={2} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder={fa ? "دلیل اصلاح را بنویسید" : "Explain requested changes"}/><div className={styles.actions}><button type="button" className="btn btn-ghost btn-sm" onClick={() => setReturning(null)}>{fa ? "انصراف" : "Cancel"}</button><button type="button" className="btn btn-secondary btn-sm" disabled={!returnReason.trim() || busy} onClick={async () => { if (await save({ action: "return", userId: member.userId, reason: returnReason })) setReturning(null); }}>{fa ? "ثبت درخواست اصلاح" : "Request changes"}</button></div></div>}
        </div>
      </details>)}</div>
    </section>
    {!current && !manager && <p className={styles.muted}>{fa ? "شما عضو فعال این همکاری نیستید؛ گزارش‌های گروه برای مشاهده در دسترس‌اند." : "You are not an active contributor, but can read the team reports."}</p>}
    {error && <div className={styles.error} role="alert"><FormAlert>{error}</FormAlert>{conflict && <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>{fa ? "بارگذاری اطلاعات جدید" : "Reload latest version"}</button>}</div>}
    {leaveTarget && <Dialog label={fa ? "تغییرات ذخیره‌نشده" : "Unsaved report"} title={fa ? "بدون ذخیره از صفحه خارج می‌شوید؟" : "Leave without saving?"} description={fa ? "آخرین تغییرات گزارش شما ذخیره نشده است." : "Your report has unsaved changes."} onClose={() => setLeaveTarget(null)} width={440}>
      <div className="modal-foot"><button type="button" className="btn btn-secondary" onClick={() => setLeaveTarget(null)}>{fa ? "ادامه ویرایش" : "Keep editing"}</button><button type="button" className="btn btn-danger" onClick={() => { allowLeave.current = true; const target = new URL(leaveTarget); if (target.origin === window.location.origin) router.push(target.pathname + target.search + target.hash); else window.location.assign(target.href); }}>{fa ? "خروج بدون ذخیره" : "Leave without saving"}</button></div>
    </Dialog>}
  </section>;
}
