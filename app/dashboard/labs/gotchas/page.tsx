import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsGotchas as gotchas } from "@/DB/labsSchema";
import { GotchasBrowser } from "@/components/labs/gotchas-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsGotchasPage() {
  await requireUser();

  const gotchaEntries = await db
    .select()
    .from(gotchas)
    .orderBy(asc(gotchas.sortOrder), asc(gotchas.title));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Common Gotchas</h1>
        <p className="text-muted-foreground">
          {gotchaEntries.length} real-world symptom → cause → fix write-ups across Azure, ADDS, M365, identity, and
          more.
        </p>
      </div>
      <GotchasBrowser gotchas={gotchaEntries} />
    </div>
  );
}
