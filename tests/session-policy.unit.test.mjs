import test from "node:test";
import assert from "node:assert/strict";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, isSessionExpired } from "../lib/session-policy.js";

test("session stays valid for over five idle hours and expires at eight hours", () => {
  const start = 1_700_000_000_000;
  const session = { expires_at: start + SESSION_ABSOLUTE_MS, last_activity_at: start };
  assert.equal(isSessionExpired(session, start + 5 * 60 * 60 * 1000), false);
  assert.equal(SESSION_IDLE_MS, 8 * 60 * 60 * 1000);
  assert.equal(isSessionExpired(session, start + SESSION_IDLE_MS - 1), false);
  assert.equal(isSessionExpired(session, start + SESSION_IDLE_MS), true);
});

test("recent activity never extends the 12-hour absolute deadline", () => {
  const start = 1_700_000_000_000;
  const expires = start + SESSION_ABSOLUTE_MS;
  const session = { expires_at: expires, last_activity_at: expires - 1 };
  assert.equal(isSessionExpired(session, expires - 1), false);
  assert.equal(isSessionExpired(session, expires), true);
});

test("missing or invalid activity timestamps never validate legacy sessions", () => {
  const now = 1_700_000_000_000;
  assert.equal(isSessionExpired({ expires_at: now + 100_000 }, now), true);
  assert.equal(isSessionExpired({ expires_at: now + 100_000, last_activity_at: null }, now), true);
  assert.equal(isSessionExpired({ expires_at: now + 100_000, last_activity_at: "invalid" }, now), true);
});
