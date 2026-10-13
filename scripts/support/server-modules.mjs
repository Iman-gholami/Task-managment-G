// Lets `node --test` load server modules (lib/server/*): run with
//   node --conditions=react-server --import ./scripts/support/server-modules.mjs --test …
// `react-server` makes the "server-only" marker resolve to its empty module, as it does inside Next.js.
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
