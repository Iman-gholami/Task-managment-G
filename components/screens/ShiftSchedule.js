"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Icon from "@/components/ui/Icon";
import { EmptyState, Who } from "@/components/ui/indicators";
import { isManager } from "@/lib/roles";
import { SHIFT_TYPES } from "@/lib/shifts";
import { TODAY } from "@/lib/format";

const WEEK = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const ZERO_STATS = { hours: 0, total: 0, thursdays: 0, fridays: 0, morning: 0, evening: 0, night: 0 };

function addMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const en = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const fa = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return { en, fa };
}

function calendarDays(month, to) {
  const first = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const leading = (first + 1) % 7; // Saturday-first calendar.
  const count = Number(to.slice(-2));
  return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
}

function faDay(date) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function ShiftSchedule() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(() => members.filter((m) => m.role === "analyst" && m.team.startsWith("SOC · L")), [members]);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [selectedUser, setSelectedUser] = useState(me.keepsShiftLog ? me.id : analysts[0]?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [edit, setEdit] = useState({ userId: analysts[0]?.id ?? "", shiftType: "morning" });
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useFetch(`/api/shifts?month=${month}`);
  const title = monthTitle(month);
  const schedules = data?.schedules ?? [];
  const stats = data?.statsByUser?.[selectedUser] ?? ZERO_STATS;
  const days = data ? calendarDays(month, data.to) : [];
  const byDate = useMemo(() => {
    const map = {};
    for (const row of schedules) (map[row.date] ??= []).push(row);
    return map;
  }, [schedules]);
  const selectedRows = byDate[selectedDate] ?? [];

  const save = async () => {
    if (!selectedDate || !edit.userId) return;
    setSaving(true);
    try {
      await api("/api/shifts", { method: "POST", body: { date: selectedDate, userId: edit.userId, shiftType: edit.shiftType } });
      toast("Shift assignment saved");
      reload();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    setSaving(true);
    try {
      await api("/api/shifts", { method: "DELETE", body: { date: row.date, userId: row.userId } });
      toast("Shift assignment removed");
      reload();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) {
    return <div className="page"><EmptyState danger icon={<Icon name="alert" />} title="Could not load shift schedule" action={<button className="btn btn-secondary" onClick={reload}>Retry</button>}>{error}</EmptyState></div>;
  }

  return (
    <div className="page shift-schedule-page">
      <div className="page-head shift-schedule-head">
        <div>
          <h1>Shift Schedule</h1>
          <p>SOC rota · Tehran time · analysts can view the full team calendar</p>
        </div>
        <div className="actions">
          <Link className="btn btn-secondary" href="/shifts/changes"><Icon name="edit" />Shift changes</Link>
          {manager && <button className="btn btn-primary" onClick={() => setSelectedDate(selectedDate || TODAY)}><Icon name="plus" />Assign shift</button>}
        </div>
      </div>

      <div className="shift-toolbar">
        <div className="shift-month-nav">
          <button className="btn btn-ghost icon-btn" onClick={() => setMonth(addMonth(month, -1))} aria-label="Previous month">‹</button>
          <button className="btn btn-ghost" onClick={() => setMonth(TODAY.slice(0, 7))}>Today</button>
          <button className="btn btn-ghost icon-btn" onClick={() => setMonth(addMonth(month, 1))} aria-label="Next month">›</button>
          <div className="shift-month-title"><b>{title.en}</b><small>{title.fa}</small></div>
        </div>
        <select className="input shift-analyst-filter" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} aria-label="Analyst statistics">
          {analysts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="shift-stat-grid">
        <Stat label="Hours this month" value={stats.hours} suffix="h" />
        <Stat label="Total shifts" value={stats.total} />
        <Stat label="Thursdays" value={stats.thursdays} />
        <Stat label="Fridays" value={stats.fridays} />
        <Stat label="Until 20:00" value={stats.evening} />
        <Stat label="Morning" value={stats.morning} />
        <Stat label="Night" value={stats.night} />
      </div>

      <div className={`shift-schedule-layout ${manager ? "with-editor" : ""}`}>
        <section className="shift-calendar card">
          <div className="shift-calendar-week">{WEEK.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="shift-calendar-grid" aria-busy={loading}>
            {days.map((date, i) => date ? (
              <button key={date} type="button" className={`shift-day ${date === selectedDate ? "selected" : ""} ${date === TODAY ? "today" : ""}`} onClick={() => setSelectedDate(date)}>
                <span className="shift-day-number"><b>{Number(date.slice(-2))}</b><small>{faDay(date)}</small></span>
                <span className="shift-day-items">
                  {(byDate[date] ?? []).map((row) => {
                    const info = SHIFT_TYPES[row.shiftType];
                    return <span key={row.userId} className={`shift-pill ${info.className}`} title={`${row.name} · ${info.start}–${info.end}`}><span className="shift-person-dot" style={{ background: row.color }} />{row.name}<small>{info.shortLabel}</small></span>;
                  })}
                </span>
              </button>
            ) : <div className="shift-day blank" key={`blank-${i}`} />)}
          </div>
        </section>

        {manager && (
          <aside className="shift-editor card">
            <div className="section-head"><h2>Assign shift</h2><span className="badge num">{selectedDate}</span></div>
            <label className="field"><span>Date</span><input className="input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></label>
            <label className="field"><span>Analyst</span><select className="input" value={edit.userId} onChange={(e) => setEdit({ ...edit, userId: e.target.value })}>{analysts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.team}</option>)}</select></label>
            <div className="field"><span>Shift</span><div className="shift-type-picker">{Object.values(SHIFT_TYPES).map((s) => <button type="button" key={s.key} className={`shift-type-option ${s.className} ${edit.shiftType === s.key ? "active" : ""}`} onClick={() => setEdit({ ...edit, shiftType: s.key })}><b>{s.label}</b><small>{s.start}–{s.end} · {s.hours}h</small></button>)}</div></div>
            <button className="btn btn-primary" disabled={saving || !edit.userId} onClick={save}>Save assignment</button>

            <div className="shift-selected-list">
              <div className="section-head"><h2>Selected day</h2><span className="meta num">{selectedRows.length}</span></div>
              {selectedRows.length === 0 ? <p className="muted">No analysts scheduled on this date.</p> : selectedRows.map((row) => <div className="shift-selected-row" key={row.userId}><div><Who id={row.userId} /><small>{SHIFT_TYPES[row.shiftType].label} · {SHIFT_TYPES[row.shiftType].start}–{SHIFT_TYPES[row.shiftType].end}</small></div><button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => remove(row)}>Remove</button></div>)}
            </div>
          </aside>
        )}
      </div>

      <div className="shift-legend"><span><i className="morning" />Morning 07:30–15:15</span><span><i className="evening" />Until 20:00 07:30–20:00</span><span><i className="night" />Night 20:00–08:00</span></div>
    </div>
  );
}

function Stat({ label, value, suffix = "" }) {
  return <div className="shift-stat card"><span>{label}</span><b className="num">{value}{suffix}</b></div>;
}
