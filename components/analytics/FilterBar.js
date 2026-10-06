"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { Drawer } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { WEEKDAYS_SHORT, addDays, faDate, faDigits, faRange, fromJalali, jalaliMonthLength, toJalali, weekdayIndex } from "@/lib/analytics/calendar";
import { ADVANCED_FILTERS, activeDataFilters } from "@/lib/analytics/filters";
import { CX_FA, GROUPS, LEVELS, PRIO_FA, PRIO_KEYS, QUAL_FA, QUAL_KEYS, ROLE_FA, SHIFT_FA, SHIFT_KEYS } from "@/lib/analytics/labels";
import { COMPARISONS, GRANULARITIES, PRESETS, PRESET_LABEL, monthTitle } from "@/lib/analytics/periods";

/** Month grid on the Jalali calendar for choosing a custom range. Saturday first; days after `max` are disabled. */
function RangeCalendar({ from, to, max, onApply, onCancel }) {
  const start = toJalali(from || max);
  const [view, setView] = useState({ jy: start.jy, jm: start.jm });
  const [a, setA] = useState(from || "");
  const [b, setB] = useState(to || "");
  const [hover, setHover] = useState("");
  const first = fromJalali(view.jy, view.jm, 1);
  const days = jalaliMonthLength(view.jy, view.jm);
  const lead = weekdayIndex(first);
  const step = (k) => setView((v) => { const m = v.jm + k; return m < 1 ? { jy: v.jy - 1, jm: 12 } : m > 12 ? { jy: v.jy + 1, jm: 1 } : { jy: v.jy, jm: m }; });
  const pick = (iso) => {
    if (!a || b) { setA(iso); setB(""); return; }
    if (iso < a) { setB(a); setA(iso); } else setB(iso);
  };
  const end = b || (a && hover && hover >= a ? hover : "");
  const inRange = (iso) => a && end && iso >= a && iso <= end;
  return (
    <div className="an-cal" dir="rtl">
      <div className="an-cal-head">
        <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="ماه قبل" onClick={() => step(-1)}><Icon name="chev" /></button>
        <b>{monthTitle(view.jy, view.jm)}</b>
        <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-label="ماه بعد" onClick={() => step(1)} disabled={fromJalali(view.jy, view.jm, days) >= max}><Icon name="left" /></button>
      </div>
      <div className="an-cal-grid" role="grid" aria-label={monthTitle(view.jy, view.jm)}>
        {WEEKDAYS_SHORT.map((d) => <span key={d} className="an-cal-dow" aria-hidden="true">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const iso = addDays(first, i);
          const off = iso > max;
          const edge = iso === a || iso === b;
          return (
            <button
              key={iso}
              type="button"
              className={`an-cal-day ${inRange(iso) ? "in" : ""} ${edge ? "edge" : ""} ${iso === max ? "today" : ""}`}
              disabled={off}
              aria-pressed={edge}
              aria-label={faDate(iso)}
              onClick={() => pick(iso)}
              onMouseEnter={() => setHover(iso)}
            >
              {faDigits(i + 1)}
            </button>
          );
        })}
      </div>
      <div className="an-cal-foot">
        <span className="muted">{a ? (b ? faRange(a, b) : `از ${faDate(a)} — روز پایان را انتخاب کنید`) : "روز شروع را انتخاب کنید"}</span>
        <span className="row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>انصراف</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!a || !b} onClick={() => onApply(a, b)}>اعمال</button>
        </span>
      </div>
    </div>
  );
}

/**
 * Period menu: presets as rows (one click), the custom range behind a hairline at the bottom.
 * It renders in the app-level popover layer (outside the analytics context), so it gets what it needs as props.
 */
function PeriodMenu({ close, filters, setFilters, today }) {
  const [custom, setCustom] = useState(filters.p === "custom");
  if (custom) {
    return <RangeCalendar from={filters.from} to={filters.to} max={today} onCancel={() => setCustom(false)} onApply={(from, to) => { setFilters({ p: "custom", from, to }); close(); }} />;
  }
  return (
    <div dir="rtl" className="an-period-menu" role="group" aria-label="بازه زمانی">
      {PRESETS.filter(([k]) => k !== "custom").map(([k, label]) => (
        <button key={k} type="button" aria-pressed={filters.p === k} className={`mi ${filters.p === k ? "checked" : ""}`} onClick={() => { setFilters({ p: k }); close(); }}>
          {label}
          {filters.p === k && <Icon name="check" className="i mi-check" />}
        </button>
      ))}
      <div className="sep" role="separator" />
      <button type="button" aria-pressed={filters.p === "custom"} className="mi" onClick={() => setCustom(true)}>
        <Icon name="cal" />بازه دلخواه…
      </button>
    </div>
  );
}

const ADV_LABEL = { role: "نقش", prio: "اولویت", cx: "پیچیدگی", q: "کیفیت", shift: "نوع شیفت" };
const ADV_OPTIONS = {
  role: [["analyst", ROLE_FA.analyst], ["engineer", ROLE_FA.engineer]],
  prio: PRIO_KEYS.map((k) => [k, PRIO_FA[k]]),
  cx: CX_FA.map((c, i) => [String(i + 1), c]),
  q: QUAL_KEYS.map((k) => [k, QUAL_FA[k]]),
  shift: SHIFT_KEYS.map((k) => [k, SHIFT_FA[k]]),
};
const ADV_NOTE = { prio: "فقط تسک‌ها", cx: "فقط تسک‌ها", q: "فقط تسک‌های تأییدشده", shift: "فقط داده SOC" };
const optionLabel = (k, v) => ADV_OPTIONS[k].find(([x]) => x === v)?.[1] ?? v;

function MoreFilters({ onClose }) {
  const { filters, setFilters } = useAnalytics();
  const [draft, setDraft] = useState(() => Object.fromEntries(ADVANCED_FILTERS.map((k) => [k, filters[k]])));
  return (
    <Drawer
      title="فیلترهای بیشتر"
      subtitle="این فیلترها همه نمودارها، جدول‌ها و خروجی‌ها را محدود می‌کنند."
      onClose={onClose}
      width={380}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(Object.fromEntries(ADVANCED_FILTERS.map((k) => [k, ""])))}>پاک کردن</button>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>انصراف</button>
          <button type="button" className="btn btn-primary" onClick={() => { setFilters(draft); onClose(); }}>اعمال فیلترها</button>
        </>
      }
    >
      <div className="stack">
        {ADVANCED_FILTERS.map((k) => (
          <div key={k} className="field">
            <label htmlFor={`f-${k}`}>{ADV_LABEL[k]} {ADV_NOTE[k] && <span className="muted small">({ADV_NOTE[k]})</span>}</label>
            <select id={`f-${k}`} className={`input ${draft[k] ? "is-set" : ""}`} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}>
              <option value="">همه</option>
              {ADV_OPTIONS[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

/** One row of filters above everything they scope. Sticky while the page scrolls. */
export default function FilterBar({ hideTeam = false }) {
  const { openPopover } = useApp();
  const { filters, setFilters, range, cmp, facts, manager, today } = useAnalytics();
  const [more, setMore] = useState(false);
  const scope = facts?.scope?.kind;
  const groups = useMemo(() => GROUPS.filter((g) => facts?.people.some((p) => p.group === g.name && !p.manager)), [facts]);
  const showTeam = manager && !hideTeam && groups.length > 1;
  const showLevel = manager && !hideTeam && (filters.team === "soc" || scope === "soc");
  const adv = ADVANCED_FILTERS.filter((k) => filters[k]);
  const active = activeDataFilters(filters);

  return (
    <div className="an-filters an-no-print" role="search" aria-label="فیلترهای داشبورد">
      <button
        type="button"
        className="btn btn-secondary an-period-btn"
        aria-haspopup="dialog"
        onClick={(e) => openPopover(e.currentTarget, { label: "بازه زمانی", width: 300, align: "end", dir: "rtl", render: (close) => <PeriodMenu close={close} filters={filters} setFilters={setFilters} today={today} /> })}
        data-testid="period"
      >
        <Icon name="cal" />
        <span className="an-period-label">{PRESET_LABEL[range.preset]}</span>
        <span className="muted">{faRange(range.from, range.end)}</span>
        <Icon name="down" size="sm" />
      </button>

      <label className="an-select">
        <span>مقایسه با</span>
        <select className="input" value={filters.cmp} onChange={(e) => setFilters({ cmp: e.target.value })} aria-label="مقایسه با">
          {COMPARISONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      {showTeam && (
        <label className="an-select">
          <span>تیم</span>
          <select className={`input ${filters.team ? "is-set" : ""}`} value={filters.team} onChange={(e) => setFilters({ team: e.target.value })} aria-label="تیم">
            <option value="">همه تیم‌ها</option>
            {groups.map((g) => <option key={g.key} value={g.key}>{g.fa}</option>)}
          </select>
        </label>
      )}
      {showLevel && (
        <label className="an-select">
          <span>سطح</span>
          <select className={`input ${filters.level ? "is-set" : ""}`} value={filters.level} onChange={(e) => setFilters({ level: e.target.value })} aria-label="سطح">
            <option value="">همه سطح‌ها</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      <label className="an-select">
        <span>واحد زمانی</span>
        <select className="input" value={filters.g} onChange={(e) => setFilters({ g: e.target.value })} aria-label="واحد زمانی نمودارها">
          {GRANULARITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      {manager && (
        <button type="button" className={`btn btn-ghost ${adv.length ? "is-on" : ""}`} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Icon name="filter" />فیلترهای بیشتر{adv.length > 0 && <span className="an-count">{faDigits(adv.length)}</span>}
        </button>
      )}
      {adv.map((k) => (
        <span key={k} className="an-chip">
          {ADV_LABEL[k]}: {optionLabel(k, filters[k])}
          <button type="button" aria-label={`حذف فیلتر ${ADV_LABEL[k]}`} onClick={() => setFilters({ [k]: "" })}><Icon name="x" size="sm" /></button>
        </span>
      ))}
      {active > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({ team: "", level: "", role: "", prio: "", cx: "", q: "", shift: "" })}>
          <Icon name="x" />پاک کردن فیلترها ({faDigits(active)})
        </button>
      )}
      <span className="an-filters-meta">{cmp ? `مقایسه: ${cmp.label}` : "بدون مقایسه"}</span>
      {more && <MoreFilters onClose={() => setMore(false)} />}
    </div>
  );
}
