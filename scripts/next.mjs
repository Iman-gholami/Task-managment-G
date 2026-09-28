// Runs the Next.js CLI with Node's "SQLite is experimental" warning silenced.
// node:sqlite works fine; the warning is only noise in server logs.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const flag = "--disable-warning=ExperimentalWarning";
const env = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, flag].filter(Boolean).join(" "), NEXT_TELEMETRY_DISABLED: "1" };
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));
