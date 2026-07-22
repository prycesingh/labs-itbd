import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsCloudComparisons as cloudComparisons } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const comparisons = await db
    .select()
    .from(cloudComparisons)
    .orderBy(asc(cloudComparisons.sortOrder), asc(cloudComparisons.label));

  return NextResponse.json({ comparisons });
}
