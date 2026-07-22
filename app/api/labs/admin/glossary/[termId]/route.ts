import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchGlossaryTermSchema = z.object({
  term: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  definition: z.string().trim().min(1).optional(),
  example: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ termId: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { termId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchGlossaryTermSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid glossary term update.");
  }

  const [existing] = await db
    .select({ id: glossaryTerms.id })
    .from(glossaryTerms)
    .where(eq(glossaryTerms.id, termId))
    .limit(1);

  if (!existing) {
    return jsonError("Glossary term not found.", 404);
  }

  await db
    .update(glossaryTerms)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(glossaryTerms.id, termId));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ termId: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { termId } = await params;

  await db.delete(glossaryTerms).where(eq(glossaryTerms.id, termId));

  return NextResponse.json({ success: true });
}
