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
import { scheduleStats, tehranDate } from "@/lib/shifts";
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
  return PERSIAN_LONG.format(dateObj(iso));
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
  const [selectedShift, setSelectedShift] = useState("morning");
  const [editor, setEditor] = useState(null);
  const [draftIds, setDraftIds] = useState([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => calendarRange(monthStart), [monthStart]);
  const { data, loading, error, reload } = useFetch(`/api/shift/schedule?from=${range.start}&to=${range.end}`);
  const schedules = data?.schedules ?? [];
  const byDate = useMemo(() => groupByDate(schedules), [schedules]);
  const monthKey = jalaliMonthKey(monthStart);
  const monthSchedules = useMemo(() => schedules.filter((row) => jalaliMonthKey(row.date) === monthKey), [schedules, monthKey]);
  const stats = useMemo(() => selectedUser ? scheduleStats(monthSchedules.filter((row) => row.userId === selectedUser)) : ZERO_STATS, [monthSchedules, selectedUser]);
  const selectedRows = byDate[selectedDate] ?? [];
  const cells = useMemo(() => Array.from({ length: daysBetween(range.start, range.end) + 1 }, (_, i) => addDays(range.start, i)), [range.start, range.end]);
  const selectedPerson = analysts.find((a) => a.id === selectedUser);
  const visibleAnalysts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysts.filter((a) => !q || `${a.name} ${a.team}`.toLowerCase().includes(q));
  }, [analysts, query]);

  const openComposer = (date = selectedDate, shiftType = selectedShift) => {
    if (!manager) return;
    setSelectedDate(date);
    setSelectedShift(shiftType);
    setEditor({ date, shiftType });
    setDraftIds((byDate[date] ?? []).filter((row) => row.shiftType === shiftType).map((row) => row.userId));
    setQuery("");
  };

  const closeComposer = () => setEditor(null);

  const changeEditorShift = (shiftType) => {
    if (!editor) return;
    setEditor({ ...editor, shiftType });
    setSelectedShift(shiftType);
    setDraftIds((byDate[editor.date] ?? []).filter((row) => row.shiftType === shiftType).map((row) => row.userId));
  };

  const toggleDraft = (userId) => {
    setDraftIds((ids) => ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]);
  };

  const save = async () => {
    if (!editor || saving) return;
    setSaving(true);
    try {
      await api("/api/shift/schedule", { method: "PUT", body: { date: editor.date, shiftType: editor.shiftType, userIds: draftIds } });
      toast("برنامه شیفت ذخیره شد");
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
      <header className={styles.hero}>
        <div>
          <div className={styles.kicker}><span className={styles.kickerIcon}><Icon name="cal" /></span> برنامه‌ریزی شیفت SOC</div>
          <h1>مدیریت شیفت نیروها</h1>
          <p>چیدمان ماهانه، آمار هر کارشناس و مدیریت سریع شیفت‌ها در یک نمای واحد.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className="btn btn-secondary" href="/shift/changes"><Icon name="edit" /> تغییر شیفت</Link>
          {manager && <button className="btn btn-primary" onClick={() => openComposer()}><Icon name="plus" /> ثبت شیفت</button>}
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.calendarCard}>
          <div className={styles.calendarHeader}>
            <div className={styles.monthNav}>
              <button className={styles.iconBtn} aria-label="ماه قبل" onClick={() => changeMonth(-1)}><Icon name="chev" /></button>
              <button className={styles.todayBtn} onClick={goToday}>امروز</button>
              <button className={`${styles.iconBtn} ${styles.next}`} aria-label="ماه بعد" onClick={() => changeMonth(1)}><Icon name="chev" /></button>
            </div>

            <div className={styles.monthTitle}>
              <span>تقویم ماهانه</span>
              <h2>{PERSIAN_MONTH.format(dateObj(monthStart))}</h2>
            </div>

            <label className={styles.analystSelect}>
              <span>آمار کارشناس</span>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                {analysts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.statsStrip}>
            <Stat label="ساعت ماه" value={stats.hours} suffix=" ساعت" />
            <Stat label="کل شیفت" value={stats.total} />
            <Stat label="پنجشنبه" value={stats.thursdays} />
            <Stat label="جمعه" value={stats.fridays} />
            <Stat label="تا ۸ شب" value={stats.evening} tone="evening" />
            <Stat label="صبح" value={stats.morning} tone="morning" />
            <Stat label="شب" value={stats.night} tone="night" />
          </div>

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
                  onDoubleClick={() => openComposer(date, selectedShift)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDate(date);
                    }
                  }}
                  aria-label={formatDate(date)}
                >
                  <div className={styles.dayTop}>
                    <b>{faNum(parts.day)}</b>
                    {date === TODAY && <span>امروز</span>}
                  </div>

                  <div className={styles.shiftBands}>
                    {SHIFT_KEYS.map((shiftType) => {
                      const shiftRows = rows.filter((row) => row.shiftType === shiftType);
                      if (!shiftRows.length) return null;
                      return (
                        <div className={styles.shiftBand} data-shift={shiftType} key={shiftType}>
                          <i />
                          <span>{shiftRows.slice(0, 2).map((r) => r.name.split(" ")[0]).join("، ")}</span>
                          <small>{SHIFT_META[shiftType].short}{shiftRows.length > 2 ? ` +${faNum(shiftRows.length - 2)}` : ""}</small>
                        </div>
                      );
                    })}
                    {!rows.length && currentMonth && <span className={styles.emptyDay}>بدون شیفت</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.legend}>
            {SHIFT_KEYS.map((key) => <span key={key} data-shift={key}><i />{SHIFT_META[key].label}<small>{SHIFT_META[key].time}</small></span>)}
          </div>
        </section>

        <aside className={styles.detailsCard}>
          <div className={styles.detailsHead}>
            <div><span>روز انتخاب‌شده</span><h2>{formatDate(selectedDate)}</h2></div>
            {manager && <button className={styles.roundBtn} onClick={() => openComposer(selectedDate, selectedShift)} aria-label="ثبت شیفت"><Icon name="plus" /></button>}
          </div>

          <div className={styles.shiftList}>
            {SHIFT_KEYS.map((key) => {
              const rows = selectedRows.filter((row) => row.shiftType === key);
              return (
                <section className={`${styles.shiftPanel} ${selectedShift === key ? styles.shiftPanelActive : ""}`} data-shift={key} key={key}>
                  <button className={styles.shiftPanelHead} onClick={() => { setSelectedShift(key); if (manager) openComposer(selectedDate, key); }}>
                    <span className={styles.shiftMark}><i /></span>
                    <span className={styles.shiftInfo}><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>
                    <strong>{rows.length ? `${faNum(rows.length)} نفر` : "خالی"}</strong>
                  </button>
                  {rows.length > 0 && (
                    <div className={styles.peopleList}>
                      {rows.map((row) => (
                        <div className={styles.personRow} key={row.userId}>
                          <button className={styles.person} onClick={() => setSelectedUser(row.userId)}><Who id={row.userId} /></button>
                          {manager && <button className={styles.removeBtn} onClick={() => remove(row)} disabled={saving}>حذف</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className={styles.analystCard}>
            <span>خلاصه ماهانه</span>
            <b>{selectedPerson?.name || "کارشناس"}</b>
            <div><strong>{faNum(stats.total)}</strong><small>شیفت</small><strong>{faNum(stats.hours)}</strong><small>ساعت</small></div>
          </div>

          <div className={styles.tip}>یک کلیک روی روز، جزئیات را اینجا نمایش می‌دهد. دابل‌کلیک برای مدیر فرم ثبت همان روز را باز می‌کند.</div>
        </aside>
      </div>

      {editor && (
        <Dialog
          label="ثبت شیفت"
          title={`ثبت شیفت · ${formatDate(editor.date)}`}
          description="نیروهای این شیفت را انتخاب کنید. اگر فردی همان روز شیفت دیگری داشته باشد، به شیفت جدید منتقل می‌شود."
          onClose={closeComposer}
          width={680}
        >
          <div className={styles.modalBody} dir="rtl">
            <div className={styles.shiftPicker}>
              {SHIFT_KEYS.map((key) => (
                <button key={key} type="button" data-shift={key} className={editor.shiftType === key ? styles.shiftChoiceActive : ""} onClick={() => changeEditorShift(key)}>
                  <i /><span><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>
                </button>
              ))}
            </div>

            <div className={styles.searchBox}><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی کارشناس..." /></div>

            <div className={styles.memberList}>
              {visibleAnalysts.map((person) => {
                const checked = draftIds.includes(person.id);
                const current = (byDate[editor.date] ?? []).find((row) => row.userId === person.id);
                return (
                  <label className={`${styles.memberRow} ${checked ? styles.memberRowChecked : ""}`} key={person.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleDraft(person.id)} />
                    <Who id={person.id} />
                    <span className={styles.memberTeam}>{person.team}</span>
                    {current && <span className={styles.currentShift} data-shift={current.shiftType}>{SHIFT_META[current.shiftType].short}</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="modal-foot" dir="rtl">
            <span className={styles.selectedCount}>{faNum(draftIds.length)} نفر انتخاب شده</span>
            <button className="btn btn-ghost" onClick={closeComposer}>انصراف</button>
            <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "در حال ذخیره..." : "ذخیره برنامه"}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Stat({ label, value, suffix = "", tone }) {
  return <div className={styles.stat} data-tone={tone || "default"}><span>{label}</span><b>{faNum(value)}{suffix}</b></div>;
}
