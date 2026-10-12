# Sentinel Ops: Design System

A calm, dense, data-first system for a security organization's internal work tool.
Its look comes from hierarchy, layered surfaces and one solid signal colour. Four themes share every rule;
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
- **Signal**: one solid colour per theme (deep teal, antique gold or periwinkle) for primary actions, checked controls, progress, the active navigation item, links, focus rings and the latest data value. Nothing decorative uses it: icon tiles, section icons, empty-state glyphs, hover borders and eyebrows stay in ink, so anything in the signal colour is actionable or current.
- **No second brand hue**: nothing is drawn as a gradient between two colours, and there are no coloured glows, ambient light or gradient text. `--grad-signal` is a flat fill (kept as an image so overlays can layer on it); `--glow-*` is a crisp 1px edge plus a soft neutral or ink-tinted shadow, never a halo.
- **Colour is for meaning**: status colours appear only on states (status, priority Critical, overdue, blocked, returned, review); shift tones are their own categorical hues (sage, copper, indigo) that never coincide with a status; file types, notification kinds that are not states, and checklist groups that are simply on stay neutral. Hover is always neutral (`--hover`, a border shift toward `--border-strong`); the signal marks selection and focus only.
- **Depth from layering**: in the dark themes each level is a step lighter — app background → content sheet → cards → insets → menus — with a faint 1px top highlight (`--edge`) on cards. In the light theme cards get a soft two-layer shadow (`--shadow-card`). Shadows use the theme's own ink (`--shadow-ink`), never pure black on tinted surfaces. Menus, toasts and the dialog scrim blur what is behind them.
- **One typeface per script**: Geist (UI) with tabular numbers for all figures; Geist Mono only for IDs, ticket numbers and references. Persian (RTL) screens use Vazirmatn through the same type tokens (see *Persian screens* below). (The earlier display serif was removed: its condensed digits made "11" read as "ll".)

---

## 2. Tokens

Components use semantic tokens only. Hex values come from `scripts/palette.mjs` (OKLCH), which also prints every contrast pair.

### Themes
Each theme is one block in `tokens.css` (`<html data-theme="…">`) that defines the full set of colour tokens below; nothing else in the CSS knows which theme is active.

| Id | Name | Surfaces | Signal | Notes |
|---|---|---|---|---|
| `light` | Daylight | cool white and slate | deep teal #00756C | White labels on the signal (5.6:1) |
| `dark` | Graphite | blue-slate, layered | teal #55B8AD | |
| `gold` | Black Gold | warm near-black | antique gold #E4B65C | Warning is orange (#EC9660) and until-8pm rose-copper (#E5A190) so neither reads as the signal |
| `midnight` | Midnight | deep navy | periwinkle #A2A1EE | Review is rose (#E196C0) and night cyan (#79CACF) so neither reads as the signal |

- **Choosing a theme:** the palette button in the top bar (menu, digits 1–4), Account › Appearance (preview cards), the swatches on the sign-in page, or ⌘K ("theme", "gold", "midnight"…). The choice is stored per device (`localStorage["so.theme"]`); with no choice the OS preference picks Daylight or Graphite.
- **No flash:** `app/layout.js` sets `data-theme` before first paint; `components/theme.js` also updates `<meta name="theme-color">`.
- **Reveal:** where the browser supports view transitions, the new theme spreads in a circle from the control that picked it (560ms). With reduced motion it switches instantly.
- **Adding a theme:** add it to `scripts/palette.mjs` and make it pass (`node scripts/palette.mjs` exits 1 on any contrast or distinctness failure), add a `:root[data-theme="<id>"]` block with every colour token, and add an entry to `lib/themes.js` (name, note, swatches).

### Colour (semantic)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #EDF0F4 | #0B0F14 | App background, sidebar |
| `--surface` | #F9FAFC | #11161A | Main content sheet |
| `--surface-card` | #FFFFFF | #171B20 | Cards, panels, tables (incl. sticky table headers) |
| `--surface-inset` | #F3F5F8 | #1C2125 | Segmented tracks, group rows, side panels, dialog footers, neutral icon tiles |
| `--surface-raised` | #FFFFFF | #21252A | Menus, dialogs, toasts |
| `--surface-input` | #FFFFFF | #11161A | Form controls (inset look in dark) |
| `--surface-toggle` | #FFFFFF | #2F3338 | Selected segment on an inset track |
| `--hover` / `--pressed` / `--nav-active` | ink at 4.5–9% alpha | same | Neutral interaction overlays that work on any surface; `--nav-active` is neutral in every theme |
| `--selected` | signal at 9% | signal at 12% | Selected rows and list items (with a signal rail) |
| `--text` / `--text-2` / `--text-3` | #151B22 / #495158 / #5F676F | #E8EBEF / #B9BEC4 / #969CA3 | Primary, secondary, muted (muted clears 4.5:1 on every surface and under hover overlays) |
| `--text-on-primary` | #FFFFFF | #0B0F14 | Labels, checks and the switch thumb on the signal |
| `--border` / `--divider` / `--border-strong` | #DFE3E8 / #E8EBEF / #7F8790 | #2A2F34 / #22262B / #6B7177 | Card outlines, row separators, input borders (≥3:1) |
| `--primary` / `--primary-hover` / `--link` / `--focus` | #00756C / #00645C / #00645C / #00756C | #55B8AD / #75C9BF / #7FCFC5 / #75C9BF | Primary actions (hover moves to `--primary-hover`), links, focus |
| `--primary-soft` | signal at 10% | signal at 14% | Tinted chips and counts that belong to the signal (active nav count, filter chips, calendar ranges) |
| `--grad-signal` / `--grad-signal-soft` | | | Flat signal fill / flat signal tint, kept as images so overlays can layer on them |
| `--primary-edge` / `--primary-shadow` / `--glow-sm` / `--glow-md` | darker 1px edge, teal-ink shadow | no edge, ink shadow | Resting and raised elevation of filled signal controls (primary button, brand mark, chosen theme card) |
| `--ring-color` / `--ring` | focus at 28% | focus at 32% | 3px focus halo on inputs, the composer, steppers, open date triggers and a file dragged over a dropzone |
| `--primary-glow` / `--ambient-1` / `--ambient-2` | transparent | transparent | Retired effects, transparent in every theme; kept so the layers that compose them stay valid |
| `--sheen` / `--edge` | white 10% / 70% | white 8% / 3.5% | Hairline top highlight on filled controls / on cards |
| `--knob` | #FFFFFF | = `--text` | Switch thumb when off (on: `--text-on-primary`) |
| `--shadow-ink` | 21 27 34 | 2 3 4 | RGB channels for one-off shadows: `rgb(var(--shadow-ink) / α)` |
| `--select-chevron` | muted ink | muted ink | Select chevron drawn in the theme's `--text-3` |
| `--avatar-ink` | #151B22 | same | Avatars show the stored member colour mixed 25% toward this ink, so white initials clear 4.5:1 even for colours saved before the current member palette |
| `--shadow-card` | soft two-layer | 1px dark | Resting elevation of panels, KPI and board cards |
| `--hero-*` | Graphite (stays dark) | = theme | Sign-in hero panel: background, text, line and the one signal hue of the radar |
| `--success` `--warning` `--danger` `--info` `--violet` | 5.9–6.2:1 on white | 6.2–9.0:1 on card | Status text; each has a `-soft` background (10% light, 13% dark themes) on which the status text still clears 5.1:1. `--violet` is the Review hue (rose in Midnight) |
| `--danger-solid` / `--danger-solid-hover` / `--on-danger` | #A93C39 / #932F2E / #FFFFFF | #AE4440 / #9D3C39 / #FFFFFF | Destructive buttons and the Critical priority square |
| `--viz-1…4` | teal ramp, light → dark | ramp, dark → light | Complexity mix: Simple → Advanced (ordinal: the light end clears 2:1, steps ≥ 0.06 L apart) |
| `--viz-bar` / `--viz-bar-strong` / `--viz-track` | #389188 / #00756C / #E8EBEF | #37867E / #55B8AD / #22262B | Chart bars at full strength (≥3:1), the latest value in the signal, bar tracks |
| `--shift-morning` / `--shift-evening` / `--shift-night` | #5D7235 / #9B5738 / #404D89 | #ACC67E / #E79D7B / #8998D1 | Shift Schedule tones: sage, copper, indigo — categorical, never status, each at least ΔE 0.045 (OKLab) from every status colour. Until-8pm is rose-copper in Black Gold and night is cyan in Midnight, so neither reads as the signal. 5.3–9.4:1 on cards |
| `--cat-1…4` | #2A78D6 / #EB6834 / #1BAF7A / #EDA100 | #3987E5 / #D95926 / #199E70 / #C98500 | Categorical chart series (teams, compared items), fixed order, never cycled; defined per theme in `tokens.css`. Validated with the dataviz palette checks on every theme's card surface; aqua and yellow are below 3:1 on white, so analytics charts always carry labels and a table view |

### Contrast (WCAG 2.2 AA, from `node scripts/palette.mjs`)
| Pair | Daylight | Graphite | Black Gold | Midnight |
|---|---|---|---|---|
| Text on card | 17.3 | 14.5 | 15.3 | 14.8 |
| Secondary text on card | 8.1 | 9.3 | 10.2 | 9.8 |
| Muted text on card / on app background / under a sidebar hover | 5.7 / 5.0 / 4.6 | 6.2 / 6.9 / 6.3 | 6.6 / 7.3 / 6.7 | 6.7 / 7.5 / 6.8 |
| Label on primary | 5.6 | 8.1 | 10.4 | 8.1 |
| Link on card | 7.1 | 9.6 | 10.8 | 9.4 |
| Input border (3:1 needed) | 3.6 | 3.5 | 3.7 | 3.7 |
| Status colours on card / on their own tint | 5.9–6.2 / 5.2–5.4 | 6.6–8.5 / 5.4–6.7 | 6.2–8.7 / 5.2–6.8 | 6.5–9.0 / 5.4–7.0 |
| Label on danger fill | 6.2 | 5.7 | 5.7 | 5.7 |
| Shift tones on card | 5.3–8.0 | 6.2–9.2 | 6.3–9.4 | 7.8–9.1 |
| Chart bars on card (3:1) / complexity ramp light end (2:1) | 3.8 / 2.1 | 4.0 / 2.4 | 4.1 / 2.6 | 3.9 / 2.5 |

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
- **Quality — text first.** Excellent gets a ★ in ink; Needs Improvement is amber text (the only coloured grade). Set only on approval.
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
| **Metric / MetricGrid** | KPI card: optional icon tile (neutral ink; red on `alert`), label (+ info hint), value with unit, one line of context — a real previous-period `Delta` where the API has it. `alert` tone for values that need action (red border, value and icon tile). Cards can link to the filtered list; linked cards lift and show a signal top edge on hover. The grid counts cards inside fragments and wraps into balanced rows: five fill 3 + 2 with no hole, an odd count ends with a full-width card on phones. |
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
