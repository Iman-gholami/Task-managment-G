"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AssigneePicker from "@/components/ui/AssigneePicker";
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
import { STATUS, when } from "@/lib/format";
import { cxItems, peopleItems } from "@/components/ui/menus";
import { canAssignTask, canDeleteOwnTask, isManager } from "@/lib/roles";
import { actionLabel, allowedTransitions } from "@/lib/workflow";

const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (name) => (name.split(".").pop() || "file").slice(0, 4).toUpperCase();
const EXT_KIND = { DOC: "doc", DOCX: "doc", XLS: "sheet", XLSX: "sheet", CSV: "sheet", PDF: "pdf" };
// Workflow moves that step away from the happy path are offered quietly.
const QUIET = ["cancelled", "blocked"];

export default function TaskDetail({ id }) {
  const { tasks, updateTask, deleteTask, toast, me, peopleMap, openPopover, members } = useApp();
  const router = useRouter();
  const { edit, move } = useTaskActions();
  const t = tasks.find((x) => x.id === id);
  const { data, loading, error, setData, reload } = useFetch(t ? `/api/tasks/${id}` : null);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentReset, setCommentReset] = useState(0);
  const fileRef = useRef(null);
  const commentDraftRef = useRef("");
  const editingCommentRef = useRef(null);
  const checklistDraftRef = useRef("");
  const status = t?.status;
  // Refresh transitions and activity whenever the status changes (approve, return, start…).
  useEffect(() => { if (status && data) reload(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) {
    return (
      <div className="page">
        <EmptyState icon="search" title="Task not found" action={<Link className="btn btn-secondary btn-sm" href="/tasks">Back to tasks</Link>}>
          {id} doesn&apos;t exist, or it was removed. Check the ID or find the task from your task lists.
        </EmptyState>
      </div>
    );
  }

  const canEdit = t.a === me.id || isManager(me);
  const manager = isManager(me);
  const assignableMembers = members.filter((person) => person.active !== false && canAssignTask(me, person));
  const closed = t.status === "done" || t.status === "cancelled";
  const d = data?.details;
  const transitions = data ? allowedTransitions(me, t) : [];
  const merge = (patch) => setData((x) => ({ ...x, details: { ...x.details, ...patch } }));

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

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    if (await run(`/api/tasks/${id}/attachments`, { method: "POST", body: form })) toast(`${file.name} attached`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const postComment = async (body) => {
    if (posting) return;
    setPosting(true);
    try {
      if (await run(`/api/tasks/${id}/comments`, { method: "POST", body: { body } })) {
        commentDraftRef.current = "";
        setCommentReset((version) => version + 1);
      }
    } finally { setPosting(false); }
  };

  const removeOwnTask = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try { await deleteTask(id); toast(`${id} deleted`); router.push("/tasks/my"); }
    catch (error) { setDeleteError(error.message); setDeleting(false); }
  };

  const doMove = (anchor, to) => move(anchor, t, to);
  const canDetail = manager && !closed;
  const doneCount = d?.checklist.filter((c) => c.done).length ?? 0;
  const main = transitions.filter((s) => !QUIET.includes(s));
  const quiet = transitions.filter((s) => QUIET.includes(s));

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="detail-bar">
          <Link href={manager ? "/tasks/assigned" : "/tasks/my"} className="back"><Icon name="arrowLeft" size="sm" />Tasks</Link>
          <span className="mono muted">/ {t.id}</span>
          <div className="actions">
            {canDeleteOwnTask(me, t) && <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => { setDeleteError(""); setDeleteConfirm(true); }}><Icon name="x" />Delete task</button>}
            {quiet.map((s) => (
              <button key={s} type="button" className={`btn btn-ghost btn-sm ${s === "cancelled" ? "danger" : ""}`} onClick={(e) => doMove(e.currentTarget, s)}>{actionLabel(t.status, s)}</button>
            ))}
            {manager && !closed && !editingDetails && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingDetails(true)}><Icon name="edit" />Edit</button>
            )}
            {[...main.slice(1), ...main.slice(0, 1)].map((s) => (
              <button key={s} type="button" className={`btn btn-sm ${s === main[0] ? "btn-primary" : "btn-secondary"}`} onClick={(e) => doMove(e.currentTarget, s)}>
                {actionLabel(t.status, s) ?? STATUS[s]}
              </button>
            ))}
          </div>
        </div>

        {editingDetails ? (
          <TaskBriefEditor task={t} onCancel={() => setEditingDetails(false)} onSave={async (patch) => {
            if (!(await updateTask(t, patch))) return false;
            setEditingDetails(false); toast("Task updated"); return true;
          }} />
        ) : (
          <div className="task-brief">
            <div className="task-brief-label"><Icon name="tasks" />Task brief</div>
            <h1 dir="auto">{t.title}</h1>
            <p className="prose" dir="auto">{t.description || <span className="muted">No description yet.</span>}</p>
          </div>
        )}

        {t.status === "review" && (
          <div className="callout" style={{ "--tone": "var(--violet)" }} role="status">
            <strong>Waiting for review</strong>
            <span>{transitions.includes("done") ? "Approve it with a quality rating, or return it to the assignee with a comment." : "A manager will approve it or return it for changes."}</span>
          </div>
        )}
        {t.status === "returned" && (
          <div className="callout" style={{ "--tone": "var(--warning)" }} role="status">
            <strong>Returned for changes</strong>
            <span>Check the comments below, then resume work and submit it again.</span>
          </div>
        )}
        {t.status === "done" && (
          <div className="callout" style={{ "--tone": "var(--success)" }} role="status">
            <strong>{t.reviewRequired ? <>Approved · <Quality q={t.quality} /></> : "Completed · No review required"}</strong>
            <span>This task is closed{d?.completedAt ? ` since ${when(d.completedAt)}` : ""}.{transitions.includes("progress") ? " You can reopen it if more work is needed." : ""}</span>
          </div>
        )}

        {loading && !d ? <div className="detail-section"><Loading label="Loading task details" rows={5} /></div> : error ? (
          <div className="detail-section panel"><ErrorState error={error} title="Couldn't load task details" onRetry={reload} compact /></div>
        ) : d && (
          <>
            <section className="detail-section task-surface" aria-label="Attachments">
              <SectionHeader
                icon="clip"
                title="Attachments"
                meta={d.attachments.length || null}
                actions={canEdit && (
                  <>
                    <input ref={fileRef} type="file" hidden onChange={(e) => upload(e.target.files[0])} aria-label="Upload attachment" data-testid="attach-input" />
                    <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} aria-busy={uploading} onClick={() => fileRef.current.click()}><Icon name="clip" />Attach file</button>
                  </>
                )}
              />
              {d.attachments.length === 0 ? (canEdit ? (
                <button type="button" className={`dropzone ${dragOver ? "over" : ""}`} disabled={uploading} onClick={() => fileRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}>
                  <span className="glyph"><Icon name="clip" /></span>
                  <span><b>No files yet — drop one here or browse</b><small>Reports, exports or evidence, up to 20 MB each</small></span>
                </button>
              ) : <p className="muted small">No files yet.</p>) : (
                <div className="files">
                  {d.attachments.map((a) => (
                    <span key={a.id} className="file">
                      <span className="ext" data-kind={EXT_KIND[ext(a.name)]} aria-hidden="true">{ext(a.name)}</span>
                      <a href={`/api/tasks/${id}/attachments/${a.id}`} download>{a.name}<small>{size(a.size)} · {peopleMap[a.by]?.name}</small></a>
                      {canEdit && (
                        <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={`Remove ${a.name}`} data-tooltip="Remove file"
                          onClick={() => setConfirm({ title: `Remove ${a.name}?`, body: "The file is deleted for everyone on this task.", action: "Remove file", run: () => run(`/api/tasks/${id}/attachments/${a.id}`, { method: "DELETE" }) })}>
                          <Icon name="x" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="detail-section task-surface" aria-label="Checklist">
              <SectionHeader icon="checkCircle" title="Checklist" meta={d.checklist.length ? `${doneCount} of ${d.checklist.length}` : null}>
                {d.checklist.length > 0 && <span className="progress ok" style={{ width: 88 }} role="progressbar" aria-label="Checklist progress" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={d.checklist.length}><span style={{ width: `${(doneCount / d.checklist.length) * 100}%` }} /></span>}
              </SectionHeader>
              {d.checklist.map((c) => (
                <label key={c.id} className={`check-item ${c.done ? "done" : ""}`}>
                  <input type="checkbox" className="cb" checked={c.done} disabled={!canEdit || closed}
                    onChange={() => { merge({ checklist: d.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }); run(`/api/tasks/${id}/checklist/${c.id}`, { method: "PATCH", body: { done: !c.done } }); }} />
                  <span>{c.label}</span>
                  {canEdit && !closed && <button type="button" className="btn btn-ghost icon-btn btn-sm grip" aria-label={`Delete ${c.label}`} data-tooltip="Delete item" onClick={(e) => { e.preventDefault(); run(`/api/tasks/${id}/checklist/${c.id}`, { method: "DELETE" }); }}><Icon name="x" /></button>}
                </label>
              ))}
              {canEdit && !closed && (
                <ChecklistAdder draftRef={checklistDraftRef} onAdd={(label) => run(`/api/tasks/${id}/checklist`, { method: "POST", body: { label } })} />
              )}
              {!d.checklist.length && (!canEdit || closed) && <p className="muted small">No checklist for this task.</p>}
            </section>

            <section className="detail-section task-surface task-conversation" aria-label="Comments">
              <SectionHeader icon="chat" title="Comments" meta={d.comments.length || null} />
              {!d.comments.length && <p className="conversation-empty">No updates yet. Share context or the next step with your team.</p>}
              {d.comments.map((c) => (
                <div key={c.id} className="comment">
                  <Avatar id={c.by} />
                  <div>
                    <div className="h">
                      <b>{peopleMap[c.by]?.name}</b><span className="muted">{when(c.at)}{c.edited ? " · edited" : ""}</span>
                      {c.by === me.id && editing !== c.id && (
                        <span className="tools">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { editingCommentRef.current = { id: c.id, body: c.body }; setEditing(c.id); }}>Edit</button>
                          <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => setConfirm({ title: "Delete this comment?", body: "It is removed for everyone. This can't be undone.", action: "Delete comment", run: () => run(`/api/tasks/${id}/comments/${c.id}`, { method: "DELETE" }) })}>Delete</button>
                        </span>
                      )}
                    </div>
                    {editing === c.id ? <CommentEditor commentId={c.id} draftRef={editingCommentRef} onCancel={() => { editingCommentRef.current = null; setEditing(null); }}
                      onSave={async (body) => { if (await run(`/api/tasks/${id}/comments/${c.id}`, { method: "PATCH", body: { body } })) { editingCommentRef.current = null; setEditing(null); } }} />
                      : <p dir="auto">{highlight(c.body)}</p>}
                  </div>
                </div>
              ))}
              <CommentComposer draftRef={commentDraftRef} onPost={postComment} posting={posting} resetVersion={commentReset} />
            </section>
          </>
        )}
      </div>

      <aside className="detail-side" aria-label="Task properties">
        <div className="task-properties-title"><Icon name="list" /><span>Task overview</span></div>
        {!transitions.length && data && <p className="side-note">{t.status === "review" ? "Waiting for a reviewer." : closed ? "This task is closed." : "No workflow actions are available to you."}</p>}
        <dl className="kv">
          <dt>Status</dt><dd><span className="cell-edit" role="button" tabIndex={0} aria-label={`Status: ${STATUS[t.status]}. Change status`} onClick={(e) => edit(e.currentTarget, "status", t)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), edit(e.currentTarget, "status", t))}><Status s={t.status} /></span></dd>
          <dt>Assignee</dt><dd>{canDetail ? <span className="cell-edit" role="button" tabIndex={0} aria-label="Reassign" onClick={(e) => openPopover(e.currentTarget, { label: "Reassign to", title: "Reassign to", width: 340, render: (close) => <div style={{ padding: 12 }}><AssigneePicker id="task-reassign" value={t.a} people={assignableMembers} autoFocus onSelect={(a) => { if (a !== t.a) updateTask(t, { a }); close(); }} /></div> })} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())}><Who id={t.a} /></span> : <Who id={t.a} />}</dd>
          <dt>Priority</dt><dd><span className="cell-edit" role="button" tabIndex={0} aria-label="Change priority" onClick={(e) => edit(e.currentTarget, "prio", t)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())}><Priority p={t.prio} /></span></dd>
          <dt>Complexity</dt><dd>{canDetail ? <span className="cell-edit" role="button" tabIndex={0} aria-label="Change complexity" onClick={(e) => openPopover(e.currentTarget, { title: "Complexity", items: cxItems(), onPick: (cx) => updateTask(t, { cx }) })} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())}><Complexity c={t.cx} /></span> : <Complexity c={t.cx} />}</dd>
          <dt>Deadline</dt><dd>{canDetail
            ? <input type="date" className="input" defaultValue={t.due === "—" ? "" : t.due} key={t.due} aria-label="Deadline" onChange={(e) => updateTask(t, { due: e.target.value })} />
            : <Due task={t} />}</dd>
          <dt>Actual hours</dt>
          <dd>
            {canEdit && !closed ? (
              <span className="stepper">
                <button type="button" aria-label="Decrease hours" onClick={() => updateTask(t, { hours: Math.max(0, t.hours - 0.5) })}>−</button>
                <input aria-label="Actual hours" defaultValue={t.hours} key={t.hours} inputMode="decimal" onBlur={(e) => { const h = Number(e.target.value); if (Number.isFinite(h) && h >= 0 && h !== t.hours) updateTask(t, { hours: h }); else e.target.value = t.hours; }} />
                <button type="button" aria-label="Increase hours" onClick={() => updateTask(t, { hours: t.hours + 0.5 })}>+</button>
              </span>
            ) : <span className="num">{t.hours.toFixed(1)}</span>}
          </dd>
          <dt>Started</dt><dd className="num">{when(d?.startedAt)}</dd>
          <dt>Created by</dt><dd>{d?.createdBy ? <Who id={d.createdBy} /> : <span className="muted">—</span>}</dd>
          <dt>Manager review</dt><dd>{manager && !closed && t.status !== "review"
            ? <label className="row" style={{ gap: 8 }}>
                <input className="cb" type="checkbox" aria-label="Manager review required" checked={t.reviewRequired}
                  onChange={async (e) => { if (await updateTask(t, { reviewRequired: e.target.checked })) toast("Review requirement updated"); }} />
                <span>{t.reviewRequired ? "Required" : "Not required"}</span>
              </label>
            : <span className="muted">{t.reviewRequired ? "Required" : "Not required"}</span>}</dd>
          <dt>Quality</dt><dd>{t.quality ? <Quality q={t.quality} /> : <span className="muted">{t.reviewRequired ? "Set on approval" : "Not rated · no review"}</span>}</dd>
        </dl>
        <div className="side-h">Activity</div>
        <ol className="timeline" data-testid="activity">
          {d?.events.length ? d.events.map((e) => <li key={e.id}><b>{peopleMap[e.by]?.name ?? "System"}</b> {e.text}<time>{when(e.at)}</time></li>) : <li>No activity yet.</li>}
        </ol>
      </aside>

      {confirm && (
        <Dialog label={confirm.action} title={confirm.title} description={confirm.body} onClose={() => setConfirm(null)} width={420}>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={() => { confirm.run(); setConfirm(null); }}>{confirm.action}</button>
          </div>
        </Dialog>
      )}
      {deleteConfirm && (
        <Dialog label="Delete task" title={`Delete ${t.id}?`} description="This removes the task from lists and reports. Its history and files are retained for audit." onClose={() => !deleting && setDeleteConfirm(false)} width={440} dismissible={!deleting}>
          {deleteError && <p role="alert" className="task-delete-error">{deleteError}</p>}
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Keep task</button>
            <button type="button" className="btn btn-danger" onClick={removeOwnTask} disabled={deleting} aria-busy={deleting}>Delete task</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// Keep text editing local so each keystroke doesn't redraw the entire task and its activity.
function TaskBriefEditor({ task, onSave, onCancel }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [titleError, setTitleError] = useState(false);
  const save = async () => {
    if (!title.trim()) { setTitleError(true); return; }
    await onSave({ title: title.trim(), description });
  };
  return (
    <div className="detail-edit">
      <input className="input" value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(false); }} aria-label="Title" aria-invalid={titleError || undefined} aria-describedby={titleError ? "title-error" : undefined} autoFocus maxLength={200} dir="auto" />
      {titleError && <FieldError id="title-error">A task needs a title.</FieldError>}
      <textarea className="textarea" style={{ minHeight: 120 }} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" placeholder="Describe the work, context and expected outcome" dir="auto" />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save changes</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ChecklistAdder({ draftRef, onAdd }) {
  const [text, setText] = useState(() => draftRef.current);
  return (
    <div className="check-item check-add">
      <Icon name="plus" />
      <input className="input" placeholder="Add an item and press Enter" value={text} onChange={(e) => { draftRef.current = e.target.value; setText(e.target.value); }} aria-label="New checklist item" dir="auto"
        onKeyDown={async (e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) { e.preventDefault(); const label = text.trim(); draftRef.current = ""; setText(""); await onAdd(label); } }} />
    </div>
  );
}

function CommentEditor({ commentId, draftRef, onSave, onCancel }) {
  const [body, setBody] = useState(() => draftRef.current?.body ?? "");
  return (
    <div className="comment-edit">
      <textarea className="textarea" value={body} onChange={(e) => { draftRef.current = { id: commentId, body: e.target.value }; setBody(e.target.value); }} aria-label="Edit comment" dir="auto" autoFocus />
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!body.trim()} onClick={() => onSave(body)}>Save</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function CommentComposer({ draftRef, onPost, posting, resetVersion }) {
  const [draft, setDraft] = useState(() => draftRef.current);
  const lastReset = useRef(resetVersion);
  useEffect(() => {
    if (lastReset.current !== resetVersion) { lastReset.current = resetVersion; setDraft(draftRef.current); }
  }, [draftRef, resetVersion]);
  const post = () => { if (draft.trim() && !posting) onPost(draft); };
  return (
    <div className="composer">
      <textarea placeholder="Write an update or handover note…" value={draft} onChange={(e) => { draftRef.current = e.target.value; setDraft(e.target.value); }} aria-label="New comment" dir="auto" maxLength={5000} disabled={posting}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); post(); } }} />
      <div className="bar">
        <span className="hint">Visible to everyone who can open this task</span>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} disabled={!draft.trim() || posting} aria-busy={posting} onClick={post}>Comment <kbd>⌘↵</kbd></button>
      </div>
    </div>
  );
}

/** Renders @Full Name mentions in the accent color. */
function highlight(body) {
  return body.split(/(@[A-Z][\w-]*(?: [A-Z][\w-]*)?)/g).map((part, i) => (part.startsWith("@") ? <span key={i} className="mention">{part}</span> : part));
}
