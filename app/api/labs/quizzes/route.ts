import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsQuizCerts as quizCerts } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const certs = await db
    .select()
    .from(quizCerts)
    .where(eq(quizCerts.active, true))
    .orderBy(asc(quizCerts.sortOrder));

  return NextResponse.json({ certs });
}
