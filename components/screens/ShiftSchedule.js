"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { Who } from "@/components/ui/indicators";
import { PageHeader, Panel } from "@/components/ui/layout";
import { isManager, SOC_TEAMS } from "@/lib/roles";
import { SHIFT_TYPES, tehranDate } from "@/lib/shifts";
import styles from "./ShiftSchedule.module.css";

const WEEK = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const ZERO_STATS = { hours: 0, total: 0, thursdays: 0, fridays: 0, morning: 0, evening: 0, night: 0 };
const TODAY = tehranDate();

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
  const leading = (first + 1) % 7;
  const count = Number(to.slice(-2));
  return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
}

function faDay(date) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function longDay(date) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export default function ShiftSchedule() {
  const { me, members, toast } = useApp();
  const manager = isManager(me);
  const analysts = useMemo(() => members.filter((m) => m.active !== false && m.role === "analyst" && SOC_TEAMS.includes(m.team)), [members]);
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedUser, setSelectedUser] = useState(me.keepsShiftLog ? me.id : analysts[0]?.id ?? "");
  const [editorOpen, setEditorOpen] = useState(false);
  const [edit, setEdit] = useState({ date: TODAY, userId: analysts[0]?.id ?? "", shiftType: "morning" });
  const [saving, setSaving] = useState(false);
  const { data, loading, error, reload } = useFetch(`/api/shift/schedule?month=${month}`);

  const schedules = data?.schedules ?? [];
  const title = monthTitle(month);
  const stats = data?.statsByUser?.[selectedUser] ?? ZERO_STATS;
  const days = data ? calendarDays(month, data.to) : [];
  const byDate = useMemo(() => {
    const map = {};
    for (const row of schedules) (map[row.date] ??= []).push(row);
    return map;
  }, [schedules]);
  const selectedRows = byDate[selectedDate] ?? [];

  const openAssign = (date = selectedDate, userId = selectedUser) => {
    if (!manager) return;
    const existing = (byDate[date] ?? []).find((r) => r.userId === userId);
    setEdit({ date, userId: userId || analysts[0]?.id || "", shiftType: existing?.shiftType || "morning" });
    setEditorOpen(true);
  };

  const changeMonth = (delta) => {
    const next = addMonth(month, delta);
    setMonth(next);
    setSelectedDate(`${next}-01`);
  };

  const goToday = () => {
    setMonth(TODAY.slice(0, 7));
    setSelectedDate(TODAY);
  };

  const save = async () => {
    if (!edit.date || !edit.userId || saving) return;
    setSaving(true);
    try {
      await api("/api/shift/schedule", { method: "POST", body: edit });
      toast("Shift assignment saved");
      setSelectedDate(edit.date);
      setSelectedUser(edit.userId);
      setEditorOpen(false);
      if (edit.date.slice(0, 7) !== month) setMonth(edit.date.slice(0, 7));
      else reload();
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
      toast("Shift assignment removed");
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`page ${styles.page}`}>
      <PageHeader
        title="Shift Schedule"
        meta={["SOC rota", "Tehran time", "single-click a day to inspect · double-click to assign"]}
        actions={<>
          <Link className="btn btn-secondary" href="/shift/changes"><Icon name="edit" />Shift changes</Link>
          {manager && <button className="btn btn-primary" onClick={() => openAssign()}><Icon name="plus" />Assign shift</button>}
        </>}
      />

      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <button className="btn btn-ghost icon-btn" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
          <button className="btn btn-ghost" onClick={goToday}>Today</button>
          <button className="btn btn-ghost icon-btn" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          <div className={styles.monthTitle}><b>{title.en}</b><small>{title.fa}</small></div>
        </div>
        <select className={`input ${styles.analystSelect}`} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} aria-label="Analyst statistics">
          {analysts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.team}</option>)}
        </select>
      </div>

      <div className={styles.stats}>
        <Stat label="Hours this month" value={stats.hours} suffix="h" />
        <Stat label="Total shifts" value={stats.total} />
        <Stat label="Thursdays" value={stats.thursdays} />
        <Stat label="Fridays" value={stats.fridays} />
        <Stat label="Until 20:00" value={stats.evening} />
        <Stat label="Morning / normal" value={stats.morning} />
        <Stat label="Night" value={stats.night} />
      </div>

      <div className={styles.layout}>
        <Panel className={styles.side}>
          <div className={styles.sideHead}>
            <div><small>Selected day</small><h2>{longDay(selectedDate)}</h2></div>
            {manager && <button className="btn btn-ghost icon-btn btn-sm" aria-label="Assign shift on selected day" onClick={() => openAssign()}><Icon name="plus" /></button>}
          </div>

          <div className={styles.dayList}>
            {selectedRows.length === 0 ? <div className={styles.dayEmpty}>No analysts are scheduled on this date.</div> : selectedRows.map((row) => {
              const info = SHIFT_TYPES[row.shiftType];
              return (
                <div className={styles.dayRow} key={row.userId}>
                  <div className={styles.dayPerson}>
                    <Who id={row.userId} />
                    <small>{info.label} · {info.start}–{info.end}</small>
                  </div>
                  {manager && <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => remove(row)}>Remove</button>}
                </div>
              );
            })}
          </div>

          <div className={styles.hint}>
            One click selects a day and shows its rota here. Managers can double-click any calendar day to open the assignment form immediately.
          </div>
        </Panel>

        <Panel className={styles.calendar}>
          {error && <div style={{ padding: 16, color: "var(--danger)" }}>Could not load the schedule. <button className="btn btn-ghost btn-sm" onClick={reload}>Retry</button></div>}
          <div className={styles.week}>{WEEK.map((d) => <div key={d}>{d}</div>)}</div>
          <div className={styles.grid} aria-busy={loading}>
            {days.map((date, i) => date ? (
              <div
                key={date}
                role="button"
                tabIndex={0}
                className={`${styles.day} ${date === selectedDate ? styles.daySelected : ""} ${date === TODAY ? styles.dayToday : ""}`}
                onClick={() => setSelectedDate(date)}
                onDoubleClick={() => openAssign(date)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDate(date);
                  }
                }}
                aria-label={`${longDay(date)}${manager ? ". Double-click to assign shift." : ""}`}
              >
                <span className={styles.dayNumber}><b>{Number(date.slice(-2))}</b><small>{faDay(date)}</small></span>
                <span className={styles.pills}>
                  {(byDate[date] ?? []).slice(0, 5).map((row) => {
                    const info = SHIFT_TYPES[row.shiftType];
                    return (
                      <button
                        type="button"
                        key={row.userId}
                        className={styles.pill}
                        data-shift={row.shiftType}
                        title={`${row.name} · ${info.start}–${info.end}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedDate(date); setSelectedUser(row.userId); }}
                      >
                        <span className={styles.dot} style={{ background: row.color }} />
                        <span>{row.name}</span>
                        <small>{info.shortLabel}</small>
                      </button>
                    );
                  })}
                  {(byDate[date] ?? []).length > 5 && <span className={styles.more}>+{(byDate[date] ?? []).length - 5} more</span>}
                </span>
              </div>
            ) : <div className={styles.dayBlank} key={`blank-${i}`} />)}
          </div>
        </Panel>
      </div>

      <div className={styles.legend}>
        <span><i data-shift="morning" />Morning 07:30–15:15</span>
        <span><i data-shift="evening" />Until 20:00 07:30–20:00</span>
        <span><i data-shift="night" />Night 20:00–08:00</span>
      </div>

      {editorOpen && (
        <Dialog label="Assign shift" title="Assign shift" description="One analyst can have only one shift per day." onClose={() => setEditorOpen(false)} width={620}>
          <div className="modal-body">
            <div className={styles.modalFields}>
              <label className="field"><span>Date</span><input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></label>
              <label className="field"><span>Analyst</span><select className="input" value={edit.userId} onChange={(e) => setEdit({ ...edit, userId: e.target.value })}>{analysts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.team}</option>)}</select></label>
              <div className="field">
                <span>Shift</span>
                <div className={styles.shiftPicker}>
                  {Object.values(SHIFT_TYPES).map((s) => (
                    <button type="button" key={s.key} data-shift={s.key} className={`${styles.shiftOption} ${edit.shiftType === s.key ? styles.shiftOptionActive : ""}`} onClick={() => setEdit({ ...edit, shiftType: s.key })}>
                      <b>{s.label}</b><small>{s.start}–{s.end} · {s.hours}h</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.modalNote}>The 07:30–20:00 shift receives all routine Shift Log tasks. Morning and Night omit the three extended-shift-only tasks.</div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !edit.userId || !edit.date} onClick={save}>{saving ? "Saving…" : "Save assignment"}</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Stat({ label, value, suffix = "" }) {
  return <div className={styles.stat}><span>{label}</span><b className="num">{value}{suffix}</b></div>;
}
