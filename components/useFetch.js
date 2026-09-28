"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/AppProvider";

/** Loads JSON from `url` (skips when null). Returns { data, error, loading, reload, setData }. */
export default function useFetch(url) {
  const [state, setState] = useState({ data: null, error: null, loading: !!url });
  const load = useCallback(async () => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(url);
      setState({ data, error: null, loading: false });
    } catch (e) {
      setState({ data: null, error: e.message, loading: false });
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === "function" ? fn(s.data) : fn })), []);
  return { ...state, reload: load, setData };
}
