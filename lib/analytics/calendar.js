// Dates for analytics: ISO (Gregorian) day strings everywhere, Jalali (Persian) calendar for
// periods, buckets and labels. Pure and isomorphic (server, browser, node --test).
//
// Jalali conversion follows the jalaali-js algorithm (MIT, Behrooz Shabani), which matches
// the official Iranian calendar for years 1–3177; tests check it against Intl's persian calendar.

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy, withoutLeap) {
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jump = 0;
  if (jy < jp || jy >= BREAKS[BREAKS.length - 1]) throw new Error(`Invalid Jalali year ${jy}`);
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (withoutLeap) return { gy, march };
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

const j2d = (jy, jm, jd) => {
  const r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
};

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy, false);
  let k = jdn - g2d(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export const isLeapJalaliYear = (jy) => jalCal(jy, false).leap === 0;
export const jalaliMonthLength = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : isLeapJalaliYear(jy) ? 30 : 29);

// ---- ISO day arithmetic -------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
export const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Days since 1970-01-01 for an ISO date. */
export function dayNum(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}
export const isoOfDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
export const addDays = (iso, n) => isoOfDay(dayNum(iso) + n);
/** Whole days from `a` to `b` (b − a). */
export const diffDays = (a, b) => dayNum(b) - dayNum(a);
export const minIso = (...xs) => xs.filter(Boolean).reduce((a, b) => (b < a ? b : a));
export const maxIso = (...xs) => xs.filter(Boolean).reduce((a, b) => (b > a ? b : a));
/** Day of the Iranian week: 0 = Saturday … 6 = Friday. */
export const weekdayIndex = (iso) => (new Date(dayNum(iso) * 864e5).getUTCDay() + 1) % 7;

const jCache = new Map();
/** ISO date → { jy, jm, jd } (cached; analytics converts the same days many times). */
export function toJalali(iso) {
  let v = jCache.get(iso);
  if (!v) {
    const [y, m, d] = iso.split("-").map(Number);
    v = d2j(g2d(y, m, d));
    if (jCache.size > 20000) jCache.clear();
    jCache.set(iso, v);
  }
  return v;
}

/** Jalali date → ISO. Day overflow is clamped to the month's last day (e.g. Esfand 30 in a common year). */
export function fromJalali(jy, jm, jd) {
  while (jm < 1) { jm += 12; jy -= 1; }
  while (jm > 12) { jm -= 12; jy += 1; }
  const day = Math.min(Math.max(1, jd), jalaliMonthLength(jy, jm));
  const g = d2g(j2d(jy, jm, day));
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export const jMonthStart = (iso) => { const j = toJalali(iso); return fromJalali(j.jy, j.jm, 1); };
export const jMonthEnd = (iso) => { const j = toJalali(iso); return fromJalali(j.jy, j.jm, jalaliMonthLength(j.jy, j.jm)); };
const seasonFirstMonth = (jm) => Math.floor((jm - 1) / 3) * 3 + 1;
export const jSeasonStart = (iso) => { const j = toJalali(iso); return fromJalali(j.jy, seasonFirstMonth(j.jm), 1); };
export const jSeasonEnd = (iso) => { const j = toJalali(iso); const m = seasonFirstMonth(j.jm) + 2; return fromJalali(j.jy, m, jalaliMonthLength(j.jy, m)); };
export const jYearStart = (iso) => fromJalali(toJalali(iso).jy, 1, 1);
export const jYearEnd = (iso) => { const { jy } = toJalali(iso); return fromJalali(jy, 12, jalaliMonthLength(jy, 12)); };
/** Saturday on or before `iso`. */
export const weekStart = (iso) => addDays(iso, -weekdayIndex(iso));
/** Same Jalali month/day one year earlier (Esfand 30 → Esfand 29 when needed). */
export const jYearAgo = (iso) => { const j = toJalali(iso); return fromJalali(j.jy - 1, j.jm, j.jd); };

// ---- Labels -----------------------------------------------------------------------

export const J_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const J_SEASONS = ["بهار", "تابستان", "پاییز", "زمستان"];
export const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
/** Latin digits → Persian digits (for strings that are already formatted). */
export const faDigits = (s) => String(s).replace(/\d/g, (d) => FA_DIGITS[d]);

/** "۱۴ مهر ۱۴۰۵" (year optional). */
export function faDate(iso, { year = true } = {}) {
  if (!iso) return "—";
  const j = toJalali(iso);
  return faDigits(`${j.jd} ${J_MONTHS[j.jm - 1]}${year ? ` ${j.jy}` : ""}`);
}
/** "۱۴۰۵/۰۷/۱۴" */
export function faDateNumeric(iso) {
  if (!iso) return "—";
  const j = toJalali(iso);
  return faDigits(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`);
}
/** "۱ تا ۱۴ مهر ۱۴۰۵", "۲۵ شهریور تا ۱۴ مهر ۱۴۰۵", or two full dates across years. */
export function faRange(from, to) {
  if (!from || !to) return "";
  if (from === to) return faDate(from);
  const a = toJalali(from), b = toJalali(to);
  if (a.jy === b.jy && a.jm === b.jm) return faDigits(`${a.jd} تا ${b.jd} ${J_MONTHS[a.jm - 1]} ${a.jy}`);
  if (a.jy === b.jy) return `${faDate(from, { year: false })} تا ${faDate(to)}`;
  return `${faDate(from)} تا ${faDate(to)}`;
}
export const faMonthLabel = (iso) => { const j = toJalali(iso); return faDigits(`${J_MONTHS[j.jm - 1]} ${j.jy}`); };
