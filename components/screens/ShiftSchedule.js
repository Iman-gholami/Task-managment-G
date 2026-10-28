"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { isManager, isShiftEligible, shiftChecklistTeam } from "@/lib/roles";
import { addDays } from "@/lib/format";
import { ROSTER_KEYS, scheduleStats, tehranDate } from "@/lib/shifts";
import { availableRosterCandidates, bulkRosterSelection, draftAssignment, rosterCandidates } from "@/lib/roster-editor";
import styles from "./ShiftSchedule.module.css";
import ShiftExcelImport from "./ShiftExcelImport";

const SHIFT_KEYS = ROSTER_KEYS;
const SHIFT_META = {
  morning: { label: "شیفت صبح", short: "صبح", time: "۰۷:۳۰ تا ۱۵:۱۵" },
  evening: { label: "شیفت تا ۸ شب", short: "تا ۸", time: "۰۷:۳۰ تا ۲۰:۰۰" },
  night: { label: "شیفت شب", short: "شب", time: "۲۰:۰۰ تا ۰۸:۰۰" },
  off: { label: "تعطیل شیفت", short: "تعطیل", time: "روز استراحت · بدون شیفت‌لاگ" },
  leave: { label: "مرخصی", short: "مرخصی", time: "مرخصی روزانه · بدون شیفت‌لاگ" },
};
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const TODAY = tehranDate();

const PERSIAN_CAL = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
const PERSIAN_MONTH = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", timeZone: "UTC" });
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const FA_NUM = new Intl.NumberFormat("fa-IR", { useGrouping: false, maximumFractionDigits: 2 });

const toEnglishDigits = (value) => String(value).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const faNum = (value) => FA_NUM.format(value ?? 0);
const dateObj = (iso) => new Date(`${iso}T00:00:00Z`);
const daysBetween = (a, b) => Math.round((dateObj(b).getTime() - dateObj(a).getTime()) / 864e5);

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

function calendarRange(monthStart) {
  const firstWeekday = dateObj(monthStart).getUTCDay();
  const start = addDays(monthStart, -((firstWeekday + 1) % 7));
  const nextMonth = shiftJalaliMonth(monthStart, 1);
  const lastDay = addDays(nextMonth, -1);
  const lastWeekday = dateObj(lastDay).getUTCDay();
  return { start, end: addDays(lastDay, (5 - lastWeekday + 7) % 7) };
}

function groupByDate(schedules) {
  const map = {};
  for (const row of schedules || []) (map[row.date] ??= []).push(row);
  for (const rows of Object.values(map)) rows.sort((a, b) => SHIFT_KEYS.indexOf(a.shiftType) - SHIFT_KEYS.indexOf(b.shiftType) || a.name.localeCompare(b.name));
  return map;
}

function formatDate(iso) {
  return PERSIAN_LONG.format(dateObj(iso)).replace(",", "،"); // Persian comma
}

export default function ShiftSchedule() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(
    () => members.filter((m) => isShiftEligible(m)),
    [members]
  );

  const [monthStart, setMonthStart] = useState(() => firstOfJalaliMonth(TODAY));
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedShift, setSelectedShift] = useState("morning");
  const [editor, setEditor] = useState(null);
  const [draftByShift, setDraftByShift] = useState(() => Object.fromEntries(SHIFT_KEYS.map((key) => [key, []])));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [holidayEditor, setHolidayEditor] = useState(null);
  const [excelEditor, setExcelEditor] = useState(false);

  const range = useMemo(() => calendarRange(monthStart), [monthStart]);
  const { data, loading, error, reload } = useFetch(`/api/shift/schedule?from=${range.start}&to=${range.end}`);
  const schedules = data?.schedules ?? [];
  const centerHolidays = data?.centerHolidays ?? [];
  const holidayByDate = useMemo(() => Object.fromEntries(centerHolidays.map((row) => [row.date, row])), [centerHolidays]);
  const byDate = useMemo(() => groupByDate(schedules), [schedules]);
  const monthKey = jalaliMonthKey(monthStart);
  const monthSchedules = useMemo(() => schedules.filter((row) => jalaliMonthKey(row.date) === monthKey), [schedules, monthKey]);
  const stats = useMemo(
    () => scheduleStats(selectedUser ? monthSchedules.filter((row) => row.userId === selectedUser) : monthSchedules),
    [monthSchedules, selectedUser]
  );
  const selectedRows = byDate[selectedDate] ?? [];
  const selectedHoliday = holidayByDate[selectedDate] ?? null;
  const cells = useMemo(() => Array.from({ length: daysBetween(range.start, range.end) + 1 }, (_, i) => addDays(range.start, i)), [range.start, range.end]);
  const selectedPerson = analysts.find((a) => a.id === selectedUser);
  const draftIds = editor ? (draftByShift[editor.shiftType] ?? []) : [];
  const visibleAnalysts = useMemo(
    () => editor ? rosterCandidates(analysts, draftByShift, editor.shiftType, query) : [],
    [analysts, draftByShift, editor, query]
  );
  const availableAnalysts = editor ? availableRosterCandidates(visibleAnalysts, draftByShift, editor.shiftType) : [];
  const selectableIds = new Set(availableAnalysts.map((person) => person.id));
  const unselectedCount = availableAnalysts.filter((person) => !draftIds.includes(person.id)).length;

  const openComposer = (date = selectedDate, shiftType = selectedShift) => {
    if (!manager || !data) return;
    setSelectedDate(date);
    setSelectedShift(shiftType);
    setEditor({ date, shiftType });
    const day = byDate[date] ?? [];
    setDraftByShift(Object.fromEntries(SHIFT_KEYS.map((key) => [
      key, day.filter((row) => row.shiftType === key).map((row) => row.userId),
    ])));
    setQuery("");
  };

  const closeComposer = () => setEditor(null);

  const openHolidayEditor = (date = selectedDate) => {
    if (!manager || !data) return;
    setHolidayEditor({ date, note: holidayByDate[date]?.note ?? "", closed: !!holidayByDate[date] });
  };

  const saveHoliday = async () => {
    if (!holidayEditor || saving) return;
    setSaving(true);
    try {
      const closing = !holidayEditor.closed;
      await api("/api/shift/schedule", {
        method: "PATCH",
        body: { date: holidayEditor.date, closed: closing, note: holidayEditor.note },
      });
      toast(closing ? "تعطیلی مرکز ثبت شد؛ شیفت‌ها بدون تغییر باقی ماندند" : "علامت تعطیلی مرکز برداشته شد");
      setSelectedDate(holidayEditor.date);
      setHolidayEditor(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const changeEditorShift = (shiftType) => {
    if (!editor) return;
    setEditor({ ...editor, shiftType });
    setSelectedShift(shiftType);
    // Keep unsaved selections on the other two shift tabs.
  };

  const toggleDraft = (userId) => {
    if (!editor) return;
    setDraftByShift((current) => {
      const chosen = editor.shiftType;
      const wasSelected = current[chosen].includes(userId);
      return Object.fromEntries(SHIFT_KEYS.map((key) => [
        key,
        key === chosen
          ? wasSelected
            ? current[key].filter((id) => id !== userId)
            : [...current[key], userId]
          : current[key].filter((id) => id !== userId),
      ]));
    });
  };

  const changeBulk = (select) => {
    if (!editor || saving) return;
    setDraftByShift((current) => bulkRosterSelection(
      current,
      editor.shiftType,
      availableRosterCandidates(visibleAnalysts, current, editor.shiftType),
      select
    ));
  };

  const save = async () => {
    if (!editor || saving) return;
    setSaving(true);
    try {
      await api("/api/shift/schedule", { method: "PUT", body: { date: editor.date, assignments: draftByShift } });
      toast("برنامه کاری، تعطیل و مرخصی روز ذخیره شد");
      setSelectedDate(editor.date);
      setSelectedShift(editor.shiftType);
      closeComposer();
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (saving) return;
    setSaving(true);
    try {
      await api("/api/shift/schedule", { method: "DELETE", body: { date: row.date, userId: row.userId } });
      toast("شیفت حذف شد");
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (amount) => {
    const next = shiftJalaliMonth(monthStart, amount);
    setMonthStart(next);
    setSelectedDate(next);
  };

  const goToday = () => {
    setMonthStart(firstOfJalaliMonth(TODAY));
    setSelectedDate(TODAY);
  };

  return (
    <div className={`page ${styles.page}`} dir="rtl">
      <header className="page-head">
        <div className="page-head-main">
          <div>
            <h1>مدیریت شیفت نیروها</h1>
            <div className="page-meta">
              <span>{PERSIAN_MONTH.format(dateObj(monthStart))}</span>
              <span>{data ? `${faNum(stats.total)} شیفت کاری · ${faNum(stats.off)} تعطیل · ${faNum(stats.leave)} مرخصی` : error ? "برنامه دریافت نشد" : "در حال دریافت برنامه"}</span>
              <span>{faNum(analysts.length)} کارشناس</span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/shift/changes"><Icon name="swap" /> تغییر شیفت</Link>
          {manager && <button className="btn btn-secondary" onClick={() => setExcelEditor(true)}><Icon name="plus" /> ورود از اکسل</button>}
          {manager && <button className="btn btn-primary" disabled={!data} title={!data ? "ابتدا برنامه شیفت باید دریافت شود" : undefined} onClick={() => openComposer()}><Icon name="plus" /> ثبت شیفت</button>}
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={`panel ${styles.calendarCard}`} aria-label="تقویم ماهانه">
          <div className={styles.calendarHeader}>
            <div className={styles.monthHeading}>
              <span>تقویم شیفت‌ها</span>
              <h2 className={styles.monthTitle}>{PERSIAN_MONTH.format(dateObj(monthStart))}</h2>
            </div>
            <div className={styles.monthNav}>
              <button className="btn btn-ghost icon-btn btn-sm" aria-label="ماه قبل" data-tooltip="ماه قبل" onClick={() => changeMonth(-1)}><Icon name="chev" /></button>
              <button className="btn btn-ghost btn-sm" onClick={goToday}>امروز</button>
              <button className="btn btn-ghost icon-btn btn-sm" aria-label="ماه بعد" data-tooltip="ماه بعد" onClick={() => changeMonth(1)}><Icon name="left" /></button>
            </div>

            <label className={styles.analystSelect}>
              <span>آمار و شیفت کارشناس</span>
              <select className={`input input-sm ${selectedUser ? "is-set" : ""}`} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} title="با انتخاب کارشناس، آمار ماه به او محدود و شیفت‌هایش برجسته می‌شود.">
                <option value="">همه کارشناسان</option>
                {analysts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>

          {error && <div className={styles.errorBar}><Icon name="alert" /><span>دریافت برنامه شیفت ناموفق بود.</span><button className="btn btn-ghost btn-sm" onClick={reload}>تلاش دوباره</button></div>}

          <div className={styles.weekdays}>{WEEKDAYS.map((day) => <div key={day}>{day}</div>)}</div>
          <div className={`${styles.grid} ${loading && !data ? styles.loading : ""}`}>
            {cells.map((date) => {
              const parts = jalaliParts(date);
              const currentMonth = jalaliMonthKey(date) === monthKey;
              const rows = byDate[date] ?? [];
              const isFriday = dateObj(date).getUTCDay() === 5;
              return (
                <div
                  key={date}
                  role="button"
                  tabIndex={0}
                  aria-pressed={date === selectedDate}
                  data-center-holiday={holidayByDate[date] ? "true" : undefined}
                  className={`${styles.day} ${!currentMonth ? styles.outside : ""} ${date === selectedDate ? styles.selectedDay : ""} ${date === TODAY ? styles.today : ""} ${isFriday ? styles.friday : ""}`}
                  onClick={() => setSelectedDate(date)}
                  onDoubleClick={() => openComposer(date, selectedShift)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDate(date);
                    }
                  }}
                  aria-label={`${formatDate(date)}${holidayByDate[date] ? " · تعطیلی مرکز" : ""}`}
                >
                  <div className={styles.dayTop}>
                    <b>{faNum(parts.day)}</b>
                    {date === TODAY && <span>امروز</span>}
                  </div>

                  <div className={styles.shiftBands}>
                    {holidayByDate[date] && <span className={styles.calendarHoliday}><Icon name="info" size="sm" /> تعطیلی مرکز</span>}
                    {SHIFT_KEYS.map((shiftType) => {
                      const shiftRows = rows.filter((row) => row.shiftType === shiftType);
                      if (!shiftRows.length) return null;
                      const includesSelected = selectedUser ? shiftRows.some((row) => row.userId === selectedUser) : false;
                      return (
                        <button
                          type="button"
                          className={styles.shiftBand}
                          data-shift={shiftType}
                          data-selected-person={includesSelected ? "true" : "false"}
                          data-dim={selectedUser && !includesSelected ? "true" : undefined}
                          key={shiftType}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(date);
                            setSelectedShift(shiftType);
                          }}
                          data-tooltip={`${SHIFT_META[shiftType].label} · ${faNum(shiftRows.length)} نفر`}
                        >
                          <i />
                          <span>{SHIFT_META[shiftType].short}</span>
                          <strong>{faNum(shiftRows.length)}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.legend}>
            <span className={styles.holidayLegend}><Icon name="info" size="sm" /> تعطیلی مرکز</span>
            {SHIFT_KEYS.map((key) => <span key={key} data-shift={key}><i />{SHIFT_META[key].label}</span>)}
            {selectedUser && <span className={styles.legendHint}>شیفت‌های {selectedPerson?.name || "کارشناس انتخاب‌شده"} برجسته شده‌اند.</span>}
          </div>
        </section>

        <aside className={`panel ${styles.detailsCard}`} aria-label="نمای کلی روز">
          <div className={styles.detailsHead}>
            <div>
              <span className="eyebrow">{selectedDate === TODAY ? "برنامه امروز" : "برنامه روز انتخاب‌شده"}</span>
              <h2>{formatDate(selectedDate)}</h2>
            </div>
            {manager && (
              <button type="button" className="btn btn-primary btn-sm" disabled={!data} title={!data ? "ابتدا برنامه شیفت باید دریافت شود" : undefined} onClick={() => openComposer(selectedDate, "morning")}>
                <Icon name="plus" /> چیدن شیفت
              </button>
            )}
          </div>

          {selectedHoliday && (
            <div className={styles.holidayNotice} role="status">
              <b><Icon name="info" size="sm" /> تعطیلی مرکز</b>
              {selectedHoliday.note && <p>{selectedHoliday.note}</p>}
              <span>شیفت نیروهای کشیک نیز برای همین روز نمایش داده می‌شود.</span>
            </div>
          )}
          {data ? <div className={styles.dayOverview} aria-label="خلاصه شیفت‌های روز">
              {["morning", "evening", "night"].map((type) => {
                const rows = selectedRows.filter((row) => row.shiftType === type);
                return (
                  <section key={type} className={styles.overviewShift} data-shift={type} aria-label={SHIFT_META[type].label}>
                    <header className={styles.overviewHead}>
                      <span className={styles.overviewTitle}><i /> <b>{SHIFT_META[type].short}</b> <small>{SHIFT_META[type].time}</small></span>
                      {rows.length > 0 && <span className={styles.overviewCount}>{faNum(rows.length)} نفر</span>}
                    </header>
                    <div className={styles.overviewNames}>
                      {rows.length === 0 ? <span className={styles.overviewEmpty}>ثبت نشده</span> : rows.map((row) => (
                        <span className={styles.overviewPerson} key={row.userId}>
                          <button type="button" className={styles.overviewPersonName} onClick={() => setSelectedUser(row.userId)}><Who id={row.userId} /></button>
                          {manager && <button type="button" className={styles.removeMini} aria-label="حذف از شیفت" title={`حذف ${row.name} از شیفت`} disabled={saving} onClick={() => remove(row)}><Icon name="x" size="sm" /></button>}
                        </span>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div> : <p className={styles.overviewMessage} role="status">{error ? "برای دیدن برنامه روز، دوباره تلاش کنید." : "در حال دریافت برنامه روز…"}</p>}


          {data && <details className={styles.extraDetails}>
            <summary>تعطیلی نیروها و مرخصی <span>{faNum(selectedRows.filter((r) => r.shiftType === "off").length + selectedRows.filter((r) => r.shiftType === "leave").length)} نفر</span></summary>
            <div className={styles.absenceGroups}>
              {["off", "leave"].map((type) => (
                <section key={type} className={styles.absenceGroup} data-shift={type}>
                  <b>{SHIFT_META[type].label}</b>
                  <div className={styles.overviewNames}>
                    {selectedRows.filter((r) => r.shiftType === type).length === 0
                      ? <span className={styles.overviewEmpty}>ثبت نشده</span>
                      : selectedRows.filter((r) => r.shiftType === type).map((row) => (
                        <span className={styles.overviewPerson} key={row.userId}>
                          <button type="button" className={styles.overviewPersonName} onClick={() => setSelectedUser(row.userId)}><Who id={row.userId} /></button>
                          {manager && <button type="button" className={styles.removeMini} aria-label="حذف از شیفت" disabled={saving} onClick={() => remove(row)}><Icon name="x" size="sm" /></button>}
                        </span>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </details>}

          {manager && (
            <div className={styles.manageDayActions}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!data} title={!data ? "ابتدا برنامه شیفت باید دریافت شود" : undefined} onClick={() => openHolidayEditor()}>
                <Icon name="edit" /> {selectedHoliday ? "برداشتن تعطیلی مرکز" : "ثبت تعطیلی مرکز"}
              </button>
            </div>
          )}

          {data && <details className={styles.extraDetails}>
            <summary>آمار ماهانه <span>{selectedPerson?.name || "همه کارشناسان"}</span></summary>
            <div className={styles.statsDetails}>
              {selectedUser && <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser("")}>نمایش همه کارشناسان</button>}
              <div className={styles.analystPrimary}>
                <div><strong>{faNum(stats.hours)}</strong><span>ساعت</span></div>
                <div><strong>{faNum(stats.total)}</strong><span>شیفت</span></div>
              </div>
              <div className={styles.analystMiniGrid}>
                <MiniStat label="صبح" value={stats.morning} tone="morning" />
                <MiniStat label="تا ۸" value={stats.evening} tone="evening" />
                <MiniStat label="شب" value={stats.night} tone="night" />
                <MiniStat label="تعطیل شیفت" value={stats.off} tone="off" />
                <MiniStat label="مرخصی" value={stats.leave} tone="leave" />
                <MiniStat label="پنجشنبه" value={stats.thursdays} />
                <MiniStat label="جمعه" value={stats.fridays} />
              </div>
            </div>
          </details>}
        </aside>
      </div>

      {excelEditor && (
        <ShiftExcelImport onClose={() => setExcelEditor(false)} onImported={(date, result) => {
          setExcelEditor(false);
          setMonthStart(firstOfJalaliMonth(date));
          setSelectedDate(date);
          reload();
          toast(`${faNum(result.importedDays)} روز و ${faNum(result.importedEntries)} وضعیت از اکسل ثبت شد`);
        }} />
      )}

      {holidayEditor && (
        <Dialog
          label="تعطیلی مرکز"
          title={`تعطیلی مرکز · ${formatDate(holidayEditor.date)}`}
          description="این علامت وضعیت تعطیلی مرکز را نشان می‌دهد؛ حتی در این روز هم می‌توان برای نیروهای کشیک شیفت ثبت کرد."
          onClose={() => setHolidayEditor(null)}
          width={500}
        >
          <div className="modal-body">
            {!holidayEditor.closed && (
              <>
                <label className={styles.holidayNoteLabel} htmlFor="holiday-reason">علت تعطیلی (اختیاری)</label>
                <input id="holiday-reason" className="input" maxLength={240} value={holidayEditor.note} onChange={(e) => setHolidayEditor((v) => ({ ...v, note: e.target.value }))} placeholder="مثلاً تعطیلی اعلام‌شده از طرف مرکز" />
                <p className={styles.holidayWarning}>این تاریخ در تقویم قرمز می‌شود؛ شیفت‌ها، مرخصی‌ها و گزارش‌های قبلی بدون تغییر باقی می‌مانند.</p>
              </>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={() => setHolidayEditor(null)}>انصراف</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={saveHoliday}>
              {holidayEditor.closed ? "برداشتن تعطیلی" : "تأیید تعطیلی مرکز"}
            </button>
          </div>
        </Dialog>
      )}

      {editor && (
        <Dialog
          label="ثبت شیفت"
          title={`ثبت شیفت · ${formatDate(editor.date)}`}
          description="شیفت‌های کاری، تعطیل شیفت و مرخصی را در همین پنجره ثبت کنید. انتخاب‌ها هنگام تغییر تب باقی می‌مانند. هر نفر در هر روز فقط یک وضعیت می‌تواند داشته باشد؛ برای تعطیل یا مرخصی شیفت‌لاگ ایجاد نمی‌شود."
          onClose={closeComposer}
          width={640}
          className={styles.composer}
        >
          <div className={`modal-body ${styles.modalBody}`}>
            <div className={styles.shiftPicker} role="radiogroup" aria-label="نوع شیفت">
              {SHIFT_KEYS.map((key) => (
                <button key={key} type="button" role="radio" aria-checked={editor.shiftType === key} data-shift={key} className={editor.shiftType === key ? styles.shiftChoiceActive : ""} onClick={() => changeEditorShift(key)}>
                  <i /><span><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>
                </button>
              ))}
            </div>

            <div className={`search ${styles.searchBox}`}><Icon name="search" /><input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی کارشناس..." aria-label="جستجوی کارشناس" /></div>

            <div className={styles.bulkToolbar}>
              <span>مرتب‌سازی: انتخاب‌شده و آزاد، سپس سایر شیفت‌ها، شب، تعطیل، مرخصی</span>
              <div className={styles.bulkActions}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={saving || unselectedCount === 0} onClick={() => changeBulk(true)}>انتخاب همه ({faNum(unselectedCount)})</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={saving || !availableAnalysts.some((person) => draftIds.includes(person.id))} onClick={() => changeBulk(false)}>لغو انتخاب‌های فهرست</button>
              </div>
              <small>فقط افراد آزادِ همین فهرست انتخاب می‌شوند؛ وضعیت بقیه تغییر نمی‌کند.</small>
            </div>
            <div className={styles.memberList}>
              {visibleAnalysts.length === 0 && <div className={styles.emptyPeople}>کارشناسی با این نام پیدا نشد.</div>}
              {visibleAnalysts.map((person) => {
                const checked = draftIds.includes(person.id);
                const currentShift = draftAssignment(draftByShift, person.id);
                return (
                  <label className={`${styles.memberRow} ${checked ? styles.memberRowChecked : ""}`} key={person.id} data-status={currentShift ?? "available"} data-bulk-eligible={selectableIds.has(person.id) ? "true" : "false"}>
                    <input className="cb" type="checkbox" checked={checked} onChange={() => toggleDraft(person.id)} />
                    <Who id={person.id} />
                    <span className={styles.memberTeam}>{person.team === "Design & Automation" ? "طراحی و خودکارسازی · شیفت لایه ۳" : shiftChecklistTeam(person)}</span>
                    {currentShift && <span className={styles.currentShift} data-shift={currentShift}>{SHIFT_META[currentShift].short}</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="modal-foot">
            <span className={`lead ${styles.selectedCount}`}>صبح: {faNum(draftByShift.morning.length)} · تا ۸: {faNum(draftByShift.evening.length)} · شب: {faNum(draftByShift.night.length)} · تعطیل: {faNum(draftByShift.off.length)} · مرخصی: {faNum(draftByShift.leave.length)}</span>
            <button className="btn btn-ghost" onClick={closeComposer}>انصراف</button>
            <button className="btn btn-primary" aria-busy={saving || undefined} disabled={saving} onClick={save}>ذخیره برنامه روز</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return <div className={styles.miniStat} data-tone={tone || "default"}><span>{label}</span><b>{faNum(value)}</b></div>;
}
