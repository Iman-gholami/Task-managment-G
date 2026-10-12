# Shift Log checklists

Configurable checklists for the SOC Shift Log. Each SOC layer (SOC · L1, L2, L3) uses one checklist; SOC Managers and
Security Managers define the checklists and choose which layer uses which. Analysts tick their own items in today's
Shift Log, exactly as before.

> Code: `lib/checklists.js` (shared model and validation), `lib/server/shift-checklists.js` (storage, versions,
> assignments, audit trail), `lib/server/repo.js` (`getShiftLog`, `updateActivity`), `app/api/shift/checklists/…`,
> `app/api/shift/checklist-assignments`, `components/screens/ShiftChecklists.js`, `components/screens/ShiftLog.js`.

## What existed before

- One hard-coded routine (`TEMPLATE` in `lib/server/repo.js`) of eight activities, used by **every** SOC analyst
  (L1, L2 and L3), not only L1. Three items appeared only on extended ("Until 20:00") shifts.
- A Shift Log is one row per analyst per day (`shift_logs`, `UNIQUE(user_id, date)`) holding a JSON copy of the
  activities and their completion. Completion was therefore already personal and per shift.
- Reports and analytics read per-activity figures by activity number 1–8.

The feature keeps that model and makes the routine configurable instead of building a second shift log module.

## Data model

| Table | Purpose |
|---|---|
| `shift_checklists` | A checklist: name, description, current `version`, `archived_at`, who created and last changed it |
| `shift_checklist_items` | Its items, in `position` order: title, guidance (`hint`), type (`kind`), the shifts it applies to (`shift_types`), `active`, `removed_at`, and `legacy_n` (the item's activity number 1–8 in the original routine) |
| `shift_checklist_versions` | A snapshot of every saved version (name, items, change summary, who, when) |
| `shift_checklist_assignments` | One row per group: which checklist it uses and whether it is `enabled` |
| `shift_checklist_events` | Audit trail: created, saved (version and summary), assigned, unassigned, enabled, disabled, archived, migrated |
| `shift_logs` (new columns) | `checklist_id`, `checklist_version`, `checklist_name`, `team`: what the log was created from |

Item types reuse the behaviour the Shift Log already had: **Standard** (`basic`), **Monitoring** (`monitor`, clean pass
or report an issue), **Traffic report** (`report`, counted in reports), **IOC sharing** (`misp`, IOC count + Bale +
MISP reference, counted in reports) and **File upload** (`files`).

## Rules

1. **A log copies its checklist.** When an analyst's log for a day is created, the active items of their group's
   checklist that apply to that shift type are copied into it (`activitiesForShift`). Completion lives in that copy,
   which belongs to one analyst and one day, so ticking an item never affects a colleague or another shift, and every
   new shift starts unticked.
2. **Started logs never change.** Saving a checklist creates a new version; existing logs keep the version they were
   created from. Once an analyst has recorded anything (an item, an issue, IOCs, a note or a ticket) or the log is
   submitted, its items are fixed.
3. **Unstarted logs follow the group.** While today's log is still empty it follows the group's current checklist,
   so a manager's change (a new checklist, a new version, turning it off) applies straight away to analysts who have
   not started. *This replaces the earlier spec line "changes apply from the next day"; see Decisions.*
4. **Stale pages cannot tick the wrong item.** Each write names the checklist item it targets (`itemId`). If the log was
   refreshed in the meantime, the server answers `409 { stale: true, log }` and changes nothing; the Shift Log then
   shows the current checklist.
5. **Concurrent editing is safe.** A save names the version it was based on; if someone saved since, the save is
   refused (`409 { conflict: true }`) instead of overwriting their work.
6. **Removing and deactivating.** *Inactive* items stay in the checklist but are left out of new logs. *Removed* items
   disappear from the checklist (kept in the database and the version snapshots). Neither touches existing logs.
7. **Groups.** A group with no checklist, or with its checklist turned off, gets logs with no items; analysts see a clear
   empty state and can still record tickets and submit. A checklist in use must keep at least one active item, a
   checklist with no active items cannot be turned on for a group, and only a checklist no group uses can be archived.
8. **Permissions** are enforced in the API (`requireChecklistManager`): only SOC Managers and Security Managers can read
   or change checklist definitions and assignments. Analysts receive their checklist only through their own Shift Log.
   Manager corrections to a log (`/shift/manage`) are stamped with `correctedBy` / `correctedAt`; ticking an item records
   `doneAt`.

## Migration (first start after upgrading)

`seedStandardChecklist` (in `lib/server/db.js`) runs once, inside the start-up transaction:

- creates **Standard SOC routine**, version 1, with the eight original items in order, the same types, the same
  extended-shift-only items and `legacy_n` 1–8;
- assigns it, enabled, to **SOC · L1, SOC · L2 and SOC · L3**, the groups that used the built-in routine;
- records the migration in the audit trail.

Existing shift logs are not modified. Logs created before the upgrade have `checklist_version = NULL` and read as the
"Built-in SOC routine". Nobody's Shift Log changes until a manager configures something.

## Reports and analytics

Per-activity columns (SOC Shift Activity Report, analytics SOC screens) describe the eight activities of the standard
routine, matched by their historical number (`legacyActivityNumber`), not by position. Items added through the editor
(and copies of the standard items in another checklist) count toward completion, IOC and traffic-report totals, but not
toward a standard activity column. This also fixes an earlier inaccuracy: morning and night logs skip some activities,
so position-based counting attributed them to the wrong column.

## API (managers only)

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/shift/checklists` | `{ checklists, groups }` |
| POST | `/api/shift/checklists` | `{ name, description?, copyFrom? }` → `201 { checklist }` (not used by any group yet) |
| GET | `/api/shift/checklists/:id` | `{ checklist, versions, events }` |
| PUT | `/api/shift/checklists/:id` | `{ version, name, description, items: [{ id?, title, hint, kind, shiftTypes, active }] }` → next version |
| DELETE | `/api/shift/checklists/:id` | Archive (only when no group uses it) |
| GET / PUT | `/api/shift/checklist-assignments` | `{ team, checklistId?: number \| null, enabled?: boolean }` |

Analysts keep using `PATCH /api/shift` (`{ n, itemId, patch }`); `itemId` is optional for older clients.

## Screen: `/shift/checklists` (Shift Schedule › Log checklists)

- **Groups**: one card per SOC layer with its checklist (select), on/off switch, status, analyst count and active items
  per shift. Switching or turning off a checklist asks first and says what happens to started logs.
- **Checklists**: list with item count, version and the groups using each.
- **Editor**: name, description, version, last saved, groups. Items in display order, each with title, type, shifts
  (Morning / Until 20:00 / Night), active switch and guidance. Reorder by drag handle, arrow buttons or Alt + ↑/↓.
  New/Edited/Standard #n badges, a "removed when you save" strip with Undo, a sticky save bar with the pending change
  summary, inline validation, and protection against losing unsaved edits (switching checklist, links, closing the tab).
- **Change history**: the audit trail with who and when.

## Decisions and assumptions

- **Groups are the SOC layers.** Only SOC · L1/L2/L3 analysts keep a Shift Log in this product, so those are the
  assignable groups. "Shift group" differences (morning / until 20:00 / night) are expressed per item, as the original
  routine already did.
- **L2 and L3 keep the standard routine after the upgrade**, because that is what they used. The request described the
  routine as Layer 1's; moving L2 or L3 to their own checklist is a manager action, not something the migration guesses.
- **Changes reach unstarted logs the same day** (rule 3) rather than "from the next day" as an earlier spec said: a
  checklist assigned during a shift should be visible to analysts who have not begun, and started logs are protected
  either way.
- **Copies do not inherit activity numbers**, so per-activity reports keep describing only the standard routine.
- **No shared completion.** Nothing in the product suggested team-shared checklists, so completion stays per analyst.
