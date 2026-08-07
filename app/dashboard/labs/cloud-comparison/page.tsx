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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          <span className="text-itbd-blue">Cloud Service Comparison</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {comparisons.length} side-by-side Azure, AWS, and GCP service equivalents across compute, storage,
          networking, identity, data, and security.
        </p>
      </div>
      <CloudComparisonBrowser comparisons={comparisons} />
    </div>
  );
}
