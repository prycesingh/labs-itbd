import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsCloudComparisons as cloudComparisons } from "@/DB/labsSchema";
import { CloudComparisonBrowser } from "@/components/labs/cloud-comparison-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsCloudComparisonPage() {
  await requireUser();

  const comparisons = await db
    .select()
    .from(cloudComparisons)
    .orderBy(asc(cloudComparisons.sortOrder), asc(cloudComparisons.label));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cloud Service Comparison</h1>
        <p className="text-muted-foreground">
          {comparisons.length} side-by-side Azure, AWS, and GCP service equivalents across compute, storage,
          networking, identity, data, and security.
        </p>
      </div>
      <CloudComparisonBrowser comparisons={comparisons} />
    </div>
  );
}
