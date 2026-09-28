# Sentinel Ops: Screen Specifications

Each screen has a wireframe and a fixed spec block.
Screens marked **▶** are implemented in the Next.js app, at the route shown (e.g. `http://localhost:3000/tasks/my`).
Shared conventions (states, tokens, components) are in `DESIGN_SYSTEM.md`.

**Global shell (all screens except Login)**
```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ S Sentinel │ [≡] Tasks › Team Tasks          [⌕ Search or jump… ⌘K] 🔔 ☀ │
│            ├──────────────────────────────────────────────────────────────┤
│ ⌂ Dashboard│  Page title                                  [Secondary][Primary]
│ ☑ Tasks    │  subtitle / count                                             │
│   My   5   │                                                               │
│   Team 24  │  ── page content: strip · table · split ──                    │
│   All      │                                                               │
│ ▤ Shift    │                                                               │
│ ⚇ Team     │                                                               │
│ ↗ Perform. │                                                               │
│ ▯ Reports  │                                                               │
│ ⚙ Admin    │                                                               │
│            │                                                               │
│ (SR) Sara  │                                                               │
└────────────┴──────────────────────────────────────────────────────────────┘
 bg (#0B0D12)   surface sheet (#11141B), inset 8px, radius 10
```

**Standard states (they apply unless a screen overrides them)**
- **Loading**: the page head renders immediately, the metric values show skeleton bars, and tables show 8 skeleton rows that keep the real column widths. Never use a full-screen spinner.
- **Error**: an inline error panel replaces only the failed region, showing the cause in plain words plus **Retry** and **Go Back**. A 403 shows "You don't have access" with **Contact Administrator**.
- **Empty**: a glyph tile, a heading, one sentence, and at most one action.

---

## 1. Login  ▶ `/login`
| | |
|---|---|
| **Purpose** | Authenticate into the Security Department workspace |
| **Primary user** | Everyone |
| **Hierarchy** | Brand → "Sign in" → SSO → credentials → help |
| **Layout** | Split 50/50: the form on `--bg` on the left, a quiet surface panel with a one-line product statement on the right |
| **Primary action** | Sign in (or Continue with SSO, when SSO is configured it becomes primary) |
| **Secondary** | Contact administrator link |
| **Components** | Input (36px), Button, Brand mark |
| **Empty** | n/a |
| **Loading** | The button shows an inline spinner and "Signing in…", and the fields become read-only |
| **Error** | "Email or password is incorrect." inline above the button. Locked accounts see "Your account is locked. Contact your administrator." |
```
┌─────────────────────────────┬──────────────────────────────┐
│   [S] Sentinel Ops          │                              │
│   Sign in                   │                              │
│   Security Dept workspace   │                              │
│   [ Continue with SSO    ]  │   TODAY · SEP 28             │
│   ──────── or ────────      │   Tasks, shift logs and team │
│   Work email  [__________]  │   output — in one quiet place│
│   Password    [__________]  │   Internal use only.         │
│   [■■■■■■ Sign in ■■■■■■]   │                              │
└─────────────────────────────┴──────────────────────────────┘
```

## 2. Analyst Dashboard  ▶ `/dashboard`
| | |
|---|---|
| **Purpose** | Start the day: see what needs doing and get into the Shift Log |
| **Primary user** | Analyst |
| **Hierarchy** | Greeting + shift window → a 7-cell metrics strip (actionable cells first) → work queue → Shift Log status → recent activity |
| **Layout** | Page head, then a full-width metrics strip, then a 2-column grid (fluid work queue on the left, a 360px context column on the right) |
| **Primary action** | **Continue Shift Log** (reads "Start Shift Log" before the first entry) |
| **Secondary** | Create Task, View all tasks, clickable metrics (filter the task list) |
| **Components** | Metrics strip, Data table (compact), Shift panel with progress, Activity rows |
| **Empty** | Queue: "You're all caught up." Shift: "No shift activity has been recorded for today." plus **Start Shift Log** |
| **Loading** | Strip values show skeletons, then 4 skeleton rows, then the panel skeleton |
| **Error** | Each region fails independently with its own Retry |
```
Good morning, Sara                                [+ Create Task] [Continue Shift Log]
Mon Sep 28 · Day shift 07:00–15:00
┌────────┬────────┬────────┬────────┬─────────┬─────────┬────────┐
│Assigned│Due 48h │Overdue │Review  │Done·Sep │IOCs·Sep │Tix·Sep │
│   5    │   2    │  1(red)│   1    │ 11 +3   │  142    │  23    │
└────────┴────────┴────────┴────────┴─────────┴─────────┴────────┘
My work queue                     View all │ Today's Shift Log  [In progress]
T-1042 Tune Splunk…  ◐ In Prog ▮▮▮ High Sep29│ 7/8 activities  ▬▬▬▬▬▬▬▬▬▬▬▬▬░░
T-1033 Draft monthly  ○ Returned ▮▮ Norm Sep28│ Remaining  Monitor Security Ctr
                                             │ IOCs 6 · Tickets 2 · Saved 09:42
                                             │ [ Open Shift Log ]
                                             │ Recent activity …
```

## 3. SOC Manager Dashboard  ▶ switch role → `/dashboard`
| | |
|---|---|
| **Purpose** | Keep the SOC running today and unblock people |
| **Primary user** | SOC Manager |
| **Hierarchy** | **Needs your attention** queue (missing logs, overdue, awaiting review, issues) → workload → today's shift logs → monthly output |
| **Layout** | Metrics strip (6), then 2 equal columns: the attention list on the left; the workload bars and shift-log completion bars on the right |
| **Primary action** | Create Task |
| **Secondary** | Row actions in the attention list (Remind, Open, Review, View), Reports |
| **Components** | Metrics strip with sparklines, Action list, Horizontal bars, Badges (Missing/Done), "assist" badge for temporarily assisting staff |
| **Empty** | Attention: "Nothing needs your attention right now." |
| **Loading / Error** | Standard, per region |
```
┌Active 24┬Overdue 3┬Review 4┬Shift 78%┬IOCs 486 ╱╲╱┬Tix 71 ╲╱╲┐
Needs your attention (7)          │ Team workload
⚠ Neda has not started Shift Log [Remind]│ Sara   ▬▬▬▬▬▬▬░░░ 72%
⚑ T-1039 1d overdue · Mina       [Open]  │ Mina(assist) ▬▬▬▬▬▬▬▬▬ 95% (amber)
◕ T-1041 awaiting review         [Review]│ Today's shift logs
⚠ Issue: Sensor S-04             [View]  │ Arash ▬▬▬▬▬▬▬▬▬▬ Done · Neda ░░░ Missing
```

## 4. Security Manager Dashboard  ▶ switch role twice
| | |
|---|---|
| **Purpose** | Department-wide view of output, load, and risk |
| **Primary user** | Security Manager |
| **Hierarchy** | Period selector → department strip → team comparison table (with complexity mix and 6-month trend) → employee activity table (alphabetical) |
| **Layout** | Full-width stacked sections. There are no charts larger than 120px wide; the trend lives in the table |
| **Primary action** | Export |
| **Secondary** | Period segments, drill into a team or employee |
| **Components** | Segmented control, Metrics strip, Data table with inline distribution bar and sparkline, Employee table |
| **Empty** | "No activity was found for the selected period." |
| **Note** | The employee list states "Alphabetical · not a ranking". There is no leaderboard. |

## 5. My Tasks  ▶ `/tasks/my`
| | |
|---|---|
| **Purpose** | Triage and update the user's own work fast |
| **Primary user** | Analyst (and managers for their own tasks) |
| **Hierarchy** | Title + count → filter bar → table (Task, Status, Priority, Complexity, Deadline, Hours, Quality, Updated) |
| **Layout** | Full-width table, sticky header, footer count |
| **Primary action** | Create Task (`C`) |
| **Secondary** | Inline Status/Priority, table/board toggle, Columns, keyboard `J/K/↵/S` |
| **Components** | Filter bar, Chips, Data table, Popover menus, Toast, Kanban (alternate view) |
| **Empty** | "You're all caught up." (with no filters) or "No tasks match these filters. [Reset]" |
| **Loading** | Header plus 10 skeleton rows |
| **Error** | Inline in the table body: "Couldn't load your tasks. [Retry]", with filters preserved |
```
My Tasks                                   [≡|▦] [+ Create Task C]
5 tasks
[⌕ Filter by title or ID] [Status is In Progress ×] [+Priority] [+Complexity] [Deadline] Reset   J K ↵ S  [Columns]
───────────────────────────────────────────────────────────────────────────────
Task                                   Status       Priority  Complexity  Deadline ↑   Hours Quality
T-1042 Tune Splunk correlation rule…   ◐ In Progress ▮▮▮ High ◆◆◆◇ Complex Sep 29(amb)  6.5  —
T-1035 Onboard new L1 analyst          ● Done        ▮▮ Normal ◆◇◇◇ Simple Sep 25       2.0  ★ Excellent
```

## 6. Team Tasks  ▶ `/tasks/team`
Same as My Tasks, with these differences: the **Assignee** column is added, the **Assignee** filter chip is added, and grouping by assignee is optional.
- **Primary user**: SOC Manager. **Primary action**: Create Task. **Secondary**: bulk-select (checkbox column appears on hover) → change status, reassign.
- **Empty**: "Your team has no open tasks."

## 7. All Tasks  ▶ `/tasks/all`
Cross-team scope (SOC, Design & Automation, Threat Intelligence). Adds **Team** column and **Team** filter at ≥1600px.
- **Primary user**: Security Manager. Read and edit access follows role permissions; rows the user can't edit show no hover affordance.

## 8. Create Task  ▶ `C` anywhere / "Create Task"
| | |
|---|---|
| **Purpose** | Create and assign a normal task in under 15 seconds |
| **Primary user** | SOC Manager, Security Manager (Analysts can create tasks for themselves) |
| **Hierarchy** | Title (18px, autofocus) → description → property pills → advanced disclosure |
| **Layout** | A 640px modal, with no field labels on the main properties. Pills show the current value (Assignee, Priority, Complexity, Start, Deadline, Review required) |
| **Primary action** | **Create Task** (`⌘↵`) |
| **Secondary** | Cancel (`Esc`), "Create another" switch, advanced: Checklist, Attachments, External reference |
| **Components** | Title input, Borderless textarea, Property pills → popovers, Switch, Disclosure |
| **Validation** | Title and Assignee are required. If either is missing, the pill turns danger-bordered and shows the hint "Add a title" |
| **Loading** | The button shows a spinner. The modal stays open until the server confirms |
| **Error** | An inline banner at the top of the modal body. The input is never lost |
```
┌ SOC·L1 › New task ─────────────────────────────────────┐
│ Task title_                                             │
│ Add description…                                        │
│ (SR Sara) (▮▮ Normal) (◆◆ Medium) (📅 Today) (⚑ Deadline) (◉ Review) │
│ › Checklist, attachments, external reference            │
├─────────────────────────────────────────────────────────┤
│ ◯ Create another            Esc  [Cancel] [Create Task ⌘↵] │
└─────────────────────────────────────────────────────────┘
```

## 9. Task Details  ▶ `/tasks/T-1042`
| | |
|---|---|
| **Purpose** | Everything about one task, editable in place |
| **Primary user** | Assignee, Reviewer |
| **Hierarchy** | ID/team → title (28px, editable) → description → attachments/refs → checklist → comments interleaved with activity |
| **Layout** | Split view: a fluid main column (max 880px) and a 320px properties rail on a slightly darker plane. There are no cards. |
| **Primary action** | Context-aware: **Start** (To Do) → **Submit for Review** (In Progress) → **Approve / Return** (Reviewer, with a Quality picker on Approve) |
| **Secondary** | Inline properties, hours stepper, ⋯ menu (Duplicate, Cancel task, Copy link) |
| **Components** | Key-value list, Checklist (drag grip on hover, add row), File tiles, Comment, Composer, Activity rows |
| **Empty** | Checklist: "+ Add item" row only. Comments: composer only |
| **Loading** | Title and description skeletons, with the rail in skeleton key/values |
| **Error** | Not found: "This task doesn't exist or was deleted. [Go to My Tasks]" |
```
T-1042 · SOC · L1                                    │ [Submit for Review] [⋯]
Tune Splunk correlation rule for anomalous VPN logins│ Status     ◐ In Progress
Current rule fires on every login from a new …       │ Assignee   (SR) Sara
[SPL vpn_anomaly_v3.spl] [🔗 Splunk search]          │ Priority   ▮▮▮ High
Checklist 3 of 5 ▬▬▬░░                               │ Complexity ◆◆◆◇ Complex
 ☑ Pull 30 days of VPN auth logs                     │ Deadline   Sep 29
 ☐ Validate against last month's true positives      │ Hours      [− 6.5 +]
Comments 2                                           │ Reviewer   (LN) Leila
 (LN) Leila · Sep 27  Please coordinate with @Arash… │ Quality    Set on approval
 │ › priority Normal → High                          │ Activity …
 [Leave a comment…  @ 📎            Comment ⌘↵]      │
```

## 10. Shift Log: Active Shift  ▶ `/shift`
| | |
|---|---|
| **Purpose** | Record the day's routine SOC activities fast and accurately |
| **Primary user** | SOC Analyst |
| **Hierarchy** | Title "Shift Log: Sep 28, 2026" → header facts (Analyst, Shift, Status, Completion %, Last updated) → 8 activities → Created Tickets → sticky summary bar |
| **Layout** | 1080px centered column. Each activity is a row with dividers, and extra fields expand inline, indented to the title column |
| **Primary action** | **Complete Shift** (in the sticky summary bar) |
| **Secondary** | Per-activity Done toggle, Report an issue, note, Add Ticket, History |
| **Activity rules** | **#1, #7** Done / Not done + note. **#2** Done + files/references + note (no IP/Domain counts). **#3, #5, #6** default button "✓ Completed · No Issue"; the ghost link "Report an issue" reveals Summary, Description, Attachment, and External ref inline (an amber left-rule callout). **#4** Done + a prominent .docx tile + note. **#8** IOC Count stepper (autofocus on check; `↑/↓`, typing), Shared via Bale switch, MISP event ref, note |
| **Tickets** | A compact list with the columns Ticket Number* (mono), Related Reference (mono), Description, and Link. "+ Add Ticket" inserts an inline row with autofocus; `↵` saves and `Esc` cancels. The count "Tickets Created: N" is always derived from the records and can't be edited. |
| **Summary** | `7/8 Activities · 6 IOCs added · 2 Tickets created · 1 Issue reported`, plus a remaining hint in amber text (no banner) |
| **Complete with gaps** | Clicking Complete scrolls to the first incomplete item and briefly tints it. If the user continues, a small confirm lists the missing items and asks for an optional reason |
| **Empty** | Before the first action, the page shows all items unchecked and the header status reads "Not started". The Dashboard shows "No shift activity has been recorded for today." |
| **Loading** | Header skeleton plus 8 skeleton activity rows |
| **Error** | Autosave failures show "Not saved: retrying…" in amber in the header. Edits are kept locally until saved |
```
Shift Log — Sep 28, 2026                         [Active|Completed] History
◔  Analyst (SR) Sara · Shift Day 07–15 · Status [In progress] · 88% · 09:42 autosaved
Routine activities 7 of 8
 1 ☑ Review Logged Incidents in Splunk Incident Review             [✓ Done] ⋯
 2 ☑ Upload Malicious IP and Domain Files to the Website            [✓ Done] ⋯
       [TXT malicious_ips_0928.txt] [TXT malicious_domains…] 📎 Add file or link
 3 ☑ Review Scanner and Sensor Dashboards                          [✓ Done] ⋯
       ┃⚠ Issue reported: Sensor S-04 stopped reporting at 06:40
 4 ☑ Prepare Daily Traffic Report                                  [✓ Done] ⋯
       [DOC Daily_Traffic_Report_2026-09-28.docx 248 KB] 📎 Replace
 6 ☐ Monitor Security Center Website    Report an issue [✓ Completed — No Issue]
 8 ☑ Add IOCs to MISP and Share Them via Bale                      [✓ Done]
       IOC count [− 6 +]   ◉ Shared via Bale   MISP event [5534]
Created Tickets  [Tickets Created: 2]                        [+ Add Ticket]
 INC-2026-4471   Splunk NE #88213   Repeated failed admin logins…  🔗
▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ (sticky)
 7/8 Activities  6 IOCs  2 Tickets  1 Issue   1 remaining: Monitor…  [Complete Shift]
```

## 11. Shift Log: Completed Shift  ▶ `/shift` → finish all activities, then **Complete Shift**
- **Purpose**: a read-only record for the analyst and their manager.
- Same layout, with these differences: controls become static values, the status badge reads "Completed 14:52" in green, and the summary bar replaces Complete with **Reopen** (available to the owner within the same day, or to a manager at any time; reopening is logged).
- Managers see **Return to analyst** with a comment.
- **Empty/Loading/Error**: standard.

## 12. Shift Log History  ▶ `/shift/history`
| | |
|---|---|
| **Purpose** | Browse previous daily logs; drill into any day |
| **Primary user** | Analyst (own), SOC Manager (any analyst) |
| **Layout** | Filter chips (Analyst, Period), then a table: Date · Status · Activities (bar + n/8) · IOCs · Tickets · Issues · Traffic report |
| **Primary action** | Open a day (row click) |
| **Secondary** | Export |
| **Empty** | "No shift logs in this period." |

## 13. Team Overview
| | |
|---|---|
| **Purpose** | For managers: the state of their team right now |
| **Primary user** | SOC Manager |
| **Hierarchy** | Team selector (SOC › L1/L2/L3) → strip (people, on shift, open tasks, overdue, missing logs) → member table → tasks awaiting review |
| **Layout** | Stacked sections at full width. People assisting from other teams appear with an "assisting" suffix and a separate subtle group |
| **Primary action** | Create Task (with the team preselected) |
| **Secondary** | Remind about missing log, open member performance |
| **Empty** | "No members in this team yet. [Manage in Administration]" |

## 14. Employee Directory  ▶ `/team`
| | |
|---|---|
| **Purpose** | Find a person and see their load at a glance |
| **Primary user** | Everyone (visible fields depend on role) |
| **Layout** | Team segmented filter, search, then a table: Name · Role · Primary team (+ assisting) · Workload bar · Open tasks · Shift today · → Performance |
| **Primary action** | Open profile |
| **Note** | These are table rows, never tiles. There is no ranking, and the default sort is by name |
| **Empty** | "No people match "…"." |

## 15. Employee Profile
| | |
|---|---|
| **Purpose** | A professional profile: who the person is and what they're working on |
| **Layout** | Header (44px avatar, name 28px, role · team · manager, contact) → tabs: **Overview · Tasks · Shift Logs · Performance** |
| **Overview** | Current open tasks (compact table), this week's shift logs, temporary assignment note |
| **Primary action** | Assign task (for managers) |
| **Empty/Loading/Error** | Standard |

## 16. Employee Performance  ▶ `/performance/employees`
| | |
|---|---|
| **Purpose** | Answer: *what did this person actually accomplish in this period?* |
| **Primary user** | SOC Manager, Security Manager (and the employee, for their own record) |
| **Hierarchy** | Identity + period → 5-metric strip → **Routine Activity** (Shift Logs badge) → **Task Performance** (Tasks badge) |
| **Layout** | 1280px column. The two sections are separated by their own heading, a labeled badge, and the subtitle "counted separately from tasks" |
| **Primary action** | **Export to Excel** |
| **Secondary** | Period (This Month · Last Month · Quarter · Custom), Daily logs drill-down, clickable Tickets metric → popover of ticket numbers → Ticket Report |
| **Routine section** | Shift logs n/N, Routine completion %, MISP IOCs, Tickets created, Daily traffic reports, plus an IOCs-per-shift line |
| **Task section** | Complexity distribution (segmented bar + legend with counts), Quality counts (text), then a table: Title · Description · Complexity · Quality · Start · End · Hours · Status |
| **Empty** | "No activity was found for the selected period." Non-SOC staff don't get the Routine section at all; it isn't shown as empty |
| **Loading / Error** | Standard |
```
(SR) Sara Rahimi                     [This Month|Last|Quarter|Custom] [Export to Excel]
Analyst · SOC L1 · Reports to Leila Nouri      Period Sep 1–28 · 20 working days
┌Completed 11┬Hours 62.5┬Shift logs 19/20┬IOCs 142┬Tickets 23 ›┐
Routine Activity [Shift Logs]  counted separately from tasks        Daily logs ›
 Shift logs 19/20 │ Routine 97.5% │ IOCs 142 │ Tickets 23 │ Traffic reports 19
 IOCs per shift  ╱╲_╱╲╱‾╲_╱‾‾╲
Task Performance [Tasks]
 Complexity ▬▬▬▬▬▬▬▬▬▬ Simple 4 · Medium 3 · Complex 3 · Advanced 1
 Quality    Excellent 4 · Good 5 · Acceptable 2 · Needs Improvement 0
 Task · Description · Complexity · Quality · Start · End · Hours · Status
```

## 17. Performance Overview  ▶ `/performance/overview`
| | |
|---|---|
| **Purpose** | Compare output across the organization without ranking people |
| **Primary user** | Security Manager, SOC Manager (SOC scope only) |
| **Layout** | Period + Export, strip, then a table: Employee · Team · Tasks done · Hours · Complexity mix · Shift logs · IOCs · Tickets. Non-SOC cells read "n/a" |
| **Primary action** | Export to Excel |
| **Note** | The default sort is alphabetical, and the footnote states the no-ranking principle. Sorting by a metric is allowed but never persisted as the default |

## 18. Reports (hub)  ▶ `/reports`
| | |
|---|---|
| **Purpose** | Produce the standard exports, not ad-hoc BI |
| **Layout** | A 260px report list on the left (Employee Monthly, Team Monthly, Task, SOC Shift Activity, Ticket) → the right pane shows the selected report's filter bar, preview table, and **Export to Excel** |
| **Filters** | Date range, Employee, Team, Task Status, Complexity, Quality (chips; only relevant ones per report) |
| **Primary action** | **Export to Excel**. A toast shows the file name, and the file downloads directly |
| **Empty** | "No activity was found for the selected period." |
| **Loading** | The preview table skeleton. Export is disabled until the preview is ready |

## 19. Employee Monthly Report  ▶ `/reports/employee`
- Mirrors the existing Excel format. The **Tasks** sheet has these columns: Task Title · Work Description · Quality · Start Time · End Time · Hours · Executor · Complexity.
- For SOC employees there is also a **Routine Activity** block: Shift logs, Routine completion, MISP IOCs, Tickets, Traffic reports, and Issues reported.
- The export has two sheets, *Tasks* and *Routine Activity*, plus a *Tickets* appendix.

## 20. SOC Shift Activity Report  ▶ `/reports/shift`
| | |
|---|---|
| **Purpose** | Monthly compliance and output of routine work |
| **Layout** | Filters (Date range, Analyst, Layer), then a matrix table with one row per analyst: Shift logs · Completion % · a column per activity (done-rate %) · IOCs · Tickets · Issues · Traffic reports. Clicking a cell drills into matching days |
| **Primary action** | Export to Excel |
| **Visual** | Completion cells use a small inline bar. Below 90%, the text turns warning-colored (no fill) |

## 21. Ticket Report  ▶ `/reports/tickets`
| | |
|---|---|
| **Purpose** | A searchable ledger of every ticket registered in shift logs |
| **Layout** | Search, then chips (Analyst, Date range), then a table: Analyst · Date · **Ticket Number** (mono) · Related Reference (mono) · Description. The row links to its source Shift Log |
| **Primary action** | Export to Excel |
| **Empty** | "No tickets were registered in this period." |

## 22. Administration  ▶ `/admin`
| | |
|---|---|
| **Purpose** | Configure the workspace |
| **Layout** | A 220px secondary nav: Users & Roles · Teams · Shift Templates · Activity Definitions · Notifications · Audit Log, then the content pane |
| **Activity Definitions** | The ordered list of the 8 shift activities with a type (basic / files / monitor / report / MISP), a required flag, and extra fields. Changes apply from the next day and never rewrite history |
| **Primary action** | Depends on the section (Invite User, Add Team…) |

## 23. User / Role Management  ▶ `/admin`
| | |
|---|---|
| **Purpose** | Manage people, roles, primary teams, and temporary assignments |
| **Layout** | Search, then chips, then a users table (User · Role (inline select) · Primary team · Temporary assignment with end date · Last active · Status), then a read-only role-permission matrix |
| **Primary action** | **Invite User** (a drawer with Email, Name, Role, Primary team) |
| **Secondary** | Row menu: Edit, Assign temporarily to team…, Deactivate (confirm) |
| **Rules** | One primary team per user. A temporary assignment has an end date, and during it the user appears in both teams' views with an "assisting" label |
| **Empty** | "No users match." |
| **Error** | A failed role change reverts the cell and shows the toast "Couldn't change role: try again." |

---

## States gallery  ▶ `/states`
Reference renders of the empty states (Tasks, Shift Log, Reports), the table skeleton, the load error, and the no-access error.
