"use client";

import { useEffect, useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import { Avatar } from "@/components/ui/indicators";
import Icon from "@/components/ui/Icon";
import { TODAY, addDays } from "@/lib/format";
import styles from "./ShiftSchedule.module.css";

const SHIFT_KEYS = ["morning", "evening", "night"];
const SHIFT_META = {
  morning: { label: "شیفت صبح", short: "صبح", time: "۰۷:۰۰ تا ۱۵:۰۰", icon: "sun" },
  evening: { label: "شیفت عصر", short: "عصر", time: "۱۵:۰۰ تا ۲۳:۰۰", icon: "sunset" },
  night: { label: "شیفت شب", short: "شب", time: "۲۳:۰۰ تا ۰۷:۰۰", icon: "moon" },
};
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const PERSIAN_CAL = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
const PERSIAN_MONTH = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", timeZone: "UTC" });
const PERSIAN_LONG = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const FA_NUM = new Intl.NumberFormat("fa-IR", { useGrouping: false });

const toEnglishDigits = (value) => String(value).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const faNum = (value) => FA_NUM.format(value);
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
function ShiftGlyph({ shift, className }) {
  return <span className={className} data-tone={shift}><Icon name={SHIFT_META[shift].icon} /></span>;
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
  const monthAssignments = useMemo(() => (data?.assignments || []).filter((a) => jalaliMonthKey(a.date) === currentMonthKey), [data?.assignments, currentMonthKey]);

  const openComposer = (date, shift = "morning") => {
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
  };
  const changeMonth = (amount) => {
    const next = shiftJalaliMonth(monthStart, amount);
    setMonthStart(next);
    setFocusDate(next);
  };
  const goToday = () => {
    setMonthStart(firstOfJalaliMonth(TODAY));
    setFocusDate(TODAY);
  };
  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api("/api/shift/schedule", { method: "PUT", body: { date: selected.date, shift: selected.shift, userIds: draftIds } });
      setData((prev) => ({ ...(prev || {}), assignments: [...((prev?.assignments || []).filter((a) => a.date !== selected.date)), ...res.assignments] }));
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

  const cells = useMemo(() => Array.from({ length: daysBetween(range.start, range.end) + 1 }, (_, i) => addDays(range.start, i)), [range.start, range.end]);
  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysts.filter((m) => !q || `${m.name} ${m.team}`.toLowerCase().includes(q));
  }, [analysts, query]);

  const focusShifts = byDate[focusDate] || { morning: [], evening: [], night: [] };
  const focusPeople = focusShifts[focusShift].map((id) => peopleMap[id]).filter(Boolean);
  const scheduledPeople = new Set(monthAssignments.map((a) => a.userId)).size;

  return (
    <div className={`${styles.page} page`} dir="rtl">
      <header className={styles.topbar}>
        <div>
          <div className={styles.kicker}><Icon name="cal" /> برنامه‌ریزی شیفت</div>
          <h1>مدیریت شیفت نیروها</h1>
          <p>روز را انتخاب کنید، شیفت را مشخص کنید و نیروها را بچینید.</p>
        </div>
        <div className={styles.topActions}>
          <span className={styles.monthPeople}><Icon name="team" /><b>{faNum(scheduledPeople)}</b> نیروی برنامه‌ریزی‌شده</span>
          <button className="btn btn-primary" onClick={() => openComposer(focusDate, focusShift)}><Icon name="plus" /> ثبت شیفت</button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.details}>
          <div className={styles.detailsHead}>
            <div><span>روز انتخاب‌شده</span><h2>{formatLongDate(focusDate)}</h2></div>
            <button onClick={() => openComposer(focusDate, focusShift)} aria-label="ویرایش"><Icon name="edit" /></button>
          </div>

          <div className={styles.shiftList}>
            {SHIFT_KEYS.map((key) => {
              const ids = focusShifts[key];
              return (
                <button key={key} className={`${styles.detailShift} ${focusShift === key ? styles.detailShiftActive : ""}`} data-tone={key} onClick={() => { setFocusShift(key); openComposer(focusDate, key); }}>
                  <ShiftGlyph shift={key} className={styles.detailIcon} />
                  <span><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>
                  <em>{ids.length ? `${faNum(ids.length)} نفر` : "خالی"}</em>
                </button>
              );
            })}
          </div>

          <div className={styles.detailsDivider} />
          <div className={styles.peopleTitle}><span>نیروهای {SHIFT_META[focusShift].short}</span><button onClick={() => openComposer(focusDate, focusShift)}>مدیریت</button></div>
          <div className={styles.peopleMiniList}>
            {focusPeople.length ? focusPeople.slice(0, 6).map((person) => (
              <div key={person.id} className={styles.miniPerson}><Avatar id={person.id} /><span><b>{person.name}</b><small>{person.team}</small></span></div>
            )) : <div className={styles.emptyPeople}><Icon name="team" /><b>هنوز نیرویی ثبت نشده</b><small>برای این شیفت نیرو انتخاب کنید.</small></div>}
          </div>
        </aside>

        <section className={styles.calendarCard}>
          <div className={styles.calendarHeader}>
            <div className={styles.legend}>{SHIFT_KEYS.map((key) => <span key={key} data-tone={key}><i />{SHIFT_META[key].short}</span>)}</div>
            <div className={styles.monthHeading}><small>تقویم ماهانه</small><h2>{PERSIAN_MONTH.format(dateObj(monthStart))}</h2></div>
            <div className={styles.monthNav}>
              <button aria-label="ماه قبل" onClick={() => changeMonth(-1)}><Icon name="chev" /></button>
              <button className={styles.todayBtn} onClick={goToday}>امروز</button>
              <button className={styles.nextBtn} aria-label="ماه بعد" onClick={() => changeMonth(1)}><Icon name="chev" /></button>
            </div>
          </div>

          {error && <div className={styles.errorBar}><span><Icon name="alert" /> دریافت برنامه ناموفق بود.</span><button onClick={reload}>تلاش دوباره</button></div>}

          <div className={styles.weekdays}>{WEEKDAYS.map((day) => <div key={day}>{day}</div>)}</div>
          <div className={`${styles.grid} ${loading && !data ? styles.loading : ""}`}>
            {cells.map((date) => {
              const parts = jalaliParts(date);
              const current = jalaliMonthKey(date) === currentMonthKey;
              const shifts = byDate[date] || { morning: [], evening: [], night: [] };
              const assigned = SHIFT_KEYS.some((s) => shifts[s].length);
              const focused = date === focusDate;
              const friday = dateObj(date).getUTCDay() === 5;
              const preferred = SHIFT_KEYS.find((s) => shifts[s].length === 0) || "morning";
              return (
                <div className={`${styles.day} ${!current ? styles.outside : ""} ${focused ? styles.focused : ""} ${friday ? styles.friday : ""}`} key={date}>
                  <button className={styles.dayMain} type="button" onClick={() => openComposer(date, preferred)} aria-label={formatLongDate(date)}>
                    <span className={styles.dayTop}><b className={`${styles.dayNumber} ${date === TODAY ? styles.todayNumber : ""}`}>{faNum(parts.day)}</b>{date === TODAY && <small>امروز</small>}</span>
                    <span className={styles.normalContent}>
                      {assigned ? SHIFT_KEYS.map((key) => shifts[key].length > 0 && <span className={styles.simpleShift} data-tone={key} key={key}><i /><span>{SHIFT_META[key].short}</span><b>{faNum(shifts[key].length)}</b></span>) : <span className={styles.emptyHint}>برای این روز شیفتی ثبت نشده</span>}
                    </span>
                  </button>

                  {current && <div className={styles.hoverLayer}>
                    <div className={styles.hoverTitle}><span>برنامه این روز</span><small>برای ثبت کلیک کنید</small></div>
                    <div className={styles.hoverShifts}>
                      {SHIFT_KEYS.map((key) => (
                        <button key={key} data-tone={key} onClick={(e) => { e.stopPropagation(); openComposer(date, key); }}>
                          <ShiftGlyph shift={key} className={styles.hoverIcon} />
                          <span><b>{SHIFT_META[key].short}</b><small>{shifts[key].length ? `${faNum(shifts[key].length)} نیرو` : "خالی"}</small></span>
                          <Icon name="chev" />
                        </button>
                      ))}
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {selected && <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
        <section className={styles.composer} role="dialog" aria-modal="true" dir="rtl">
          <div className={styles.composerHead}>
            <div className={styles.composerCal}><Icon name="cal" /></div>
            <div><span>ثبت برنامه شیفت</span><h2>{formatLongDate(selected.date)}</h2></div>
            <button onClick={() => setSelected(null)} aria-label="بستن"><Icon name="x" /></button>
          </div>

          <div className={styles.composerBody}>
            <div className={styles.label}>نوع شیفت</div>
            <div className={styles.shiftPicker}>
              {SHIFT_KEYS.map((key) => <button key={key} data-tone={key} className={selected.shift === key ? styles.pickerActive : ""} onClick={() => changeShift(key)}>
                <ShiftGlyph shift={key} className={styles.pickerIcon} /><span><b>{SHIFT_META[key].label}</b><small>{SHIFT_META[key].time}</small></span>{selected.shift === key && <i><Icon name="check" /></i>}
              </button>)}
            </div>

            <div className={styles.peopleControl}><div className={styles.label}>انتخاب نیروها <span>{faNum(draftIds.length)} انتخاب</span></div><button disabled={!draftIds.length} onClick={() => setDraftIds([])}>پاک کردن</button></div>
            <label className={styles.search}><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نام یا تیم..." /></label>

            <div className={styles.peopleList}>
              {visibleMembers.length ? visibleMembers.map((member) => {
                const checked = draftIds.includes(member.id);
                const currentShift = SHIFT_KEYS.find((s) => byDate[selected.date]?.[s]?.includes(member.id));
                const moved = currentShift && currentShift !== selected.shift;
                return <label className={`${styles.personRow} ${checked ? styles.personSelected : ""}`} key={member.id}>
                  <input type="checkbox" checked={checked} onChange={() => setDraftIds((ids) => checked ? ids.filter((id) => id !== member.id) : [...ids, member.id])} />
                  <span className={styles.check}>{checked && <Icon name="check" />}</span><Avatar id={member.id} /><span className={styles.personMeta}><b>{member.name}</b><small>{member.team}</small></span>
                  {moved ? <em className={styles.moveTag}>از {SHIFT_META[currentShift].short} منتقل می‌شود</em> : currentShift === selected.shift ? <em className={styles.currentTag}>در همین شیفت</em> : null}
                </label>;
              }) : <div className={styles.noPeople}>نیرویی پیدا نشد.</div>}
            </div>
          </div>

          <div className={styles.composerFoot}>
            <span><b>{faNum(draftIds.length)} نفر</b> برای {SHIFT_META[selected.shift].label}</span>
            <div><button className="btn btn-ghost" onClick={() => setSelected(null)}>انصراف</button><button className="btn btn-primary" disabled={saving} onClick={save}><Icon name="check" /> {saving ? "در حال ثبت..." : "ثبت شیفت"}</button></div>
          </div>
        </section>
      </div>}
    </div>
  );
}
