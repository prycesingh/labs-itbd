import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsCertRoadmapEntries as certRoadmapEntries } from "@/DB/labsSchema";
import { CertRoadmapBrowser } from "@/components/labs/cert-roadmap-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsCertRoadmapPage() {
  await requireUser();

  const certs = await db
    .select()
    .from(certRoadmapEntries)
    .orderBy(asc(certRoadmapEntries.sortOrder), asc(certRoadmapEntries.certCode));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Certification Roadmap</h1>
        <p className="text-muted-foreground">
          {certs.length} Microsoft certifications across fundamentals, associate, and expert tracks, with study time,
          exam format, and related skills.
        </p>
      </div>
      <CertRoadmapBrowser certs={certs} />
    </div>
  );
}
