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
    () => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)),
    [members]
  );

  const [monthStart, setMonthStart] = useState(() => firstOfJalaliMonth(TODAY));
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedUser, setSelectedUser] = useState("");
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
  const stats = useMemo(
    () => scheduleStats(selectedUser ? monthSchedules.filter((row) => row.userId === selectedUser) : monthSchedules),
    [monthSchedules, selectedUser]
  );
  const selectedRows = byDate[selectedDate] ?? [];
  const selectedShiftRows = selectedRows.filter((row) => row.shiftType === selectedShift);
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
      <header className="page-head">
        <div className="page-head-main">
          <div>
            <h1>مدیریت شیفت نیروها</h1>
            <div className="page-meta">
              <span>{PERSIAN_MONTH.format(dateObj(monthStart))}</span>
              <span>{faNum(monthSchedules.length)} شیفت ثبت‌شده</span>
              <span>{faNum(analysts.length)} کارشناس</span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/shift/changes"><Icon name="swap" /> تغییر شیفت</Link>
          {manager && <button className="btn btn-primary" onClick={() => openComposer()}><Icon name="plus" /> ثبت شیفت</button>}
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={`panel ${styles.calendarCard}`} aria-label="تقویم ماهانه">
          <div className={styles.calendarHeader}>
            <h2 className={styles.monthTitle}>{PERSIAN_MONTH.format(dateObj(monthStart))}</h2>
            <div className={styles.monthNav}>
              <button className="btn btn-ghost icon-btn btn-sm" aria-label="ماه قبل" data-tooltip="ماه قبل" onClick={() => changeMonth(-1)}><Icon name="chev" /></button>
              <button className="btn btn-ghost btn-sm" onClick={goToday}>امروز</button>
              <button className="btn btn-ghost icon-btn btn-sm" aria-label="ماه بعد" data-tooltip="ماه بعد" onClick={() => changeMonth(1)}><Icon name="left" /></button>
            </div>

            <label className={styles.analystSelect}>
              <span>نمایش آمار</span>
              <select className={`input input-sm ${selectedUser ? "is-set" : ""}`} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
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
            {SHIFT_KEYS.map((key) => <span key={key} data-shift={key}><i />{SHIFT_META[key].label}<small>{SHIFT_META[key].time}</small></span>)}
            <span className={styles.legendHint}>{selectedUser ? "شیفت‌های کارشناس انتخاب‌شده پررنگ شده‌اند." : "برای برجسته کردن شیفت‌های یک نفر، از «نمایش آمار» کارشناس را انتخاب کنید."}</span>
          </div>
        </section>

        <aside className={`panel ${styles.detailsCard}`} aria-label="جزئیات روز">
          <div className={styles.detailsHead}>
            <div><span className="eyebrow">روز انتخاب‌شده</span><h2>{formatDate(selectedDate)}</h2></div>
            {manager && <button className="btn btn-secondary icon-btn" onClick={() => openComposer(selectedDate, selectedShift)} aria-label="ثبت شیفت" data-tooltip="ثبت شیفت برای این روز"><Icon name="plus" /></button>}
          </div>

          <div className={`seg ${styles.shiftTabs}`} role="tablist" aria-label="شیفت">
            {SHIFT_KEYS.map((key) => {
              const count = selectedRows.filter((row) => row.shiftType === key).length;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedShift === key}
                  key={key}
                  data-shift={key}
                  className={selectedShift === key ? "on" : ""}
                  onClick={() => setSelectedShift(key)}
                >
                  <i />
                  <span>{SHIFT_META[key].short}</span>
                  <span className="count">{faNum(count)}</span>
                </button>
              );
            })}
          </div>

          <section className={styles.selectedShiftBlock} data-shift={selectedShift}>
            <div className={styles.selectedShiftHead}>
              <i />
              <div><b>{SHIFT_META[selectedShift].label}</b><small><Icon name="clock" size="sm" />{SHIFT_META[selectedShift].time}</small></div>
              {manager && <button className="btn btn-ghost btn-sm" onClick={() => openComposer(selectedDate, selectedShift)}><Icon name="edit" /> ویرایش</button>}
            </div>

            <div className={styles.peopleList}>
              {selectedShiftRows.length === 0 ? (
                <div className={styles.emptyPeople}>
                  <span className={styles.emptyGlyph}><Icon name="user" /></span>
                  برای این شیفت نیرویی ثبت نشده است.
                </div>
              ) : selectedShiftRows.map((row) => (
                <div className={styles.personRow} key={row.userId} data-active={row.userId === selectedUser || undefined}>
                  <button className={styles.person} onClick={() => setSelectedUser(row.userId)} data-tooltip="نمایش آمار این کارشناس"><Who id={row.userId} /></button>
                  {manager && <button className="btn btn-ghost danger icon-btn btn-sm" aria-label="حذف از شیفت" data-tooltip="حذف از شیفت" onClick={() => remove(row)} disabled={saving}><Icon name="x" /></button>}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.analystCard}>
            <div className={styles.analystCardHead}>
              <span className="eyebrow">آمار ماهانه</span>
              <b>{selectedPerson?.name || "همه کارشناسان"}</b>
              {selectedUser && <button className="btn btn-ghost btn-sm" onClick={() => setSelectedUser("")}>همه</button>}
            </div>
            <div className={styles.analystPrimary}>
              <div><strong>{faNum(stats.hours)}</strong><span>ساعت</span></div>
              <div><strong>{faNum(stats.total)}</strong><span>شیفت</span></div>
            </div>
            <div className={styles.analystMiniGrid}>
              <MiniStat label="صبح" value={stats.morning} tone="morning" />
              <MiniStat label="تا ۸" value={stats.evening} tone="evening" />
              <MiniStat label="شب" value={stats.night} tone="night" />
              <MiniStat label="پنجشنبه" value={stats.thursdays} />
              <MiniStat label="جمعه" value={stats.fridays} />
            </div>
          </section>

          <p className={styles.tip}><Icon name="info" size="sm" />{manager ? "یک کلیک جزئیات روز را نشان می‌دهد؛ با دابل‌کلیک فرم ثبت شیفت همان روز باز می‌شود." : "برای دیدن نیروهای هر شیفت، روی روز موردنظر کلیک کنید."}</p>
        </aside>
      </div>

      {editor && (
        <Dialog
          label="ثبت شیفت"
          title={`ثبت شیفت · ${formatDate(editor.date)}`}
          description="نیروهای این شیفت را انتخاب کنید. اگر فردی همان روز شیفت دیگری داشته باشد، به شیفت جدید منتقل می‌شود."
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

            <div className={styles.memberList}>
              {visibleAnalysts.length === 0 && <div className={styles.emptyPeople}>کارشناسی با این نام پیدا نشد.</div>}
              {visibleAnalysts.map((person) => {
                const checked = draftIds.includes(person.id);
                const current = (byDate[editor.date] ?? []).find((row) => row.userId === person.id);
                return (
                  <label className={`${styles.memberRow} ${checked ? styles.memberRowChecked : ""}`} key={person.id}>
                    <input className="cb" type="checkbox" checked={checked} onChange={() => toggleDraft(person.id)} />
                    <Who id={person.id} />
                    <span className={styles.memberTeam}>{person.team}</span>
                    {current && <span className={styles.currentShift} data-shift={current.shiftType}>{SHIFT_META[current.shiftType].short}</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="modal-foot">
            <span className={`lead ${styles.selectedCount}`}><b>{faNum(draftIds.length)}</b> نفر انتخاب شده</span>
            <button className="btn btn-ghost" onClick={closeComposer}>انصراف</button>
            <button className="btn btn-primary" aria-busy={saving || undefined} disabled={saving} onClick={save}>ذخیره برنامه</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return <div className={styles.miniStat} data-tone={tone || "default"}><span>{label}</span><b>{faNum(value)}</b></div>;
}