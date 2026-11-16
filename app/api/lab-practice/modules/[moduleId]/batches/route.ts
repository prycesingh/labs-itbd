import { NextResponse } from "next/server";

import { handleError, parseBody, parseId } from "@/lib/labPractice/api";
import { listBatchesUsingModule } from "@/lib/labPractice/batches";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";
import { createModuleBatch } from "@/lib/labPractice/schedules";
import { moduleBatchSchema } from "@/lib/validation/labPractice";

type Ctx = { params: Promise<{ moduleId: string }> };

/** GET — batches whose schedule uses this module (own; all with viewAll). */
export async function GET(_req: Request, context: Ctx) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const moduleId = parseId((await context.params).moduleId);
  if (!moduleId) return jsonError("Not found.", 404);
  const batches = await listBatchesUsingModule(moduleId, actor.canViewAll ? undefined : actor.trainer.id);
  return NextResponse.json({ batches });
}

/** POST { name } — "teach this module": a batch following a day schedule
 *  built from the module (reused if one already exists). */
export async function POST(request: Request, context: Ctx) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const moduleId = parseId((await context.params).moduleId);
  if (!moduleId) return jsonError("Not found.", 404);
  const { data, response: bad } = await parseBody(request, moduleBatchSchema);
  if (bad) return bad;
  try {
    return NextResponse.json(await createModuleBatch(actor.trainer.id, moduleId, data.name), { status: 201 });
  } catch (err) {
    return handleError(err, "A batch with that name already exists.");
  }
}
