# Sentinel Ops: Design System

A calm, dense, typographic system for a security organization's internal work tool.
Its look comes from proportion, rhythm, and restraint. It doesn't use decoration.

> Live reference: the Next.js app in this repository (`npm run dev`). Every rule in this document is implemented there.
> Tokens: `styles/tokens.css`. Component styles: `styles/components.css`. React components: `components/`.

---

## 1. Design principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | **Quiet by default, loud by exception** | About 90% of pixels are neutral. Color appears only when it tells you something: overdue, critical, blocked, missing. |
| 2 | **Scan before you click** | Every list shows enough (status, priority, complexity, deadline, quality) that opening a record is optional. |
| 3 | **One surface, many rows** | Tables and continuous surfaces are preferred to card grids. A card has to earn its border. |
| 4 | **Two kinds of work, never mixed** | *Routine Activity* (Shift Logs) and *Task Performance* are separate everywhere: separate sections, separate labels, separate counts. |
| 5 | **Speed beats spectacle** | Motion takes 120–200ms and only confirms an action. Common edits happen in place: status, priority, IOC count, ticket entry. |
| 6 | **Respectful measurement** | Performance data describes output. The default sort is alphabetical, and nothing is ranked or given medals. |

### Visual identity: "Graphite & Indigo"
- **Graphite layers** give the structure: the sidebar sits on `--bg`, and the working area is one raised `--surface` sheet inset 8px, with a 10px radius and a hairline outline. This "sheet on a desk" shell is the product's signature silhouette.
- **Indigo** is the only brand color. It is used for primary buttons, the active-nav tick, focus rings, progress fills, and data-viz ramps.
- **Teal** is used only for the Complexity pips. **Violet** is used only for the Review status.
- **Glyph language**: status is shown by the fill of a circle (empty → half → ¾ → full), priority by signal bars, and complexity by diamond pips. Because each one uses a different shape, they can never be confused, even in grayscale.

---

## 2. Tokens

All components use **semantic tokens only**. The two themes are tuned independently; light mode is not an inversion of dark.

### Color

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0B0D12` | `#F6F7F9` | App background, sidebar |
| `--surface` | `#11141B` | `#FFFFFF` | Main working sheet, tables |
| `--surface-2` | `#171B24` | `#F0F2F5` | Inset areas, search field, kanban columns, chips |
| `--surface-raised` | `#1C212C` | `#FFFFFF` + shadow | Popovers, modals, toasts |
| `--hover` | `#222936` | `#ECEFF3` | Row/menu hover |
| `--selected` | indigo 10% | indigo 8% | Keyboard-focused row |
| `--text` | `#F4F6F8` | `#171A1F` | Primary text |
| `--text-2` | `#A7AFBC` | `#59616D` | Secondary, cell text |
| `--text-3` | `#6F7887` | `#8A929E` | Metadata, headers, placeholders |
| `--border` | `#252B36` | `#E2E5E9` | Inputs, surfaces |
| `--border-strong` | `#353D4A` | `#CDD2D9` | Hover borders, inactive glyph parts |
| `--divider` | white 5% | black 6% | Row separators (lighter than border) |
| `--primary` / `-hover` | `#6C7CFF` / `#7D8BFF` | `#5666E8` / `#4655D4` | Primary CTA, focus, progress |
| `--success` | `#3CCB8E` | `#238A62` | Done, completed shift |
| `--warning` | `#E6A94A` | `#B7791F` | Returned, due soon, issue reported |
| `--danger` | `#F26666` | `#D84F4F` | Overdue, Critical, Blocked, missing log |
| `--info` | `#55A7FF` | `#357FD3` | In Progress |
| `--violet` | `#A48BFF` | `#7A5CE0` | Review (only) |
| `--teal` | `#3FC1C9` | `#1E8F97` | Complexity pips (only) |

Each semantic color also has a `-soft` background at 10–14% alpha. Soft backgrounds are used only for states that need attention (Blocked, Returned, issue callouts, badges).

**Data-viz ramp** (`--viz-1…4`) is a single indigo hue in 4 lightness steps, mapped Simple → Advanced. Charts never use a rainbow.

### Typography
Geist (falls back to Inter, then Manrope) · Geist Mono for technical identifiers only.

| Role | Spec | Where |
|---|---|---|
| Display | 600 · 28/34 · −0.02em | Login, Task title, Profile name |
| Title | 600 · 24/30 · −0.02em | Page titles |
| Section | 600 · 16/22 | Section headings |
| Body | 400 · 14/20 · −0.011em | Paragraphs, forms |
| Table | 400 · 13/18 | All data cells |
| Label | 500 · 12/16 | Column headers, field labels, badges |
| Meta | 400 · 12/16 | Timestamps, hints |
| Mono | 400 · 12 | Ticket numbers, task IDs, external refs, MISP event IDs |

- **Tabular numbers** (`font-variant-numeric: tabular-nums`) are used for every count, hour value, percentage, and date column.
- Hierarchy comes from **weight and size, then color**. The page title is the only 24px text on a screen.

### Spacing (4pt)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`
- Table cell padding is 0 × 12. The page gutter is 32 (24 top). Gaps between sections are 32. Inline gaps are 6–8.
- Operational screens (Tasks, Shift Log) use the compact end of the scale. Profile and Report screens use the generous end.

### Radius
| Element | Radius |
|---|---|
| Checkbox, tags | 4 |
| Chips, pills, badges | 6 |
| Inputs, buttons, menu items | 8 |
| Surfaces, panels, main sheet | 10 |
| Modals, drawers | 14 |

### Elevation
There are three levels, and nothing sits above them:
1. **Flat** has no shadow: tables and sections.
2. **Raised** uses `--shadow-sm` plus a hairline: the main sheet and kanban cards.
3. **Overlay** uses `--shadow-lg`: popovers, modals, and toasts.

In dark mode, elevation comes from surface lightness. In light mode it comes from a soft shadow.

### Motion
| Token | Duration | Use |
|---|---|---|
| `--t-fast` | 120ms | Hover, background, color |
| `--t-base` | 160ms | Popover in, switch thumb |
| `--t-slow` | 200ms | Modal in, sidebar collapse, check tick |

The easing curve is `cubic-bezier(.2,.8,.2,1)`. There are no page transitions. `prefers-reduced-motion` turns all motion off.

### Layout
- **Shell**: 232px sidebar (56px collapsed), a 52px header, and the content sheet.
- **Content max**: 1280px for reading, profile, and form pages (`.page.narrow`). Tables and boards stretch to the full sheet width.
- **Target widths**: 1440, 1600, and 1920. At 1920, tables gain columns (Team, Updated) instead of empty space.

---

## 3. Semantic indicators

The three most important indicators each use a different visual shape, so none of them depends on color alone.

### Status: circle fill + label
| State | Glyph | Treatment |
|---|---|---|
| Backlog | ○ dashed-tone ring | text-3 |
| To Do | ○ ring | neutral |
| In Progress | ◐ half fill | info |
| Review | ◕ ¾ fill | violet |
| Done | ● full | success |
| **Blocked** | ● + soft red pill | danger (needs attention) |
| **Returned** | ○ + soft amber pill | warning (needs attention) |
| Cancelled | ○ + strikethrough | text-3 |

Only the two exception states get a filled pill. The fill progression lets you read workflow position from the shape alone.

### Priority: signal bars
- Low has 1 bar, Normal 2 bars, High 3 bars (label in primary text color).
- **Critical** is shown as a solid red 12px square with "!" and a bold red label. It is the only priority with color, so it stands out without adding noise.

### Complexity: diamond pips (teal)
`◆◇◇◇ Simple · ◆◆◇◇ Medium · ◆◆◆◇ Complex · ◆◆◆◆ Advanced`
The rotated squares and teal fill make it impossible to confuse with priority bars.

### Quality: text-first
- Excellent gets a small amber ★ prefix.
- Good and Acceptable are plain secondary text.
- Needs Improvement uses warning-colored text, with no pill.
- Quality is set only when a task is approved; until then the field shows "—".

---

## 4. Component library

Each entry lists anatomy, then states, then behavior. Class names refer to `styles/components.css`.

| Component | Spec |
|---|---|
| **App Shell** | `.app` grid (sidebar + `.main` sheet). The sheet is inset 8px with a 10px radius. Content scrolls inside the sheet, so the header stays fixed. |
| **Sidebar** | Brand, nav items at 30px height, sub-items at 28px shown only for the active group, then the foot (role and user). The active item gets a `--surface-2` fill plus a 2px indigo tick on the left edge. Collapsed width is 56px, labels are hidden, and a tooltip appears on hover. Collapse animates over 200ms. There are no separators; groups are separated by spacing. |
| **Top Header** | Sidebar toggle, breadcrumb, spacer, command search (`⌘K`), notifications, theme. It is 52px tall with a divider below. There are no page actions here; those live in the page head. |
| **Button** | 32px tall (28 for `sm`), radius 8, weight 500 at 13px. **Primary**: indigo, at most one per view. **Secondary**: surface-2 with a hairline. **Ghost**: transparent. **Danger**: soft red. Pressing shifts it down 0.5px. A shortcut hint `<kbd>` can sit inside. |
| **Icon Button** | 30×30 ghost button. Always has `aria-label` and a tooltip. |
| **Input / Textarea** | 32px tall, radius 8, 1px border. Hover uses border-strong. Focus uses an indigo border plus a 3px soft ring. Error uses a danger border and a helper text line below. |
| **Search** | Uses surface-2 with no border and a leading icon. `/` focuses it. It filters as you type, with no submit. |
| **Select / Multi Select** | The trigger looks like an input. Options open in a popover with type-ahead. Multi-select shows chips inside the trigger, then "+N". |
| **Date / Range Picker** | A popover with presets on the left (Today, This week, This month, Last month, Quarter) and a single-month calendar on the right. The range highlight uses `--primary-soft`. |
| **Checkbox** | 16px, radius 4. When checked it fills with success green and the tick draws in over 200ms. |
| **Radio / Switch** | The switch is 28×16 and turns indigo when on. It is used for binary settings such as "Shared via Bale" and "Review required". |
| **Segmented control (Tabs)** | Surface-2 track. The active segment is raised. It is used for period selectors and view toggles. Page-level tabs use underline text tabs. |
| **Badge** | 20px tall, radius 6, label type, soft background. Use sparingly: states only, never decoration. |
| **Status / Priority / Complexity / Quality** | See §3. They are always inline and never stacked. |
| **Avatar / Group** | 22px (44px on profiles) with initials on a deterministic hue. Groups overlap by −6px with a 2px ring. |
| **Tooltip** | Raised surface, 12px text, 400ms delay, no arrow. |
| **Popover / Dropdown** | Raised surface, radius 10, 4px padding, 30px items, a section header (`.ph`), and a keyboard hint on the right. It opens in 160ms from −4px. |
| **Command Menu** | `⌘K` opens a centered 560px popover with a search field, "Jump to" and "Actions" groups, and arrow-key navigation. |
| **Data Table** | See §5. |
| **Pagination** | A footer row showing "1–50 of 312" plus rows-per-page and prev/next icon buttons. Pagination is used only above 100 rows; below that everything is shown. |
| **KPI Metric** | A cell inside a **metrics strip**: one bordered surface split by hairlines. Each cell has a 12px label, a 24px tabular value, and an optional delta or sparkline. Alert metrics color only the value. |
| **Task Row** | A table row: mono ID, title, and inline-editable Status/Priority cells (click opens a popover). |
| **Task Card (Kanban)** | Surface on a surface-2 column, 10/12 padding. Shows ID, title (2 lines max), priority, and avatar. |
| **Employee Row** | Avatar with name, role, team (plus an "assisting X" suffix), a workload bar with %, open count, and shift state. |
| **Activity Row** | A 12px muted line on a 1px left rule: actor, action, and target shown in mono. |
| **Shift Activity Item** | Number, checkbox, title and hint, then right-side actions (Done toggle, Report an issue, note). Optional extra fields appear in a region indented to the title column. |
| **Ticket Record** | A grid row: mono ticket number (required), mono reference, description, and link. Adding a ticket inserts an inline editable row with autofocus. |
| **File Attachment** | A tile with a colored extension block (DOC in blue, TXT neutral, SPL green), file name, and size with the uploader. |
| **Comment** | Avatar, name, time, and an "edited" note, then the body. `@mentions` appear in indigo weight 500. The composer is a bordered box with @ and 📎 buttons and a `⌘↵` hint. |
| **Toast** | Bottom-right, raised, with a success tick and message. It auto-dismisses after 2.6s. Undo is offered for destructive actions. |
| **Modal** | 640px, radius 14, starts at 10vh from the top. The body is followed by a footer with the actions on the right. `Esc` closes it. Focus is trapped inside. |
| **Drawer** | 480px, slides from the right. It is used for quick views such as the ticket list and a person's quick view. |
| **Empty State** | A 40px muted glyph tile, a 16px heading, one sentence, and at most one action. There are no illustrations. |
| **Skeleton** | Shimmer bars sized to the real content, keeping column widths and row height. |
| **Error State** | The empty-state layout with a danger-tinted glyph, a plain-language cause, and recovery actions (Retry, Go Back, Contact Administrator). |
| **Chart** | Line (1.5px stroke, end dot), horizontal bar (6px track), or segmented distribution (8px). No axes unless they add value. Gridlines use `--viz-grid`. |
| **Filter Bar** | Search, active chips (solid, removable), add-filter chips (dashed), Reset, then columns and view controls on the right. |
| **Breadcrumb** | 13px muted text with a chevron separator. The last item is the primary text. |

---

## 5. Data table specification

The data table is the most-used surface in the product.

- **Density**: rows are 36px (32px in compact mode) and headers are 34px. Cell text is 13px.
- **Separators**: a divider line between rows only, with no vertical lines and no cell boxes.
- **Header**: sticky, 12px/500 in `--text-3`. The sorted column switches to `--text` with ↑/↓. Clicking toggles direction.
- **Hover**: the whole row turns `--hover` over 120ms.
- **Keyboard**: `J/K` or `↑/↓` moves the focused row, which gets `--selected` plus a 2px indigo left edge. `↵` opens the row, `S` opens the status menu, `P` opens priority, `C` creates a task, `/` focuses search, and `Esc` clears.
- **Inline editing**: the Status and Priority cells show a hover affordance (a raised pill), and clicking opens a popover with numbered shortcuts (`1–8`). The change applies immediately and a toast confirms it.
- **Numeric columns** are right-aligned with tabular numbers.
- **Deadline**: shown as "Sep 29". It turns amber when due within 48h and red with "· overdue" when past due on open tasks.
- **Column visibility**: a "Columns" popover with checkboxes. The chosen set is remembered per view.
- **Grouping** (optional): a group header row on surface-2 (for example, group by status).
- **Loading**: skeleton rows that keep the real column widths.

---

## 6. Interaction patterns

| Pattern | Rule |
|---|---|
| Progressive disclosure | Advanced fields and issue details stay hidden behind a single ghost link until needed. |
| Inline editing | Anything changed daily (status, priority, hours, IOC count, checklist) is edited in place. |
| Numeric entry | Steppers show −/value/+ and also accept typing and `↑/↓`. The IOC field is reachable with a single Tab. |
| Filtering | Chips and popovers only, never a filter modal. Active filters are visible and one click resets them. |
| Confirmation | Use a toast and avoid confirmation dialogs, except for destructive actions (delete, cancel task) or completing a shift with missing items. |
| Autosave | The Shift Log and task fields autosave. The header shows "Last updated 09:42 · autosaved". |
| Notifications | A compact popover with 6 types: Assigned, Returned, Approved, Deadline approaching, Mentioned, Evaluation available. Items are grouped by day and there is no badge count above 9. |

## 7. Accessibility
- All text/background pairs meet WCAG AA. `--text-3` is used only for non-essential metadata.
- Every state pairs color with shape and text (see §3).
- Focus-visible rings use a 2px background gap plus a 2px indigo outline on every interactive element.
- Full keyboard paths exist for task triage and for completing a Shift Log.
- Icon-only buttons have `aria-label` and a tooltip.
- `prefers-reduced-motion` disables all motion.
