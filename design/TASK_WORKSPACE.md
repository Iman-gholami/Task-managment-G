# Task page: workspace with progress rail (option A)

Status: approved option A of three mockups (A workspace + rail, B one-column checklist, C dashboard + wizard).
Scope: `/tasks/[id]` for every role. UI only.

## Why

Assignees found the task page hard to follow: the next action was a lone button, while the checklist,
files and conversation sat behind collapsed sections. Managers had no quick way to see where a task stood.
The page should show the whole task at a glance, keep the report step by step, and make finished steps
feel finished.

## Constraints

- No API, database or workflow change. `lib/workflow.js` and the server keep enforcing every rule;
  the page only rearranges what it already receives (`task` + `details`).
- Never invent data. Progress, dates and counts come from stored fields (`status`, `startedAt`,
  `completedAt`, `report`, `checklist`, `attachments`, `comments`, `events`, `reviewReturns`). There is no
  stored "submitted at" or "created at" in the details payload, so those stages show no date.
- Keep the accessible names the team and the test suite rely on: Start, Resume work, Unblock, Continue,
  Back, Save draft, Review submission, Submit for review, Complete task, Approve, Return for changes,
  Send back, Check task, Reopen, the field labels (What did you do?, What was the outcome?, Total hours,
  Quality, Confirm complexity, What needs to change?, New comment, New checklist item) and the section
  headings (Your task journey, Waiting for review, Review the submitted work).

## Layout

1. **Detail bar** (unchanged): back link, ID, quiet actions (Delete, Mark blocked, Cancel), Edit, manager moves.
2. **Outcome panel** for closed tasks (unchanged).
3. **Hero card**
   - Brief: label, title, description, meta row (`.task-brief-meta`: status, priority, deadline, assignee).
   - Progress panel on the right (role and state below).
   - Lifecycle strip: Assigned → Work → Manager review (only when review is required) → Complete, each
     done / current / upcoming. Hidden for cancelled tasks. Vertical below 640px.
4. **Two columns**: main (primary panel) and an **At a glance** sidebar. Below ~960px the sidebar moves
   under the main column.

### Progress panel

| Viewer and state | Panel |
|---|---|
| Assignee, not started | Ring 0%, "Ready to start", "Next: start the task" |
| Assignee, in progress | Ring n/5, "n of 5 steps done", "Next: <step>" |
| Assignee, blocked / returned | Ring n/5 with "Work is blocked" / "Changes requested" |
| Assignee, in review | Check, "Sent to your manager", "Your report is with the reviewer" |
| Reviewer who can approve, in review | Eye, "Your turn", "Ready for your review" |
| Anyone else, open task | Ring n/5, "<Assignee>'s progress" |
| Done or cancelled | No panel (the outcome panel speaks for done) |

### Report steps (the journey model)

`lib/task-journey.js` derives five steps from saved data only:

| Step | Done when |
|---|---|
| Task started | status is past Backlog / To Do |
| Work performed | saved `report.workPerformed` is not blank |
| Outcome & evidence | saved `report.outcome` is not blank |
| Time spent | `report.hoursRecorded` |
| Review & submit | status is Review or Done |

Unsaved typing does not tick a step; Continue and Save draft save, so a step ticks as soon as it is saved.

### Main column

- **Assignee (open task)**: "Your work" section. Header: eyebrow, heading by state, saved status on the
  right. A vertical rail of the five steps:
  - done: green check node, title, "Done", and a two-line preview of what was saved (hidden on the
    final Review & submit step, which shows everything) with an Edit button;
  - active: gradient node, highlighted card with the existing fields and actions;
  - upcoming: outlined node; clickable only while working.
  - Not started: step 1 is active with the Start button. Blocked / returned: the latest return reason and
    the Resume work / Unblock action sit above the rail; the rail is read-only until work resumes.
  - In review: completion chips for all steps and the submitted report.
  - The "Manager review" and "Complete" rows leave the rail; the lifecycle strip shows them.
- **Reviewer (task in review)**: "Submitted report" card with a row per part (work, outcome, total time,
  evidence), each ticked when present or marked "Not recorded" for older tasks, then a "Your decision"
  card (quality, complexity, Approve / Return for changes, return reason form).
- **Everyone else, and closed tasks**: the work report as an open card (with "latest saved draft" wording
  while the task is in progress). Returned tasks keep the "Returned for changes" callout.

### At a glance sidebar

Always open, no collapsed sections:

1. **Checklist**: "n of m" and a progress bar, items (`label.check-item`), add field.
2. **Attachments**: full list with download, remove and attach. When the files are already part of the
   main flow (assignee working, reviewer reviewing), the card lists the names only and points to the step,
   so each file has one set of controls.
3. **Conversation**: the full thread with edit / delete and the composer.
4. **Activity**: the latest five events (`data-testid="activity"`), "Show all" for the rest, then review
   feedback history.
5. **Details**: the editable properties (status, assignee, priority, complexity, deadline, actual hours,
   started, created by, manager review, quality) with the same edit rules as before.

If the details request fails, cards 1–4 are replaced by the existing error state with Try again; drafts in
the composer, comment editor and checklist field are kept, as today.

## Accessibility

- Rails and the lifecycle are ordered lists; the active step and current stage carry `aria-current="step"`;
  completed nodes include visually hidden "Completed".
- The ring is `role="img"` with a label such as "Report 40% complete, 2 of 5 steps".
- Step edit buttons are named per step ("Edit work performed").
- Contrast follows the theme tokens; the layout has no horizontal scroll at 390px.

## Testing

- Unit: `tests/task-journey.unit.test.mjs` for steps, percent, next step and lifecycle states.
- E2E: `tests/task-page-overview.spec.js` covers the start state, step ticks and hero progress after saves,
  a manager watching progress, the reviewer layout, a review-exempt lifecycle, and a narrow screen.
- Existing suites keep passing. Specs that opened the removed "Task overview & activity" section now use
  the always-visible Details card directly.

## PR #44 shared-task extension

The original five-step rail still handles solo tasks. The collaborative panel reuses the same
`TaskFlowStep` pattern, with each person's **own** Start → Work performed → Outcome & evidence →
Time spent → Review & handover rail. Typing does not complete a step; saved data and per-person
`hoursRecorded` control the checkmarks. A compact team progress strip counts submitted reports,
and a disclosure row per person shows actual status, planned work (if supplied), and five separate
checkpoint segments (filled only for that person's saved stages). The row keeps identity, status
and an explicit progress count scannable; expansion reveals the full brief, report, hours, links
and any authorized manager actions. There are no permanently expanded duplicate member cards.

Two collaboration modes intentionally differ:

- **Free:** The creator selects the whole team, minimum two, without choosing any primary assignee.
  An optional work scope can be entered for each person. Every participant can start and submit
  independently. Only when **all active members** have submitted does the combined report enter
  manager review. If the manager returns it, all active reports reopen for individual corrections.
  Internal DB ownership is not shown as a designated lead on the create form or task detail.
- **Split:** A coordinating lead and every person's responsibility are explicit. Each participant
  independently starts and submits a report; a manager can approve or request changes per part.

The dashboard and personal task queue both count collaborative tasks where the user is a participant,
even when the internal `tasks.assignee` is someone else. Review is mandatory for both modes. Existing
free-mode API clients with `a` and collaborator list remain accepted during migration.

## Subtasks and independent promotion (post-PR #44)

The main task workspace has a **Work packages / زیرتسک‌ها** panel ahead of the work report.
Its connected branch cards encode a real parent/child relationship (not ordered execution), with
an owner, explicit next action, status, deadline, and a direct open/review link. Overview counters
show all, active, attention-needed, and completed work; the list can be filtered by stage without
changing the task status. The top progress bar is the
ratio of **currently linked** children in `done` state; promoted children form a separate
compact provenance list and do not inflate that percentage. The parent remains free to
continue through its own workflow and does not inherit child hours automatically.

- A scoped task reviewer/manager can add a child even after the parent has started (`progress`,
  `blocked`, or `returned`), as long as the parent is **not** in review, completed or cancelled.
  Creation is a two-section modal with a live assignee preview: deliverable title, optional scope,
  owner and Jalali deadline; priority/complexity inherit the parent's values and can be adjusted from
  the child's own detail page. Each child has a fresh task ID, own status, activity, report,
  evidence, hour total, review and assignment notification.
- A child assignee sees it as a normal assigned task. A context banner explains their own
  start/report/evidence workflow and links to `#task-work` on the existing TaskWorkPanel;
  no duplicate start transition is introduced. If the parent is independently visible, the
  banner links back to it; a child assignment alone **never grants access** to confidential
  parent/sibling details. Promoted tasks instead show a preserved-origin explanation.
- **Promote to independent task / تبدیل به تسک مستقل** is available to an eligible manager
  on a child row and asks for confirmation. The operation clears only the live parent link,
  preserves the same task ID and all previously saved information, records audit on both
  tasks and keeps the old parent visible as provenance when permitted. A repeat operation
  returns conflict rather than creating a duplicate task. No task-hours migration happens.
- Only one nesting level is allowed. A promoted root can later have children of its own.
  Deleted children follow existing soft-delete policy and no longer count in the branch.

Tests: `tests/task-subtasks.unit.test.mjs` for persisted lifecycle and audit integrity;
`tests/task-subtasks.spec.js` for endpoint authorization, creation/promotion, and UI entry.
