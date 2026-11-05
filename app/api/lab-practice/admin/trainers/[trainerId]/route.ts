import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeTrainers } from "@/DB/labPracticeSchema";
import { parseBody, parseId } from "@/lib/labPractice/api";
import { jsonError, requireApiAdmin } from "@/lib/labPractice/identity";
import { setActiveSchema } from "@/lib/validation/labPractice";

/** PATCH — activate / deactivate a trainer. Deactivating keeps their
 *  enrollments and authored curriculum (FKs are restrict). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ trainerId: string }> },
) {
  const { response } = await requireApiAdmin();
  if (response) return response;

  const id = parseId((await context.params).trainerId);
  if (!id) return jsonError("Not found.", 404);
  const { data, response: bad } = await parseBody(request, setActiveSchema);
  if (bad) return bad;

  const [res] = await db
    .update(labPracticeTrainers)
    .set({ isActive: data.isActive })
    .where(eq(labPracticeTrainers.id, id));
  if (!res.affectedRows) return jsonError("Not found.", 404);
  return NextResponse.json({ ok: true });
}
