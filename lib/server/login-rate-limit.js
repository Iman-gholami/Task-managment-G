import "server-only";

const WINDOW_MS = 60_000;
const EMAIL_MAX_FAILURES = 5;
const IP_MAX_FAILURES = 30;
const MAX_KEYS = 5_000;

const g = globalThis;
const attempts = g.__sentinelLoginAttempts ?? (g.__sentinelLoginAttempts = new Map());
let operations = 0;

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase().slice(0, 320);
}

export function loginClientAddress(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 128);
  }
  return (request.headers.get("x-real-ip") || "direct").trim().slice(0, 128);
}

function getEntry(key, now) {
  const entry = attempts.get(key);
  if (!entry) return null;
  if (entry.resetAt <= now) {
    attempts.delete(key);
    return null;
  }
  return entry;
}

function prune(now) {
  operations += 1;
  if (operations % 50 !== 0 && attempts.size < MAX_KEYS) return;
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
  while (attempts.size > MAX_KEYS) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

function retryAfter(entry, now) {
  return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
}

export function checkLoginRateLimit(email, address) {
  const now = Date.now();
  prune(now);
  const emailEntry = getEntry(`email:${normalizeEmail(email)}`, now);
  const ipEntry = getEntry(`ip:${address || "direct"}`, now);
  const waits = [];
  if (emailEntry?.count >= EMAIL_MAX_FAILURES) waits.push(retryAfter(emailEntry, now));
  if (ipEntry?.count >= IP_MAX_FAILURES) waits.push(retryAfter(ipEntry, now));
  return waits.length ? { limited: true, retryAfter: Math.max(...waits) } : { limited: false, retryAfter: 0 };
}

function record(key, now) {
  const current = getEntry(key, now);
  if (current) {
    current.count += 1;
    return;
  }
  attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
}

export function recordLoginFailure(email, address) {
  const now = Date.now();
  record(`email:${normalizeEmail(email)}`, now);
  record(`ip:${address || "direct"}`, now);
  prune(now);
}

export function recordLoginSuccess(email) {
  attempts.delete(`email:${normalizeEmail(email)}`);
}
