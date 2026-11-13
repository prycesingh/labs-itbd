import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeModules,
} from "@/DB/labPracticeSchema";
import { handleError, parseBody } from "@/lib/labPractice/api";
import { enrollTrainees } from "@/lib/labPractice/enroll";
import { requireApiTrainer } from "@/lib/labPractice/identity";
import { enrollSchema } from "@/lib/validation/labPractice";

/** GET ?moduleId= — the calling trainer's enrollments. */
export async function GET(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const moduleId = Number(new URL(request.url).searchParams.get("moduleId")) || null;

  const enrollments = await db
    .select({
      id: labPracticeEnrollments.id,
      isActive: labPracticeEnrollments.isActive,
      assignedAt: labPracticeEnrollments.assignedAt,
      moduleId: labPracticeModules.id,
      moduleTitle: labPracticeModules.title,
      traineeId: labPracticeEmployees.id,
      traineeName: labPracticeEmployees.fullName,
      traineeEmail: labPracticeEmployees.email,
    })
    .from(labPracticeEnrollments)
    .innerJoin(labPracticeModules, eq(labPracticeModules.id, labPracticeEnrollments.moduleId))
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeEnrollments.traineeId))
    .where(
      and(
        eq(labPracticeEnrollments.trainerId, actor.trainer.id),
        moduleId ? eq(labPracticeEnrollments.moduleId, moduleId) : undefined,
      ),
    )
    .orderBy(asc(labPracticeEmployees.fullName));

  return NextResponse.json({ enrollments });
}

/** POST — enroll trainees in a module under the calling trainer
 *  (rules in lib/labPractice/enroll.ts). */
export async function POST(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const { data, response: bad } = await parseBody(request, enrollSchema);
  if (bad) return bad;
  try {
    const result = await enrollTrainees(actor.trainer.id, data.moduleId, data.traineeIds);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
