"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Time-of-day greeting with the viewer's first name ("Good morning, Sara").
 * Empty until mounted, so the server and the first client render match; the eyebrow keeps its height.
 */
export default function useGreeting(name = "") {
  const [text, setText] = useState("");
  const { locale, t } = useI18n();
  useEffect(() => {
    const h = new Date().getHours();
    const part = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening";
    const first = name.split(" ")[0];
    setText(first ? `${t(part)}${locale === "fa" ? "،" : ","} ${first}` : t(part));
  }, [name, locale]);
  return text;
}
