import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsArticles as articles } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { response } = await requireApiUser();

  if (response) return response;

  const { slug } = await params;

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (!article) {
    return jsonError("Article not found.", 404);
  }

  return NextResponse.json({ article });
}
