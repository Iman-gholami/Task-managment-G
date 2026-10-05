# Sentinel Ops: Task, Shift Log & Performance

The Security Department's internal work tool: Task Management, SOC Shift Logs, and Workforce Performance.

**Stack:** Next.js 16 (App Router) · React 19 · JavaScript · Node.js ≥ 22.13 · SQLite (Node's built-in `node:sqlite`, so no database server or native build is needed). The fonts (Geist) are bundled, so the app makes no external requests and works on an offline or internal network.

**Everything is stored in the database:** sign-in with sessions, tasks with a review workflow, checklist / comments / file attachments, the daily Shift Log (SOC analysts), performance figures, all five reports with Excel export, account settings, and member management.

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
Only SOC analysts (SOC · L1/L2/L3) have a Shift Log. Managers, engineers and Threat Intelligence do not; managers see shift figures in **Performance** and the **SOC Shift Activity Report**.

### Performance & reports
Figures are computed from the database for the selected period (this month, last month, quarter, or a custom range): completed tasks by completion date, hours, complexity and quality, and — for SOC analysts — shift logs, routine completion, IOC count, tickets, traffic reports and issues. Every report has **Export to Excel** (`.xlsx`). Analysts see their own data; team reports are for managers.

**Who sees whose figures:** a Security Manager sees everyone; a SOC Manager sees the analysts of SOC · L1/L2/L3; everyone else sees only themselves. The server enforces this for Performance and every report.

### Workforce Performance report (گزارش عملکرد نیروها)
`/reports/workforce` — the first report in **Reports**, in Persian with Jalali periods (a month, a season, a year, or a custom range).
- **One row per person** with an **overall score out of 100**: tasks completed, quality, on-time delivery, returns for changes, overdue work, and for SOC analysts shift attendance (shifts with a Shift Log), routine completion, IOCs and tickets.
- **The score** is a weighted mean of parts that each run 0–100; parts without data are left out and their weight is shared by the rest. Weights differ for SOC shift analysts, engineers / Threat Intelligence, and the SOC Manager (whose parts include review speed and the analysts' average score). The page and the workbook both explain the formula (`lib/workforce.js`).
- **Monthly evaluation:** a manager gives each member they manage a score (1–5) and a comment for a Jalali month. It counts toward the score, appears in the report and the workbook, and the member sees it on their own report.
- **Excel** (Persian, right-to-left): summary per person, team summary, managers, shifts per analyst, every task and every shift of the period, evaluations, and the scoring guide. Members removed during the period are kept, marked inactive.

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

End-to-end tests (Playwright) start from an empty database, build a team through the UI, and cover sign-in, member management, task assignment and review, shift logs, performance, reports and Excel export.

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
| `components/` | App shell (`shell/`), shared state (`AppProvider`), UI primitives (`ui/`: dialog, popover, tooltip, metric, charts, states, fields), task table, create-task modal |
| `app/api/` | REST API: auth, account, tasks (+ checklist, comments, attachments), shift log, performance, reports, members |
| `lib/server/` | Database, auth/sessions, data access (server only) |
| `lib/` | Roles and permissions, task workflow rules, formatting helpers, seed data |
| `styles/` | Design tokens (four themes) and styles by layer: base, shell, components, data, screens, rtl (Persian screens), themes, motion; bundled fonts |
| `design/` | Design system and specs for all 23 screens |
| `tests/` | Playwright end-to-end tests |

## Routes

| Route | Screen |
|---|---|
| `/dashboard` | Role-aware dashboard (Analyst, SOC Manager, Security Manager) |
| `/team` | Directory; managers add and remove members here |
| `/tasks/assigned` · `/tasks/team` · `/tasks/my` | Task lists (with a board view) |
| `/tasks/T-1001` | Task details |
| `/shift` · `/shift/history` | Today's Shift Log · history (SOC analysts only) |
| `/account` | Profile and password |
| `/performance/overview` · `/performance/employees/<id>` | Performance overview · one employee |
| `/reports/workforce` · `/reports/employee` · `/reports/shift` · `/reports/tickets` … | Reports (Workforce Performance first) |
| `/admin` | Users & roles |
| `/login` | Sign in |

Shortcuts: `⌘K` / `Ctrl+K` searches tasks, people and pages, `C` creates a task, `?` lists all shortcuts, and `J`/`K`/`Enter`/`S`/`P` work in task tables.

### Themes
Four themes: **Daylight** (light, teal), **Graphite** (dark slate, teal), **Black Gold** (black and gold) and **Midnight** (navy, violet and azure). Switch from the palette button in the top bar, **Account › Appearance**, the swatches on the sign-in page, or `⌘K` → "theme". The choice is remembered per device; without one, the OS light/dark setting decides. Colours and contrast checks are in `scripts/palette.mjs` and `design/DESIGN_SYSTEM.md`.
