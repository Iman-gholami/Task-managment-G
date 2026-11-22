# Developer documentation

Start with the feature that matches the request. Each guide identifies route entry points, implementation symbols, and tests. Paths in code formatting are relative to the repository root.

| If the request mentions | Start with |
|---|---|
| Login, logout, idle timeout, passwords, member management, observer, province | [Access and members](features/access.md) |
| Assignment, review, approval, reopening, comments, task checklist, attachments | [Tasks](features/tasks.md) |
| Roster, schedule, Excel import, holiday, off, leave, shift change or swap | [Shift scheduling](features/shift-scheduling.md) |
| Shift activity, duties, checklist versions, analyzed tickets, returned shifts, backfill, monthly review | [Shift logs](features/shift-logs.md) |
| Home dashboard, employee performance, standard reports or report Excel | [Performance and reports](features/reporting.md) |
| Jalali analytics, compare, peer score, team medians, province filters or analytics export | [Analytics](features/analytics.md) |
| Layout, shared state, navigation, styling, themes or RTL | [Architecture](architecture.md) and the [design system](../design/DESIGN_SYSTEM.md) |
| Local startup, tests, SQLite, or offline installation | [Development and operations](development.md) |

The [architecture guide](architecture.md) traces dependencies across features. The [design directory](../design/) records interaction specifications, rationale, and implementation history.
