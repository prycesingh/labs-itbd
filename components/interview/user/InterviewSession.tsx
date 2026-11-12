"use client";

import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";
import { Switch } from "@/components/ui/switch";
import { useCountdown } from "@/hooks/useCountdown";
import {
  speak,
  speakRepeated,
  stopSpeaking,
} from "@/lib/interview/textToSpeech";
import { Ear, Headphones, Loader2, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type QuestionType } from "@/lib/interview/questionTypes";
import { AudioRecorder, type AudioRecorderHandle } from "./AudioRecorder";
import { QuestionPlayer } from "./QuestionPlayer";

interface Question {
  id: string;
  promptText: string;
  promptAudioPath: string | null;
  // Set for blueprint modules (Interview Coach); null for hand-written
  // questions, which then show no type label.
  questionType?: QuestionType | null;
  category?: string | null;
}

interface StandardResponse {
  id: string;
  responseText: string;
}

interface PendingFollowUp {
  id: string;
  questionText: string;
  parentAnswerId: string;
  parentQuestionText?: string;
  parentQuestionId?: string;
  // "inline": asked right after its answer was evaluated — resolving it
  // moves to the next question. "submit": caught by the final submit gate
  // — resolving it re-runs the gate.
  origin: "inline" | "submit";
}

interface InterviewSessionProps {
  sessionId: string;
  resuming?: boolean;
}

const HANDS_FREE_READ_COUNT = 2;
const HANDS_FREE_COUNTDOWN_SECONDS = 5;
// Inline follow-up check: transcription + evaluation normally takes a few
// seconds; past the timeout the candidate moves on and the submit gate
// catches any late follow-up.
const FOLLOW_UP_POLL_INTERVAL_MS = 1500;
const FOLLOW_UP_WAIT_TIMEOUT_MS = 90_000;

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

  // Capability-gated: only true when the session's module has follow_ups
  // enabled (Interview Coach today) — Customer Cetricity's response never
  // sets this, so every hands-free/audio-only/follow-up code path below is
  // inert for it.
  const [followUpsSupported, setFollowUpsSupported] = useState(false);

  // Setup-screen toggles — offered only when followUpsSupported (gating
  // hands-free/audio-only to Interview Coach, matching the plan's "ship
  // gated to Interview Coach's module UI first" scope). Locked once the
  // session's first question has been shown so switching mid-session can't
  // desync the hands-free auto-advance state machine below.
  const [showSetup, setShowSetup] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);

  // Hands-free orchestration state.
  const [isReadingQuestion, setIsReadingQuestion] = useState(false);
  const countdown = useCountdown();
  const recorderRef = useRef<AudioRecorderHandle>(null);
  const lastAutoStartedQuestionId = useRef<string | null>(null);

  // Follow-up "checking..." pause (Interview Coach only).
  const [checkingFollowUp, setCheckingFollowUp] = useState(false);
  const [checkingKind, setCheckingKind] = useState<"inline" | "submit">(
    "inline",
  );
  const [pendingFollowUp, setPendingFollowUp] =
    useState<PendingFollowUp | null>(null);

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
        setFollowUpsSupported(Boolean(payload?.capabilities?.followUps));

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
          // Resuming mid-session skips the setup screen — hands-free/audio-only
          // choices only make sense before the first recording.
          setShowSetup(false);
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

  const currentQuestion = questions[currentQuestionIndex];

  // What's on screen right now: an inline follow-up takes precedence over
  // the base question it probes.
  const activePrompt = pendingFollowUp
    ? { id: pendingFollowUp.id, text: pendingFollowUp.questionText }
    : currentQuestion && !answeredQuestions.has(currentQuestion.id)
      ? { id: currentQuestion.id, text: currentQuestion.promptText }
      : null;

  // Speech failed (no voices, blocked, VDI without audio) — never leave an
  // audio-only candidate with an invisible question: reveal the text.
  const handleSpeechError = (reason: string) => {
    console.warn("[InterviewSession] Text-to-speech failed:", reason);
    setIsReadingQuestion(false);
    if (audioOnly) {
      setAudioOnly(false);
      toast.error("Couldn't play the question aloud", {
        description:
          "Your browser's speech engine isn't available, so the question text is now shown instead.",
      });
    }
  };

  // Hands-free: on each new question or follow-up, read it aloud twice,
  // then count down, then auto-start recording — mirrors
  // interview-coach-main's hands-free UX. Guarded by
  // lastAutoStartedQuestionId so this never re-fires for the same prompt.
  // stopSpeaking() in cleanup no longer triggers the countdown (see
  // textToSpeech.ts's generation guard), so navigating away mid-read can't
  // auto-start a recording.
  useEffect(() => {
    if (!handsFree || showSetup || checkingFollowUp || !activePrompt) return;
    if (lastAutoStartedQuestionId.current === activePrompt.id) return;

    lastAutoStartedQuestionId.current = activePrompt.id;
    setIsReadingQuestion(true);

    const startCountdown = () => {
      setIsReadingQuestion(false);
      countdown.start(HANDS_FREE_COUNTDOWN_SECONDS, () => {
        void recorderRef.current?.startRecording();
      });
    };

    speakRepeated(
      activePrompt.text,
      HANDS_FREE_READ_COUNT,
      startCountdown,
      (reason) => {
        handleSpeechError(reason);
        startCountdown();
      },
    );

    return () => {
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdown is a stable hook-returned object; activePrompt is derived and keyed by id
  }, [handsFree, showSetup, checkingFollowUp, activePrompt?.id]);

  // Audio-only without hands-free: read each new prompt once automatically.
  // Previously nothing played until the candidate found "Replay Question",
  // so audio-only looked like listening simply didn't work.
  const lastAutoReadId = useRef<string | null>(null);
  useEffect(() => {
    if (!audioOnly || handsFree || showSetup || checkingFollowUp) return;
    if (!activePrompt || lastAutoReadId.current === activePrompt.id) return;
    lastAutoReadId.current = activePrompt.id;
    speak(activePrompt.text, { onError: handleSpeechError });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by prompt id
  }, [audioOnly, handsFree, showSetup, checkingFollowUp, activePrompt?.id]);

  useEffect(() => stopSpeaking, []);

  const advanceToNextQuestion = () => {
    setCurrentQuestionIndex((prev) =>
      prev < questions.length - 1 ? prev + 1 : prev,
    );
  };

  const toPendingFollowUp = (
    followUp: Record<string, string>,
    origin: PendingFollowUp["origin"],
  ): PendingFollowUp => ({
    id: followUp.id,
    questionText: followUp.questionText,
    parentAnswerId: followUp.parentAnswerId,
    parentQuestionText: followUp.parentQuestionText,
    parentQuestionId: followUp.parentQuestionId,
    origin,
  });

  // Per-question review: after each base answer, wait for it to be
  // transcribed and evaluated, then ask any follow-up immediately — while
  // the question is still fresh — before moving on. Waiting is deliberate:
  // a follow-up only makes sense in the context of the answer it probes.
  // If evaluation runs past FOLLOW_UP_WAIT_TIMEOUT_MS the candidate moves
  // on, and the submit-time gate below still catches the late follow-up.
  const waitForInlineFollowUp = async (answerId: string) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < FOLLOW_UP_WAIT_TIMEOUT_MS) {
      try {
        const res = await fetch(
          `/api/interview/sessions/${sessionId}/follow-up?afterAnswerId=${encodeURIComponent(answerId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.followUp) return data.followUp as Record<string, string>;
          // Evaluated (or failed) with no follow-up — done waiting.
          if (data.answerStatus && !data.processing) return null;
        }
      } catch (error) {
        console.error("Follow-up poll failed:", error);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, FOLLOW_UP_POLL_INTERVAL_MS),
      );
    }
    return null;
  };

  const handleAnswerSubmitted = async (
    _blob: Blob,
    _duration: number,
    answerId?: string,
  ) => {
    void _blob;
    void _duration;
    if (!currentQuestion) return;

    setAnsweredQuestions((prev) => new Set(prev).add(currentQuestion.id));

    if (!followUpsSupported || !answerId) {
      advanceToNextQuestion();
      return;
    }

    setCheckingKind("inline");
    setCheckingFollowUp(true);
    try {
      const followUp = await waitForInlineFollowUp(answerId);
      if (followUp) {
        setPendingFollowUp(toPendingFollowUp(followUp, "inline"));
        return;
      }
    } finally {
      setCheckingFollowUp(false);
    }
    advanceToNextQuestion();
  };

  // An inline follow-up resolves by moving to the next question; one caught
  // at the submit gate re-runs the gate (another may still be pending).
  const resolveFollowUp = (followUp: PendingFollowUp) => {
    setPendingFollowUp(null);
    if (followUp.origin === "inline") {
      advanceToNextQuestion();
    } else {
      void handleSubmitSession();
    }
  };

  const handleFollowUpAnswerSubmitted = () => {
    if (!pendingFollowUp) return;
    resolveFollowUp(pendingFollowUp);
  };

  // The skip must be persisted before moving on — the submit gate re-fetches
  // pending follow-ups, so a skip that only cleared local state got the same
  // follow-up handed straight back and the candidate could never move on.
  const [skippingFollowUp, setSkippingFollowUp] = useState(false);
  const handleSkipFollowUp = async () => {
    if (!pendingFollowUp) return;
    stopSpeaking();
    countdown.reset();
    setSkippingFollowUp(true);
    try {
      const res = await fetch(
        `/api/interview/sessions/${sessionId}/follow-up`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followUpId: pendingFollowUp.id }),
        },
      );
      if (!res.ok) throw new Error("Failed to skip follow-up");
      resolveFollowUp(pendingFollowUp);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to skip follow-up";
      toast.error(message);
    } finally {
      setSkippingFollowUp(false);
    }
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

  // Safety net before final submit: follow-ups are normally asked inline
  // right after each answer, but one whose evaluation outlasted the inline
  // wait is caught here. Re-invoked after each is answered/skipped so every
  // remaining one surfaces before actually submitting.
  const handleSubmitSession = async () => {
    if (followUpsSupported) {
      setCheckingKind("submit");
      setCheckingFollowUp(true);
      try {
        const res = await fetch(
          `/api/interview/sessions/${sessionId}/follow-up`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.followUp) {
            setPendingFollowUp(toPendingFollowUp(data.followUp, "submit"));
            toast.message("One more follow-up question", {
              description:
                "The coach flagged one of your answers for a quick follow-up — answer it, then we'll submit.",
            });
            return;
          }
        }
      } catch (error) {
        console.error("Final follow-up check failed:", error);
      } finally {
        setCheckingFollowUp(false);
      }
    }

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

  // Setup screen: hands-free / audio-only toggles, offered only when the
  // module supports follow-ups (Interview Coach) — Customer Cetricity's
  // session goes straight to the first question, unchanged from before
  // this phase.
  if (showSetup && followUpsSupported) {
    return (
      <div className="itbd-glow-border flex flex-col gap-5 rounded-2xl bg-black/40 p-6 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold tracking-wide text-white uppercase">
            Session Setup
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Optional: let the app read questions aloud and start recording
            for you.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <Headphones className="h-5 w-5 text-itbd-blue" />
            <div>
              <p className="text-sm font-medium text-white">Hands-free mode</p>
              <p className="text-xs text-white/50">
                Reads each question aloud, counts down, then starts recording
                automatically.
              </p>
            </div>
          </div>
          <Switch checked={handsFree} onCheckedChange={setHandsFree} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <Ear className="h-5 w-5 text-itbd-blue" />
            <div>
              <p className="text-sm font-medium text-white">Audio-only mode</p>
              <p className="text-xs text-white/50">
                Hides question text — answer purely from listening, like a
                phone interview.
              </p>
            </div>
          </div>
          <Switch checked={audioOnly} onCheckedChange={setAudioOnly} />
        </div>

        <DefaultButton onClick={() => setShowSetup(false)} className="w-fit">
          Start Interview
        </DefaultButton>
      </div>
    );
  }

  // Follow-ups all surface at submit time, while the last question is on
  // screen — label each with the question it actually probes instead.
  const followUpParentIndex = (() => {
    if (!pendingFollowUp?.parentQuestionId) return currentQuestionIndex;
    const index = questions.findIndex(
      (question) => question.id === pendingFollowUp.parentQuestionId,
    );
    return index === -1 ? currentQuestionIndex : index;
  })();

  const currentQuestionAnswered = currentQuestion
    ? answeredQuestions.has(currentQuestion.id)
    : false;
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

      {handsFree && (isReadingQuestion || countdown.isRunning) && (
        <div className="itbd-glow-border flex items-center gap-3 rounded-xl border border-itbd-blue/30 bg-itbd-blue/10 px-4 py-2 text-sm text-itbd-blue">
          <Mic className="h-4 w-4" />
          {isReadingQuestion
            ? "Reading question aloud…"
            : `Recording starts in ${countdown.secondsLeft}s…`}
        </div>
      )}

      {pendingFollowUp ? (
        <div className="flex min-h-90 w-full flex-1 flex-col gap-4 md:h-[min(38rem,calc(100dvh-19rem))] md:flex-row">
          <QuestionPlayer
            questionNumber={followUpParentIndex}
            totalQuestions={questions.length}
            questionText={pendingFollowUp.questionText}
            standardResponses={[]}
            audioOnly={audioOnly}
            isFollowUp
            followUpOfQuestionText={pendingFollowUp.parentQuestionText}
            className="md:flex-1"
          />
          <AudioRecorder
            ref={recorderRef}
            sessionId={sessionId}
            questionId={pendingFollowUp.id}
            followUpId={pendingFollowUp.id}
            questionIndex={currentQuestionIndex}
            onUploadSuccess={handleFollowUpAnswerSubmitted}
            className="md:flex-1"
          />
        </div>
      ) : (
        currentQuestion && (
          <div className="flex min-h-90 w-full flex-1 flex-col gap-4 md:h-[min(38rem,calc(100dvh-19rem))] md:flex-row">
            <QuestionPlayer
              questionNumber={currentQuestionIndex}
              totalQuestions={questions.length}
              questionText={currentQuestion.promptText}
              questionAudioPath={currentQuestion.promptAudioPath || undefined}
              questionType={currentQuestion.questionType ?? undefined}
              category={currentQuestion.category ?? undefined}
              standardResponses={standardResponses}
              audioOnly={audioOnly}
              className="md:flex-1"
            />
            {checkingFollowUp ? (
              <div className="itbd-glow-border relative flex w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-black/40 p-6 text-center backdrop-blur-md md:flex-1">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
                />
                <Loader2 className="h-8 w-8 animate-spin text-itbd-blue" />
                <p className="text-base font-semibold text-white">
                  {checkingKind === "submit"
                    ? "Checking for follow-ups…"
                    : "Reviewing your answer…"}
                </p>
                <p className="max-w-xs text-sm text-white/50">
                  {checkingKind === "submit"
                    ? "Before we submit, we're confirming whether any of your answers need a quick follow-up."
                    : "The coach is listening back to your answer. If it wants to dig deeper, you'll get a follow-up right away — otherwise you'll move to the next question."}
                </p>
              </div>
            ) : (
              <AudioRecorder
                ref={recorderRef}
                sessionId={sessionId}
                questionId={currentQuestion.id}
                questionIndex={currentQuestionIndex}
                isLocked={currentQuestionAnswered}
                onUploadSuccess={handleAnswerSubmitted}
                className="md:flex-1"
              />
            )}
          </div>
        )
      )}

      {/* Navigation — hidden while a follow-up is pending, since the only
          way forward there is answering it (or skipping) via the controls
          above/below, not the normal Previous/Next flow. */}
      {!pendingFollowUp && (
        <div className="flex items-center justify-between">
          <GreenButton
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0 || checkingFollowUp}
          >
            Previous
          </GreenButton>

          <div className="text-sm text-white/60">
            {answeredQuestions.size} / {questions.length} answered
          </div>

          {currentQuestionIndex < questions.length - 1 ? (
            <DefaultButton onClick={handleNext} disabled={checkingFollowUp}>
              Next
            </DefaultButton>
          ) : (
            <DefaultButton
              onClick={handleSubmitSession}
              disabled={submitting || !allAnswered || checkingFollowUp}
              loading={submitting}
            >
              Submit All Answers
            </DefaultButton>
          )}
        </div>
      )}

      {pendingFollowUp && (
        <div className="flex items-center justify-end">
          <GreenButton
            onClick={() => void handleSkipFollowUp()}
            disabled={skippingFollowUp || submitting || checkingFollowUp}
            loading={skippingFollowUp}
          >
            Skip follow-up
          </GreenButton>
        </div>
      )}

      {!allAnswered && !pendingFollowUp && (
        <p className="text-center text-xs text-white/50">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}
