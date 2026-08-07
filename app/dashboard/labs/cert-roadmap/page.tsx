import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsCertRoadmapEntries as certRoadmapEntries } from "@/DB/labsSchema";
import { CertRoadmapBrowser } from "@/components/labs/cert-roadmap-browser";
import { requireUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";

export default async function LabsCertRoadmapPage() {
  await requireUser();

  const rows = await db
    .select()
    .from(certRoadmapEntries)
    .orderBy(asc(certRoadmapEntries.sortOrder), asc(certRoadmapEntries.certCode));

  const certs = rows.map((c) => ({
    ...c,
    skills: parseJsonColumn<string[]>(c.skills),
    relatedSimulatorKeys: parseJsonColumn<string[]>(c.relatedSimulatorKeys),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Certification <span className="text-itbd-blue">Roadmap</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {certs.length} Microsoft certifications across fundamentals, associate, and expert tracks, with study time,
          exam format, and related skills.
        </p>
      </div>
      <CertRoadmapBrowser certs={certs} />
    </div>
  );
}
