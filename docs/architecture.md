# Architecture

Sentinel Ops runs as one Next.js App Router application on Node.js. The same deployment renders pages and serves JSON, downloads, and workbook requests.

1. [Root layout](../app/layout.js) loads fonts, global styles, and theme bootstrap. [Authenticated layout](../app/(app)/layout.js) resolves the session and loads initial viewer, task, member, shift, and dashboard data.
2. Route pages compose screens from [components/screens](../components/screens/) and [components/analytics](../components/analytics/). [AppProvider](../components/AppProvider.js) holds shared client state and the JSON request helper. The analytics subtree has its own provider for data and URL filters. [Shell navigation](../components/shell/nav.js) uses viewer permissions and role.
3. [Route handlers](../app/api/) authenticate requests and enforce scope with shared role and server access helpers. Server-rendered pages also apply their page-level access rules.
4. [Server modules](../lib/server/) own persistence, authorization helpers, and report assembly. [repo.js](../lib/server/repo.js) holds task, member, and core shift SQL. [db.js](../lib/server/db.js) owns schema and startup upgrades. Shared rules in [lib](../lib/) support both server and client. Database modules use the `server-only` marker.
5. SQLite stores application records and attachment metadata. [uploads.js](../lib/server/uploads.js) stores attachment bodies beside the database. See [development](development.md) for lifecycle and operational details.

## Cross-feature dependencies

| Source | Consumers and implications |
|---|---|
| `roles.js`, `auth.js`, `access.js`, `analytics-access.js` | Navigation, task visibility and assignment, shift management, and analytics. Check both the UI and the handler when changing role behavior. |
| Task state and `task_transitions` in `repo.js` | Dashboard and performance totals, time in review, cycle time, and weighted peer scoring. Changing a transition or completion date can change historical calculations. |
| Roster, absences, and date helpers in `shifts.js` | Shift log eligibility and duty selection, roster changes, and reporting denominators. Shift dates use Tehran time. Analytics derives Jalali display and periods from ISO dates. |
| `shift-log-mode.js`, `shift-checklists.js`, and saved log snapshots | The shift editor, history, manager corrections, and activity totals. Statistical columns for standard activities depend on their legacy activity numbers. |
| L2 analyzed tickets and monthly shift reviews | Standard reports consume ticket verdict summaries. Monthly review records feed the same-level peer score in management analytics. |
| `lib/analytics/` filters and calculations | Browser charts and server workbooks share these modules. A change to a filter or metric can change both outputs. |

Shared UI primitives live in [components/ui](../components/ui/) and global styles in [styles](../styles/). Start with the [design system](../design/DESIGN_SYSTEM.md) for tokens, keyboard interaction, and Persian RTL conventions.
