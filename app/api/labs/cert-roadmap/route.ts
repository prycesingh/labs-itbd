import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsCertRoadmapEntries as certRoadmapEntries } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const certs = await db
    .select()
    .from(certRoadmapEntries)
    .orderBy(asc(certRoadmapEntries.sortOrder), asc(certRoadmapEntries.certCode));

  return NextResponse.json({ certs });
}
