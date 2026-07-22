import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsProductionChecklistItems as productionChecklistItems } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertProductionChecklistItemSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

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

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertProductionChecklistItemSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid production checklist item details.");
  }

  const item = {
    id: randomUUID(),
    checklistName: parsed.data.checklistName,
    category: parsed.data.category,
    item: parsed.data.item,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(productionChecklistItems).values(item);

  return NextResponse.json({ item }, { status: 201 });
}
