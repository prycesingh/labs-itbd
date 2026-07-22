import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsArticles as articles } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      category: articles.category,
      sourcePage: articles.sourcePage,
      summary: articles.summary,
      sortOrder: articles.sortOrder,
    })
    .from(articles)
    .orderBy(asc(articles.category), asc(articles.sortOrder));

  return NextResponse.json({ articles: rows });
}
