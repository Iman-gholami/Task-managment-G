"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import echarts from "@/components/analytics/echarts";
import { lightTokens, useChartTokens } from "@/components/analytics/chartTheme";

// Every mounted chart, so printing can repaint them all synchronously in the light theme
// before the browser lays out the print copy (see usePrintTheme in AnalyticsFrame).
const registry = new Set();
export function repaintCharts(tokens) {
  for (const c of registry) c.repaint(tokens);
}

/** Saves a data URL as a file. */
export function downloadUrl(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * One ECharts chart. `build(tokens)` returns the option for the current theme colours; pass a
 * memoised function (useCallback) so the chart only redraws when its data changes.
 * The ref exposes `png(fileName)`: a 2× PNG in the light theme on a white background.
 */
const Chart = forwardRef(function Chart({ build, height = 260, label, onClick }, ref) {
  const el = useRef(null);
  const inst = useRef(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  const tokens = useChartTokens();

  useEffect(() => {
    const node = el.current;
    const chart = echarts.init(node, null, { renderer: "svg" });
    inst.current = chart;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => !chart.isDisposed() && chart.resize());
    });
    ro.observe(node);
    const entry = {
      repaint: (t) => {
        if (chart.isDisposed()) return;
        chart.setOption({ ...buildRef.current(t), animation: false }, { notMerge: true, lazyUpdate: false });
      },
    };
    registry.add(entry);
    return () => {
      registry.delete(entry);
      cancelAnimationFrame(frame);
      ro.disconnect();
      chart.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    if (tokens && inst.current) inst.current.setOption(build(tokens), { notMerge: true });
  }, [tokens, build]);

  useEffect(() => {
    const chart = inst.current;
    if (!chart) return undefined;
    chart.off("click");
    if (onClick) chart.on("click", onClick);
    return () => chart.off("click");
  }, [onClick]);

  useImperativeHandle(ref, () => ({
    png(name) {
      const node = el.current;
      const off = document.createElement("div");
      off.style.cssText = `position:fixed;left:-10000px;top:0;width:${node.clientWidth}px;height:${node.clientHeight}px`;
      off.dir = "rtl";
      document.body.appendChild(off);
      const c = echarts.init(off, null, { renderer: "canvas" });
      c.setOption({ ...buildRef.current(lightTokens()), animation: false });
      const url = c.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#FFFFFF" });
      c.dispose();
      off.remove();
      downloadUrl(url, name);
    },
  }), []);

  return <div ref={el} className="an-chart" style={{ height }} role="img" aria-label={label} />;
});

export default Chart;
