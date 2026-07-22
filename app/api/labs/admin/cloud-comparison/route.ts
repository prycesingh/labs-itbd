import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsCloudComparisons as cloudComparisons } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertCloudComparisonSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const comparisons = await db
    .select()
    .from(cloudComparisons)
    .orderBy(asc(cloudComparisons.sortOrder), asc(cloudComparisons.label));
  return NextResponse.json({ comparisons });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertCloudComparisonSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid cloud comparison entry details.");
  }

  const comparison = {
    id: randomUUID(),
    category: parsed.data.category,
    label: parsed.data.label,
    azureEquivalent: parsed.data.azureEquivalent || null,
    awsEquivalent: parsed.data.awsEquivalent || null,
    gcpEquivalent: parsed.data.gcpEquivalent || null,
    note: parsed.data.note || null,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(cloudComparisons).values(comparison);

  return NextResponse.json({ comparison }, { status: 201 });
}
