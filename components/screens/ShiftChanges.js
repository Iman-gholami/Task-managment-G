"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { isManager, SOC_TEAMS } from "@/lib/roles";
import { SHIFT_TYPES, tehranDate } from "@/lib/shifts";
import styles from "./ShiftChanges.module.css";

const OPEN = new Set(["pending_target", "pending_manager"]);
const STATUS_LABEL = {
  pending_target: "منتظر کارشناس",
  pending_manager: "منتظر مدیر",
  approved: "تأیید و اعمال شد",
  rejected: "رد شد",
  cancelled: "لغو شد",
};
const SHIFT_FA = { morning: "صبح", evening: "تا ۸ شب", night: "شب" };
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const dateObj = (iso) => new Date(`${iso}T00:00:00Z`);
const longFa = (iso) => (iso ? PERSIAN_LONG.format(dateObj(iso)) : "—");

export default function ShiftChanges() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(
    () => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)),
    [members]
  );
  const targets = analysts.filter((a) => a.id !== me.id);
  const [form, setForm] = useState({
    date: tehranDate(),
    targetId: targets[0]?.id ?? "",
    targetDate: tehranDate(),
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");
  const { data, loading, error, reload } = useFetch("/api/shift/changes");
  const requests = data?.requests ?? [];

  const openCount = requests.filter((r) => OPEN.has(r.status)).length;
  const resolvedCount = requests.length - openCount;
  const visibleRequests = requests.filter((r) => {
    if (filter === "open") return OPEN.has(r.status);
    if (filter === "resolved") return !OPEN.has(r.status);
    return true;
  });

  const submit = async () => {
    if (!form.date || !form.targetId || !form.targetDate || busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "POST", body: form });
      toast("درخواست تغییر شیفت ثبت شد");
      setForm({ ...form, reason: "" });
      setFilter("open");
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
      const labels = {
        accept: "درخواست برای تأیید مدیر ارسال شد",
        approve: "تغییر شیفت تأیید و روی تقویم اعمال شد",
        reject: "درخواست رد شد",
        cancel: "درخواست لغو شد",
      };
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
      <header className={styles.hero}>
        <div>
          <h1>تغییر شیفت</h1>
          <p>شیفت خودتان را با شیفت یک کارشناس دیگر جابه‌جا کنید.</p>
        </div>
        <Link className={styles.calendarLink} href="/shift/schedule">
          <Icon name="cal" />
          <span>تقویم شیفت</span>
        </Link>
      </header>

      {me.keepsShiftLog && (
        <section className={styles.requestCard}>
          <div className={styles.cardHead}>
            <div>
              <h2>درخواست جدید</h2>
              <p>دو تاریخ و کارشناس مقصد را انتخاب کنید.</p>
            </div>
            <span className={styles.pendingHint}>تأیید کارشناس ← تأیید مدیر</span>
          </div>

          <div className={styles.compactForm}>
            <label className={styles.field}>
              <span>تاریخ شیفت من</span>
              <input type="date" value={form.date} min={tehranDate()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <small>{longFa(form.date)}</small>
            </label>

            <label className={styles.field}>
              <span>کارشناس مقصد</span>
              <select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                {targets.map((a) => <option value={a.id} key={a.id}>{a.name} · {a.team}</option>)}
              </select>
            </label>

            <label className={styles.field}>
              <span>تاریخ شیفت او</span>
              <input type="date" value={form.targetDate} min={tehranDate()} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              <small>{longFa(form.targetDate)}</small>
            </label>

            <label className={`${styles.field} ${styles.reasonField}`}>
              <span>دلیل <em>اختیاری</em></span>
              <input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="مرخصی، مأموریت یا هماهنگی شخصی"
              />
            </label>

            <button
              className={styles.submitButton}
              disabled={busy || !form.date || !form.targetId || !form.targetDate}
              onClick={submit}
            >
              <Icon name="plus" />
              {busy ? "در حال ثبت" : "ثبت درخواست"}
            </button>
          </div>

          <p className={styles.managerNote}>
            پس از تأیید کارشناس مقصد، تأیید یکی از مدیران کافی است. در صورت در دسترس نبودن کارشناس، مدیر می‌تواند مستقیم تأیید کند.
          </p>
        </section>
      )}

      <section className={styles.requestsCard}>
        <div className={styles.listHeader}>
          <div className={styles.listTitle}>
            <h2>{manager ? "درخواست‌های تیم" : "درخواست‌های من"}</h2>
            <span>{requests.length.toLocaleString("fa-IR")} درخواست</span>
          </div>
          <div className={styles.filters}>
            <button data-active={filter === "open"} onClick={() => setFilter("open")}>در انتظار <b>{openCount.toLocaleString("fa-IR")}</b></button>
            <button data-active={filter === "resolved"} onClick={() => setFilter("resolved")}>نهایی <b>{resolvedCount.toLocaleString("fa-IR")}</b></button>
            <button data-active={filter === "all"} onClick={() => setFilter("all")}>همه</button>
          </div>
        </div>

        {error && (
          <div className={styles.errorState}>
            <span>دریافت درخواست‌ها ناموفق بود.</span>
            <button onClick={reload}>تلاش دوباره</button>
          </div>
        )}

        <div className={styles.requestList}>
          {!loading && !error && visibleRequests.length === 0 && (
            <div className={styles.emptyState}>
              <b>{filter === "open" ? "درخواست بازی وجود ندارد" : "درخواستی در این بخش نیست"}</b>
              <span>{me.keepsShiftLog && filter === "open" ? "از فرم بالا یک درخواست جدید ثبت کنید." : "فیلتر دیگری را انتخاب کنید."}</span>
            </div>
          )}

          {visibleRequests.map((r) => (
            <article className={styles.requestItem} key={r.id}>
              <div className={styles.requestMain}>
                <div className={styles.people}>
                  <Who id={r.requesterId} />
                  <span className={styles.peopleArrow}>↔</span>
                  <Who id={r.targetId} />
                  <span className={styles.status} data-status={r.status}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>

                <div className={styles.swapLine}>
                  <ShiftInline date={r.date} type={r.requesterShift} />
                  <span>↔</span>
                  <ShiftInline date={r.targetDate} type={r.targetShift} />
                </div>

                {r.reason && <div className={styles.reason}>{r.reason}</div>}
              </div>

              <div className={styles.actions}>
                {r.status === "pending_target" && me.id === r.targetId && <>
                  <button className={styles.secondaryAction} disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                  <button className={styles.primaryAction} disabled={busy} onClick={() => act(r.id, "accept")}>تأیید</button>
                </>}
                {OPEN.has(r.status) && me.id === r.requesterId && (
                  <button className={styles.ghostAction} disabled={busy} onClick={() => act(r.id, "cancel")}>لغو</button>
                )}
                {manager && OPEN.has(r.status) && <>
                  <button className={styles.secondaryAction} disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                  <button className={styles.primaryAction} disabled={busy} onClick={() => act(r.id, "approve")}>
                    {r.status === "pending_target" ? "تأیید و اعمال" : "اعمال"}
                  </button>
                </>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ShiftInline({ date, type }) {
  const shift = SHIFT_TYPES[type];
  return (
    <span className={styles.shiftInline}>
      <b>{longFa(date)}</b>
      <small>{shift ? `${SHIFT_FA[type] || shift.label} · ${shift.start}–${shift.end}` : "شیفت نامشخص"}</small>
    </span>
  );
}
