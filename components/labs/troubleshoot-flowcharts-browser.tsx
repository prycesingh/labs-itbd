"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  const reduce = useReducedMotion();

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
        className="border-white/10 bg-black/40 text-white placeholder:text-white/40 focus-visible:border-itbd-blue focus-visible:ring-itbd-blue/30"
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          No flows match. Try a different word or clear the filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((flow, i) => {
            const isOpen = expandedFlows[flow.flowName] ?? false;
            return (
              <motion.div
                key={flow.flowName}
                className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
                />
                <button
                  type="button"
                  onClick={() => toggleFlow(flow.flowName)}
                  className="relative z-10 flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="font-semibold text-white">{flow.flowName}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                      {flow.steps.length} steps
                    </span>
                    <span className={cn("text-white/60 transition-transform", isOpen && "rotate-90")}>▸</span>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="content"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="relative z-10 overflow-hidden"
                    >
                      <div className="space-y-2 border-t border-white/10 p-4">
                        {flow.steps.map((step, stepIndex) => (
                          <motion.div
                            key={step.id}
                            initial={reduce ? false : { opacity: 0, y: 14 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: {
                                duration: 0.45,
                                delay: reduce ? 0 : 0.25 + Math.min(stepIndex, 10) * 0.12,
                                ease: [0.22, 1, 0.36, 1],
                              },
                            }}
                            className={cn(
                              "rounded-md p-3 transition-shadow hover:shadow-lg hover:shadow-black/30",
                              STEP_TYPE_STYLES[step.stepType] ?? "border-l-4 bg-white/5",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-white/60">Step {step.stepIndex}</span>
                              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60 uppercase">
                                {STEP_TYPE_BADGE[step.stepType] ?? step.stepType}
                              </span>
                            </div>
                            <p className="mt-1 font-medium text-white">{step.title}</p>
                            <p
                              className="mt-1 text-sm text-white/60 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-white/80"
                              dangerouslySetInnerHTML={{ __html: step.description }}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
