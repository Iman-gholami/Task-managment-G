# Sentinel Ops redesign: plan and working log

> Source of truth: [`REDESIGN_BRIEF.md`](REDESIGN_BRIEF.md). This file is the plan, the progress log and the Decisions log.
> **After any restart:** re-read the brief and this file, then continue from the first unchecked item in §9.

---

## 1. Audit (baseline on `main` @ d725b91)

Baseline: `npm ci`, `npm run build`, demo data from `npm run seed:demo` (written first, so the baseline had realistic
data), screenshots of every route for an analyst, a SOC Manager and a Security Manager in Daylight and Graphite at
1440 px, and the key pages at 1920 and 390 px (`node scripts/screenshots.mjs`, saved to the git-ignored `.screenshots/baseline/`).

What the baseline shows, beyond the eleven problems listed in the brief:

| # | Finding | Where |
|---|---|---|
| A1 | Mixed Persian/Latin user content renders out of order in the LTR shell ("بررسی تلاش ورود ناموفق به AD" shows "AD" first) because nothing sets `dir="auto"`. | task tables, attention list, board, task details |
| A2 | The content area scrolls inside a fixed-height shell, so phones keep the address bar and full-page captures are clipped. | `styles/shell.css` |
| A3 | The SOC Manager and Security Manager dashboards stop at ~60% of a 1440 px screen; at 1920 px the content is a centred 1440 px column with empty margins on both sides. | dashboards, task lists |
| A4 | Stored activity texts (`task_events.text`, checklist audit `detail`) are English sentences, shown as is. | task details, checklists history |
| A5 | API errors are English sentences shown verbatim in toasts and form alerts (in Persian screens too). | every form |
| A6 | Three independent Jalali implementations: `lib/analytics/calendar.js` (jalaali), `Intl` `fa-IR-u-ca-persian` in Shift Schedule and Shift changes, plus three separate date pickers (native, analytics range, shift mini calendar). | |
| A7 | "Create another" exists in the spec but not in the create modal; the modal ships its own `<style>` block. | `CreateTaskModal.js` |
| A8 | `@mention` highlighting only matches capitalised Latin names; Persian names are never highlighted. | `TaskDetail.js` |
| A9 | 128 physical CSS properties (`margin-left`, `left:`, `text-align: right`…) and per-screen RTL overrides in `rtl.css`. | `styles/`, CSS modules |
| A10 | Performance and Reports have their own period model (`this|last|quarter|custom`, Gregorian) next to the Jalali analytics periods. | `lib/period.js`, `lib/server/stats.js` |

Everything else in "Already good" in the brief was confirmed and is kept.

## 2. String inventory

Heuristic count of user-facing literals (JSX text, quoted sentences) per area, from a script over `app/`, `components/`, `lib/`:

| Area | English | Persian | Notes |
|---|---:|---:|---|
| Shell (`AppShell`, `Sidebar`, `Topbar`, `CommandMenu`, `nav.js`) | ~110 | ~6 | breadcrumbs, menus, shortcuts dialog |
| Tasks (`Tasks`, `TaskTable`, `TaskDetail`, `CreateTaskModal`, `menus`, `indicators`) | ~230 | 0 | |
| Dashboards (3 + `Attention`, `TeamComparison`) | ~110 | 0 | |
| Shift Log, history, corrections | ~125 | ~3 | |
| Shift Schedule, Shift changes | ~11 | ~125 | Persian islands |
| Shift checklists (`ShiftChecklists`, `lib/checklists.js`, `shift-checklists.js`) | ~190 | 0 | validation messages are server-side too |
| Performance, Reports (+ charts) | ~180 | 0 | merged into Insights |
| Analytics screens and blocks | ~200 | ~520 | Persian only |
| `lib/analytics/*` (labels, periods, calendar, alerts, insights, metrics, mock) | ~50 | ~250 | sentences built in code |
| Excel exports (`lib/server/reports.js`, `analytics-export.js`) | ~55 | ~175 | analytics workbook is Persian, reports English |
| Team, Admin, Account, Login, 404/error | ~200 | 0 | |
| API errors (`app/api/**`, `lib/server/*`) | ~190 | 0 | become `{ error, code, params }` |
| **Total** | **~1,650** | **~1,200** | ≈ 1,400 distinct keys after de-duplication (estimate) |

Every one of these moves into `lib/i18n/messages/{fa,en}.js` as each screen is rebuilt (phases 1–6). The dictionary test
(§3.1) keeps both languages in step from the first key on; a source scan (phase 8) fails the build on any remaining
hard-coded UI text.

## 3. Architecture

### 3.1 i18n (`lib/i18n/`)

- `config.js`: `LOCALES = ["fa", "en"]`, `DEFAULT_LOCALE = "fa"`, `dirOf(locale)`, cookie names (`so_lang`, `so_density`).
- `messages/fa.js`, `messages/en.js`: nested objects, one per locale, same shape. Plural entries are `{ one, other }`
  (CLDR categories from `Intl.PluralRules`). Values may contain `{param}` placeholders.
- `index.js`: `createT(locale)` → `t(key, params)`. Numbers in `params` are formatted for the locale (Persian digits in
  `fa`, grouping, tabular in CSS), plurals choose by `params.count`. Missing keys return the key (and warn in dev).
  Pure module: works in server components, route handlers, client components, `lib/analytics/*` and Node tests.
  Both dictionaries are bundled (≈ 15 KB gzip each); switching language reloads the page.
- `components/i18n.js`: `I18nProvider` (locale, density) and `useT()` → `{ t, locale, dir, fmt }`.
- `lib/i18n/format.js`: locale-aware numbers, digits (`toLocaleDigits`, `normalizeDigits` for Persian/Arabic-Indic
  input), dates and periods (see 3.3), relative time (`Intl.RelativeTimeFormat`, rendered with
  `suppressHydrationWarning` and the absolute date in a tooltip).
- **Resolution:** signed-in user's saved preference → `so_lang` cookie → `fa`. The root layout reads it on the
  server and renders `<html lang dir data-density>`; nothing flashes. Saved per user in `users.locale` / `users.density`
  (additive columns), mirrored in cookies. The sign-in page switch sets the cookie and is saved on sign-in.
- **API messages:** every error response keeps `error` (English, unchanged for scripts) and adds `code` (+ `params`);
  the client shows `t("errors.<code>", params)` and falls back to `error`.
- **Stored English texts** (task activity, checklist audit) are parsed at display time into keys (`lib/i18n/events.js`);
  storage does not change, so old rows localize too.
- **Tests** (`tests/i18n.unit.test.mjs`): same keys in both locales; no key used in code is missing; no key is unused
  (dynamic families like `status.*` are declared once); `en` has no Persian letters; `fa` strings contain Persian except
  for an allow-list of product names and acronyms (SOC, IOC, MISP, Excel…); placeholders match across locales.

### 3.2 Direction and type

- `<html dir>` drives everything; per-page `dir="rtl"` islands are removed. All CSS uses logical properties
  (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Directional icons (`chev`, arrows, side panel) get
  `.i-dir` and flip with `[dir=rtl] .i-dir { scale: -1 1 }`; nothing else is mirrored.
- Arrow keys follow the visual direction (Segmented, board keyboard drag, theme chooser, date grid).
- Mixed content: user text has `dir="auto"`; IDs, ticket numbers, IPs, hashes, emails and references use
  `<bdi class="mono">` / `.ltr` (`unicode-bidi: isolate; direction: ltr`) with Latin digits.
- Fonts: Vazirmatn (variable woff2, OFL) self-hosted next to Geist with `next/font/local`; `lang=fa` →
  Vazirmatn first, `lang=en` → Geist first with Vazirmatn as fallback for Persian names. No network at build or run time.
- `styles/rtl.css` becomes `styles/locale.css`: the `fa` type layer (`:root[lang=fa]` redefines `--type-*`).

### 3.3 Calendars, numbers, periods

- One module, `lib/i18n/dates.js`, on top of the existing jalaali math (`lib/analytics/calendar.js`): Jalali for `fa`,
  Gregorian for `en`; month/day names per locale; week starts on Saturday and Friday is the weekend in both.
  Timestamps display in Asia/Tehran.
- `lib/analytics/periods.js` gains a calendar argument (`jalali` | `gregorian`): month, previous month, season/quarter,
  year and their previous units resolve in that calendar. Presets write explicit ISO `from`/`to` plus `cal` to the URL,
  so a shared link gives the same numbers to an `fa` and an `en` viewer; the label falls back to the exact range when the
  viewer's calendar differs. The exact range is always shown next to the preset.
- One date picker (`components/ui/DatePicker.js`): single date and range, Jalali grid in `fa`, Gregorian in `en`,
  Saturday-first, keyboard grid navigation (arrows follow direction, PageUp/PageDown months, Home/End week), min/max,
  digit-tolerant text entry. Replaces native date inputs, the analytics range calendar and the shift mini calendars.

### 3.4 Tokens and visual language

- New token groups in `styles/tokens.css`, defined in every theme: elevation `--elev-0…4` (shadow + top highlight +
  border), glass (`--glass-bg`, `--glass-border`, `--glass-highlight`, `--glass-blur`, `--glass-sat`), ambient aurora
  (`--aurora-1…3`, grain), signature gradients (`--grad-signal`, `--grad-border`, `--grad-progress`), chart series
  (`--series-focus`, `--series-area-from/to`), density (`--row-h`, `--ctl-h`, `--ctl-h-sm`, `--pad-card`, `--gap`).
- Glass only on chrome and overlays (sidebar, top bar, sticky toolbars and filter bars, ⌘K, popovers, dialogs, side
  peek, toasts) with solid fallbacks under `@supports not (backdrop-filter)` and `prefers-reduced-transparency`.
- `data-density="comfortable|compact"` on `<html>`; only tokens change (rows 40 → 32, controls 32 → 28).
- Motion tokens: `--t-press 120ms`, `--t-fast 160ms`, `--t-panel 260ms`, springs; React `ViewTransition` crossfade on
  route changes (React 19.3 ships it; Next 16 activates it on navigation); everything off under reduced motion.
- `scripts/palette.mjs` checks the new pairs (text on glass over the worst-case aurora, gradient label colours,
  focus ring) in all four themes; the contrast table in `DESIGN_SYSTEM.md` is regenerated from it.
- Layout: a fluid 12-column page grid for data pages up to 2560 px (`.page.wide`), reading pages and forms keep a
  720–960 px measure; the document scrolls (sticky glass sidebar and top bar) instead of an inner scroller.

### 3.5 New components (`components/ui/`)

`DatePicker`, `Drawer`/`SidePeek` (shared panel), `Toast` with action (Undo), `Ring` (progress ring), `CountUp`,
`KpiCard` (merges `Metric` and analytics `Kpi`), `Sparkline`, `Timeline`, `Avatar`/`PersonPicker` (search, workload),
`BulkBar`, `EmptyState` with SVG illustrations, `Kbd`, `LocalTime`/`RelTime`, `LangSwitch`, `DensitySwitch`,
`SegmentedTabs` with overflow scroll and fades.

### 3.6 Data and API changes (all additive)

| Change | Where |
|---|---|
| `users.locale`, `users.density` (nullable TEXT) | `lib/server/db.js` migrate |
| `notifications` (id, user_id, type, params JSON, actor_id, target, created_at, read_at) + index | new table |
| `saved_views` (id, user_id, scope, name, state JSON, created_at, updated_at) | new table |
| `user_onboarding` (user_id, key, value, updated_at) for checklist and welcome dismissal | new table |
| `GET/PUT /api/account/preferences` | new |
| `GET /api/notifications`, `POST /api/notifications/read` | new |
| `POST /api/tasks/bulk` (per-item results, same rules as PATCH) | new; PATCH logic moves to `lib/server/task-actions.js` |
| `GET/POST/PATCH/DELETE /api/views` | new |
| `GET /api/activity` (recent events and mentions on my tasks) | new, for the analyst dashboard |
| `GET/PUT /api/onboarding` | new |
| Every error response gains `code` (+ `params`) | all routes |
| Exports take `lang` and follow the requester's language (fa workbooks RTL) | reports, analytics export |

A unit test opens a database created by the current `main` schema (built with `main`'s SQL in the test) and checks the
app starts, migrates idempotently twice and keeps every row.

## 4. Insights: capability inventory and new home

Base route stays `/analytics` (tab frame and URL filters already exist).

### 4.1 Inventory

| Today | Capability | New home |
|---|---|---|
| `/analytics` | status banner, 6 KPIs with change + sparkline, alerts (5), insights (4), work in/out chart (+prev, table, CSV/PNG), team table (sortable, row → team), complexity mix and quality mix (stacked) | **Overview** (unchanged content, new visuals) |
| `/analytics/teams` | team cards, per-capita bars (metric switch, median line), per-capita trend, open-work strip per person (click → drawer), complexity and quality mixes, full team table; `?team=` detail: trail, 6 KPIs, flow chart, level bars (L1–L3 filter), member table (→ drawer), per-person mix | **Teams** |
| `/performance/overview` | 5 department totals, delivery-mix donut (6 months by team), team output (completed, hours), workload health (active, overdue), department complexity mix, people table (tasks, hours, complexity mix, shift logs, routine %, IOCs, tickets, n/a for non-SOC), search, Excel (team report) | totals → **Overview** KPIs; donut, output and workload → **Teams** ("Share of completed work by team", workload columns); people table → **People** (adds complexity mix column, n/a for non-SOC); Excel → **Reports & exports** |
| `/analytics/people` | sortable people table (17 columns, sparkline), search, distribution strip (metric switch, click → drawer), drawer (`?person=`) with figures, trend, open work, profile + Excel links | **People** (+ complexity mix column and "Performance" columns from the overview) |
| `/analytics/people/<id>` | trail, 6 KPIs (vs previous + team median), comparison table, completed and hours trends, complexity and quality mix, SOC section (6 KPIs, routine calendar heatmap, daily IOC and tickets, per-activity rates), open and completed task tables, person Excel | **Person profile** (one page for everyone) |
| `/performance/employees/<id>` | employee selector, 5 KPIs (completed, hours, shift logs completed/started, IOCs, tickets with popover list → ticket report), work profile donuts (complexity, quality), delivery cadence bars, routine meters and volume bars, routine panel (completion %, logs, traffic reports, issues, IOCs per shift), task performance table (description, complexity, quality, started, completed, hours), Excel (employee report), daily logs link | merged into **Person profile**: person switcher (managers), "Tickets" KPI with list → tickets report, logs started/completed stat, IOCs per shift chart, task table gains description and started columns, export menu adds "Employee monthly report (Excel)", "Daily logs" link for the analyst. Routine activity (Shift Logs) and task performance stay in two clearly separate sections. |
| `/analytics/compare` | people / teams / periods (≤ 4), small multiples, trend of a chosen metric, role/level warning, same-level activity ranking (`PeerLeaderboard`) | **Compare** (ranking stays only here) |
| `/analytics/trends` | metric × breakdown (all / team / level), previous period line, backlog over time, weekday averages, 12-month calendar heatmap | **Trends** |
| `/analytics/soc` | 6 KPIs, missed logs, activity × analyst heatmap (→ drawer), activity completion, shift-type mix, daily IOC and tickets, analyst table | **SOC operations** |
| `/analytics/alerts` | status, alerts by level (tabs), insights, the rules with live thresholds | **Alerts & insights** |
| `/analytics/report` | executive report: header, status, KPIs, insights, actions needed, flow chart, team table, full mode (people), suggested actions, manager notes (local), print (light theme) | **Executive report** |
| `/reports/<key>` | 5 reports (employee, team, task, shift, tickets): own filters (employee, team, status, complexity, quality, search), preview tables with pagination (100), summary row, Excel export with the same filters; analysts get their own data and no team report | **Reports & exports** `/analytics/reports/<key>` with the shared period |
| frame | header (scope, period, update time), refresh, demo data toggle + banner, presentation mode, export menu (full, teams, person, print, report), tabs, sticky filter bar (period presets + Jalali range, comparison, team, level, unit, more filters drawer: role, priority, complexity, quality, shift type; chips; reset), print footer, CSV/PNG per chart, chart/table toggle | **One frame** for the whole section, glass sticky filter bar, one period system (§3.3) |
| sidebar "My statistics", "My performance", "Reports" (non-managers) | own figures, team medians when ≥ 3 colleagues, own reports | **My stats** (`/analytics/people/<me>`) + **Reports** tab (employee, task, shift, tickets for themselves) |

### 4.2 Tabs

- Managers: Overview · Teams · People · Compare · Trends · SOC operations · Alerts & insights · Reports & exports · Executive report.
- Everyone else: My stats · Reports.

### 4.3 Redirects (role-aware, query kept)

| Old | New |
|---|---|
| `/performance`, `/performance/overview` | managers `/analytics/people`; others `/analytics/people/<me>` |
| `/performance/employees` | managers `/analytics/people`; others `/analytics/people/<me>` |
| `/performance/employees/<id>` | `/analytics/people/<id>` (others: their own) |
| `/reports` | `/analytics/reports/employee` |
| `/reports/<key>` | `/analytics/reports/<key>` (`?user=` kept) |
| `/shift/team`, `/shift/view` | `/analytics/reports/shift` |

## 5. Dashboards, tasks and other screens

As in brief §5.5–5.7. Notes on data:
- Analyst "Today": shift window from `lib/shifts.js`, live progress against the clock (Tehran), Shift Log ring from the
  app state, next deadline from tasks, timeline = shift start/end + today's deadlines + today's review events
  (`/api/activity`), mentions = `mention` notifications, personal trends from the analytics facts (self scope).
- SOC Manager "Right now": today's schedule (`/api/shift/schedule?from=today&to=today`) joined with
  `/api/shift/team` (log progress), open swap requests, reviews waiting.
- Security Manager: one card per team from the analytics facts (`openStats` + weekly completed sparkline).

## 6. Recommended feature set (decision 14)

Notification center (stored, typed, localized) → task features (side peek, bulk, board DnD, undo, saved views) →
onboarding (admin checklist, member welcome) → manifest → stretch: customisable dashboards.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Scope: ~1,400 strings and every screen. | Screens are rebuilt once, strings move as each is rebuilt; dictionary test from day one. |
| Breaking existing e2e tests. | Pin old specs to `en` with a cookie; change selectors only where copy deliberately changed; add new specs. |
| Hydration mismatches (relative time, locale). | Locale comes from the server; relative times use `suppressHydrationWarning`; "now" never in SSR output otherwise. |
| ECharts and RTL. | Charts keep the LTR drawing box with direction-aware layout; labels wrapped in bidi embeddings only for `fa`. |
| Glass performance on long tables. | Glass only on chrome/overlays; tables solid; `backdrop-filter` off for reduced transparency. |
| Data safety. | Additive migrations only, idempotent, unit-tested on a `main`-created database; demo seed refuses non-empty databases. |
| View transitions vs. the theme reveal. | Both use the View Transitions API; route crossfade is skipped while a theme reveal runs and under reduced motion. |

## 8. Decisions log

| # | Decision | Why |
|---|---|---|
| D1 | Work happens on the session branch `claude/gifted-volta-x9gtqk` (the environment only allows pushing there); it is pushed under that name. | Brief §6 names `redesign/bilingual-ui-ux`; the hosting environment fixes the branch name. Content and process are unchanged (one branch, never merged). |
| D2 | Demo seed written before the baseline so the baseline screenshots had realistic data. | Brief §6.3 asks for realistic demo data at baseline. |
| D3 | Both dictionaries are bundled; switching language reloads the page. | Simplest correct way to change `<html lang dir>`, fonts and calendars; it is a rare action. |
| D4 | Stored English activity texts are localized at display time by parsing their fixed grammar; storage is unchanged. | No data rewrite; old rows localize too. |
| D5 | Period presets write explicit `from`/`to` (+ `cal`) to the URL. | Brief §5.1: shared links give the same numbers in both languages. |
| D6 | Full Vazirmatn variable font (with its Latin glyphs) rather than the non-Latin subset. | Persian lines that contain Latin terms keep one rhythm; 111 KB is acceptable. |
| D7 | Undo for reversible edits; confirmation for irreversible moves made from menus, drag and drop or bulk. Explicit labelled buttons on the task page (Start, Submit for review, Resume) act directly; Approve keeps its quality picker. | Confirmation on every "Start" would slow the most common action; labelled buttons are already deliberate. |
| D8 | Bulk status changes never approve (approval needs a per-task quality rating). | Single review with a quality rating is a business rule. |
| D9 | The document scrolls; sidebar and top bar are sticky glass. | Phones (address bar), full-page capture, smoother large-monitor layout. |
| D10 | No new runtime dependencies so far (drag and drop, date picker, i18n are in-house). | Offline, small, fully controlled. |

## 9. Phases

Each phase ends with `npm run test:unit`, `npm run build`, `npx playwright test`, a screenshot pass, an update here and a commit.

### P0 Setup
- [x] Brief committed (`design/REDESIGN_BRIEF.md`)
- [x] `npm run seed:demo` (empty databases only, `@demo.invalid`, prints sign-in details)
- [x] `scripts/screenshots.mjs` (roles × languages × themes × sizes, overflow and console checks)
- [x] Baseline screenshots (git-ignored `.screenshots/baseline/`)
- [x] This plan

### P1 Foundation
- [ ] i18n core (`lib/i18n`), provider, dictionary test
- [ ] Locale + density resolution on the server, `<html lang dir data-density>`, preferences API and columns
- [ ] Fonts: Vazirmatn local, locale font stacks; build offline
- [ ] Dates/numbers/periods module (Jalali/Gregorian), digit normalisation, relative time; unit tests
- [ ] Tokens: elevation, glass, aurora, gradients, density, motion; four themes re-tuned; `palette.mjs` extended
- [ ] Logical CSS everywhere; `rtl.css` → `locale.css`; icon mirroring
- [ ] Core UI primitives restyled + new ones (DatePicker, Ring, CountUp, KpiCard, toasts with action, SidePeek)
- [ ] API error codes + client localization
- [ ] Existing e2e pinned to their old locale; migration test on a `main` database

### P2 Shell, navigation, IA, notifications
- [ ] Glass sidebar (right in `fa`), rail, groups, count pills, gradient marker
- [ ] Top bar: breadcrumbs, ⌘K, notification bell with count, language/density/theme quick access
- [ ] ⌘K bilingual, recent items, people, settings actions
- [ ] Notifications table, writers at every event, API, center (popover + page), polling
- [ ] Page header pattern; route view transitions

### P3 Insights
- [ ] Merged frame + tabs + one filter bar + period system
- [ ] Overview, Teams, People, Person profile (merged), Compare, Trends, SOC, Alerts, Executive report
- [ ] Reports & exports (5 reports) under `/analytics/reports`
- [ ] My stats for non-managers; redirects; exports follow language

### P4 Dashboards
- [ ] Analyst (Today hero, timeline, queue, mentions/activity, trends)
- [ ] SOC Manager (right-now strip, attention with inline actions, workload, log completion, mini trends)
- [ ] Security Manager (team cards, queues, Insights links)

### P5 Tasks
- [ ] Table refresh (sticky glass header, hover actions, column visibility, grouping, tabs on phones)
- [ ] Side peek, J/K, URL state
- [ ] Board drag and drop (pointer + keyboard, workflow-aware, RTL)
- [ ] Bulk actions with per-item results
- [ ] Saved views; undo; task details; create task (person picker, deadline chips, create another)

### P6 Remaining screens
- [ ] Shift Log (one control per item, J/K), history, corrections, checklists
- [ ] Shift Schedule and Shift changes (calendar per language)
- [ ] Team, Administration, Account › Preferences, sign-in, 404/error/loading, `/states`

### P7 Onboarding, installable app, polish, stretch
- [ ] Admin first-run checklist; member welcome; empty-state illustrations
- [ ] Web app manifest and icons
- [ ] Polish pass; stretch: customisable dashboards

### P8 QA, docs, handoff
- [ ] Full visual QA matrix; accessibility and RTL audit; hard-coded string scan
- [ ] Docs: README, DESIGN_SYSTEM, SCREENS, ANALYTICS, GLOSSARY
- [ ] Curated screenshots in `design/redesign/`; push; draft PR if possible; Persian handoff message

## 10. Progress log

- **P0** — brief, seed, screenshot tool, baseline, plan.
