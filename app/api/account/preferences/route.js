import { cookies } from "next/headers";
import { isDensity, isLocale } from "@/lib/i18n/config";
import { err } from "@/lib/server/access";
import { getServerI18n, getViewerLocale } from "@/lib/server/i18n";
import { savePreferences, setPreferenceCookies } from "@/lib/server/preferences";

// Language and density of the viewer. Works signed out too (the sign-in page switch): then only the cookies change.

export async function GET() {
  return Response.json(await getViewerLocale());
}

/** { locale?, density? }: saved to the account when signed in; the cookies always mirror the effective values. */
export async function PUT(request) {
  const body = (await request.json().catch(() => null)) ?? {};
  const locale = body.locale ?? undefined;
  const density = body.density ?? undefined;
  if ((locale !== undefined && !isLocale(locale)) || (density !== undefined && !isDensity(density))) {
    return err(400, "Choose a supported language or density.", "invalidPreference");
  }

  const viewer = await getServerI18n();
  const prefs = { locale: locale ?? viewer.locale, density: density ?? viewer.density };
  if (viewer.user) savePreferences(viewer.user.id, { locale, density });
  setPreferenceCookies(await cookies(), prefs);
  return Response.json(prefs);
}
