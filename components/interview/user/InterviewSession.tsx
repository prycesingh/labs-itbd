"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AudioRecorder } from "./AudioRecorder";
import { QuestionPlayer } from "./QuestionPlayer";

interface Question {
  id: string;
  promptText: string;
  promptAudioPath: string | null;
}

interface StandardResponse {
  id: string;
  responseText: string;
}

interface InterviewSessionProps {
  sessionId: string;
  moduleId: string;
  totalQuestions: number;
}

export function InterviewSession({
  sessionId,
  moduleId,
  totalQuestions,
}: InterviewSessionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [standardResponses, setStandardResponses] = useState<
    StandardResponse[]
  >([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);

  const pickUniqueRandomQuestions = (
    sourceQuestions: Question[],
    count: number,
  ): Question[] => {
    const uniqueById = Array.from(
      new Map(
        sourceQuestions.map((question) => [question.id, question]),
      ).values(),
    );

    const shuffled = [...uniqueById];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[i],
      ];
    }

    return shuffled.slice(0, Math.min(count, shuffled.length));
  };

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(
          `/api/interview/modules/${moduleId}/questions`,
        );
        if (response.ok) {
          const data = await response.json();
          const selectedQuestions = pickUniqueRandomQuestions(
            data,
            totalQuestions,
          );
          setQuestions(selectedQuestions);
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        toast.error("Failed to load questions");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [moduleId, totalQuestions]);

  // Fetch standard responses for current question
  useEffect(() => {
    const fetchResponses = async () => {
      if (questions.length === 0) return;
      try {
        const response = await fetch(
          `/api/interview/questions/${questions[currentQuestionIndex].id}/standard-responses`,
        );
        if (response.ok) {
          const data = await response.json();
          setStandardResponses(data);
        }
      } catch (error) {
        console.error("Failed to fetch standard responses:", error);
      }
    };

    fetchResponses();
  }, [currentQuestionIndex, questions]);

  useEffect(() => {
    const loadSubmittedAnswers = async () => {
      if (questions.length === 0) return;

      try {
        const response = await fetch(
          `/api/interview/sessions?sessionId=${sessionId}`,
        );

        if (!response.ok) return;

        const payload = await response.json();
        const submittedQuestionIds = new Set<string>(
          (payload?.answers ?? []).map((answer: { questionId: string }) =>
            String(answer.questionId),
          ),
        );

        const availableQuestionIds = new Set(
          questions.map((question) => question.id),
        );

        const lockedQuestionIds = new Set<string>();
        submittedQuestionIds.forEach((questionId) => {
          if (availableQuestionIds.has(questionId)) {
            lockedQuestionIds.add(questionId);
          }
        });

        setAnsweredQuestions(lockedQuestionIds);
      } catch (error) {
        console.error("Failed to load submitted answers:", error);
      }
    };

    void loadSubmittedAnswers();
  }, [questions, sessionId]);

  const handleAnswerSubmitted = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const newAnswered = new Set(answeredQuestions);
    newAnswered.add(currentQuestion.id);
    setAnsweredQuestions(newAnswered);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitSession = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/interview/sessions/${sessionId}/record`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "recorded" }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to submit session");
      }

      toast.success("Session submitted! Processing your answers...");
      // Redirect to processing page or show results
      window.location.href = `/dashboard/interview/${sessionId}/processing`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit session";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No questions available in this module.
        </p>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionAnswered = answeredQuestions.has(currentQuestion.id);
  const allAnswered =
    questions.length > 0 &&
    questions.every((question) => answeredQuestions.has(question.id));

  return (
    <div className="space-y-6">
      {/* Question Display */}
      <QuestionPlayer
        questionNumber={currentQuestionIndex}
        totalQuestions={questions.length}
        questionText={currentQuestion.promptText}
        questionAudioPath={currentQuestion.promptAudioPath || undefined}
        standardResponses={standardResponses}
      />

      {/* Audio Recorder */}
      <AudioRecorder
        sessionId={sessionId}
        questionId={currentQuestion.id}
        questionIndex={currentQuestionIndex}
        isLocked={currentQuestionAnswered}
        onUploadSuccess={handleAnswerSubmitted}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          variant="outline"
        >
          Previous
        </Button>

        <div className="text-sm text-muted-foreground">
          {answeredQuestions.size} / {questions.length} answered
        </div>

        {currentQuestionIndex < questions.length - 1 ? (
          <Button onClick={handleNext}>Next</Button>
        ) : (
          <Button
            onClick={handleSubmitSession}
            disabled={submitting || !allAnswered}
            className={allAnswered ? "" : "opacity-50"}
          >
            {submitting ? "Submitting..." : "Submit All Answers"}
          </Button>
        )}
      </div>

      {!allAnswered && (
        <p className="text-xs text-center text-muted-foreground">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}
