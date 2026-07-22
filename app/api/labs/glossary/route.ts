import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const terms = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term));

  return NextResponse.json({ terms });
}
