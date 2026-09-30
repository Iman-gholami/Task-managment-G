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
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>مدیریت برنامه شیفت</span>
          <h1>تغییر شیفت</h1>
          <p>درخواست جابه‌جایی را ثبت کنید؛ تأییدها مرحله‌ای انجام می‌شوند و بعد از تأیید نهایی، تقویم خودکار به‌روزرسانی می‌شود.</p>
        </div>
        <Link className={styles.calendarLink} href="/shift/schedule">
          <Icon name="cal" />
          <span>بازگشت به تقویم</span>
        </Link>
      </header>

      <section className={styles.overview} aria-label="خلاصه درخواست‌های تغییر شیفت">
        <Summary label="در انتظار اقدام" value={openCount} tone="open" />
        <Summary label="نهایی‌شده" value={resolvedCount} />
        <Summary label="کل درخواست‌ها" value={requests.length} />
      </section>

      {me.keepsShiftLog && (
        <section className={styles.requestCard}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionKicker}>درخواست جدید</span>
              <h2>کدام دو شیفت جابه‌جا شوند؟</h2>
              <p>شیفت خودتان و شیفت کارشناس مقصد را انتخاب کنید. تاریخ‌ها می‌توانند متفاوت باشند.</p>
            </div>
            <span className={styles.swapBadge}>جابه‌جایی دو شیفت</span>
          </div>

          <div className={styles.swapComposer}>
            <div className={styles.slotCard}>
              <div className={styles.slotLabel}><span>۱</span> شیفت من</div>
              <label className={styles.field}>
                <span>تاریخ شیفت</span>
                <strong>{longFa(form.date)}</strong>
                <input type="date" value={form.date} min={tehranDate()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
            </div>

            <div className={styles.swapArrow} aria-hidden="true"><span>↔</span></div>

            <div className={styles.slotCard}>
              <div className={styles.slotLabel}><span>۲</span> شیفت مقصد</div>
              <label className={styles.field}>
                <span>کارشناس مقصد</span>
                <select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                  {targets.map((a) => <option value={a.id} key={a.id}>{a.name} · {a.team}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>تاریخ شیفت او</span>
                <strong>{longFa(form.targetDate)}</strong>
                <input type="date" value={form.targetDate} min={tehranDate()} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
              </label>
            </div>
          </div>

          <div className={styles.requestBottom}>
            <label className={styles.reasonField}>
              <span>دلیل یا توضیح <small>اختیاری</small></span>
              <input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="مثلاً مرخصی، مأموریت یا هماهنگی شخصی"
              />
            </label>
            <button
              className={styles.submitButton}
              disabled={busy || !form.date || !form.targetId || !form.targetDate}
              onClick={submit}
            >
              <Icon name="plus" />
              {busy ? "در حال ثبت..." : "ثبت درخواست"}
            </button>
          </div>

          <div className={styles.approvalFlow}>
            <div><i>۱</i><span><b>ثبت درخواست</b><small>توسط شما</small></span></div>
            <em />
            <div><i>۲</i><span><b>تأیید کارشناس مقصد</b><small>Accept / Reject</small></span></div>
            <em />
            <div><i>۳</i><span><b>تأیید مدیر</b><small>و اعمال روی تقویم</small></span></div>
          </div>
          <p className={styles.managerNote}>اگر کارشناس مقصد در دسترس نباشد، SOC Manager یا Security Manager می‌تواند به‌جای او تأیید و درخواست را اعمال کند.</p>
        </section>
      )}

      <section className={styles.requestsCard}>
        <div className={styles.listHeader}>
          <div>
            <span className={styles.sectionKicker}>{manager ? "نمای تیم" : "پیگیری درخواست‌ها"}</span>
            <h2>{manager ? "درخواست‌های تغییر شیفت تیم" : "درخواست‌های من"}</h2>
          </div>
          <div className={styles.filters}>
            <button data-active={filter === "open"} onClick={() => setFilter("open")}>در انتظار <b>{openCount}</b></button>
            <button data-active={filter === "resolved"} onClick={() => setFilter("resolved")}>نهایی‌شده <b>{resolvedCount}</b></button>
            <button data-active={filter === "all"} onClick={() => setFilter("all")}>همه <b>{requests.length}</b></button>
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
              <div className={styles.emptyIcon}>↔</div>
              <b>{filter === "open" ? "درخواست بازی وجود ندارد" : "درخواستی در این بخش نیست"}</b>
              <span>{me.keepsShiftLog && filter === "open" ? "درخواست جدید را از بخش بالا ثبت کنید." : "با تغییر فیلتر، سایر درخواست‌ها را ببینید."}</span>
            </div>
          )}

          {visibleRequests.map((r) => (
            <article className={styles.requestItem} data-status={r.status} key={r.id}>
              <div className={styles.requestTop}>
                <div className={styles.people}>
                  <Who id={r.requesterId} />
                  <span className={styles.peopleArrow}>↔</span>
                  <Who id={r.targetId} />
                </div>
                <span className={styles.status} data-status={r.status}>{STATUS_LABEL[r.status] || r.status}</span>
              </div>

              <div className={styles.requestSwap}>
                <ShiftCell label="شیفت درخواست‌کننده" date={r.date} type={r.requesterShift} />
                <div className={styles.requestSwapArrow}>↔</div>
                <ShiftCell label="شیفت کارشناس مقصد" date={r.targetDate} type={r.targetShift} />
              </div>

              {r.reason && <div className={styles.reason}><span>توضیح</span>{r.reason}</div>}

              {(OPEN.has(r.status) || (r.status === "pending_target" && me.id === r.targetId)) && (
                <div className={styles.actions}>
                  {r.status === "pending_target" && me.id === r.targetId && <>
                    <button className={styles.secondaryAction} disabled={busy} onClick={() => act(r.id, "reject")}>رد درخواست</button>
                    <button className={styles.primaryAction} disabled={busy} onClick={() => act(r.id, "accept")}>تأیید و ارسال برای مدیر</button>
                  </>}
                  {OPEN.has(r.status) && me.id === r.requesterId && (
                    <button className={styles.ghostAction} disabled={busy} onClick={() => act(r.id, "cancel")}>لغو درخواست</button>
                  )}
                  {manager && OPEN.has(r.status) && <>
                    <button className={styles.secondaryAction} disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                    <button className={styles.primaryAction} disabled={busy} onClick={() => act(r.id, "approve")}>
                      {r.status === "pending_target" ? "تأیید به‌جای کارشناس و اعمال" : "تأیید و اعمال"}
                    </button>
                  </>}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, tone = "default" }) {
  return <div className={styles.summary} data-tone={tone}><span>{label}</span><b>{value.toLocaleString("fa-IR")}</b></div>;
}

function ShiftCell({ label, date, type }) {
  const shift = SHIFT_TYPES[type];
  return (
    <div className={styles.shiftCell} data-shift={type || "none"}>
      <span>{label}</span>
      <b>{longFa(date)}</b>
      <small>{shift ? `${SHIFT_FA[type] || shift.label} · ${shift.start}–${shift.end}` : "شیفت نامشخص"}</small>
    </div>
  );
}
