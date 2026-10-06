// Demo data for the analytics screens ("داده نمایشی"). Deterministic for a given day (seeded PRNG),
// shaped exactly like the facts the server builds from the database, so every screen and export
// runs the same code path. All people and tasks are fictional.
//
// Patterns planted so the screens have something to show:
//  - SOC work grows steadily; in the last three weeks more SOC work arrives than is finished.
//  - Threat Intelligence slows down over the last five weeks.
//  - Design & Automation completes more this month, with a lower share of Excellent/Good ratings.
//  - One engineer carries a large share of open work; one analyst has no open tasks.
//  - "Monitor Security News" is the routine activity skipped most; a ticket spike six days ago;
//    IOC volume per shift is lower over the last three weeks; a few shift logs were missed recently.
import { addDays, diffDays, weekdayIndex } from "./calendar.js";
import { teamParts } from "./labels.js";

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  ["d-lnr", "لیلا نوری", "soc_manager", "SOC"],
  ["d-srh", "سارا رحیمی", "analyst", "SOC · L1"], ["d-amr", "آرش مرادی", "analyst", "SOC · L1"], ["d-nhs", "نگار حسینی", "analyst", "SOC · L1"],
  ["d-pkr", "پویا کریمی", "analyst", "SOC · L1"], ["d-mjf", "مهسا جعفری", "analyst", "SOC · L1"], ["d-osl", "امید صالحی", "analyst", "SOC · L1"],
  ["d-mak", "محمد اکبری", "analyst", "SOC · L1"],
  ["d-bah", "بهاره احمدی", "analyst", "SOC · L2"], ["d-krz", "کاوه رضایی", "analyst", "SOC · L2"], ["d-eqs", "الهام قاسمی", "analyst", "SOC · L2"], ["d-rmh", "رضا محمدی", "analyst", "SOC · L2"],
  ["d-nzr", "نیما زارعی", "analyst", "SOC · L3"], ["d-skz", "شیرین کاظمی", "analyst", "SOC · L3"], ["d-hys", "حامد یوسفی", "analyst", "SOC · L3"],
  ["d-msd", "مینا صادقی", "engineer", "Design & Automation"], ["d-ars", "علی رستمی", "engineer", "Design & Automation"],
  ["d-pab", "پرستو عباسی", "engineer", "Design & Automation"], ["d-fnk", "فرهاد نیک‌نام", "engineer", "Design & Automation"],
  ["d-ytr", "یاسمن طاهری", "analyst", "Threat Intelligence"], ["d-bsh", "بابک شریفی", "analyst", "Threat Intelligence"], ["d-tml", "ترانه ملکی", "analyst", "Threat Intelligence"],
];
const COLORS = ["#5B6CF0", "#0E9F8E", "#D9822B", "#C2417A", "#2F80C9", "#7A5AF8", "#3D9970", "#B65C2E", "#6B7A8F", "#9C4DCC", "#1F8A70"];
const LEFT = { "d-mak": 75 }; // days before today this person left
const HEAVY = "d-ars";
const IDLE = "d-tml";

const TITLES = {
  SOC: [
    "بررسی هشدار نفوذ روی سرور ایمیل", "تحلیل لاگ فایروال شعبه مرکزی", "به‌روزرسانی Use Case شناسایی Brute-force", "بررسی رخداد فیشینگ گزارش‌شده",
    "تنظیم قانون همبستگی جدید در Splunk", "تحلیل ترافیک مشکوک DNS", "بررسی دسترسی غیرعادی VPN", "مستندسازی رخداد بدافزار ایستگاه کاری",
    "بازبینی هشدارهای مثبت کاذب IDS", "تحلیل Beaconing از شبکه داخلی", "بررسی تلاش ورود ناموفق به AD", "تکمیل گزارش رخداد هفتگی",
  ],
  "Design & Automation": [
    "اتوماسیون گزارش ترافیک روزانه", "توسعه اسکریپت جمع‌آوری IOC", "یکپارچه‌سازی MISP با SIEM", "طراحی داشبورد پایش در Grafana",
    "بازنویسی Playbook پاسخ به رخداد", "ساخت API داخلی برای فهرست سیاه", "مهاجرت Cron Jobها به Scheduler مرکزی", "افزودن تست به ماژول پارسر لاگ",
    "خودکارسازی بارگذاری فایل‌های IP مخرب", "بهینه‌سازی کوئری‌های Splunk", "توسعه ربات اعلان در بله", "مستندسازی معماری جمع‌آوری لاگ",
  ],
  "Threat Intelligence": [
    "گزارش تهدید گروه APT34", "تحلیل کمپین باج‌افزار جدید", "پایش فروم‌های زیرزمینی", "به‌روزرسانی پروفایل تهدید بخش بانکی",
    "استخراج IOC از گزارش CERT", "تحلیل آسیب‌پذیری‌های بحرانی هفته", "ارزیابی منابع فید تهدید", "تهیه بولتن تهدید ماهانه",
    "تحلیل دامنه‌های جعلی ثبت‌شده", "ردیابی زیرساخت فرماندهی و کنترل", "بررسی نشت اطلاعات در پیست‌بین", "به‌روزرسانی ماتریس MITRE ATT&CK",
  ],
};

const pick = (r, list) => list[Math.floor(r() * list.length)];
const weighted = (r, weights) => {
  const x = r() * weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (x < acc) return i; }
  return weights.length - 1;
};
function poisson(r, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L && k < 50);
  return k - 1;
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

const CX_W = { L1: [45, 35, 15, 5], L2: [30, 40, 22, 8], L3: [15, 35, 35, 15], "Design & Automation": [15, 30, 35, 20], "Threat Intelligence": [20, 40, 30, 10] };
const RATE = { L1: 0.22, L2: 0.28, L3: 0.34, "Design & Automation": 0.55, "Threat Intelligence": 0.5 };
const CYCLE = [0, 1.2, 2.6, 4.8, 8.5];
const DUE = [0, [2, 4], [4, 7], [6, 12], [10, 20]];
const ACT_DONE = [0.97, 0.93, 0.95, 0.92, 0.96, 0.94, 0.68, 0.9];
const EXTENDED = new Set([1, 3, 7]); // activity indexes (0-based) only on the extended (until 20:00) shift
const ROTA = [
  ["morning", "morning", "evening", "night", null, null, "morning"],
  ["night", null, "night", null, "morning", "evening", null],
];

/**
 * Builds demo facts for `today` limited to `window` and to the viewer's `scope`
 * ("department" for everyone, "soc" for SOC only).
 */
export function mockFacts({ today, window, scope = "department" }) {
  const r = prng(1405);
  const start = addDays(today, -400);
  const people = PEOPLE.map(([id, name, role, team], i) => {
    const { group, level } = teamParts(team);
    return { id, name, role, team, group, level, active: !LEFT[id], color: COLORS[i % COLORS.length], shift: role === "analyst" && !!level, manager: role === "soc_manager" };
  }).filter((p) => scope !== "soc" || p.group === "SOC");

  const tasks = [];
  let seq = 5000;
  const workday = (d) => weekdayIndex(d) <= 4 || (weekdayIndex(d) === 5 && r() < 0.3);
  const nextWorkday = (d, n) => { let x = d, k = 0; while (k < n) { x = addDays(x, 1); if (weekdayIndex(x) !== 6) k++; } return x; };

  for (const p of people) {
    if (p.manager) continue;
    const key = p.level ?? p.group;
    const leftAt = LEFT[p.id] ? addDays(today, -LEFT[p.id]) : null;
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (leftAt && d > leftAt) break;
      if (!workday(d)) continue;
      const ago = diffDays(d, today);
      let rate = RATE[key];
      if (p.group === "SOC") rate *= 1 + 0.35 * Math.max(0, (400 - ago) / 400);
      if (p.group === "SOC" && ago <= 21) rate *= 1.7;
      if (p.group === "Threat Intelligence" && ago <= 38) rate *= Math.max(0.35, ago / 38);
      if (p.group === "Design & Automation" && ago <= 40 && ago > 8) rate *= 1.35;
      if (p.id === HEAVY && ago <= 30) rate *= 2.4;
      if (p.id === IDLE && ago <= 14) rate = 0;
      const count = poisson(r, rate);
      for (let k = 0; k < count; k++) {
        const cx = weighted(r, CX_W[key]) + 1;
        const created = d;
        const started = r() < 0.92 ? nextWorkday(created, Math.floor(r() * 3)) : null;
        let cycle = CYCLE[cx] * Math.exp(0.45 * gauss(r));
        if (p.group === "Threat Intelligence" && ago <= 30) cycle *= 1.6;
        if (p.id === HEAVY && ago <= 30) cycle *= 2.2;
        if (p.group === "SOC" && ago <= 21) cycle *= 1.5;
        const span = Math.max(0, Math.round(cycle));
        // Approvals happen on working days: Friday moves to Saturday, most Thursdays too.
        let completed = started ? addDays(started, span) : null;
        if (completed && weekdayIndex(completed) === 6) completed = addDays(completed, 1);
        else if (completed && weekdayIndex(completed) === 5 && r() < 0.6) completed = addDays(completed, 2);
        const [lo, hi] = DUE[cx];
        const due = r() < 0.85 ? addDays(created, lo + Math.floor(r() * (hi - lo + 1))) : null;
        const returns = [];
        if (started && r() < 0.13) returns.push(addDays(started, Math.max(0, Math.floor(span * 0.6))));
        if (returns.length && r() < 0.2) returns.push(addDays(started, Math.max(0, Math.floor(span * 0.85))));
        const recentDA = p.group === "Design & Automation" && ago <= 40;
        const quality = ["excellent", "good", "acceptable", "needs"][weighted(r, recentDA ? [14, 38, 34, 14] : [30, 46, 19, 5])];
        const prio = ["low", "normal", "high", "critical"][weighted(r, [20, 55, 20, 5])];
        const hours = Math.max(0.5, Math.round(cx * (1.4 + r() * 2.6) * (p.group === "Design & Automation" ? 1.4 : 1) * 2) / 2);
        const cancelled = r() < 0.035;
        const t = { id: `T-${++seq}`, title: pick(r, TITLES[p.group]), a: p.id, prio, cx, due, hours, quality: null, created, started: null, completed: null, cycle: null, returns: [], blockedSince: null, reviewSince: null, closed: null, status: "todo" };
        if (leftAt && completed && completed > leftAt) continue; // left before finishing; their open work was reassigned
        if (cancelled) {
          t.status = "cancelled";
          t.closed = addDays(created, 1 + Math.floor(r() * 4));
          if (t.closed > today) { t.status = "todo"; t.closed = null; }
          tasks.push(t);
          continue;
        }
        if (started && started <= today) t.started = started;
        if (completed && completed <= today) {
          Object.assign(t, { status: "done", completed, closed: completed, cycle: Math.max(0.1, cycle), quality, returns: returns.filter((x) => x <= completed) });
        } else if (t.started) {
          t.returns = returns.filter((x) => x <= today);
          const x = r();
          if (x < 0.1) { t.status = "blocked"; t.blockedSince = addDays(today, -Math.floor(1 + r() * 7)); if (t.blockedSince < t.started) t.blockedSince = t.started; }
          else if (x < 0.32) { t.status = "review"; t.reviewSince = addDays(today, -Math.floor(r() * 5)); if (t.reviewSince < t.started) t.reviewSince = t.started; }
          else if (x < 0.38 && t.returns.length) t.status = "returned";
          else t.status = "progress";
        } else if (diffDays(created, today) > 12) {
          // Work that never started gets cancelled at a later planning review.
          Object.assign(t, { status: "cancelled", closed: addDays(created, 8 + Math.floor(r() * 5)) });
        } else {
          t.status = r() < 0.25 ? "backlog" : "todo";
        }
        tasks.push(t);
      }
    }
  }

  // Shifts: a seven-day rota per analyst; two analysts are on the night-heavy rota.
  const shifts = [];
  const tickets = [];
  const analysts = people.filter((p) => p.shift);
  analysts.forEach((p, i) => {
    const rota = ROTA[i === 2 || i === 9 ? 1 : 0];
    const leftAt = LEFT[p.id] ? addDays(today, -LEFT[p.id]) : null;
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (leftAt && d > leftAt) break;
      const type = rota[(diffDays(start, d) + i) % 7];
      if (!type) continue;
      const ago = diffDays(d, today);
      const past = d < today;
      const missedRecently = past && ((i === 1 && ago <= 3) || (i === 6 && ago === 2));
      const closed = past && !missedRecently && r() < 0.965;
      const log = closed || (past ? r() < 0.6 : r() < 0.7);
      const acts = Array.from({ length: 8 }, (_, a) => {
        if (!log || (EXTENDED.has(a) && type !== "evening")) return null;
        const base = ACT_DONE[a] - (p.level === "L1" ? 0.03 : 0) - (closed ? 0 : 0.35);
        return r() < base ? 1 : 0;
      });
      const done = acts.filter((v) => v === 1).length;
      const total = acts.filter((v) => v !== null).length;
      const iocRate = ago <= 21 ? 5.5 : 9;
      const iocs = acts[7] === 1 ? poisson(r, iocRate) : 0;
      const issues = acts.filter((v) => v === 1 && r() < 0.05).length;
      shifts.push({ a: p.id, date: d, type, log, closed, done, total, acts, iocs, report: acts[3] === 1, issues });
      if (log) {
        const lambda = (type === "night" ? 2.2 : 1.5) * (ago === 6 ? 3.2 : 1);
        const n = poisson(r, lambda);
        if (n) tickets.push({ a: p.id, date: d, n });
      }
    }
  });

  const inWindow = (d) => d >= window.from && d <= window.to;
  return {
    version: 1,
    demo: true,
    today,
    generatedAt: new Date().toISOString(),
    window,
    scope: { kind: scope },
    people,
    tasks: tasks.filter((t) => t.created <= window.to && (!t.closed || t.closed >= window.from)),
    shifts: shifts.filter((s) => inWindow(s.date)),
    tickets: tickets.filter((t) => inWindow(t.date)),
    peers: null,
  };
}
