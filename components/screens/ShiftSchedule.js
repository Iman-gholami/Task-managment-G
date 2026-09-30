"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { isManager, SOC_TEAMS } from "@/lib/roles";
import { addDays } from "@/lib/format";
import { SHIFT_TYPES, scheduleStats, tehranDate } from "@/lib/shifts";
import styles from "./ShiftSchedule.module.css";

const SHIFT_KEYS = ["morning", "evening", "night"];
const SHIFT_META = {
  morning: { label: "شیفت صبح", short: "صبح", time: "۰۷:۳۰ تا ۱۵:۱۵" },
  evening: { label: "شیفت تا ۸ شب", short: "تا ۸", time: "۰۷:۳۰ تا ۲۰:۰۰" },
  night: { label: "شیفت شب", short: "شب", time: "۲۰:۰۰ تا ۰۸:۰۰" },
};
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const TODAY = tehranDate();
const ZERO_STATS = { hours: 0, total: 0, thursdays: 0, fridays: 0, morning: 0, evening: 0, night: 0 };

const PERSIAN_CAL = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
const PERSIAN_MONTH = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", timeZone: "UTC" });
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const FA_NUM = new Intl.NumberFormat("fa-IR", { useGrouping: false });

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
  const { day } = jalaliParts(iso);
  return addDays(iso, -(day - 1));
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

function longDay(iso) {
  return PERSIAN_LONG.format(dateObj(iso));
}

function groupByDate(schedules) {
  const map = {};
  for (const row of schedules || []) (map[row.date] ??= []).push(row);
  for (const rows of Object.values(map)) rows.sort((a, b) => SHIFT_KEYS.indexOf(a.shiftType) - SHIFT_KEYS.indexOf(b.shiftType) || a.name.localeCompare(b.name));
  return map;
}

export default function ShiftSchedule() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(
    () => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)),
    [members]
  );

  const [monthStart, setMonthStart] = useState(() => firstOfJalaliMonth(TODAY));
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedUser, setSelectedUser] = useState(me.keepsShiftLog ? me.id : analysts[0]?.id ?? "");
  const [editorOpen, setEditorOpen] = useState(false);
  const [edit, setEdit] = useState({ date: TODAY, userId: analysts[0]?.id ?? "", shiftType: "morning" });
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => calendarRange(monthStart), [monthStart]);
  const { data, loading, error, reload } = useFetch(`/api/shift/schedule?from=${range.start}&to=${range.end}`);
  const schedules = data?.schedules ?? [];
  const byDate = useMemo(() => groupByDate(schedules), [schedules]);
  const monthKey = jalaliMonthKey(monthStart);
  const monthSchedules = useMemo(() => schedules.filter((row) => jalaliMonthKey(row.date) === monthKey), [schedules, monthKey]);
  const stats = useMemo(() => {
    if (!selectedUser) return ZERO_STATS;
    return scheduleStats(monthSchedules.filter((row) => row.userId === selectedUser));
  }, [monthSchedules, selectedUser]);
  const selectedRows = byDate[selectedDate] ?? [];
  const cells = useMemo(
    () => Array.from({ length: daysBetween(range.start, range.end) + 1 }, (_, i) => addDays(range.start, i)),
    [range]
  );

  const openAssign = (date = selectedDate, userId = selectedUser) => {
    if (!manager) return;
    const chosenUser = userId || analysts[0]?.id || "";
    const existing = (byDate[date] ?? []).find((r) => r.userId === chosenUser);
    setEdit({ date, userId: chosenUser, shiftType: existing?.shiftType || "morning" });
    setEditorOpen(true);
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

  const save = async () => {
    if (!edit.date || !edit.userId || saving) return;
    setSaving(true);
    try {
      await api("/api/shift/schedule", { method: "POST", body: edit });
      toast("شیفت ثبت شد");
      setSelectedDate(edit.date);
      setSelectedUser(edit.userId);
      setMonthStart(firstOfJalaliMonth(edit.date));
      setEditorOpen(false);
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

  const selectedPerson = analysts.find((a) => a.id === selectedUser);

  return (
    <div className={`page ${styles.page}`} dir="rtl">
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.kicker}><Icon name="cal" /> برنامه‌ریزی شیفت SOC</span>
          <h1>تقویم شیفت نیروها</h1>
          <p>برنامه ماهانه تیم را ببینید، روی هر روز کلیک کنید و شیفت‌ها را از همان تقویم مدیریت کنید.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className="btn btn-secondary" href="/shift/changes"><Icon name="edit" />تغییر شیفت</Link>
          {manager && <button className="btn btn-primary" onClick={() => openAssign()}><Icon name="plus" />ثبت شیفت</button>}
        </div>
      </header>

      <section className={styles.controlBar}>
        <div className={styles.monthControls}>
          <button className={styles.navButton} onClick={() => changeMonth(-1)} aria-label="ماه قبل"><Icon name="chev" /></button>
          <button className={styles.todayButton} onClick={goToday}>امروز</button>
          <button className={`${styles.navButton} ${styles.nextButton}`} onClick={() => changeMonth(1)} aria-label="ماه بعد"><Icon name="chev" /></button>
          <div className={styles.monthName}><small>تقویم ماهانه</small><b>{PERSIAN_MONTH.format(dateObj(monthStart))}</b></div>
        </div>

        <label className={styles.employeeFilter}>
          <span>آمار کارشناس</span>
          <select className="input" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
            {analysts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.team}</option>)}
          </select>
        </label>
      </section>

      <section className={styles.stats} aria-label="آمار ماهانه کارشناس">
        <Stat label="ساعت ماه" value={stats.hours} suffix=" ساعت" />
        <Stat label="کل شیفت" value={stats.total} />
        <Stat label="پنجشنبه" value={stats.thursdays} />
        <Stat label="جمعه" value={stats.fridays} />
        <Stat label="تا ۸ شب" value={stats.evening} />
        <Stat label="صبح" value={stats.morning} />
        <Stat label="شب" value={stats.night} />
      </section>

      <div className={styles.layout}>
        <aside className={styles.side} dir="rtl">
          <div className={styles.sideHead}>
            <div><span>روز انتخاب‌شده</span><h2>{longDay(selectedDate)}</h2></div>
            {manager && <button className={styles.addDayButton} onClick={() => openAssign()} aria-label="ثبت شیفت برای این روز"><Icon name="plus" /></button>}
          </div>

          <div className={styles.daySummary}>
            {SHIFT_KEYS.map((key) => {
              const rows = selectedRows.filter((r) => r.shiftType === key);
              return (
                <section className={styles.shiftGroup} data-shift={key} key={key}>
                  <div className={styles.shiftGroupHead}>
                    <div><i /><span><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span></div>
                    <strong>{faNum(rows.length)} نفر</strong>
                  </div>
                  <div className={styles.shiftPeople}>
                    {rows.length === 0 ? <span className={styles.emptyShift}>نیرویی ثبت نشده</span> : rows.map((row) => (
                      <div className={styles.sidePerson} key={row.userId}>
                        <button className={styles.personButton} onClick={() => setSelectedUser(row.userId)}><Who id={row.userId} /></button>
                        {manager && <button className={styles.removeButton} onClick={() => remove(row)} disabled={saving}>حذف</button>}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className={styles.sideNote}>
            <b>{selectedPerson?.name || "کارشناس"}</b>
            <span>در این ماه {faNum(stats.total)} شیفت و {faNum(stats.hours)} ساعت برنامه دارد.</span>
          </div>
        </aside>

        <section className={styles.calendar} dir="rtl">
          {error && <div className={styles.errorBar}><span>دریافت برنامه شیفت ناموفق بود.</span><button onClick={reload}>تلاش دوباره</button></div>}
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
                  className={`${styles.day} ${!currentMonth ? styles.outside : ""} ${date === selectedDate ? styles.selectedDay : ""} ${date === TODAY ? styles.today : ""} ${isFriday ? styles.friday : ""}`}
                  onClick={() => setSelectedDate(date)}
                  onDoubleClick={() => openAssign(date)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDate(date);
                    }
                  }}
                  aria-label={longDay(date)}
                >
                  <div className={styles.dayTop}>
                    <b>{faNum(parts.day)}</b>
                    {date === TODAY && <span>امروز</span>}
                  </div>
                  <div className={styles.dayItems}>
                    {rows.length === 0 ? <span className={styles.noSchedule}>—</span> : rows.slice(0, 5).map((row) => (
                      <button
                        type="button"
                        key={row.userId}
                        data-shift={row.shiftType}
                        className={styles.shiftPill}
                        onClick={(e) => { e.stopPropagation(); setSelectedDate(date); setSelectedUser(row.userId); }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        title={`${row.name} · ${SHIFT_META[row.shiftType].time}`}
                      >
                        <i />
                        <span>{row.name}</span>
                        <small>{SHIFT_META[row.shiftType].short}</small>
                      </button>
                    ))}
                    {rows.length > 5 && <span className={styles.more}>+{faNum(rows.length - 5)} نفر</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className={styles.legend}>
        {SHIFT_KEYS.map((key) => <span key={key} data-shift={key}><i />{SHIFT_META[key].label} · {SHIFT_META[key].time}</span>)}
      </div>

      {editorOpen && (
        <Dialog label="ثبت شیفت" onClose={() => setEditorOpen(false)} width={620}>
          <div className={styles.modal} dir="rtl">
            <div className={styles.modalHead}>
              <div><span>ثبت / ویرایش شیفت</span><h2>{longDay(edit.date)}</h2></div>
            </div>
            <div className={styles.modalBody}>
              <label className="field"><span>تاریخ</span><input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /><small className={styles.jalaliHint}>{edit.date ? longDay(edit.date) : ""}</small></label>
              <label className="field"><span>کارشناس</span><select className="input" value={edit.userId} onChange={(e) => setEdit({ ...edit, userId: e.target.value })}>{analysts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.team}</option>)}</select></label>
              <div className="field">
                <span>نوع شیفت</span>
                <div className={styles.shiftPicker}>
                  {SHIFT_KEYS.map((key) => (
                    <button type="button" key={key} data-shift={key} className={`${styles.shiftOption} ${edit.shiftType === key ? styles.shiftOptionActive : ""}`} onClick={() => setEdit({ ...edit, shiftType: key })}>
                      <i /><span><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.modalNote}>شیفت «تا ۸ شب» همه فعالیت‌های پایه Shift Log را دارد و سه فعالیت Daily Traffic Report، MISP/Bale و Upload Malicious IP/Domain نیز به آن اضافه می‌شود.</div>
            </div>
            <div className={styles.modalFoot}>
              <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>انصراف</button>
              <button className="btn btn-primary" disabled={saving || !edit.userId || !edit.date} onClick={save}>{saving ? "در حال ثبت…" : "ثبت شیفت"}</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Stat({ label, value, suffix = "" }) {
  return <div className={styles.stat}><span>{label}</span><b>{faNum(value)}{suffix}</b></div>;
}
