# Tasks and review

Open `/tasks/my` for assigned work, `/tasks/team` for the team view, and `/tasks/assigned` for managers to track work they assigned to others. The assigned view groups tasks by assignee and offers Open, Needs review, Overdue / Blocked, Done, and All tabs. `/tasks/all` redirects to `/tasks/team`. Use `/tasks/[id]` for detail.

| Change | Start here |
|---|---|
| Lists, board, assignment | `components/screens/Tasks.js`, `components/TaskTable.js`, `components/CreateTaskModal.js`, `components/AppProvider.js`, and `app/api/tasks/route.js`. |
| Review and status | `components/screens/TaskDetail.js`, `app/api/tasks/[id]/route.js` (`PATCH`), `lib/workflow.js` (`allowedTransitions`, `canTransition`), and `lib/server/repo.js` (`createTask`, `commitTaskUpdate`, `addEvent`). |
| Visibility | `lib/server/access.js` (`canViewTask`, `listVisibleTasks`, `viewableTask`, `editableTask`) and `lib/roles.js` for assignment scope. |
| Checklists, comments, attachments | `app/api/tasks/[id]/{checklist,comments,attachments}/`, `repo.js` (`getTaskDetails`), and `lib/server/uploads.js` for attachment bodies. |

The normal flow is Backlog → To Do → In Progress → Review → Done, with Blocked, Returned, and Cancelled paths. A manager approves with quality and final complexity or returns the task. Managers can reopen approved work. SOC Managers and Security Managers can waive review when creating a task or change the requirement on an open task within their scope before it enters review. This applies to tasks assigned to themselves or to others. Reassignment restores the review requirement. When review is waived, the assignee can move the task directly from In Progress to Done after recording work performed, outcome, and total hours. Direct completion leaves the quality rating empty. When review is required, managers cannot approve their own work.

Structured transitions and completion dates feed [reporting](reporting.md) and [analytics](analytics.md). Task attachments are limited to 20 MB and use task visibility checks. See [storage](../development.md#database-and-upgrades).

**Verify** with `app.spec.js` for assignment, review, record visibility, and attachments. Use `review-backfill.spec.js` for review waivers on manager and analyst tasks and `weighted-score.unit.test.mjs` when changing approval or transitions. See [test commands](../development.md#testing).
