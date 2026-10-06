"use client";

import { useCallback, useMemo } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import PeerLeaderboard from "@/components/analytics/PeerLeaderboard";
import { lineOption } from "@/components/analytics/chartOptions";
import { AnEmpty, ChartPanel } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import Segmented from "@/components/ui/Segmented";
import { faDigits } from "@/lib/analytics/calendar";
import { MAX_COMPARE } from "@/lib/analytics/config";
import { fmtNum, fmtPct, isNum } from "@/lib/analytics/format";
import { GROUPS, groupFa } from "@/lib/analytics/labels";
import { METRICS, bucketStats, experts, headcount, idsOf, openStats, stats } from "@/lib/analytics/metrics";
import { buckets, PRESETS, resolveRange } from "@/lib/analytics/periods";

const MODES = [
  { value: "people", label: "کارشناسان" },
  { value: "teams", label: "تیم‌ها" },
  { value: "periods", label: "دوره‌ها" },
];
const TASK_KEYS = ["completed", "units", "hours", "hoursPerTask", "onTimeRate", "cycleMedian", "returnShare", "highQualityShare", "created"];
const SOC_KEYS = ["shifts", "closureRate", "routineRate", "iocs", "iocPerShift", "tickets"];
const TREND_KEYS = ["completed", "units", "hours", "created", "onTimeRate", "tickets", "iocs", "routineRate"];
const PERIOD_CHOICES = PRESETS.filter(([k]) => k !== "custom");

const fmtKind = (kind, v) => (!isNum(v) ? "—" : kind === "rate" ? fmtPct(v) : kind === "days" ? `${fmtNum(v)} روز` : fmtNum(v));

export default function Compare() {
  return (
    <AnalyticsFrame title="مقایسه و رتبه‌بندی" subtitle={`مقایسه دستی تا ${faDigits(MAX_COMPARE)} مورد + رتبه‌بندی هم‌سطح`}>
      <CompareBody />
    </AnalyticsFrame>
  );
}

function CompareBody() {
  const a = useAnalytics();
  const { view, range, gran, params, setParam, setParams } = a;
  const mode = MODES.some((x) => x.value === params.get("mode")) ? params.get("mode") : "people";
  const picked = (params.get("ids") ?? "").split(",").filter(Boolean);
  const metric = TREND_KEYS.includes(params.get("metric")) ? params.get("metric") : "completed";

  // Candidates per mode, and the chosen items as { key, label, ids, range }.
  const people = useMemo(() => experts(view).filter((p) => p.active || stats(view, [p.id], range).completed), [view, range]);
  const teams = useMemo(() => GROUPS.filter((g) => view.people.some((p) => p.group === g.name && !p.manager)), [view]);
  const options = mode === "people"
    ? people.map((p) => ({ key: p.id, label: p.name, sub: [groupFa(p.group), p.level].filter(Boolean).join(" · ") }))
    : mode === "teams" ? teams.map((g) => ({ key: g.key, label: g.fa }))
      : PERIOD_CHOICES.map(([k, l]) => ({ key: k, label: l }));
  const defaults = mode === "periods" ? ["month", "prev-month"] : mode === "teams" ? teams.map((g) => g.key) : [];
  const chosen = (picked.length ? picked : defaults).filter((k) => options.some((o) => o.key === k)).slice(0, MAX_COMPARE);

  const items = useMemo(() => chosen.map((k, i) => {
    if (mode === "people") {
      const p = view.people.find((x) => x.id === k);
      return { key: k, label: p.name, ids: [k], range, person: p, color: i };
    }
    if (mode === "teams") {
      const g = teams.find((x) => x.key === k);
      const members = view.people.filter((p) => p.group === g.name);
      return { key: k, label: g.fa, ids: idsOf(members), range, members, color: i };
    }
    const r = resolveRange({ p: k }, a.today);
    return { key: k, label: `${PERIOD_CHOICES.find(([x]) => x === k)[1]} (${r.label})`, ids: null, range: r, color: i };
  }), [chosen.join(","), mode, view, range, a.today]); // eslint-disable-line react-hooks/exhaustive-deps

  const showSoc = mode === "periods" ? view.people.some((p) => p.shift) : items.some((it) => (it.person ? it.person.shift : it.members?.some((p) => p.shift)));
  const keys = [...TASK_KEYS, ...(showSoc ? SOC_KEYS : [])];
  const data = useMemo(() => items.map((it) => {
    const s = stats(view, it.ids, it.range);
    const n = it.members ? headcount(view, it.members, it.range) : null;
    return { ...it, s, open: mode === "periods" ? null : openStats(view, it.ids), n, pc: n ? s.completed / n : null };
  }), [items, view, mode]);

  // Trend: same buckets for people and teams; periods are aligned by position (day 1, week 1…).
  const trend = useMemo(() => {
    if (mode !== "periods") {
      const b = buckets(range.from, range.end, gran);
      return { labels: b.map((x) => x.label), series: data.map((d) => bucketStats(view, d.ids, b).map((x) => x[metric])) };
    }
    const g = gran === "auto" ? "day" : gran;
    const lists = data.map((d) => buckets(d.range.from, d.range.end, g));
    const len = Math.max(0, ...lists.map((l) => l.length));
    const unit = { day: "روز", week: "هفته", month: "ماه", season: "فصل", year: "سال" }[g];
    return { labels: Array.from({ length: len }, (_, i) => `${unit} ${faDigits(i + 1)}`), series: lists.map((l) => bucketStats(view, null, l).map((x) => x[metric])) };
  }, [mode, data, view, range, gran, metric]);
  const trendBuild = useCallback((t) => lineOption(t, {
    labels: trend.labels, kind: METRICS[metric].kind,
    series: data.map((d, i) => ({ name: d.label, data: trend.series[i], color: t.cat[d.color] })),
  }), [trend, data, metric]);

  const roles = new Set(data.map((d) => d.person && `${d.person.role}|${d.person.level ?? d.person.group}`).filter(Boolean));
  const setIds = (list) => setParam("ids", list.join(","));
  const remaining = options.filter((o) => !chosen.includes(o.key));

  return (
    <>
      <Panel>
        <div className="panel-body an-compare-pick">
          <Segmented label="نوع مقایسه" value={mode} onChange={(v) => setParams({ mode: v, ids: "" })} options={MODES} />
          <div className="an-compare-chips" aria-label="موارد انتخاب‌شده">
            {data.map((d) => (
              <span key={d.key} className="an-chip">
                <i className="an-chip-dot" style={{ background: `var(--cat-${d.color + 1})` }} aria-hidden="true" />
                {d.label}
                <button type="button" aria-label={`حذف ${d.label}`} onClick={() => setIds(chosen.filter((k) => k !== d.key))}><Icon name="x" size="sm" /></button>
              </span>
            ))}
            {chosen.length < MAX_COMPARE && remaining.length > 0 && (
              <select className="input input-sm" style={{ width: 220 }} value="" onChange={(e) => e.target.value && setIds([...chosen, e.target.value])} aria-label="افزودن مورد برای مقایسه" data-testid="compare-add">
                <option value="">+ افزودن {mode === "people" ? "کارشناس" : mode === "teams" ? "تیم" : "دوره"}…</option>
                {remaining.map((o) => <option key={o.key} value={o.key}>{o.label}{o.sub ? ` — ${o.sub}` : ""}</option>)}
              </select>
            )}
          </div>
        </div>
        {mode === "people" && roles.size > 1 && (
          <div className="an-warn" role="note"><Icon name="info" />نقش یا سطح این افراد متفاوت است؛ نوع کارشان فرق دارد و مقایسه مستقیم حجم کار ممکن است گمراه‌کننده باشد.</div>
        )}
        {mode === "teams" && <div className="an-note"><Icon name="info" />تیم‌ها اندازه و نوع کار متفاوتی دارند؛ «سرانه» و نرخ‌ها را مقایسه کنید، نه جمع کل را.</div>}
        {mode === "periods" && <div className="an-note"><Icon name="info" />دوره‌ها روی همه داده‌های فیلترشده مقایسه می‌شوند؛ دوره جاری تا امروز شمرده می‌شود.</div>}
      </Panel>

      {data.length < 2 ? (
        <Panel><AnEmpty icon="bars" title="دو مورد یا بیشتر انتخاب کنید">{mode === "people" ? "برای مقایسه، کارشناسان هم‌نقش و هم‌سطح را انتخاب کنید." : "از فهرست «افزودن» موردی اضافه کنید."}</AnEmpty></Panel>
      ) : (
        <>
          <div className="an-mini-grid" data-testid="compare-grid">
            {mode === "teams" && <MiniBars title="سرانه تسک تکمیل‌شده" kind="avg" data={data} value={(d) => d.pc} />}
            {keys.map((k) => <MiniBars key={k} title={METRICS[k].label} kind={METRICS[k].kind} data={data} value={(d) => d.s[k]} n={METRICS[k].n ? (d) => d.s[METRICS[k].n] : null} />)}
            {mode !== "periods" && <MiniBars title="صف کار باز (اکنون)" kind="count" data={data} value={(d) => d.open.open} />}
          </div>
          <ChartPanel
            title={`روند «${METRICS[metric].label}»`}
            question={mode === "periods" ? "دوره‌ها روی هم: بازه اول هر دوره کنار بازه اول دوره دیگر." : "تفاوت‌ها در طول دوره ثابت است یا در چند بازه رخ داده؟"}
            build={trendBuild}
            height={280}
            actions={
              <select className="input input-sm" style={{ width: 170 }} value={metric} onChange={(e) => setParam("metric", e.target.value)} aria-label="شاخص روند">
                {TREND_KEYS.filter((k) => METRICS[k].area !== "soc" || showSoc).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
              </select>
            }
            table={{ columns: [{ key: "b", label: "بازه", value: (r) => r.label }, ...data.map((d, i) => ({ key: d.key, label: d.label, kind: METRICS[metric].kind, value: (r) => r.v[i] }))], rows: trend.labels.map((label, j) => ({ id: j, label, v: trend.series.map((s) => s[j]) })) }}
            fileName="compare-trend"
          />
        </>
      )}
      <PeerLeaderboard />
    </>
  );
}

/** One metric for every compared item: its own scale, values printed, colours fixed per item. */
function MiniBars({ title, kind, data, value, n }) {
  const vals = data.map(value);
  const top = Math.max(...vals.filter(isNum).map(Math.abs), kind === "rate" ? 1 : 1e-9);
  return (
    <section className="panel an-mini-card" aria-label={title}>
      <div className="panel-head"><h3>{title}</h3></div>
      <div className="an-mini">
        {data.map((d, i) => (
          <div key={d.key} className="an-mini-row">
            <span title={d.label}>{d.person ? d.person.name : d.label}</span>
            <span className="an-mini-track">{isNum(vals[i]) && <span style={{ width: `${(Math.abs(vals[i]) / top) * 100}%`, background: `var(--cat-${d.color + 1})` }} />}</span>
            <b>{fmtKind(kind, vals[i])}{n && isNum(vals[i]) ? <small className="muted"> (n={faDigits(n(d))})</small> : null}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

