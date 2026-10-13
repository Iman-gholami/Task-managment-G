import { requireUser } from "@/lib/server/auth";
import { err } from "@/lib/server/access";
import { deleteShiftReview, listShiftReviews, saveShiftReview } from "@/lib/server/shift-reviews";

const failure = (e) => err(e?.status || 400, e?.message || "Unable to update Shift Log review.");

export async function GET(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const month = new URL(request.url).searchParams.get("month") || "";
  try {
    return Response.json({ month, reviews: listShiftReviews(month, user) });
  } catch (e) {
    return failure(e);
  }
}

export async function PUT(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json({ review: saveShiftReview(user, body) });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request) {
  const [user, denied] = await requireUser();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json(deleteShiftReview(user, body));
  } catch (e) {
    return failure(e);
  }
}
