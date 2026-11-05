import { NextResponse } from "next/server";

import { handleError, loadEnrollmentFor, parseBody } from "@/lib/labPractice/api";
import { requireApiActor } from "@/lib/labPractice/identity";
import { saveComment } from "@/lib/labPractice/practice";
import { commentSchema } from "@/lib/validation/labPractice";

/** PUT { practiceDate, comment } — the trainee's single comment for the day. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const { enrollment, response: denied } = await loadEnrollmentFor(
    actor,
    (await context.params).enrollmentId,
    ["trainee"],
  );
  if (denied) return denied;
  const { data, response: bad } = await parseBody(request, commentSchema);
  if (bad) return bad;

  try {
    const session = await saveComment(enrollment, data.practiceDate, data.comment);
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    return handleError(err);
  }
}
