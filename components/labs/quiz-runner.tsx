"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import DefaultButton from "@/components/app_componentes/customButtons";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  question: string;
  options: string[];
  sortOrder: number;
};

type CheckResult = {
  isCorrect: boolean;
  correctIndexes: number[];
  explanation: string;
};

type Summary = {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
};

function ItbdCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function QuizRunner({ certId }: { certId: string }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();

  const currentQuestion = questions[currentIndex];
  const isMultiSelect = (checkResult?.correctIndexes.length ?? 0) > 1;

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/labs/quiz-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certId }),
      });
      if (!res.ok) {
        toast.error("Could not start this quiz.");
        return;
      }
      const data = await res.json();
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelected([]);
      setCheckResult(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleOption(idx: number) {
    if (checkResult) return;
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      return [...prev, idx];
    });
  }

  async function checkAnswer() {
    if (!attemptId || !currentQuestion || selected.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/labs/quiz-attempts/${attemptId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, selectedIndexes: selected }),
      });
      if (!res.ok) {
        toast.error("Could not submit that answer.");
        return;
      }
      setCheckResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function next() {
    if (currentIndex + 1 >= questions.length) {
      await finish();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelected([]);
    setCheckResult(null);
  }

  async function finish() {
    if (!attemptId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/labs/quiz-attempts/${attemptId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Could not finish the quiz.");
        return;
      }
      setSummary(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (!attemptId) {
    return (
      <ItbdCard>
        <h2 className="text-lg font-bold text-white">Ready when you are</h2>
        <div className="mt-4">
          <DefaultButton onClick={start} loading={loading}>
            Start quiz
          </DefaultButton>
        </div>
      </ItbdCard>
    );
  }

  if (summary) {
    const verdict =
      summary.scorePercent >= 80
        ? "Excellent — ready to book the real exam."
        : summary.scorePercent >= 60
          ? "Good — review weak areas and retake."
          : "Needs work — revisit the reference material and retake.";

    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <ItbdCard className="space-y-4">
          <h2 className="text-lg font-bold text-white">Quiz complete</h2>
          <motion.div
            className="text-5xl font-bold text-itbd-blue"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {summary.scorePercent}%
          </motion.div>
          <p className="text-white/60">
            {summary.correctCount} / {summary.totalQuestions} correct. {verdict}
          </p>
          <DefaultButton onClick={start} loading={loading}>
            Take again
          </DefaultButton>
        </ItbdCard>
      </motion.div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <ItbdCard>
      <Progress value={((currentIndex + 1) / questions.length) * 100} />
      <p className="pt-2 text-xs text-white/50 uppercase">
        Question {currentIndex + 1} / {questions.length}
        {isMultiSelect ? " — select all that apply" : ""}
      </p>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={reduce ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mt-2 text-base font-semibold text-white">{currentQuestion.question}</h2>
          <div className="mt-4 space-y-2">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selected.includes(idx);
              const isCorrectOption = checkResult?.correctIndexes.includes(idx);
              const showResult = Boolean(checkResult);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={showResult}
                  onClick={() => toggleOption(idx)}
                  className={cn(
                    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-white/80 transition-colors",
                    isSelected && !showResult && "border-itbd-blue bg-itbd-blue/10 text-white",
                    showResult && isCorrectOption && "border-itbd-green/60 bg-itbd-green/10 font-medium text-white",
                    showResult && isSelected && !isCorrectOption && "border-orange-400/60 bg-orange-500/10 text-white",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {checkResult ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 rounded-xl border-l-4 border-itbd-blue bg-itbd-blue/5 p-3 text-sm text-white/80"
            >
              <span className="font-semibold text-white">Explanation: </span>
              {checkResult.explanation}
            </motion.div>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 flex gap-2">
        {!checkResult ? (
          <DefaultButton onClick={checkAnswer} loading={loading} disabled={selected.length === 0}>
            Check answer
          </DefaultButton>
        ) : (
          <DefaultButton onClick={next} loading={loading}>
            {currentIndex + 1 >= questions.length ? "See results" : "Next question"}
          </DefaultButton>
        )}
      </div>
    </ItbdCard>
  );
}
