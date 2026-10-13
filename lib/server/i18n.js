import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createT } from "@/lib/i18n";
import { DENSITY_COOKIE, LOCALE_COOKIE, dirOf, resolveDensity, resolveLocale } from "@/lib/i18n/config";
import { createFormat } from "@/lib/i18n/format";
import { getCurrentUser } from "@/lib/server/auth";

// The viewer's language and density on the server: the signed-in user's saved preference, then the so_lang /
// so_density cookies, then the defaults (Persian, comfortable). Layouts, pages and route handlers use this; client
// components get the same values from <I18nProvider> (components/i18n.js), which the root layout fills from here.

/** Resolved once per request (React cache), however many layouts and pages ask. */
const resolveViewer = cache(async () => {
  const [user, store] = await Promise.all([getCurrentUser(), cookies()]);
  return {
    user,
    locale: resolveLocale(user?.locale, store.get(LOCALE_COOKIE)?.value),
    density: resolveDensity(user?.density, store.get(DENSITY_COOKIE)?.value),
  };
});

/** { user, locale, density, dir, t, fmt } for the current request; user is null when nobody is signed in. */
export async function getServerI18n() {
  const { user, locale, density } = await resolveViewer();
  return { user, locale, density, dir: dirOf(locale), t: createT(locale), fmt: createFormat(locale) };
}

/** Only { locale, density }, e.g. for <html lang dir data-density> in the root layout. */
export async function getViewerLocale() {
  const { locale, density } = await resolveViewer();
  return { locale, density };
}
