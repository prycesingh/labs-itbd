import { NextResponse } from "next/server";

import { handleError, loadEnrollmentFor, parseBody, parseId } from "@/lib/labPractice/api";
import { setLabOverride } from "@/lib/labPractice/batches";
import { jsonError, requireApiActor } from "@/lib/labPractice/identity";
import { labOverrideSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ enrollmentId: string; labId: string }> };

/** PUT { visible: true | false | null } — per-trainee Show / Hide for one lab
 *  (null resets it to the batch / default). Owning trainer or manageAll. */
export async function PUT(request: Request, context: Ctx) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const params = await context.params;
  const { enrollment, response: denied } = await loadEnrollmentFor(actor, params.enrollmentId, [
    "trainer",
    "manager",
  ]);
  if (denied) return denied;
  const labId = parseId(params.labId);
  if (!labId) return jsonError("Not found.", 404);
  const { data, response: bad } = await parseBody(request, labOverrideSchema);
  if (bad) return bad;
  try {
    await setLabOverride(enrollment, labId, data.visible);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
