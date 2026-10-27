"use client";

import { memo, useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import styles from "./L2AnalyzedTickets.module.css";

const LABEL = { false_positive: "False positive", true_positive: "True positive" };

// Keep keystroke updates inside the small editor, never in the whole Shift Log or its ticket list.
const TicketEditor = memo(function TicketEditor({ editing, defaultVerdict, busy, error, onSave, onCancel }) {
  const [number, setNumber] = useState(editing?.ticketNumber ?? "");
  const [verdict, setVerdict] = useState(editing?.verdict ?? defaultVerdict ?? "");
  const [validation, setValidation] = useState("");
  const input = useRef(null);
  useEffect(() => {
    setNumber(editing?.ticketNumber ?? "");
    setVerdict(editing?.verdict ?? defaultVerdict ?? "");
    setValidation("");
    if (editing) input.current?.focus();
  }, [editing?.id, editing?.ticketNumber, editing?.verdict, defaultVerdict]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!number.trim()) { setValidation("Enter a ticket number."); input.current?.focus(); return; }
    if (!verdict) { setValidation("Select an analysis result."); return; }
    const saved = await onSave({ ticketNumber: number.trim(), verdict });
    if (saved) { setNumber(""); setValidation(""); input.current?.focus(); }
  };

  return (
    <form className={styles.editor} onSubmit={submit} noValidate>
      <div className={styles.fields}>
        <label className={styles.field} htmlFor="l2-reviewed-ticket-number">
          <span>Ticket number</span>
          <input id="l2-reviewed-ticket-number" ref={input} className="input mono" value={number}
            placeholder="e.g. INC-12345" autoComplete="off" maxLength={80}
            onChange={(event) => { setNumber(event.target.value); if (validation) setValidation(""); }} />
        </label>
        <fieldset className={styles.verdict}>
          <legend>Analysis result</legend>
          <div className={styles.choices}>
            <button type="button" className={styles.choice} data-selected={verdict === "false_positive"}
              aria-pressed={verdict === "false_positive"} onClick={() => { setVerdict("false_positive"); setValidation(""); }}>
              <Icon name="x" size="sm" />False positive
            </button>
            <button type="button" className={styles.choice} data-selected={verdict === "true_positive"}
              aria-pressed={verdict === "true_positive"} onClick={() => { setVerdict("true_positive"); setValidation(""); }}>
              <Icon name="check" size="sm" />True positive
            </button>
          </div>
        </fieldset>
      </div>
      <div className={styles.footer}>
        <span className={styles.helper}>One record per analyzed ticket. Counts update automatically.</span>
        <div className={styles.buttons}>
          {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            <Icon name={editing ? "check" : "plus"} size="sm" />
            {busy ? "Saving…" : editing ? "Save changes" : "Add ticket"}
          </button>
        </div>
      </div>
      {(validation || error) && <p role="alert" className={styles.error}>{validation || error}</p>}
    </form>
  );
});

export default function L2AnalyzedTickets({ initialItems = [], readOnly = false, managerTarget = null, backfillDate = null, onChange }) {
  const { toast } = useApp();
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaultVerdict, setDefaultVerdict] = useState("");
  const target = managerTarget ? { user: managerTarget.user, date: managerTarget.date } :
    backfillDate ? { date: backfillDate } : {};
  useEffect(() => {
    setItems(initialItems);
    setEditingId(null);
    setRemovingId(null);
    setError("");
  }, [initialItems]);

  const falsePositive = items.filter((item) => item.verdict === "false_positive").length;
  const truePositive = items.length - falsePositive;
  const editing = items.find((item) => item.id === editingId) ?? null;

  const save = async (fields) => {
    if (busy || readOnly) return false;
    setBusy(true); setError("");
    try {
      const result = await api("/api/shift/analyzed-tickets", {
        method: editingId === null ? "POST" : "PATCH",
        body: { ...target, ...(editingId === null ? {} : { id: editingId }), ...fields },
      });
      setItems(result.items);
      onChange?.(result.items, result.stats);
      setDefaultVerdict(fields.verdict);
      setEditingId(null);
      toast(editingId === null ? "Analyzed ticket added" : "Ticket analysis updated");
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (busy || readOnly) return;
    setBusy(true); setError("");
    try {
      const result = await api("/api/shift/analyzed-tickets", { method: "DELETE", body: { ...target, id } });
      setItems(result.items);
      onChange?.(result.items, result.stats);
      setRemovingId(null);
      if (editingId === id) setEditingId(null);
      toast("Analyzed ticket removed");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className={styles.card} aria-label="L2 ticket analysis" data-testid="l2-analyzed-tickets">
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.icon}><Icon name="review" /></span>
          <div>
            <div className={styles.overline}>SOC / LAYER 2</div>
            <h2>Ticket analysis</h2>
            <p>Record each investigated ticket and its final verdict.</p>
          </div>
        </div>
        {readOnly && <span className="badge dot">Submitted · read only</span>}
      </header>
      <div className={styles.stats}>
        <div className={styles.stat}><span>Analyzed</span><b data-testid="l2-reviewed-count">{items.length}</b></div>
        <div className={styles.stat}><span>False positives</span><b data-testid="l2-fp-count">{falsePositive}</b></div>
        <div className={styles.stat}><span>True positives</span><b data-testid="l2-tp-count">{truePositive}</b></div>
      </div>
      {!readOnly && (
        <TicketEditor editing={editing} busy={busy} error={error} defaultVerdict={defaultVerdict}
          onSave={save} onCancel={() => { setEditingId(null); setError(""); }} />
      )}
      <div className={styles.list}>
        <div className={styles.listHeader}><h3>Reviewed tickets</h3><span>{items.length} total</span></div>
        {!items.length ? (
          <div className={styles.empty}><Icon name="inbox" /><span>No analyzed tickets recorded for this shift.</span></div>
        ) : items.map((item) => (
          <div key={item.id} className={styles.item}>
            <span className={styles.ticket} dir="auto">{item.ticketNumber}</span>
            <span className={styles.verdictTag} data-verdict={item.verdict}>{LABEL[item.verdict]}</span>
            {!readOnly && (
              <div className={styles.itemActions}>
                {removingId === item.id ? <>
                  <button type="button" className={styles.danger} disabled={busy} onClick={() => remove(item.id)}>Confirm delete</button>
                  <button type="button" onClick={() => setRemovingId(null)}>Cancel</button>
                </> : <>
                  <button type="button" aria-label={`Edit ticket ${item.ticketNumber}`} disabled={busy}
                    onClick={() => { setEditingId(item.id); setRemovingId(null); setError(""); }}>
                    <Icon name="edit" size="sm" /> Edit
                  </button>
                  <button type="button" aria-label={`Delete ticket ${item.ticketNumber}`} disabled={busy}
                    onClick={() => setRemovingId(item.id)}><Icon name="x" size="sm" /> Delete</button>
                </>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
