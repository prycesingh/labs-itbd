import { NextResponse } from "next/server";

import { handleError, parseBody } from "@/lib/labPractice/api";
import { requireApiTrainer } from "@/lib/labPractice/identity";
import { markReviewed } from "@/lib/labPractice/review";
import { reviewSchema } from "@/lib/validation/labPractice";

/** POST { completionIds?, sessionIds? } — mark step submissions / daily
 *  comments as reviewed (non-blocking approval; reject has its own route). */
export async function POST(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const { data, response: bad } = await parseBody(request, reviewSchema);
  if (bad) return bad;
  try {
    return NextResponse.json(await markReviewed(actor, data.completionIds, data.sessionIds));
  } catch (err) {
    return handleError(err);
  }
}
