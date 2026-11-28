# Shift scheduling

Open `/shift/schedule` for the roster and `/shift/changes` for shift change requests.

| Change | Start here |
|---|---|
| Calendar, dates, and roster selection | `components/screens/ShiftSchedule.js`, `lib/shifts.js` (`SHIFT_TYPES`, `scheduleStats`, `tehranDate`), and `lib/roster-editor.js` (`rosterCandidates`, `bulkRosterSelection`). |
| Day-wide save, holidays, and absences | `app/api/shift/schedule/route.js`, `lib/server/shift-batch.js` (`replaceDayShiftAssignments`, `updateCenterHoliday`), and `lib/server/repo.js` (`setShiftSchedule`, `setDayStatus`). |
| Excel preview and apply | `components/screens/ShiftExcelImport.js`, `app/api/shift/schedule/import/route.js`, `lib/server/shift-excel.js` (`readShiftExcelFiles`), and `shift-batch.js` (`importShiftDays`). |
| Shift requests | `components/screens/ShiftChanges.js`, `app/api/shift/changes/route.js`, and `repo.js` (`createShiftChangeRequest`, `actOnShiftChange`). |

Each person can have one roster assignment per date. Morning, until 20:00, and night are working shifts. Off and leave are stored separately and contribute zero worked hours. Center holidays are whole-center markers with an optional note. They can coexist with work shifts and existing logs. The manager can save all three working shifts for a day together. A roster change that would invalidate a started log is rejected.

Excel import accepts multiple monthly workbooks, previews staff mappings and conflicts, and atomically applies approved dates. An explicit «تعطیلی مرکز» note sets the center holiday marker. Schedule data determines [shift log](shift-logs.md) eligibility and feeds [analytics](analytics.md) closure and attendance figures.

**Verify** with `shifts.unit.test.mjs`, `roster-editor.unit.test.mjs`, `shift-excel.unit.test.mjs`, `shift-operations.unit.test.mjs`, `shift-roster.spec.js`, and `shift-duty-modes.spec.js`. See [test commands](../development.md#testing).
