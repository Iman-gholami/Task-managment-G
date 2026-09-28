# Sentinel Ops: Task, Shift Log & Performance

The Security Department's internal work tool: Task Management, SOC Shift Logs, and Workforce Performance.

**Stack:** Next.js 16 (App Router) · React 19 · JavaScript · Node.js ≥ 20.9. The fonts (Geist) are bundled in the repository, so the app makes no external requests at runtime and works on an offline or internal network.

> **Current status:** this is the complete front-end (UI) for all screens, running on **mock data** (`lib/data.js`).
> There is no database or authentication yet, so changes (new tasks, shift log entries) live only in the browser session and are lost on refresh.

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

End-to-end tests (Playwright) cover every screen plus the main interactions: creating a task, inline status change, keyboard navigation, filters, the Shift Log (IOC count, tickets, report an issue, complete shift), the ticket report, and the theme and role switches.

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
| `lib/` | Mock data and formatting helpers. Replace `lib/data.js` with API calls when the backend is added |
| `styles/` | Design tokens (dark and light themes), component styles, bundled fonts |
| `design/` | Design system and specs for all 23 screens |
| `tests/` | Playwright end-to-end tests |

## Routes

| Route | Screen |
|---|---|
| `/dashboard` | Role-aware dashboard (use **Switch role (demo)** in the sidebar for the Analyst, SOC Manager, and Security Manager views) |
| `/tasks/my` · `/tasks/team` · `/tasks/all` | Task tables (with a board view) |
| `/tasks/T-1042` | Task details |
| `/shift` · `/shift/history` | Today's Shift Log · history |
| `/team` | Employee directory |
| `/performance/overview` · `/performance/employees` | Performance |
| `/reports/employee` · `/reports/shift` · `/reports/tickets` … | Reports |
| `/admin` | Users & roles |
| `/login` | Sign in |

Shortcuts: `⌘K` / `Ctrl+K` opens the command menu, `C` creates a task, and `J`/`K`/`Enter`/`S` work in task tables.
