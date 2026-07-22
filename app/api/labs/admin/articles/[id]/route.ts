import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsArticles as articles } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchArticleSchema = z.object({
  slug: z.string().trim().min(1).max(160).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  sourcePage: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  bodyMarkdown: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchArticleSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid article update.");
  }

  const [existing] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Article not found.", 404);
  }

  await db
    .update(articles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(articles.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(articles).where(eq(articles.id, id));

  return NextResponse.json({ success: true });
}
