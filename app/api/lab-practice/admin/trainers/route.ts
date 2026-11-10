import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeEmployees, labPracticeTrainers } from "@/DB/labPracticeSchema";
import { handleError, parseBody } from "@/lib/labPractice/api";
import { jsonError, requireApiAdmin } from "@/lib/labPractice/identity";
import { registerTrainerSchema } from "@/lib/validation/labPractice";

/** GET — trainer registry with employee details. */
export async function GET() {
  const { response } = await requireApiAdmin();
  if (response) return response;

  const trainers = await db
    .select({
      id: labPracticeTrainers.id,
      isActive: labPracticeTrainers.isActive,
      registeredAt: labPracticeTrainers.registeredAt,
      employeeId: labPracticeEmployees.id,
      empId: labPracticeEmployees.empId,
      fullName: labPracticeEmployees.fullName,
      email: labPracticeEmployees.email,
      employeeActive: labPracticeEmployees.isActive,
    })
    .from(labPracticeTrainers)
    .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeTrainers.employeeId))
    .orderBy(asc(labPracticeEmployees.fullName));

  return NextResponse.json({ trainers });
}

/** POST — register an employee as a trainer (re-activates if previously removed). */
export async function POST(request: Request) {
  const { response } = await requireApiAdmin();
  if (response) return response;

  const { data, response: bad } = await parseBody(request, registerTrainerSchema);
  if (bad) return bad;

  const [employee] = await db
    .select()
    .from(labPracticeEmployees)
    .where(eq(labPracticeEmployees.id, data.employeeId))
    .limit(1);
  if (!employee || !employee.isActive) return jsonError("Employee not found.", 404);

  try {
    await db
      .insert(labPracticeTrainers)
      .values({ employeeId: employee.id })
      .onDuplicateKeyUpdate({ set: { isActive: true } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
