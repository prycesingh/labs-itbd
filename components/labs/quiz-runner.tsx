"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function QuizRunner({ certId }: { certId: string }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

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
      <Card>
        <CardHeader>
          <CardTitle>Ready when you are</CardTitle>
        </CardHeader>
        <CardContent>
          <DefaultButton onClick={start} loading={loading}>
            Start quiz
          </DefaultButton>
        </CardContent>
      </Card>
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
      <Card>
        <CardHeader>
          <CardTitle>Quiz complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-5xl font-bold text-primary">{summary.scorePercent}%</div>
          <p className="text-muted-foreground">
            {summary.correctCount} / {summary.totalQuestions} correct. {verdict}
          </p>
          <DefaultButton onClick={start} loading={loading}>
            Take again
          </DefaultButton>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) return null;

  return (
    <Card>
      <CardHeader>
        <Progress value={((currentIndex + 1) / questions.length) * 100} />
        <p className="pt-2 text-xs uppercase text-muted-foreground">
          Question {currentIndex + 1} / {questions.length}
          {isMultiSelect ? " — select all that apply" : ""}
        </p>
        <CardTitle className="text-base font-semibold">{currentQuestion.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
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
                  "w-full rounded-md border px-4 py-2 text-left text-sm transition-colors",
                  isSelected && !showResult && "border-primary bg-primary/10",
                  showResult && isCorrectOption && "border-primary bg-primary/15 font-medium",
                  showResult && isSelected && !isCorrectOption && "border-destructive bg-destructive/10",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
        {checkResult ? (
          <div className="rounded-md border-l-4 border-primary bg-muted p-3 text-sm">
            <span className="font-semibold">Explanation: </span>
            {checkResult.explanation}
          </div>
        ) : null}
        <div className="flex gap-2">
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
      </CardContent>
    </Card>
  );
}
