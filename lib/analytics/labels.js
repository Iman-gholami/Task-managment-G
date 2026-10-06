// Persian labels for analytics. Technical terms (SOC, IOC, MISP, Splunk) stay in English by design.

/** Teams as analytics groups them: SOC · L1/L2/L3 and "SOC" roll up into SOC. */
export const GROUPS = [
  { key: "soc", name: "SOC", fa: "SOC" },
  { key: "da", name: "Design & Automation", fa: "طراحی و اتوماسیون" },
  { key: "ti", name: "Threat Intelligence", fa: "هوش تهدید" },
];
export const GROUP_BY_KEY = Object.fromEntries(GROUPS.map((g) => [g.key, g]));
export const GROUP_BY_NAME = Object.fromEntries(GROUPS.map((g) => [g.name, g]));
export const groupFa = (name) => GROUP_BY_NAME[name]?.fa ?? name ?? "—";

export const LEVELS = ["L1", "L2", "L3"];

/** Raw team value (users.team) → { group, level }. Security Department has no group. */
export function teamParts(team = "") {
  if (team.startsWith("SOC")) {
    const level = /L[123]$/.exec(team)?.[0] ?? null;
    return { group: "SOC", level };
  }
  return { group: GROUP_BY_NAME[team] ? team : null, level: null };
}

export const ROLE_FA = { analyst: "تحلیلگر", engineer: "مهندس", soc_manager: "مدیر SOC", security_manager: "مدیر امنیت" };

export const STATUS_FA = {
  backlog: "بک‌لاگ", todo: "برای انجام", progress: "در حال انجام", review: "بازبینی",
  done: "انجام‌شده", blocked: "مسدود", returned: "برگشتی", cancelled: "لغوشده",
};
export const OPEN_STATUSES = ["backlog", "todo", "progress", "review", "blocked", "returned"];

export const PRIO_KEYS = ["low", "normal", "high", "critical"];
export const PRIO_FA = { low: "کم", normal: "عادی", high: "بالا", critical: "بحرانی" };

export const CX_FA = ["ساده", "متوسط", "پیچیده", "پیشرفته"];

export const QUAL_KEYS = ["excellent", "good", "acceptable", "needs"];
export const QUAL_FA = { excellent: "عالی", good: "خوب", acceptable: "قابل قبول", needs: "نیازمند بهبود" };

export const SHIFT_KEYS = ["morning", "evening", "night"];
export const SHIFT_FA = { morning: "صبح", evening: "تا ساعت ۲۰", night: "شب" };
export const SHIFT_HOURS = { morning: 7.75, evening: 12.5, night: 12 };

/** The eight routine activities of a SOC shift log, by activity number (1–8). */
export const ACTIVITIES_FA = [
  "بررسی رخدادهای ثبت‌شده در Splunk",
  "بارگذاری فایل IP و دامنه‌های مخرب در وب‌سایت",
  "بررسی داشبوردهای اسکنر و سنسور",
  "تهیه گزارش ترافیک روزانه",
  "پایش وضعیت وب‌سایت در Grafana",
  "پایش وب‌سایت مرکز امنیت",
  "پایش اخبار امنیتی",
  "ثبت IOC در MISP و اشتراک در بله",
];
