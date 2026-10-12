"use client";

import { useMemo, useState } from "react";
import AnalyticsFrame from "@/components/analytics/AnalyticsFrame";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { peopleRows } from "@/lib/analytics/metrics";

const weights = { completed: 25, onTimeRate: 25, highQualityShare: 25, routineRate: 25 };
const definitions = [
  ["completed", "بهره‌وری", "تعداد تسک تکمیل‌شده نسبت به هدف دوره"],
  ["onTimeRate", "تحویل به‌موقع", "نسبت کارهای تأییدشده تا مهلت"],
  ["highQualityShare", "کیفیت کار", "سهم کارهای عالی و خوب"],
  ["routineRate", "انجام روتین", "سهم فعالیت‌های انجام‌شده در شیفت"],
];
const score = (key, s, target) => {
  if (key === "completed") return Math.min(100, s.completed / target * 100);
  const v = s[key];
  return v == null ? null : Math.max(0, Math.min(100, v * 100));
};
const fmt = v => v == null ? "—" : v.toLocaleString("fa-IR", { maximumFractionDigits: 1 });

export default function KpiPreview() {
  const a = useAnalytics();
  const [target, setTarget] = useState(10);
  const [selected, setSelected] = useState("");
  const rows = useMemo(() => {
    if (!a.view) return [];
    return peopleRows(a.view, a.range, a.cmp).map(r => {
      const details = definitions.map(([key, name, hint]) => ({ key, name, hint, weight: weights[key], value: score(key, r.cur, target) }));
      const measured = details.filter(x => x.value != null);
      const sum = measured.reduce((s, x) => s + x.weight, 0);
      const final = sum ? measured.reduce((s, x) => s + x.weight * x.value, 0) / sum : null;
      return { ...r, details, final, coverage: sum };
    });
  }, [a.view, a.range, a.cmp, target]);
  const active = rows.find(r => r.person.id === selected) || rows[0];
  const evaluated = rows.filter(r => r.final != null);
  const avg = evaluated.length ? evaluated.reduce((s, r) => s + r.final, 0) / evaluated.length : null;
  return <AnalyticsFrame title="ارزیابی KPI — پیش‌نمایش" subtitle="نسخه آزمایشی با داده واقعی Analytics؛ بدون ثبت ارزیابی رسمی" exportKind={null}>
    <div className="panel" style={{padding:20,marginBottom:16}}>
      <h3>تنظیمات آزمایشی</h3>
      <p>در این نسخه چهار شاخص خودکار با وزن مساوی محاسبه می‌شوند. شاخص‌های بدون داده از میانگین حذف می‌شوند؛ این نتیجه ارزیابی نهایی پرسنل نیست.</p>
      <label htmlFor="kpi-target">هدف تعداد تسک در دوره انتخاب‌شده</label>{" "}
      <input id="kpi-target" type="number" min="1" max="10000" value={target} onChange={e => setTarget(Math.max(1, Number(e.target.value) || 1))} style={{width:100,marginInlineStart:10}} />
    </div>
    <div className="an-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
      <div className="panel" style={{padding:20}}><div>کارشناسان در محدوده</div><h2>{fmt(rows.length)}</h2></div>
      <div className="panel" style={{padding:20}}><div>دارای داده قابل محاسبه</div><h2>{fmt(evaluated.length)}</h2></div>
      <div className="panel" style={{padding:20}}><div>میانگین امتیاز آزمایشی</div><h2>{fmt(avg)}</h2></div>
    </div>
    <div className="panel" style={{padding:20,marginBottom:16,overflowX:"auto"}}>
      <h3>نتایج کارشناسان</h3>
      <table style={{width:"100%",textAlign:"right",borderCollapse:"collapse"}}>
        <thead><tr><th>کارشناس</th><th>گروه</th><th>تسک</th><th>پوشش شاخص</th><th>امتیاز آزمایشی</th><th>جزئیات</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.person.id} style={{borderTop:"1px solid var(--border, #ddd)"}}>
          <td style={{padding:10}}>{r.person.name}</td><td>{r.person.group}</td><td>{fmt(r.cur.completed)}</td><td>{fmt(r.coverage)}٪</td><td><b>{fmt(r.final)}</b></td>
          <td><button className="btn btn-secondary btn-sm" type="button" onClick={() => setSelected(r.person.id)}>مشاهده</button></td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p>برای این فیلتر کارشناس قابل نمایش وجود ندارد.</p>}
    </div>
    {active && <div className="panel" style={{padding:20}}>
      <h3>جزئیات {active.person.name}</h3>
      <div style={{display:"grid",gap:14}}>{active.details.map(d => <div key={d.key}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>{d.name} · وزن {fmt(d.weight)}٪</span><strong>{fmt(d.value)}</strong></div>
        <div style={{height:9,borderRadius:10,background:"var(--surface-2, #dfe7ee)",overflow:"hidden",marginTop:5}}><div style={{width:`${d.value ?? 0}%`,height:"100%",background:"var(--accent, #1685d6)"}} /></div>
        <small>{d.hint}</small>
      </div>)}</div>
      <p style={{marginTop:16}}>امتیاز: <b>{fmt(active.final)}</b> از ۱۰۰ · پوشش: {fmt(active.coverage)}٪</p>
    </div>}
  </AnalyticsFrame>;
}
