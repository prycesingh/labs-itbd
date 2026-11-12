import { and, asc, eq, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeEmployees } from "@/DB/labPracticeSchema";
import { jsonError, requireApiActor } from "@/lib/labPractice/identity";

/** GET ?q= — search active employees (trainers enrolling trainees).
 *  Returns at most 20 matches. */
export async function GET(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!actor.trainer) return jsonError("Not allowed.", 403);

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ employees: [] });
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  const employees = await db
    .select({
      id: labPracticeEmployees.id,
      empId: labPracticeEmployees.empId,
      fullName: labPracticeEmployees.fullName,
      email: labPracticeEmployees.email,
    })
    .from(labPracticeEmployees)
    .where(
      and(
        eq(labPracticeEmployees.isActive, true),
        or(
          like(labPracticeEmployees.fullName, pattern),
          like(labPracticeEmployees.email, pattern),
          like(labPracticeEmployees.empId, pattern),
        ),
      ),
    )
    .orderBy(asc(labPracticeEmployees.fullName))
    .limit(20);

  return NextResponse.json({ employees });
}
