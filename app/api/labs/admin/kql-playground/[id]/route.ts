import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsKqlPlaygroundQueries as kqlPlaygroundQueries } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchKqlPlaygroundQuerySchema = z.object({
  level: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().nullable().optional(),
  kqlQuery: z.string().trim().min(1).optional(),
  explanation: z.string().trim().nullable().optional(),
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
  const parsed = patchKqlPlaygroundQuerySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid KQL playground query update.");
  }

  const [existing] = await db
    .select({ id: kqlPlaygroundQueries.id })
    .from(kqlPlaygroundQueries)
    .where(eq(kqlPlaygroundQueries.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("KQL playground query not found.", 404);
  }

  await db
    .update(kqlPlaygroundQueries)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(kqlPlaygroundQueries.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(kqlPlaygroundQueries).where(eq(kqlPlaygroundQueries.id, id));

  return NextResponse.json({ success: true });
}
