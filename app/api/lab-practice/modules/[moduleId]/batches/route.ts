import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeModules } from "@/DB/labPracticeSchema";
import { handleError, parseBody, parseId } from "@/lib/labPractice/api";
import { createBatch, listModuleBatches } from "@/lib/labPractice/batches";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";
import { batchSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ moduleId: string }> };

/** GET — the module's batches (own; every trainer's with guidedLabs.viewAll). */
export async function GET(_req: Request, context: Ctx) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const moduleId = parseId((await context.params).moduleId);
  if (!moduleId) return jsonError("Not found.", 404);
  const batches = await listModuleBatches(moduleId, actor.canViewAll ? undefined : actor.trainer.id);
  return NextResponse.json({ batches });
}

/** POST { name } — create a batch owned by the calling trainer. */
export async function POST(request: Request, context: Ctx) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const moduleId = parseId((await context.params).moduleId);
  if (!moduleId) return jsonError("Not found.", 404);
  const { data, response: bad } = await parseBody(request, batchSchema);
  if (bad) return bad;

  const [mod] = await db.select().from(labPracticeModules).where(eq(labPracticeModules.id, moduleId)).limit(1);
  if (!mod) return jsonError("Module not found.", 404);
  try {
    const id = await createBatch(actor.trainer.id, moduleId, data.name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return handleError(err, "A batch with that name already exists for this module.");
  }
}
