"use client";

import { useEffect, useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { api, useApp } from "@/components/AppProvider";
import { Panel } from "@/components/ui/layout";
import Icon from "@/components/ui/Icon";
import { KPI_SOURCES } from "@/lib/analytics/kpi";
import { groupFa } from "@/lib/analytics/labels";

const clone = (x) => JSON.parse(JSON.stringify(x));

export default function KpiSettings() {
  return (
    <AnalyticsFrame title="تنظیمات KPI" subtitle="تعریف نسخه‌دار شاخص‌ها، وزن‌ها و منابع محاسبه">
      <KpiSettingsBody />
    </AnalyticsFrame>
  );
}

function KpiSettingsBody() {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [scope, setScope] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const next = await api("/api/analytics/kpi/settings");
      setData(next);
      const nextScope = scope && next.scopes.includes(scope) ? scope : next.scopes[0];
      setScope(nextScope);
      const cfg = next.configs.find((x) => x.scope === nextScope);
      setDraft(cfg ? clone(cfg) : null);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectScope = (nextScope) => {
    setScope(nextScope);
    const cfg = data?.configs.find((x) => x.scope === nextScope);
    setDraft(cfg ? clone(cfg) : null);
    setError("");
  };

  const totals = useMemo(() => {
    if (!draft) return { specialized: 0, shared: 0 };
    return draft.items.reduce((a, x) => {
      a[x.category] += Number(x.weight) || 0;
      return a;
    }, { specialized: 0, shared: 0 });
  }, [draft]);

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setComplexity = (i, value) => setDraft((d) => ({ ...d, complexityWeights: d.complexityWeights.map((x, n) => (n === i ? value : x)) }));
  const setItem = (i, key, value) => setDraft((d) => ({ ...d, items: d.items.map((x, n) => (n === i ? { ...x, [key]: value } : x)) }));
  const removeItem = (i) => setDraft((d) => ({ ...d, items: d.items.filter((_, n) => n !== i) }));
  const addItem = (category) => setDraft((d) => ({
    ...d,
    items: [...d.items, { id: `kpi-${Date.now().toString(36)}`, name: "شاخص جدید", category, weight: 10, source: "", hint: "" }],
  }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/analytics/kpi/settings", {
        method: "PUT",
        body: {
          scope,
          name: draft.name,
          specializedWeight: Number(draft.specializedWeight),
          target: Number(draft.target),
          complexityWeights: draft.complexityWeights.map(Number),
          items: draft.items.map((x) => ({ ...x, weight: Number(x.weight) })),
        },
      });
      toast("نسخه جدید تنظیمات KPI ذخیره شد");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data || !draft) {
    return <Panel><div className={error ? "empty danger" : "empty"}><h3>{error ? "تنظیمات بارگذاری نشد" : "در حال بارگذاری…"}</h3>{error && <p>{error}</p>}</div></Panel>;
  }

  const versions = data.versions?.[scope] ?? [];

  return (
    <>
      <div className="an-kpi-scope-tabs">
        {data.scopes.map((x) => <button key={x} type="button" className={`btn ${scope === x ? "btn-primary" : "btn-ghost"}`} onClick={() => selectScope(x)}>{groupFa(x)}</button>)}
      </div>

      <Panel
        title={`تعریف KPI · ${groupFa(scope)}`}
        meta={`نسخه فعال v${draft.version} · ذخیره تغییرات نسخه جدید می‌سازد`}
        actions={<button type="button" className="btn btn-primary" onClick={save} disabled={busy}><Icon name="save" />ذخیره به‌عنوان نسخه جدید</button>}
      >
        <div className="an-kpi-settings-grid">
          <label>نام مجموعه KPI<input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label>وزن شاخص‌های تخصصی (%)<input className="input" type="number" min="0" max="100" value={draft.specializedWeight} onChange={(e) => set("specializedWeight", e.target.value)} /><small>وزن مشترک: {100 - Number(draft.specializedWeight || 0)}٪</small></label>
          <label>هدف بهره‌وری دوره<input className="input" type="number" min="0" step="1" value={draft.target} onChange={(e) => set("target", e.target.value)} /><small>برای منبع «بهره‌وری وزنی» استفاده می‌شود.</small></label>
          <div>
            <span className="field-label">ضرایب پیچیدگی</span>
            <div className="an-kpi-cx">
              {["ساده", "متوسط", "پیچیده", "پیشرفته"].map((name, i) => <label key={name}>{name}<input className="input" type="number" min="0" step="0.1" value={draft.complexityWeights[i]} onChange={(e) => setComplexity(i, e.target.value)} /></label>)}
            </div>
          </div>
        </div>

        <KpiItems
          title="شاخص‌های تخصصی"
          total={totals.specialized}
          items={draft.items}
          category="specialized"
          setItem={setItem}
          removeItem={removeItem}
          addItem={addItem}
        />
        <KpiItems
          title="شاخص‌های مشترک"
          total={totals.shared}
          items={draft.items}
          category="shared"
          setItem={setItem}
          removeItem={removeItem}
          addItem={addItem}
        />

        {error && <div className="form-alert" role="alert">{error}</div>}
        <p className="muted small">جمع وزن‌های داخل هر بخش نسبی محاسبه می‌شود و لازم نیست دقیقاً ۱۰۰ باشد. ارزیابی‌های قبلی همیشه به نسخه‌ای که با آن نهایی یا شروع شده‌اند متصل می‌مانند.</p>
      </Panel>

      <Panel title="تاریخچه نسخه‌ها" meta="برای Audit؛ نسخه‌های قبلی حذف نمی‌شوند">
        <div className="an-kpi-versions">
          {versions.map((v) => <div key={v.id}><b>v{v.version}</b><span>{v.name}</span><small>{v.createdAt || "—"}</small></div>)}
        </div>
      </Panel>
    </>
  );
}

function KpiItems({ title, total, items, category, setItem, removeItem, addItem }) {
  const rows = items.map((x, index) => ({ x, index })).filter(({ x }) => x.category === category);
  return (
    <section className="an-kpi-settings-section">
      <div className="an-kpi-settings-head">
        <div><h3>{title}</h3><span className="muted small">جمع وزن‌ها: {Number(total).toLocaleString("fa-IR")}٪</span></div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addItem(category)}><Icon name="plus" />افزودن شاخص</button>
      </div>
      <div className="table-wrap">
        <table className="dt an-dt an-kpi-settings-table">
          <thead><tr><th>نام شاخص</th><th>وزن</th><th>منبع محاسبه</th><th>راهنما / تعریف</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ x, index }) => (
              <tr key={x.id}>
                <td><input className="input" value={x.name} onChange={(e) => setItem(index, "name", e.target.value)} /></td>
                <td><input className="input" type="number" min="0" step="1" value={x.weight} onChange={(e) => setItem(index, "weight", e.target.value)} /></td>
                <td>
                  <select className="input" value={x.source} onChange={(e) => setItem(index, "source", e.target.value)}>
                    {Object.entries(KPI_SOURCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </td>
                <td><input className="input" value={x.hint ?? ""} onChange={(e) => setItem(index, "hint", e.target.value)} /></td>
                <td><button type="button" className="btn btn-ghost icon-btn btn-sm danger" aria-label="حذف شاخص" onClick={() => removeItem(index)}><Icon name="trash" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
