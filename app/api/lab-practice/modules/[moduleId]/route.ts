import { NextResponse } from "next/server";

import { labPracticeModules } from "@/DB/labPracticeSchema";
import { parseId } from "@/lib/labPractice/api";
import { loadModuleTree } from "@/lib/labPractice/curriculum";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";
import { moduleUpdateSchema } from "@/lib/validation/labPractice";

/** GET — full module tree (including inactive items, for the builder). */
export async function GET(_req: Request, context: { params: Promise<{ moduleId: string }> }) {
  const { response } = await requireApiTrainer();
  if (response) return response;
  const id = parseId((await context.params).moduleId);
  const tree = id ? await loadModuleTree(id) : null;
  if (!tree) return jsonError("Not found.", 404);
  return NextResponse.json({ module: tree });
}

/** PATCH — edit title/info/progression mode, or (de)activate.
 *  DELETE — remove a module that has no enrollments (with its labs/tasks/steps). */
export const { PATCH, DELETE } = itemRoutes({
  param: "moduleId",
  table: labPracticeModules,
  updateSchema: moduleUpdateSchema,
});
