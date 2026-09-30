"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { PageHeader, Panel } from "@/components/ui/layout";
import { isManager, SOC_TEAMS } from "@/lib/roles";
import { SHIFT_TYPES, tehranDate } from "@/lib/shifts";
import styles from "./ShiftSchedule.module.css";

const OPEN = new Set(["pending_target", "pending_manager"]);
const STATUS_LABEL = {
  pending_target: "منتظر تأیید کارشناس",
  pending_manager: "منتظر تأیید مدیر",
  approved: "تأیید و اعمال شد",
  rejected: "رد شد",
  cancelled: "لغو شد",
};
const SHIFT_FA = { morning: "صبح", evening: "تا ۸ شب", night: "شب" };
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const dateObj = (iso) => new Date(`${iso}T00:00:00Z`);
const longFa = (iso) => iso ? PERSIAN_LONG.format(dateObj(iso)) : "—";

export default function ShiftChanges() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(() => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)), [members]);
  const targets = analysts.filter((a) => a.id !== me.id);
  const [form, setForm] = useState({ date: tehranDate(), targetId: targets[0]?.id ?? "", targetDate: tehranDate(), reason: "" });
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch("/api/shift/changes");
  const requests = data?.requests ?? [];

  const submit = async () => {
    if (!form.date || !form.targetId || !form.targetDate || busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "POST", body: form });
      toast("درخواست تغییر شیفت ثبت شد");
      setForm({ ...form, reason: "" });
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "PATCH", body: { id, action } });
      const labels = { accept: "درخواست برای تأیید مدیر ارسال شد", approve: "تغییر شیفت تأیید و روی تقویم اعمال شد", reject: "درخواست رد شد", cancel: "درخواست لغو شد" };
      toast(labels[action] || "درخواست به‌روزرسانی شد");
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`page ${styles.page}`} dir="rtl">
      <PageHeader
        title="تغییر شیفت"
        meta={[manager ? "بررسی و تأیید درخواست‌های جابه‌جایی شیفت" : "جابه‌جایی شیفت خودتان با یک کارشناس دیگر", "تأیید یکی از مدیران کافی است"]}
        actions={<Link className="btn btn-secondary" href="/shift/schedule"><Icon name="cal" />تقویم شیفت</Link>}
      />

      {me.keepsShiftLog && (
        <Panel className={styles.changeForm} title="درخواست جدید" meta="شیفت خودتان و شیفت کارشناس مقصد می‌توانند در دو تاریخ متفاوت باشند">
          <div className={styles.changeFields}>
            <label className="field">
              <span>تاریخ شیفت من</span>
              <input className="input" type="date" value={form.date} min={tehranDate()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <small className={styles.jalaliHint}>{longFa(form.date)}</small>
            </label>
            <label className="field">
              <span>کارشناس مقصد</span>
              <select className="input" value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                {targets.map((a) => <option value={a.id} key={a.id}>{a.name} · {a.team}</option>)}
              </select>
            </label>
            <label className="field">
              <span>تاریخ شیفت او</span>
              <input className="input" type="date" value={form.targetDate} min={tehranDate()} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              <small className={styles.jalaliHint}>{longFa(form.targetDate)}</small>
            </label>
            <label className="field">
              <span>دلیل / توضیح</span>
              <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="مثلاً مرخصی، مأموریت یا هماهنگی شخصی" />
            </label>
            <button className="btn btn-primary" disabled={busy || !form.date || !form.targetId || !form.targetDate} onClick={submit}><Icon name="plus" />ثبت درخواست</button>
          </div>
          <div className={styles.modalNote} style={{ marginTop: 12 }}>
            مثال: شیفت ۱ مهر شما با شیفت ۵ مهر کارشناس انتخاب‌شده جابه‌جا می‌شود. کارشناس مقصد ابتدا Accept می‌کند و سپس SOC Manager یا Security Manager تأیید نهایی می‌کند. اگر کارشناس در دسترس نباشد، مدیر می‌تواند به‌جای او تأیید و تغییر را اعمال کند.
          </div>
        </Panel>
      )}

      <Panel className={styles.changeList} title={manager ? "درخواست‌های تیم" : "درخواست‌های من"} meta={loading ? "در حال دریافت…" : `${requests.length} درخواست`}>
        {error && <div style={{ padding: "12px 0", color: "var(--danger)" }}>دریافت درخواست‌ها ناموفق بود. <button className="btn btn-ghost btn-sm" onClick={reload}>تلاش دوباره</button></div>}
        <div className={styles.changeRows}>
          {!loading && !error && requests.length === 0 && <div className={styles.dayEmpty}>هنوز درخواست تغییر شیفتی ثبت نشده است.</div>}
          {requests.map((r) => (
            <div className={styles.changeRow} key={r.id}>
              <div className={styles.changeMain}>
                <div className={styles.changePeople}>
                  <Who id={r.requesterId} />
                  <span>↔</span>
                  <Who id={r.targetId} />
                  <span className={styles.status} data-status={r.status}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>
                <div className={styles.changeMeta}>
                  <span>{longFa(r.date)}</span>
                  <b>{shiftLabel(r.requesterShift)}</b>
                  <span>↔</span>
                  <span>{longFa(r.targetDate)}</span>
                  <b>{shiftLabel(r.targetShift)}</b>
                </div>
                {r.reason && <div className={styles.changeReason}>{r.reason}</div>}
              </div>

              <div className={styles.changeActions}>
                {r.status === "pending_target" && me.id === r.targetId && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "accept")}>تأیید</button>
                </>}
                {OPEN.has(r.status) && me.id === r.requesterId && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(r.id, "cancel")}>لغو درخواست</button>}
                {manager && OPEN.has(r.status) && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "approve")}>
                    {r.status === "pending_target" ? "تأیید به‌جای کارشناس و اعمال" : "تأیید و اعمال"}
                  </button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function shiftLabel(type) {
  const s = SHIFT_TYPES[type];
  return s ? `${SHIFT_FA[type] || s.label} ${s.start}–${s.end}` : "—";
}
