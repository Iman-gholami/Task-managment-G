"use client";

import { useI18n } from "@/components/I18nProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AssigneePicker from "@/components/ui/AssigneePicker";
import TaskDateInput from "@/components/ui/TaskDateInput";
import TaskWorkPanel, { TaskReportSummary } from "@/components/screens/TaskWorkPanel";
import TaskReviewPanel from "@/components/screens/TaskReviewPanel";
import { SideCard, TaskLifecycle, TaskProgressPanel } from "@/components/screens/TaskJourney";
import { useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { useTaskActions } from "@/components/TaskTable";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import Dialog from "@/components/ui/Dialog";
import { FieldError } from "@/components/ui/Field";
import { SectionHeader } from "@/components/ui/layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import { Avatar, Complexity, Due, Priority, Quality, Status, Who } from "@/components/ui/indicators";
import { STATUS } from "@/lib/format";
import { taskWhen } from "@/lib/task-date";
import { taskActivityText } from "@/lib/i18n/task-activity";
import { cxItems, peopleItems } from "@/components/ui/menus";
import { canAssignTask, canDeleteOwnTask, isManager } from "@/lib/roles";
import { actionLabel, allowedTransitions } from "@/lib/workflow";
import { reportProgress } from "@/lib/task-journey";
const size = n => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const ext = name => (name.split(".").pop() || "file").slice(0, 4).toUpperCase();
const EXT_KIND = {
  DOC: "doc",
  DOCX: "doc",
  XLS: "sheet",
  XLSX: "sheet",
  CSV: "sheet",
  PDF: "pdf"
};
// Workflow moves that step away from the happy path are offered quietly.
const QUIET = ["cancelled", "blocked"];
// The sidebar shows the latest activity first; older entries are one click away.
const RECENT_EVENTS = 5;
export default function TaskDetail({
  id
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const {
    tasks,
    updateTask,
    deleteTask,
    toast,
    me,
    peopleMap,
    openPopover,
    members
  } = useApp();
  const router = useRouter();
  const {
    edit,
    move,
    approve,
    isApproving
  } = useTaskActions();
  const t = tasks.find(x => x.id === id);
  const {
    data,
    loading,
    error,
    setData,
    reload
  } = useFetch(t ? `/api/tasks/${id}` : null, {
    keepDataOnError: true
  });
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [posting, setPosting] = useState(false);
  const [allEvents, setAllEvents] = useState(false);
  const [commentReset, setCommentReset] = useState(0);
  const fileRef = useRef(null);
  const commentDraftRef = useRef("");
  const editingCommentRef = useRef(null);
  const checklistDraftRef = useRef("");
  const status = t?.status;
  // Refresh transitions and activity whenever the status changes (approve, return, start…).
  useEffect(() => {
    if (status && data) reload();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) {
    return <div className="page">
        <EmptyState icon="search" title={__taskTr("Task not found")} action={<Link className="btn btn-secondary btn-sm" href="/tasks">{__taskTr("Back to tasks")}</Link>}>
          {id}{" " + __taskTr("doesn't exist, or it was removed. Check the ID or find the task from your task lists.") + " "}</EmptyState>
      </div>;
  }
  const canEdit = t.a === me.id || isManager(me);
  const manager = isManager(me);
  const isAssignee = t.a === me.id;
  const assignableMembers = members.filter(person => person.active !== false && canAssignTask(me, person));
  const closed = t.status === "done" || t.status === "cancelled";
  const d = data?.details;
  const transitions = data ? allowedTransitions(me, t) : [];
  const merge = patch => setData(x => ({
    ...x,
    details: {
      ...x.details,
      ...patch
    }
  }));

  /** Runs a mutating request and merges the returned detail lists. */
  const run = async (url, opts) => {
    try {
      merge(await api(url, opts));
      return true;
    } catch (e) {
      toast(e.message, "error");
      return false;
    }
  };
  const upload = async file => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    if (await run(`/api/tasks/${id}/attachments`, {
      method: "POST",
      body: form
    })) toast(locale === "fa" ? `فایل ${file.name} پیوست شد` : `${file.name} attached`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const postComment = async body => {
    if (posting) return;
    setPosting(true);
    try {
      if (await run(`/api/tasks/${id}/comments`, {
        method: "POST",
        body: {
          body
        }
      })) {
        commentDraftRef.current = "";
        setCommentReset(version => version + 1);
      }
    } finally {
      setPosting(false);
    }
  };
  const removeOwnTask = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteTask(id);
      toast(locale === "fa" ? `${id} حذف شد` : `${id} deleted`);
      router.push("/tasks/my");
    } catch (error) {
      setDeleteError(error.message);
      setDeleting(false);
    }
  };
  const doMove = (anchor, to) => move(anchor, t, to, result => {
    setData(current => current ? {
      ...current,
      details: result.details,
      transitions: result.transitions
    } : current);
  });
  const canDetail = manager && !closed;
  const doneCount = d?.checklist.filter(c => c.done).length ?? 0;
  const main = transitions.filter(s => !QUIET.includes(s));
  const quiet = transitions.filter(s => QUIET.includes(s));
  const approving = isApproving(t.id);
  const reviewer = d?.approvedBy ? peopleMap[d.approvedBy] : null;
  const reviewed = t.reviewRequired && (!!t.quality || !!d?.approvedBy);
  const showReviewPanel = !isAssignee && t.status === "review" && transitions.includes("done");
  const evidenceInFlow = isAssignee && ["progress", "review"].includes(t.status) || showReviewPanel;
  const showReportCard = t.status === "done" || t.status === "cancelled" || !isAssignee && !showReviewPanel;
  const assigneeName = peopleMap[t.a]?.name ?? "The assignee";
  const journey = {
    task: t,
    details: d,
    isAssignee,
    canReview: showReviewPanel,
    assigneeName,
    creatorName: d?.createdBy ? d.createdBy === me.id ? "you" : peopleMap[d.createdBy]?.name : null,
    reviewerName: reviewer?.name
  };
  const showComments = () => {
    window.setTimeout(() => {
      const target = document.querySelector(editingCommentRef.current ? ".comment-edit textarea" : "#task-comment-input");
      target?.scrollIntoView({
        block: "center",
        behavior: "smooth"
      });
      target?.focus({
        preventScroll: true
      });
    }, 0);
  };
  const fileInput = canEdit && <input ref={fileRef} type="file" hidden onChange={e => upload(e.target.files[0])} aria-label={__taskTr("Upload attachment")} data-testid="attach-input" />;
  const attachButton = canEdit && <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} aria-busy={uploading} onClick={() => fileRef.current?.click()}><Icon name="clip" />{__taskTr("Attach file")}</button>;
  const fileList = d && (d.attachments.length === 0 ? canEdit ? <button type="button" className={`dropzone ${dragOver ? "over" : ""}`} disabled={uploading} onClick={() => fileRef.current?.click()} onDragOver={e => {
    e.preventDefault();
    setDragOver(true);
  }} onDragLeave={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  }} onDrop={e => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }}>
      <span className="glyph"><Icon name="clip" /></span><span><b>{__taskTr("No files yet \u2014 drop one here or browse")}</b><small>{__taskTr("Optional \xB7 up to 20 MB per file")}</small></span>
    </button> : <p className="muted small">{__taskTr("No files attached.")}</p> : <div className="files">{d.attachments.map(a => <span key={a.id} className="file"><span className="ext" data-kind={EXT_KIND[ext(a.name)]} aria-hidden="true">{ext(a.name)}</span>
      <a href={`/api/tasks/${id}/attachments/${a.id}`} download>{a.name}<small>{size(a.size)} · {peopleMap[a.by]?.name}</small></a>
      {canEdit && <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={locale === "fa" ? `حذف ${a.name}` : `Remove ${a.name}`} data-tooltip={__taskTr("Remove file")} onClick={() => setConfirm({
        title: locale === "fa" ? `فایل ${a.name} حذف شود؟` : `Remove ${a.name}?`,
        body: "The file is deleted for everyone on this task.",
        action: "Remove file",
        run: () => run(`/api/tasks/${id}/attachments/${a.id}`, {
          method: "DELETE"
        })
      })}><Icon name="x" /></button>}
    </span>)}</div>);
  // Files that belong to the report step or the review are managed there; one set of controls per file.
  const evidence = d && <section className="task-evidence" aria-label={__taskTr("Attachments")}>
      <SectionHeader icon="clip" title={__taskTr("Attachments")} meta={d.attachments.length || null} actions={<>{fileInput}{attachButton}</>} />
      {fileList}
    </section>;
  const events = d?.events ?? [];
  const shownEvents = allEvents ? events : events.slice(0, RECENT_EVENTS);
  return <div className="detail">
      <div className="detail-main">
        <div className="detail-bar">
          <Link href={manager ? "/tasks/assigned" : "/tasks/my"} className="back"><Icon name="arrowLeft" size="sm" />{__taskTr("Tasks")}</Link>
          <span className="mono muted">/ {t.id}</span>
          <div className="actions">
            {canDeleteOwnTask(me, t) && <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => {
            setDeleteError("");
            setDeleteConfirm(true);
          }}><Icon name="x" />{__taskTr("Delete task")}</button>}
            {quiet.map(s => <button key={s} type="button" className={`btn btn-ghost btn-sm ${s === "cancelled" ? "danger" : ""}`} disabled={approving} onClick={e => doMove(e.currentTarget, s)}>{__taskTr(actionLabel(t.status, s))}</button>)}
            {manager && !closed && !editingDetails && <button type="button" className="btn btn-secondary btn-sm" disabled={approving} onClick={() => setEditingDetails(true)}><Icon name="edit" />{__taskTr("Edit")}</button>}
            {(!isAssignee || t.status === "done") && !(t.status === "review" && !isAssignee) && [...main.slice(1), ...main.slice(0, 1)].map(s => <button key={s} type="button" className={`btn btn-sm ${s === main[0] && t.status !== "done" ? "btn-primary" : "btn-secondary"}`} disabled={approving} aria-busy={approving && s === "done"} onClick={e => doMove(e.currentTarget, s)}>
                {approving && s === "done" ? __taskTr("Approving\u2026") : __taskTr(actionLabel(t.status, s) ?? STATUS[s])}
              </button>)}
          </div>
        </div>

        {t.status === "done" && <section className="task-outcome" role="status" aria-label={reviewed ? __taskTr("Task approval") : __taskTr("Task completion")}>
            <div className="task-outcome-header">
              <span className="task-outcome-mark"><Icon name="check" /></span>
              <div>
                <span className="task-outcome-label">{reviewed ? __taskTr("REVIEW COMPLETE") : __taskTr("WORK COMPLETE")}</span>
                <h2>{reviewed ? __taskTr("Task approved") : __taskTr("Task completed")}</h2>
                <p>{reviewed ? __taskTr("The review is complete and this task is closed.") : t.reviewRequired ? __taskTr("This task is closed; review details are unavailable.") : __taskTr("Completed \xB7 No review required")}</p>
              </div>
            </div>
            <dl className="task-outcome-facts">
              {t.reviewRequired && t.quality && <div><dt>{__taskTr("Quality")}</dt><dd><Quality q={t.quality} /></dd></div>}
              {reviewer && <div><dt>{__taskTr("Approved by")}</dt><dd>{reviewer.name}</dd></div>}
              <div><dt>{__taskTr("Total time")}</dt><dd>{t.hours.toFixed(1)}{" " + __taskTr("hrs")}</dd></div>
              {d?.completedAt && <div><dt>{__taskTr("Completed")}</dt><dd><time dateTime={`${d.completedAt.replace(" ", "T")}Z`}>{taskWhen(d.completedAt, locale)}</time></dd></div>}
            </dl>
          </section>}

        <section className="task-hero" aria-label={__taskTr("Task summary")}>
          <div className="task-hero-top">
            {editingDetails ? <TaskBriefEditor task={t} onCancel={() => setEditingDetails(false)} onSave={async patch => {
            if (!(await updateTask(t, patch))) return false;
            setEditingDetails(false);
            toast("Task updated");
            return true;
          }} /> : <div className="task-brief">
                <div className="task-brief-label"><Icon name="tasks" />{__taskTr("Task brief")}</div>
                <h1 dir="auto">{t.title}</h1>
                <p className="prose" dir="auto">{t.description || <span className="muted">{__taskTr("No description yet.")}</span>}</p>
                <div className="task-brief-meta"><Status s={t.status} /><span>{__taskTr("Priority") + " "}<Priority p={t.prio} /></span><span>{__taskTr("Complexity") + " "}<Complexity c={t.cx} /></span><span>{__taskTr("Deadline") + " "}<Due task={t} /></span><span>{__taskTr("Assignee") + " "}<Who id={t.a} /></span></div>
              </div>}
            {d && <TaskProgressPanel task={t} progress={reportProgress(t, d)} isAssignee={isAssignee} canReview={showReviewPanel} assigneeName={assigneeName} />}
          </div>
          <TaskLifecycle {...journey} />
        </section>

        <div className="task-layout">
          <div className="task-layout-main">
            {isAssignee && d && t.status !== "done" && <TaskWorkPanel key={id} task={t} details={d} transitions={transitions} onMove={doMove} setData={setData} commentDraftRef={commentDraftRef} editingCommentRef={editingCommentRef} posting={posting} uploading={uploading} attachments={evidenceInFlow ? evidence : null} onShowComments={showComments} />}
            {showReviewPanel && d && <TaskReviewPanel key={id} task={t} details={d} setData={setData} onApprove={(task, quality, cx) => approve(task, quality, cx, result => setData(current => current ? {
            ...current,
            details: result.details,
            transitions: result.transitions
          } : current))} approving={approving} attachments={evidence} />}
            {t.status === "returned" && !isAssignee && <div className="callout" style={{
            "--tone": "var(--warning)"
          }} role="status">
                <strong>{__taskTr("Returned for changes")}</strong>
                <span>{__taskTr("Waiting for the assignee to update and resubmit the report.")}</span>
              </div>}
            {d && showReportCard && <section className="task-card" aria-label={__taskTr("Work report")}>
                <div className="task-card-head"><div>
                  <span className="eyebrow">{closed ? __taskTr("Final report") : `${assigneeName} · ${__taskTr(STATUS[t.status])}`}</span>
                  <h2>{__taskTr("Work report")}</h2>
                  {!closed && t.status !== "review" && <p>{__taskTr("This is the latest saved draft. It can change until it is submitted.")}</p>}
                </div></div>
                <div className="task-card-body"><TaskReportSummary task={t} details={d} emptyText={closed || t.status === "review" ? undefined : "Nothing has been saved to the report yet."} /></div>
              </section>}
            {loading && !d && <div className="task-card task-card-pad"><Loading label={__taskTr("Loading task details")} rows={5} /></div>}
            {!loading && error && !d && <div className="task-card task-card-pad"><ErrorState error={error} title={__taskTr("Couldn't load task details")} onRetry={reload} compact /></div>}
          </div>

          <aside className="task-side" aria-label={__taskTr("Task at a glance")}>
            <div className="task-side-label">{__taskTr("At a glance")}</div>
            {error && d ? <div className="side-card"><ErrorState error={error} title={__taskTr("Couldn't load task details")} onRetry={reload} compact /></div> : d && <>
                <SideCard icon="checkCircle" title={__taskTr("Checklist")} meta={d.checklist.length ? `${doneCount} of ${d.checklist.length} done` : null}>
                  {d.checklist.length > 0 && <span className="progress ok side-progress" role="progressbar" aria-label={__taskTr("Checklist progress")} aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={d.checklist.length}><span style={{
                  width: `${doneCount / d.checklist.length * 100}%`
                }} /></span>}
                  <div className="side-checklist" aria-label={__taskTr("Checklist")}>
                    {d.checklist.map(c => <label key={c.id} className={`check-item ${c.done ? "done" : ""}`}>
                        <input type="checkbox" className="cb" checked={c.done} disabled={!canEdit || closed} onChange={() => {
                    merge({
                      checklist: d.checklist.map(x => x.id === c.id ? {
                        ...x,
                        done: !x.done
                      } : x)
                    });
                    run(`/api/tasks/${id}/checklist/${c.id}`, {
                      method: "PATCH",
                      body: {
                        done: !c.done
                      }
                    });
                  }} />
                        <span dir="auto">{c.label}</span>
                        {canEdit && !closed && <button type="button" className="btn btn-ghost icon-btn btn-sm grip" aria-label={locale === "fa" ? `حذف ${c.label}` : `Delete ${c.label}`} data-tooltip={__taskTr("Delete item")} onClick={e => {
                    e.preventDefault();
                    run(`/api/tasks/${id}/checklist/${c.id}`, {
                      method: "DELETE"
                    });
                  }}><Icon name="x" /></button>}
                      </label>)}
                    {canEdit && !closed && <ChecklistAdder draftRef={checklistDraftRef} onAdd={label => run(`/api/tasks/${id}/checklist`, {
                  method: "POST",
                  body: {
                    label
                  }
                })} />}
                    {!d.checklist.length && (!canEdit || closed) && <p className="muted small">{__taskTr("No checklist for this task.")}</p>}
                  </div>
                </SideCard>

                {evidenceInFlow ? <SideCard icon="clip" title={__taskTr("Attachments")} meta={d.attachments.length || null}>
                    {d.attachments.length ? <ul className="side-files">{d.attachments.map(a => <li key={a.id}><span className="ext" data-kind={EXT_KIND[ext(a.name)]} aria-hidden="true">{ext(a.name)}</span><span className="side-file-name">{a.name}</span></li>)}</ul> : <p className="muted small">{__taskTr("No files yet.")}</p>}
                    <p className="side-card-note">{isAssignee ? t.status === "review" ? __taskTr("Shown with your submitted report.") : __taskTr("Add or remove files in the Outcome & evidence step.") : __taskTr("Shown with the submitted report.")}</p>
                  </SideCard> : <SideCard icon="clip" title={__taskTr("Attachments")} meta={d.attachments.length || null} actions={<>{fileInput}{attachButton}</>}>
                    {fileList}
                  </SideCard>}

                <SideCard icon="chat" title={__taskTr("Conversation")} meta={`${d.comments.length} ${d.comments.length === 1 ? "comment" : "comments"}`} className="task-conversation">
                  {!d.comments.length && <p className="conversation-empty">{__taskTr("No comments yet.")}</p>}
                  {d.comments.map(c => <div key={c.id} className="comment">
                      <Avatar id={c.by} />
                      <div>
                        <div className="h">
                          <b>{peopleMap[c.by]?.name}</b><span className="muted">{taskWhen(c.at, locale)}{c.edited ? __taskTr(" \xB7 edited") : ""}</span>
                          {c.by === me.id && editing !== c.id && <span className="tools">
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                        editingCommentRef.current = {
                          id: c.id,
                          body: c.body
                        };
                        setEditing(c.id);
                      }}>{__taskTr("Edit")}</button>
                              <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setConfirm({
                        title: "Delete this comment?",
                        body: "It is removed for everyone. This can't be undone.",
                        action: "Delete comment",
                        run: () => run(`/api/tasks/${id}/comments/${c.id}`, {
                          method: "DELETE"
                        })
                      })}>{__taskTr("Delete")}</button>
                            </span>}
                        </div>
                        {editing === c.id ? <CommentEditor commentId={c.id} draftRef={editingCommentRef} onCancel={() => {
                    editingCommentRef.current = null;
                    setEditing(null);
                  }} onSave={async body => {
                    if (await run(`/api/tasks/${id}/comments/${c.id}`, {
                      method: "PATCH",
                      body: {
                        body
                      }
                    })) {
                      editingCommentRef.current = null;
                      setEditing(null);
                    }
                  }} /> : <p dir="auto">{highlight(c.body)}</p>}
                      </div>
                    </div>)}
                  <CommentComposer draftRef={commentDraftRef} onPost={postComment} posting={posting} resetVersion={commentReset} />
                </SideCard>

                <SideCard icon="activity" title={__taskTr("Activity")}>
                  <ol className="timeline" data-testid="activity">
                    {shownEvents.length ? shownEvents.map(e => <li key={e.id}><b>{peopleMap[e.by]?.name ?? __taskTr("System")}</b> {taskActivityText(e.text, locale)}<time>{taskWhen(e.at, locale)}</time></li>) : <li>{__taskTr("No activity yet.")}</li>}
                  </ol>
                  {events.length > RECENT_EVENTS && <button type="button" className="btn btn-ghost btn-sm side-more" aria-expanded={allEvents} onClick={() => setAllEvents(value => !value)}>{allEvents ? __taskTr("Show recent only") : locale === "fa" ? `نمایش همه ${number(events.length)}` : `Show all ${events.length}`}</button>}
                  {!!d.reviewReturns.length && <><div className="side-h">{__taskTr("Review feedback")}</div><ol className="task-return-history">{d.reviewReturns.map(item => <li key={item.id}><strong>{peopleMap[item.by]?.name ?? __taskTr("Manager")}</strong><time>{taskWhen(item.at, locale)}</time><p dir="auto">{item.reason}</p></li>)}</ol></>}
                </SideCard>
              </>}

            <SideCard icon="list" title={__taskTr("Details")} className="task-details-card">
              {!transitions.length && data && <p className="side-note">{t.status === "review" ? __taskTr("Waiting for a reviewer.") : closed ? __taskTr("This task is closed.") : __taskTr("No workflow actions are available to you.")}</p>}
              <dl className="kv">
                <dt>{__taskTr("Status")}</dt><dd>{isAssignee ? <Status s={t.status} /> : <span className="cell-edit" role="button" tabIndex={0} aria-label={locale === "fa" ? `وضعیت: ${__taskTr(STATUS[t.status])}، تغییر وضعیت` : `Status: ${STATUS[t.status]}. Change status`} onClick={e => edit(e.currentTarget, "status", t)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), edit(e.currentTarget, "status", t))}><Status s={t.status} /></span>}</dd>
                <dt>{__taskTr("Assignee")}</dt><dd>{canDetail ? <span className="cell-edit" role="button" tabIndex={0} aria-label={__taskTr("Reassign")} onClick={e => openPopover(e.currentTarget, {
                  label: __taskTr("Reassign to"),
                  title: __taskTr("Reassign to"),
                  width: 340,
                  render: close => <div style={{
                    padding: 12
                  }}><AssigneePicker id="task-reassign" value={t.a} people={assignableMembers} autoFocus onSelect={a => {
                      if (a !== t.a) updateTask(t, {
                        a
                      });
                      close();
                    }} /></div>
                })} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())}><Who id={t.a} /></span> : <Who id={t.a} />}</dd>
                <dt>{__taskTr("Priority")}</dt><dd><span className="cell-edit" role="button" tabIndex={0} aria-label={__taskTr("Change priority")} onClick={e => edit(e.currentTarget, "prio", t)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())}><Priority p={t.prio} /></span></dd>
                <dt>{__taskTr("Complexity")}</dt><dd>{canDetail ? <span className="cell-edit" role="button" tabIndex={0} aria-label={__taskTr("Change complexity")} onClick={e => openPopover(e.currentTarget, {
                  title: __taskTr("Complexity"),
                  items: cxItems(),
                  onPick: cx => updateTask(t, {
                    cx
                  })
                })} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())}><Complexity c={t.cx} /></span> : <Complexity c={t.cx} />}</dd>
                <dt>{__taskTr("Deadline")}</dt><dd>{canDetail ? <TaskDateInput id="task-detail-deadline" calendarLabel="Choose deadline" value={t.due === "—" ? "" : t.due} aria-label={__taskTr("Deadline (Solar Hijri)")} commitOnBlur onChange={due => { if (due !== (t.due === "—" ? "" : t.due)) updateTask(t, { due }); }} /> : <Due task={t} />}</dd>
                <dt>{__taskTr("Actual hours")}</dt>
                <dd>
                  {canEdit && !closed && !isAssignee ? <span className="stepper">
                      <button type="button" aria-label={__taskTr("Decrease hours")} onClick={() => updateTask(t, {
                    hours: Math.max(0, t.hours - 0.5)
                  })}>−</button>
                      <input aria-label={__taskTr("Actual hours")} defaultValue={t.hours} key={t.hours} inputMode="decimal" onBlur={e => {
                    const h = Number(e.target.value);
                    if (Number.isFinite(h) && h >= 0 && h !== t.hours) updateTask(t, {
                      hours: h
                    });else e.target.value = t.hours;
                  }} />
                      <button type="button" aria-label={__taskTr("Increase hours")} onClick={() => updateTask(t, {
                    hours: t.hours + 0.5
                  })}>+</button>
                    </span> : <span className="num">{t.hours.toFixed(1)}</span>}
                </dd>
                <dt>{__taskTr("Started")}</dt><dd className="num">{taskWhen(d?.startedAt, locale)}</dd>
                <dt>{__taskTr("Created by")}</dt><dd>{d?.createdBy ? <Who id={d.createdBy} /> : <span className="muted">—</span>}</dd>
                <dt>{__taskTr("Manager review")}</dt><dd>{manager && !closed && t.status !== "review" ? <label className="row" style={{
                  gap: 8
                }}>
                      <input className="cb" type="checkbox" aria-label={__taskTr("Manager review required")} checked={t.reviewRequired} onChange={async e => {
                    if (await updateTask(t, {
                      reviewRequired: e.target.checked
                    })) toast("Review requirement updated");
                  }} />
                      <span>{t.reviewRequired ? __taskTr("Required") : __taskTr("Not required")}</span>
                    </label> : <span className="muted">{t.reviewRequired ? __taskTr("Required") : __taskTr("Not required")}</span>}</dd>
                <dt>{__taskTr("Quality")}</dt><dd>{t.quality ? <Quality q={t.quality} /> : <span className="muted">{t.reviewRequired ? __taskTr("Set on approval") : __taskTr("Not rated \xB7 no review")}</span>}</dd>
              </dl>
            </SideCard>
          </aside>
        </div>
      </div>

      {confirm && <Dialog label={__taskTr(confirm.action)} title={__taskTr(confirm.title)} description={__taskTr(confirm.body)} onClose={() => setConfirm(null)} width={420}>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>{__taskTr("Cancel")}</button>
            <button type="button" className="btn btn-danger" onClick={() => {
          confirm.run();
          setConfirm(null);
        }}>{__taskTr(confirm.action)}</button>
          </div>
        </Dialog>}
      {deleteConfirm && <Dialog label={__taskTr("Delete task")} title={`Delete ${t.id}?`} description={__taskTr("This removes the task from lists and reports. Its history and files are retained for audit.")} onClose={() => !deleting && setDeleteConfirm(false)} width={440} dismissible={!deleting}>
          {deleteError && <p role="alert" className="task-delete-error">{deleteError}</p>}
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirm(false)} disabled={deleting}>{__taskTr("Keep task")}</button>
            <button type="button" className="btn btn-danger" onClick={removeOwnTask} disabled={deleting} aria-busy={deleting}>{__taskTr("Delete task")}</button>
          </div>
        </Dialog>}
    </div>;
}

// Keep text editing local so each keystroke doesn't redraw the entire task and its activity.
function TaskBriefEditor({
  task,
  onSave,
  onCancel
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [titleError, setTitleError] = useState(false);
  const save = async () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    await onSave({
      title: title.trim(),
      description
    });
  };
  return <div className="detail-edit">
      <input className="input" value={title} onChange={e => {
      setTitle(e.target.value);
      setTitleError(false);
    }} aria-label={__taskTr("Title")} aria-invalid={titleError || undefined} aria-describedby={titleError ? "title-error" : undefined} autoFocus maxLength={200} dir="auto" />
      {titleError && <FieldError id="title-error">{__taskTr("A task needs a title.")}</FieldError>}
      <textarea className="textarea" style={{
      minHeight: 120
    }} value={description} onChange={e => setDescription(e.target.value)} aria-label={__taskTr("Description")} placeholder={__taskTr("Describe the work, context and expected outcome")} dir="auto" />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>{__taskTr("Save changes")}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{__taskTr("Cancel")}</button>
      </div>
    </div>;
}
function ChecklistAdder({
  draftRef,
  onAdd
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const [text, setText] = useState(() => draftRef.current);
  return <div className="check-item check-add">
      <Icon name="plus" />
      <input className="input" placeholder={__taskTr("Add an item and press Enter")} value={text} onChange={e => {
      draftRef.current = e.target.value;
      setText(e.target.value);
    }} aria-label={__taskTr("New checklist item")} dir="auto" onKeyDown={async e => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) {
        e.preventDefault();
        const label = text.trim();
        draftRef.current = "";
        setText("");
        await onAdd(label);
      }
    }} />
    </div>;
}
function CommentEditor({
  commentId,
  draftRef,
  onSave,
  onCancel
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const [body, setBody] = useState(() => draftRef.current?.body ?? "");
  return <div className="comment-edit">
      <textarea className="textarea" value={body} onChange={e => {
      draftRef.current = {
        id: commentId,
        body: e.target.value
      };
      setBody(e.target.value);
    }} aria-label={__taskTr("Edit comment")} dir="auto" autoFocus />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!body.trim()} onClick={() => onSave(body)}>{__taskTr("Save")}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{__taskTr("Cancel")}</button>
      </div>
    </div>;
}
function CommentComposer({
  draftRef,
  onPost,
  posting,
  resetVersion
}) {
  const {
    t: __taskTr, locale, number
  } = useI18n();
  const [draft, setDraft] = useState(() => draftRef.current);
  const lastReset = useRef(resetVersion);
  useEffect(() => {
    if (lastReset.current !== resetVersion) {
      lastReset.current = resetVersion;
      setDraft(draftRef.current);
    }
  }, [draftRef, resetVersion]);
  const post = () => {
    if (draft.trim() && !posting) onPost(draft);
  };
  return <div className="composer">
      <label htmlFor="task-comment-input" className="composer-heading">{__taskTr("Share a work update")}</label>
      <textarea id="task-comment-input" placeholder={__taskTr("What did you find, change or hand over?")} value={draft} onChange={e => {
      draftRef.current = e.target.value;
      setDraft(e.target.value);
    }} aria-label={__taskTr("New comment")} dir="auto" maxLength={5000} disabled={posting} onKeyDown={e => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
        e.preventDefault();
        post();
      }
    }} />
      <div className="bar">
        <span className="hint">{__taskTr("Visible to everyone who can open this task")}</span>
        <button type="button" className="btn btn-primary btn-sm" style={{
        marginLeft: "auto"
      }} disabled={!draft.trim() || posting} aria-busy={posting} onClick={post}>{__taskTr("Comment") + " "}<kbd>⌘↵</kbd></button>
      </div>
    </div>;
}

/** Renders @Full Name mentions in the accent color. */
function highlight(body) {
  return body.split(/(@[A-Z][\w-]*(?: [A-Z][\w-]*)?)/g).map((part, i) => part.startsWith("@") ? <span key={i} className="mention">{part}</span> : part);
}
