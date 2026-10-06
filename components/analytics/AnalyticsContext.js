"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, useApp } from "@/components/AppProvider";
import { addDays, minIso } from "@/lib/analytics/calendar";
import { HISTORY_DAYS } from "@/lib/analytics/config";
import { applyFilters, filterQuery, parseFilters } from "@/lib/analytics/filters";
import { autoGranularity, comparisonRange, resolveRange } from "@/lib/analytics/periods";
import { isManager } from "@/lib/roles";
import { tehranDate } from "@/lib/shifts";

const Ctx = createContext(null);
export const useAnalytics = () => useContext(Ctx);

/**
 * Loads JSON and keeps the previous result on screen while a new URL loads (charts hold their frame
 * at reduced opacity instead of flashing a skeleton).
 */
function useFacts(url) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const latest = useRef(url);
  latest.current = url;
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(url);
      if (latest.current === url) setState({ data, error: null, loading: false });
    } catch (e) {
      if (latest.current === url) setState((s) => ({ data: s.data, error: e, loading: false }));
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/** Filters (from the URL), the period and comparison, and the facts behind every analytics screen. */
export function AnalyticsProvider({ children }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useApp();
  const manager = isManager(me);
  const filters = useMemo(() => parseFilters(params), [params]);
  const today = useMemo(() => tehranDate(), []);
  const range = useMemo(() => resolveRange(filters, today), [filters, today]);
  const cmp = useMemo(() => comparisonRange(range, filters.cmp), [range, filters.cmp]);
  const gran = filters.g === "auto" ? autoGranularity(range.days) : filters.g;

  // One window of history serves every preset in the last year without refetching.
  const wf = minIso(range.from, cmp?.from, addDays(today, -HISTORY_DAYS));
  const query = new URLSearchParams({ wf, wt: today });
  if (filters.demo && manager) query.set("demo", "1");
  if (!manager) {
    query.set("rf", range.from); query.set("rt", range.end);
    if (cmp) { query.set("cf", cmp.from); query.set("ct", cmp.to); }
  }
  const { data, error, loading, reload } = useFacts(`/api/analytics?${query}`);
  const view = useMemo(() => (data ? applyFilters(data, filters) : null), [data, filters]);

  /** Page-specific URL keys (compare ids, trend metric…) that survive filter changes. */
  const extra = useMemo(() => {
    const out = {};
    for (const [k, v] of params.entries()) if (!(k in filters)) out[k] = v;
    return out;
  }, [params, filters]);

  const setFilters = useCallback((patch) => {
    const next = { ...filters, ...patch };
    if (patch.p && patch.p !== "custom") { next.from = ""; next.to = ""; }
    if (next.team && next.team !== "soc") next.level = "";
    const q = filterQuery(next, extra);
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [filters, extra, pathname, router]);

  /** Sets page-specific URL keys in one navigation (an empty value removes the key). */
  const setParams = useCallback((patch) => {
    const next = { ...extra };
    for (const [k, v] of Object.entries(patch)) next[k] = v || undefined;
    const q = filterQuery(filters, next);
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [filters, extra, pathname, router]);
  const setParam = useCallback((key, value) => setParams({ [key]: value }), [setParams]);

  /**
   * Link to another analytics page with the current filters. `more` can override filters
   * (e.g. { team: "da" } or { team: "" } to clear it) and add page keys (metric, ids…).
   */
  const href = useCallback((path, more = {}) => {
    const f = { ...filters };
    const keys = {};
    for (const [k, v] of Object.entries(more)) {
      if (k in f) f[k] = v ?? "";
      else keys[k] = v;
    }
    if (f.team && f.team !== "soc") f.level = "";
    const q = filterQuery(f, keys);
    return q ? `${path}?${q}` : path;
  }, [filters]);

  const exportUrl = useCallback((kind, more = {}) => `/api/analytics/export?${filterQuery(filters, { kind, ...more })}`, [filters]);

  const value = useMemo(() => ({
    me, manager, filters, setFilters, setParam, setParams, params, href, exportUrl,
    today: data?.today ?? today, range, cmp, gran,
    facts: data, view, error, loading, reload, demo: !!data?.demo,
  }), [me, manager, filters, setFilters, setParam, setParams, params, href, exportUrl, data, today, range, cmp, gran, view, error, loading, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
