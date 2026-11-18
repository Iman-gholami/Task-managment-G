# Shift Exchange — Rules, Code Paths, and Regression Runbook

> **Verified baseline:** `main` at `e65a9884d76470412e1d19e1a86e98be6f4b50e7` (2026-11-18). This documents the behavior implemented by the adjacent-day/off-day and morning-to-20:00 exchange changes (PRs #36 and #38). **Read this before changing shift swap logic.** Recheck current code if HEAD has advanced.

## 1. Intent and vocabulary

Analysts exchange their **scheduled work assignments**, not just the display label. A work day can be `morning` (07:30–15:15), `evening` (07:30–20:00, Persian «شیفت تا هشت»), or `night` (20:00–08:00). `off` («تعطیل شیفت») and `leave` («مرخصی») are distinct **personal non-working** date markers. `shift_center_holidays` is a separate organization-wide marker and does not prevent staffing.

An exchange has **two source positions** and **two destination positions**:

| Position | Meaning | Record before exchange |
|---|---|---|
| `(requesterId, date)` | Requester's work shift to give up | Required work shift |
| `(targetId, targetDate)` | Other analyst's work shift to give up | Required work shift |
| `(requesterId, targetDate)` | Requester's incoming destination | Free, `off`, or *eligible* morning extension |
| `(targetId, date)` | Other analyst's incoming destination | Free, `off`, or *eligible* morning extension |

The result puts the first person on the target's `targetDate` with `targetShift`, and the target on the requester's `date` with `requesterShift`. The source records are removed or updated atomically. **No one may have two work shifts on one date.** For same-date swaps the two shift types are exchanged in place; the cross-date destination checks do not apply.

### Current business rule in one paragraph

Cross-date swaps are permitted when a destination is empty or `off`. Existing `off` markers **move from the incoming date to the date the person vacated**, preserving the actual known off-day without inventing another. `leave` and unrelated work assignments block exchange. **One narrow exception:** if the incoming shift is `evening` and the destination already contains `morning`, the morning assignment can be **upgraded** to `evening` (replaced, not duplicated), but the other analyst must first accept the request and then a manager must approve it. Started Shift Logs, changed source schedules, and changed destination conditions block approval. This rule is enforced on the server, not merely by form validation.

## 2. Read only these code paths first

| Step | File and function | Specific responsibility |
|---|---|---|
| User selects dates, previews conflicts, acts | `components/screens/ShiftChanges.js` | Fetches roster/request data, filters future dates, derives `swapConflict`, `destinationUpgrades` and `offDaysWillMove`, submits POST/PATCH, shows statuses/actions. Styling: `ShiftChanges.module.css`. |
| HTTP API | `app/api/shift/changes/route.js` | `GET` request list (analyst sees involved requests, manager sees all); `POST` creates (eligible analyst); `PATCH` performs `accept`, `approve`, `reject` or `cancel`. Returns `201`/JSON, `401`, `403`, `400`, `409` as applicable. |
| Source-of-truth creation | `lib/server/repo.js::createShiftChangeRequest()` | Validates parties/dates, source scheduled shifts, destination positions and duplicate open request, stores type snapshots and destination-upgrade booleans. |
| Destination validator | `lib/server/repo.js::assertSwapDestinationAvailable()` | Accepts empty, `off`, or `morning` + incoming `evening` when not started. Rejects `leave` and all other occupied work positions. Reused during creation and approval. |
| State transition and permissions | `lib/server/repo.js::actOnShiftChange()` | Runs inside `BEGIN IMMEDIATE` transaction; determines who may accept, approve, reject, cancel; enforces mandatory target consent for any morning extension. |
| Actual schedule edit | `lib/server/repo.js::applyShiftChange()` | Rechecks unchanged source/destination, started-log locks, deletes empty log placeholders, moves off markers, inserts new shifts or updates morning to evening, approves request, cancels conflicting pending requests atomically. |
| Schema and upgrade | `lib/server/db.js` | `shift_change_requests` fields; additive `target_date` and `*_destination_upgrade` columns; `shift_schedules`, `shift_day_statuses`, `shift_logs`. |
| Shared definitions | `lib/shifts.js`, `lib/roles.js` | `isIsoDate`, work/absence types, Tehran today, shift eligibility and manager policy. |
| Nearby roster write path | `lib/server/shift-batch.js`, `app/api/shift/schedule/route.js` | Other manager edits may occur between proposal and approval; must not bypass revalidation. |
| Regression | `tests/shift-operations.unit.test.mjs` | Cross-day off swaps, no fabricated off, leave/work conflict, changed schedule, existing morning extension, missing target consent, started logs, forbidden morning-to-night. |

Do not start with all 312 project files. Usually `ShiftChanges.js`, `app/api/shift/changes/route.js`, `lib/server/repo.js`, and the focused unit spec are enough to understand a swap bug. Read `db.js` if persisted fields change, `shift-batch.js` if roster interaction changes, and analytics/reports only when the meaning of assignments or hours changes.

## 3. Persisted shape and request state machine

`shift_change_requests` stores:

- `id`, `requester_id`, `target_id`, `date`, `target_date`;
- captured `requester_shift` and `target_shift` (the original work shifts; used for stale-schedule detection);
- `requester_destination_upgrade` and `target_destination_upgrade` (boolean stored as SQLite integer); **these fields record the proposed morning extension at request creation**;
- optional `reason`;
- `status` in `pending_target`, `pending_manager`, `approved`, `rejected`, `cancelled`;
- `target_approved_at/by`, `manager_approved_at/by`, `resolved_at`, `created_at`.

The client receives camelCase values via `getShiftChangeRequest()` / `toChangeRequest`: `requesterId`, `targetId`, `requesterName`, `targetName`, `date`, `targetDate`, `requesterShift`, `targetShift`, `requesterDestinationUpgrade`, `targetDestinationUpgrade`, `reason`, `status`, approval timestamps/actors.

**Creation payload** (`POST /api/shift/changes`):

```json
{
  "targetId": "the-other-analyst-id",
  "date": "YYYY-MM-DD",
  "targetDate": "YYYY-MM-DD",
  "reason": "optional text"
}
```

The requester is the **authenticated user**, not a caller-provided `requesterId`. Dates must be valid ISO days, not in the past according to `repo.today()` / Tehran date. Both parties must be different, active, shift-eligible SOC staff and have scheduled source work shifts on their chosen dates. Pending overlapping exchanges are rejected.

**Action payload** (`PATCH /api/shift/changes`):

```json
{ "id": 123, "action": "accept" }
```

Replace `accept` with `approve`, `reject` or `cancel`. The server does not trust the button state.

| Action | Actor allowed | From status | Result / special rule |
|---|---|---|---|
| `accept` | The **target** analyst | `pending_target` | `pending_manager`, stores target consent. Does not change roster yet. |
| `approve` | SOC Manager or Security Manager | `pending_target` or `pending_manager` | Atomically applies the exchange, becomes `approved`. **If either destination upgrades `morning→evening`, `pending_target` is forbidden; target must accept first.** Ordinary exchanges can be directly approved by a manager. |
| `reject` | The target or a manager | Either pending state | `rejected`; no roster change. |
| `cancel` | The requester | Either pending state | `cancelled`; no roster change. |

**Important UI nuance:** `ShiftChanges.js` disables the manager's direct-approval button while an extension request is `pending_target`, and its form explains that the existing morning shift will be **replaced** after both approvals. No extra checkbox is part of the implemented workflow. The server independently enforces the same condition. For a non-extension request, the UI states that a manager can approve directly.

## 4. Approval algorithm and transaction boundary

`actOnShiftChange(id, actor, action)` wraps every operation in a `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` transaction; approval calls `applyShiftChange()` inside it.

1. Read the saved request; validate pending state and actor permission.
2. If any destination extension flag is true, require prior `accept` (status `pending_manager`).
3. Re-read **both original source shifts**; ensure they still exist and their types match `requester_shift` / `target_shift` captured at creation.
4. Inspect the **four user/date positions** for Shift Log progress using `shiftLogHasProgress()`. This checks completed logs, activity checkboxes/notes/issues/IOCs, analyzed L2 tickets, and created tickets. If any has started, **abort and roll back**.
5. For cross-date swaps, recheck both destinations with `assertSwapDestinationAvailable()`. Their extension outcome must match the saved upgrade flag; a newly occupied date or changed extension agreement cannot slip through.
6. Delete only **empty/unstarted** Shift Log placeholders for those positions (`deleteEmptyShiftLog`). Never delete a progressed log.
7. Same-date: update two `shift_schedules.shift_type` fields in place. Cross-date: delete the two source work assignments; for any destination marked `off`, move its existing `shift_day_statuses` row to that analyst's vacated source date; then add the incoming shift **or update the existing destination morning** to `evening` when the saved extension flag is true.
8. Mark the change request `approved` with target/manager approvals and resolution time; cancel other overlapping pending requests for the affected users/dates.
9. Commit; on any error roll back the **entire** schedule/status/request change. After a rejected approval, the request remains in its previous pending state, and the roster must be unchanged.

**Invariant:** in `shift_schedules`, `UNIQUE(user_id, date)` guarantees a single work assignment; the code must also preserve consistency with separate `shift_day_statuses`. Do not implement extension as `INSERT` of an extra row on a morning date. Replacing a morning shift should use an `UPDATE` of the existing row.

### Failure and collision matrix

| Destination / change | Allowed? | Why / required behavior |
|---|---|---|
| No assignment or day status | Yes | Insert incoming shift. |
| `off` | Yes | Move that **existing** `off` row to the day vacated when applying a cross-date swap. Do not invent `off` when absent. |
| `leave` | **No** | Not interchangeable with an `off` marker; manager must adjust roster first. |
| Existing `night` / `evening` / unrelated working shift | **No** | Prevent double bookings and overwrites. |
| Existing `morning`, incoming `evening`, no log progress | **Yes, conditional** | Snapshot upgrade flag, target analyst must accept, then manager approves; update `morning`→`evening`. |
| Existing `morning`, incoming `morning` or `night` | **No** | Only the extended-shift upgrade is supported. |
| Source shift has been edited/deleted since request | **No** | Detect stale source snapshot; submit a fresh request. |
| Destination changes after request | **No** if extension availability/occupancy changed | Recheck at approval, no partial writes. A newly added `off` is still allowed and moved. |
| Any involved Shift Log contains activity / is completed | **No** | Preserve completed/work-in-progress records, attached tickets and statistics. |
| Open change request already covers the relevant shift | **No** | Avoid competing pending requests. |
| Past date, same person, non-eligible employee | **No** | Server validates identity, dates and eligibility. |

## 5. Required real-world regression scenario (23 / 24 Aban)

This is the user's reported case: **Hadi** holds the 23 Aban `evening` shift; **Ahmad** holds the 24 Aban `evening` shift **and** already has `morning` on 23 Aban. The exact year-to-ISO conversion is intentionally omitted; derive it with the project's Jalali calendar utilities instead of hard-coding a different year's Gregorian dates.

| Person | Day 23 before | Day 24 before | Day 23 after | Day 24 after |
|---|---|---|---|---|
| Hadi (requester) | `evening` | Free/`off` | Free / moved `off` if one existed on Day 24 | `evening` |
| Ahmad (target) | `morning` | `evening` | **`evening` replacing morning** | Free / moved `off` only if one existed on Day 23 |

Workflow:

1. Hadi proposes exchanging his Day 23 shift against Ahmad's Day 24 shift.
2. Creation stores `targetDestinationUpgrade=true`, `requesterDestinationUpgrade=false`; request starts `pending_target`.
3. A manager **cannot** directly approve this extension while pending target consent.
4. Ahmad presses **تأیید**; request becomes `pending_manager`.
5. A manager presses **اعمال**; the atomic operation leaves **one** Day 23 `evening` row for Ahmad, one Day 24 `evening` row for Hadi, and removes the two original source positions. No extra checkbox, no phantom second shift and no stale morning row remain.
6. If any of the four positions gained Shift Log activity while the request waited, approval must fail with no schedule change.

**Test reference:** `tests/shift-operations.unit.test.mjs` test `evening swaps may explicitly extend a pre-existing morning shift, but never double book`. It asserts target consent, the two final rows (`scheduled.length === 2`), started-log locking and rejection of a morning-to-night overwrite.

## 6. Other required regression scenarios

The test `cross-day Saturday/Sunday swaps succeed without conflicts and never overwrite existing duties` in `tests/shift-operations.unit.test.mjs` covers:

- Ordinary Saturday/Sunday exchange: `morning` on Saturday for A and `evening` on Sunday for B → A Sunday `evening`, B Saturday `morning`.
- **Both until 20:00:** A Saturday `evening` + A Sunday `off`; B Sunday `evening` + B Saturday `off`. Exchange succeeds; both work the other day, and off markers land on the original work dates. No collision/duplicate.
- **Only one `off`:** move only the existing marker; do not fabricate the other analyst's off status.
- Destination `leave` blocks proposal, destination `night` blocks proposal, and a second person's occupied destination blocks proposal.
- New `off` introduced **after creation but before approval** still moves properly.
- New `leave` introduced **after creation** blocks approval transactionally; request stays pending and source schedules remain unchanged.

If changing the function signatures or API fields, add/adjust a test for the corresponding negative and positive case, not just the happy path. Re-run both shift operations unit tests and a browser test for the request UI when its messages or button permissions change.

## 7. How to modify this safely

**When the user reports that a seemingly valid swap is blocked:**

1. Gather the exact two users, their **source** dates/types, **destination** dates/types (including off/leave/morning), whether a Shift Log has started, and the status of the approval request. Use ISO dates for persisted checks; don't infer the year from Persian screenshots.
2. Compare the candidate state with the matrix in §4. If already covered, inspect error path and UI preview in `ShiftChanges.js` and `assertSwapDestinationAvailable()`; ensure a stale client view refreshes schedule data.
3. If the requested case is genuinely new, specify the new invariant and both **positive/negative** examples before coding. Consider how `shift_day_statuses`, started `shift_logs`, `tickets`, and two approvals interact.
4. Keep validation at **creation and approval**, and keep all actual schedule changes inside the existing transaction.
5. Update `lib/server/db.js::migrate()` if persistent fields change; old requests must remain safe. Never rewrite historical logs.
6. Run `npm run test:unit` and the relevant E2E specs after `npm run build`. On failure, keep the real error instead of suppressing validation. Update this runbook and `AGENT_CODEBASE_GUIDE.md` if the behavior/owner changes.

**No code-change shortcuts:** do not allow `leave` merely because a user says they are "off"; do not bypass progress checks to make approval succeed; do not transform `morning→night` under the `evening` upgrade exception; do not let manager approval silently override a morning shift without consent; do not treat the `off` marker as if it were a second shift row; do not touch production SQLite data to reproduce a bug.

## 8. Running focused verification

```bash
npm ci
npm run test:unit
npm run build
npx playwright test tests/shift-roster.spec.js tests/shift-calendar-view.spec.js
```

For the shortest loop, the unit suite command in `package.json` includes `tests/shift-operations.unit.test.mjs`. Running that `.mjs` directly needs the same Node flags and module alias hooks used by `npm run test:unit`; do not remove them accidentally. Full `npm test` adds Playwright and expects a production build. The E2E runner starts its own **temporary** SQLite database; never point tests at an offline production DB.

### Handoff checklist after a swap fix

- [ ] User-visible case described as **source day/type + destination day/type**, both parties.
- [ ] Destination `off`/`leave`/work status and started logs explicitly covered.
- [ ] `createShiftChangeRequest` and `applyShiftChange` enforce the same rule; rollback verified.
- [ ] `ShiftChanges.js` preview, consent text, buttons and server authorization agree.
- [ ] Relevant unit regression added and run; build/E2E status reported truthfully.
- [ ] `AGENT_CODEBASE_GUIDE.md` and this runbook updated if contract/invariants changed.
- [ ] GitHub merge versus **offline server deployment** separately reported.

**Related references:** [Guide](AGENT_CODEBASE_GUIDE.md) · [`README.md`](../README.md) · [`design/SHIFT_CHECKLISTS.md`](../design/SHIFT_CHECKLISTS.md) · [`tests/shift-operations.unit.test.mjs`](../tests/shift-operations.unit.test.mjs).
