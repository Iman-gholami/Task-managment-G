// Languages, directions and per-user display preferences. Shared by the server, the browser and Node tests.
export const LOCALES = ["fa", "en"];
export const DEFAULT_LOCALE = "fa";
export const LOCALE_COOKIE = "so_lang";

export const DENSITIES = ["comfortable", "compact"];
export const DEFAULT_DENSITY = "comfortable";
export const DENSITY_COOKIE = "so_density";

/** Cookies mirror the saved preferences so the server can render the right language before anyone signs in. */
export const PREF_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export const isLocale = (v) => LOCALES.includes(v);
export const isDensity = (v) => DENSITIES.includes(v);
export const dirOf = (locale) => (locale === "fa" ? "rtl" : "ltr");

/** BCP 47 tags for Intl. Persian uses Persian digits; English uses Latin digits. */
export const INTL_LOCALE = { fa: "fa-IR", en: "en-US" };

/** The calendar follows the language: Jalali for Persian, Gregorian for English. */
export const CALENDAR_OF = { fa: "jalali", en: "gregorian" };
export const calendarOf = (locale) => CALENDAR_OF[locale] ?? CALENDAR_OF[DEFAULT_LOCALE];

/** Picks the first valid locale: the user's saved preference, then the cookie, then Persian. */
export const resolveLocale = (...candidates) => candidates.find(isLocale) ?? DEFAULT_LOCALE;
export const resolveDensity = (...candidates) => candidates.find(isDensity) ?? DEFAULT_DENSITY;
