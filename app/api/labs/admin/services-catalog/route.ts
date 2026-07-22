import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsServicesCatalog as servicesCatalog } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertServicesCatalogEntrySchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const entries = await db
    .select()
    .from(servicesCatalog)
    .orderBy(asc(servicesCatalog.sortOrder), asc(servicesCatalog.name));
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertServicesCatalogEntrySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid services catalog entry details.");
  }

  const entry = {
    id: randomUUID(),
    category: parsed.data.category,
    name: parsed.data.name,
    icon: parsed.data.icon || null,
    description: parsed.data.description,
    whenToUse: parsed.data.whenToUse || null,
    alternative: parsed.data.alternative || null,
    pricing: parsed.data.pricing || null,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(servicesCatalog).values(entry);

  return NextResponse.json({ entry }, { status: 201 });
}
