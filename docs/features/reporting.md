# Dashboard, performance, and reports

Open `/dashboard`, `/performance/overview`, `/performance/employees/[id]`, or `/reports/[report]`.

| Change | Start here |
|---|---|
| Home dashboard | `components/screens/Dashboard.js` and `components/screens/dashboard/` render role-specific screens. `app/(app)/layout.js` supplies `dashboardStats` from `lib/server/stats.js`. |
| Employee and team performance | `components/screens/Performance.js`, `app/api/performance/route.js`, and `stats.js` (`resolvePeriod`, `employeeStats`, `overview`, `teamStats`). |
| Reports and workbook output | `components/screens/Reports.js`, `lib/reports.js` (report keys), `app/api/reports/[report]/route.js`, and `lib/server/reports.js` (`buildReport`, `toXlsx`). |

Performance and standard reports use task completion dates, hours, complexity and quality, scheduled shifts, routines, IOCs, created tickets, traffic reports, and issues. L2 analyzed-ticket verdicts are included in the relevant employee and SOC shift reports. Standard activity columns use checklist legacy activity numbers. Management and personal views have separate access scopes. [Analytics](analytics.md) has its own endpoint, Jalali filters, metric pipeline, and workbook builder.

**Verify** with the dashboard, performance, and report sections of `app.spec.js`, `l2-analyzed-tickets.spec.js`, and `province-observer.spec.js`. See [test commands](../development.md#testing).
