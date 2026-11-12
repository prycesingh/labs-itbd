import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeEnrollments } from "@/DB/labPracticeSchema";
import { handleError, loadEnrollmentFor, parseBody } from "@/lib/labPractice/api";
import { requireApiActor } from "@/lib/labPractice/identity";
import { getEnrollmentView } from "@/lib/labPractice/practice";
import { serializeEnrollment } from "@/lib/labPractice/serialize";
import { setActiveSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ enrollmentId: string }> };

/** GET — full progress view (trainee, owning trainer, or admin). */
export async function GET(_req: Request, context: Ctx) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const { enrollment, response: denied } = await loadEnrollmentFor(
    actor,
    (await context.params).enrollmentId,
    ["trainee", "trainer", "admin"],
  );
  if (denied) return denied;

  try {
    const view = await getEnrollmentView(enrollment);
    return NextResponse.json(serializeEnrollment(enrollment, view));
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH { isActive } — unassign / re-assign (owning trainer, or
 *  guidedLabs.manageAll — viewAll alone is read-only). Unassigning keeps all
 *  history; the trainee just loses write access. */
export async function PATCH(request: Request, context: Ctx) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const { enrollment, response: denied } = await loadEnrollmentFor(
    actor,
    (await context.params).enrollmentId,
    ["trainer", "manager"],
  );
  if (denied) return denied;
  const { data, response: bad } = await parseBody(request, setActiveSchema);
  if (bad) return bad;

  await db
    .update(labPracticeEnrollments)
    .set({ isActive: data.isActive })
    .where(eq(labPracticeEnrollments.id, enrollment.id));
  return NextResponse.json({ ok: true });
}
