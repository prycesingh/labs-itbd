"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";

import DefaultButton from "@/components/app_componentes/customButtons";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
        <label className="text-xs font-medium text-white/60" htmlFor="eval-score">
          Evaluator score (0 - 10)
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
      <div className="flex min-w-45 flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-white/60" htmlFor="eval-notes">
          Notes (optional)
        </label>
        <Input
          id="eval-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional reviewer notes..."
        />
      </div>
      <DefaultButton onClick={save} loading={saving}>
        Save score
      </DefaultButton>
    </div>
  );
}

export function StandardResponseToggle({ modelAnswer }: { modelAnswer: string | null }) {
  const [open, setOpen] = useState(false);

  if (!modelAnswer) {
    return (
      <p className="text-sm text-white/50 italic">
        No standard response recorded for this scenario.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/70 transition hover:border-itbd-blue hover:text-itbd-blue"
      >
        {open ? "Hide standard response" : "View standard response"}
      </button>
      {open && (
        <div className="rounded-xl border border-itbd-blue/30 bg-itbd-blue/5 p-4">
          <p className="mb-2 text-sm font-medium text-itbd-blue">
            Standard / Model Response
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{modelAnswer}</p>
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
        <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-300">
          AI-generated content detected (-10%)
        </span>
      )}
      {copyPenalty > 0 && (
        <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-300">
          Copy penalty: &minus;{copyPenalty.toFixed(1)} marks
        </span>
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DefaultButton onClick={() => setOpen(true)} className="gap-2">
        <BarChart3 className="h-4 w-4" />
        View Candidate Stats
      </DefaultButton>

      <DialogContent className="itbd-glow-border max-h-[85vh] max-w-3xl overflow-hidden border-white/10 bg-black/90 text-left backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Candidate Performance Analytics
          </DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Historical stats for {candidateName} ({candidateEmail})
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-6 overflow-y-auto pr-2 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <div>
              <h4 className="text-base font-semibold text-white">Grade Distribution</h4>
              <p className="text-xs text-white/50">
                Weighted grades across all completed sessions.
              </p>
            </div>
            <div className="space-y-3">
              {Object.entries(gradeDistribution).length === 0 ? (
                <p className="text-sm text-white/50 italic">
                  No completed session grades yet.
                </p>
              ) : (
                Object.entries(gradeDistribution).map(([grade, count]) => (
                  <div
                    key={grade}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3"
                  >
                    <span className="font-medium text-white">Grade {grade}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <div>
              <h4 className="text-base font-semibold text-white">Scenario Performance</h4>
              <p className="text-xs text-white/50">
                Average weighted score contribution per scenario.
              </p>
            </div>
            <div className="space-y-3">
              {scenarioPerformance.length === 0 ? (
                <p className="text-sm text-white/50 italic">No scenarios evaluated yet.</p>
              ) : (
                scenarioPerformance.map((item) => (
                  <div
                    key={item.title}
                    className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-50 truncate text-sm font-medium text-white">
                        {item.title}
                      </p>
                      <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-1.5 py-0 text-[10px] font-semibold text-itbd-blue capitalize">
                        {item.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">
                      {item.attempts} attempts &middot; avg{" "}
                      {(item.weightedTotal / item.attempts).toFixed(2)} / {item.maxScore}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-white/10 pt-4">
          <DefaultButton onClick={() => setOpen(false)}>Close</DefaultButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
