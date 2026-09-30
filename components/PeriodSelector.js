"use client";

import Segmented from "@/components/ui/Segmented";
import { FieldError } from "@/components/ui/Field";
import { PERIODS } from "@/lib/period";

const OPTIONS = PERIODS.map(([value, label]) => ({ value, label }));
const WITH_CUSTOM = [...OPTIONS, { value: "custom", label: "Custom", icon: "cal" }];

/** Controlled period picker. With `custom`, adds a from/to range that is validated inline. */
export default function PeriodSelector({ value = "this", onChange, custom, range, onRange }) {
  const invalid = value === "custom" && range?.from && range?.to && range.from > range.to;
  return (
    <div className="period">
      <Segmented label="Period" value={value} onChange={onChange} options={custom ? WITH_CUSTOM : OPTIONS} />
      {custom && value === "custom" && (
        <span className="range">
          <input type="date" className="input" value={range?.from ?? ""} max={range?.to || undefined} onChange={(e) => onRange?.({ ...range, from: e.target.value })} aria-label="From" aria-invalid={invalid || undefined} />
          <span className="muted" aria-hidden="true">–</span>
          <input type="date" className="input" value={range?.to ?? ""} min={range?.from || undefined} onChange={(e) => onRange?.({ ...range, to: e.target.value })} aria-label="To" aria-invalid={invalid || undefined} />
          {invalid && <FieldError>Start date must be on or before the end date.</FieldError>}
        </span>
      )}
    </div>
  );
}
