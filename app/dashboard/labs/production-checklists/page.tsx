import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsProductionChecklistItems as productionChecklistItems } from "@/DB/labsSchema";
import { ProductionChecklistsBrowser } from "@/components/labs/production-checklists-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsProductionChecklistsPage() {
  await requireUser();

  const items = await db
    .select()
    .from(productionChecklistItems)
    .orderBy(
      asc(productionChecklistItems.checklistName),
      asc(productionChecklistItems.category),
      asc(productionChecklistItems.sortOrder),
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Production <span className="text-itbd-blue">Checklists</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {items.length} go-live checklist items across Azure VM, AKS, App Service, SQL Database, Storage, Function
          App, and Sentinel + SOC.
        </p>
      </div>
      <ProductionChecklistsBrowser items={items} />
    </div>
  );
}
