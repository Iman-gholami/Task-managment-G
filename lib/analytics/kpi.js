// Shared KPI evaluation model. Pure functions only: safe in browser, server and unit tests.
import { GROUPS } from "./labels.js";

export const KPI_SOURCES = {
  "": "دستی",
  quality: "کیفیت کارها",
  productivity: "بهره‌وری وزنی",
  onTime: "تحویل به‌موقع",
  routine: "انجام روتین شیفت",
  closure: "بسته‌شدن شیفت‌لاگ",
  returnQuality: "عدم برگشت برای اصلاح",
};

export const KPI_STATUSES = {
  draft: "پیش‌نویس",
  final: "نهایی",
};

export const QUALITY_SCORE = {
  excellent: 100,
  good: 85,
  acceptable: 70,
  needs: 50,
};

const shared = (weights = [20, 20, 20, 20, 20]) => [
  { id: "procedures", name: "رعایت رویه‌ها و الزامات امنیتی", category: "shared", weight: weights[0], source: "", hint: "انطباق با رویه‌ها و الزامات مصوب" },
  { id: "records", name: "نظم در ثبت اطلاعات", category: "shared", weight: weights[1], source: "", hint: "ثبت به‌موقع شواهد، فرم‌ها و مستندات" },
  { id: "commitment", name: "تعهد به برنامه کاری", category: "shared", weight: weights[2], source: "", hint: "انجام تعهدات و اطلاع‌رسانی به‌موقع درباره تأخیر" },
  { id: "knowledge", name: "همکاری و انتقال دانش", category: "shared", weight: weights[3], source: "", hint: "مشارکت مستند در حل مسئله و انتقال تجربه" },
  { id: "improvement", name: "بهبود مستمر", category: "shared", weight: weights[4], source: "", hint: "پیشنهاد و اجرای بهبودهای قابل استناد" },
];

export const DEFAULT_KPI_CONFIGS = {
  SOC: {
    scope: "SOC",
    name: "SOC",
    specializedWeight: 80,
    target: 40,
    complexityWeights: [1, 2, 3, 5],
    items: [
      { id: "analysis-quality", name: "کیفیت تحلیل", category: "specialized", weight: 25, source: "quality", hint: "کیفیت کارهای تأییدشده؛ عالی ۱۰۰، خوب ۸۵، قابل قبول ۷۰، نیازمند بهبود ۵۰" },
      { id: "productivity", name: "بهره‌وری وزنی", category: "specialized", weight: 20, source: "productivity", hint: "ضریب پیچیدگی × کیفیت، نسبت به هدف دوره" },
      { id: "sla", name: "تحویل به‌موقع", category: "specialized", weight: 20, source: "onTime", hint: "نرخ تسک‌های تأییدشده تا ددلاین" },
      { id: "threat-discovery", name: "کشف و تحلیل تهدید", category: "specialized", weight: 20, source: "", hint: "ارزش، دقت و قابلیت اقدام یافته‌ها؛ ارزیابی مدیر" },
      { id: "documentation", name: "مستندسازی و پیگیری", category: "specialized", weight: 15, source: "", hint: "کامل بودن مستندات و پیگیری تا بسته‌شدن" },
      ...shared(),
    ],
  },
  "Design & Automation": {
    scope: "Design & Automation",
    name: "طراحی و اتوماسیون",
    specializedWeight: 85,
    target: 30,
    complexityWeights: [1, 2, 3, 5],
    items: [
      { id: "technical-quality", name: "کیفیت فنی", category: "specialized", weight: 25, source: "quality", hint: "کیفیت کارهای تأییدشده" },
      { id: "delivery", name: "تحویل کار", category: "specialized", weight: 20, source: "onTime", hint: "تسک‌های تأییدشده تا ددلاین" },
      { id: "impact", name: "اثرگذاری", category: "specialized", weight: 20, source: "", hint: "ارزش عملیاتی و صرفه‌جویی ایجادشده برای SOC" },
      { id: "stability", name: "پایداری", category: "specialized", weight: 15, source: "", hint: "پایداری راهکار و کیفیت بهره‌برداری" },
      { id: "reuse", name: "پذیرش و استفاده مجدد", category: "specialized", weight: 20, source: "", hint: "میزان استفاده تیم‌ها و قابلیت استفاده مجدد" },
      ...shared([20, 15, 20, 30, 15]),
    ],
  },
  "Threat Intelligence": {
    scope: "Threat Intelligence",
    name: "هوش تهدید",
    specializedWeight: 80,
    target: 30,
    complexityWeights: [1, 2, 3, 5],
    items: [
      { id: "intel-quality", name: "کیفیت تحلیل اطلاعات تهدید", category: "specialized", weight: 30, source: "quality", hint: "کیفیت خروجی‌های تأییدشده" },
      { id: "intel-delivery", name: "تحویل به‌موقع", category: "specialized", weight: 20, source: "onTime", hint: "تسک‌های تأییدشده تا ددلاین" },
      { id: "actionability", name: "قابلیت اقدام", category: "specialized", weight: 20, source: "", hint: "میزان قابل‌استفاده بودن خروجی برای عملیات" },
      { id: "coverage", name: "پوشش و عمق رصد", category: "specialized", weight: 15, source: "", hint: "پوشش منابع و عمق تحلیل" },
      { id: "intel-docs", name: "مستندسازی و انتشار", category: "specialized", weight: 15, source: "", hint: "کیفیت مستندات و انتشار به ذی‌نفعان" },
      ...shared(),
    ],
  },
};

export const KPI_SCOPES = GROUPS.map((g) => g.name);

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function sanitizeKpiConfig(input, scope) {
  const base = DEFAULT_KPI_CONFIGS[scope] ?? DEFAULT_KPI_CONFIGS.SOC;
  const items = Array.isArray(input?.items) ? input.items : base.items;
  const seen = new Set();
  const clean = items.map((item, index) => {
    let id = String(item?.id || `kpi-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, "-");
    if (!id || seen.has(id)) id = `kpi-${index + 1}-${Date.now().toString(36)}`;
    seen.add(id);
    return {
      id,
      name: String(item?.name || "شاخص جدید").trim().slice(0, 120),
      category: item?.category === "shared" ? "shared" : "specialized",
      weight: Math.max(0, Math.min(1000, num(item?.weight, 10))),
      source: Object.prototype.hasOwnProperty.call(KPI_SOURCES, item?.source) ? item.source : "",
      hint: String(item?.hint || "").trim().slice(0, 400),
    };
  }).filter((item) => item.name);
  return {
    scope,
    name: String(input?.name || base.name).trim().slice(0, 120),
    specializedWeight: Math.max(0, Math.min(100, num(input?.specializedWeight, base.specializedWeight))),
    target: Math.max(0, num(input?.target, base.target)),
    complexityWeights: [0, 1, 2, 3].map((i) => Math.max(0, num(input?.complexityWeights?.[i], base.complexityWeights[i]))),
    items: items.length ? clean : base.items,
  };
}

export function weightedScore(items, values, category) {
  let sum = 0;
  let weight = 0;
  let filled = 0;
  let total = 0;
  for (const item of items) {
    if (item.category !== category) continue;
    total += 1;
    const v = values[item.id];
    if (v === null || v === undefined || !Number.isFinite(Number(v))) continue;
    const w = Math.max(0, Number(item.weight) || 0);
    sum += Number(v) * w;
    weight += w;
    filled += 1;
  }
  return { score: weight ? sum / weight : null, filled, total };
}

export function calculateKpi(config, auto = {}, manual = {}) {
  const values = {};
  const sources = {};
  for (const item of config.items) {
    const mv = manual?.[item.id]?.value;
    if (mv !== null && mv !== undefined && mv !== "" && Number.isFinite(Number(mv))) {
      values[item.id] = Math.max(0, Math.min(100, Number(mv)));
      sources[item.id] = "manual";
    } else if (item.source && Number.isFinite(Number(auto[item.source]))) {
      values[item.id] = Math.max(0, Math.min(100, Number(auto[item.source])));
      sources[item.id] = "auto";
    } else {
      values[item.id] = null;
      sources[item.id] = null;
    }
  }
  const specialized = weightedScore(config.items, values, "specialized");
  const sharedScore = weightedScore(config.items, values, "shared");
  let final = null;
  if (specialized.score !== null) {
    final = sharedScore.score === null
      ? specialized.score
      : specialized.score * (config.specializedWeight / 100) + sharedScore.score * (1 - config.specializedWeight / 100);
  }
  return {
    values,
    sources,
    specialized,
    shared: sharedScore,
    final,
    complete: specialized.filled === specialized.total && sharedScore.filled === sharedScore.total,
  };
}

export function kpiGrade(value) {
  if (!Number.isFinite(Number(value))) return null;
  const v = Number(value);
  if (v >= 90) return { key: "excellent", label: "عالی" };
  if (v >= 80) return { key: "good", label: "خوب" };
  if (v >= 70) return { key: "acceptable", label: "قابل قبول" };
  if (v >= 60) return { key: "improve", label: "نیازمند بهبود" };
  return { key: "weak", label: "ضعیف" };
}
