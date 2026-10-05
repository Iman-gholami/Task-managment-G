import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { canManageMember } from "@/lib/roles";
import { getUser, today } from "@/lib/server/repo";
import { jalaliMonthKey } from "@/lib/jalali";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Validates the member and month of an evaluation. Returns [target, null] or [null, Response]. */
function check(user, userId, month) {
  const target = getUser(String(userId ?? ""));
  if (!target) return [null, err(404, "این فرد پیدا نشد.")];
  if (!canManageMember(user, target)) return [null, err(403, "شما نمی‌توانید این فرد را ارزیابی کنید.")];
  if (!MONTH.test(month ?? "")) return [null, err(400, "ماه ارزیابی نامعتبر است.")];
  if (month > jalaliMonthKey(today())) return [null, err(400, "ماه‌های آینده را نمی‌توان ارزیابی کرد.")];
  return [target, null];
}

/** PUT { userId, month: "1405-07", score: 1–5, comment } — saves the signed-in manager's evaluation for that month. */
export async function PUT(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const [target, no] = check(user, body.userId, body.month);
  if (no) return no;
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) return err(400, "نمره باید بین ۱ تا ۵ باشد.");
  const comment = String(body.comment ?? "").trim();
  if (comment.length > 1000) return err(400, "نظر حداکثر ۱۰۰۰ حرف می‌تواند باشد.");
  db.prepare(
    `INSERT INTO evaluations (user_id, month, evaluator_id, score, comment) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, month, evaluator_id) DO UPDATE SET score = excluded.score, comment = excluded.comment, updated_at = datetime('now')`
  ).run(target.id, body.month, user.id, score, comment);
  return Response.json({ evaluation: { userId: target.id, month: body.month, by: user.id, byName: user.name, score, comment } });
}

/** DELETE ?userId&month — removes the signed-in manager's own evaluation. */
export async function DELETE(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const [target, no] = check(user, q.userId, q.month);
  if (no) return no;
  db.prepare("DELETE FROM evaluations WHERE user_id = ? AND month = ? AND evaluator_id = ?").run(target.id, q.month, user.id);
  return Response.json({ ok: true });
}
