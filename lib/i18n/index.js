// In-house translation layer. `createT(locale)` returns `t(key, params)`; it is a pure function of the dictionaries,
// so it runs in server components, route handlers, client components, lib/analytics/* and Node tests alike.
//
//   t("common.actions.saveChanges")              → "ذخیرهٔ تغییرات" / "Save changes"
//   t("common.count.tasks", { count: 3 })         → "۳ تسک" / "3 tasks"   (plural entry { one, other })
//   t("common.count.ofTotal", { count, total })   → placeholders are {count}, {total}
//
// Numbers passed as params are formatted for the locale (Persian digits in fa, grouping from five digits on).
// Strings pass through unchanged, so user content (names, titles) is never altered.
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from "./config.js";
import { MESSAGES } from "./messages/index.js";

const cache = new Map();
const warned = new Set();

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object" || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

const isPlural = (v) => v !== null && typeof v === "object" && typeof v.other === "string";

export function createT(locale = DEFAULT_LOCALE) {
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  if (cache.has(lang)) return cache.get(lang);
  const dict = MESSAGES[lang];
  const rules = new Intl.PluralRules(INTL_LOCALE[lang]);
  const nf = new Intl.NumberFormat(INTL_LOCALE[lang], { maximumFractionDigits: 2, useGrouping: "min2" });
  const param = (v) => (typeof v === "number" && Number.isFinite(v) ? nf.format(v) : v === null || v === undefined ? "" : String(v));

  function t(key, params) {
    let value = lookup(dict, key);
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production" && !warned.has(`${lang}:${key}`)) {
        warned.add(`${lang}:${key}`);
        console.warn(`[i18n] missing ${lang} key: ${key}`);
      }
      return key;
    }
    if (isPlural(value)) value = value[rules.select(Number(params?.count ?? 0))] ?? value.other;
    if (typeof value !== "string") return key;
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? param(params[name]) : match));
  }
  /** True when the key exists (used for optional, data-driven keys such as error codes). */
  t.has = (key) => lookup(dict, key) !== undefined;
  /** Looks up a key and falls back to `fallback` (not to the key) when it is missing. */
  t.maybe = (key, params, fallback = "") => (t.has(key) ? t(key, params) : fallback);
  t.locale = lang;
  cache.set(lang, t);
  return t;
}

export { MESSAGES };
