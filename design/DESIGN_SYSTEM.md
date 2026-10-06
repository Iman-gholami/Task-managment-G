# Sentinel Ops: Design System

A calm, dense, data-first system for a security organization's internal work tool.
Its look comes from hierarchy, layered surfaces and one signature gradient. Four themes share every rule;
only the colours change.

> Live reference: the Next.js app in this repository (`npm run dev`). Every rule in this document is implemented there.
> Tokens: `styles/tokens.css`. Styles by layer: `styles/base.css`, `shell.css`, `components.css`, `data.css`, `screens.css`, `rtl.css` (Persian screens), `themes.css`, `motion.css`.
> Theme list: `lib/themes.js`. Theme switching: `components/theme.js`, `components/ThemePicker.js`.
> React primitives: `components/ui/`. Palette and contrast checks: `node scripts/palette.mjs`.

---

## 1. Design principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | **Quiet by default, loud by exception** | About 90% of pixels are neutral. Colour appears only when it tells you something: overdue, blocked, critical, needs review. |
| 2 | **Answer the question first** | Every page opens with what is happening and whether anything is wrong (KPIs, "Needs your attention"), then detail. |
| 3 | **Scan before you click** | Lists show status, priority, complexity, deadline and quality inline, so opening a record is optional. |
| 4 | **Two kinds of work, never mixed** | *Routine activity* (Shift Logs) and *Task performance* are separate everywhere: separate sections, labels and counts. |
| 5 | **Speed beats spectacle** | Interaction feedback takes 120–220ms and only confirms an action. Common edits happen in place. Entrances (a page settling in, charts growing) run once on mount in under 0.7s and never block input. The theme reveal and the sign-in radar are the only longer effects; `prefers-reduced-motion` turns all of it off. |
| 6 | **Respectful measurement** | Performance data describes output. Default order is alphabetical; nothing is ranked. |
| 7 | **Never invent** | Every number, status and comparison comes from stored data. Missing data is shown as missing ("—", "n/a"), not estimated. |

### Visual identity
- **Ink**: cool, faintly blue-slate neutrals for ~90% of every screen. Primary text is off-white (dark) or near-black (light), never pure white/black.
- **Signal**: one accent per theme (teal, gold or violet) for primary actions, the active navigation item, links, focus rings and data emphasis. Because nothing else uses it, anything in the accent colour is actionable or "the latest value".
- **Signature gradient**: the accent runs into a second stop (`--accent`) as one 135° gradient. It marks the brand mark, primary buttons, the active-page bar, checked controls, progress fills and the latest chart bar — never text that has to be read, and never large areas.
- **Light, not decoration**: a faint ambient glow in the accent colour sits behind the app, at the top of the content sheet and in the corner of KPI cards. It is always behind opaque cards, so it never changes text contrast.
- **Depth from layering**: in the dark themes each level is a step lighter — app background → content sheet → cards → insets → menus — with a 1px top highlight (`--edge`) on cards. In the light theme cards get a soft two-layer shadow (`--shadow-card`). Menus, toasts and the dialog scrim blur what is behind them.
- **One typeface per script**: Geist (UI) with tabular numbers for all figures; Geist Mono only for IDs, ticket numbers and references. Persian (RTL) screens use Vazirmatn through the same type tokens (see *Persian screens* below). (The earlier display serif was removed: its condensed digits made "11" read as "ll".)

---

## 2. Tokens

Components use semantic tokens only. Hex values come from `scripts/palette.mjs` (OKLCH), which also prints every contrast pair.

### Themes
Each theme is one block in `tokens.css` (`<html data-theme="…">`) that defines the full set of colour tokens below; nothing else in the CSS knows which theme is active.

| Id | Name | Surfaces | Signal → accent | Notes |
|---|---|---|---|---|
| `light` | Daylight | cool white and slate | teal #007B70 → #006E8E | White labels on the gradient |
| `dark` | Graphite | blue-slate, layered | teal #4EB9AD → #54BBD2 | |
| `gold` | Black Gold | warm near-black | gold #FBC629 → amber #EBA002 | Warning moves to orange (#FA934E) so it never reads as the accent |
| `midnight` | Midnight | deep navy | violet #A491FE → azure #5CABF2 | Review moves to rose (#EF8BC5) so it stays distinct from the violet accent |

- **Choosing a theme:** the palette button in the top bar (menu, digits 1–4), Account › Appearance (preview cards), the swatches on the sign-in page, or ⌘K ("theme", "gold", "midnight"…). The choice is stored per device (`localStorage["so.theme"]`); with no choice the OS preference picks Daylight or Graphite.
- **No flash:** `app/layout.js` sets `data-theme` before first paint; `components/theme.js` also updates `<meta name="theme-color">`.
- **Reveal:** where the browser supports view transitions, the new theme spreads in a circle from the control that picked it (560ms). With reduced motion it switches instantly.
- **Adding a theme:** add it to `scripts/palette.mjs` and check the contrast output, add a `:root[data-theme="<id>"]` block with every colour token, and add an entry to `lib/themes.js` (name, note, swatches).

### Colour (semantic)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #EDF0F4 | #080D11 | App background, sidebar |
| `--surface` | #F9FAFC | #0F1318 | Main content sheet |
| `--surface-card` | #FFFFFF | #14191E | Cards, panels, tables |
| `--surface-inset` | #F3F5F8 | #1A1F24 | Segmented tracks, group rows, side panels, dialog footers |
| `--surface-raised` | #FFFFFF | #1C2126 | Menus, dialogs, toasts |
| `--surface-input` | #FFFFFF | #0F1318 | Form controls (inset look in dark) |
| `--hover` / `--pressed` / `--selected` / `--nav-active` | text or primary at 4–12% alpha | same | Interaction overlays that work on any surface |
| `--text` / `--text-2` / `--text-3` | #151B22 / #4C535B / #656D75 | #E8EBEF / #B9BEC4 / #949BA1 | Primary, secondary, muted |
| `--border` / `--divider` / `--border-strong` | #DFE3E8 / #E8EBEF / #7F8790 | #272C31 / #1F2329 / #676C73 | Card outlines, row separators, input borders (≥3:1) |
| `--primary` / `--primary-hover` / `--link` / `--focus` | #007B70 / #00695F / #00695F / #007B70 | #4EB9AD / #6FCABF / #7AD0C5 / #6FCABF | Primary actions, links, focus rings |
| `--accent` | #006E8E | #54BBD2 | Second stop of the signature gradient; carries the same label colour as `--primary` |
| `--grad-signal` / `--grad-signal-soft` | | | primary → accent at 135°; a 10–16% tint of it for icon tiles |
| `--primary-glow` / `--glow-sm` / `--glow-md` / `--ring` | | | Coloured glow under primary buttons and the brand mark; 3px focus ring on inputs |
| `--ambient-1` / `--ambient-2` / `--ambient` | | | Background light behind the app and in KPI card corners |
| `--sheen` / `--edge` | | | 1px top highlight on filled controls / on cards |
| `--shadow-card` | soft two-layer | 1px dark | Resting elevation of panels, KPI and board cards |
| `--hero-*` | dark (stays dark) | = theme | Sign-in hero panel: background, text, line, signal, accent |
| `--success` `--warning` `--danger` `--info` `--violet` | 6.0–6.2:1 on white | 6.8–8.7:1 on card | Status text; each has a `-soft` background |
| `--viz-1…4` | teal ramp, light → dark | teal ramp, dark → light | Complexity mix: Simple → Advanced |
| `--viz-bar` / `--viz-bar-strong` / `--viz-track` | | | Chart bars (latest value strong), bar tracks |
| `--shift-morning` / `--shift-evening` / `--shift-night` | #117555 / #955816 / #5D57A4 | #69CBA3 / #E6AF68 / #A4A2E8 | Shift Schedule tones (categorical, never status). Until-8pm is orange in Black Gold and night is cyan in Midnight, so neither reads as the accent. 5.7–9.6:1 on cards |
| `--cat-1…4` (analytics) | #2A78D6 / #EB6834 / #1BAF7A / #EDA100 | #3987E5 / #D95926 / #199E70 / #C98500 | Categorical chart series (teams, compared items), fixed order, never cycled. Validated with the dataviz palette checks on every theme's card surface; aqua and yellow are below 3:1 on white, so analytics charts always carry labels and a table view |

### Contrast (WCAG 2.2 AA, from `node scripts/palette.mjs`)
| Pair | Daylight | Graphite | Black Gold | Midnight |
|---|---|---|---|---|
| Text on card | 17.3 | 14.8 | 16.0 | 15.3 |
| Secondary text on card | 7.8 | 9.5 | 10.4 | 10.0 |
| Muted text on card / on app background | 5.3 / 4.6 | 6.3 / 6.9 | 6.8 / 7.5 | 6.8 / 7.5 |
| Label on primary / on accent (both gradient stops) | 5.2 / 5.8 | 8.2 / 8.8 | 12.6 / 9.1 | 7.5 / 7.9 |
| Link on card | 6.6 | 9.8 | 12.2 | 9.0 |
| Input border (3:1 needed) | 3.6 | 3.3 | 3.6 | 3.7 |
| Status colours on card | 6.0–6.2 | 6.8–8.7 | 6.6–9.3 | 6.6–9.2 |
| Shift tones on card | 5.7–6.2 | 7.5–9.0 | 7.9–9.6 | 8.6–9.2 |

### Typography
Semantic styles (`--type-*` font shorthands): display 28/600 (sign-in heading 32) · page title 24/600 · section 15/600 · card title 13/600 · body 14/400 · prose 15/1.6 (descriptions, comments) · body-sm 13 · table 13 · label 12/500 · caption 12 · overline 11/500 uppercase · KPI 28/600 tabular. Weights 400/500/600 only.

**Persian screens.** The shell stays English; Shift Schedule, Shift changes and Analytics are Persian and right-to-left (`dir="rtl"` on the page). Analytics charts (ECharts) draw in a left-to-right box and wrap every label in a right-to-left embedding, so mixed Persian/Latin text stays in order; category labels sit on the right and bars grow leftwards. `styles/rtl.css` redefines every `--type-*` token under `[dir="rtl"]` on Vazirmatn, so these screens keep the same hierarchy with no screen-specific sizes: labels and captions go up half a step (12.5px), line heights open to 1.6–1.75, and there is no uppercase or tracking. Shared components (selects, search, dialogs, panel actions) are mirrored there too. Use logical properties (`margin-inline-start`, `text-align: start`) in RTL screen styles; month navigation puts *previous* on the right.

### Spacing, radius, sizing, motion
- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (`--s-1` … `--s-16`).
- **Radius:** 4 (checkbox, kbd, badges) · 6 (buttons, inputs, menu items) · 8 (segmented tracks, tiles, brand mark) · 12 (cards, panels, popovers) · 14 (main sheet, dialogs) · 20 (sign-in hero).
- **Controls:** 28 (sm) · 32 (default) · 40 (lg, sign-in). Table rows 40 (36 compact), headers 34. Touch screens raise controls to ≥40px.
- **Layout:** sidebar 236 (56 collapsed), header 52, content max 1440 (reading pages 960).
- **Motion:** 120 / 160 / 220ms, ease-out for feedback; a spring curve (`--ease-spring`) for check marks, toasts and the active nav marker. Entrances live in `styles/motion.css`: a page's blocks rise 8px and fade in top to bottom (40ms apart), KPI cards stagger by 50ms, bars and progress fills grow from their baseline, donut segments sweep in, board cards rise into their column. Only opacity and transform, `backwards` fill (nothing stays applied after an entrance, so hover lifts keep working and fixed dialogs are never trapped), and `prefers-reduced-motion` turns motion off.
- **Z-index:** sticky 2 · nav 30 · scrim 40 · modal 41 · popover 50 · tooltip 55 · toast 60.

---

## 3. Semantic indicators

Status, priority and complexity each use a different shape, so none depends on colour alone.

- **Status — circle fill + label.** Backlog ◌ dashed · To Do ○ · In Progress ◐ · Review ◕ (violet) · Done ● (green). Exceptions get a soft pill: **Blocked** (red) and **Returned** (amber). Cancelled is struck through.
- **Priority — signal bars.** Low 1 bar, Normal 2, High 3 (label in primary text). **Critical** is a red square with "!" — the only coloured priority.
- **Complexity — diamond pips in ink.** ◆◇◇◇ Simple → ◆◆◆◆ Advanced; never teal, so it doesn't compete with actions.
- **Quality — text first.** Excellent gets an amber ★; Needs Improvement is amber text. Set only on approval.
- **Badges** (20px, radius 4) carry text plus an optional dot; tones: neutral, success, warning, danger, info, violet, primary.

---

## 4. Components (`components/ui/`)

| Component | Spec |
|---|---|
| **App shell** (`shell/`) | Grouped sidebar (Work · Insights · Organization), task views and Shift Log as sub-items with open counts, profile menu (Account, Keyboard shortcuts, Sign out). Collapses to a 56px rail with tooltips; below 1024px it becomes an off-canvas drawer (inert while closed). |
| **Top bar** | Sidebar toggle, linked breadcrumbs, search trigger (⌘K), notifications, theme menu. No page actions here. |
| **Theme menu / Appearance** (`ThemePicker.js`) | Top bar: a radio menu (`menuitemradio`) with a miniature of each theme, digits 1–4. Account › Appearance: radio cards with larger previews, ←/→ move and select. Sign-in: round swatches. Previews draw each theme in its own colours from `lib/themes.js`. |
| **Command menu** | ⌘K dialog: searches tasks by ID/title within the viewer's scope, people (managers), and pages; Create task action. Combobox + listbox semantics, ↑/↓/Enter/Esc. |
| **PageHeader** | Optional eyebrow (manager dashboards greet the viewer by time of day), title, a quiet meta line joined with "·" (date range, counts), actions on the right. One primary action per page. |
| **SectionHeader** | Title, meta and actions for sections outside cards; an optional icon tile (task details: Attachments, Checklist, Comments). |
| **Panel** | Card section with header (title · meta · actions), body, optional footer (legends, notes). |
| **Button** | Primary · Secondary · Ghost (tertiary) · Danger · Ghost-danger · Icon (`IconButton`: aria-label + tooltip, always). Sizes 28/32/40. Busy state shows a spinner and blocks repeat clicks. |
| **Segmented** | Period pickers and view toggles (`radiogroup`), status tabs (`tablist`). Roving focus, ←/→/Home/End. Optional counts. |
| **Field / FormAlert** | Visible label, control, hint or error (with icon), wired through `aria-describedby`/`aria-invalid`. Validation runs on submit, never before interaction; server errors appear in a `FormAlert`. `.input-wrap` adds a leading icon (accent on focus) and an optional trailing `.input-action` — the sign-in password field uses it for show/hide, plus a Caps Lock hint. |
| **Metric / MetricGrid** | KPI card: optional icon tile (signal tint; red on `alert`), label (+ info hint), value with unit, one line of context — a real previous-period `Delta` where the API has it. `alert` tone for values that need action (the corner light turns red). Cards can link to the filtered list; linked cards lift and show a gradient top edge on hover. The grid counts cards inside fragments and wraps into balanced rows: five fill 3 + 2 with no hole, an odd count ends with a full-width card on phones. |
| **Bars** | Mini column chart with a baseline; pass `max` to share one scale across rows. Latest value emphasised; values in tooltips and `aria-label`. |
| **DonutBreakdown** | Share of a total for up to four categories. Segments are separated by a small gap and draw in on mount; hovering a segment or its legend row highlights the pair and puts that category's value in the centre. Categories take the ramp out of order (3, 1, 4, 2) so neighbours always contrast. |
| **Distribution / CxLegend** | 100% stacked complexity bar with counts in tooltip and `aria-label`; legend with optional totals. |
| **Meter** | Labelled progress bar (`role="progressbar"`) with a numeric readout. |
| **Popover** | Anchored menu or panel. Flips above the anchor near the bottom of the viewport, moves focus in, returns it to the trigger, closes on Esc/Tab/outside click/scroll. Digit shortcuts on menu items. |
| **Dialog** | Title + description, close button, focus trap, Esc. Scrim clicks close only when nothing typed would be lost. Becomes a bottom sheet on phones. Destructive confirmations use a danger button and neutral copy about consequences. |
| **Tooltip** | One global layer for any `[data-tooltip]`: 400ms hover delay, instant on keyboard focus and between neighbours, fixed positioning so scroll containers never clip it. |
| **Toasts** | Success / info / error tones with matching icons; errors stay longer and use `role="alert"`; dismissible. |
| **EmptyState / Notice / ErrorState / Loading** | Empty: what happened, whether it's normal, one next step. Notice: one-line state inside a panel ("All clear"). ErrorState maps failures to network / permission / not found / server copy with Retry where it helps — raw server output is never shown. Skeletons keep layout and fade in late so fast loads never flash. |

---

## 5. Data tables

- **Density:** rows 40px, headers 34px, 13px text with tabular numbers. Divider lines between rows only.
- **Alignment:** text left, numbers right. Zeros are muted so real values stand out.
- **Header:** 12px/500 muted. Sortable columns use a real button with a sort icon and `aria-sort`.
- **Rows:** hover overlay; clickable rows also expose a real link in the title cell for keyboard and screen-reader users.
- **Keyboard (task lists):** `J/K` or `↑/↓` show and move a row cursor, `Enter` opens, `S`/`P` open status/priority menus, `/` focuses search, `C` creates, `?` lists shortcuts.
- **Inline editing:** Status and Priority cells open menus that only offer allowed workflow moves.
- **Grouping:** group header rows on the inset surface (e.g. by assignee) with counts and overdue totals.
- **Board view:** five status columns, each with its status colour as a 2px top edge and a count pill. Cards show ID and avatar on top, title, then priority and deadline; blocked cards get a red outline and pill, overdue cards a red left rail.
- **Filters:** search, selects (highlighted when set), "Reset filters (n)", and a live "x of y" result count.
- **Overflow:** wide tables scroll inside their card with edge shadows; task tables keep a minimum width so titles never collapse, and become stacked rows on phones. Report tables paginate above 100 rows and keep a sticky header inside their scroll area.

---

## 6. Interaction patterns

| Pattern | Rule |
|---|---|
| Progressive disclosure | Long attention lists show 6 rows then "Show all"; issue details and ticket entry open inline. |
| Inline editing | Status, priority, hours, IOC count, checklist and tickets are edited in place and saved immediately. |
| Drop to attach | A task with no files shows one dashed drop zone: click to browse or drop a file onto it (it lights up while a file is over it). |
| Confirmation | Toasts confirm; dialogs only for destructive actions (remove member, delete comment, remove file). |
| Autosave | The Shift Log shows "Autosaved / Saving… / Not saved" as a live status. |
| Deep links | KPI cards link to the relevant list (e.g. `/tasks/team?tab=review`). |

## 7. Accessibility
- All text/background pairs meet WCAG AA (see §2); input borders and chart marks meet 3:1 against their surface.
- Focus is always visible (`:focus-visible` 2px outline); never removed.
- Landmarks: sidebar `nav`, breadcrumb `nav`, `main#main` with a skip link.
- Every icon-only control has an accessible name and a tooltip; charts have text alternatives.
- Dialogs trap focus and restore it; menus move focus in and back out.
- Forms: visible labels, described hints and errors, errors announced on submit.
- `prefers-reduced-motion` disables animation.
