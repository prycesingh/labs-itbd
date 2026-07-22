import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsCertRoadmapEntries as certRoadmapEntries } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchCertRoadmapEntrySchema = z.object({
  certCode: z.string().trim().min(1).max(20).optional(),
  certName: z.string().trim().min(1).max(160).optional(),
  level: z.string().trim().min(1).max(40).optional(),
  track: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().min(1).optional(),
  studyTime: z.string().trim().max(80).nullable().optional(),
  examFormat: z.string().trim().max(120).nullable().optional(),
  passingScore: z.string().trim().max(40).nullable().optional(),
  pricing: z.string().trim().max(80).nullable().optional(),
  relatedSims: z.string().trim().max(200).nullable().optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  tips: z.string().trim().nullable().optional(),
  relatedSimulatorKeys: z.array(z.string().trim().min(1)).optional(),
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
  const parsed = patchCertRoadmapEntrySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid cert roadmap entry update.");
  }

  const [existing] = await db
    .select({ id: certRoadmapEntries.id })
    .from(certRoadmapEntries)
    .where(eq(certRoadmapEntries.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Cert roadmap entry not found.", 404);
  }

  await db
    .update(certRoadmapEntries)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(certRoadmapEntries.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(certRoadmapEntries).where(eq(certRoadmapEntries.id, id));

  return NextResponse.json({ success: true });
}
