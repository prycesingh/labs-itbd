import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsGotchas as gotchas } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertGotchaSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const gotchaEntries = await db
    .select()
    .from(gotchas)
    .orderBy(asc(gotchas.sortOrder), asc(gotchas.title));
  return NextResponse.json({ gotchas: gotchaEntries });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertGotchaSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid gotcha entry details.");
  }

  const gotcha = {
    id: randomUUID(),
    category: parsed.data.category,
    title: parsed.data.title,
    symptom: parsed.data.symptom,
    cause: parsed.data.cause,
    fix: parsed.data.fix,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  await db.insert(gotchas).values(gotcha);

  return NextResponse.json({ gotcha }, { status: 201 });
}
