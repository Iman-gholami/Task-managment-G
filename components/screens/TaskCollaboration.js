"use client";

import { useMemo, useState } from "react";
import { useApp, api } from "@/components/AppProvider";
import { useI18n } from "@/components/I18nProvider";
import Icon from "@/components/ui/Icon";
import { canAssignTask, canReviewTask } from "@/lib/roles";
import { taskDate } from "@/lib/task-date";
import styles from "./TaskCollaboration.module.css";

const stateLabels = {
  working: ["در حال انجام", "Working"], submitted: ["تحویل داده‌شده", "Submitted"],
  approved: ["تأییدشده", "Approved"], returned: ["نیازمند اصلاح", "Changes requested"],
};
const validHours = (value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1000;

/** Also used in the Create Task modal: team selection is separate from work submissions. */
export function CollaborationSettings({ primaryId, mode, members, leadResponsibility = "", onChange, people, locale = "fa", disabled = false, allowSolo = true }) {
  const fa = locale === "fa";
  const selected = new Set(members.map((m) => m.userId));
  const choices = [
    { id: "solo", icon: "user", title: fa ? "انفرادی" : "Individual", subtitle: fa ? "یک مسئول و یک گزارش" : "One assignee, one report" },
    { id: "free", icon: "chat", title: fa ? "همکاری آزاد" : "Shared work", subtitle: fa ? "گزارش‌های قابل مشاهده برای همه" : "Shared activity and reports" },
    { id: "split", icon: "list", title: fa ? "تقسیم مسئولیت" : "Divided work", subtitle: fa ? "تحویل و تأیید مجزای هر نفر" : "Individual handover and approval" },
  ];
  return <section className={styles.settings} aria-label={fa ? "نوع همکاری" : "Collaboration mode"}>
    <div className={styles.modeChoices}>{choices.filter((item) => allowSolo || item.id !== "solo").map((item) => <label key={item.id} className={`${styles.mode} ${mode === item.id ? styles.selected : ""}`}>
      <input type="radio" name="task-collaboration-mode" checked={mode === item.id} disabled={disabled} onChange={() => onChange({ mode: item.id, members: item.id === "solo" ? [] : members, leadResponsibility })} />
      <Icon name={item.icon} /><strong>{item.title}</strong><small>{item.subtitle}</small>
    </label>)}</div>
    {mode !== "solo" && <div className={styles.memberPicker}>
      <div className={styles.sectionHeading}><strong>{fa ? "همکاران" : "Collaborators"}</strong><small>{fa ? "مسئول اصلی از قبل انتخاب شده است." : "The primary assignee is selected above."}</small></div>
      {mode === "split" && <label className={styles.leadField}>{fa ? "مسئولیت فرد اصلی" : "Lead's responsibility"}<input className="input" disabled={disabled} maxLength={2000} value={leadResponsibility} placeholder={fa ? "سهم مسئول اصلی را مشخص کنید" : "Define the lead's part"} onChange={(e) => onChange({ mode, members, leadResponsibility: e.target.value })} /></label>}
      <div className={styles.membersList}>
        {people.filter((person) => person.id !== primaryId).map((person) => <div className={styles.memberOption} key={person.id}>
          <label><input type="checkbox" checked={selected.has(person.id)} disabled={disabled} onChange={(e) => onChange({ mode, leadResponsibility, members: e.target.checked ? [...members, { userId: person.id, responsibility: "", due: null }] : members.filter((m) => m.userId !== person.id) })} /><span>{person.name}</span><small>{person.team}</small></label>
          {mode === "split" && selected.has(person.id) && <input className="input" disabled={disabled} maxLength={2000} value={members.find((m) => m.userId === person.id)?.responsibility ?? ""} placeholder={fa ? "مسئولیت این فرد را مشخص کنید" : "Define this person's responsibility"} aria-label={`${person.name} — ${fa ? "مسئولیت" : "Responsibility"}`} onChange={(e) => onChange({ mode, leadResponsibility, members: members.map((m) => m.userId === person.id ? { ...m, responsibility: e.target.value } : m) })} />}
        </div>)}
      </div>
      {mode === "split" && <p className={styles.helper}>{fa ? "هر همکار گزارش خود را تحویل می‌دهد؛ مدیر می‌تواند همان بخش را مستقل تأیید یا برگشت بزند." : "Each collaborator submits their own report for separate manager review."}</p>}
    </div>}
  </section>;
}

export default function TaskCollaboration({ task, details, setData }) {
  const { me, users, dispatch, toast } = useApp();
  const { locale } = useI18n();
  const fa = locale === "fa";
  const { mode, members } = details.collaboration;
  const current = members.find((m) => m.userId === me.id && !m.removed);
  const manager = canReviewTask(me, task);
  const [editing, setEditing] = useState(false);
  const [configuration, setConfiguration] = useState({ mode, leadResponsibility: members.find((m) => m.isLead)?.responsibility || "", members: members.filter((m) => !m.removed && !m.isLead).map((m) => ({ userId: m.userId, responsibility: m.responsibility, due: m.due })) });
  const [work, setWork] = useState(current?.workPerformed ?? "");
  const [outcome, setOutcome] = useState(current?.outcome ?? "");
  const [hours, setHours] = useState(String(current?.hours ?? 0));
  const [links, setLinks] = useState((current?.links ?? []).join("\n"));
  const [returning, setReturning] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = useMemo(() => users.filter((p) => p.active !== false && canAssignTask(me, p)), [users, me]);
  const canWrite = current && !["submitted", "approved"].includes(current.state) && ["progress", "returned"].includes(task.status);
  const canConfigure = manager && ["backlog", "todo", "progress", "returned"].includes(task.status);
  const memberCount = members.filter((m) => !m.removed).length;
  const save = async (body) => {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const result = await api(`/api/tasks/${task.id}/collaboration`, { method: "PATCH", body });
      dispatch({ type: "task/update", id: task.id, patch: result.task });
      setData((previous) => ({ ...previous, details: result.details, transitions: result.transitions }));
      toast(fa ? "تغییرات ثبت شد" : "Changes saved");
      return true;
    } catch (failure) { setError(failure.message || (fa ? "ذخیره انجام نشد." : "Could not save.")); return false; }
    finally { setBusy(false); }
  };
  const submitReport = (action) => {
    const evidence = links.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!validHours(hours) || (action !== "save" && (!work.trim() || !outcome.trim()))) {
      setError(fa ? "شرح کار، نتیجه و ساعت فعالیت را تکمیل کنید." : "Enter work, outcome and valid hours."); return;
    }
    save({ action, revision: current.revision, workPerformed: work, outcome, hours: Number(hours), links: evidence });
  };
  const handleConfiguration = async () => {
    if (configuration.mode === "solo" || !configuration.members.length) { setError(fa ? "حداقل یک همکار انتخاب کنید." : "Choose at least one collaborator."); return; }
    if (configuration.mode === "split" && (!configuration.leadResponsibility.trim() || configuration.members.some((m) => !m.responsibility.trim()))) { setError(fa ? "مسئولیت هر نفر را مشخص کنید." : "Define each person's responsibility."); return; }
    const ok = await save({ action: "configure", collaboration: configuration });
    if (ok) setEditing(false);
  };
  return <section className={styles.wrapper} aria-label={fa ? "همکاری روی تسک" : "Task collaboration"} data-testid="task-collaboration">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>{fa ? "محیط کار مشترک" : "SHARED WORKSPACE"}</span><h2>{mode === "split" ? (fa ? "تقسیم مسئولیت" : "Divided responsibilities") : (fa ? "همکاری آزاد" : "Shared work")}</h2>
        <p>{fa ? `${memberCount} نفر روی این تسک همکاری می‌کنند. تمام گزارش‌ها و فعالیت‌ها برای اعضا قابل مشاهده است.` : `${memberCount} people are collaborating; reports are shared with all members.`}</p></div>
      {canConfigure && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing((v) => !v)}><Icon name="edit" />{fa ? "مدیریت همکاران" : "Manage members"}</button>}
    </header>
    {editing && <div className={styles.editBox}><CollaborationSettings primaryId={task.a} people={available} locale={locale} mode={configuration.mode} members={configuration.members} leadResponsibility={configuration.leadResponsibility} onChange={setConfiguration} disabled={busy} allowSolo={false} /><div className={styles.actions}><button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>{fa ? "انصراف" : "Cancel"}</button><button type="button" className="btn btn-primary" disabled={busy} onClick={handleConfiguration}>{fa ? "ذخیره تیم" : "Save members"}</button></div></div>}
    <div className={styles.entries}>{members.map((m) => <article className={`${styles.member} ${m.userId === me.id ? styles.mine : ""}`} key={m.userId}>
      <div className={styles.memberHeader}><span className={styles.avatar}>{m.name?.trim()?.[0] || "?"}</span><div><strong>{m.name}{m.isLead ? (fa ? " · مسئول اصلی" : " · Lead") : ""}</strong>{mode === "split" && !!m.responsibility && <small dir="auto">{m.responsibility}</small>}</div>
        <span className={`${styles.state} ${styles[m.state] ?? ""}`}>{m.removed ? (fa ? "خارج‌شده" : "Removed") : stateLabels[m.state]?.[fa ? 0 : 1]}</span></div>
      {m.due && <small className={styles.due}>{fa ? "مهلت" : "Due"}: {taskDate(m.due, locale)}</small>}
      {m.workPerformed || m.outcome || m.hours || m.links.length ? <div className={styles.report}>
        {m.workPerformed && <p dir="auto"><b>{fa ? "اقدامات: " : "Work: "}</b>{m.workPerformed}</p>}
        {m.outcome && <p dir="auto"><b>{fa ? "نتیجه: " : "Outcome: "}</b>{m.outcome}</p>}
        <small>{fa ? "زمان فعالیت" : "Time spent"}: {m.hours} {fa ? "ساعت" : "hours"}</small>
        {m.links.map((url) => <a key={url} href={url} rel="noopener noreferrer" target="_blank" className={styles.link} dir="ltr"><Icon name="link" />{url}</a>)}
      </div> : <p className={styles.muted}>{fa ? "هنوز فعالیتی ثبت نشده است." : "No work recorded yet."}</p>}
      {m.returnReason && m.state === "returned" && <p className={styles.returnNote} dir="auto">{fa ? "دلیل برگشت: " : "Return feedback: "}{m.returnReason}</p>}
      {manager && mode === "split" && m.state === "submitted" && !m.removed && <div className={styles.actions}>
        <button className="btn btn-secondary btn-sm" disabled={busy || m.userId === me.id} onClick={() => { setReturning(m.userId); setReturnReason(""); }} type="button">{fa ? "برگشت برای اصلاح" : "Request changes"}</button>
        <button className="btn btn-primary btn-sm" disabled={busy || m.userId === me.id} onClick={() => save({ action: "approve", userId: m.userId })} type="button">{fa ? "تأیید سهم فرد" : "Approve contribution"}</button>
      </div>}
      {returning === m.userId && <div className={styles.returnBox}><textarea className="textarea" dir="auto" rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder={fa ? "دلیل اصلاح را مشخص کنید" : "Describe what needs to change"}/><div className={styles.actions}><button type="button" className="btn btn-ghost btn-sm" onClick={() => setReturning(null)}>{fa ? "انصراف" : "Cancel"}</button><button type="button" className="btn btn-secondary btn-sm" disabled={!returnReason.trim() || busy} onClick={async () => { if (await save({ action: "return", userId: m.userId, reason: returnReason })) setReturning(null); }}>{fa ? "ثبت برگشت" : "Return"}</button></div></div>}
    </article>)}</div>
    {canWrite && <div className={styles.editor}>
      <h3>{fa ? "گزارش فعالیت من" : "My contribution"}</h3>
      <p>{fa ? "تغییرات تو مستقل از گزارش سایر همکاران ذخیره می‌شود." : "Your report is saved independently from your teammates' work."}</p>
      <label>{fa ? "اقدامات انجام‌شده" : "Work performed"}<textarea dir="auto" className="textarea" maxLength={10000} rows={4} value={work} onChange={(e) => setWork(e.target.value)}/></label>
      <label>{fa ? "نتیجه فعالیت" : "Outcome"}<textarea dir="auto" className="textarea" maxLength={10000} rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)}/></label>
      <div className={styles.fields}><label>{fa ? "ساعت فعالیت" : "Hours spent"}<input className="input" type="number" min="0" max="1000" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)}/></label>
        <label>{fa ? "لینک‌ها (هر خط یک لینک)" : "Links (one per line)"}<textarea className="textarea" dir="ltr" rows={2} placeholder="https://" value={links} onChange={(e) => setLinks(e.target.value)}/></label></div>
      <div className={styles.actions}><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submitReport("save")}>{fa ? "ذخیره پیش‌نویس" : "Save draft"}</button>
        {(mode === "split" || current.isLead) && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submitReport(mode === "split" ? "submit" : "handover")}>{mode === "split" ? (fa ? "تحویل بخش من" : "Submit my part") : (fa ? "ارسال تسک برای تأیید" : "Send task for review")}</button>}</div>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
