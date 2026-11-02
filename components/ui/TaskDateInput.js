"use client";

import { useI18n as useTaskI18n } from "@/components/I18nProvider";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { addDays, fromJalali, jalaliMonthLength, toJalali, weekdayIndex } from "@/lib/analytics/calendar";
import { tehranDate } from "@/lib/shifts";
import { parseTaskDate, taskDate } from "@/lib/task-date";

const MONTHS = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const WEEK_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const WEEK = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

function TaskCalendar({ value, min, onPick }) {
  const { t: __taskTr, locale } = useTaskI18n();
  const months = locale === "fa" ? MONTHS_FA : MONTHS;
  const week = locale === "fa" ? WEEK_FA : WEEK;
  const number = (n) => locale === "fa" ? new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(n) : String(n);
  const first = toJalali(value || min || tehranDate());
  const [view, setView] = useState({ jy: first.jy, jm: first.jm });
  const monthStart = fromJalali(view.jy, view.jm, 1);
  const step = (by) => setView((current) => {
    const month = current.jm + by;
    return month === 0 ? { jy: current.jy - 1, jm: 12 } : month === 13 ? { jy: current.jy + 1, jm: 1 } : { ...current, jm: month };
  });
  return <div className="task-calendar">
    <div className="task-calendar-head">
      <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={__taskTr("Previous month")} disabled={view.jy <= 1 && view.jm === 1} onClick={() => step(-1)}><Icon name="left" /></button>
      <strong>{months[view.jm - 1]} {number(view.jy)}</strong>
      <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label={__taskTr("Next month")} disabled={view.jy >= 3177 && view.jm === 12} onClick={() => step(1)}><Icon name="chev" /></button>
    </div>
    <div className="task-calendar-grid">
      {week.map((day) => <span key={day} className="task-calendar-weekday">{day}</span>)}
      {Array.from({ length: weekdayIndex(monthStart) }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: jalaliMonthLength(view.jy, view.jm) }, (_, index) => {
        const iso = addDays(monthStart, index);
        return <button key={iso} type="button" className="task-calendar-day" disabled={!!min && iso < min} aria-pressed={iso === value} aria-label={`${months[view.jm - 1]} ${number(index + 1)}, ${number(view.jy)}`} onClick={() => onPick(iso)}>{number(index + 1)}</button>;
      })}
    </div>
  </div>;
}

/** Controlled ISO value with a Solar Hijri text editor. */
export default function TaskDateInput({ id, value, min, onChange, onValidityChange, calendarLabel = "Choose a Solar Hijri date", commitOnBlur = false, ...props }) {
  const { openPopover } = useApp();
  const { locale, t: __taskTr } = useTaskI18n();
  const localizedCalendarLabel = __taskTr(calendarLabel);
  const [draft, setDraft] = useState(value ? taskDate(value, locale) : "");
  const [error, setError] = useState("");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) {
      setDraft(value ? taskDate(value, locale) : "");
      setError("");
      onValidityChange?.("");
    }
  // The callback is supplied by the parent and need not retrigger a value reset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale]);

  const validate = (text, commit) => {
    const result = parseTaskDate(text, min);
    setError(result.error ?? "");
    onValidityChange?.(result.error ?? "");
    if (result.iso !== null && commit) onChange(result.iso);
    return result;
  };
  return <div className="task-date-field">
    <div className="task-date-control">
    <input {...props} id={id} className="input" type="text" inputMode="numeric" dir="ltr" placeholder="1405/08/11" value={draft} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => { const text = event.target.value; setDraft(text); validate(text, !commitOnBlur); }}
      onBlur={() => { focused.current = false; const result = validate(draft, true); if (result.iso) setDraft(taskDate(result.iso, locale)); }} />
    <button type="button" className="btn btn-secondary icon-btn" aria-label={localizedCalendarLabel} aria-haspopup="dialog" onClick={(event) => openPopover(event.currentTarget, {
      label: localizedCalendarLabel, width: 320, render: (close) => <TaskCalendar value={value} min={min} onPick={(iso) => { setDraft(taskDate(iso, locale)); setError(""); onValidityChange?.(""); onChange(iso); close(); }} />,
    })}><Icon name="cal" /></button>
    </div>
    {error && <span className="field-error" id={`${id}-error`} role="alert">{__taskTr(error)}</span>}
  </div>;
}
