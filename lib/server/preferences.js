import "server-only";
import { DENSITY_COOKIE, LOCALE_COOKIE, PREF_COOKIE_MAX_AGE, isDensity, isLocale } from "@/lib/i18n/config";
import { db } from "@/lib/server/db";

// A person's display preferences: language (users.locale) and density (users.density). NULL means never chosen, and
// lib/server/i18n.js falls back to the cookies, then to the defaults. The cookies mirror the saved values, so the
// server renders the right language on the sign-in page and right after signing out too.

/** The saved { locale, density }; null when never chosen (or no longer supported). */
export function getPreferences(userId) {
  const row = db.prepare("SELECT locale, density FROM users WHERE id = ?").get(userId);
  return {
    locale: isLocale(row?.locale) ? row.locale : null,
    density: isDensity(row?.density) ? row.density : null,
  };
}

/** Saves the valid fields of { locale, density }; missing or unsupported values leave the saved one unchanged. */
export function savePreferences(userId, { locale, density } = {}) {
  db.prepare("UPDATE users SET locale = COALESCE(?, locale), density = COALESCE(?, density) WHERE id = ?")
    .run(isLocale(locale) ? locale : null, isDensity(density) ? density : null, userId);
  return getPreferences(userId);
}

/**
 * Writes the so_lang / so_density cookies for the valid values given (in a Route Handler or Server Function:
 * pass `await cookies()`). Not httpOnly: they hold no secret and the page may read them.
 */
export function setPreferenceCookies(cookieStore, { locale, density } = {}) {
  const options = { path: "/", sameSite: "lax", maxAge: PREF_COOKIE_MAX_AGE, httpOnly: false, secure: process.env.COOKIE_SECURE === "true" };
  if (isLocale(locale)) cookieStore.set(LOCALE_COOKIE, locale, options);
  if (isDensity(density)) cookieStore.set(DENSITY_COOKIE, density, options);
}
