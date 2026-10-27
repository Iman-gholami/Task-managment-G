"use client";

import { useEffect, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import styles from "./L2AnalyzedTickets.module.css";

const EMPTY = { ticketNumber: "", verdict: "" };
const FA = new Intl.NumberFormat("fa-IR");
const LABEL = { false_positive: "مثبت کاذب (False Positive)", true_positive: "واقعی (True Positive)" };

export default function L2AnalyzedTickets({ initialItems = [], readOnly = false, managerTarget = null, onChange }) {
  const { toast } = useApp();
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const numberRef = useRef(null);

  useEffect(() => {
    setItems(initialItems);
    setEditingId(null);
    setRemovingId(null);
  }, [initialItems]);

  const falsePositive = items.filter((item) => item.verdict === "false_positive").length;
  const truePositive = items.filter((item) => item.verdict === "true_positive").length;
  const count = items.length;
  const target = managerTarget ? { user: managerTarget.user, date: managerTarget.date } : {};

  const startEdit = (item) => {
    setForm({ ticketNumber: item.ticketNumber, verdict: item.verdict });
    setEditingId(item.id);
    setRemovingId(null);
    setError("");
    numberRef.current?.focus();
  };
  const cancel = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    numberRef.current?.focus();
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy || readOnly) return;
    if (!form.ticketNumber.trim()) { setError("شماره تیکت رو وارد کن."); numberRef.current?.focus(); return; }
    if (!form.verdict) { setError("نتیجه تحلیل تیکت رو انتخاب کن."); return; }
    setBusy(true); setError("");
    try {
      const result = await api("/api/shift/analyzed-tickets", {
        method: editingId === null ? "POST" : "PATCH",
        body: { ...target, ...(editingId === null ? {} : { id: editingId }), ...form },
      });
      setItems(result.items);
      onChange?.(result.items, result.stats);
      setForm({ ticketNumber: "", verdict: form.verdict });
      setEditingId(null);
      toast(editingId === null ? "تیکت تحلیل‌شده ثبت شد" : "نتیجه تیکت ویرایش شد");
      numberRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (busy || readOnly) return;
    setBusy(true); setError("");
    try {
      const result = await api("/api/shift/analyzed-tickets", { method: "DELETE", body: { ...target, id } });
      setItems(result.items);
      onChange?.(result.items, result.stats);
      setRemovingId(null);
      if (editingId === id) cancel();
      toast("تیکت از فهرست تحلیل‌ها حذف شد");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className={styles.card} aria-label="ثبت تیکت‌های تحلیل‌شده لایه ۲" data-testid="l2-analyzed-tickets">
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>فعالیت ویژه لایه ۲</span>
          <h2>تیکت‌های تحلیل‌شده</h2>
          <p>هر تیکت رو فقط یک‌بار با شماره و نتیجه بررسی ثبت کن؛ تعداد خودکار محاسبه می‌شه.</p>
        </div>
      </header>
      <div className={styles.counters} aria-label="آمار تیکت‌های تحلیل‌شده">
        <div><strong data-testid="l2-reviewed-count">{FA.format(count)}</strong><span>کل تحلیل‌ها</span></div>
        <div data-tone="false"><strong data-testid="l2-fp-count">{FA.format(falsePositive)}</strong><span>مثبت کاذب</span></div>
        <div data-tone="true"><strong data-testid="l2-tp-count">{FA.format(truePositive)}</strong><span>واقعی</span></div>
      </div>

      {!readOnly && (
        <form className={styles.entry} onSubmit={save}>
          <label className={styles.field}>
            <span>شماره تیکت</span>
            <input ref={numberRef} className="input" value={form.ticketNumber}
              onChange={(e) => { setForm((v) => ({ ...v, ticketNumber: e.target.value })); setError(""); }}
              placeholder="مثلاً INC-12345" maxLength={80} aria-label="شماره تیکت تحلیل‌شده" />
          </label>
          <fieldset className={styles.verdict}>
            <legend>نتیجه تحلیل</legend>
            <div className={styles.options}>
              <button type="button" aria-pressed={form.verdict === "false_positive"}
                className={form.verdict === "false_positive" ? styles.activeFalse : ""}
                onClick={() => { setForm((v) => ({ ...v, verdict: "false_positive" })); setError(""); }}>
                <Icon name="x" size="sm" /> مثبت کاذب
              </button>
              <button type="button" aria-pressed={form.verdict === "true_positive"}
                className={form.verdict === "true_positive" ? styles.activeTrue : ""}
                onClick={() => { setForm((v) => ({ ...v, verdict: "true_positive" })); setError(""); }}>
                <Icon name="check" size="sm" /> واقعی
              </button>
            </div>
          </fieldset>
          <div className={styles.actions}>
            {editingId !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>انصراف از ویرایش</button>}
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              <Icon name={editingId === null ? "plus" : "check"} size="sm" />
              {busy ? "در حال ذخیره..." : editingId === null ? "ثبت و افزودن بعدی" : "ذخیره تغییرات"}
            </button>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
      )}
      {readOnly && <p className={styles.readOnly}>شیفت ثبت نهایی شده؛ سوابق فقط با اصلاح مدیر قابل تغییرند.</p>}
      <div className={styles.entries}>
        <div className={styles.listTitle}><b>تیکت‌های ثبت‌شده</b><span>{FA.format(count)} مورد</span></div>
        {!items.length && <p className={styles.empty}>هنوز تیکتی ثبت نشده است.</p>}
        {items.map((item) => (
          <div className={styles.item} key={item.id}>
            <span className={styles.ticketNumber} dir="auto">{item.ticketNumber}</span>
            <span className={styles.verdictBadge} data-verdict={item.verdict}>{LABEL[item.verdict]}</span>
            {!readOnly && (
              <div className={styles.itemActions}>
                {removingId === item.id ? (
                  <>
                    <button type="button" className={styles.danger} disabled={busy} onClick={() => remove(item.id)}>تأیید حذف</button>
                    <button type="button" onClick={() => setRemovingId(null)}>انصراف</button>
                  </>
                ) : (
                  <>
                    <button type="button" aria-label={`ویرایش تیکت ${item.ticketNumber}`} disabled={busy} onClick={() => startEdit(item)}><Icon name="edit" size="sm" /> ویرایش</button>
                    <button type="button" aria-label={`حذف تیکت ${item.ticketNumber}`} disabled={busy} onClick={() => setRemovingId(item.id)}><Icon name="x" size="sm" /> حذف</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
