import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  labPracticeStepCompletionFiles,
  labPracticeStepCompletions,
} from "@/DB/labPracticeSchema";
import { parseId } from "@/lib/labPractice/api";
import {
  enrollmentAccessFor,
  getEnrollment,
  jsonError,
  requireApiActor,
} from "@/lib/labPractice/identity";
import { openReadStream } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — stream a step-completion photo. Unlike the generic /api/uploads route
 * (login-only), this checks the viewer may see the enrollment the photo
 * belongs to: the trainee, their owning trainer, or an admin. Unauthorised
 * viewers get 404 so file ids can't be probed.
 */
export async function GET(_req: Request, context: { params: Promise<{ fileId: string }> }) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const fileId = parseId((await context.params).fileId);
  if (!fileId) return jsonError("Not found.", 404);

  const [row] = await db
    .select({
      filePath: labPracticeStepCompletionFiles.filePath,
      mimeType: labPracticeStepCompletionFiles.mimeType,
      enrollmentId: labPracticeStepCompletions.enrollmentId,
    })
    .from(labPracticeStepCompletionFiles)
    .innerJoin(
      labPracticeStepCompletions,
      eq(labPracticeStepCompletions.id, labPracticeStepCompletionFiles.stepCompletionId),
    )
    .where(eq(labPracticeStepCompletionFiles.id, fileId))
    .limit(1);
  if (!row) return jsonError("Not found.", 404);

  const enrollment = await getEnrollment(row.enrollmentId);
  if (!enrollment || !enrollmentAccessFor(actor, enrollment)) return jsonError("Not found.", 404);

  try {
    const { stream, stats } = await openReadStream(row.filePath);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(stats.size),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError("Not found.", 404);
  }
}
