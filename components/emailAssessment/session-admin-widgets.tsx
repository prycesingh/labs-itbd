"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = "/api/emailAssessment";

export function EvaluatorScoreForm({
  sessionId,
  initialScore,
  initialNotes,
}: {
  sessionId: string;
  initialScore: number | null;
  initialNotes: string | null;
}) {
  const [score, setScore] = useState(initialScore?.toString() ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = parseInt(score, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      toast.error("Score must be a whole number between 0 and 10.");
      return;
    }
    setSaving(true);
    const response = await fetch(`${API_BASE}/admin/sessions/${sessionId}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: parsed, notes: notes.trim() || undefined }),
    });
    setSaving(false);
    if (!response.ok) {
      toast.error("Failed to save evaluator score.");
      return;
    }
    toast.success(`Evaluator score saved: ${parsed}/10`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="eval-score">
          Evaluator score (0 – 10)
        </label>
        <Input
          id="eval-score"
          type="number"
          min={0}
          max={10}
          step={1}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-28"
          placeholder="e.g. 7"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="eval-notes">
          Notes (optional)
        </label>
        <Input
          id="eval-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional reviewer notes..."
        />
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save score"}
      </Button>
    </div>
  );
}

export function StandardResponseToggle({ modelAnswer }: { modelAnswer: string | null }) {
  const [open, setOpen] = useState(false);

  if (!modelAnswer) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No standard response recorded for this scenario.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide standard response" : "View standard response"}
      </Button>
      {open && (
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/40 p-4 dark:border-indigo-700/40 dark:bg-indigo-950/30">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
            Standard / Model Response
          </p>
          <p className="whitespace-pre-wrap text-sm leading-7">{modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

export function AiDetectionBadge({
  detected,
  copyPenalty,
}: {
  detected: boolean;
  copyPenalty: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {detected && (
        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-600">
          ⚠ AI-generated content detected (-10%)
        </Badge>
      )}
      {copyPenalty > 0 && (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-600">
          📋 Copy penalty: −{copyPenalty.toFixed(1)} marks
        </Badge>
      )}
    </div>
  );
}

export function CandidateStatsButton({
  candidateName,
  candidateEmail,
  gradeDistribution,
  scenarioPerformance,
}: {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  gradeDistribution: Record<string, number>;
  scenarioPerformance: Array<{
    title: string;
    difficulty: string;
    attempts: number;
    weightedTotal: number;
    maxScore: number;
  }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        View Candidate Stats
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-3xl rounded-2xl border bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Candidate Performance Analytics</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Historical stats for {candidateName} ({candidateEmail})
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="grid gap-6 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
              {/* Grade Distribution */}
              <div className="rounded-2xl border bg-muted/10 p-5 space-y-4">
                <div>
                  <h4 className="font-semibold text-base">Grade Distribution</h4>
                  <p className="text-xs text-muted-foreground">
                    Weighted grades across all completed sessions.
                  </p>
                </div>
                <div className="space-y-3">
                  {Object.entries(gradeDistribution).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No completed session grades yet.
                    </p>
                  ) : (
                    Object.entries(gradeDistribution).map(([grade, count]) => (
                      <div
                        key={grade}
                        className="flex items-center justify-between rounded-xl border bg-card p-3"
                      >
                        <span className="font-medium">Grade {grade}</span>
                        <Badge className="px-2 py-0.5 bg-muted text-muted-foreground">{count}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Scenario Performance */}
              <div className="rounded-2xl border bg-muted/10 p-5 space-y-4">
                <div>
                  <h4 className="font-semibold text-base">Scenario Performance</h4>
                  <p className="text-xs text-muted-foreground">
                    Average weighted score contribution per scenario.
                  </p>
                </div>
                <div className="space-y-3">
                  {scenarioPerformance.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No scenarios evaluated yet.</p>
                  ) : (
                    scenarioPerformance.map((item) => (
                      <div key={item.title} className="rounded-xl border bg-card p-3 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm truncate max-w-[200px]">{item.title}</p>
                          <Badge className="text-[10px] px-1 py-0">{item.difficulty}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.attempts} attempts · avg{" "}
                          {(item.weightedTotal / item.attempts).toFixed(2)} / {item.maxScore}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end border-t pt-4">
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
