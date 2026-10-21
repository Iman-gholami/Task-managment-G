# Sentinel Ops: Task, Shift Log & Performance

The Security Department's internal work tool: Task Management, SOC Shift Logs, and Workforce Performance.

**Stack:** Next.js 16 (App Router) · React 19 · JavaScript · Node.js ≥ 22.13 · SQLite (Node's built-in `node:sqlite`, so no database server or native build is needed) · ECharts (analytics charts, bundled from npm). The fonts (Geist, Vazirmatn) are bundled, so the app makes no external requests and works on an offline or internal network.

**Session security:** each sign-in expires after **12 hours** regardless of activity, or **30 minutes without interaction**, whichever happens first. Visible app tabs report genuine user activity at most once per minute; background polling never renews idle sessions. The server enforces both limits. Upgrading from the former 7-day session format signs everyone out once; existing users and tasks are unaffected.

**Everything is stored in the database:** sign-in with sessions, tasks with a review workflow and status history, checklist / comments / file attachments, the daily Shift Log (SOC analysts), performance figures, all five reports with Excel export, the analytics dashboard, account settings, and member management.

### Task workflow
`Backlog → To Do → In Progress → Review → Done`, plus `Blocked`, `Returned`, `Cancelled`.
- The assignee starts the task, submits it for review, or marks it blocked.
- A manager reviews a task **once**: **Approve** (with a quality rating) or **Return for changes**. Nobody approves their own task.
- An approved task is closed: status, priority and hours are locked. Only a manager can **Reopen** it, and that is recorded in the task's activity.
- The server enforces these rules; the UI only offers the allowed actions.

### Task views
- **Assigned by Me** (managers): every task you created for someone else, grouped by assignee, with tabs for *Open*, *Needs review*, *Overdue / Blocked*, *Done* and *All*.
- **Team Tasks**: your team's work (a Security Manager's team is the whole department).
- **My Tasks**: work assigned to you.

### Shift logs
Staff scheduled for SOC shifts can complete a Shift Log on the assigned day: SOC L1/L2/L3 analysts and engineers, plus Design & Automation analysts/engineers. Design & Automation members retain their organisational team and task permissions, but use the **SOC · L3 operational checklist** for shift logs. Staff without a scheduled shift cannot submit a Shift Log; managers view and correct logs through their management screens.

The shift calendar presents all three work shifts side by side in the selected-day summary, while individual off/leave and monthly statistics live in collapsible sections. Managers can edit the roster through a separate editor, selecting staff across the three work shift tabs and saving the day once. Each person can hold only one shift per date; changing or removing a shift after its log has started is rejected transactionally.

**Center holiday (تعطیلی مرکز)** is a separate whole-center date marker, optionally with a reason. A manager can register or remove it in the selected day's summary. Registering it atomically clears the day's scheduled work shifts while preserving personal off/leave records; any already-progressed shift log blocks the change and the full operation rolls back. The calendar displays the closure prominently, and new work assignments or shift swaps onto that date are blocked until the holiday is removed. Reopening the center does not automatically recreate old work assignments.

**Checklists are configurable per SOC layer** (Shift Schedule › **Log checklists**, `/shift/checklists`). SOC Managers and Security Managers create checklists, add, edit, reorder, deactivate or remove items (each with a type and the shifts it applies to), and choose which checklist each layer uses, or turn it off. Each analyst ticks their own items in their own daily log; nothing is shared between analysts or carried into the next shift.
- Saving a checklist creates a new version. Logs that have started (or are submitted) keep the items they began with; today's logs that are still empty follow the latest version. Every version and every assignment change is kept with who and when.
- On upgrade, the original routine becomes **Standard SOC routine** (unchanged, assigned to L1, L2 and L3, as before). Existing shift logs are not modified.
- Details, rules and decisions: [`design/SHIFT_CHECKLISTS.md`](design/SHIFT_CHECKLISTS.md).

### Performance & reports
Figures are computed from the database for the selected period (this month, last month, quarter, or a custom range): completed tasks by completion date, hours, complexity and quality, and — for SOC analysts — shift logs, routine completion, IOC count, tickets, traffic reports and issues. Every report has **Export to Excel** (`.xlsx`). Analysts see their own data; team reports are for managers.

### Analytics (management dashboard)
A Persian, right-to-left dashboard for managers at `/analytics`, on the Jalali calendar. It is **statistics first**: counts, hours and distributions. The only scored view is the manager-only same-level leaderboard at `/analytics/compare`; scores do not appear in People, profiles, My statistics or Excel. Tables elsewhere start in alphabetical order, and changes are shown without good/bad colouring. Tickets are counted, nothing more.
- **Screens:** Overview (status, KPIs, alerts, insights, work in vs out, teams) · Teams (drill down to SOC levels and members) · People (table, distribution, quick-view drawer, full profile) · Compare (people, teams or periods, up to four) · Trends (any metric, by team or level, period over period, a 12-month calendar) · SOC operations · Alerts & insights · Executive report (one printable page with manager notes).
- **Filters** (period presets or a custom Jalali range, comparison, team, level, time unit, role, priority, complexity, quality, shift type) live in the URL. They apply to every chart, table and export, and survive switching tabs.
- **Comparisons are like for like:** the first 14 days of this month are compared with the first 14 days of the previous month, not the whole month.
- **Weighted peer score (Compare only):** approved tasks score by final complexity `1/3/6/10` × quality `1.2/1/0.6/0.2`; legacy unrated Done tasks use factor `1`. A submission sent to Review after its deadline is multiplied by `0.9`; manager review delay is not a penalty. Complexity is confirmed by the manager at approval.
- **Monthly Shift Log review:** SOC/Security Managers can record one quality review per SOC shift analyst per Jalali month when that month contains a Shift Log with checklist items. L1/L2/L3 use a base of `3` × the same quality factor; daily shift metrics remain statistical and unscored.
- **Exports:** a multi-sheet right-to-left Excel workbook (guide and definitions, filters, summary, teams, people, trend, raw tasks, shifts and daily ticket counts), Excel for one person or for the teams, CSV and PNG for every chart, and print or PDF (always in the light theme).
- **Demo data:** the "داده نمایشی" button shows a fictional department for presentations and onboarding, clearly labelled. Managers only.
- **Access:** a Security Manager sees the department and a SOC Manager sees SOC. Everyone else sees only their own figures (sidebar: **My statistics**), with anonymous team medians when at least three colleagues have activity.
- Definitions, alert rules and design decisions: [`design/ANALYTICS.md`](design/ANALYTICS.md). Thresholds: `lib/analytics/config.js`.

Status changes are stored as structured history (`task_transitions`), and tasks have a `created_at`; both are backfilled from the activity log on first start. This history makes cycle time, return counts and the age of blocked or in-review work exact.

Uploaded files are stored next to the database in `data/uploads/` (max 20 MB each).

## First run

A fresh install contains **no sample data** — only one administrator account (a Security Manager). Sign in with it and add your team on the **Team** page.

| Setting | Default |
|---|---|
| `ADMIN_EMAIL` | `admin@local` |
| `ADMIN_PASSWORD` | `ChangeMe123!` |
| `ADMIN_NAME` | `Administrator` |

Set these before the first start (e.g. `ADMIN_EMAIL=you@company ADMIN_PASSWORD='…' npm start`), or change the password on the **Account** page right after signing in.

**Upgrading from an earlier version:** the demo people (`…@corp.local`), their tasks, shift logs and tickets are removed automatically on the first start. Anything you created yourself is kept. If no Security Manager is left, the administrator account above is created.

### Member management
- **Security Manager** can add and remove anyone except Security Managers (including SOC Managers).
- **SOC Manager** can add and remove Analysts in SOC · L1/L2/L3.
- Managers can also **Edit** a member (role, team, reset password) within the same limits.
- Everyone can change their own password on the **Account** page.
- Nobody can remove themselves. Removing a member revokes their sessions immediately; their tasks, shift logs and tickets are kept for reports.

### Environment variables
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/sentinel.db` | SQLite file location. Back up this file and the `uploads/` folder next to it |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | see above | Built-in administrator (created only when no Security Manager exists) |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |

## Run on your server

```bash
git clone -b main https://github.com/Iman-gholami/Task-managment-G.git
cd Task-managment-G
npm install

# Production
npm run build
npm start                 # http://<server-ip>:3000  (use PORT=8080 npm start to change the port)

# or development (hot reload)
npm run dev
```

## Tests

End-to-end tests (Playwright) start from an empty database, build a team through the UI, and cover sign-in, member management, task assignment and review, shift logs and their checklists, performance, reports and Excel export. Unit tests (`npm run test:unit`) cover the shift and analytics logic, the checklist model, and the checklist server code (migration of an existing database, versioning, per-analyst and per-shift completion) against temporary SQLite files.

```bash
npx playwright install chromium   # once; or set CHROMIUM_PATH=/usr/bin/chromium to use a system Chromium
npm run build
npm test
```

## Project layout

| Path | Contents |
|---|---|
| `app/` | Routes (App Router). `app/(app)/…` are the screens inside the app shell; `app/login` is the sign-in page |
| `components/screens/` | One component per screen (Dashboard, Tasks, TaskDetail, ShiftLog, Performance, Reports, Team, Admin…) |
| `components/analytics/` | Analytics: frame, filter bar, chart wrapper and option builders, shared blocks, one component per screen (`screens/`) |
| `lib/analytics/` | Analytics engine shared by the browser and the server: Jalali calendar, periods, filters, statistics, alerts, insights, demo data |
| `components/` | App shell (`shell/`), shared state (`AppProvider`), UI primitives (`ui/`: dialog, popover, tooltip, metric, charts, states, fields), task table, create-task modal |
| `app/api/` | REST API: auth, account, tasks (+ checklist, comments, attachments), shift log, performance, reports, members |
| `lib/server/` | Database, auth/sessions, data access (server only) |
| `lib/` | Roles and permissions, task workflow rules, Shift Log checklist model (`checklists.js`), formatting helpers |
| `styles/` | Design tokens (four themes) and styles by layer: base, shell, components, data, screens, rtl (Persian screens), analytics, themes, motion; bundled fonts |
| `design/` | Design system, specs for all screens, the analytics design (`ANALYTICS.md`), Shift Log checklists (`SHIFT_CHECKLISTS.md`) and the Persian implementation report (`IMPLEMENTATION_REPORT.fa.md`) |
| `tests/` | Playwright end-to-end tests and Node unit tests (`*.unit.test.mjs`) |

## Routes

| Route | Screen |
|---|---|
| `/dashboard` | Role-aware dashboard (Analyst, SOC Manager, Security Manager) |
| `/team` | Directory; managers add and remove members here |
| `/tasks/assigned` · `/tasks/team` · `/tasks/my` | Task lists (with a board view) |
| `/tasks/T-1001` | Task details |
| `/shift` · `/shift/history` | Today's Shift Log · history (SOC analysts only) |
| `/shift/checklists` | Shift Log checklists per SOC layer (SOC and Security Managers) |
| `/account` | Profile and password |
| `/performance/overview` · `/performance/employees/<id>` | Performance overview · one employee |
| `/reports/employee` · `/reports/shift` · `/reports/tickets` … | Reports |
| `/analytics` · `/analytics/teams` · `/analytics/people` · `/analytics/compare` · `/analytics/trends` · `/analytics/soc` · `/analytics/alerts` · `/analytics/report` | Management dashboard (managers) |
| `/analytics/people/<id>` | One person's statistics (managers; everyone else sees only their own) |
| `/admin` | Users & roles |
| `/login` | Sign in |

Shortcuts: `⌘K` / `Ctrl+K` searches tasks, people and pages, `C` creates a task, `?` lists all shortcuts, and `J`/`K`/`Enter`/`S`/`P` work in task tables.

### Themes
Four themes: **Daylight** (light, teal), **Graphite** (dark slate, teal), **Black Gold** (black and gold) and **Midnight** (navy, violet and azure). Switch from the palette button in the top bar, **Account › Appearance**, the swatches on the sign-in page, or `⌘K` → "theme". The choice is remembered per device; without one, the OS light/dark setting decides. Colours and contrast checks are in `scripts/palette.mjs` and `design/DESIGN_SYSTEM.md`.

## Shift off-duty and leave planning

The Persian shift calendar includes two non-working day statuses: **تعطیل شیفت** (`off`) and **مرخصی** (`leave`). A manager can plan these alongside morning, extended (until 20:00) and night shifts in the same single-save editor; a person can have only one status per date. A day off or leave contributes **zero worked shift hours**, never opens a Shift Log, and is excluded from missed-log/closure-rate denominators. Off/leave dates remain visible in the calendar, individual history, SOC report summaries, analytics filters, individual/team metrics and raw Excel shift exports.

Absences use a new `shift_day_statuses` SQLite table created automatically on first start; existing `shift_schedules` and `shift_logs` rows are preserved. Do not delete the bind-mounted production data when upgrading. Shifts with recorded activity cannot be converted to absences.
