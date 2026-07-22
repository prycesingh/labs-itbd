import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsKqlPlaygroundQueries as kqlPlaygroundQueries } from "@/DB/labsSchema";
import { KqlPlaygroundBrowser } from "@/components/labs/kql-playground-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsKqlPlaygroundPage() {
  await requireUser();

  const queries = await db
    .select()
    .from(kqlPlaygroundQueries)
    .orderBy(asc(kqlPlaygroundQueries.sortOrder), asc(kqlPlaygroundQueries.title));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">KQL Playground</h1>
        <p className="text-muted-foreground">
          {queries.length} beginner-to-advanced Kusto queries for Sentinel and Log Analytics hunting, with
          explanations.
        </p>
      </div>
      <KqlPlaygroundBrowser queries={queries} />
    </div>
  );
}
