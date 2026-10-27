import "server-only";
import { db } from "@/lib/server/db";

const VERDICTS = new Set(["false_positive", "true_positive"]);

export function analyzedTicketSummary(userId, from, to = from) {
  const rows = db.prepare(
    `SELECT verdict, COUNT(*) AS count FROM l2_analyzed_tickets
     WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY verdict`
  ).all(userId, from, to);
  const falsePositive = rows.find((r) => r.verdict === "false_positive")?.count ?? 0;
  const truePositive = rows.find((r) => r.verdict === "true_positive")?.count ?? 0;
  return { total: falsePositive + truePositive, falsePositive, truePositive };
}

export function listAnalyzedTickets(userId, date) {
  return db.prepare(
    `SELECT id, ticket_number AS ticketNumber, verdict, created_at AS createdAt,
       updated_at AS updatedAt, corrected_by AS correctedBy
       FROM l2_analyzed_tickets WHERE user_id = ? AND date = ? ORDER BY id DESC`
  ).all(userId, date);
}

function checkLog(userId, date, { manager = false } = {}) {
  const user = db.prepare("SELECT team, active FROM users WHERE id = ?").get(userId);
  if (!user?.active || user.team !== "SOC · L2") throw Object.assign(new Error("Only SOC Layer 2 analysts can record analyzed tickets."), { status: 403 });
  const shift = db.prepare("SELECT 1 FROM shift_schedules WHERE user_id = ? AND date = ?").get(userId, date);
  const log = db.prepare("SELECT completed_at FROM shift_logs WHERE user_id = ? AND date = ?").get(userId, date);
  if (!shift || !log) throw Object.assign(new Error("A recorded shift log is required."), { status: 404 });
  if (!manager && log.completed_at) throw Object.assign(new Error("Submitted shift logs are locked. Ask a manager for a correction."), { status: 409 });
}

function validate(ticketNumber, verdict) {
  if (typeof ticketNumber !== "string") throw Object.assign(new Error("Enter a ticket number."), { status: 400 });
  const no = ticketNumber.trim();
  if (!no || no.length > 80 || /[\x00-\x1f\x7f]/.test(no))
    throw Object.assign(new Error("Ticket number must contain 1–80 characters and no line breaks."), { status: 400 });
  if (!VERDICTS.has(verdict)) throw Object.assign(new Error("Choose False Positive or True Positive."), { status: 400 });
  return no;
}

/**
 * Review records are not the same as created tickets.
 * Users may insert/edit/remove their own unsubmitted shift-day entries.
 * Managers may correct an existing recorded day without unlocking it.
 */
export function saveAnalyzedTicket(userId, date, { id, ticketNumber, verdict }, opts = {}) {
  checkLog(userId, date, opts);
  const no = validate(ticketNumber, verdict);
  const duplicate = db.prepare(
    "SELECT id FROM l2_analyzed_tickets WHERE user_id = ? AND date = ? AND ticket_number = ? COLLATE NOCASE"
  ).get(userId, date, no);
  if (duplicate && duplicate.id !== id) throw Object.assign(new Error("This ticket number is already registered in this shift."), { status: 409 });
  if (id !== undefined && id !== null) {
    if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid ticket record."), { status: 400 });
    const result = db.prepare(
      `UPDATE l2_analyzed_tickets SET ticket_number = ?, verdict = ?, corrected_by = ?,
       updated_at = datetime('now') WHERE id = ? AND user_id = ? AND date = ?`
    ).run(no, verdict, opts.manager ? opts.actorId : null, id, userId, date);
    if (result.changes !== 1) throw Object.assign(new Error("Ticket record not found."), { status: 404 });
  } else {
    db.prepare(
      `INSERT INTO l2_analyzed_tickets (user_id, date, ticket_number, verdict, corrected_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, date, no, verdict, opts.manager ? opts.actorId : null);
  }
  return { items: listAnalyzedTickets(userId, date), stats: analyzedTicketSummary(userId, date) };
}

export function removeAnalyzedTicket(userId, date, id, opts = {}) {
  checkLog(userId, date, opts);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error("Invalid ticket record."), { status: 400 });
  const result = db.prepare("DELETE FROM l2_analyzed_tickets WHERE id = ? AND user_id = ? AND date = ?").run(id, userId, date);
  if (result.changes !== 1) throw Object.assign(new Error("Ticket record not found."), { status: 404 });
  return { items: listAnalyzedTickets(userId, date), stats: analyzedTicketSummary(userId, date) };
}
