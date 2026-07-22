import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SeedContentButton } from "@/components/labs/admin/seed-content-button";
import { requireRole } from "@/lib/labs/auth";

export default async function LabsAdminSeedPage() {
  await requireRole(["contentAdmin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Content Import</h1>
        <p className="text-muted-foreground">
          One-time import of reference content ported from the source material — glossary, quizzes, services
          catalog, cloud comparison, gotchas, certification roadmap, production checklists, KQL playground,
          troubleshooting flowcharts, and articles. Safe to re-run — existing rows are skipped by natural key
          (or, for checklists and flowcharts, by checklist/flow name; for articles, by slug).
        </p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Reference Content</CardTitle>
          <CardDescription>
            140 glossary terms, 6 certs, 90 quiz questions, 107 services catalog entries, 75 cloud comparison
            rows, 57 gotchas, 26 cert roadmap entries, 156 production checklist items, 25 KQL playground queries,
            95 troubleshooting flowchart steps across 9 flows, and 7 long-form articles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeedContentButton />
        </CardContent>
      </Card>
    </div>
  );
}
