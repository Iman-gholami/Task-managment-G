// Dictionary checks: both languages have the same keys and placeholders, nothing is left untranslated, every key the
// code uses exists, and (for finished areas) no key is unused.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NAMESPACES } from "../lib/i18n/messages/index.js";
import { createT } from "../lib/i18n/index.js";

const root = path.resolve(import.meta.dirname, "..");
const PERSIAN = /[؀-ۿ]/;

/** Values that are the same in both languages on purpose: product names, acronyms, codes and symbols. */
const SAME_IN_BOTH = /^(Sentinel Ops|SOC( · L[123])?|L[123]|IOC|MISP|Excel|CSV|PNG|PDF|Splunk|Grafana|Esc|⌘K|Ctrl K|—|[\s\d.:/·%+\-–()#{}]*)$/;

/**
 * Namespaces whose keys may still be unused because their screens have not been rebuilt yet.
 * Every phase removes the namespaces it finishes; at the end this list must be empty (checked in phase 8).
 */
const UNUSED_NOT_YET_ENFORCED = new Set(Object.keys(NAMESPACES));

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !("other" in v && typeof v.other === "string")) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
const strings = (v) => (typeof v === "string" ? [v] : Object.values(v));
const placeholders = (v) => [...new Set(strings(v).flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();

const flat = Object.fromEntries(Object.entries(NAMESPACES).map(([ns, d]) => [ns, { fa: flatten(d.fa), en: flatten(d.en) }]));

test("every namespace has the same keys in Persian and English", () => {
  for (const [ns, { fa, en }] of Object.entries(flat)) {
    const missingEn = Object.keys(fa).filter((k) => !(k in en));
    const missingFa = Object.keys(en).filter((k) => !(k in fa));
    assert.deepEqual(missingEn, [], `${ns}: keys missing in en`);
    assert.deepEqual(missingFa, [], `${ns}: keys missing in fa`);
  }
});

test("plural entries have 'one' and 'other' in both languages; placeholders match", () => {
  for (const [ns, { fa, en }] of Object.entries(flat)) {
    for (const key of Object.keys(fa)) {
      const a = fa[key], b = en[key];
      assert.equal(typeof a, typeof b, `${ns}.${key}: one language is plural, the other is not`);
      if (typeof a === "object") {
        for (const form of ["one", "other"]) {
          assert.equal(typeof a[form], "string", `${ns}.${key}: fa lacks "${form}"`);
          assert.equal(typeof b[form], "string", `${ns}.${key}: en lacks "${form}"`);
        }
      } else {
        assert.equal(typeof a, "string", `${ns}.${key}: not a string`);
      }
      assert.deepEqual(placeholders(a), placeholders(b), `${ns}.${key}: placeholders differ`);
    }
  }
});

test("English has no Persian text; Persian is translated", () => {
  for (const [ns, { fa, en }] of Object.entries(flat)) {
    for (const [key, value] of Object.entries(en)) {
      for (const s of strings(value)) assert.ok(!PERSIAN.test(s), `${ns}.${key}: Persian in English text: ${s}`);
    }
    for (const [key, value] of Object.entries(fa)) {
      for (const s of strings(value)) {
        const english = strings(en[key])[strings(value).indexOf(s)] ?? "";
        if (PERSIAN.test(s)) continue;
        assert.ok(SAME_IN_BOTH.test(s) || (s === english && SAME_IN_BOTH.test(english)), `${ns}.${key}: untranslated Persian text: ${s}`);
      }
    }
  }
});

test("Persian text uses Persian letters and punctuation", () => {
  for (const [ns, { fa }] of Object.entries(flat)) {
    for (const [key, value] of Object.entries(fa)) {
      for (const s of strings(value)) {
        assert.ok(!/[يك]/.test(s), `${ns}.${key}: Arabic ي/ك instead of Persian ی/ک: ${s}`);
        assert.ok(!/[؀-ۿ]\s*,|,\s*[؀-ۿ]/.test(s), `${ns}.${key}: Latin comma in Persian text: ${s}`);
        assert.ok(!/[؀-ۿ]\s*\?/.test(s), `${ns}.${key}: Latin question mark in Persian text: ${s}`);
        assert.ok(!/(^|[\s(«])(ها|های)(?=[\s.،؛)»]|$)/.test(s), `${ns}.${key}: detached plural suffix (use ZWNJ): ${s}`);
        assert.ok(!/(^|[\s(«])می\s/.test(s), `${ns}.${key}: "می" must join its verb with ZWNJ: ${s}`);
      }
    }
  }
});

// ---- Usage in the source ---------------------------------------------------------------------------------------

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "messages"].includes(entry.name)) continue;
      sourceFiles(rel, out);
    } else if (/\.(m?js|jsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = ["app", "components", "lib"].flatMap((d) => sourceFiles(d));
const source = files.map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
const nsNames = Object.keys(NAMESPACES).join("|");
const literalKey = new RegExp(`["'\`]((?:${nsNames})(?:\\.[A-Za-z0-9_-]+)+)["'\`]`, "g");
// Dynamic families: t(\`enums.status.\${s}\`) or t("errors." + code) mark a whole prefix as used.
const dynamicPrefix = new RegExp(`["'\`]((?:${nsNames})(?:\\.[A-Za-z0-9_-]+)*)\\.(?:\\$\\{|["'\`]\\s*\\+)`, "g");
const used = new Set([...source.matchAll(literalKey)].map((m) => m[1]));
const usedPrefixes = new Set([...source.matchAll(dynamicPrefix)].map((m) => `${m[1]}.`));

test("every key used in the code exists", () => {
  const leaves = new Set(Object.entries(flat).flatMap(([ns, { en }]) => Object.keys(en).map((k) => `${ns}.${k}`)));
  // A literal may also name a group of keys (passed around as a prefix), e.g. "enums.status".
  const groups = new Set([...leaves].flatMap((k) => k.split(".").slice(1).map((_, i, parts) => k.split(".").slice(0, i + 1).join("."))));
  const missing = [...used].filter((key) => !leaves.has(key) && !groups.has(key));
  assert.deepEqual(missing, [], "keys used in code but missing from the dictionaries");
});

test("no unused keys in finished areas", () => {
  for (const [ns, { en }] of Object.entries(flat)) {
    if (UNUSED_NOT_YET_ENFORCED.has(ns)) continue;
    const unused = Object.keys(en).map((k) => `${ns}.${k}`).filter((key) => !used.has(key) && ![...usedPrefixes].some((p) => key.startsWith(p)));
    assert.deepEqual(unused, [], `${ns}: unused keys`);
  }
});

test("t() formats plurals, params and digits per language", () => {
  const fa = createT("fa"), en = createT("en");
  assert.equal(en("common.count.tasks", { count: 1 }), "1 task");
  assert.equal(en("common.count.tasks", { count: 3 }), "3 tasks");
  assert.equal(fa("common.count.tasks", { count: 3 }), "۳ تسک");
  assert.equal(en("common.count.ofTotal", { count: 12345, total: 20000 }), "12,345 of 20,000");
  assert.equal(fa("common.actions.saveChanges"), "ذخیرهٔ تغییرات");
  assert.equal(en("common.nope.missing"), "common.nope.missing");
  assert.equal(en.maybe("common.nope.missing", null, "fallback"), "fallback");
});

export { UNUSED_NOT_YET_ENFORCED };
