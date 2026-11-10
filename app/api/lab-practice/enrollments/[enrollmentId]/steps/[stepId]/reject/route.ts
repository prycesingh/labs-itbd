import { NextResponse } from "next/server";

import { handleError, loadEnrollmentFor, parseBody, parseId } from "@/lib/labPractice/api";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";
import { previewRejection, rejectStep } from "@/lib/labPractice/practice";
import { rejectSchema } from "@/lib/validation/labPractice";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ enrollmentId: string; stepId: string }> };

/** GET — later completed steps that would also be reset (confirm dialog). */
export async function GET(_req: Request, context: Ctx) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const params = await context.params;
  const { enrollment, response: denied } = await loadEnrollmentFor(actor, params.enrollmentId, [
    "trainer",
  ]);
  if (denied) return denied;
  const stepId = parseId(params.stepId);
  if (!stepId) return jsonError("Not found.", 404);

  try {
    return NextResponse.json({ alsoResetStepIds: await previewRejection(enrollment, stepId) });
  } catch (err) {
    return handleError(err);
  }
}

/** POST { reason } — owning trainer rejects a completion. */
export async function POST(request: Request, context: Ctx) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const params = await context.params;
  const { enrollment, response: denied } = await loadEnrollmentFor(actor, params.enrollmentId, [
    "trainer",
  ]);
  if (denied) return denied;
  const stepId = parseId(params.stepId);
  if (!stepId) return jsonError("Not found.", 404);
  const { data, response: bad } = await parseBody(request, rejectSchema);
  if (bad) return bad;

  try {
    return NextResponse.json(await rejectStep(actor.trainer, enrollment, stepId, data.reason));
  } catch (err) {
    return handleError(err);
  }
}
