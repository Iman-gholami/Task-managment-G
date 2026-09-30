import "server-only";
import { db } from "@/lib/server/db";

export function listShiftAssignments(from, to) {
  return db.prepare(
    `SELECT user_id AS userId, date, shift
     FROM shift_assignments
     WHERE date BETWEEN ? AND ?
     ORDER BY date, shift, user_id`
  ).all(from, to).map((row) => ({ ...row }));
}

export function replaceShiftAssignments({ date, shift, userIds, by }) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM shift_assignments WHERE date = ? AND shift = ?").run(date, shift);
    const removeExisting = db.prepare("DELETE FROM shift_assignments WHERE date = ? AND user_id = ?");
    const insert = db.prepare(
      "INSERT INTO shift_assignments (user_id, date, shift, created_by) VALUES (?, ?, ?, ?)"
    );
    for (const userId of userIds) {
      removeExisting.run(date, userId);
      insert.run(userId, date, shift, by);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
