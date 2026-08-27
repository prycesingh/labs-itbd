"use client";

import DefaultButton from "@/components/app_componentes/customButtons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// Mirrors lib/interview/moduleCapabilities.ts — kept in sync manually since
// this is a client component (that file imports server-only DB code).
const CAPABILITY_KEYS = {
  DELIVERY_SCORING: "delivery_scoring",
  GROUNDED_GRADING: "grounded_grading",
  FOLLOW_UPS: "follow_ups",
  EVALUATION_DEPTH: "evaluation_depth",
  ATTEMPT_CADENCE: "attempt_cadence",
} as const;

type CapabilityKey = (typeof CAPABILITY_KEYS)[keyof typeof CAPABILITY_KEYS];
type CalibrationMode = "static" | "population-relative";
type EvaluationDepth = "full-rubric" | "content-only" | "delivery-only";
type AttemptCadence = "daily" | "weekly";

interface CapabilityState {
  enabled: boolean;
  config: Record<string, unknown>;
}

interface ModuleRow {
  id: string;
  name: string;
  capabilities: Partial<Record<CapabilityKey, CapabilityState>>;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

const BOOLEAN_CAPABILITIES: {
  key: CapabilityKey;
  label: string;
  description: string;
}[] = [
  {
    key: CAPABILITY_KEYS.DELIVERY_SCORING,
    label: "Delivery Scoring",
    description:
      "Score acoustic delivery (pace, pauses, filler words, pitch, energy) in addition to content.",
  },
  {
    key: CAPABILITY_KEYS.GROUNDED_GRADING,
    label: "Grounded Grading",
    description:
      "Grade against source-vetted answer keys where available, instead of only model-inferred expectations.",
  },
  {
    key: CAPABILITY_KEYS.FOLLOW_UPS,
    label: "Adaptive Follow-ups",
    description:
      "Ask a real-time follow-up question when an answer is shallow or incomplete, before advancing.",
  },
];

function defaultCapability(key: CapabilityKey): CapabilityState {
  if (key === CAPABILITY_KEYS.EVALUATION_DEPTH) {
    return { enabled: false, config: { depth: "content-only" } };
  }
  if (key === CAPABILITY_KEYS.ATTEMPT_CADENCE) {
    return { enabled: false, config: { cadence: "daily" } };
  }
  return { enabled: false, config: {} };
}

function ModuleCard({
  moduleRow,
  onSaved,
}: {
  moduleRow: ModuleRow;
  onSaved: (moduleId: string, key: CapabilityKey, value: CapabilityState) => void;
}) {
  const [local, setLocal] = useState<Record<CapabilityKey, CapabilityState>>(
    () => {
      const next = {} as Record<CapabilityKey, CapabilityState>;
      for (const key of Object.values(CAPABILITY_KEYS)) {
        next[key] = moduleRow.capabilities[key] ?? defaultCapability(key);
      }
      return next;
    },
  );
  const [dirty, setDirty] = useState<Set<CapabilityKey>>(new Set());
  const [savingKey, setSavingKey] = useState<CapabilityKey | null>(null);

  const updateLocal = useCallback(
    (key: CapabilityKey, value: Partial<CapabilityState>) => {
      setLocal((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...value },
      }));
      setDirty((prev) => new Set(prev).add(key));
    },
    [],
  );

  const save = useCallback(
    async (key: CapabilityKey) => {
      setSavingKey(key);
      try {
        const res = await fetch("/api/interview/admin/module-capabilities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId: moduleRow.id,
            capabilityKey: key,
            enabled: local[key].enabled,
            config: local[key].config,
          }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Failed to save");
        }
        toast.success(`Updated for ${moduleRow.name}`);
        setDirty((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        onSaved(moduleRow.id, key, local[key]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save setting";
        toast.error("Unable to save", { description: message });
      } finally {
        setSavingKey(null);
      }
    },
    [local, moduleRow.id, moduleRow.name, onSaved],
  );

  const evaluationDepth =
    (local[CAPABILITY_KEYS.EVALUATION_DEPTH].config as { depth?: EvaluationDepth })
      .depth ?? "content-only";
  const attemptCadence =
    (local[CAPABILITY_KEYS.ATTEMPT_CADENCE].config as { cadence?: AttemptCadence })
      .cadence ?? "daily";
  const calibrationMode =
    (
      local[CAPABILITY_KEYS.DELIVERY_SCORING].config as {
        calibrationMode?: CalibrationMode;
      }
    ).calibrationMode ?? "static";

  return (
    <Card className="border-cyan-500/20 bg-black/20">
      <CardHeader>
        <CardTitle>{moduleRow.name}</CardTitle>
        <CardDescription>
          Toggle what this module evaluates. Changes apply to the next
          session or answer processed — no deploy required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {BOOLEAN_CAPABILITIES.map(({ key, label, description }) => (
          <div key={key} className="space-y-3 border-b border-white/5 pb-4 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Switch
                  checked={local[key].enabled}
                  onCheckedChange={(checked) => {
                    updateLocal(key, { enabled: checked });
                  }}
                  aria-label={`Toggle ${label} for ${moduleRow.name}`}
                />
                {dirty.has(key) && (
                  <DefaultButton
                    onClick={() => save(key)}
                    loading={savingKey === key}
                    className="h-8 px-3 text-xs"
                  >
                    Save
                  </DefaultButton>
                )}
              </div>
            </div>

            {key === CAPABILITY_KEYS.DELIVERY_SCORING &&
              local[key].enabled && (
                <div className="ml-0 flex items-center gap-3 rounded-lg bg-white/5 p-3 sm:ml-4">
                  <label className="text-xs font-medium text-muted-foreground">
                    Calibration mode
                  </label>
                  <Select
                    value={calibrationMode}
                    onValueChange={(value) => {
                      updateLocal(CAPABILITY_KEYS.DELIVERY_SCORING, {
                        config: { calibrationMode: value as CalibrationMode },
                      });
                    }}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static bands</SelectItem>
                      <SelectItem value="population-relative">
                        Population-relative
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {dirty.has(CAPABILITY_KEYS.DELIVERY_SCORING) && (
                    <DefaultButton
                      onClick={() => save(CAPABILITY_KEYS.DELIVERY_SCORING)}
                      loading={savingKey === CAPABILITY_KEYS.DELIVERY_SCORING}
                      className="h-8 px-3 text-xs"
                    >
                      Save
                    </DefaultButton>
                  )}
                </div>
              )}
          </div>
        ))}

        <div className="grid gap-4 pt-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Evaluation depth
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={evaluationDepth}
                onValueChange={(value) => {
                  updateLocal(CAPABILITY_KEYS.EVALUATION_DEPTH, {
                    config: { depth: value as EvaluationDepth },
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-rubric">Full rubric</SelectItem>
                  <SelectItem value="content-only">Content-only</SelectItem>
                  <SelectItem value="delivery-only">Delivery-only</SelectItem>
                </SelectContent>
              </Select>
              {dirty.has(CAPABILITY_KEYS.EVALUATION_DEPTH) && (
                <DefaultButton
                  onClick={() => save(CAPABILITY_KEYS.EVALUATION_DEPTH)}
                  loading={savingKey === CAPABILITY_KEYS.EVALUATION_DEPTH}
                  className="h-8 shrink-0 px-3 text-xs"
                >
                  Save
                </DefaultButton>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Practice attempt cadence
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={attemptCadence}
                onValueChange={(value) => {
                  updateLocal(CAPABILITY_KEYS.ATTEMPT_CADENCE, {
                    config: { cadence: value as AttemptCadence },
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              {dirty.has(CAPABILITY_KEYS.ATTEMPT_CADENCE) && (
                <DefaultButton
                  onClick={() => save(CAPABILITY_KEYS.ATTEMPT_CADENCE)}
                  loading={savingKey === CAPABILITY_KEYS.ATTEMPT_CADENCE}
                  className="h-8 shrink-0 px-3 text-xs"
                >
                  Save
                </DefaultButton>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ModuleCapabilitiesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/interview/admin/module-capabilities");
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load modules");
      }
      setModules(Array.isArray(payload) ? payload : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load";
      toast.error("Unable to load module capabilities", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleSaved = useCallback(
    (moduleId: string, key: CapabilityKey, value: CapabilityState) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, capabilities: { ...m.capabilities, [key]: value } }
            : m,
        ),
      );
    },
    [],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <span className="itbd-glow-border relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/40">
            <SlidersHorizontal className="h-5 w-5 text-itbd-blue" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">Module Capabilities</h1>
            <p className="text-sm text-muted-foreground">
              Control what each interview module evaluates and how often
              candidates may practice — per module, no code change required.
            </p>
          </div>
        </div>
      </FadeIn>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : modules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No interview modules found.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {modules.map((moduleRow, index) => (
            <FadeIn key={moduleRow.id} delay={index * 0.06}>
              <ModuleCard moduleRow={moduleRow} onSaved={handleSaved} />
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
