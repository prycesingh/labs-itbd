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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Production Checklists</h1>
        <p className="text-muted-foreground">
          {items.length} go-live checklist items across Azure VM, AKS, App Service, SQL Database, Storage, Function
          App, and Sentinel + SOC.
        </p>
      </div>
      <ProductionChecklistsBrowser items={items} />
    </div>
  );
}
