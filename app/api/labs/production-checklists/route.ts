import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsProductionChecklistItems as productionChecklistItems } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const items = await db
    .select()
    .from(productionChecklistItems)
    .orderBy(
      asc(productionChecklistItems.checklistName),
      asc(productionChecklistItems.category),
      asc(productionChecklistItems.sortOrder),
    );

  return NextResponse.json({ items });
}
