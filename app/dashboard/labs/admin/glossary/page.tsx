import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { GlossaryTermForm } from "@/components/labs/admin/glossary-term-form";
import { GlossaryTermRow } from "@/components/labs/admin/glossary-term-row";
import { ScrollArea } from "@/components/ui/scroll-area";
import { requireRole } from "@/lib/labs/auth";

export default async function LabsAdminGlossaryPage() {
  await requireRole(["contentAdmin"]);

  const terms = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term));

  return (
    <main className="flex h-full w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Glossary <span className="text-itbd-blue">Admin</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Add and remove glossary terms. Changes appear immediately in the learner glossary.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <AdminMotionCard className="h-fit p-6">
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-white">Add term</h2>
            <p className="mt-1 text-sm text-white/60">
              New terms appear immediately in the learner glossary.
            </p>
            <div className="mt-4">
              <GlossaryTermForm />
            </div>
          </div>
        </AdminMotionCard>
        <AdminMotionCard className="flex max-h-[78vh] min-h-0 flex-col p-6 lg:h-full" delay={0.05}>
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <h2 className="text-lg font-bold text-white">All terms</h2>
            <p className="mt-1 text-sm text-white/60">{terms.length} terms</p>
            <div className="mt-4 min-h-0 flex-1 overflow-hidden">
              {terms.length === 0 ? (
                <p className="text-sm text-white/50">No terms yet.</p>
              ) : (
                <ScrollArea className="h-full">
                  <div className="pb-2">
                    {terms.map((term) => (
                      <GlossaryTermRow key={term.id} term={term} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </AdminMotionCard>
      </div>
    </main>
  );
}
