import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { GlossaryTermForm } from "@/components/labs/admin/glossary-term-form";
import { GlossaryTermRow } from "@/components/labs/admin/glossary-term-row";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { requireRole } from "@/lib/labs/auth";

export default async function LabsAdminGlossaryPage() {
  await requireRole(["contentAdmin"]);

  const terms = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term));

  return (
    <main className="flex h-full w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Glossary — Admin</h1>
      </header>
      <Separator className="my-2" />
      <div className="mt-5 grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add term</CardTitle>
            <CardDescription>New terms appear immediately in the learner glossary.</CardDescription>
          </CardHeader>
          <CardContent>
            <GlossaryTermForm />
          </CardContent>
        </Card>
        <Card className="flex max-h-[78vh] min-h-0 flex-col lg:h-full">
          <CardHeader>
            <CardTitle>All terms</CardTitle>
            <CardDescription>{terms.length} terms</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {terms.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No terms yet.</p>
            ) : (
              <ScrollArea className="h-full">
                <div className="px-6 pb-6">
                  {terms.map((term) => (
                    <GlossaryTermRow key={term.id} term={term} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
