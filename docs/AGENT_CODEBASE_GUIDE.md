# Sentinel Ops — Agent Codebase Guide

> **Purpose:** a low-token, high-accuracy navigation map for future coding agents. This is an index of where behavior lives, not a substitute for checking the current code before changing it.
>
> **Repository:** `Iman-gholami/Task-managment-G` · **baseline inspected:** `main` at `e65a9884d76470412e1d19e1a86e98be6f4b50e7` (2026-11-18) · **language:** JavaScript (no TypeScript) · **status:** paths and described behavior were checked against this revision. Revalidate changed files on newer revisions.

## 0. How to use this document (read this first)

1. Identify the **single feature area** in [§2 Quick task router](#2-quick-task-router).
2. Read the **entry file** and **server owner** in that row, plus its named tests. In most cases, do **not** read the entire repository or every screen.
3. If a change crosses a boundary, follow [§1 Architecture](#1-architecture-and-boundaries) and [§3 API routes](#3-api-route-index). If it concerns swaps, use [SHIFT_EXCHANGE_RUNBOOK.md](SHIFT_EXCHANGE_RUNBOOK.md) before editing.
4. Confirm present-day behavior in the selected files (this guide may lag the code), implement the smallest coherent change, and run [§8 Verification](#8-local-development-and-verification).
5. **Update this guide or the relevant runbook in the same PR** whenever a file owner, endpoint, invariant, or test changes. Keep `AGENTS.md` short and link here instead of copying details into it.

**Minimal search commands** (after locating the relevant area):

```bash
rg --files app components lib tests | rg 'shift|task|analytics'  # narrow by feature
rg -n 'createShiftChangeRequest|actOnShiftChange' lib/server/repo.js
rg -n 'GET|POST|PATCH|PUT|DELETE' app/api/shift/changes/route.js
rg -n 'test\(' tests/shift-operations.unit.test.mjs
```

**Evidence convention:** *verified* means the named source/handler was inspected at the baseline above; *design intent* comes from `README.md` or `design/` and must be checked against current behavior. Never infer a database migration or business rule from UI text alone.

## 1. Architecture and boundaries

| Layer | Location | Responsibilities / edit rule |
|---|---|---|
| App Router page entries | `app/(app)/**/page.js`, `app/login/page.js` | URLs, server-side data/auth guards, redirects, page metadata. Many are thin wrappers around a client screen. Route-group `(app)` is **not** part of the URL. |
| HTTP handlers | `app/api/**/route.js` | Authentication, authorization, request validation, responses/status. Change a public request shape here *and* its clients/tests. |
| Screen UI | `components/screens/**` | Forms, lists, feedback, fetch calls, event handlers. UI should reflect policy; never rely on UI-only checks for security. |
| Analytics UI | `components/analytics/**` | Shared analytics context/filters/chart options/screens, backed by server analytics facts. |
| App-wide UI state | `components/AppProvider.js`, `components/I18nProvider.js` | `useApp()`, `api()`, locale, theme, app-shell data; `components/useFetch.js` and hooks for fetching. |
| Shell and navigation | `components/shell/{AppShell,Sidebar,Topbar,CommandMenu,nav}.js` | Menus, breadcrumbs, shortcuts, role-dependent routes. |
| Shared policy and pure logic | `lib/{roles,workflow,shifts,shift-log-mode,checklists,roster-editor,task-journey,task-date,session-policy}.js` | Source of truth for roles, transitions, shift types, daily-log mode, checklist model, date conversion, session deadlines. Imported by browser and/or server. |
| Server state/data operations | `lib/server/**` | SQLite, transactions, task/shift persistence, checklists, reports, sessions, access guards. `import "server-only"` marks server-only modules. |
| Analytics calculation engine | `lib/analytics/**` and `lib/server/analytics.js` | Jalali periods, filters, metric derivation, comparisons, scores, alerts, scoped facts and exports. |
| Styles and translations | `styles/**`, `*.module.css`, `lib/i18n/**` | CSS tokens/theming, layout, RTL/LTR, bilingual built-in UI strings. |
| Tests and CI | `tests/**`, `.github/workflows/shift-feature-ci.yml` | Node unit tests and Playwright E2E; production build and full suite on PRs to main. |

**Runtime:** Next.js `16.3.6` App Router, React `19.3.0`, Node `>=22.13.0`, Node built-in `node:sqlite` (`DatabaseSync`), ECharts, ExcelJS, JSZip, Playwright. No external database. Fonts are bundled for internal/offline deployment. Check `package.json` for the *current* pinned versions. `scripts/next.mjs` is the wrapper used by `dev`, `build`, and `start`.

**Important Next.js requirement:** `AGENTS.md` contains an auto-maintained Next.js 16 agent-rule block. Before writing Next.js-specific code, consult the relevant installed `node_modules/next/dist/docs/` guide; do not assume older App Router conventions. Do not remove or overwrite that block.

**Typical request path:** `app/(app)/.../page.js` → `components/screens/...` → `app/api/.../route.js` → `lib/server/...` → `lib/server/db.js` (SQLite). `lib/roles.js` and other `lib/*.js` policies may be used on **both** sides. Analytics uses `components/analytics` → `app/api/analytics` → `lib/server/analytics` + `lib/analytics`.

## 2. Quick task router

Open only the files in the relevant row first; expand based on actual imports/calls. File names are literal repository paths.

| If user asks about… | Start with UI / route | Source of truth and dependent code | Focused tests |
|---|---|---|---|
| **Swap/exchange shifts**, two analysts, manager approval, overlapping morning, Saturday/Sunday, off/leave | `components/screens/ShiftChanges.js`, `app/api/shift/changes/route.js` | `lib/server/repo.js` (`createShiftChangeRequest`, `assertSwapDestinationAvailable`, `actOnShiftChange`, `applyShiftChange`), `lib/server/db.js`, **[SHIFT_EXCHANGE_RUNBOOK.md](SHIFT_EXCHANGE_RUNBOOK.md)** | `tests/shift-operations.unit.test.mjs`, `tests/app.spec.js` |
| Roster calendar, daily shift assignment, edit all three shifts, off/leave, center holiday | `components/screens/ShiftSchedule.js`, `app/api/shift/schedule/route.js` | `lib/server/shift-batch.js`, `lib/server/repo.js` (`setShiftSchedule`, `setDayStatus`, `shiftLogHasProgress`), `lib/shifts.js`, `lib/roster-editor.js` | `tests/shift-roster.spec.js`, `tests/roster-editor.unit.test.mjs`, `tests/shift-calendar-view.spec.js`, `tests/shift-operations.unit.test.mjs` |
| Import monthly roster from Excel | `components/screens/ShiftExcelImport.js`, `app/api/shift/schedule/import/route.js` | `lib/server/shift-excel.js`, `lib/server/shift-batch.js` | `tests/shift-excel.unit.test.mjs`, `tests/shift-roster.spec.js` |
| Daily SOC Shift Log, completion, issue, MISP/IOC, tickets, backfill | `app/(app)/shift/page.js`, `components/screens/ShiftLog.js`, `components/screens/ShiftLogManager.js` | `app/api/shift/route.js`, `app/api/shift/{tickets,analyzed-tickets,backfill,history}/route.js`, `lib/server/repo.js`, `lib/server/{shift-backfill,shift-log-admin,l2-analyzed-tickets}.js`, `lib/shift-log-mode.js` | `tests/app.spec.js`, `tests/shift-duty-modes.{spec.js,unit.test.mjs}`, `tests/l2-analyzed-tickets.{spec.js,unit.test.mjs}`, `tests/review-backfill.{spec.js,unit.test.mjs}` |
| Configurable L1/L2/L3 Shift Log checklists | `components/screens/ShiftChecklists.js`, `app/api/shift/checklists/**`, `app/api/shift/checklist-assignments/route.js` | `lib/server/shift-checklists.js`, `lib/checklists.js`, `lib/server/repo.js` (`getShiftLog`, `updateActivity`), `lib/server/db.js`; `design/SHIFT_CHECKLISTS.md` | `tests/shift-checklists.{spec.js,unit.test.mjs}`, `tests/checklists.unit.test.mjs` |
| L2 analyzed ticket verdicts FP/TP | `components/screens/L2AnalyzedTickets.js`, `app/api/shift/analyzed-tickets/route.js` | `lib/server/l2-analyzed-tickets.js`, `lib/shift-log-mode.js`, `lib/server/stats.js` | `tests/l2-analyzed-tickets.{spec.js,unit.test.mjs}` |
| Create, list, assign, search, edit tasks | `components/CreateTaskModal.js`, `components/screens/Tasks.js`, `components/TaskTable.js` | `app/api/tasks/route.js`, `app/api/tasks/[id]/route.js`, `lib/server/repo.js`, `lib/roles.js` | `tests/task-workspace.spec.js`, `tests/task-clarity-notifications.spec.js`, `tests/app.spec.js` |
| Task details, draft work report, submit/review/approve/return, no-review completion | `components/screens/{TaskDetail,TaskWorkPanel,TaskReviewPanel,TaskJourney}.js` | `app/api/tasks/[id]/route.js`, `lib/workflow.js`, `lib/task-journey.js`, `lib/server/repo.js` (`commitTaskUpdate`), `design/TASK_WORKSPACE.md` | `tests/task-flow-ui.spec.js`, `tests/task-report-api.spec.js`, `tests/task-approval-outcome.spec.js`, `tests/task-report-migration.unit.test.mjs`, `tests/task-journey.unit.test.mjs` |
| Task comments, checklist items, attachments, delete | `components/screens/TaskDetail.js`, `components/screens/TaskWorkPanel.js` | `app/api/tasks/[id]/{comments,checklist,attachments}/**`, `lib/server/{repo,uploads}.js`, `lib/task-upload.js` | `tests/task-workspace.spec.js`, `tests/task-page-overview.spec.js` |
| Assignment notification / browser notification | `components/useTaskAssignmentNotifications.js`, `components/AppProvider.js` | `app/api/task-assignments/route.js`, `lib/server/repo.js` (`listAssignmentNotifications`, `commitTaskUpdate`) | `tests/task-assignment-notifications.unit.test.mjs`, `tests/task-clarity-notifications.spec.js` |
| Member CRUD, roles, scope, province, observer | `components/screens/Team.js`, `components/screens/Misc.js` (Admin) | `app/api/members/**`, `lib/roles.js`, `lib/server/{repo,access}.js`, `lib/server/analytics.js` | `tests/app.spec.js`, `tests/province-observer.{spec.js,unit.test.mjs}` |
| Login, logout, password, session expiry, activity heartbeat | `components/screens/Misc.js` (Login), `components/screens/Account.js`, `components/SessionMonitor.js` | `app/api/auth/**`, `app/api/account/password/route.js`, `lib/server/{auth,password,login-rate-limit,db}.js`, `lib/session-policy.js` | `tests/session-policy.unit.test.mjs`, `tests/session-migration.unit.test.mjs`, `tests/app.spec.js` |
| Dashboards by role, return alerts | `components/screens/Dashboard.js`, `components/screens/dashboard/*` | `app/(app)/layout.js`, `lib/server/{stats,shift-backfill}.js`, `lib/roles.js` | `tests/dashboard-performance.unit.test.mjs`, `tests/review-backfill.spec.js` |
| Performance pages and reports / Excel | `components/screens/{Performance,EmployeePerformanceCharts,ManagerPerformanceCharts,Reports}.js` | `app/api/{performance,reports/[report]}/route.js`, `lib/server/{stats,reports}.js`, `lib/reports.js` | `tests/app.spec.js`, `tests/dashboard-performance.unit.test.mjs` |
| Analytics totals, filtering, comparisons, score, alerts | `components/analytics/{AnalyticsFrame,AnalyticsContext,FilterBar,chartOptions}.js`, `components/analytics/screens/*` | `app/api/analytics/route.js`, `lib/server/analytics.js`, `lib/analytics/{metrics,filters,periods,calendar,performance,alerts,insights,config}.js`, `design/ANALYTICS.md` | `tests/analytics.unit.test.mjs`, `tests/weighted-score.unit.test.mjs`, `tests/monthly-report.unit.test.mjs` |
| Analytics CSV/Excel/PNG export; monthly ZIP/HTML report | `components/analytics/screens/Report.js`, `components/analytics/MonthlyReport.js` | `app/api/analytics/{export,monthly-report}/route.js`, `lib/server/{analytics-export,monthly-report,monthly-report-data,monthly-report-styles}.js` | `tests/monthly-report.{spec.js,unit.test.mjs}`, `tests/analytics.unit.test.mjs` |
| Persian/English UI, Jalali dates, RTL | `components/I18nProvider.js`, `app/layout.js`, `styles/rtl.css` | `lib/i18n/{messages,labels,shift-fa,tasks,analytics}.js`, `lib/analytics/calendar.js`, `lib/task-date.js`, `lib/shifts.js` | `tests/i18n-core.{spec.js,unit.test.mjs}`, `tests/task-date.unit.test.mjs` |
| Theme, shell, layout, responsive CSS | `components/theme.js`, `components/ThemePicker.js`, `components/shell/*` | `styles/{tokens,themes,shell,screens,analytics,rtl}.css`, `*.module.css`, `design/DESIGN_SYSTEM.md`, `design/SCREENS.md` | `tests/i18n-core.spec.js`, `tests/task-page-overview.spec.js`; `node scripts/palette.mjs` |

### Route-to-screen shortcuts

| URL(s) | Actual entry / screen |
|---|---|
| `/dashboard` | `app/(app)/dashboard/page.js` → `components/screens/Dashboard.js` → `screens/dashboard/{AnalystDashboard,SocDashboard,SecurityDashboard}.js` |
| `/tasks/assigned`, `/tasks/team`, `/tasks/my` | `app/(app)/tasks/{assigned,team,my}/page.js` → `components/screens/Tasks.js` |
| `/tasks/[id]` | `app/(app)/tasks/[id]/page.js` → `components/screens/TaskDetail.js` |
| `/shift` / `/shift/history` / `/shift/manage` | `app/(app)/shift/{page,history/page,manage/page}.js` → `screens/ShiftLog.js` / `screens/ShiftLogManager.js` |
| `/shift/schedule`, `/shift/changes`, `/shift/checklists` | `app/(app)/shift/{schedule,changes,checklists}/page.js` → matching `screens/Shift*.js` |
| `/analytics`, `/analytics/people/[id]`, `/analytics/{teams,people,soc,compare,trends,alerts,report}` | `app/(app)/analytics/**/page.js` → `components/analytics/screens/{Overview,Person,Teams,People,Soc,Compare,Trends,Alerts,Report}.js` |
| `/performance/overview`, `/performance/employees/[id]` | `app/(app)/performance/**/page.js` → `components/screens/Performance.js` |
| `/reports/[report]` | `app/(app)/reports/[report]/page.js` → `components/screens/Reports.js` |
| `/team`, `/account`, `/admin`, `/login` | `app/**/page.js` → `components/screens/{Team,Account,Misc}.js` |

Do not mistake `app/(app)/shift/team`, `app/(app)/shift/view`, and several plural route indexes for independent screens: inspect their page files; some are redirects/aliases. The same applies to route-specific authorization in server components.

## 3. API route index

Use the handler itself for exact request/response schemas; this table is a routing index, **not** a contract schema.

| Endpoint | HTTP methods | Main owner / caution |
|---|---|---|
| `/api/auth/login`, `/api/auth/logout`, `/api/auth/activity` | POST | `lib/server/auth.js`; rate limit in `login-rate-limit.js`; activity is the only idle-session touch. |
| `/api/account/password` | POST | `lib/server/password.js`, `lib/server/repo.js` |
| `/api/members`, `/api/members/[id]` | GET/POST; PATCH/DELETE | Member roles/scope enforced by `lib/roles.js`; `lib/server/repo.js`. |
| `/api/tasks`, `/api/tasks/[id]` | GET/POST; GET/PATCH/DELETE | Task lifecycle in `lib/workflow.js`, atomic report writes in `commitTaskUpdate`. |
| `/api/tasks/[id]/checklist`, `/api/tasks/[id]/checklist/[itemId]` | POST; PATCH/DELETE | **Task** checklist, distinct from **Shift Log** checklists. |
| `/api/tasks/[id]/comments`, `/api/tasks/[id]/comments/[commentId]` | POST; PATCH/DELETE | Comments, audit/history through repo. |
| `/api/tasks/[id]/attachments`, `/api/tasks/[id]/attachments/[attachmentId]` | POST; GET/DELETE | Binary files via server upload store. |
| `/api/task-assignments` | GET | Pollable assignment event notifications. |
| `/api/shift`, `/api/shift/history`, `/api/shift/team` | GET/PATCH; GET; GET | Rostered log and manager correction/history; access depends on analyst vs manager. |
| `/api/shift/schedule`, `/api/shift/schedule/import` | GET/POST/PUT/DELETE/PATCH; POST/PUT | Calendar, atomic roster updates, holidays, Excel preview/apply. |
| `/api/shift/changes` | GET/POST/PATCH | Exchange requests / participant acceptance / manager approval. See runbook. |
| `/api/shift/tickets`, `/api/shift/analyzed-tickets` | POST; POST/PATCH/DELETE | Ticket creation vs L2 analyzed-ticket verdicts are **different** data. |
| `/api/shift/checklists`, `/api/shift/checklists/[id]`, `/api/shift/checklist-assignments` | GET/POST; GET/PUT/DELETE; GET/PUT | Shift Log checklist definitions, versions, and team assignments; manager-only. |
| `/api/shift/backfill`, `/api/shift/reviews` | GET/POST; GET/PUT/DELETE | Manager-authorized past logs; monthly quality review + audit. |
| `/api/performance`, `/api/reports/[report]` | GET | Calculated facts and Excel report. |
| `/api/analytics`, `/api/analytics/export`, `/api/analytics/monthly-report` | GET | Scoped analytics facts, exports, ZIP/HTML/XLSX. |

### Data and state invariants (high impact)

- **Never trust client role checks.** API uses `requireUser()` (`401`), then role/scope checks (`403`), and domain checks (`400`/`409` as appropriate). `lib/server/access.js` wraps common task/shift permissions. `observer` is read-only, not a manager.
- **Tasks:** `lib/workflow.js` owns legal transitions. A submitted work report and any status change must be atomic through `commitTaskUpdate` with expected status/assignee/revision; never lose an analyst's draft on a stale write. Done tasks are locked unless explicitly reopened by a manager. Managers may waive review on eligible tasks; a reassignment restores it.
- **Shift roster:** at most **one work shift per person per date** (`UNIQUE(user_id,date)`); `off` and `leave` live in a separate table and must never coexist with a working shift. `shift_center_holidays` flags a date but never removes staffing or logs. Changing a shift with started log activity must be rejected transactionally.
- **Shift changes:** same-date exchange differs from cross-date exchange. A destination `off` may be moved; `leave` blocks. A pre-existing `morning` can be **extended** to incoming `evening` only under the strict consent rule; never add a second shift. See [runbook](SHIFT_EXCHANGE_RUNBOOK.md).
- **Shift Log:** only scheduled eligible staff can write a log, or a historical date specifically granted by a manager (`shift_log_backfill_grants`). Logs store a copy of the applicable checklist; started logs retain their version. The `itemId` check avoids stale UI activity-index writes.
- **Time/date:** persisted roster dates are ISO `YYYY-MM-DD`; the app uses `Asia/Tehran` (`lib/shifts.js`) and Jalali for many UI views (`lib/analytics/calendar.js`, `lib/task-date.js`). Do not persist Jalali UI text in ISO columns. `evening` means **07:30–20:00**, not a shift beginning in the evening.
- **Analytics:** apply role/team/province scope before aggregating/exporting; preserve partial-period, like-for-like comparisons. Only the manager Compare screen uses weighted scores; don't leak scores into general People/profiles/Excel. Monthly SOC shift-review rating is distinct from daily routine completion.

## 4. SQLite schema and ownership map

**Database bootstrap:** `lib/server/db.js` opens `DATABASE_PATH` (default `./data/sentinel.db`), enables WAL, foreign keys, busy timeout, creates tables, then runs additive `migrate()`, one-time demo purge and admin bootstrap. **Do not remove/mount-over the production `data/` directory**. Stored attachments live beside it in `data/uploads/`. There is no Prisma/ORM or separate migration runner.

| Related tables | Meaning | Primary owner |
|---|---|---|
| `users`, `sessions` | Active users, roles, profile/province, session token and idle/absolute expiry | `lib/server/{db,auth,repo}.js` |
| `tasks`, `task_work_reports`, `task_review_returns`, `task_transitions`, `task_events` | Task state, one editable work report per task, immutable review returns, structured lifecycle & activity | `lib/server/repo.js`, `app/api/tasks/[id]/route.js` |
| `checklist_items`, `comments`, `attachments`, `task_assignment_notifications` | **Task** checklist, discussion, uploaded files, assignment event queue | `lib/server/repo.js`, `lib/server/uploads.js` |
| `shift_schedules`, `shift_day_statuses`, `shift_center_holidays` | Roster work, off/leave, independent whole-center holiday | `lib/server/{repo,shift-batch}.js` |
| `shift_change_requests` | Proposal, target/manager approvals, source/target dates, shift kinds, extension flags | `lib/server/repo.js` |
| `shift_logs`, `tickets`, `l2_analyzed_tickets` | Person/day log snapshot, tickets created, L2 tickets analyzed with verdict | `lib/server/repo.js`, `lib/server/l2-analyzed-tickets.js` |
| `shift_checklists`, `shift_checklist_items`, `shift_checklist_versions`, `shift_checklist_assignments`, `shift_checklist_events` | Configurable and audited Shift Log checklists (not task checklist) | `lib/server/shift-checklists.js`, `lib/checklists.js` |
| `shift_log_backfill_grants`, `shift_log_backfill_events` | Authorized historical entries and audit | `lib/server/shift-backfill.js` |
| `shift_log_reviews`, `shift_log_review_events` | Monthly shift quality review and audit | `lib/server/shift-reviews.js` |
| `meta` | One-time migration/seed flags | `lib/server/db.js` |

Migrations must preserve old rows and legacy semantics. Key additive migrations in `migrate()`: province, stricter sessions (legacy sessions revoked once), `tasks.review_required` and soft deletion/creation/completion fields, Shift Log checklist metadata, `shift_change_requests.target_date` and destination-upgrade flags (old requests default to false), review tables and structured task transitions. Test upgrade paths on isolated **temporary** SQLite files; no production database writes during tests.

## 5. Main workflows and code ownership

### 5.1 Task lifecycle and atomic report writes

`Backlog → To Do → In Progress → Review → Done`; also `Blocked`, `Returned`, `Cancelled`. `lib/workflow.js` defines allowed transitions by assignee/manager/observer, including direct `In Progress → Done` only when manager explicitly disabled review. Approval/return is manager-only for an eligible reviewer; the assignee cannot approve their own work. The work-report UI is split across `TaskDetail`, `TaskWorkPanel`, `TaskReviewPanel`, `TaskJourney`; the five-step progress is derived from **saved** fields by `lib/task-journey.js`.

The PATCH handler `app/api/tasks/[id]/route.js` enforces legal state and report requirements, then calls `lib/server/repo.js::commitTaskUpdate()`. That transaction checks `expectedStatus`, `expectedAssignee`, and optional `expectedRevision`, persists work report/return reason/history, and rejects stale conflicts atomically. Retain prior-task compatibility: old completed/review tasks are not given invented work reports. Deletion by eligible creator is soft, with audit history retained.

### 5.2 Shift roster, log, checklists, coverage

`lib/shifts.js`: `morning` 07:30–15:15 (7.75h), `evening` 07:30–20:00 (12.5h, «تا هشت»), `night` 20:00–08:00 (12h); `off`/`leave` are zero-work day statuses. `replaceDayShiftAssignments()` in `lib/server/shift-batch.js` validates no duplicate person and saves all five categories in one transaction. `importShiftDays()` does all approved import days in one transaction. `setShiftSchedule()` / `setDayStatus()` refuse started-log conflict.

`lib/roles.js::isShiftEligible()` includes analyst/engineer in SOC L1/L2/L3 and Design & Automation. `lib/shift-log-mode.js` selects duties **by date/roster shift before team**: `evening`/`night` operational; L2 `morning` ticket analysis; L3/Design `morning` engineering; other morning operational. `lib/server/repo.js::getShiftLog()` creates a day/person snapshot when a shift exists, handles version refresh only before progress, while `updateActivity()` rejects stale checklist item IDs.

Checklist definitions and versions: `lib/checklists.js` validates types, shift applicability, legacy activity IDs; `lib/server/shift-checklists.js` manages CRUD, versioning, team assignment, audit. See `design/SHIFT_CHECKLISTS.md`. Returning a prior incomplete shift and backfill are separate capabilities: `shift-backfill.js` and `shift-log-admin.js`, plus manager queue in `components/screens/dashboard/ReturnedShifts.js`.

### 5.3 Analytics / exports

`lib/server/analytics.js::scopeFor()` builds access scope; `factsFor()` gathers scoped database facts; `lib/analytics/metrics.js` aggregates and derives results; `lib/analytics/periods.js` chooses Jalali ranges/comparisons, `filters.js` parses URL state, `config.js` owns alert/scoring thresholds. Client `AnalyticsContext.js` stores filters in URL, `AnalyticsFrame.js` wraps screens, `chartOptions.js` makes ECharts options. Report exports: `lib/server/analytics-export.js` for analytics workbook and `lib/server/monthly-report-{data,styles}.js` + `monthly-report.js` for detailed ZIP (HTML + Excel). The `/api/analytics/monthly-report` endpoint enforces manager scope; test both authorization and correct totals, including L2 verdicts and Design & Automation shifts.

### 5.4 Authentication, permission, localization, UI

`lib/server/auth.js`: `so_session` cookie; session is max **12h absolute** and **8h idle**, updated **only** by `POST /api/auth/activity` based on user interaction, not background polling. `lib/session-policy.js` holds deadlines; `lib/server/login-rate-limit.js` handles repeated failed attempts. A fresh database requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` to bootstrap one Security Manager. Use `getCurrentUser`/`requireUser` and central `lib/roles.js` policies when adding routes.

`I18nProvider.js` switches Persian/English with cookie `so.locale`, sets `lang` and RTL/LTR, and `lib/i18n/messages.js` maps product copy. Preserve user-authored text unchanged. `styles/tokens.css` defines design variables; `styles/themes.css`, `styles/rtl.css`, `styles/shell.css`, `styles/screens.css`, `styles/analytics.css` and component CSS modules implement visuals. `design/DESIGN_SYSTEM.md` is the detailed style reference; `design/SCREENS.md` is screen design reference (may lag code). Translate **UI strings**, not canonical DB/team/role codes.

## 6. File/feature dependency checklist

Before completing a change, consider these downstream consumers **only if the affected contract changes**:

| Change | Also inspect / update if relevant |
|---|---|
| Shift type, eligibility or hours | `lib/shifts.js`, `lib/shift-log-mode.js`, `lib/server/stats.js`, `lib/server/reports.js`, `lib/server/analytics.js`, `lib/server/monthly-report-data.js`, import + locale, roster tests |
| Shift swap behavior / status / field | `lib/server/repo.js`, `lib/server/db.js` migration, `/api/shift/changes`, `ShiftChanges.js`, roster/calendar UI, `tests/shift-operations.unit.test.mjs`, this runbook |
| Checklist item JSON or completed status | `lib/checklists.js`, `lib/server/shift-checklists.js`, `lib/server/repo.js`, `ShiftLog.js`, `ShiftChecklists.js`, daily stats, reports, legacy migration tests |
| Task lifecycle or work-report payload | `lib/workflow.js`, `lib/task-journey.js`, `app/api/tasks/[id]`, `lib/server/repo.js`, `TaskWorkPanel.js`, `TaskReviewPanel.js`, task E2E + unit tests |
| Roles/member/team/province | `lib/roles.js`, `lib/server/access.js`, relevant API, `components/shell/nav.js`, `lib/server/analytics.js`, observer and authorization tests |
| Analytics metric formula or scope | `lib/analytics/{config,metrics,performance,periods}.js`, `lib/server/{analytics,stats,analytics-export,monthly-report-data}.js`, affected charts and unit tests |
| Display text or locale | `lib/i18n/*`, `I18nProvider.js`, RTL CSS, `tests/i18n-core.*` |
| Database field / table | `lib/server/db.js::migrate()`, all readers/writers, fresh-db and upgrade tests; preserve existing production data |

## 7. Frequently confused concepts

- `evening` is an **extended daytime shift until 20:00**, not a night shift. It is distinct from `night` (20:00–08:00).
- `off` is a personal planned rest day; `leave` is leave; center holiday is a **date-level** marker that does not imply either.
- Shift calendar is `/shift/schedule`, exchange requests `/shift/changes`, **daily log** `/shift`, managerial corrections `/shift/manage`.
- Task checklists (`checklist_items` and `/api/tasks/[id]/checklist`) are **not** configurable SOC Shift Log checklists (`shift_checklists` / `/api/shift/checklists`).
- `tickets` (created by a shift worker) are **not** `l2_analyzed_tickets` (L2 FP/TP analysis).
- A scheduled shift is **not** automatically a completed Shift Log; backfilled/historic entries have their own permissions.
- Monthly review scores are different from routine completion, logged time, and statistical figures.
- `observer` may inspect appropriate analytics but cannot mutate operational data or manage people.
- The latest GitHub `main` is not the same as the user's **offline deployment**; pushing/merging code does not update an offline server.

## 8. Local development and verification

```bash
npm ci                          # Node >=22.13.0; lockfile is committed
npm run dev                     # local Next development
npm run build                   # production compile
npm run test:unit               # all Node unit tests
npm test                        # unit + Playwright end-to-end (needs production build)
npx playwright test tests/shift-roster.spec.js
npx playwright test tests/task-flow-ui.spec.js
npm run demo:monthly-report     # isolated fictional DB under test-data/, not production
```

**Playwright:** `playwright.config.js` uses a temporary database under the OS temp directory, one worker and a test-only admin, and starts a production server on port 3100; run `npm run build` first. Install Chromium with `npx playwright install chromium` if needed, or set `CHROMIUM_PATH` for system Chrome. Test scripts are in `package.json`; CI `.github/workflows/shift-feature-ci.yml` runs `npm ci`, `npm run test:unit`, `npm run build`, `npx playwright test` on PRs targeting `main`.

**Fastest confidence ladder:** (1) related unit test(s); (2) `npm run test:unit`; (3) production build; (4) focused Playwright spec; (5) full Playwright for cross-feature or release changes. Do not claim a test passed unless it was actually executed and its result observed. For a doc-only PR, validate paths/links against Git tree, formatting and examples; full runtime suite is generally unnecessary.

**Environment:** `.env.example` documents `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `COOKIE_SECURE`, `DATABASE_PATH`; `PORT` can change the server port. `node:sqlite` persists locally; backup the database **and** adjacent uploads before deployment. Never commit `.env`, user data, demo credentials used outside tests, or database backups. `scripts/configure-preview-admin.cjs` is limited to an explicit preview DB and performs a backup; avoid pointing it at production.

## 9. Existing deep references (read selectively)

| Document | When needed |
|---|---|
| [`README.md`](../README.md) | End-user product behavior, runtime setup, the published high-level feature description. |
| [`design/ANALYTICS.md`](../design/ANALYTICS.md) | Metrics, fairness/comparison/alert design decisions. |
| [`design/SHIFT_CHECKLISTS.md`](../design/SHIFT_CHECKLISTS.md) | Checklist versioning, per-SOC-layer assignment, historic logs. |
| [`design/TASK_WORKSPACE.md`](../design/TASK_WORKSPACE.md) | Task detail layout/steps, save semantics, accessibility and test labels. |
| [`design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md) | Tokens, themes, visual design and accessibility. |
| [`design/SCREENS.md`](../design/SCREENS.md) | Broad screen design reference; verify against current components. |
| [`design/IMPLEMENTATION_REPORT.fa.md`](../design/IMPLEMENTATION_REPORT.fa.md) | Persian narrative of configurable SOC checklists. |
| [`SHIFT_EXCHANGE_RUNBOOK.md`](SHIFT_EXCHANGE_RUNBOOK.md) | **Current authoritative code map and regression cases** for cross-date and morning-to-20:00 swaps. |

## 10. Handoff and maintenance template

Add a small section to each change/PR so the *next* agent does not need a full diff:

```text
Area / user-visible change:
Entry points changed:
Server policy / data contract changed:
Schema migration (yes/no; old data preserved?):
Related tests added/updated and actual results:
Risks and negative cases:
Deployed? (GitHub main / online server / offline server — separate states):
Guide/runbook updates:
```

**Maintenance rule:** when a new feature lands, add one row to §2, note its API or data owner in §§3–4, add a test pointer and update any violated invariant; do not dump full file contents into this guide. The **latest code always wins** over a stale guide. Keep this map navigable and intentionally concise at the top so future agents can stop reading as soon as they have the relevant paths.
