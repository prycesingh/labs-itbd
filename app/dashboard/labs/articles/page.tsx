import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsArticles as articles } from "@/DB/labsSchema";
import { ArticlesBrowser } from "@/components/labs/articles-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsArticlesPage() {
  await requireUser();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Articles</h1>
        <p className="text-muted-foreground">
          {rows.length} long-form reference articles covering fundamentals, end-to-end projects, API
          references, postmortems, and networking.
        </p>
      </div>
      <ArticlesBrowser articles={rows} />
    </div>
  );
}
