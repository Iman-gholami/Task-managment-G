"use client";

import { useEffect, useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import { Avatar } from "@/components/ui/indicators";
import { TODAY, addDays } from "@/lib/format";
import styles from "./ShiftSchedule.module.css";

const SHIFT_KEYS = ["morning", "evening", "night"];
const SHIFT_META = {
  morning: { label: "شیفت صبح", short: "صبح", time: "۰۷:۰۰ – ۱۵:۰۰", icon: "☀" },
  evening: { label: "شیفت عصر", short: "عصر", time: "۱۵:۰۰ – ۲۳:۰۰", icon: "◐" },
  night: { label: "شیفت شب", short: "شب", time: "۲۳:۰۰ – ۰۷:۰۰", icon: "☾" },
};
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const PERSIAN_CAL = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});
const PERSIAN_MONTH = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const FA_NUM = new Intl.NumberFormat("fa-IR", { useGrouping: false });

const toEnglishDigits = (value) => String(value).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const faNum = (value) => FA_NUM.format(value);
const dateObj = (iso) => new Date(`${iso}T00:00:00Z`);

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
  if (amount > 0) return firstOfJalaliMonth(addDays(monthStart, 32));
  return firstOfJalaliMonth(addDays(monthStart, -1));
}

function calendarRange(monthStart) {
  const weekday = dateObj(monthStart).getUTCDay();
  const saturdayOffset = (weekday + 1) % 7;
  const start = addDays(monthStart, -saturdayOffset);
  return { start, end: addDays(start, 41) };
}

function assignmentMap(assignments) {
  const map = {};
  for (const row of assignments || []) {
    map[row.date] ??= { morning: [], evening: [], night: [] };
    map[row.date][row.shift].push(row.userId);
  }
  return map;
}

function formatLongDate(iso) {
  return PERSIAN_LONG.format(dateObj(iso));
}

export default function ShiftSchedule() {
  const { members, peopleMap, toast } = useApp();
  const [monthStart, setMonthStart] = useState(() => firstOfJalaliMonth(TODAY));
  const [focusDate, setFocusDate] = useState(TODAY);
  const [focusShift, setFocusShift] = useState("morning");
  const range = useMemo(() => calendarRange(monthStart), [monthStart]);
  const url = `/api/shift/schedule?from=${range.start}&to=${range.end}`;
  const { data, loading, error, reload, setData } = useFetch(url);
  const byDate = useMemo(() => assignmentMap(data?.assignments), [data?.assignments]);
  const analysts = useMemo(() => members.filter((m) => m.shift !== null), [members]);
  const [selected, setSelected] = useState(null);
  const [draftIds, setDraftIds] = useState([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const currentMonthKey = jalaliMonthKey(monthStart);
  const monthAssignments = useMemo(
    () => (data?.assignments || []).filter((a) => jalaliMonthKey(a.date) === currentMonthKey),
    [data?.assignments, currentMonthKey]
  );

  const openDay = (date, shift = focusShift) => {
    setFocusDate(date);
    setFocusShift(shift);
    setSelected({ date, shift });
    setDraftIds(byDate[date]?.[shift] || []);
    setQuery("");
  };

  const changeShift = (shift) => {
    if (!selected) return;
    setSelected({ ...selected, shift });
    setFocusShift(shift);
    setDraftIds(byDate[selected.date]?.[shift] || []);
    setQuery("");
  };

  const changeMonth = (amount) => {
    setSelected(null);
    const next = shiftJalaliMonth(monthStart, amount);
    setMonthStart(next);
    setFocusDate(next);
  };

  const goToday = () => {
    setSelected(null);
    setMonthStart(firstOfJalaliMonth(TODAY));
    setFocusDate(TODAY);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api("/api/shift/schedule", {
        method: "PUT",
        body: { date: selected.date, shift: selected.shift, userIds: draftIds },
      });
      setData((prev) => ({
        ...(prev || {}),
        assignments: [
          ...((prev?.assignments || []).filter((a) => a.date !== selected.date)),
          ...res.assignments,
        ],
      }));
      toast(`${SHIFT_META[selected.shift].label} برای ${formatLongDate(selected.date)} ثبت شد`);
      setFocusDate(selected.date);
      setFocusShift(selected.shift);
      setSelected(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(range.start, i)), [range.start]);
  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysts.filter((m) => !q || `${m.name} ${m.team}`.toLowerCase().includes(q));
  }, [analysts, query]);

  const focusShifts = byDate[focusDate] || { morning: [], evening: [], night: [] };
  const focusPeople = focusShifts[focusShift].map((id) => peopleMap[id]).filter(Boolean);
  const scheduledPeople = new Set(monthAssignments.map((a) => a.userId)).size;

  return (
    <div className={`${styles.page} page`} dir="rtl">
      <div className={styles.pageHead}>
        <div>
          <div className={styles.eyebrow}>برنامه‌ریزی نیروی انسانی</div>
          <h1>مدیریت شیفت نیروها</h1>
          <p>شیفت‌های ماهانه را سریع بچینید و پوشش هر روز را در یک نگاه ببینید.</p>
        </div>
        <div className={styles.headActions}>
          <span className={styles.monthStat}><b>{faNum(scheduledPeople)}</b> نیروی برنامه‌ریزی‌شده</span>
          <button className="btn btn-primary" onClick={() => openDay(focusDate, focusShift)}>＋ ثبت شیفت</button>
        </div>
      </div>

      <div className={styles.schedulerLayout}>
        <aside className={styles.sidePanel}>
          <section className={styles.sideCard}>
            <div className={styles.sideTitle}>تاریخ انتخاب‌شده</div>
            <button className={styles.selectedDate} onClick={() => openDay(focusDate, focusShift)}>
              <span>◫</span>
              <b>{formatLongDate(focusDate)}</b>
            </button>

            <div className={styles.sideTitle}>شیفت انتخاب‌شده</div>
            <div className={styles.selectedShift} data-tone={focusShift}>
              <span className={styles.shiftIcon}>{SHIFT_META[focusShift].icon}</span>
              <div><b>{SHIFT_META[focusShift].label}</b><small>{SHIFT_META[focusShift].time}</small></div>
            </div>

            <div className={styles.peopleTitle}>
              <b>نیروهای این شیفت</b>
              <span>{faNum(focusPeople.length)} نفر</span>
            </div>
            <div className={styles.selectedPeople}>
              {focusPeople.length ? focusPeople.map((person) => (
                <div className={styles.selectedPerson} key={person.id}>
                  <Avatar id={person.id} />
                  <span><b>{person.name}</b><small>{person.team}</small></span>
                </div>
              )) : <div className={styles.emptyPeople}>هنوز نیرویی برای این شیفت انتخاب نشده است.</div>}
            </div>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => openDay(focusDate, focusShift)}>ویرایش نیروها</button>
          </section>

          <section className={styles.daySummary}>
            <div className={styles.summaryHead}><b>شیفت‌های این روز</b><span>{faNum(SHIFT_KEYS.filter((k) => focusShifts[k].length).length)}</span></div>
            {SHIFT_KEYS.map((key) => {
              const ids = focusShifts[key];
              return (
                <button key={key} className={styles.dayShiftCard} data-tone={key} onClick={() => openDay(focusDate, key)}>
                  <span className={styles.dayShiftIcon}>{SHIFT_META[key].icon}</span>
                  <span className={styles.dayShiftText}><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>
                  <span className={styles.avatarStack}>
                    {ids.slice(0, 3).map((id) => <Avatar key={id} id={id} />)}
                  </span>
                  <span className={styles.countPill}>{faNum(ids.length)} نفر</span>
                </button>
              );
            })}
          </section>
        </aside>

        <section className={styles.calendarPanel}>
          <div className={styles.toolbar}>
            <div className={styles.monthControls}>
              <button className="btn btn-ghost icon-btn" aria-label="ماه قبل" onClick={() => changeMonth(-1)}>›</button>
              <button className="btn btn-ghost" onClick={goToday}>امروز</button>
              <button className="btn btn-ghost icon-btn" aria-label="ماه بعد" onClick={() => changeMonth(1)}>‹</button>
            </div>
            <h2>{PERSIAN_MONTH.format(dateObj(monthStart))}</h2>
            <div className={styles.legend}>
              {SHIFT_KEYS.map((key) => <span key={key} data-tone={key}><i />{SHIFT_META[key].short}</span>)}
            </div>
          </div>

          {error && (
            <div className={styles.errorBar}>
              <span>دریافت برنامه شیفت‌ها ناموفق بود.</span>
              <button className="btn btn-ghost btn-sm" onClick={reload}>تلاش دوباره</button>
            </div>
          )}

          <div className={styles.weekdays}>
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className={`${styles.calendar} ${loading && !data ? styles.loading : ""}`} aria-busy={loading}>
            {cells.map((date) => {
              const parts = jalaliParts(date);
              const current = jalaliMonthKey(date) === currentMonthKey;
              const shifts = byDate[date] || { morning: [], evening: [], night: [] };
              const assigned = SHIFT_KEYS.some((s) => shifts[s].length);
              const focused = date === focusDate;
              return (
                <button
                  type="button"
                  className={`${styles.day} ${!current ? styles.outside : ""} ${date === TODAY ? styles.today : ""} ${focused ? styles.focused : ""}`}
                  key={date}
                  onClick={() => openDay(date, "morning")}
                  aria-label={formatLongDate(date)}
                >
                  <span className={styles.dayNumber}>{faNum(parts.day)}</span>
                  <div className={styles.chips}>
                    {SHIFT_KEYS.map((key) => shifts[key].length > 0 && (
                      <span className={styles.shiftChip} data-tone={key} key={key} onClick={(e) => { e.stopPropagation(); openDay(date, key); }}>
                        <i />{SHIFT_META[key].short}<b>{faNum(shifts[key].length)}</b>
                      </span>
                    ))}
                  </div>
                  {!assigned && current && <span className={styles.addHint}>＋ افزودن شیفت</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {selected && (
        <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="shift-dialog-title" dir="rtl">
            <div className={styles.modalHead}>
              <div>
                <small>تعریف شیفت برای</small>
                <h2 id="shift-dialog-title">{formatLongDate(selected.date)}</h2>
              </div>
              <button className="btn btn-ghost icon-btn" aria-label="بستن" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className={styles.modalSectionTitle}>انتخاب شیفت</div>
            <div className={styles.shiftTabs}>
              {SHIFT_KEYS.map((key) => {
                const meta = SHIFT_META[key];
                return (
                  <button key={key} data-tone={key} className={selected.shift === key ? styles.activeTab : ""} onClick={() => changeShift(key)}>
                    <span>{meta.icon}</span>
                    <b>{meta.label}</b>
                    <small>{meta.time}</small>
                  </button>
                );
              })}
            </div>

            <div className={styles.peopleHead}>
              <div><b>انتخاب نیروها</b><small>{faNum(draftIds.length)} نفر انتخاب شده</small></div>
              <button className={styles.clear} disabled={!draftIds.length} onClick={() => setDraftIds([])}>پاک کردن انتخاب‌ها</button>
            </div>
            <div className={styles.searchWrap}>
              <span>⌕</span>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نام یا تیم..." aria-label="جستجوی نیرو" />
            </div>

            <div className={styles.peopleList}>
              {visibleMembers.length === 0 ? (
                <div className={styles.noPeople}>نیرویی با این مشخصات پیدا نشد.</div>
              ) : visibleMembers.map((member) => {
                const checked = draftIds.includes(member.id);
                const currentShift = SHIFT_KEYS.find((s) => byDate[selected.date]?.[s]?.includes(member.id));
                const moved = currentShift && currentShift !== selected.shift;
                return (
                  <label className={`${styles.person} ${checked ? styles.personSelected : ""}`} key={member.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setDraftIds((ids) => checked ? ids.filter((id) => id !== member.id) : [...ids, member.id])}
                    />
                    <Avatar id={member.id} />
                    <span className={styles.personMeta}>
                      <b>{member.name}</b>
                      <small>{member.team}</small>
                    </span>
                    {moved ? <span className={styles.moveTag}>انتقال از {SHIFT_META[currentShift].short}</span> : currentShift === selected.shift ? <span className={styles.currentTag}>ثبت شده</span> : null}
                  </label>
                );
              })}
            </div>

            <div className={styles.modalFoot}>
              <span>ثبت این لیست فقط نیروهای {SHIFT_META[selected.shift].label} در همین روز را به‌روزرسانی می‌کند.</span>
              <div>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>انصراف</button>
                <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "در حال ثبت..." : "ثبت شیفت"}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
