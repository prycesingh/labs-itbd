import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labPracticeModules } from "@/DB/labPracticeSchema";
import { handleError, parseBody } from "@/lib/labPractice/api";
import { requireApiTrainer } from "@/lib/labPractice/identity";
import { moduleSchema } from "@/lib/validation/labPractice";

/** GET — all modules (trainers share curriculum). */
export async function GET() {
  const { response } = await requireApiTrainer();
  if (response) return response;
  const modules = await db.select().from(labPracticeModules).orderBy(asc(labPracticeModules.title));
  return NextResponse.json({ modules });
}

/** POST — create a module. */
export async function POST(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;
  const { data, response: bad } = await parseBody(request, moduleSchema);
  if (bad) return bad;

  try {
    const [res] = await db.insert(labPracticeModules).values({
      title: data.title,
      info: data.info ?? null,
      progressionMode: data.progressionMode,
      createdBy: actor.trainer.id,
    });
    return NextResponse.json({ id: res.insertId }, { status: 201 });
  } catch (err) {
    return handleError(err, "A module with that title already exists.");
  }
}
