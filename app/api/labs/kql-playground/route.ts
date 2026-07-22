import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsKqlPlaygroundQueries as kqlPlaygroundQueries } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const queries = await db
    .select()
    .from(kqlPlaygroundQueries)
    .orderBy(asc(kqlPlaygroundQueries.sortOrder), asc(kqlPlaygroundQueries.title));

  return NextResponse.json({ queries });
}
