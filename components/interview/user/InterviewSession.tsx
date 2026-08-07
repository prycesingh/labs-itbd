"use client";

import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";
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
  resuming?: boolean;
}

export function InterviewSession({
  sessionId,
  resuming = false,
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
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  // Fetch this session's fixed question set — chosen once server-side at
  // session creation (see POST /api/interview/sessions) and reused verbatim
  // on every resume, so a mid-attempt candidate always sees the same subset —
  // together with any answers already submitted for it, in one round-trip.
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(
          `/api/interview/sessions?sessionId=${sessionId}`,
        );
        if (!response.ok) return;

        const payload = await response.json();
        const sessionQuestions: Question[] = Array.isArray(
          payload?.sessionQuestions,
        )
          ? payload.sessionQuestions
          : [];
        setQuestions(sessionQuestions);

        const submittedQuestionIds = new Set<string>(
          (payload?.answers ?? []).map((answer: { questionId: string }) =>
            String(answer.questionId),
          ),
        );
        const availableQuestionIds = new Set(
          sessionQuestions.map((question) => question.id),
        );
        const lockedQuestionIds = new Set<string>();
        submittedQuestionIds.forEach((questionId) => {
          if (availableQuestionIds.has(questionId)) {
            lockedQuestionIds.add(questionId);
          }
        });
        setAnsweredQuestions(lockedQuestionIds);

        if (resuming && lockedQuestionIds.size > 0) {
          const firstUnansweredIndex = sessionQuestions.findIndex(
            (question) => !lockedQuestionIds.has(question.id),
          );
          const targetIndex =
            firstUnansweredIndex === -1
              ? sessionQuestions.length - 1
              : firstUnansweredIndex;
          setCurrentQuestionIndex(targetIndex);
          setResumeIndex(targetIndex);
          setShowResumeBanner(true);
        }
      } catch (error) {
        console.error("Failed to load interview session:", error);
        toast.error("Failed to load questions");
      } finally {
        setLoading(false);
      }
    };

    void fetchSession();
  }, [sessionId, resuming]);

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
      <div className="itbd-glow-border flex items-center justify-center rounded-2xl bg-black/40 p-8 backdrop-blur-md">
        <Loader2 className="h-6 w-6 animate-spin text-itbd-blue" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="itbd-glow-border rounded-2xl bg-black/40 p-8 text-center backdrop-blur-md">
        <p className="text-white/60">No questions available in this module.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionAnswered = answeredQuestions.has(currentQuestion.id);
  const allAnswered =
    questions.length > 0 &&
    questions.every((question) => answeredQuestions.has(question.id));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {showResumeBanner && resumeIndex !== null && (
        <div className="itbd-glow-border rounded-xl border border-itbd-blue/30 bg-itbd-blue/10 px-4 py-2 text-sm text-itbd-blue">
          Resuming your in-progress attempt at question {resumeIndex + 1}
        </div>
      )}
      {/* Question + recorder run side by side and stretch to match each
          other's height (items-stretch is the flex default, but called out
          here since both children rely on it) — h-full on each card's own
          root, set below, is what lets them actually fill that shared
          height instead of just sizing to their own content.
          Capped to a viewport-relative height (minus an estimate for the
          dashboard chrome above/below: header, breadcrumb, nav row) so the
          pair fits one screen on typical laptop/desktop heights instead of
          sizing purely to content and leaving a scrollbar. */}
      <div className="flex min-h-90 w-full flex-1 flex-col gap-4 md:h-[min(38rem,calc(100dvh-19rem))] md:flex-row">
        {/* Question Display */}
        <QuestionPlayer
          questionNumber={currentQuestionIndex}
          totalQuestions={questions.length}
          questionText={currentQuestion.promptText}
          questionAudioPath={currentQuestion.promptAudioPath || undefined}
          standardResponses={standardResponses}
          className="md:flex-1"
        />

        {/* Audio Recorder */}
        <AudioRecorder
          sessionId={sessionId}
          questionId={currentQuestion.id}
          questionIndex={currentQuestionIndex}
          isLocked={currentQuestionAnswered}
          onUploadSuccess={handleAnswerSubmitted}
          className="md:flex-1"
        />
      </div>
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <GreenButton
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </GreenButton>

        <div className="text-sm text-white/60">
          {answeredQuestions.size} / {questions.length} answered
        </div>

        {currentQuestionIndex < questions.length - 1 ? (
          <DefaultButton onClick={handleNext}>Next</DefaultButton>
        ) : (
          <DefaultButton
            onClick={handleSubmitSession}
            disabled={submitting || !allAnswered}
            loading={submitting}
          >
            Submit All Answers
          </DefaultButton>
        )}
      </div>

      {!allAnswered && (
        <p className="text-center text-xs text-white/50">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}
