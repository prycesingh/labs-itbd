import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsCloudComparisons as cloudComparisons } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchCloudComparisonSchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(160).optional(),
  azureEquivalent: z.string().trim().max(200).nullable().optional(),
  awsEquivalent: z.string().trim().max(200).nullable().optional(),
  gcpEquivalent: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().nullable().optional(),
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
  const parsed = patchCloudComparisonSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid cloud comparison entry update.");
  }

  const [existing] = await db
    .select({ id: cloudComparisons.id })
    .from(cloudComparisons)
    .where(eq(cloudComparisons.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Cloud comparison entry not found.", 404);
  }

  await db
    .update(cloudComparisons)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(cloudComparisons.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(cloudComparisons).where(eq(cloudComparisons.id, id));

  return NextResponse.json({ success: true });
}
