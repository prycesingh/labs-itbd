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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Common <span className="text-itbd-blue">Gotchas</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {gotchaEntries.length} real-world symptom → cause → fix write-ups across Azure, ADDS, M365, identity, and
          more.
        </p>
      </div>
      <GotchasBrowser gotchas={gotchaEntries} />
    </div>
  );
}
