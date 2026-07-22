import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { GlossaryBrowser } from "@/components/labs/glossary-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsGlossaryPage() {
  await requireUser();

  const terms = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Glossary</h1>
        <p className="text-muted-foreground">
          {terms.length} terms across cloud, identity, security, networking, and Microsoft 365.
        </p>
      </div>
      <GlossaryBrowser terms={terms} />
    </div>
  );
}
