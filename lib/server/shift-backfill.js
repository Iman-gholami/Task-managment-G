import "server-only";
import { db } from "@/lib/server/db";
import { canManageShift, isShiftEligible } from "@/lib/roles";
import { getUser, today } from "@/lib/server/repo";
import { isIsoDate } from "@/lib/shifts";

const bad = (status, message) => { throw Object.assign(new Error(message), { status }); };
const isPast = (date) => isIsoDate(date) && date < today();

export function isBackfillAllowed(userId, date) {
  if (!isPast(date)) return false;
  const grant = db.prepare(
    "SELECT enabled FROM shift_log_backfill_grants WHERE user_id = ? AND date = ?"
  ).get(userId, date);
  if (!grant?.enabled) return false;
  const shift = db.prepare("SELECT 1 FROM shift_schedules WHERE user_id = ? AND date = ?").get(userId, date);
  const log = db.prepare("SELECT completed_at FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  return !!shift && !log?.completed_at;
}

export function backfillDays(userId, { days = 120 } = {}) {
  const limit = new Date(Date.parse(today() + "T00:00:00Z") - (Math.max(1, Math.min(days, 365)) * 864e5))
    .toISOString().slice(0, 10);
  return db.prepare(`
    SELECT s.date, s.shift_type AS shiftType, l.completed_at AS completedAt,
      g.enabled AS granted, g.granted_by AS grantedBy, g.granted_at AS grantedAt,
      g.updated_by AS updatedBy, g.updated_at AS updatedAt,
      CASE WHEN l.id IS NULL THEN 0 ELSE 1 END AS hasLog
    FROM shift_schedules s
    LEFT JOIN shift_logs l ON l.user_id = s.user_id AND l.date = s.date
    LEFT JOIN shift_log_backfill_grants g ON g.user_id = s.user_id AND g.date = s.date
    WHERE s.user_id = ? AND s.date < ? AND s.date >= ?
    ORDER BY s.date DESC
  `).all(userId, today(), limit).map((r) => ({
    ...r, granted: !!r.granted, hasLog: !!r.hasLog, completed: !!r.completedAt,
  }));
}

/** A batch is all-or-nothing. Each grant or revocation is individually audited. */
export function setBackfillDays(actor, userId, dates, enabled, reason = "") {
  const owner = getUser(userId);
  if (!owner || !isShiftEligible(owner) || !canManageShift(actor, owner))
    bad(403, "You are not authorized to manage this analyst's shifts.");
  if (!Array.isArray(dates) || dates.length < 1 || dates.length > 31 ||
    dates.some((d) => !isPast(d)) || new Set(dates).size !== dates.length)
    bad(400, "Select 1–31 distinct past shift dates.");
  if (typeof enabled !== "boolean") bad(400, "Choose whether to allow backfill.");
  if (typeof reason !== "string" || reason.length > 500) bad(400, "Reason is too long.");

  db.exec("BEGIN IMMEDIATE");
  try {
    const shifts = db.prepare("SELECT 1 FROM shift_schedules WHERE user_id = ? AND date = ?");
    const complete = db.prepare("SELECT completed_at FROM shift_logs WHERE user_id = ? AND date = ?");
    const upsert = db.prepare(`
      INSERT INTO shift_log_backfill_grants(user_id, date, enabled, granted_by, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET enabled = excluded.enabled,
        updated_by = excluded.updated_by, updated_at = datetime('now'),
        granted_by = CASE WHEN excluded.enabled = 1 THEN excluded.granted_by ELSE granted_by END,
        granted_at = CASE WHEN excluded.enabled = 1 THEN datetime('now') ELSE granted_at END
    `);
    const event = db.prepare(
      "INSERT INTO shift_log_backfill_events (user_id, date, actor_id, action, reason) VALUES (?, ?, ?, ?, ?)"
    );
    for (const date of dates) {
      if (!shifts.get(owner.id, date)) bad(409, `No work shift was scheduled on ${date}.`);
      if (complete.get(owner.id, date)?.completed_at) bad(409, `The log for ${date} is already submitted.`);
      upsert.run(owner.id, date, enabled ? 1 : 0, actor.id, actor.id);
      event.run(owner.id, date, actor.id, enabled ? "granted" : "revoked", reason.trim());
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  return { dates, enabled };
}

export function listEnabledBackfillDates(userId, from, to) {
  return db.prepare(`
    SELECT g.date, s.shift_type AS shiftType
    FROM shift_log_backfill_grants g
    JOIN shift_schedules s ON s.user_id = g.user_id AND s.date = g.date
    LEFT JOIN shift_logs l ON l.user_id = g.user_id AND l.date = g.date
    WHERE g.user_id = ? AND g.enabled = 1 AND g.date BETWEEN ? AND ?
      AND g.date < ? AND (l.completed_at IS NULL)
    ORDER BY g.date DESC
  `).all(userId, from, to, today());
}
