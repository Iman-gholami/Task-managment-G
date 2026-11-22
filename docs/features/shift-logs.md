# Shift logs, checklists, and reviews

Open `/shift` for the current shift, `/shift/history` and `/shift/view` for recorded logs, and `/shift/manage` and `/shift/checklists` for manager tools. Returned shifts also appear on the dashboard. Monthly reviews are available in analytics.

| Change | Start here |
|---|---|
| Log, completion, and corrections | `components/screens/{ShiftLog,ShiftLogManager}.js`, `app/api/shift/route.js`, `lib/server/repo.js` (`getShiftLog`, `findShiftLog`, `updateActivity`, `setShiftCompleted`), and `shift-log-admin.js` (`managerUpdateShiftActivity`). |
| Duty and checklist snapshots | `lib/shift-log-mode.js` (`shiftLogMode`), `lib/checklists.js` (`activitiesForShift`, `legacyActivityNumber`), and `lib/server/shift-checklists.js` (`activeChecklistFor`, `saveChecklist`, `setAssignment`). |
| Checklist admin | `components/screens/ShiftChecklists.js`, `app/api/shift/checklists/`, and `app/api/shift/checklist-assignments/`. |
| Returned shifts and historical entry | `components/screens/dashboard/ReturnedShifts.js`, `app/api/shift/backfill/route.js`, and `lib/server/shift-backfill.js` (`isBackfillAllowed`, `setBackfillDays`). |
| Created and analyzed tickets | `app/api/shift/tickets/` and `repo.js` (`addTicket`) for creation. `components/screens/L2AnalyzedTickets.js`, `app/api/shift/analyzed-tickets/`, and `lib/server/l2-analyzed-tickets.js` (`saveAnalyzedTicket`, `analyzedTicketSummary`, `analyzedTicketReport`) for verdicts. |
| Monthly quality reviews | `app/api/shift/reviews/`, `lib/server/shift-reviews.js` (`listShiftReviews`, `saveShiftReview`), and `lib/analytics/performance.js` for the scoring consumer. |

Rostered SOC L1–L3 and Design & Automation staff with an eligible role can log work. Morning L2 uses ticket analysis. Morning L3 and Design & Automation use engineering duties, with an engineering default and support for a custom L3 checklist. Extended and overnight duty use the active L1 checklist or the built-in operational coverage fallback. See `checklistForShift` in `repo.js` for precedence.

Logs copy their activities per person and date. Started records retain their snapshot. Empty logs can follow new checklist assignments or versions. Stale item writes return the current log with HTTP 409. Submission locks the record for staff. Managers can correct submitted logs, and backfill grants allow entry for a specific eligible historical date. L2 ticket analysis tracks true and false positives separately from created tickets. Duplicate ticket numbers are rejected within the same analyst and date. Authorized managers can correct verdicts after submission. Monthly quality reviews are recorded once per eligible analyst and Jalali month.

**Verify** with `checklists.unit.test.mjs`, `shift-checklists.unit.test.mjs`, `shift-duty-modes.unit.test.mjs`, `review-backfill.unit.test.mjs`, and `l2-analyzed-tickets.unit.test.mjs`. Run the matching `.spec.js` suites for browser coverage. See [test commands](../development.md#testing) and the [original checklist design](../../design/SHIFT_CHECKLISTS.md).
