// Module hooks for Node unit tests that exercise server modules: resolve the app's "@/…" alias (jsconfig.json).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    const file = [base, `${base}.js`, `${base}.mjs`, path.join(base, "index.js")].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
