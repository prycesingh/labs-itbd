import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsGotchas as gotchas } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const gotchaEntries = await db
    .select()
    .from(gotchas)
    .orderBy(asc(gotchas.sortOrder), asc(gotchas.title));

  return NextResponse.json({ gotchas: gotchaEntries });
}
