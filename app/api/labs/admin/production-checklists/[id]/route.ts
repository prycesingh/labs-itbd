import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsProductionChecklistItems as productionChecklistItems } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchProductionChecklistItemSchema = z.object({
  checklistName: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  item: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchProductionChecklistItemSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid production checklist item update.");
  }

  const [existing] = await db
    .select({ id: productionChecklistItems.id })
    .from(productionChecklistItems)
    .where(eq(productionChecklistItems.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Production checklist item not found.", 404);
  }

  await db
    .update(productionChecklistItems)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(productionChecklistItems.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(productionChecklistItems).where(eq(productionChecklistItems.id, id));

  return NextResponse.json({ success: true });
}
