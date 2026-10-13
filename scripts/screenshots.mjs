// Visual QA: signs in as each role and saves a full-page screenshot of every route, per theme, language and size.
// Not part of the test suite; run it against a server started on a demo database (npm run seed:demo):
//   node scripts/screenshots.mjs --base http://localhost:3000 --out .screenshots/pass-1 [--langs fa,en] [--themes light,dark]
//     [--sizes 1440,1920,390] [--roles analyst,soc,security] [--only /dashboard,/tasks/my] [--density comfortable]
// Screenshots go to a git-ignored folder; curated ones are copied to design/redesign/ by hand.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const BASE = args.base ?? "http://localhost:3000";
const OUT = args.out ?? ".screenshots/pass";
const list = (v, d) => (v ? v.split(",").filter(Boolean) : d);
const LANGS = list(args.langs, ["fa"]);
const THEMES = list(args.themes, ["light", "dark"]);
const SIZES = list(args.sizes, ["1440"]).map(Number);
const ROLES = list(args.roles, ["analyst", "soc", "security"]);
const ONLY = list(args.only, null);
const DENSITY = args.density ?? "";
const KEY_PAGES = new Set(list(args.key, ["/dashboard", "/tasks/my", "/tasks/assigned", "/analytics", "/shift", "/insights"]));

const ACCOUNTS = {
  analyst: { email: "sara.rahimi@demo.invalid", password: "Demo-2026!" },
  soc: { email: "leila.nouri@demo.invalid", password: "Demo-2026!" },
  security: { email: "admin@demo.invalid", password: "Demo-Admin-2026!" },
};

const ROUTES = {
  analyst: ["/dashboard", "/tasks/my", "/tasks/team", "@task", "/shift", "/shift/history", "/shift/schedule", "/shift/changes",
    "/analytics", "/performance/employees", "/reports/employee", "/reports/tickets", "/team", "/account", "/nope"],
  soc: ["/dashboard", "/tasks/assigned", "/tasks/team", "/tasks/my", "@task", "/shift/schedule", "/shift/changes", "/shift/manage", "/shift/checklists",
    "/analytics", "/analytics/teams", "/analytics/teams?team=soc", "/analytics/people", "/analytics/compare", "/analytics/trends", "/analytics/soc", "/analytics/alerts", "/analytics/report",
    "/analytics/people/dsr", "/performance/overview", "/performance/employees/dsr", "/reports/team", "/reports/task", "/reports/shift", "/team", "/admin", "/account"],
  security: ["/dashboard", "/tasks/assigned", "/tasks/team", "@task", "/analytics", "/analytics/teams", "/analytics/people", "/analytics/compare", "/analytics/report",
    "/performance/overview", "/reports/team", "/reports/task", "/team", "/admin"],
};

const slug = (p) => (p === "/" ? "root" : p.replace(/^\//, "").replace(/[/?=&]+/g, "_"));

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let shots = 0;
  const problems = [];
  for (const role of ROLES) {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        for (const width of SIZES) {
          const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 960 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
          await context.addInitScript(([t, l, d]) => {
            try { localStorage.setItem("so.theme", t); } catch {}
            document.cookie = `so_lang=${l}; path=/`;
            if (d) document.cookie = `so_density=${d}; path=/`;
          }, [theme, lang, DENSITY]);
          await context.addCookies([{ name: "so_lang", value: lang, url: BASE }, ...(DENSITY ? [{ name: "so_density", value: DENSITY, url: BASE }] : [])]);
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
          const login = await page.request.post(`${BASE}/api/auth/login`, { data: ACCOUNTS[role] });
          if (!login.ok()) throw new Error(`Sign-in failed for ${role}: ${login.status()}`);
          const tasks = (await (await page.request.get(`${BASE}/api/tasks`)).json()).tasks ?? [];
          const own = tasks.find((t) => ["progress", "review"].includes(t.status)) ?? tasks[0];
          for (let route of ROUTES[role]) {
            if (route === "@task") route = own ? `/tasks/${own.id}` : "/tasks";
            if (ONLY && !ONLY.includes(route)) continue;
            if (width !== 1440 && !KEY_PAGES.has(route.split("?")[0])) continue;
            errors.length = 0;
            await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch((e) => errors.push(String(e)));
            await page.waitForTimeout(500);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            if (overflow > 1) problems.push(`${role} ${lang} ${theme} ${width} ${route}: horizontal scroll ${overflow}px`);
            if (errors.length) problems.push(`${role} ${lang} ${theme} ${width} ${route}: ${errors.slice(0, 3).join(" | ")}`);
            const dir = path.join(OUT, `${lang}-${theme}-${width}${DENSITY ? `-${DENSITY}` : ""}`, role);
            fs.mkdirSync(dir, { recursive: true });
            await page.screenshot({ path: path.join(dir, `${slug(route)}.png`), fullPage: true });
            shots += 1;
          }
          await context.close();
        }
      }
    }
  }
  if (ROLES.length && !ONLY) {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
        await context.addInitScript((t) => { try { localStorage.setItem("so.theme", t); } catch {} }, theme);
        await context.addCookies([{ name: "so_lang", value: lang, url: BASE }]);
        const page = await context.newPage();
        await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
        const dir = path.join(OUT, `${lang}-${theme}-1440`);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, "login.png"), fullPage: true });
        shots += 1;
        await context.close();
      }
    }
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "problems.txt"), problems.join("\n"));
  console.log(`${shots} screenshots in ${OUT}; ${problems.length} problem(s) noted in problems.txt`);
}

run().catch((e) => { console.error(e); process.exit(1); });
