import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/DB/drizzle";
import { labsGotchas as gotchas } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";

const patchGotchaSchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  symptom: z.string().trim().min(1).optional(),
  cause: z.string().trim().min(1).optional(),
  fix: z.string().trim().min(1).optional(),
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
  const parsed = patchGotchaSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid gotcha entry update.");
  }

  const [existing] = await db
    .select({ id: gotchas.id })
    .from(gotchas)
    .where(eq(gotchas.id, id))
    .limit(1);

  if (!existing) {
    return jsonError("Gotcha entry not found.", 404);
  }

  await db
    .update(gotchas)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(gotchas.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const { id } = await params;

  await db.delete(gotchas).where(eq(gotchas.id, id));

  return NextResponse.json({ success: true });
}
