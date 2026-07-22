import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsServicesCatalog as servicesCatalog } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchServicesCatalogEntrySchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  icon: z.string().trim().max(16).nullable().optional(),
  description: z.string().trim().min(1).optional(),
  whenToUse: z.string().trim().nullable().optional(),
  alternative: z.string().trim().max(160).nullable().optional(),
  pricing: z.string().trim().nullable().optional(),
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
  const parsed = patchServicesCatalogEntrySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid services catalog entry update.");
  }

  const [existing] = await db
    .select({ id: servicesCatalog.id })
    .from(servicesCatalog)
    .where(eq(servicesCatalog.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Services catalog entry not found.", 404);
  }

  await db
    .update(servicesCatalog)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(servicesCatalog.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(servicesCatalog).where(eq(servicesCatalog.id, id));

  return NextResponse.json({ success: true });
}
