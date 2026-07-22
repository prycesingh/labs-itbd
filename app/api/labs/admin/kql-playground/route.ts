import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsKqlPlaygroundQueries as kqlPlaygroundQueries } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertKqlPlaygroundQuerySchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const queries = await db
    .select()
    .from(kqlPlaygroundQueries)
    .orderBy(asc(kqlPlaygroundQueries.sortOrder), asc(kqlPlaygroundQueries.title));
  return NextResponse.json({ queries });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertKqlPlaygroundQuerySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid KQL playground query details.");
  }

  const query = {
    id: randomUUID(),
    level: parsed.data.level,
    title: parsed.data.title,
    description: parsed.data.description || null,
    kqlQuery: parsed.data.kqlQuery,
    explanation: parsed.data.explanation || null,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(kqlPlaygroundQueries).values(query);

  return NextResponse.json({ query }, { status: 201 });
}
