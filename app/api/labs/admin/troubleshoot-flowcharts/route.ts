import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import { labsTroubleshootFlowchartSteps as troubleshootFlowchartSteps } from "@/DB/labsSchema";
import { jsonError, requireApiUser } from "@/lib/labs/auth";
import { upsertTroubleshootFlowchartStepSchema } from "@/lib/validation/labs";

export async function GET() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const steps = await db
    .select()
    .from(troubleshootFlowchartSteps)
    .orderBy(asc(troubleshootFlowchartSteps.flowName), asc(troubleshootFlowchartSteps.stepIndex));
  return NextResponse.json({ steps });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = upsertTroubleshootFlowchartStepSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid troubleshoot flowchart step details.");
  }

  const step = {
    id: randomUUID(),
    flowName: parsed.data.flowName,
    stepIndex: parsed.data.stepIndex,
    stepType: parsed.data.stepType,
    title: parsed.data.title,
    description: parsed.data.description,
  };

  await db.insert(troubleshootFlowchartSteps).values(step);

  return NextResponse.json({ step }, { status: 201 });
}
