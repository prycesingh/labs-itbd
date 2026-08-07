import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { SeedContentButton } from "@/components/labs/admin/seed-content-button";
import { requireRole } from "@/lib/labs/auth";

export default async function LabsAdminSeedPage() {
  await requireRole(["contentAdmin"]);

  return (
    <main className="flex h-full w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Content <span className="text-itbd-blue">Import</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          One-time import of reference content ported from the source material — glossary, quizzes, services
          catalog, cloud comparison, gotchas, certification roadmap, production checklists, KQL playground,
          troubleshooting flowcharts, and articles. Safe to re-run — existing rows are skipped by natural key
          (or, for checklists and flowcharts, by checklist/flow name; for articles, by slug).
        </p>
      </div>
      <AdminMotionCard className="max-w-md p-6">
        <div className="relative z-10">
          <h2 className="text-lg font-bold text-white">Reference Content</h2>
          <p className="mt-1 text-sm text-white/60">
            140 glossary terms, 6 certs, 90 quiz questions, 107 services catalog entries, 75 cloud comparison
            rows, 57 gotchas, 26 cert roadmap entries, 156 production checklist items, 25 KQL playground queries,
            95 troubleshooting flowchart steps across 9 flows, and 7 long-form articles.
          </p>
          <div className="mt-4">
            <SeedContentButton />
          </div>
        </div>
      </AdminMotionCard>
    </main>
  );
}
