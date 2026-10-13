// Digits in and out. People type Persian (۰–۹), Arabic-Indic (٠–٩) or Latin digits; the app parses, stores and
// compares Latin digits and shows Persian digits in fa. Pure: server, browser and Node tests.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

// Persian ۰–۹ (U+06F0–06F9) and Arabic-Indic ٠–٩ (U+0660–0669).
const NON_LATIN_DIGIT = /[۰-۹٠-٩]/g;
// Both blocks start at a multiple of 16, so the low four bits are the digit's value.
const latinDigit = (c) => String(c.charCodeAt(0) & 0xf);

/** "۱۲٬۳۴۵٫۶" → "12345.6": Persian and Arabic-Indic digits to Latin, "٫" to ".", the "٬" group separator dropped. */
export function normalizeDigits(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(NON_LATIN_DIGIT, latinDigit).replace(/٫/g, ".").replace(/٬/g, "");
}

/**
 * A number typed in any of the three digit sets: "۶٫۵" → 6.5, "٣" → 3, "12,345" → 12345, "‎−۳" → -3.
 * Empty or non-numeric input is NaN (never 0).
 */
export function parseNumber(str) {
  if (typeof str === "number") return str;
  const s = normalizeDigits(str)
    .replace(/[‎‏؜\s,]/g, "") // bidi marks from formatted output, spaces, Latin group separators
    .replace(/−/g, "-"); // the minus sign Intl writes
  return s === "" ? NaN : Number(s);
}

/** Latin digits → Persian digits for "fa"; other languages unchanged. For text that is already formatted. */
export function toLocaleDigits(str, locale) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return locale === "fa" ? s.replace(/[0-9]/g, (d) => FA_DIGITS[d]) : s;
}

// Arabic harakat, superscript alef and the hamza marks above/below (U+064B–U+065F, U+0670), tatweel (U+0640),
// ZWNJ/ZWJ and bidi controls: none of them changes what a word is.
const IGNORED = /[ً-ٰٟـ‌‍‎‏؜‪-‮⁦-⁩]/g;

/**
 * Comparable form of a search query or a searched text: lower-case, Latin digits, Persian ی/ک for the Arabic
 * letters, no ZWNJ, tatweel or diacritics, single spaces. "T-۱۰۰۱" ≡ "t-1001", "علي" ≡ "علی", "تسک‌ها" ≡ "تسکها".
 */
export function searchKey(str) {
  return normalizeDigits(str)
    .replace(IGNORED, "")
    .replace(/[يى]/g, "ی") // Arabic yeh, alef maksura
    .replace(/ك/g, "ک") // Arabic kaf
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
