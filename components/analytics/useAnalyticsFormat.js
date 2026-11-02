"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { change, fmtDays, fmtHours, fmtInt, fmtMetric, fmtNum, fmtPct } from "@/lib/analytics/format";

/** Locale-bound presentation functions. The underlying analytics values stay numeric. */
export default function useAnalyticsFormat() {
  const { locale } = useI18n();
  return useMemo(() => ({
    fmtNum: (value, digits) => fmtNum(value, digits, locale),
    fmtInt: (value) => fmtInt(value, locale),
    fmtPct: (value, digits) => fmtPct(value, digits, locale),
    fmtDays: (value) => fmtDays(value, locale),
    fmtHours: (value) => fmtHours(value, locale),
    fmtMetric: (value, kind) => fmtMetric(value, kind, locale),
    change: (now, before, kind) => change(now, before, kind, locale),
  }), [locale]);
}
