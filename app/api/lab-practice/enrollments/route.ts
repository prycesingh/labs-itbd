import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeModules,
} from "@/DB/labPracticeSchema";
import { parseBody } from "@/lib/labPractice/api";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";
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

/**
 * POST — enroll trainees in a module under the calling trainer.
 * - new pair                  -> inserted
 * - inactive enrollment       -> re-activated and moved to this trainer (history kept)
 * - active, same trainer      -> unchanged
 * - active, another trainer   -> reported as a conflict (never taken over)
 */
export async function POST(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const { data, response: bad } = await parseBody(request, enrollSchema);
  if (bad) return bad;

  const [mod] = await db
    .select()
    .from(labPracticeModules)
    .where(eq(labPracticeModules.id, data.moduleId))
    .limit(1);
  if (!mod || !mod.isActive) return jsonError("Module not found or inactive.", 404);

  const traineeIds = [...new Set(data.traineeIds)];
  const validTrainees = await db
    .select({ id: labPracticeEmployees.id })
    .from(labPracticeEmployees)
    .where(and(inArray(labPracticeEmployees.id, traineeIds), eq(labPracticeEmployees.isActive, true)));
  const validIds = new Set(validTrainees.map((t) => t.id));

  const existing = await db
    .select()
    .from(labPracticeEnrollments)
    .where(
      and(
        eq(labPracticeEnrollments.moduleId, mod.id),
        inArray(labPracticeEnrollments.traineeId, traineeIds),
      ),
    );
  const byTrainee = new Map(existing.map((e) => [e.traineeId, e]));

  const result = {
    enrolled: 0,
    reactivated: 0,
    unchanged: 0,
    conflicts: [] as number[],
    invalid: [] as number[],
  };

  for (const traineeId of traineeIds) {
    if (!validIds.has(traineeId)) {
      result.invalid.push(traineeId);
      continue;
    }
    const e = byTrainee.get(traineeId);
    if (!e) {
      await db.insert(labPracticeEnrollments).values({
        moduleId: mod.id,
        traineeId,
        trainerId: actor.trainer.id,
      });
      result.enrolled++;
    } else if (!e.isActive) {
      await db
        .update(labPracticeEnrollments)
        .set({ isActive: true, trainerId: actor.trainer.id })
        .where(eq(labPracticeEnrollments.id, e.id));
      result.reactivated++;
    } else if (e.trainerId === actor.trainer.id) {
      result.unchanged++;
    } else {
      result.conflicts.push(traineeId);
    }
  }

  return NextResponse.json(result, { status: 201 });
}
