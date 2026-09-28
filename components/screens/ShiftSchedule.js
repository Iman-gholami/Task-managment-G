"use client";

import { useEffect, useMemo, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import { Avatar } from "@/components/ui/indicators";
import { TODAY, addDays, longDate, weekday } from "@/lib/format";
import styles from "./ShiftSchedule.module.css";

const SHIFT_KEYS = ["morning", "evening", "night"];
const SHIFT_META = {
  morning: { label: "Morning", time: "07:00–15:00", icon: "☀", tone: "morning" },
  evening: { label: "Evening", time: "15:00–23:00", icon: "◒", tone: "evening" },
  night: { label: "Night", time: "23:00–07:00", icon: "☾", tone: "night" },
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const iso = (d) => d.toISOString().slice(0, 10);
const firstOfMonth = (date) => `${date.slice(0, 7)}-01`;
const monthKey = (date) => date.slice(0, 7);

function shiftMonth(date, amount) {
  const [y, m] = date.split("-").map(Number);
  return iso(new Date(Date.UTC(y, m - 1 + amount, 1)));
}

function calendarRange(month) {
  const first = new Date(`${firstOfMonth(month)}T00:00:00Z`);
  const start = addDays(iso(first), -first.getUTCDay());
  return { start, end: addDays(start, 41) };
}

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function assignmentMap(assignments) {
  const map = {};
  for (const row of assignments || []) {
    map[row.date] ??= { morning: [], evening: [], night: [] };
    map[row.date][row.shift].push(row.userId);
  }
  return map;
}

export default function ShiftSchedule() {
  const { members, peopleMap, toast } = useApp();
  const [month, setMonth] = useState(firstOfMonth(TODAY));
  const range = useMemo(() => calendarRange(month), [month]);
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

  const monthAssignments = useMemo(
    () => (data?.assignments || []).filter((a) => monthKey(a.date) === monthKey(month)),
    [data?.assignments, month]
  );
  const totals = useMemo(
    () => Object.fromEntries(SHIFT_KEYS.map((s) => [s, monthAssignments.filter((a) => a.shift === s).length])),
    [monthAssignments]
  );

  const openDay = (date, shift = "morning") => {
    setSelected({ date, shift });
    setDraftIds(byDate[date]?.[shift] || []);
    setQuery("");
  };

  const changeShift = (shift) => {
    if (!selected) return;
    setSelected({ ...selected, shift });
    setDraftIds(byDate[selected.date]?.[shift] || []);
    setQuery("");
  };

  const changeMonth = (amount) => {
    setSelected(null);
    setMonth((m) => shiftMonth(m, amount));
  };

  const goToday = () => {
    setSelected(null);
    setMonth(firstOfMonth(TODAY));
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
      toast(`${SHIFT_META[selected.shift].label} shift updated for ${longDate(selected.date)}`);
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

  return (
    <div className="page" style={{ maxWidth: 1220 }}>
      <div className="page-head" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>Shift Schedule</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Plan morning, evening and night coverage for SOC analysts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openDay(TODAY)}>Assign today</button>
      </div>

      <div className={styles.summary}>
        {SHIFT_KEYS.map((key) => {
          const meta = SHIFT_META[key];
          return (
            <div className={styles.summaryCard} key={key} data-tone={meta.tone}>
              <span className={styles.summaryIcon}>{meta.icon}</span>
              <div><small>{meta.label} assignments</small><b className="num">{totals[key]}</b></div>
            </div>
          );
        })}
        <div className={styles.summaryCard}>
          <span className={styles.summaryIcon}>◎</span>
          <div><small>Scheduled analysts</small><b className="num">{new Set(monthAssignments.map((a) => a.userId)).size}</b></div>
        </div>
      </div>

      <section className={styles.calendarPanel}>
        <div className={styles.toolbar}>
          <div className={styles.navButtons}>
            <button className="btn btn-ghost icon-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
            <button className="btn btn-ghost" onClick={goToday}>Today</button>
            <button className="btn btn-ghost icon-btn" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
          </div>
          <h2>{monthLabel(month)}</h2>
          <div className={styles.legend} aria-label="Shift colors">
            {SHIFT_KEYS.map((key) => <span key={key} data-tone={key}><i />{SHIFT_META[key].label}</span>)}
          </div>
        </div>

        {error && (
          <div className={styles.errorBar}>
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={reload}>Try again</button>
          </div>
        )}

        <div className={styles.weekdays}>
          {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className={`${styles.calendar} ${loading && !data ? styles.loading : ""}`} aria-busy={loading}>
          {cells.map((date) => {
            const day = Number(date.slice(-2));
            const current = monthKey(date) === monthKey(month);
            const shifts = byDate[date] || { morning: [], evening: [], night: [] };
            const assigned = SHIFT_KEYS.some((s) => shifts[s].length);
            return (
              <button
                type="button"
                className={`${styles.day} ${!current ? styles.outside : ""} ${date === TODAY ? styles.today : ""}`}
                key={date}
                onClick={() => openDay(date)}
                aria-label={`${longDate(date)}${assigned ? ", scheduled" : ""}`}
              >
                <span className={styles.dayNumber}>{day}</span>
                <div className={styles.chips}>
                  {SHIFT_KEYS.map((key) => shifts[key].length > 0 && (
                    <span className={styles.shiftChip} data-tone={key} key={key} onClick={(e) => { e.stopPropagation(); openDay(date, key); }}>
                      <i />{SHIFT_META[key].label}<b>{shifts[key].length}</b>
                    </span>
                  ))}
                </div>
                {!assigned && current && <span className={styles.addHint}>+ Assign shift</span>}
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="shift-dialog-title">
            <div className={styles.modalHead}>
              <div>
                <small>{weekday(selected.date)}</small>
                <h2 id="shift-dialog-title">{longDate(selected.date)}</h2>
              </div>
              <button className="btn btn-ghost icon-btn" aria-label="Close" onClick={() => setSelected(null)}>×</button>
            </div>

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
              <div><b>Select analysts</b><small>{draftIds.length} selected</small></div>
              <button className={styles.clear} disabled={!draftIds.length} onClick={() => setDraftIds([])}>Clear selection</button>
            </div>
            <div className={styles.searchWrap}>
              <span>⌕</span>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or team…" aria-label="Search analysts" />
            </div>

            <div className={styles.peopleList}>
              {visibleMembers.length === 0 ? (
                <div className={styles.noPeople}>No matching analysts.</div>
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
                    {moved ? <span className={styles.moveTag}>Move from {SHIFT_META[currentShift].label}</span> : currentShift === selected.shift ? <span className={styles.currentTag}>Scheduled</span> : null}
                  </label>
                );
              })}
            </div>

            <div className={styles.modalFoot}>
              <span className="muted">Saving this roster replaces only the selected {SHIFT_META[selected.shift].label.toLowerCase()} shift.</span>
              <div>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : `Save ${SHIFT_META[selected.shift].label}`}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
