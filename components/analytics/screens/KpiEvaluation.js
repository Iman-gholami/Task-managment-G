"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { DataTable, Kpi, AnEmpty } from "@/components/analytics/ui";
import { api, useApp } from "@/components/AppProvider";
import { MetricGrid } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/layout";
import Icon from "@/components/ui/Icon";
import { calculateKpi, KPI_SOURCES, KPI_STATUSES, kpiGrade } from "@/lib/analytics/kpi";
import { groupFa } from "@/lib/analytics/labels";
import { fmtNum } from "@/lib/analytics/format";

const score = (v) => (Number.isFinite(Number(v)) ? fmtNum(Number(v), 1) : "—");
const pct = (v) => (Number.isFinite(Number(v)) ? `${score(v)}` : "—");

export default function KpiEvaluation() {
  const a = useAnalytics();
  return (
    <AnalyticsFrame
      title="ارزیابی KPI"
      subtitle="امتیازدهی روی داده‌های واقعی Analytics + ارزیابی مدیر"
      actions={<Link className="btn btn-ghost" href={a.href("/analytics/kpi/settings")}><Icon name="settings" />تنظیمات KPI</Link>}
    >
      <KpiEvaluationBody />
    </AnalyticsFrame>
  );
}

function KpiEvaluationBody() {
  const a = useAnalytics();
  const { toast } = useApp();
  const { range, view, params, setParam } = a;
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const selected = params.get("kpiPerson") || "";

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(`/api/analytics/kpi?from=${range.from}&to=${range.end}`);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [range.from, range.end]);

  useEffect(() => { load(); }, [load]);

  const visibleIds = useMemo(() => new Set(view?.people?.map((p) => p.id) ?? []), [view]);
  const rows = useMemo(() => (state.data?.rows ?? []).filter((r) => visibleIds.has(r.person.id)), [state.data, visibleIds]);
  const current = rows.find((r) => r.person.id === selected) ?? null;

  const scored = rows.filter((r) => r.final !== null);
  const avg = scored.length ? scored.reduce((s, r) => s + r.final, 0) / scored.length : null;
  const finalN = rows.filter((r) => r.evaluation.status === "final").length;
  const incomplete = rows.filter((r) => !r.complete).length;
  const attention = rows.filter((r) => r.final !== null && r.final < 60).length;

  const updateRow = (next) => {
    setState((s) => ({ ...s, data: { ...s.data, rows: s.data.rows.map((r) => (r.person.id === next.person.id ? next : r)) } }));
    toast(next.evaluation.status === "final" ? "ارزیابی نهایی شد" : "پیش‌نویس KPI ذخیره شد");
  };

  if (state.error && !state.data) {
    return <Panel><div className="empty danger"><h3>داده KPI بارگذاری نشد</h3><p>{state.error.message}</p><button className="btn btn-secondary" onClick={load}>تلاش دوباره</button></div></Panel>;
  }

  return (
    <>
      <MetricGrid label="خلاصه ارزیابی KPI">
        <Kpi label="کارشناس در دامنه" value={rows.length.toLocaleString("fa-IR")} loading={state.loading && !state.data} />
        <Kpi label="میانگین امتیاز نهایی" value={score(avg)} loading={state.loading && !state.data} foot={scored.length ? `از ${scored.length.toLocaleString("fa-IR")} نفر دارای امتیاز` : "هنوز امتیازی نیست"} />
        <Kpi label="ارزیابی نهایی‌شده" value={finalN.toLocaleString("fa-IR")} foot={`${rows.length ? Math.round(finalN / rows.length * 100) : 0}٪ از دامنه`} />
        <Kpi label="ارزیابی ناقص" value={incomplete.toLocaleString("fa-IR")} tone={incomplete ? "alert" : undefined} foot="حداقل یک شاخص بدون امتیاز" />
        <Kpi label="نیازمند توجه" value={attention.toLocaleString("fa-IR")} tone={attention ? "alert" : undefined} foot="امتیاز نهایی کمتر از ۶۰" />
      </MetricGrid>

      <div className="an-row an-kpi-groups">
        {["SOC", "Design & Automation", "Threat Intelligence"].map((group) => {
          const list = rows.filter((r) => r.person.group === group && r.final !== null);
          const value = list.length ? list.reduce((s, r) => s + r.final, 0) / list.length : null;
          return (
            <section className="panel an-kpi-group" key={group}>
              <span className="muted small">{groupFa(group)}</span>
              <strong>{score(value)}</strong>
              <span className="muted">{list.length.toLocaleString("fa-IR")} نفر دارای امتیاز</span>
              <div className="an-kpi-progress"><i style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></div>
            </section>
          );
        })}
      </div>

      <Panel title="نتایج کارشناسان" meta="مرتب‌سازی اختیاری است؛ ردیف را برای ثبت یا بررسی ارزیابی باز کنید">
        {rows.length ? (
          <DataTable
            rows={rows}
            rowKey={(r) => r.person.id}
            onRowClick={(r) => setParam("kpiPerson", r.person.id)}
            caption="نتایج KPI کارشناسان"
            columns={[
              { key: "name", label: "کارشناس", value: (r) => r.person.name, render: (r) => <span className="an-person"><b>{r.person.name}</b><small>{groupFa(r.person.group)}{r.person.level ? ` · ${r.person.level}` : ""} · v{r.config.version}</small></span> },
              { key: "sp", label: "تخصصی", kind: "avg", value: (r) => r.specialized.score },
              { key: "sh", label: "مشترک", kind: "avg", value: (r) => r.shared.score },
              { key: "final", label: "نهایی", kind: "avg", value: (r) => r.final, render: (r) => <ScoreBadge value={r.final} /> },
              { key: "filled", label: "تکمیل شاخص‌ها", value: (r) => r.specialized.filled + r.shared.filled, render: (r) => <span>{(r.specialized.filled + r.shared.filled).toLocaleString("fa-IR")} / {(r.specialized.total + r.shared.total).toLocaleString("fa-IR")}</span> },
              { key: "status", label: "وضعیت", value: (r) => r.evaluation.status, render: (r) => <span className={`tag ${r.evaluation.status === "final" ? "ok" : ""}`}>{KPI_STATUSES[r.evaluation.status] ?? "پیش‌نویس"}</span> },
              { key: "action", label: "", sort: false, value: () => "", render: () => <span className="btn btn-ghost btn-sm">مشاهده جزئیات</span> },
            ]}
          />
        ) : (
          <AnEmpty title="کارشناسی در این دامنه نیست">فیلترهای Analytics را تغییر دهید یا اعضای تیم را اضافه کنید.</AnEmpty>
        )}
      </Panel>

      {current && <EvaluationEditor key={`${current.person.id}:${current.evaluation.updatedAt}`} row={current} range={range} onClose={() => setParam("kpiPerson", "")} onSaved={updateRow} />}
    </>
  );
}

function ScoreBadge({ value }) {
  const grade = kpiGrade(value);
  if (!grade) return <span className="muted">—</span>;
  return <span className="an-kpi-score" data-grade={grade.key}><b>{score(value)}</b><small>{grade.label}</small></span>;
}

function EvaluationEditor({ row, range, onClose, onSaved }) {
  const [scores, setScores] = useState(row.evaluation.scores ?? {});
  const [summary, setSummary] = useState(row.evaluation.summary ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const live = useMemo(() => calculateKpi(row.config, row.auto, scores), [row.config, row.auto, scores]);

  const setManual = (id, field, value) => {
    setScores((s) => ({ ...s, [id]: { ...(s[id] ?? {}), [field]: value } }));
    setError("");
  };
  const clearManual = (id) => {
    setScores((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
    setError("");
  };
  const save = async (status) => {
    setBusy(true);
    setError("");
    try {
      const clean = Object.fromEntries(Object.entries(scores).filter(([, x]) => x?.value !== "" && x?.value !== null && x?.value !== undefined));
      const { row: saved } = await api("/api/analytics/kpi", {
        method: "PATCH",
        body: { userId: row.person.id, from: range.from, to: range.end, scores: clean, summary, status },
      });
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const item = (k) => {
    const auto = k.source ? row.auto[k.source] : null;
    const manual = scores[k.id]?.value ?? "";
    const effective = live.values[k.id];
    const source = live.sources[k.id];
    return (
      <div className="an-kpi-item" key={k.id}>
        <div className="an-kpi-item-head">
          <div><b>{k.name}</b><small>{k.hint}</small></div>
          <span className="tag">وزن {k.weight.toLocaleString("fa-IR")}٪</span>
          <span className={`tag ${source === "auto" ? "ok" : ""}`}>{source === "manual" ? "مدیر" : source === "auto" ? "خودکار" : "بدون امتیاز"}</span>
          <strong>{score(effective)}</strong>
        </div>
        <div className="an-kpi-item-controls">
          <div>
            <label>مقدار خودکار</label>
            <div className="input an-kpi-readonly">{k.source ? `${pct(auto)} · ${KPI_SOURCES[k.source]}` : "این شاخص دستی است"}</div>
          </div>
          <div>
            <label>امتیاز مدیر (۰ تا ۱۰۰)</label>
            <input className="input" type="number" min="0" max="100" step="1" value={manual} placeholder={auto == null ? "—" : String(Math.round(auto))} onChange={(e) => setManual(k.id, "value", e.target.value)} />
          </div>
          <div className="wide">
            <label>{k.source ? "دلیل Override (برای مقدار دستی الزامی)" : "شاهد / توضیح"}</label>
            <input className="input" value={scores[k.id]?.note ?? ""} onChange={(e) => setManual(k.id, "note", e.target.value)} placeholder="مستند یا توضیح ارزیابی" />
          </div>
          {scores[k.id] && <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearManual(k.id)}>استفاده از خودکار</button>}
        </div>
      </div>
    );
  };

  return (
    <Panel
      title={`جزئیات ارزیابی · ${row.person.name}`}
      meta={`${groupFa(row.person.group)} · تنظیمات v${row.config.version} · وزن تخصصی ${row.config.specializedWeight}٪`}
      actions={<button type="button" className="btn btn-ghost icon-btn" aria-label="بستن" onClick={onClose}><Icon name="x" /></button>}
    >
      <div className="an-kpi-editor">
        <div className="an-kpi-summary">
          <div><span>تخصصی</span><b>{score(live.specialized.score)}</b></div>
          <div><span>مشترک</span><b>{score(live.shared.score)}</b></div>
          <div className="primary"><span>امتیاز نهایی</span><ScoreBadge value={live.final} /></div>
          <div><span>پوشش</span><b>{(live.specialized.filled + live.shared.filled).toLocaleString("fa-IR")} / {(live.specialized.total + live.shared.total).toLocaleString("fa-IR")}</b></div>
        </div>

        <h3>شاخص‌های تخصصی</h3>
        {row.config.items.filter((k) => k.category === "specialized").map(item)}
        <h3>شاخص‌های مشترک</h3>
        {row.config.items.filter((k) => k.category === "shared").map(item)}

        <h3>جمع‌بندی مدیر</h3>
        <div className="an-kpi-summary-form">
          <label>نقاط قوت<textarea className="textarea" value={summary.strengths ?? ""} onChange={(e) => setSummary((s) => ({ ...s, strengths: e.target.value }))} /></label>
          <label>موارد نیازمند بهبود<textarea className="textarea" value={summary.improve ?? ""} onChange={(e) => setSummary((s) => ({ ...s, improve: e.target.value }))} /></label>
          <label>برنامه اقدام دوره بعد<textarea className="textarea" value={summary.plan ?? ""} onChange={(e) => setSummary((s) => ({ ...s, plan: e.target.value }))} /></label>
          <label>یادداشت حساس / بحرانی<textarea className="textarea" value={summary.critical ?? ""} onChange={(e) => setSummary((s) => ({ ...s, critical: e.target.value }))} /></label>
        </div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="an-kpi-actions">
          <span className="muted">نهایی‌سازی فقط وقتی ممکن است که همه شاخص‌ها امتیاز داشته باشند.</span>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save("draft")}>ذخیره پیش‌نویس</button>
          <button type="button" className="btn btn-primary" disabled={busy || !live.complete} onClick={() => save("final")}>نهایی‌کردن ارزیابی</button>
        </div>
      </div>
    </Panel>
  );
}
