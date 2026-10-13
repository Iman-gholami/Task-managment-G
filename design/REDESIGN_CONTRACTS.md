# Redesign contracts

The interfaces every part of the redesign builds on. Code that is shared between phases follows these names and
signatures exactly; change them only together with every caller. (Plan and decisions: `REDESIGN_PLAN.md`.)

## 1. i18n

```js
import { createT } from "@/lib/i18n";                 // t(key, params); t.has(key); t.maybe(key, params, fallback); t.locale
import { LOCALES, DEFAULT_LOCALE, dirOf, calendarOf, LOCALE_COOKIE, DENSITY_COOKIE, isLocale, isDensity } from "@/lib/i18n/config";
import { statusName, prioName, cxName, qualityName, roleName, teamName, shiftTypeName, itemKindName, swapStatusName } from "@/lib/i18n/labels";
import { useI18n, useT, I18nProvider } from "@/components/i18n";   // client: { t, fmt, locale, dir, density }
import { getServerI18n } from "@/lib/server/i18n";                // server: { user, locale, density, dir, t, fmt }
```

- Dictionaries: `lib/i18n/messages/<namespace>.js`, each `export default { fa: {…}, en: {…} }`, identical shape.
  Keys are `"<namespace>.<path>"`. Plurals are `{ one, other }` (pick by `params.count`). Placeholders `{name}`.
  Namespaces (one owner each while work is parallel): `common`, `enums`, `errors`, `events`, `nav`, `shell`,
  `notifications`, `dashboard`, `tasks`, `task`, `shift`, `schedule`, `checklists`, `insights`, `reports`, `team`,
  `admin`, `account`, `auth`, `onboarding`, `states`, `dates`.
- Never translate user content or stored values in the database. Stored enumerations are translated with
  `lib/i18n/labels.js`.
- Persian copy follows `lib/i18n/GLOSSARY.md`.
- Number params are formatted by `t` (Persian digits in `fa`). Pass pre-formatted strings for IDs and years.

## 2. Digits, dates, numbers (`lib/i18n/digits.js`, `lib/i18n/dates.js`, `lib/i18n/format.js`)

ISO day strings (`YYYY-MM-DD`) everywhere. Calendars: `"jalali"` (fa) and `"gregorian"` (en). The organisation's
week starts on Saturday and Friday is the weekend, in both languages. Timestamps display in Asia/Tehran.

```js
// digits.js
normalizeDigits(str)          // ۰-۹ and ٠-٩ → 0-9, "٫" → ".", drops "٬"
parseNumber(str)              // Number or NaN after normalizing ("۶٫۵" → 6.5)
toLocaleDigits(str, locale)   // Latin → Persian digits for "fa"
searchKey(str)                // lower-case, digits normalised, ي→ی ك→ک, ZWNJ/diacritics removed (T-۱۰۰۱ ≡ t-1001)

// dates.js (pure)
ymd(iso, cal) → { y, m, d }            fromYmd(y, m, d, cal) → iso (clamps the day, normalises month overflow)
monthLength(y, m, cal)                 isLeapYear(y, cal)
addDays(iso, n)   diffDays(a, b)       addMonths(iso, n, cal)
weekdayIndex(iso) → 0 Saturday … 6 Friday     isWeekend(iso)     weekStart(iso)
monthStart/monthEnd(iso, cal)   quarterStart/quarterEnd(iso, cal)   yearStart/yearEnd(iso, cal)
monthGrid(y, m, cal) → 42 ISO days, Saturday-first, covering the month
todayIso()                             // Tehran today
parseTimestamp(ts) → Date              // "YYYY-MM-DD HH:MM:SS" (UTC), ISO string, number or Date
tehranParts(ts) → { date, hour, minute }

// format.js
const fmt = createFormat(locale)        // cached per locale
fmt.locale, fmt.calendar
fmt.number(v, { digits = 1, min = 0, signed = false })   // "—" for null/NaN
fmt.int(v)   fmt.decimal(v, digits = 1)   fmt.percent(share, digits = 0)   // 0.85 → "۸۵٪" / "85%"
fmt.digits(str)                                          // Persian digits in fa
fmt.monthName(m, { short })   fmt.weekdayName(i, { short, narrow })   // in the locale's calendar; i: 0 = Saturday
fmt.date(iso, style)   // "short" ۱۴ مهر | Oct 14 · "medium" ۱۴ مهر ۱۴۰۵ | Oct 14, 2026 ·
                       // "long" سه‌شنبه ۱۴ مهر ۱۴۰۵ | Tuesday, October 14, 2026 · "numeric" ۱۴۰۵/۰۷/۱۴ | 2026-10-14 ·
                       // "monthYear" مهر ۱۴۰۵ | October 2026 · "weekdayShort" سه‌شنبه ۱۴ مهر | Tue, Oct 14
fmt.range(from, to)    // ۱ تا ۱۴ مهر ۱۴۰۵ | Oct 1 – 14, 2026
fmt.time(ts)  fmt.dateTime(ts)  fmt.relative(ts, now = Date.now())   // "۲ روز پیش" | "2 days ago"
fmt.due(iso, { open = true, today }) → { text, tone: "overdue" | "soon" | "normal" | "none", days }
fmt.hours(v)  fmt.days(v)  fmt.list(items)
```

Periods (`lib/analytics/periods.js`): `resolveRange(filters, today, { calendar, locale })`,
`comparisonRange(range, mode, { calendar, locale })`, `buckets(from, to, gran, { calendar, locale })`. Presets resolve in
`filters.cal` when set, else in the viewer's calendar. Presets write explicit ISO `from`/`to` (+ `cal`) to the URL; custom
ranges write only `p=custom&from&to`. Old exports keep working until the analytics screens move (phase 3).

## 3. Server

- Errors: `err(status, error, code, params)` from `@/lib/server/access`. Every error response is
  `{ error: "<English sentence>", code: "<camelCaseCode>", params? }`; the English `error` text is unchanged.
  Thrown domain errors use `AppError` from `@/lib/server/errors` (`new AppError(status, message, code, params, extra)`).
  The client `api()` localizes `errors.<code>` with the page language and falls back to `error`.
- Preferences: `users.locale`, `users.density` (nullable). `@/lib/server/preferences`: `getPreferences(userId)`,
  `savePreferences(userId, { locale?, density? })`. `PUT /api/account/preferences` saves for a signed-in user and always
  sets the `so_lang` / `so_density` cookies (anonymous callers get cookies only).
- New tables: `notifications`, `saved_views`, `user_flags` (see `REDESIGN_PLAN.md` §3.6). Migrations are additive
  and idempotent, in `lib/server/db.js`.

## 4. Design tokens (`styles/tokens.css`, every theme defines every colour token)

Kept: `--bg --surface --surface-card --surface-inset --surface-raised --surface-input --hover --pressed --nav-active
--selected --text --text-2 --text-3 --text-on-primary --border --divider --border-strong --primary --primary-hover
--primary-soft --accent --link --focus --success/--warning/--danger/--info/--violet/--neutral (+ -soft) --viz-* --cat-*
--shift-* --hero-* --scrim --tooltip-bg --tooltip-text`, type tokens `--type-*`, spacing `--s-*`, radii `--r-*`, z-index.

New (all four themes):

| Group | Tokens |
|---|---|
| Elevation | `--elev-0` … `--elev-4` (box-shadow lists incl. a 1px top highlight); `--edge` |
| Glass | `--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-highlight`, `--glass-blur`, `--glass-saturate`, `--glass-solid` (fallback) |
| Ambient | `--aurora-1`, `--aurora-2`, `--aurora-3`, `--aurora` (composite background), `--grain-opacity` |
| Gradients | `--grad-signal`, `--grad-signal-soft`, `--grad-border`, `--grad-progress`, `--grad-sheen` |
| Charts | `--series-focus`, `--series-focus-2`, `--chart-grid`, `--chart-area-opacity` |
| Density | `--row-h`, `--row-h-head`, `--ctl-h`, `--ctl-h-sm`, `--ctl-h-lg`, `--pad-card`, `--pad-cell-x`, `--gap-page`, `--gap-grid`, `--fs-table` (Comfortable on `:root`, Compact on `[data-density="compact"]`) |
| Motion | `--t-press` 110ms, `--t-fast` 160ms, `--t-base` 220ms, `--t-panel` 280ms, `--t-slow` 420ms, `--ease-out`, `--ease-in-out`, `--ease-spring`, `--ease-emph` |
| Layout | `--sidebar-w`, `--sidebar-w-rail`, `--header-h`, `--measure` (960px), `--measure-narrow` (720px), `--page-pad` |

Utility classes provided by the token layer (`styles/base.css`): `.glass`, `.glass-strong`, `.elev-1` … `.elev-4`,
`.grad-border`, `.ltr` (isolated LTR run), `.mono`, `.num` (tabular figures), `.i-dir` (mirrors in RTL), `.sr-only`,
`.aurora` (app background layer). `prefers-reduced-transparency` and missing `backdrop-filter` fall back to
`--glass-solid`; `prefers-reduced-motion` disables animation.

## 5. CSS conventions

- Logical properties only (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-inline-start`,
  `text-align: start|end`). No `left`/`right` except in charts' internal drawing boxes.
- Direction-aware icons get `className="i i-dir"` (chevrons, arrows, side panel); nothing else is mirrored.
- Glass only on chrome and overlays; tables, forms and long text sit on solid surfaces.
- New component styles go in a CSS module next to the component; layered global files keep the shared patterns.
- `fa` type layer: `styles/locale.css` (`:root[lang="fa"]`).
