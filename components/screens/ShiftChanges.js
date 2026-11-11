"use client";

import { useI18n as useShiftI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import { Who } from "@/components/ui/indicators";
import { addDays } from "@/lib/format";
import { isManager, isShiftEligible } from "@/lib/roles";
import { SHIFT_TYPES, isShiftType, tehranDate } from "@/lib/shifts";
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
const longFa = (iso, locale = "fa") => (iso ? (locale === "fa" ? PERSIAN_LONG.format(dateObj(iso)).replace(",", "،") : new Intl.DateTimeFormat("en-US-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(dateObj(iso))) : "—");
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
  const { t: __shiftTr, dir, locale, number, team: teamText } = useShiftI18n();
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(
    () => members.filter((m) => isShiftEligible(m)),
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
  const { data: scheduleData, error: scheduleError, reload: reloadSchedules } = useFetch(scheduleUrl);
  const requests = data?.requests ?? [];
  const schedules = scheduleData?.schedules ?? [];

  const ownSchedules = useMemo(
    () => schedules.filter((row) => row.userId === me.id && isShiftType(row.shiftType) && row.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)),
    [schedules, me.id]
  );
  const targetSchedules = useMemo(
    () => schedules.filter((row) => row.userId === form.targetId && isShiftType(row.shiftType) && row.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date)),
    [schedules, form.targetId]
  );

  // Rest days move to the vacated dates; scheduled work and leave remain real conflicts.
  const offDaysWillMove = !!scheduleData && !!form.date && !!form.targetDate && form.date !== form.targetDate &&
    schedules.some((row) => row.shiftType === "off" && (
      (row.userId === me.id && row.date === form.targetDate) ||
      (row.userId === form.targetId && row.date === form.date)
    ));
  const swapConflict = useMemo(() => {
    if (!scheduleData || !form.date || !form.targetDate || form.date === form.targetDate) return null;
    const mineOnDestination = schedules.find((row) => row.userId === me.id && row.date === form.targetDate);
    if (mineOnDestination && mineOnDestination.shiftType !== "off") return { ...mineOnDestination, requester: true };
    const theirsOnDestination = schedules.find((row) => row.userId === form.targetId && row.date === form.date);
    return theirsOnDestination && theirsOnDestination.shiftType !== "off" ? { ...theirsOnDestination, requester: false } : null;
  }, [scheduleData, schedules, me.id, form.date, form.targetDate, form.targetId]);
  const swapConflictMessage = swapConflict ? (() => {
    const person = swapConflict.requester ? (locale === "fa" ? "شما" : "you")
      : (analysts.find((a) => a.id === form.targetId)?.name || (locale === "fa" ? "کارشناس مقصد" : "the other analyst"));
    const type = locale === "fa"
      ? ({ morning: "شیفت صبح", evening: "شیفت تا ۸ شب", night: "شیفت شب", off: "تعطیل شیفت", leave: "مرخصی" }[swapConflict.shiftType] || "وضعیت")
      : ({ morning: "morning shift", evening: "shift until 8 p.m.", night: "night shift", off: "day off", leave: "leave" }[swapConflict.shiftType] || "assignment");
    const date = longFa(swapConflict.date, locale);
    return locale === "fa"
      ? `برای ${person} در تاریخ ${date} از قبل «${type}» ثبت شده است. تاریخ دیگری انتخاب کنید یا از مدیر بخواهید برنامه شیفت را اصلاح کند.`
      : `There is already a ${type} for ${person} on ${date}. Select another date or ask a manager to adjust the schedule.`;
  })() : null;

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
      .filter((row) => row.userId === targetId && isShiftType(row.shiftType) && row.date >= TODAY)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    setForm((current) => ({ ...current, targetId, targetDate: first?.date ?? "" }));
    setPicker(null);
  };

  const submit = async () => {
    if (!form.date || !form.targetId || !form.targetDate || swapConflict || busy) return;
    setBusy(true);
    try {
      await api("/api/shift/changes", { method: "POST", body: form });
      toast("درخواست تغییر شیفت ثبت شد");
      setForm({ ...form, reason: "" });
      setFilter("open");
      setPicker(null);
      reload();
    } catch (e) {
      if (/The (requester|other analyst) (already has|is marked as)/.test(e.message)) {
        reloadSchedules();
        toast(locale === "fa" ? "برنامه شیفت تغییر کرده است. تداخل روز مقصد را بررسی کنید و دوباره درخواست بدهید." : e.message, "error");
      } else {
        toast(e.message, "error");
      }
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
    <div className={`page ${styles.page}`} dir={dir}>
      <header className="page-head">
        <div className="page-head-main">
          <div>
            <h1>{"" + __shiftTr("تغییر شیفت") + ""}</h1>
            <div className="page-meta">
              <span>{"" + __shiftTr("جابه‌جایی شیفت بین کارشناسان") + ""}</span>
              <span>{number(openCount)} {__shiftTr("درخواست در انتظار")}</span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/shift/schedule"><Icon name="cal" />{" " + __shiftTr("تقویم شیفت") + ""}</Link>
        </div>
      </header>

      {me.keepsShiftLog && (
        <section className={`panel ${styles.requestCard}`}>
          <div className="panel-head">
            <div className={styles.headText}>
              <h2>{"" + __shiftTr("درخواست جدید") + ""}</h2>
              <span className="meta">{"" + __shiftTr("فقط روزهایی که واقعاً شیفت دارید قابل انتخاب هستند.") + ""}</span>
            </div>
            <ol className={styles.flow} aria-label={__shiftTr("مراحل تأیید")}>
              <li><span>{number(1)}</span>{__shiftTr("ثبت درخواست")}</li>
              <li><span>{number(2)}</span>{__shiftTr("تأیید کارشناس")}</li>
              <li><span>{number(3)}</span>{__shiftTr("تأیید مدیر")}</li>
            </ol>
          </div>

          <div className={`panel-body ${styles.compactForm}`}>
            <ShiftDateField
              label={__shiftTr("شیفت من")}
              rows={ownSchedules}
              value={form.date}
              open={picker === "mine"}
              onToggle={() => setPicker((v) => v === "mine" ? null : "mine")}
              onChange={(date) => { setForm((v) => ({ ...v, date })); setPicker(null); }}
            />

            <label className="field">
              <span className={styles.label}>{"" + __shiftTr("کارشناس مقصد") + ""}</span>
              <select className="input" value={form.targetId} onChange={(e) => changeTarget(e.target.value)}>
                {targets.map((a) => <option value={a.id} key={a.id}>{a.name} · {teamText(a.team)}</option>)}
              </select>
            </label>

            <ShiftDateField
              label={__shiftTr("شیفت کارشناس مقصد")}
              rows={targetSchedules}
              value={form.targetDate}
              open={picker === "target"}
              onToggle={() => setPicker((v) => v === "target" ? null : "target")}
              onChange={(targetDate) => { setForm((v) => ({ ...v, targetDate })); setPicker(null); }}
            />

            <label className="field">
              <span className={styles.label}>{"" + __shiftTr("دلیل") + " "}<em>{"" + __shiftTr("اختیاری") + ""}</em></span>
              <input
                className="input"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder={__shiftTr("مرخصی، مأموریت یا هماهنگی شخصی")}
              />
            </label>

            <button
              className="btn btn-primary"
              aria-busy={busy || undefined}
              disabled={busy || !form.date || !form.targetId || !form.targetDate || !!swapConflict}
              onClick={submit}
            >
              <Icon name="swap" />{"" + __shiftTr("ثبت درخواست") + ""}</button>
            {swapConflictMessage && <div className={styles.swapConflict} role="alert">
              <Icon name="alert" size="sm" /><span>{swapConflictMessage}</span>
            </div>}
            {offDaysWillMove && !swapConflict && <div className={styles.swapNotice} role="status">
              <Icon name="info" size="sm" />
              <span>{locale === "fa"
                ? "پس از تأیید مدیر، «تعطیل شیفت» هر کارشناس از روزی که شیفت جدید می‌گیرد به روزی که شیفت خود را واگذار می‌کند منتقل می‌شود."
                : "On manager approval, each existing day off will move from the new shift date to the date that analyst gives up."}</span>
            </div>}
          </div>

          <div className="panel-foot">
            {scheduleError && <span className={styles.scheduleError}><Icon name="alert" size="sm" />{"" + __shiftTr("دریافت تقویم شیفت‌ها ناموفق بود. صفحه را دوباره بارگذاری کنید.") + ""}</span>}
            <span className={styles.managerNote}><Icon name="bell" size="sm" />{"" + __shiftTr("کارشناس مقصد و مدیران از درخواست جدید باخبر می‌شوند. بعد از تأیید کارشناس مقصد، تأیید یکی از مدیران کافی است؛ مدیر می‌تواند مستقیم هم تأیید و اعمال کند.") + ""}</span>
          </div>
        </section>
      )}

      <section className={`panel ${styles.requestsCard}`}>
        <div className="panel-head">
          <h2>{__shiftTr(manager ? "درخواست‌های تیم" : "درخواست‌های من")}</h2>
          <span className="meta">{number(requests.length)} {__shiftTr("درخواست")}</span>
          <div className="right">
            <Segmented
              kind="tabs"
              label={__shiftTr("فیلتر درخواست‌ها")}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: __shiftTr("در انتظار"), count: number(openCount) },
                { value: "resolved", label: __shiftTr("نهایی"), count: number(resolvedCount) },
                { value: "all", label: __shiftTr("همه"), count: number(requests.length) },
              ]}
            />
          </div>
        </div>

        {error && (
          <div className={styles.errorState}>
            <Icon name="alert" />
            <span>{"" + __shiftTr("دریافت درخواست‌ها ناموفق بود.") + ""}</span>
            <button className="btn btn-ghost btn-sm" onClick={reload}>{"" + __shiftTr("تلاش دوباره") + ""}</button>
          </div>
        )}

        <div className={styles.requestList}>
          {loading && !data && (
            <div className="sk-rows sk-late" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i}><span className="sk" /><span className="sk" /><span className="sk" /><span className="sk" /></div>)}</div>
          )}
          {!loading && !error && visibleRequests.length === 0 && (
            <div className="empty compact">
              <span className="glyph"><Icon name="swap" /></span>
              <h3>{__shiftTr(filter === "open" ? "درخواست بازی وجود ندارد" : "درخواستی در این بخش نیست")}</h3>
              <p>{__shiftTr(me.keepsShiftLog && filter === "open" ? "از فرم بالا یک درخواست جدید ثبت کنید." : "فیلتر دیگری را انتخاب کنید.")}</p>
            </div>
          )}

          {visibleRequests.map((r) => (
            <article className={styles.requestItem} key={r.id}>
              <div className={styles.requestMain}>
                <div className={styles.people}>
                  <Who id={r.requesterId} />
                  <span className={styles.peopleArrow} aria-label={__shiftTr("جابه‌جایی با")}><Icon name="swap" size="sm" /></span>
                  <Who id={r.targetId} />
                  <span className={`badge dot ${STATUS_TONE[r.status] || ""}`}>{__shiftTr(STATUS_LABEL[r.status] || r.status)}</span>
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
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>{"" + __shiftTr("رد") + ""}</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "accept")}><Icon name="check" />{"" + __shiftTr("تأیید") + ""}</button>
                </>}
                {OPEN.has(r.status) && me.id === r.requesterId && (
                  <button className="btn btn-ghost danger btn-sm" disabled={busy} onClick={() => act(r.id, "cancel")}>{"" + __shiftTr("لغو درخواست") + ""}</button>
                )}
                {manager && OPEN.has(r.status) && <>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(r.id, "reject")}>{"" + __shiftTr("رد") + ""}</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(r.id, "approve")}>
                    <Icon name="check" />
                    {__shiftTr(r.status === "pending_target" ? "تأیید و اعمال" : "اعمال")}
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
  const { t, locale } = useShiftI18n();
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
        <span>{value ? longFa(value, locale) : t("شیفت آینده‌ای ثبت نشده")}</span>
        {selectedRow && <small data-shift={selectedRow.shiftType}>{t(SHIFT_FA[selectedRow.shiftType] || selectedRow.shiftType)}</small>}
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
  const { t: __shiftTr, locale, number } = useShiftI18n();
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.date, row])), [rows]);
  const cells = useMemo(() => monthCells(monthStart), [monthStart]);
  const monthKey = jalaliMonthKey(monthStart);
  const availableInMonth = rows.some((row) => jalaliMonthKey(row.date) === monthKey);

  return (
    <div className={styles.datePopover}>
      <div className={styles.datePopoverHead}>
        <button type="button" className="btn btn-ghost icon-btn btn-sm" onClick={() => setMonthStart(shiftJalaliMonth(monthStart, -1))} aria-label={__shiftTr("ماه قبل")}><Icon name="chev" /></button>
        <b>{locale === "fa" ? PERSIAN_MONTH.format(dateObj(monthStart)) : new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "long", timeZone: "UTC" }).format(dateObj(monthStart))}</b>
        <button type="button" className="btn btn-ghost icon-btn btn-sm" onClick={() => setMonthStart(shiftJalaliMonth(monthStart, 1))} aria-label={__shiftTr("ماه بعد")}><Icon name="left" /></button>
      </div>
      <div className={styles.miniWeekdays}>{(locale === "fa" ? WEEKDAYS : ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"]).map((day) => <span key={day}>{day}</span>)}</div>
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
              title={row ? `${longFa(date, locale)} · ${__shiftTr(SHIFT_FA[row.shiftType])}` : undefined}
            >
              <span>{number(jalaliParts(date).day)}</span>
              {row && currentMonth && <i />}
            </button>
          );
        })}
      </div>
      {!availableInMonth && <div className={styles.noMonthShift}>{"" + __shiftTr("در این ماه شیفتی برای انتخاب وجود ندارد.") + ""}</div>}
    </div>
  );
}

function ShiftInline({ date, type }) {
  const { t, locale } = useShiftI18n();
  const shift = SHIFT_TYPES[type];
  return (
    <span className={styles.shiftInline} data-shift={type}>
      <i />
      <b>{longFa(date, locale)}</b>
      <small>{shift ? `${t(SHIFT_FA[type] || shift.label)} · ${shift.start}–${shift.end}` : t("شیفت نامشخص")}</small>
    </span>
  );
}
