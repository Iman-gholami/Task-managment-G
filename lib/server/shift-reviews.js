import "server-only";

import { SCORE } from "@/lib/analytics/config";
import { jalaliMonthBounds, jalaliMonthKey } from "@/lib/analytics/calendar";
import { canManageMember, isManager } from "@/lib/roles";
import { db } from "@/lib/server/db";
import { getUser, today } from "@/lib/server/repo";
import { isShiftAnalyst } from "@/lib/server/stats";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function canReviewShiftLog(actor, target) {
  if (!actor || !target || !isManager(actor) || !isShiftAnalyst(target)) return false;
  if (actor.role === "security_manager") return true;
  return actor.role === "soc_manager" && canManageMember(actor, target);
}

function checkedMonth(month) {
  const bounds = jalaliMonthBounds(month);
  if (!bounds) fail(400, "Invalid Jalali month.");
  if (bounds.month > jalaliMonthKey(today())) fail(400, "Future months cannot be reviewed.");
  return bounds;
}

function targetFor(actor, userId) {
  if (!isManager(actor)) fail(403, "Only SOC Managers and Security Managers can review shift logs.");
  const target = getUser(String(userId || ""));
  if (!target || !canReviewShiftLog(actor, target)) fail(403, "You cannot review this analyst.");
  return target;
}

function hasChecklistLog(userId, bounds) {
  const logs = db.prepare("SELECT data FROM shift_logs WHERE user_id = ? AND date BETWEEN ? AND ?").all(userId, bounds.from, bounds.to);
  return logs.some((row) => {
    try {
      const items = JSON.parse(row.data);
      return Array.isArray(items) && items.length > 0;
    } catch {
      return false;
    }
  });
}

const publicRow = (row) => row && ({
  id: row.id,
  a: row.user_id,
  month: row.month,
  from: row.month_from,
  to: row.month_to,
  rating: row.rating,
  note: row.note,
  by: row.updated_by,
  byName: row.by_name ?? null,
  at: row.updated_at,
});

function readOne(userId, month) {
  return publicRow(db.prepare(`
    SELECT r.*, u.name AS by_name
    FROM shift_log_reviews r
    LEFT JOIN users u ON u.id = r.updated_by
    WHERE r.user_id = ? AND r.month = ?
  `).get(userId, month));
}

export function listShiftReviews(month, actor) {
  const bounds = checkedMonth(month);
  if (!isManager(actor)) fail(403, "Only SOC Managers and Security Managers can review shift logs.");
  const rows = db.prepare(`
    SELECT r.*, u.name AS by_name, target.role AS target_role, target.team AS target_team, target.id AS target_id
    FROM shift_log_reviews r
    JOIN users target ON target.id = r.user_id
    LEFT JOIN users u ON u.id = r.updated_by
    WHERE r.month = ?
    ORDER BY target.team, target.name
  `).all(bounds.month);
  return rows
    .filter((row) => canReviewShiftLog(actor, { id: row.target_id, role: row.target_role, team: row.target_team }))
    .map(publicRow);
}

function recordEvent({ reviewId, userId, month, action, before, after, actorId }) {
  db.prepare(`
    INSERT INTO shift_log_review_events
      (review_id, user_id, month, action, from_rating, to_rating, from_note, to_note, actor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reviewId ?? null, userId, month, action,
    before?.rating ?? null, after?.rating ?? null,
    before?.note ?? "", after?.note ?? "", actorId,
  );
}

export function saveShiftReview(actor, input) {
  const target = targetFor(actor, input.userId);
  const bounds = checkedMonth(input.month);
  const rating = String(input.rating || "");
  if (!(rating in SCORE.quality)) fail(400, "Invalid quality rating.");
  if (!hasChecklistLog(target.id, bounds)) fail(409, "This analyst has no Shift Log with checklist items in that month.");
  const note = String(input.note ?? "").trim().slice(0, 2000);
  const before = db.prepare("SELECT * FROM shift_log_reviews WHERE user_id = ? AND month = ?").get(target.id, bounds.month);

  if (before) {
    db.prepare(`
      UPDATE shift_log_reviews
      SET month_from = ?, month_to = ?, rating = ?, note = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(bounds.from, bounds.to, rating, note, actor.id, before.id);
    const after = db.prepare("SELECT * FROM shift_log_reviews WHERE id = ?").get(before.id);
    recordEvent({ reviewId: before.id, userId: target.id, month: bounds.month, action: "updated", before, after, actorId: actor.id });
  } else {
    const created = db.prepare(`
      INSERT INTO shift_log_reviews (user_id, month, month_from, month_to, rating, note, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(target.id, bounds.month, bounds.from, bounds.to, rating, note, actor.id, actor.id);
    const id = Number(created.lastInsertRowid);
    const after = db.prepare("SELECT * FROM shift_log_reviews WHERE id = ?").get(id);
    recordEvent({ reviewId: id, userId: target.id, month: bounds.month, action: "created", before: null, after, actorId: actor.id });
  }
  return readOne(target.id, bounds.month);
}

export function deleteShiftReview(actor, input) {
  const target = targetFor(actor, input.userId);
  const bounds = checkedMonth(input.month);
  const before = db.prepare("SELECT * FROM shift_log_reviews WHERE user_id = ? AND month = ?").get(target.id, bounds.month);
  if (!before) fail(404, "Shift Log review not found.");
  recordEvent({ reviewId: before.id, userId: target.id, month: bounds.month, action: "deleted", before, after: null, actorId: actor.id });
  db.prepare("DELETE FROM shift_log_reviews WHERE id = ?").run(before.id);
  return { ok: true };
}

export function reviewEvents(userId, month) {
  return db.prepare("SELECT * FROM shift_log_review_events WHERE user_id = ? AND month = ? ORDER BY id").all(userId, month);
}
