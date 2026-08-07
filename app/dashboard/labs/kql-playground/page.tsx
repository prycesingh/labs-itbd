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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          KQL <span className="text-itbd-blue">Playground</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {queries.length} beginner-to-advanced Kusto queries for Sentinel and Log Analytics hunting, with
          explanations.
        </p>
      </div>
      <KqlPlaygroundBrowser queries={queries} />
    </div>
  );
}
