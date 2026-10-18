/** Server-enforced session limits, shared with the active-tab monitor. */
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_PING_MS = 60 * 1000;

export function isSessionExpired(session, now = Date.now()) {
  const expiresAt = Number(session?.expires_at);
  const lastActivityAt = Number(session?.last_activity_at);
  return !Number.isFinite(expiresAt) || expiresAt <= 0 ||
    !Number.isFinite(lastActivityAt) || lastActivityAt <= 0 ||
    now >= expiresAt || now >= lastActivityAt + SESSION_IDLE_MS;
}
