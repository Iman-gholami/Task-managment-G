"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_DENSITY, DEFAULT_LOCALE, dirOf } from "@/lib/i18n/config";
import { createT } from "@/lib/i18n";
import { createFormat } from "@/lib/i18n/format";

const I18nContext = createContext(null);

/**
 * Language and display preferences for client components. The root layout resolves them on the server
 * (saved preference → cookie → Persian) and passes them in, so the first render already has the right
 * language, direction, calendar and digits.
 */
export function I18nProvider({ locale = DEFAULT_LOCALE, density = DEFAULT_DENSITY, children }) {
  const value = useMemo(() => ({ locale, density, dir: dirOf(locale), t: createT(locale), fmt: createFormat(locale) }), [locale, density]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const FALLBACK = { locale: DEFAULT_LOCALE, density: DEFAULT_DENSITY, dir: dirOf(DEFAULT_LOCALE) };

/** { t, fmt, locale, dir, density } for the current viewer. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Outside the provider (isolated tests): Persian defaults.
  return { ...FALLBACK, t: createT(DEFAULT_LOCALE), fmt: createFormat(DEFAULT_LOCALE) };
}

export const useT = () => useI18n().t;
