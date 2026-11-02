"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { normalizeLocale, translate } from "@/lib/i18n/messages";

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
  const value = useMemo(() => ({ locale, dir: locale === "fa" ? "rtl" : "ltr", setLocale: changeLocale, t: (text) => translate(locale, text) }), [locale, changeLocale]);
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
