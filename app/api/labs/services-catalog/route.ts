import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsServicesCatalog as servicesCatalog } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const entries = await db
    .select()
    .from(servicesCatalog)
    .orderBy(asc(servicesCatalog.sortOrder), asc(servicesCatalog.name));

  return NextResponse.json({ entries });
}
