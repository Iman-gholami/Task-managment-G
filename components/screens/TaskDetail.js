"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useInlineEdit } from "@/components/TaskTable";
import Icon from "@/components/ui/Icon";
import { Avatar, Complexity, Due, EmptyState, Priority, Status, Who } from "@/components/ui/indicators";

const INITIAL_CHECKS = [
  ["Pull 30 days of VPN auth logs", true], ["Baseline normal login geography per user", true], ["Draft SPL with risk scoring", true],
  ["Validate against last month's true positives", false], ["Peer review with L2", false],
];

export default function TaskDetail({ id }) {
  const { tasks, dispatch, toast } = useApp();
  const edit = useInlineEdit();
  const t = tasks.find((x) => x.id === id);
  const [checks, setChecks] = useState(INITIAL_CHECKS);
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState([
    { by: "ln", at: "Sep 27, 16:20", body: <>Please coordinate with <span className="mention">@Arash Moradi</span> before enabling in production — L2 owns the escalation path.</> },
    { by: "sr", at: "Today, 08:05 · edited", body: "Baseline done. False-positive rate on last week's data drops from 41/day to 6/day." },
  ]);
  const [draft, setDraft] = useState("");

  if (!t) {
    return (
      <EmptyState icon={<Icon name="alert" />} title="Task not found" danger action={<Link className="btn btn-secondary btn-sm" href="/tasks/my">Go to My Tasks</Link>}>
        This task doesn&apos;t exist or was deleted.
      </EmptyState>
    );
  }

  const doneCount = checks.filter((c) => c[1]).length;
  const setField = (patch, msg) => { dispatch({ type: "task/update", id: t.id, patch: { ...patch, upd: "now" } }); if (msg) toast(msg); };
  const primary =
    t.status === "todo" || t.status === "backlog" || t.status === "returned" ? ["Start task", () => setField({ status: "progress" }, `${t.id} → In Progress`)]
    : t.status === "progress" ? ["Submit for Review", () => setField({ status: "review" }, "Submitted for review · Leila Nouri notified")]
    : t.status === "review" ? ["Approve", () => setField({ status: "done", quality: "good" }, `${t.id} approved · quality: Good`)]
    : null;

  const postComment = () => {
    if (!draft.trim()) return;
    setComments((c) => [...c, { by: "sr", at: "Just now", body: draft.trim() }]);
    setDraft("");
  };

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="mono muted" style={{ marginBottom: 8 }}>{t.id} · {t.team}</div>
        <h1 style={{ font: "var(--text-display)", letterSpacing: "var(--tracking-title)", margin: "0 0 14px" }}>{t.title}</h1>
        <p className="sec" style={{ fontSize: 14, lineHeight: "22px", maxWidth: 680 }}>
          Current rule fires on every login from a new country, producing ~40 false positives/day. Add per-user baselining and a risk score so only logins that combine new geography with an unusual time window or ASN reach the analyst queue. Reference ruleset lives in the detection repo.
        </p>
        <div style={{ display: "flex", gap: 8, margin: "14px 0 30px" }}>
          <span className="file"><span className="ext" style={{ background: "#3B7D4F" }}>SPL</span><span>vpn_anomaly_v3.spl<small>6 KB · Sara Rahimi</small></span></span>
          <span className="file"><Icon name="link" /><span>Splunk search<small className="mono">splunk/search/88213</small></span></span>
        </div>

        <div className="section-head">
          <h2>Checklist</h2><span className="meta num">{doneCount} of {checks.length}</span>
          <div className="progress ok" style={{ width: 80 }}><span style={{ width: `${(doneCount / checks.length) * 100}%` }} /></div>
        </div>
        <div>
          {checks.map(([label, done], i) => (
            <label key={label} className={`check-item ${done ? "done" : ""}`}>
              <span className="grip"><Icon name="grip" /></span>
              <input type="checkbox" className="cb" checked={done} onChange={() => setChecks((c) => c.map((x, j) => (j === i ? [x[0], !x[1]] : x)))} />
              <span>{label}</span>
            </label>
          ))}
          <div className="check-item" style={{ color: "var(--text-3)" }}>
            <span className="grip" /><Icon name="plus" />
            <input className="input" style={{ border: 0, background: "none", height: 28, padding: 0 }} placeholder="Add item" value={newItem} onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newItem.trim()) { setChecks((c) => [...c, [newItem.trim(), false]]); setNewItem(""); } }} />
          </div>
        </div>

        <div className="hr" />
        <div className="section-head"><h2>Comments</h2><span className="meta">{comments.length}</span></div>
        {comments.map((c, i) => (
          <div key={i}>
            <div className="comment">
              <Avatar id={c.by} />
              <div><div className="h"><b>{c.by === "ln" ? "Leila Nouri" : "Sara Rahimi"}</b><span className="muted">{c.at}</span></div><p>{c.body}</p></div>
            </div>
            {i === 0 && <div className="activity"><Icon name="chev" />Leila Nouri changed priority Normal → <b style={{ color: "var(--text)" }}>High</b> · Sep 27</div>}
          </div>
        ))}
        <div className="composer">
          <textarea placeholder="Leave a comment… use @ to mention" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(); }} />
          <div className="bar">
            <button className="btn btn-ghost icon-btn btn-sm" aria-label="Mention"><Icon name="at" /></button>
            <button className="btn btn-ghost icon-btn btn-sm" aria-label="Attach"><Icon name="clip" /></button>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={postComment}>Comment <kbd>⌘↵</kbd></button>
          </div>
        </div>
      </div>

      <aside className="detail-side">
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {primary && <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={primary[1]}>{primary[0]}</button>}
          {t.status === "review" && <button className="btn btn-secondary" onClick={() => setField({ status: "returned" }, `${t.id} returned to ${t.a === "sr" ? "Sara" : "assignee"}`)}>Return</button>}
          <button className="btn btn-secondary icon-btn" aria-label="More actions"><Icon name="more" /></button>
        </div>
        <dl className="kv">
          <dt>Status</dt><dd><span className="cell-edit" role="button" onClick={(e) => edit(e.currentTarget, "status", t)}><Status s={t.status} /></span></dd>
          <dt>Assignee</dt><dd><span className="cell-edit"><Who id={t.a} /></span></dd>
          <dt>Priority</dt><dd><span className="cell-edit" role="button" onClick={(e) => edit(e.currentTarget, "prio", t)}><Priority p={t.prio} /></span></dd>
          <dt>Complexity</dt><dd><span className="cell-edit"><Complexity c={t.cx} /></span></dd>
          <dt>Start</dt><dd className="num">Sep 24</dd>
          <dt>Deadline</dt><dd><Due task={t} /></dd>
          <dt>Actual hours</dt>
          <dd>
            <span className="stepper">
              <button aria-label="Decrease hours" onClick={() => setField({ hours: Math.max(0, t.hours - 0.5) })}>−</button>
              <input aria-label="Actual hours" value={t.hours} onChange={(e) => setField({ hours: Number(e.target.value) || 0 })} inputMode="decimal" />
              <button aria-label="Increase hours" onClick={() => setField({ hours: t.hours + 0.5 })}>+</button>
            </span>
          </dd>
          <dt>Reviewer</dt><dd><Who id="ln" /></dd>
          <dt>Quality</dt><dd className="muted">{t.quality ? t.quality[0].toUpperCase() + t.quality.slice(1) : "Set on approval"}</dd>
        </dl>
        <div className="side-h">Activity</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", display: "grid", gap: 8 }}>
          <div>Created by Leila Nouri · Sep 24</div><div>Status → In Progress · Sep 24</div><div>Hours logged +2.5 · Today</div>
        </div>
      </aside>
    </div>
  );
}
