"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import { useTaskActions } from "@/components/TaskTable";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Avatar, Complexity, Due, EmptyState, Priority, Quality, Status, Who } from "@/components/ui/indicators";
import { TableSkeleton } from "@/components/screens/Misc";
import { STATUS, when } from "@/lib/format";
import { cxItems, peopleItems } from "@/components/ui/menus";
import { isManager } from "@/lib/roles";
import { actionLabel } from "@/lib/workflow";

const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (name) => (name.split(".").pop() || "file").slice(0, 4).toUpperCase();
const EXT_KIND = { DOC: "doc", DOCX: "doc", XLS: "sheet", XLSX: "sheet", CSV: "sheet", PDF: "pdf" };

export default function TaskDetail({ id }) {
  const { tasks, updateTask, toast, me, peopleMap, openPopover, members } = useApp();
  const { edit, move } = useTaskActions();
  const t = tasks.find((x) => x.id === id);
  const { data, loading, error, setData, reload } = useFetch(t ? `/api/tasks/${id}` : null);
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingDetails, setEditingDetails] = useState(null);
  const fileRef = useRef(null);
  const status = t?.status;
  // Refresh transitions and activity whenever the status changes (approve, return, start…).
  useEffect(() => { if (status && data) reload(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) {
    return (
      <EmptyState icon={<Icon name="alert" />} title="Task not found" danger action={<Link className="btn btn-secondary btn-sm" href="/tasks/my">Go to My Tasks</Link>}>
        This task doesn&apos;t exist or was deleted.
      </EmptyState>
    );
  }

  const canEdit = t.a === me.id || isManager(me);
  const manager = isManager(me);
  const closed = t.status === "done" || t.status === "cancelled";
  const d = data?.details;
  const transitions = data?.transitions ?? [];
  const merge = (patch) => setData((x) => ({ ...x, details: { ...x.details, ...patch } }));

  /** Runs a mutating request and merges the returned detail lists. */
  const run = async (url, opts) => {
    try {
      merge(await api(url, opts));
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
  };

  const doMove = (anchor, to) => move(anchor, t, to);

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    if (await run(`/api/tasks/${id}/attachments`, { method: "POST", body: form })) toast(`${file.name} attached`);
    setUploading(false);
    fileRef.current.value = "";
  };

  const canDetail = manager && !closed;
  const doneCount = d?.checklist.filter((c) => c.done).length ?? 0;
  const primary = transitions.filter((s) => !["cancelled", "blocked"].includes(s));
  const secondary = transitions.filter((s) => ["cancelled", "blocked"].includes(s));

  return (
    <div className="detail">
      <div className="detail-main">
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--s-2)", marginBottom: "var(--s-4)", minHeight: 36 }}>
          <Link href={isManager(me) ? "/tasks/assigned" : "/tasks/my"} className="muted" style={{ fontSize: "var(--fs-13)", whiteSpace: "nowrap" }}>← Tasks</Link>
          <span className="mono muted">/ {t.id}</span>
          <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--s-2)" }}>
            {secondary.map((s) => <button key={s} className="btn btn-ghost btn-sm" onClick={(e) => doMove(e.currentTarget, s)}>{actionLabel(t.status, s)}</button>)}
            {manager && !closed && !editingDetails && <button className="btn btn-secondary btn-sm" onClick={() => setEditingDetails({ title: t.title, description: t.description })}><Icon name="edit" />Edit</button>}
            {[...primary.slice(1), ...primary.slice(0, 1)].map((s) => (
              <button key={s} className={`btn ${s === primary[0] ? "btn-primary" : "btn-secondary"}`} onClick={(e) => doMove(e.currentTarget, s)}>
                {actionLabel(t.status, s) ?? STATUS[s]}
              </button>
            ))}
          </div>
        </div>
        {editingDetails ? (
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <input className="input" style={{ height: 40, font: "600 20px var(--font-sans)" }} value={editingDetails.title} onChange={(e) => setEditingDetails({ ...editingDetails, title: e.target.value })} aria-label="Title" />
            <textarea className="textarea" style={{ minHeight: 110 }} value={editingDetails.description} onChange={(e) => setEditingDetails({ ...editingDetails, description: e.target.value })} aria-label="Description" placeholder="Description" />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={async () => { if (await updateTask(t, editingDetails)) { setEditingDetails(null); toast("Task updated"); } }}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingDetails(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ marginBottom: "var(--s-4)" }}>{t.title}</h1>
            <p className="prose">
              {t.description || <span className="muted">No description.</span>}
            </p>
          </>
        )}

        {t.status === "review" && (
          <div className="callout" style={{ "--tone": "var(--violet)" }} role="status">
            <strong>Waiting for review</strong>
            <span>
              {transitions.includes("done") ? "Approve with a quality rating, or return it to the assignee with a comment." : "A manager will approve it or return it for changes."}
            </span>
          </div>
        )}
        {t.status === "done" && (
          <div className="callout" style={{ "--tone": "var(--success)" }} role="status">
            <strong>Approved · <Quality q={t.quality} /></strong>
            <span>This task is closed{d?.completedAt ? ` since ${when(d.completedAt)}` : ""}.{transitions.includes("progress") ? " You can reopen it if more work is needed." : ""}</span>
          </div>
        )}

        {loading && !d ? <div style={{ marginTop: 24 }}><TableSkeleton rows={5} /></div> : error ? (
          <EmptyState icon={<Icon name="alert" />} danger title="Couldn't load task details" action={<button className="btn btn-secondary btn-sm" onClick={reload}>Retry</button>}>{error}</EmptyState>
        ) : d && (
          <>
            <div className="section-head" style={{ marginTop: 24 }}>
              <h2>Attachments</h2><span className="meta">{d.attachments.length}</span>
              {canEdit && (
                <div className="right">
                  <input ref={fileRef} type="file" hidden onChange={(e) => upload(e.target.files[0])} aria-label="Upload attachment" data-testid="attach-input" />
                  <button className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileRef.current.click()}><Icon name="clip" />{uploading ? "Uploading…" : "Attach file"}</button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
              {d.attachments.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No files attached.</span>}
              {d.attachments.map((a) => (
                <span key={a.id} className="file">
                  <span className="ext" data-kind={EXT_KIND[ext(a.name)]}>{ext(a.name)}</span>
                  <a href={`/api/tasks/${id}/attachments/${a.id}`} download>{a.name}<small>{size(a.size)} · {peopleMap[a.by]?.name}</small></a>
                  {canEdit && <button className="btn btn-ghost icon-btn btn-sm" aria-label={`Remove ${a.name}`} onClick={() => run(`/api/tasks/${id}/attachments/${a.id}`, { method: "DELETE" })}><Icon name="x" /></button>}
                </span>
              ))}
            </div>

            <div className="section-head">
              <h2>Checklist</h2><span className="meta num">{doneCount} of {d.checklist.length}</span>
              {d.checklist.length > 0 && <div className="progress ok" style={{ width: 80 }}><span style={{ width: `${(doneCount / d.checklist.length) * 100}%` }} /></div>}
            </div>
            <div>
              {d.checklist.map((c) => (
                <label key={c.id} className={`check-item ${c.done ? "done" : ""}`}>
                  <input type="checkbox" className="cb" checked={c.done} disabled={!canEdit || closed}
                    onChange={() => { merge({ checklist: d.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) }); run(`/api/tasks/${id}/checklist/${c.id}`, { method: "PATCH", body: { done: !c.done } }); }} />
                  <span style={{ flex: 1 }}>{c.label}</span>
                  {canEdit && !closed && <button className="btn btn-ghost icon-btn btn-sm grip" aria-label={`Delete ${c.label}`} onClick={(e) => { e.preventDefault(); run(`/api/tasks/${id}/checklist/${c.id}`, { method: "DELETE" }); }}><Icon name="x" /></button>}
                </label>
              ))}
              {canEdit && !closed && (
                <div className="check-item" style={{ color: "var(--text-3)" }}>
                  <Icon name="plus" />
                  <input className="input" style={{ border: 0, background: "none", height: 28, padding: 0 }} placeholder="Add item" value={newItem} onChange={(e) => setNewItem(e.target.value)} aria-label="New checklist item"
                    onKeyDown={async (e) => { if (e.key === "Enter" && newItem.trim()) { const label = newItem.trim(); setNewItem(""); await run(`/api/tasks/${id}/checklist`, { method: "POST", body: { label } }); } }} />
                </div>
              )}
            </div>

            <div className="hr" />
            <div className="section-head"><h2>Comments</h2><span className="meta">{d.comments.length}</span></div>
            {d.comments.map((c) => (
              <div key={c.id} className="comment">
                <Avatar id={c.by} />
                <div>
                  <div className="h">
                    <b>{peopleMap[c.by]?.name}</b><span className="muted">{when(c.at)}{c.edited ? " · edited" : ""}</span>
                    {c.by === me.id && editing?.id !== c.id && (
                      <span style={{ marginLeft: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: c.id, body: c.body })}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => run(`/api/tasks/${id}/comments/${c.id}`, { method: "DELETE" })}>Delete</button>
                      </span>
                    )}
                  </div>
                  {editing?.id === c.id ? (
                    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                      <textarea className="textarea" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} aria-label="Edit comment" />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={async () => { if (await run(`/api/tasks/${id}/comments/${c.id}`, { method: "PATCH", body: { body: editing.body } })) setEditing(null); }}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : <p style={{ whiteSpace: "pre-wrap" }}>{highlight(c.body)}</p>}
                </div>
              </div>
            ))}
            <div className="composer">
              <textarea placeholder="Leave a comment… use @ to mention" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="New comment"
                onKeyDown={async (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim()) { if (await run(`/api/tasks/${id}/comments`, { method: "POST", body: { body: draft } })) setDraft(""); } }} />
              <div className="bar">
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} disabled={!draft.trim()}
                  onClick={async () => { if (await run(`/api/tasks/${id}/comments`, { method: "POST", body: { body: draft } })) setDraft(""); }}>Comment <kbd>⌘↵</kbd></button>
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="detail-side">
        {!transitions.length && data && <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>{t.status === "review" ? "Waiting for a reviewer." : closed ? "This task is closed." : "No workflow actions available to you."}</div>}
        <dl className="kv">
          <dt>Status</dt><dd><span className="cell-edit" role="button" onClick={(e) => edit(e.currentTarget, "status", t)}><Status s={t.status} /></span></dd>
          <dt>Assignee</dt><dd>{canDetail ? <span className="cell-edit" role="button" onClick={(e) => openPopover(e.currentTarget, { title: "Reassign to", width: 320, items: peopleItems(members), onPick: (a) => a !== t.a && updateTask(t, { a }) })}><Who id={t.a} /></span> : <Who id={t.a} />}</dd>
          <dt>Priority</dt><dd><span className="cell-edit" role="button" onClick={(e) => edit(e.currentTarget, "prio", t)}><Priority p={t.prio} /></span></dd>
          <dt>Complexity</dt><dd>{canDetail ? <span className="cell-edit" role="button" onClick={(e) => openPopover(e.currentTarget, { title: "Complexity", items: cxItems(), onPick: (cx) => updateTask(t, { cx }) })}><Complexity c={t.cx} /></span> : <Complexity c={t.cx} />}</dd>
          <dt>Started</dt><dd className="num">{when(d?.startedAt)}</dd>
          <dt>Deadline</dt><dd>{canDetail
            ? <input type="date" className="input" style={{ height: 28, width: 150, colorScheme: "inherit" }} defaultValue={t.due === "—" ? "" : t.due} key={t.due} aria-label="Deadline" onChange={(e) => updateTask(t, { due: e.target.value })} />
            : <Due task={t} />}</dd>
          <dt>Actual hours</dt>
          <dd>
            {canEdit && !closed ? (
              <span className="stepper">
                <button aria-label="Decrease hours" onClick={() => updateTask(t, { hours: Math.max(0, t.hours - 0.5) })}>−</button>
                <input aria-label="Actual hours" defaultValue={t.hours} key={t.hours} inputMode="decimal" onBlur={(e) => { const h = Number(e.target.value); if (Number.isFinite(h) && h !== t.hours) updateTask(t, { hours: h }); }} />
                <button aria-label="Increase hours" onClick={() => updateTask(t, { hours: t.hours + 0.5 })}>+</button>
              </span>
            ) : <span className="num">{t.hours.toFixed(1)}</span>}
          </dd>
          <dt>Created by</dt><dd>{d?.createdBy ? <Who id={d.createdBy} /> : <span className="muted">—</span>}</dd>
          <dt>Quality</dt><dd>{t.quality ? <Quality q={t.quality} /> : <span className="muted">Set on approval</span>}</dd>
        </dl>
        <div className="side-h">Activity</div>
        <div className="timeline" data-testid="activity">
          {d?.events.length ? d.events.map((e) => <div key={e.id}><b>{peopleMap[e.by]?.name ?? "System"}</b> {e.text}<br />{when(e.at)}</div>) : <div>No activity yet.</div>}
        </div>
      </aside>
    </div>
  );
}

/** Renders @Full Name mentions in the accent color. */
function highlight(body) {
  return body.split(/(@[A-Z][\w-]*(?: [A-Z][\w-]*)?)/g).map((part, i) => (part.startsWith("@") ? <span key={i} className="mention">{part}</span> : part));
}
