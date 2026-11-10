import { NextResponse } from "next/server";

import { handleError, loadEnrollmentFor, parseId } from "@/lib/labPractice/api";
import { jsonError, requireApiActor } from "@/lib/labPractice/identity";
import { completeStep, unmarkStep } from "@/lib/labPractice/practice";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ enrollmentId: string; stepId: string }> };

/** POST (multipart: practiceDate, photos[]) — trainee marks a step complete. */
export async function POST(request: Request, context: Ctx) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const params = await context.params;
  const { enrollment, response: denied } = await loadEnrollmentFor(actor, params.enrollmentId, [
    "trainee",
  ]);
  if (denied) return denied;
  const stepId = parseId(params.stepId);
  if (!stepId) return jsonError("Not found.", 404);

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Expected multipart form data.");
  const practiceDate = String(form.get("practiceDate") ?? "");
  const photos = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  try {
    const result = await completeStep(enrollment, stepId, practiceDate, photos);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE — trainee un-marks a step (blocked if a later chained step is done). */
export async function DELETE(_req: Request, context: Ctx) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const params = await context.params;
  const { enrollment, response: denied } = await loadEnrollmentFor(actor, params.enrollmentId, [
    "trainee",
  ]);
  if (denied) return denied;
  const stepId = parseId(params.stepId);
  if (!stepId) return jsonError("Not found.", 404);

  try {
    await unmarkStep(enrollment, stepId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
