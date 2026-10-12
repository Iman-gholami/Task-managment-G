# Sentinel Ops: bold bilingual UI/UX redesign

> **First action:** create the branch (§6). Make sure this brief is saved verbatim at `design/REDESIGN_BRIEF.md` (create the file if I pasted the brief to you) and commit it. It is the source of truth for the whole job. Whenever your context is compacted or a new session starts, re-read this file and `design/REDESIGN_PLAN.md` before doing anything else.

## 1. Role and goal

Act as a senior product designer and a senior front-end engineer on this repository: **Sentinel Ops**, the internal tool of a Security Department in Iran (tasks with a review workflow, SOC shift logs and schedules, performance, analytics and Excel reports).

Redesign it boldly so it looks and feels premium and modern and is much easier and faster to use, while every existing capability, business rule, permission and number keeps working exactly as it does today.

Work autonomously end to end: audit → plan → implement → test → document → hand off. Do not stop to ask me questions. When something is ambiguous, choose what best fits §2, record it in the Decisions log of the plan, and continue. The only reason to stop is a change that could delete or corrupt existing data.

## 2. Decisions already made (do not revisit)

| # | Topic | Decision |
|---|---|---|
| 1 | Scope | Bold redesign: new visual language and UX. Data semantics, business rules, permissions and metric definitions stay. |
| 2 | Language | Bilingual, Persian (`fa`, RTL) and English (`en`, LTR), switchable per user. |
| 3 | Default language | Persian. |
| 4 | Calendar | Follows the language: `fa` → Jalali with Persian digits, `en` → Gregorian. |
| 5 | Visual style | Modern and detailed: glass surfaces, gradients, real depth, richer motion. |
| 6 | Motion | Detailed but fast. It never slows anyone down; reduced motion turns it off. |
| 7 | Themes | Keep Daylight, Graphite, Black Gold and Midnight; re-tune all four for the new style. |
| 8 | Density | User-selectable: Comfortable and Compact. |
| 9 | Devices | Desktop and large monitors first (1440–2560 px). Phones must still work. |
| 10 | Priorities | 1) Insights (analytics, performance, reports) 2) Dashboards 3) Tasks, then everything else. |
| 11 | Insights IA | Merge Analytics, Performance, Reports, "My statistics" and "My performance" into one section with tabs. |
| 12 | Backend | Allowed, including new tables, through safe additive migrations. |
| 13 | Ranking | As today: statistics without judgement; the same-level activity ranking stays in Compare only. |
| 14 | New features, dashboard content | No preference from me: build the recommended set in §5.5 and §5.8. |
| 15 | Delivery | Everything on ONE branch. I test locally and merge myself. |

## 3. Current state

**Stack:** Next.js 16.3 (App Router, Turbopack) · React 19.3 · JavaScript · plain CSS by layer in `styles/` plus a few CSS modules · ECharts 6 · exceljs · SQLite via `node:sqlite` · Playwright e2e and Node unit tests · Node ≥ 22.13.

**Read first:** `AGENTS.md` (Next.js 16 has breaking changes; check `node_modules/next/dist/docs/` before using any Next API), `README.md`, `design/DESIGN_SYSTEM.md`, `design/SCREENS.md`, `design/ANALYTICS.md`, `design/SHIFT_CHECKLISTS.md`.

**Where things live:** tokens and themes in `styles/tokens.css`, `lib/themes.js`, `components/theme.js`, `components/ThemePicker.js`; contrast checks in `scripts/palette.mjs` · styles in `styles/*.css` (`rtl.css` holds the Persian type layer) · primitives in `components/ui/` · shell in `components/shell/` (`AppShell`, `Sidebar`, `Topbar`, `CommandMenu`, `nav.js`) · screens in `components/screens/`; analytics in `components/analytics/` and `lib/analytics/` (Jalali math in `calendar.js`, Persian vocabulary in `labels.js`) · English labels and date formatting in `lib/format.js` · rules in `lib/roles.js`, `lib/workflow.js`, `lib/server/access.js`, `lib/server/analytics-access.js` · migrations in `lib/server/db.js`.

**Already good, keep and build on it:** semantic tokens with checked contrast, four themes with a view-transition reveal, the ⌘K command menu, keyboard shortcuts (`C`, `?`, `J/K/Enter/S/P`), skeleton, empty and error states, Shift Log autosave with rollback, focus management, and the analytics engine (URL filters, like-for-like comparisons, exports, demo data, executive report, print).

**Problems found by running the app as every role on desktop and phone:**
1. Two languages, two directions, two calendars. The shell, tasks, Shift Log, performance, reports, team, admin, account and sign-in are English, LTR and Gregorian. Shift Schedule, Shift changes and Analytics (including "My statistics") are Persian, RTL and Jalali inside the English shell. Notifications mix both. `app/layout.js` hard-codes `lang="en"`; the Persian pages are `dir="rtl"` islands.
2. Overlapping insights: `/analytics` (fa), `/performance/*` (en) and `/reports/*` (en). Non-managers get both "My statistics" and "My performance".
3. The analyst dashboard leaves half the screen empty.
4. Every Shift Log item has two controls for one action (a checkbox and "Mark done").
5. The task board has no drag and drop. There is no multi-select or bulk action (SCREENS.md §6 describes one). Opening a task always leaves the list.
6. Notifications are derived in the browser from the loaded tasks (`Topbar.js`): not stored, no read/unread, no history, a dot without a count.
7. A fresh install shows one admin and empty screens, with no onboarding.
8. Letter shortcuts compare `event.key` (`AppShell.js`), so `C`, `⌘K`, `J` and `K` do nothing on a Persian keyboard layout.
9. Vazirmatn is loaded with `next/font/google`. On this internal, offline network the build cannot reach Google Fonts and Persian text silently falls back to Tahoma/Arial.
10. `lib/format.js` hard-codes English month and day names; API errors are English sentences.
11. On phones the task status tabs overflow the screen.

## 4. Guardrails

- **Rules don't change.** Task workflow, roles and scopes, the single review with a quality rating, locked approved tasks, Shift Log locking and manager corrections, checklist versioning and metric definitions stay exactly as they are. The server stays the authority; the UI only offers allowed actions. New endpoints use `requireUser` and the existing access helpers; bulk endpoints check every item.
- **Data is safe.** Migrations are additive and idempotent, in the style of `lib/server/db.js`. Never drop or rename columns or rewrite history. The app must start cleanly on a database created by the current `main` (add a unit test for it). Stored values (statuses, roles, team names like `SOC · L1`) are never translated in the database; translate them at display time.
- **User content is never translated.** Task titles, descriptions, comments and checklist item titles render as typed, with `dir="auto"`.
- **The styling architecture stays.** Semantic tokens, layered CSS and CSS modules, primitives in `components/ui/`. No CSS framework, no component-library migration, no TypeScript migration. Add a dependency only if it is small, maintained, works offline and clearly earns its place; justify each one in the plan.
- **Offline.** No requests to external hosts at build time or run time: no CDNs, no Google Fonts. Every font and asset lives in the repo.
- **Accessibility.** WCAG 2.2 AA in all four themes and both languages (extend `scripts/palette.mjs` for every new colour pair), visible focus, a keyboard path for every new interaction including drag and drop, and support for `prefers-reduced-motion` and `prefers-reduced-transparency`.
- **Analytics ethics** (decision 13). Alphabetical default order, changes shown without good/bad colouring, no scores or ranks except the existing same-level activity ranking (`PeerLeaderboard`) in Compare.
- **Real data is off limits.** Run everything against a temporary `DATABASE_PATH`. Never commit `data/`, `.env` or secrets.

## 5. What to build

### 5.1 Foundation: bilingual, RTL, calendars, preferences

- **i18n:** a lightweight in-house layer (a dictionary per locale, `t(key, params)`, plurals through `Intl.PluralRules`) that works in server and client components. Move every UI string into `fa` and `en` dictionaries. Add a test that fails on missing, unused or untranslated keys.
- **Persian copy** must read as if a native product writer wrote it: natural, short and consistent. Start a glossary at `lib/i18n/GLOSSARY.md` from the vocabulary already in `lib/analytics/labels.js` (تحلیلگر، شیفت‌لاگ، معوق، مسدود، بازبینی…). Use correct ZWNJ (تسک‌ها، می‌شود), Persian punctuation (، ؛ ؟ «»), and verb-first action labels (ذخیرهٔ تغییرات، ساخت تسک). Keep acronyms and product names as the team writes them (SOC, IOC, MISP, Splunk, Grafana; Bale is «بله»).
- **Locale resolution:** user preference (server) → cookie → default `fa`. Set `<html lang dir>` on the server so nothing flashes or jumps. Offer the switch in the top bar, in ⌘K, in Account › Preferences and on the sign-in page; it persists across devices.
- **Direction:** the whole app, shell included, is RTL in `fa` and LTR in `en` (the sidebar moves to the right in `fa`). Use logical CSS properties everywhere, mirror directional icons (chevrons, arrows, panels) and nothing else, and remove the per-page `dir="rtl"` islands once the root handles direction. Arrow-key navigation follows the visual direction.
- **Mixed content:** task IDs, ticket numbers, IPs, domains, hashes, emails, MISP references and code stay LTR, in Latin digits and the mono font, isolated with `<bdi>` or `unicode-bidi: isolate`.
- **Numbers:** Persian digits in `fa`, Latin digits in `en`, tabular figures. Every numeric, date and search input accepts Persian, Arabic-Indic and Latin digits (`T-۱۰۰۱` finds `T-1001`).
- **Dates:** one locale-aware module for formatting and period math (Jalali in `fa`, Gregorian in `en`), and relative times ("۲ روز پیش" / "2 days ago") with the absolute date in a tooltip. Weeks start on Saturday and Friday is the weekend in both languages, because that is the organisation's week; only the calendar and the labels change.
- **Periods:** presets (this month, last month, quarter…) resolve in the viewer's calendar, and the exact range is always visible. Shared URLs store explicit ISO dates, so the same link shows the same numbers to a `fa` user and an `en` user.
- **One date picker** (single date and range; Jalali grid in `fa`, Gregorian in `en`; keyboard accessible) replaces the native date inputs and the separate Jalali pickers in the shift screens and analytics.
- **Fonts:** self-host Vazirmatn (OFL, variable woff2) with `next/font/local`, as Geist already is. `fa` uses Vazirmatn, `en` uses Geist, IDs use Geist Mono. `npm run build` must succeed with no internet connection.
- **Shortcuts:** match letters with `event.code` (`KeyC`, `KeyK`, `KeyJ`…) so they work on any keyboard layout, and show localized hints.
- **API messages:** keep the English `error`, add a stable `code` (plus params) to every error response, and let the client show localized text in toasts, form alerts and error states.
- **Exports:** Excel, CSV, PNG and print follow the requester's language. `fa` workbooks are right-to-left, as the analytics workbook already is. Same columns and data as today.
- **Preferences:** store language and density per user on the server, mirrored in a cookie for server rendering; the theme can stay per device. Add Account › Preferences.

### 5.2 Visual language: modern and detailed

- **Principle:** premium and detailed, with a "security operations" feel, never gimmicky. Colour still carries meaning (quiet by default, loud by exception). Glass and gradients express structure and brand, never status.
- **Glass:** translucent surfaces with backdrop blur, a 1 px inner highlight and a hairline border for chrome and overlays: sidebar, top bar, sticky toolbars and filter bars, ⌘K, popovers, dialogs, side peek and toasts. Tables, forms and long text sit on solid surfaces for legibility and scroll performance. Provide solid fallbacks for browsers without `backdrop-filter` and for `prefers-reduced-transparency`.
- **Depth:** an elevation scale (0–4) in tokens, with shadow, highlight and border per theme; interactive cards lift on hover.
- **Ambient background:** a subtle, theme-aware aurora or mesh glow behind the shell, with very fine grain to prevent banding. It is static, or drifts very slowly and stops under reduced motion. Text always sits on a surface.
- **Gradients:** each theme's signature gradient on primary actions, the active navigation marker, progress, the focus series in charts and KPI icon tiles; gradient borders for featured panels such as "Needs your attention".
- **Typography:** a stronger hierarchy through the existing `--type-*` tokens (the Persian layer in `rtl.css` becomes the `fa` locale layer), tabular figures, and large KPI numbers with a one-time count-up.
- **Data visualisation:** one chart language across ECharts and the custom SVG charts in `components/ui/charts.js`: gradient areas, rounded bars, crosshair and rich tooltips, entrance animation, consistent legends, the chart/table toggle kept, correct in every theme and both directions.
- **Motion:** feedback in 100–180 ms, panels and route changes in 220–320 ms, springs for toggles, dragging and toasts, staggered entrances that finish within about 500 ms and never block input. Use view transitions for route and view changes where the browser supports them (check for built-in support in React 19.3 and Next 16 first). Animate only transform, opacity and filter, and keep 60 fps on an ordinary laptop.
- **Micro-interactions:** button press, check-mark draw, a row revealing quick actions on hover, drag lift, and a tasteful success moment when a shift log is completed. No confetti.
- **Empty states:** small theme-aware SVG illustrations kept in the repo, one sentence and one action, in both languages.
- **Themes** (decision 7): re-tune all four for glass and depth (surface alpha, blur, borders, shadows, ambient colours, chart palettes), define every token in every theme, and update `palette.mjs` and the contrast table in `DESIGN_SYSTEM.md`.
- **Density** (decision 8): `data-density="comfortable|compact"` on `<html>`, driven only by tokens. Comfortable keeps today's metrics (rows 40 px, controls 32 px); Compact uses rows of about 32 px, 28 px controls and tighter spacing. Switch it from the top bar, ⌘K and Preferences.
- **Large monitors** (decision 9): design at 1440, 1920 and 2560 px. Data pages (tables, board, dashboards, insights) use the width with a fluid 12-column grid, more columns and widgets, and the side peek next to the list, instead of a centred 1440 px column with empty margins. Reading pages and forms keep a comfortable measure (720–960 px). At 390 px nothing scrolls horizontally.

### 5.3 Shell, navigation and information architecture

- **Sidebar:** glass, grouped (Work · Insights · Organization, regrouped for the merged Insights), a collapsible rail with tooltips, count pills, and the active item marked with the signature gradient. It sits on the right in `fa`.
- **Top bar:** localized breadcrumbs with a real hierarchy, ⌘K search, the notification center with an unread count, and quick access to theme, language and density.
- **⌘K:** bilingual matching (Persian and English names, Persian digits in IDs), recent items, go to any page, report or person, create a task, switch language, theme or density.
- **Routes:** the merged Insights live under one base (keeping `/analytics`, which already has the tab frame and URL filters, is suggested). Every old URL (`/performance/…`, `/reports/…`) redirects to its new home, so bookmarks and old links keep working.
- **Page header:** one pattern everywhere: eyebrow, title, meta line and a single primary action.

### 5.4 Priority 1: Insights (merged)

- Before designing, write a **capability inventory** in the plan: every KPI, chart, table, filter, drill-down, export and print feature on today's `/analytics/*`, `/performance/*` and `/reports/*`, each mapped to its new home. Nothing may be lost. Duplicates become one implementation built on `lib/analytics/*`.
- **Managers:** tabs along the lines of Overview · Teams · People · Compare · Trends · SOC operations · Alerts & insights · Reports & exports · Executive report (refine them if the inventory suggests something better). The five standard reports (employee, team, task, shift, tickets) keep their preview tables and Excel export under Reports & exports.
- **Everyone else:** one "My stats" page that merges My statistics and My performance (own figures, anonymous team medians when at least three colleagues have activity, as today), plus the reports they are allowed to see.
- **One filter bar** for the whole section: sticky, glass, stored in the URL, with one period system for every tab (see §5.1).
- **One person profile** that merges the analytics person page and the employee performance page, keeping routine activity (Shift Logs) and task performance clearly separate.
- Keep the executive report (printed in the light theme), presentation mode and the clearly labelled demo data, all localized.

### 5.5 Priority 2: Dashboards (recommended content)

- **Analyst:** a "Today" hero (greeting, shift window with live progress during the shift, a Shift Log progress ring with Start/Continue, the next deadline), a timeline of today (shift hours, deadlines, review events), the work queue with quick actions (start, submit, open in side peek), mentions and recent activity on my tasks, and small personal trends that use the Insights definitions. No half-empty screen at 1440 or 1920.
- **SOC Manager:** a "right now" strip (who is on shift and their Shift Log status, open swap requests, reviews waiting), the Needs-your-attention queue with inline actions, team workload, today's Shift Log completion per analyst, and mini trends that open Insights.
- **Security Manager:** a department view with a card per team (open, overdue, blocked, in review, trend), the attention and review queues across teams, and links into Insights.
- KPI cards keep linking to their filtered lists.

### 5.6 Priority 3: Tasks

- **List:** a refreshed table (sticky glass header, density-aware rows, quick actions on hover), column visibility, grouping, and status tabs that fit or scroll gracefully on small screens.
- **Side peek:** a row opens the task in a side panel (`?task=T-1001`; back and forward work; `J/K` move between tasks; Esc closes and returns focus). The full page `/tasks/<id>` stays.
- **Board drag and drop:** only the transitions `lib/workflow.js` allows for this user. Valid columns light up while dragging, an invalid drop snaps back with a short reason, and Review → Done opens the quality picker. Keyboard alternative (Space to lift, arrows to move, Space to drop) with live announcements. Works in RTL.
- **Bulk actions:** multi-select (checkbox column, Shift-click ranges, select all in the view) and a floating action bar for status, priority, assignee and deadline. The server checks every item and returns per-item results; the UI reports, for example, "8 updated · 2 skipped" with the reasons.
- **Saved views:** users name and save filters, sort, grouping, columns and view type, stored per user on the server. The built-in My / Team / Assigned views stay.
- **Undo:** reversible edits (priority, assignee, deadline, hours, reversible status moves, bulk edits) show a toast with Undo for about six seconds. Where the workflow doesn't allow the reverse move (approval, for example), ask for confirmation first instead.
- **Task details:** a clearer header (ID, team, status-aware primary action), the properties rail, the checklist with progress, attachment previews, comments and activity in one timeline, `@mention` autocomplete, and relative times with absolute tooltips.
- **Create task:** the fast modal stays. Add an assignee picker with search, avatars and current workload, and quick deadline chips (today, tomorrow, end of week) in the active calendar. "Create another" stays.

### 5.7 Everything else on the new system

- **Shift Log:** one control per item (the whole row or a single toggle; Space/Enter; `J/K` between items). Issue reporting, the IOC stepper, tickets and the sticky summary stay; autosave states are localized; server behaviour is unchanged.
- **Shift Schedule, Shift changes, Log corrections, Log checklists:** bilingual, with the calendar following the language (in `en` the month grid is Gregorian; the data are ISO dates, so nothing changes on the server).
- **Team, Administration, Account (with Preferences), sign-in** (language switch before signing in; the theme swatches stay), 404, error and loading states, and the `/states` gallery: all on the new visual language and bilingual.

### 5.8 Cross-cutting features (in priority order)

1. **Notification center:** a notifications table that stores type and params (not rendered text, so it localizes), written at the existing events: task assigned, returned, submitted for review, approved, reopened, an `@mention` in a comment, a shift swap request and its decision. Deadline-soon and overdue may stay derived. Unread count, read/unread, mark all as read, filter by type, and a link to the target. Polling is enough (the top bar already polls every 30 s).
2. **Task features** from §5.6: side peek, bulk actions, board drag and drop, undo, saved views.
3. **Onboarding:** a first-run checklist for the bootstrap admin (change the password, add members, set teams, build the shift schedule, review the checklists) on the dashboard until it is done or dismissed; a short, skippable, role-aware welcome for each new member; helpful empty states everywhere.
4. **Installable app:** a web app manifest, icons from `app/icon.svg` and theme colours. No service worker caching of data.
5. **Stretch, only when everything else is done:** customisable dashboards (show, hide and reorder widgets, saved per user).

## 6. Process: one branch, autonomous

1. Create `redesign/bilingual-ui-ux` from an up-to-date `main`. All work happens there. **Never merge into `main` and never push to `main`.**
2. Commit this brief as `design/REDESIGN_BRIEF.md`.
3. **Baseline:** install, build, run against a temporary `DATABASE_PATH` with realistic demo data, and screenshot every route as an analyst, a SOC Manager and a Security Manager, in a light and a dark theme, at 1440 px (key pages also at 1920 and 390). Keep these screenshots out of git in a gitignored folder.
4. **Plan:** write `design/REDESIGN_PLAN.md` with the audit, the string inventory, the i18n and RTL architecture, the token and component changes, the Insights capability inventory and new IA with redirects, the phases as checkboxes, a Decisions log and the risks. Update it at the end of every phase; after any restart, continue from the first unchecked item.
5. **Phases.** Each ends with `npm run test:unit`, `npm run build`, `npx playwright test`, a screenshot pass, a plan update and a commit (smaller commits inside a phase are welcome):
   - P1 Foundation: i18n, direction, calendars, numbers, fonts, preferences, tokens, themes, density, motion, core `components/ui`
   - P2 Shell, navigation, IA, notification center
   - P3 Insights
   - P4 Dashboards
   - P5 Tasks
   - P6 Remaining screens
   - P7 Onboarding, installable app, polish, stretch goal
   - P8 QA, docs, handoff
6. If subagents are available, use them for independent read-only work (string inventory, RTL and accessibility audits, screenshot review), not for parallel edits of the same files.
7. **Finish:** commit 15–25 curated after-screenshots to `design/redesign/` (both languages, a light and a dark theme, the key pages), push the branch, and open a **draft** pull request against `main` if the GitHub CLI is available. Do not merge it.

## 7. Tests and QA

- **Existing tests keep their meaning.** The e2e specs select elements by their current copy: English for most screens, Persian for analytics. Pin each existing test to the locale its screen used before (for example with a locale cookie set per test or per `describe` block) instead of rewriting its assertions. Change a selector only where that copy itself deliberately changed.
- **New e2e coverage:** `fa` is the default and every route renders RTL with Persian digits and Jalali dates; the language choice persists across reload and sign-in; `en` shows Gregorian dates; inputs and search accept Persian digits; shortcuts fire for `code: "KeyC"` with a Persian `key`; the density switch works; board drag and drop with pointer and keyboard respects the workflow; bulk actions handle partial failures; side peek keeps its URL state; undo; saved views; notification read state; old routes redirect; first-run onboarding; no console errors on any route; no horizontal scroll at 390 px.
- **New unit tests:** formatting and period math in both calendars (month ends, Esfand and Jalali leap years, ranges that cross a year), digit normalisation, dictionary completeness, and migrations on a database created by the current `main`.
- **Visual QA:** every route × `fa`/`en` × four themes × both densities at 1440 px, plus 1920, 2560 and 390 px for the key pages. Check truncation, overflow, mirrored icons, bidi of mixed strings, focus order, contrast, reduced motion and reduced transparency.
- **Performance:** no regression in first load or interaction, no layout shift, smooth long lists (virtualise beyond a few hundred rows if needed).

## 8. Definition of done

- [ ] Every screen is bilingual (`fa` by default) with the right direction, calendar and digits; no hard-coded UI strings remain.
- [ ] Insights are merged with nothing lost, and the old URLs redirect.
- [ ] Dashboards, tasks and every other screen use the new visual language in all four themes and both densities.
- [ ] Notification center, side peek, bulk actions, board drag and drop, undo, saved views, onboarding and the manifest work and are tested.
- [ ] All existing and new unit and e2e tests pass; `npm run build` succeeds offline.
- [ ] AA contrast in every theme, a keyboard path for every new interaction, reduced motion and reduced transparency respected.
- [ ] Migrations are additive, idempotent and tested on a `main`-created database; no permission or business rule changed.
- [ ] `README.md`, `DESIGN_SYSTEM.md`, `SCREENS.md` and `ANALYTICS.md` are updated, and the plan is final.
- [ ] The branch is pushed and not merged.

## 9. Demo data and handoff

- Add `npm run seed:demo`. It fills an **empty** database (it creates the schema the same way the app does if the file is new, and refuses to run if any user other than the bootstrap admin exists) with a realistic fictional department: both manager roles, analysts across SOC L1–L3, an engineer and threat intelligence; tasks in every status with comments, mentions and checklists; a month of shift schedules and shift logs (some complete, some with issues); tickets, swap requests and notifications. Use a fictional domain such as `@demo.invalid`, never `@corp.local` (the app deletes those legacy demo users on startup). Print the sign-in details at the end.
- **Write your final message to me in Persian.** Include what changed in each area (with the curated screenshots), the new routes and redirects, the migrations added, the decisions you made for me, known limitations, and a step-by-step local test guide:
  - the commands: switch to the branch, `npm install`, `npm run build`, `DATABASE_PATH=./data/demo.db npm run seed:demo`, `DATABASE_PATH=./data/demo.db npm start` (a separate file, so my real database is never touched);
  - a checklist per role (analyst, SOC Manager, Security Manager) and per language: what to try and what I should see.
