"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { addDays } from "@/lib/format";
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
const STATUS_TONE = {
  pending_target: "warning",
  pending_manager: "info",
  approved: "success",
  rejected: "danger",
};
const SHIFT_FA = { morning: "صبح", evening: "تا ۸ شب", night: "شب" };
const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const TODAY = tehranDate();
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const PERSIAN_MONTH = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});
const PERSIAN_CAL = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});
const FA_NUM = new Intl.NumberFormat("fa-IR", { useGrouping: false });

const dateObj = (iso) => new Date(`${iso}T00:00:00Z`);
const longFa = (iso) => (iso ? PERSIAN_LONG.format(dateObj(iso)).replace(",", "،") : "—");
const faNum = (n) => FA_NUM.format(n);
const toEnglishDigits = (value) => String(value).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

function jalaliParts(iso) {
  const parts = PERSIAN_CAL.formatToParts(dateObj(iso));
  const pick = (type) => Number(toEnglishDigits(parts.find((p) => p.type === type)?.value || 0));
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function jalaliMonthKey(iso) {
  const { year, month } = jalaliParts(iso);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function firstOfJalaliMonth(iso) {
  return addDays(iso, -(jalaliParts(iso).day - 1));
}

function shiftJalaliMonth(monthStart, amount) {
  return amount > 0 ? firstOfJalaliMonth(addDays(monthStart, 32)) : firstOfJalaliMonth(addDays(monthStart, -1));
}

function monthCells(monthStart) {
  const firstWeekday = dateObj(monthStart).getUTCDay();
  const start = addDays(monthStart, -((firstWeekday + 1) % 7));
  const nextMonth = shiftJalaliMonth(monthStart, 1);
  const lastDay = addDays(nextMonth, -1);
  const lastWeekday = dateObj(lastDay).getUTCDay();
  const end = addDays(lastDay, (5 - lastWeekday + 7) % 7);
  const count = Math.round((dateObj(end).getTime() - dateObj(start).getTime()) / 864e5) + 1;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export default function ShiftChanges() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(
    () => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)),
    [members]
  );
  const targets = analysts.filter((a) => a.id !== me.id);
  const [form, setForm] = useState({
    date: "",
    targetId: targets[0]?.id ?? "",
    targetDate: "",
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");
  const [picker, setPicker] = useState(null);
  const { data, loading, error, reload } = useFetch("/api/shift/changes");
  const scheduleUrl = me.keepsShiftLog ? `/api/shift/schedule?from=${TODAY}&to=${addDays(TODAY, 370)}` : null;
  const { data: scheduleData, error: scheduleError } = useFetch(scheduleUrl);
  const requests = data?.requests ?? [];
  const schedules = scheduleData?.schedules ?? [];

  const ownSchedules = useMemo(
    () => schedules.filter((row) => row.userId === me.id && row.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)),
    [schedules, me.id]
  );
  const targetSchedules = useMemo(
    () => schedules.filter((row) => row.userId === form.targetId && row.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)),
    [schedules, form.targetId]
  );

  useEffect(() => {
    if (!scheduleData) return;
    setForm((current) => {
      const ownValid = ownSchedules.some((row) => row.date === current.date);
      const targetValid = targetSchedules.some((row) => row.date === current.targetDate);
      const nextDate = ownValid ? current.date : (ownSchedules[0]?.date ?? "");
      const nextTargetDate = targetValid ? current.targetDate : (targetSchedules[0]?.date ?? "");
      if (nextDate === current.date && nextTargetDate === current.targetDate) return current;
      return { ...current, date: nextDate, targetDate: nextTargetDate };
    });
  }, [scheduleData, ownSchedules, targetSchedules]);

  const openCount = requests.filter((r) => OPEN.has(r.status)).length;
  const resolvedCount = requests.length - openCount;
  const visibleRequests = requests.filter((r) => {
    if (filter === "open") return OPEN.has(r.status);
    if (filter === "resolved") return !OPEN.has(r.status);
    return true;
  });

  const changeTarget = (targetId) => {
    const first = schedules
      .filter((row) => row.userId === targetId && row.date >= TODAY)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    setForm((current) => ({ ...current, targetId, targetDate: first?.date ?? "" }));
    setPicker(null);
  };

  const submit = async () => {
    if (!form.date || !form.targetId || !form.targetDate || busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "POST", body: form });
      toast("درخواست تغییر شیفت ثبت شد");
      setForm({ ...form, reason: "" });
      setFilter("open");
      setPicker(null);
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
      <header className="page-head">
        <div className="page-head-main">
          <div>
            <h1>تغییر شیفت</h1>
            <div className="page-meta">
              <span>جابه‌جایی شیفت بین کارشناسان</span>
              <span>{faNum(openCount)} درخواست در انتظار</span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/shift/schedule"><Icon name="cal" /> تقویم شیفت</Link>
        </div>
      </header>

      {me.keepsShiftLog && (
        <section className={`panel ${styles.requestCard}`}>
          <div className="panel-head">
            <div className={styles.headText}>
              <h2>درخواست جدید</h2>
              <span className="meta">فقط روزهایی که واقعاً شیفت دارید قابل انتخاب هستند.</span>
            </div>
            <ol className={styles.flow} aria-label="مراحل تأیید">
              <li><span>۱</span>ثبت درخواست</li>
              <li><span>۲</span>تأیید کارشناس</li>
              <li><span>۳</span>تأیید مدیر</li>
            </ol>
          </div>

          <div className={`panel-body ${styles.compactForm}`}>
            <ShiftDateField
              label="شیفت من"
              rows={ownSchedules}
              value={form.date}
              open={picker === "mine"}
              onToggle={() => setPicker((v) => v === "mine" ? null : "mine")}
              onChange={(date) => { setForm((v) => ({ ...v, date })); setPicker(null); }}
            />

            <label className="field">
              <span className={styles.label}>کارشناس مقصد</span>
              <select className="input" value={form.targetId} onChange={(e) => changeTarget(e.target.value)}>
                {targets.map((a) => <option value={a.id} key={a.id}>{a.name} · {a.team}</option>)}
              </select>
            </label>

            <ShiftDateField
              label="شیفت کارشناس مقصد"
              rows={targetSchedules}
              value={form.targetDate}
              open={picker === "target"}
              onToggle={() => setPicker((v) => v === "target" ? null : "target")}
              onChange={(targetDate) => { setForm((v) => ({ ...v, targetDate })); setPicker(null); }}
            />

            <label className="field">
              <span className={styles.label}>دلیل <em>اختیاری</em></span>
              <input
                className="input"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="مرخصی، مأموریت یا هماهنگی شخصی"
              />
            </label>

            <button
              className="btn btn-primary"
              aria-busy={busy || undefined}
              disabled={busy || !form.date || !form.targetId || !form.targetDate}
              onClick={submit}
            >
              <Icon name="swap" />
              ثبت درخواست
            </button>
          </div>

          <div className="panel-foot">
            {scheduleError && <span className={styles.scheduleError}><Icon name="alert" size="sm" />دریافت تقویم شیفت‌ها ناموفق بود. صفحه را دوباره بارگذاری کنید.</span>}
            <span className={styles.managerNote}><Icon name="bell" size="sm" />کارشناس مقصد و مدیران از درخواست جدید باخبر می‌شوند. بعد از تأیید کارشناس مقصد، تأیید یکی از مدیران کافی است؛ مدیر می‌تواند مستقیم هم تأیید و اعمال کند.</span>
          </div>
        </section>
      )}

      <section className={`panel ${styles.requestsCard}`}>
        <div className="panel-head">
          <h2>{manager ? "درخواست‌های تیم" : "درخواست‌های من"}</h2>
          <span className="meta">{faNum(requests.length)} درخواست</span>
          <div className="right">
            <div className="seg" role="tablist" aria-label="فیلتر درخواست‌ها">
              <button role="tab" aria-selected={filter === "open"} className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>در انتظار <span className="count">{faNum(openCount)}</span></button>
              <button role="tab" aria-selected={filter === "resolved"} className={filter === "resolved" ? "on" : ""} onClick={() => setFilter("resolved")}>نهایی <span className="count">{faNum(resolvedCount)}</span></button>
              <button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>همه <span className="count">{faNum(requests.length)}</span></button>
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.errorState}>
            <Icon name="alert" />
            <span>دریافت درخواست‌ها ناموفق بود.</span>
            <button className="btn btn-ghost btn-sm" onClick={reload}>تلاش دوباره</button>
          </div>
        )}

        <div className={styles.requestList}>
          {loading && !data && (
            <div className="sk-rows sk-late" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i}><span className="sk" /><span className="sk" /><span className="sk" /><span className="sk" /></div>)}</div>
          )}
          {!loading && !error && visibleRequests.length === 0 && (
            <div className="empty compact">
              <span className="glyph"><Icon name="swap" /></span>
              <h3>{filter === "open" ? "درخواست بازی وجود ندارد" : "درخواستی در این بخش نیست"}</h3>
              <p>{me.keepsShiftLog && filter === "open" ? "از فرم بالا یک درخواست جدید ثبت کنید." : "فیلتر دیگری را انتخاب کنید."}</p>
            </div>
          )}

          {visibleRequests.map((r) => (
            <article className={styles.requestItem} key={r.id}>
              <div className={styles.requestMain}>
                <div className={styles.people}>
                  <Who id={r.requesterId} />
                  <span className={styles.peopleArrow} aria-label="جابه‌جایی با"><Icon name="swap" size="sm" /></span>
                  <Who id={r.targetId} />
                  <span className={`badge dot ${STATUS_TONE[r.status] || ""}`}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>

                <div className={styles.swapLine}>
                  <ShiftInline date={r.date} type={r.requesterShift} />
                  <Icon name="left" size="sm" />
                  <ShiftInline date={r.targetDate} type={r.targetShift} />
                </div>

                {r.reason && <div className={styles.reason}>«{r.reason}»</div>}
              </div>

              <div className={styles.actions}>
                {r.status === "pending_target" && me.id === r.targetId && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "accept")}><Icon name="check" />تأیید</button>
                </>}
                {OPEN.has(r.status) && me.id === r.requesterId && (
                  <button className="btn btn-ghost danger btn-sm" disabled={busy} onClick={() => act(r.id, "cancel")}>لغو درخواست</button>
                )}
                {manager && OPEN.has(r.status) && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>رد</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "approve")}>
                    <Icon name="check" />
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

function ShiftDateField({ label, rows, value, open, onToggle, onChange }) {
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.date, row])), [rows]);
  const selectedRow = rowMap.get(value);
  const [monthStart, setMonthStart] = useState(() => firstOfJalaliMonth(value || rows[0]?.date || TODAY));

  useEffect(() => {
    const anchor = value || rows[0]?.date;
    if (anchor) setMonthStart(firstOfJalaliMonth(anchor));
  }, [value, rows]);

  return (
    <div className={`field ${styles.dateField}`}>
      <span className={styles.label}>{label}</span>
      <button type="button" className={`input ${styles.dateTrigger}`} onClick={onToggle} disabled={!rows.length} aria-expanded={open} aria-haspopup="dialog">
        <Icon name="cal" />
        <span>{value ? longFa(value) : "شیفت آینده‌ای ثبت نشده"}</span>
        {selectedRow && <small data-shift={selectedRow.shiftType}>{SHIFT_FA[selectedRow.shiftType] || selectedRow.shiftType}</small>}
      </button>
      {open && rows.length > 0 && (
        <MiniShiftCalendar
          monthStart={monthStart}
          setMonthStart={setMonthStart}
          rows={rows}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function MiniShiftCalendar({ monthStart, setMonthStart, rows, value, onChange }) {
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.date, row])), [rows]);
  const cells = useMemo(() => monthCells(monthStart), [monthStart]);
  const monthKey = jalaliMonthKey(monthStart);
  const availableInMonth = rows.some((row) => jalaliMonthKey(row.date) === monthKey);

  return (
    <div className={styles.datePopover}>
      <div className={styles.datePopoverHead}>
        <button type="button" className="btn btn-ghost icon-btn btn-sm" onClick={() => setMonthStart(shiftJalaliMonth(monthStart, -1))} aria-label="ماه قبل"><Icon name="chev" /></button>
        <b>{PERSIAN_MONTH.format(dateObj(monthStart))}</b>
        <button type="button" className="btn btn-ghost icon-btn btn-sm" onClick={() => setMonthStart(shiftJalaliMonth(monthStart, 1))} aria-label="ماه بعد"><Icon name="left" /></button>
      </div>
      <div className={styles.miniWeekdays}>{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.miniGrid}>
        {cells.map((date) => {
          const row = rowMap.get(date);
          const currentMonth = jalaliMonthKey(date) === monthKey;
          const selected = date === value;
          return (
            <button
              type="button"
              key={date}
              data-shift={row?.shiftType || "none"}
              data-selected={selected || undefined}
              data-outside={!currentMonth || undefined}
              disabled={!row || !currentMonth}
              onClick={() => onChange(date)}
              title={row ? `${longFa(date)} · ${SHIFT_FA[row.shiftType]}` : undefined}
            >
              <span>{faNum(jalaliParts(date).day)}</span>
              {row && currentMonth && <i />}
            </button>
          );
        })}
      </div>
      {!availableInMonth && <div className={styles.noMonthShift}>در این ماه شیفتی برای انتخاب وجود ندارد.</div>}
    </div>
  );
}

function ShiftInline({ date, type }) {
  const shift = SHIFT_TYPES[type];
  return (
    <span className={styles.shiftInline} data-shift={type}>
      <i />
      <b>{longFa(date)}</b>
      <small>{shift ? `${SHIFT_FA[type] || shift.label} · ${shift.start}–${shift.end}` : "شیفت نامشخص"}</small>
    </span>
  );
}
