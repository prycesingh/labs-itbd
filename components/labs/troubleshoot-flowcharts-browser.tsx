"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TroubleshootFlowchartStep = {
  id: string;
  flowName: string;
  stepIndex: number;
  stepType: string;
  title: string;
  description: string;
};

const STEP_TYPE_STYLES: Record<string, string> = {
  question: "border-l-4 border-l-amber-400 bg-amber-500/5",
  action: "border-l-4 border-l-itbd-blue bg-itbd-blue/5",
  success: "border-l-4 border-l-emerald-500 bg-emerald-500/5",
  failure: "border-l-4 border-l-red-500 bg-red-500/5",
};

const STEP_TYPE_BADGE: Record<string, string> = {
  question: "Question",
  action: "Action",
  success: "Success",
  failure: "Failure",
};

export function TroubleshootFlowchartsBrowser({ steps }: { steps: TroubleshootFlowchartStep[] }) {
  const [query, setQuery] = useState("");
  const [expandedFlows, setExpandedFlows] = useState<Record<string, boolean>>({});

  const flows = useMemo(() => {
    const byFlow = new Map<string, TroubleshootFlowchartStep[]>();
    for (const step of steps) {
      if (!byFlow.has(step.flowName)) byFlow.set(step.flowName, []);
      byFlow.get(step.flowName)!.push(step);
    }
    return Array.from(byFlow.entries())
      .map(([flowName, flowSteps]) => ({
        flowName,
        steps: [...flowSteps].sort((a, b) => a.stepIndex - b.stepIndex),
      }))
      .sort((a, b) => a.flowName.localeCompare(b.flowName));
  }, [steps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flows;
    return flows
      .map((flow) => ({
        flowName: flow.flowName,
        steps: flow.steps.filter((s) => `${s.title} ${s.description}`.toLowerCase().includes(q)),
      }))
      .filter((flow) => flow.flowName.toLowerCase().includes(q) || flow.steps.length > 0)
      .map((flow) => (flow.steps.length > 0 ? flow : flows.find((f) => f.flowName === flow.flowName)!));
  }, [flows, query]);

  const toggleFlow = (flowName: string) => {
    setExpandedFlows((prev) => ({ ...prev, [flowName]: !prev[flowName] }));
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search flows — e.g. VPN, replication, RDP, AKS pods..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No flows match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((flow) => {
            const isOpen = expandedFlows[flow.flowName] ?? false;
            return (
              <div key={flow.flowName} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleFlow(flow.flowName)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="font-semibold">{flow.flowName}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{flow.steps.length} steps</Badge>
                    <span className={cn("transition-transform", isOpen && "rotate-90")}>▸</span>
                  </span>
                </button>
                {isOpen ? (
                  <div className="space-y-2 border-t p-4">
                    {flow.steps.map((step) => (
                      <div
                        key={step.id}
                        className={cn("rounded-md p-3", STEP_TYPE_STYLES[step.stepType] ?? "border-l-4 bg-muted/40")}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Step {step.stepIndex}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {STEP_TYPE_BADGE[step.stepType] ?? step.stepType}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium">{step.title}</p>
                        <p
                          className="mt-1 text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1"
                          dangerouslySetInnerHTML={{ __html: step.description }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
