import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsCertRoadmapEntries as certRoadmapEntries } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { parseJsonColumn } from "@/lib/labs/jsonColumn";
import { upsertCertRoadmapEntrySchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

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

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertCertRoadmapEntrySchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid cert roadmap entry details.");
  }

  const cert = {
    id: randomUUID(),
    certCode: parsed.data.certCode,
    certName: parsed.data.certName,
    level: parsed.data.level,
    track: parsed.data.track,
    description: parsed.data.description,
    studyTime: parsed.data.studyTime || null,
    examFormat: parsed.data.examFormat || null,
    passingScore: parsed.data.passingScore || null,
    pricing: parsed.data.pricing || null,
    relatedSims: parsed.data.relatedSims || null,
    skills: parsed.data.skills ?? [],
    tips: parsed.data.tips || null,
    relatedSimulatorKeys: parsed.data.relatedSimulatorKeys ?? [],
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(certRoadmapEntries).values(cert);

  return NextResponse.json({ cert }, { status: 201 });
}
