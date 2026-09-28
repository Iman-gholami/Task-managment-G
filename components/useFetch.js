"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/AppProvider";

/** Loads JSON from `url` (skips when null). Returns { data, error, loading, reload, setData }. */
export default function useFetch(url) {
  const [state, setState] = useState({ data: null, error: null, loading: !!url, url: null });
  const latest = useRef(url);
  latest.current = url;

  const load = useCallback(async () => {
    if (!url) return;
    // A new URL (another employee, another period) never shows the previous result;
    // a reload of the same URL keeps the current data on screen while refreshing.
    setState((s) => (s.url === url ? { ...s, loading: true, error: null } : { data: null, error: null, loading: true, url }));
    try {
      const data = await api(url);
      if (latest.current === url) setState({ data, error: null, loading: false, url });
    } catch (e) {
      if (latest.current === url) setState({ data: null, error: e.message, loading: false, url });
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === "function" ? fn(s.data) : fn })), []);
  const current = state.url === url ? state : { data: null, error: null, loading: !!url };
  return { data: current.data, error: current.error, loading: current.loading, reload: load, setData };
}
