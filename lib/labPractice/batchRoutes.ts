import type { NextResponse } from "next/server";

import { parseId } from "@/lib/labPractice/api";
import { canManageBatch, getBatch, type Batch } from "@/lib/labPractice/batches";
import { jsonError, requireApiActor, type PracticeActor } from "@/lib/labPractice/identity";

type Loaded =
  | { batch: Batch; actor: PracticeActor; response: null }
  | { batch: null; actor: null; response: NextResponse };

/** Resolve `batchId` and check the caller may manage it (owner or manageAll). */
export async function loadManagedBatch(rawId: string): Promise<Loaded> {
  const { actor, response } = await requireApiActor();
  if (response) return { batch: null, actor: null, response };
  const id = parseId(rawId);
  const batch = id ? await getBatch(id) : null;
  if (!batch) return { batch: null, actor: null, response: jsonError("Batch not found.", 404) };
  if (!canManageBatch(actor, batch)) return { batch: null, actor: null, response: jsonError("Not allowed.", 403) };
  return { batch, actor, response: null };
}
