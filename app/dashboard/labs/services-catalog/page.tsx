import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsServicesCatalog as servicesCatalog } from "@/DB/labsSchema";
import { ServicesCatalogBrowser } from "@/components/labs/services-catalog-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsServicesCatalogPage() {
  await requireUser();

  const entries = await db
    .select()
    .from(servicesCatalog)
    .orderBy(asc(servicesCatalog.sortOrder), asc(servicesCatalog.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Services <span className="text-itbd-blue">Catalog</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {entries.length} Azure and Microsoft 365 services with when-to-use guidance, alternatives, and pricing tier.
        </p>
      </div>
      <ServicesCatalogBrowser entries={entries} />
    </div>
  );
}
