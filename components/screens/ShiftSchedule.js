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
  if (amount > 0) return firstOfJalaliMonth(addDays(monthStart, 32));
  return firstOfJalaliMonth(addDays(monthStart, -1));
}

function calendarRange(monthStart) {
  const firstWeekday = dateObj(monthStart).getUTCDay();
  const daysFromSaturday = (firstWeekday + 1) % 7;
  const start = addDays(monthStart, -daysFromSaturday);
  const nextMonth = shiftJalaliMonth(monthStart, 1);
  const lastDay = addDays(nextMonth, -1);
  const lastWeekday = dateObj(lastDay).getUTCDay();
  const daysToFriday = (5 - lastWeekday + 7) % 7;
  return { start, end: addDays(lastDay, daysToFriday) };
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
  const monthAssignments = useMemo(
    () => (data?.assignments || []).filter((a) => jalaliMonthKey(a.date) === currentMonthKey),
    [data?.assignments, currentMonthKey]
  );

  const openComposer = (date, shift = focusShift) => {
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

  const cells = useMemo(
    () => Array.from({ length: daysBetween(range.start, range.end) + 1 }, (_, i) => addDays(range.start, i)),
    [range.start, range.end]
  );

  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analysts.filter((m) => !q || `${m.name} ${m.team}`.toLowerCase().includes(q));
  }, [analysts, query]);

  const focusShifts = byDate[focusDate] || { morning: [], evening: [], night: [] };
  const focusPeople = focusShifts[focusShift].map((id) => peopleMap[id]).filter(Boolean);
  const scheduledPeople = new Set(monthAssignments.map((a) => a.userId)).size;
  const monthDaysCovered = new Set(monthAssignments.map((a) => a.date)).size;

  return (
    <div className={`${styles.page} page`} dir="rtl">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}><Icon name="cal" /> برنامه‌ریزی شیفت</div>
          <h1>مدیریت شیفت نیروها</h1>
          <p>پوشش شیفت‌های تیم را برای کل ماه برنامه‌ریزی کنید و وضعیت هر روز را در یک نگاه ببینید.</p>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.heroMetric}>
            <span><Icon name="team" /></span>
            <div><b>{faNum(scheduledPeople)}</b><small>نیروی برنامه‌ریزی‌شده</small></div>
          </div>
          <div className={styles.heroMetric}>
            <span><Icon name="cal" /></span>
            <div><b>{faNum(monthDaysCovered)}</b><small>روز دارای برنامه</small></div>
          </div>
          <button className="btn btn-primary" onClick={() => openComposer(focusDate, focusShift)}>
            <Icon name="plus" /> ثبت شیفت
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.inspector}>
          <div className={styles.inspectorHead}>
            <div>
              <span>روز انتخاب‌شده</span>
              <h2>{formatLongDate(focusDate)}</h2>
            </div>
            <button className={styles.editDate} onClick={() => openComposer(focusDate, focusShift)} aria-label="ویرایش شیفت روز انتخاب‌شده">
              <Icon name="edit" />
            </button>
          </div>

          <div className={styles.sectionLabel}>شیفت‌های این روز</div>
          <div className={styles.shiftRows}>
            {SHIFT_KEYS.map((key) => {
              const ids = focusShifts[key];
              const active = focusShift === key;
              return (
                <button
                  key={key}
                  className={`${styles.shiftRow} ${active ? styles.shiftRowActive : ""}`}
                  data-tone={key}
                  onClick={() => {
                    setFocusShift(key);
                    openComposer(focusDate, key);
                  }}
                >
                  <ShiftGlyph shift={key} className={styles.shiftRowIcon} />
                  <span className={styles.shiftRowText}>
                    <b>{SHIFT_META[key].label}</b>
                    <small>{SHIFT_META[key].time}</small>
                  </span>
                  <span className={styles.shiftRowEnd}>
                    <span className={styles.miniAvatars}>
                      {ids.slice(0, 3).map((id) => <Avatar key={id} id={id} />)}
                    </span>
                    <em>{faNum(ids.length)}</em>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.inspectorDivider} />
          <div className={styles.peopleHeader}>
            <div>
              <span>نیروهای {SHIFT_META[focusShift].short}</span>
              <small>{faNum(focusPeople.length)} نفر</small>
            </div>
            <button onClick={() => openComposer(focusDate, focusShift)}>مدیریت</button>
          </div>

          <div className={styles.peoplePreview}>
            {focusPeople.length ? focusPeople.slice(0, 5).map((person) => (
              <div className={styles.personPreview} key={person.id}>
                <Avatar id={person.id} />
                <span><b>{person.name}</b><small>{person.team}</small></span>
              </div>
            )) : (
              <div className={styles.emptyPreview}>
                <span><Icon name="team" /></span>
                <b>هنوز نیرویی ثبت نشده</b>
                <small>برای این شیفت نیرو انتخاب کنید.</small>
              </div>
            )}
            {focusPeople.length > 5 && <div className={styles.morePeople}>+ {faNum(focusPeople.length - 5)} نفر دیگر</div>}
          </div>

          <button className={`${styles.inspectorCta} btn btn-secondary`} onClick={() => openComposer(focusDate, focusShift)}>
            <Icon name="edit" /> ویرایش برنامه این روز
          </button>
        </aside>

        <section className={styles.calendarCard}>
          <div className={styles.calendarToolbar}>
            <div className={styles.legend} aria-label="راهنمای رنگ شیفت‌ها">
              {SHIFT_KEYS.map((key) => (
                <span key={key} data-tone={key}><i />{SHIFT_META[key].short}</span>
              ))}
            </div>

            <div className={styles.monthTitle}>
              <small>تقویم ماهانه</small>
              <h2>{PERSIAN_MONTH.format(dateObj(monthStart))}</h2>
            </div>

            <div className={styles.monthNav}>
              <button className={styles.navButton} aria-label="ماه قبل" onClick={() => changeMonth(-1)}><Icon name="chev" /></button>
              <button className={styles.todayButton} onClick={goToday}>امروز</button>
              <button className={`${styles.navButton} ${styles.navNext}`} aria-label="ماه بعد" onClick={() => changeMonth(1)}><Icon name="chev" /></button>
            </div>
          </div>

          {error && (
            <div className={styles.errorBar}>
              <span><Icon name="alert" /> دریافت برنامه شیفت‌ها ناموفق بود.</span>
              <button onClick={reload}>تلاش دوباره</button>
            </div>
          )}

          <div className={styles.weekdays}>
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>

          <div className={`${styles.calendarGrid} ${loading && !data ? styles.loading : ""}`} aria-busy={loading}>
            {cells.map((date) => {
              const parts = jalaliParts(date);
              const current = jalaliMonthKey(date) === currentMonthKey;
              const shifts = byDate[date] || { morning: [], evening: [], night: [] };
              const assigned = SHIFT_KEYS.some((s) => shifts[s].length);
              const focused = date === focusDate;
              const weekend = dateObj(date).getUTCDay() === 5;
              return (
                <button
                  type="button"
                  className={`${styles.day} ${!current ? styles.outside : ""} ${date === TODAY ? styles.today : ""} ${focused ? styles.focused : ""} ${weekend ? styles.weekend : ""}`}
                  key={date}
                  onClick={() => openComposer(date, shifts.morning.length ? "morning" : shifts.evening.length ? "evening" : shifts.night.length ? "night" : "morning")}
                  aria-label={formatLongDate(date)}
                >
                  <span className={styles.dayTop}>
                    <b className={styles.dayNumber}>{faNum(parts.day)}</b>
                    {date === TODAY && <small>امروز</small>}
                  </span>

                  <span className={styles.dayShifts}>
                    {SHIFT_KEYS.map((key) => shifts[key].length > 0 && (
                      <span className={styles.shiftPill} data-tone={key} key={key}>
                        <i />
                        <span>{SHIFT_META[key].short}</span>
                        <b>{faNum(shifts[key].length)}</b>
                      </span>
                    ))}
                  </span>

                  {!assigned && current && (
                    <span className={styles.emptyDay}><Icon name="plus" /> افزودن شیفت</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {selected && (
        <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <section className={styles.composer} role="dialog" aria-modal="true" aria-labelledby="shift-dialog-title" dir="rtl">
            <div className={styles.composerHead}>
              <div className={styles.composerDateIcon}><Icon name="cal" /></div>
              <div className={styles.composerTitle}>
                <span>برنامه‌ریزی شیفت</span>
                <h2 id="shift-dialog-title">{formatLongDate(selected.date)}</h2>
              </div>
              <button className={styles.closeButton} aria-label="بستن" onClick={() => setSelected(null)}><Icon name="x" /></button>
            </div>

            <div className={styles.composerBody}>
              <div className={styles.fieldLabel}>نوع شیفت</div>
              <div className={styles.shiftSelector}>
                {SHIFT_KEYS.map((key) => {
                  const meta = SHIFT_META[key];
                  const active = selected.shift === key;
                  return (
                    <button key={key} data-tone={key} className={active ? styles.shiftOptionActive : ""} onClick={() => changeShift(key)}>
                      <ShiftGlyph shift={key} className={styles.shiftOptionIcon} />
                      <span><b>{meta.label}</b><small>{meta.time}</small></span>
                      {active && <i className={styles.optionCheck}><Icon name="check" /></i>}
                    </button>
                  );
                })}
              </div>

              <div className={styles.peopleControlHead}>
                <div className={styles.fieldLabel}>انتخاب نیروها <span>{faNum(draftIds.length)} انتخاب</span></div>
                <button disabled={!draftIds.length} onClick={() => setDraftIds([])}>پاک کردن</button>
              </div>

              <label className={styles.searchBox}>
                <Icon name="search" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نام یا تیم..." aria-label="جستجوی نیرو" />
              </label>

              <div className={styles.peopleList}>
                {visibleMembers.length === 0 ? (
                  <div className={styles.noPeople}>نیرویی با این مشخصات پیدا نشد.</div>
                ) : visibleMembers.map((member) => {
                  const checked = draftIds.includes(member.id);
                  const currentShift = SHIFT_KEYS.find((s) => byDate[selected.date]?.[s]?.includes(member.id));
                  const moved = currentShift && currentShift !== selected.shift;
                  return (
                    <label className={`${styles.personRow} ${checked ? styles.personRowSelected : ""}`} key={member.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setDraftIds((ids) => checked ? ids.filter((id) => id !== member.id) : [...ids, member.id])}
                      />
                      <span className={styles.customCheck}>{checked && <Icon name="check" />}</span>
                      <Avatar id={member.id} />
                      <span className={styles.personMeta}>
                        <b>{member.name}</b>
                        <small>{member.team}</small>
                      </span>
                      {moved ? <em className={styles.moveTag}>از {SHIFT_META[currentShift].short} منتقل می‌شود</em> : currentShift === selected.shift ? <em className={styles.currentTag}>در همین شیفت</em> : null}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className={styles.composerFoot}>
              <div className={styles.selectionSummary}>
                <span className={styles.selectionAvatars}>{draftIds.slice(0, 4).map((id) => <Avatar key={id} id={id} />)}</span>
                <span><b>{faNum(draftIds.length)} نفر</b><small>برای {SHIFT_META[selected.shift].label}</small></span>
              </div>
              <div className={styles.composerActions}>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>انصراف</button>
                <button className="btn btn-primary" disabled={saving} onClick={save}>
                  <Icon name="check" /> {saving ? "در حال ثبت..." : "ثبت برنامه"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
