import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { GlossaryBrowser } from "@/components/labs/glossary-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsGlossaryPage() {
  await requireUser();

  const terms = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          <span className="text-itbd-blue">Glossary</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {terms.length} terms across cloud, identity, security, networking, and Microsoft 365.
        </p>
      </div>
      <GlossaryBrowser terms={terms} />
    </div>
  );
}
