import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsArticles as articles } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertArticleSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const rows = await db
    .select()
    .from(articles)
    .orderBy(asc(articles.category), asc(articles.sortOrder));

  return NextResponse.json({ articles: rows });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertArticleSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid article details.");
  }

  const article = {
    id: randomUUID(),
    slug: parsed.data.slug,
    title: parsed.data.title,
    category: parsed.data.category,
    sourcePage: parsed.data.sourcePage,
    summary: parsed.data.summary || null,
    bodyMarkdown: parsed.data.bodyMarkdown,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(articles).values(article);

  return NextResponse.json({ article }, { status: 201 });
}
