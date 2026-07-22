import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsQuizCerts as quizCerts } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertQuizCertSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const certs = await db.select().from(quizCerts).orderBy(asc(quizCerts.sortOrder));
  return NextResponse.json({ certs });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertQuizCertSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid quiz cert details.");
  }

  const cert = {
    id: randomUUID(),
    code: parsed.data.code,
    name: parsed.data.name,
    active: parsed.data.active ?? true,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(quizCerts).values(cert);

  return NextResponse.json({ cert }, { status: 201 });
}
