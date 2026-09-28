# Sentinel Ops: Task, Shift Log & Performance

The Security Department's internal work tool: Task Management, SOC Shift Logs, and Workforce Performance.

**Stack:** Next.js 16 (App Router) · React 19 · JavaScript · Node.js ≥ 22.13 · SQLite (Node's built-in `node:sqlite`, so no database server or native build is needed). The fonts (Geist) are bundled, so the app makes no external requests and works on an offline or internal network.

**What's real:** sign-in with sessions, tasks (create, status, priority, hours), the daily Shift Log (activities, IOC count, issues, tickets, complete/reopen), the ticket report, and member management. Performance and most report figures are still sample data (`lib/data.js`).

## First run

On first start the app creates `data/sentinel.db` and seeds sample users and tasks. All seeded accounts use the password `ChangeMe123!` (override with `SEED_PASSWORD` **before the first start**):

| Email | Role |
|---|---|
| `kaveh@corp.local` | Security Manager |
| `leila@corp.local` | SOC Manager |
| `sara@corp.local` | Analyst (SOC · L1) |
| `arash@`, `neda@`, `reza@`, `mina@`, `hossein@corp.local` | Other team members |

Change these passwords (or remove the sample users) before real use.

### Member management
- **Security Manager** can add and remove anyone except Security Managers (including SOC Managers).
- **SOC Manager** can add and remove Analysts in SOC · L1/L2/L3.
- Nobody can remove themselves. Removing a member revokes their sessions immediately; their tasks, shift logs and tickets are kept for reports.

### Environment variables
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/sentinel.db` | SQLite file location. Back this file up |
| `SEED_PASSWORD` | `ChangeMe123!` | Password for seeded accounts (first start only) |
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

End-to-end tests (Playwright) run against a fresh temporary database and cover sign-in/out, every screen, persistence of tasks and the Shift Log, API permission checks, and adding/removing members as each role.

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
| `components/` | App shell, shared state (`AppProvider`), task table, create-task modal, and UI indicators |
| `app/api/` | REST API: auth, tasks, shift log, tickets, members |
| `lib/server/` | Database, auth/sessions, data access (server only) |
| `lib/` | Roles and permissions, formatting helpers, sample data |
| `styles/` | Design tokens (dark and light themes), component styles, bundled fonts |
| `design/` | Design system and specs for all 23 screens |
| `tests/` | Playwright end-to-end tests |

## Routes

| Route | Screen |
|---|---|
| `/dashboard` | Role-aware dashboard (Analyst, SOC Manager, Security Manager) |
| `/team` | Directory; managers add and remove members here |
| `/tasks/my` · `/tasks/team` · `/tasks/all` | Task tables (with a board view) |
| `/tasks/T-1042` | Task details |
| `/shift` · `/shift/history` | Today's Shift Log · history |
| `/performance/overview` · `/performance/employees` | Performance |
| `/reports/employee` · `/reports/shift` · `/reports/tickets` … | Reports |
| `/admin` | Users & roles |
| `/login` | Sign in |

Shortcuts: `⌘K` / `Ctrl+K` opens the command menu, `C` creates a task, and `J`/`K`/`Enter`/`S` work in task tables.
