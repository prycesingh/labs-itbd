import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsCertRoadmapEntries as certRoadmapEntries } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const rows = await db
    .select()
    .from(certRoadmapEntries)
    .orderBy(asc(certRoadmapEntries.sortOrder), asc(certRoadmapEntries.certCode));

  const certs = rows.map((c) => ({
    ...c,
    skills: parseJsonColumn<string[]>(c.skills),
    relatedSimulatorKeys: parseJsonColumn<string[]>(c.relatedSimulatorKeys),
  }));

  return NextResponse.json({ certs });
}
