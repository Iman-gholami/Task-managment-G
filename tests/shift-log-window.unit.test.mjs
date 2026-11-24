import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { continuingNightDate } from "../lib/shift-log-window.js";

const at = (iso) => new Date(iso);

test("night log remains attached to its starting day from midnight up to (not including) 08:00 Tehran", () => {
  assert.equal(continuingNightDate(at("2026-11-24T20:29:59Z")), null, "23:59:59 Tehran");
  assert.equal(continuingNightDate(at("2026-11-24T20:30:00Z")), "2026-11-24", "00:00 Tehran");
  assert.equal(continuingNightDate(at("2026-11-25T04:29:59Z")), "2026-11-24", "07:59:59 Tehran");
  assert.equal(continuingNightDate(at("2026-11-25T04:30:00Z")), null, "08:00 Tehran");
  assert.equal(continuingNightDate(at("2026-11-25T17:30:00Z")), null, "21:00 Tehran");
  assert.equal(continuingNightDate(at("2026-12-31T21:00:00Z")), "2026-12-31", "year rollover");
});

process.env.ADMIN_EMAIL = "night-window-admin@local.invalid";
process.env.ADMIN_PASSWORD = "Night-Window-Test-2026!";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sentinel-night-window-"));
process.env.DATABASE_PATH = path.join(directory, "night-window.db");
test.after(() => {
  globalThis.__sentinelDb?.close();
  fs.rmSync(directory, { force: true, recursive: true });
});

const repo = await import("@/lib/server/repo");
const { hashPassword } = await import("@/lib/server/password");
const { activeShiftLogDate, isRegularShiftLogDate } = await import("@/lib/server/shift-log-window");
const manager = repo.listUsers().find((member) => member.role === "security_manager");
const person = (name) => repo.createMember({
  name, role: "analyst", team: "SOC · L1", email: `${name}@night-window.test`,
  passwordHash: hashPassword("Testing-2026!"),
});

test("night-shift analyst can finish yesterday's log until 08:00, without opening unrelated day shifts", () => {
  const night = person("overnight-analyst");
  const day = person("daytime-analyst");
  const previous = "2026-11-24";
  const current = "2026-11-25";
  const atMidnight = at("2026-11-24T20:30:00Z");
  const beforeEight = at("2026-11-25T04:29:59Z");
  const atEight = at("2026-11-25T04:30:00Z");

  repo.setShiftSchedule(night.id, previous, "night", manager.id);
  repo.setShiftSchedule(night.id, current, "morning", manager.id);
  repo.setShiftSchedule(day.id, previous, "morning", manager.id);

  assert.equal(isRegularShiftLogDate(night.id, previous, atMidnight), true);
  assert.equal(isRegularShiftLogDate(night.id, previous, beforeEight), true);
  assert.equal(isRegularShiftLogDate(night.id, previous, atEight), false);
  assert.equal(isRegularShiftLogDate(day.id, previous, beforeEight), false, "no grace for a day shift");
  assert.equal(isRegularShiftLogDate(night.id, current, beforeEight), true, "today remains separately addressable");
  assert.equal(isRegularShiftLogDate(night.id, "2026-11-26", beforeEight), false, "future shift cannot be edited");

  const log = repo.getShiftLog(night.id, previous);
  assert.equal(activeShiftLogDate(night.id, beforeEight), previous, "open the unfinished overnight log by default");
  repo.updateActivity(night.id, log.activities[0].n, { done: true }, log.activities[0].itemId, previous);
  assert.equal(repo.getShiftLog(night.id, previous).activities[0].done, true);
  assert.equal(repo.findShiftLog(night.id, current), null, "overnight edit never creates today's log");

  assert.equal(activeShiftLogDate(night.id, atEight), current, "08:00 closes the default overnight window");
  repo.setShiftCompleted(night.id, true, previous);
  assert.equal(activeShiftLogDate(night.id, beforeEight), current, "submitted log stays locked");
  assert.equal(activeShiftLogDate(day.id, beforeEight), current, "day-only employee stays on today");
});
