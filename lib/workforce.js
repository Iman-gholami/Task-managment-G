// Workforce Performance report: Persian labels and the overall score. Shared by the
// server (report + Excel) and the UI, so the screen and the workbook explain the same formula.

export const ROLE_FA = { analyst: "تحلیلگر", engineer: "مهندس", soc_manager: "مدیر SOC", security_manager: "مدیر امنیت" };
export const STATUS_FA = { backlog: "بک‌لاگ", todo: "برای انجام", progress: "در حال انجام", review: "در انتظار بررسی", done: "انجام‌شده", blocked: "مسدود", returned: "برگشت برای اصلاح", cancelled: "لغوشده" };
export const PRIO_FA = { low: "کم", normal: "عادی", high: "زیاد", critical: "بحرانی" };
export const CX_FA = ["", "ساده", "متوسط", "پیچیده", "پیشرفته"];
export const QUAL_FA = { excellent: "عالی", good: "خوب", acceptable: "قابل قبول", needs: "نیاز به بهبود" };
export const SHIFT_FA = { morning: "صبح", evening: "تا ۸ شب", night: "شب" };
/** Shift Log activities by their number (1–8). */
export const ACTIVITY_FA = [
  "بررسی رخدادهای Splunk", "بارگذاری IP و دامنه‌های مخرب", "بررسی داشبورد اسکنرها و سنسورها", "گزارش ترافیک روزانه",
  "پایش وضعیت سایت در Grafana", "پایش سایت مرکز امنیت", "پایش اخبار امنیتی", "ثبت IOC در MISP و اشتراک در بله",
];

/** Points a quality rating is worth in the score. */
export const QUALITY_POINTS = { excellent: 100, good: 80, acceptable: 60, needs: 30 };

/** What each part of the score measures. Every part is 0–100. */
export const COMPONENTS = {
  quality: { label: "کیفیت کار", how: "میانگین کیفیت تسک‌های تأییدشده: عالی ۱۰۰، خوب ۸۰، قابل قبول ۶۰، نیاز به بهبود ۳۰" },
  onTime: { label: "تحویل به‌موقع", how: "درصد تسک‌های موعددار که تا روز موعد تأیید شده‌اند" },
  firstPass: { label: "تأیید بدون برگشت", how: "سهم «تأیید» از تصمیم‌های بررسی (تأیید + برگشت برای اصلاح) روی تسک‌های این فرد" },
  workload: { label: "حجم کار", how: "مجموع پیچیدگی تسک‌های انجام‌شده (ساده ۱ تا پیشرفته ۴) نسبت به میانگین هم‌گروه‌ها؛ هم‌اندازه‌ی میانگین = ۸۰، ۲۵٪ بیشتر از میانگین = ۱۰۰" },
  routine: { label: "انجام فعالیت‌های روتین شیفت", how: "درصد فعالیت‌های Shift Log که انجام شده‌اند" },
  attendance: { label: "ثبت گزارش شیفت", how: "درصد شیفت‌های برنامه‌ریزی‌شده‌ی گذشته که Shift Log دارند" },
  reviewSpeed: { label: "سرعت بررسی تسک‌ها", how: "میانگین فاصله‌ی «ارسال برای بررسی» تا تصمیم مدیر: تا ۲۴ ساعت ۱۰۰، پنج روز یا بیشتر ۰" },
  team: { label: "عملکرد تیم", how: "میانگین نمره‌ی کلی تحلیلگران SOC" },
  manager: { label: "نمره‌ی مدیر", how: "میانگین نمره‌ی ارزیابی مدیر (۱ تا ۵) × ۲۰" },
};

/** Weights (sum 100) for each kind of role. */
export const WEIGHTS = {
  shift: { quality: 20, onTime: 15, firstPass: 10, workload: 15, routine: 20, attendance: 10, manager: 10 },
  staff: { quality: 30, onTime: 20, firstPass: 10, workload: 25, manager: 15 },
  manager: { quality: 15, onTime: 15, firstPass: 5, reviewSpeed: 25, team: 30, manager: 10 },
};
export const PROFILE_FA = { shift: "تحلیلگر شیفت SOC", staff: "مهندس و کارشناس (بدون شیفت)", manager: "مدیر SOC" };

export const SCORE_LEVELS = [[85, "عالی"], [70, "خوب"], [50, "قابل قبول"], [0, "نیاز به بهبود"]];

const clamp = (v) => Math.max(0, Math.min(100, v));
const known = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Overall score 0–100: the weighted mean of the parts that have data. A part without data
 * (no completed task, no scheduled shift, no evaluation…) is left out and its weight is shared
 * by the others. Null when no part has data.
 */
export function overallScore(profile, parts) {
  let sum = 0, weight = 0;
  for (const [k, w] of Object.entries(WEIGHTS[profile] ?? {})) {
    if (!known(parts[k])) continue;
    sum += clamp(parts[k]) * w;
    weight += w;
  }
  return weight ? Math.round(sum / weight) : null;
}

export const levelFor = (score) => (known(score) ? SCORE_LEVELS.find(([min]) => score >= min)[1] : "");

/** Tone of a score for colouring: good · fair · warn · bad. */
export const toneFor = (score) => (!known(score) ? null : score >= 85 ? "good" : score >= 70 ? "fair" : score >= 50 ? "warn" : "bad");

/** Workload part: complexity points against the peer-group average (average = 80). */
export const workloadScore = (points, average) => (average > 0 ? clamp(Math.round((points / average) * 80)) : null);

/** Review speed part: 24 hours or less = 100, 120 hours or more = 0. */
export const reviewSpeedScore = (hours) => (known(hours) ? clamp(Math.round(100 - ((hours - 24) / 96) * 100)) : null);
