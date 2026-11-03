"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { normalizeLocale, translate } from "@/lib/i18n/messages";
import { provinceLabel, roleLabel, teamLabel } from "@/lib/i18n/labels";

const LocaleContext = createContext(null);

export default function I18nProvider({ initialLocale, children }) {
  const router = useRouter();
  const [locale, setLocale] = useState(() => normalizeLocale(initialLocale));
  const changeLocale = useCallback((value) => {
    const next = normalizeLocale(value);
    document.cookie = `so.locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
    setLocale(next);
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({
    locale, dir: locale === "fa" ? "rtl" : "ltr", setLocale: changeLocale,
    t: (text) => translate(locale, text),
    role: (code) => roleLabel(code, locale),
    team: (name) => teamLabel(name, locale),
    province: (name) => provinceLabel(name, locale),
    number: (value, options) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", options).format(value),
  }), [locale, changeLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("I18nProvider is missing");
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <div className="language-switch" role="group" aria-label={t("Language")}>
    <button type="button" lang="fa" aria-label="فارسی" aria-pressed={locale === "fa"} onClick={() => setLocale("fa")}>فا</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
  </div>;
}
