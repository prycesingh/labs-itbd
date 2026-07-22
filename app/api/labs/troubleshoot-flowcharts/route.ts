import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsTroubleshootFlowchartSteps as troubleshootFlowchartSteps } from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";

export async function GET() {
  const { response } = await requireApiUser();

  if (response) return response;

  const steps = await db
    .select()
    .from(troubleshootFlowchartSteps)
    .orderBy(asc(troubleshootFlowchartSteps.flowName), asc(troubleshootFlowchartSteps.stepIndex));

  return NextResponse.json({ steps });
}
