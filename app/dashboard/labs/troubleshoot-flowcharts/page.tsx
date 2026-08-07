import { asc } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsTroubleshootFlowchartSteps as troubleshootFlowchartSteps } from "@/DB/labsSchema";
import { TroubleshootFlowchartsBrowser } from "@/components/labs/troubleshoot-flowcharts-browser";
import { requireUser } from "@/lib/labs/auth";

export default async function LabsTroubleshootFlowchartsPage() {
  await requireUser();

  const steps = await db
    .select()
    .from(troubleshootFlowchartSteps)
    .orderBy(asc(troubleshootFlowchartSteps.flowName), asc(troubleshootFlowchartSteps.stepIndex));

  const flowCount = new Set(steps.map((s) => s.flowName)).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Troubleshooting <span className="text-itbd-blue">Flowcharts</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {steps.length} steps across {flowCount} linear runbooks — login failures, mail delivery, VPN tunnels, AD
          replication, and more.
        </p>
      </div>
      <TroubleshootFlowchartsBrowser steps={steps} />
    </div>
  );
}
