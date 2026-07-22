import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsGlossaryTerms as glossaryTerms } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertGlossaryTermSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const terms = await db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term));
  return NextResponse.json({ terms });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertGlossaryTermSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid glossary term details.");
  }

  const term = {
    id: randomUUID(),
    term: parsed.data.term,
    category: parsed.data.category,
    definition: parsed.data.definition,
    example: parsed.data.example || null,
  };

  await db.insert(glossaryTerms).values(term);

  return NextResponse.json({ term }, { status: 201 });
}
