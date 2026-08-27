"use client";

import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";
import { Switch } from "@/components/ui/switch";
import { useCountdown } from "@/hooks/useCountdown";
import { speakRepeated, stopSpeaking } from "@/lib/interview/textToSpeech";
import { Ear, Headphones, Loader2, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioRecorder, type AudioRecorderHandle } from "./AudioRecorder";
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

interface PendingFollowUp {
  id: string;
  questionText: string;
  parentAnswerId: string;
}

interface InterviewSessionProps {
  sessionId: string;
  resuming?: boolean;
}

const HANDS_FREE_READ_COUNT = 2;
const HANDS_FREE_COUNTDOWN_SECONDS = 5;
// How long to keep polling the follow-up endpoint after a submission before
// giving up and just advancing — mirrors the immediate-processing job's own
// budget (transcription + evaluation should resolve well within this).
const FOLLOW_UP_POLL_TIMEOUT_MS = 45_000;
const FOLLOW_UP_POLL_INTERVAL_MS = 1500;

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
  const [pendingFollowUp, setPendingFollowUp] =
    useState<PendingFollowUp | null>(null);
  const followUpPollAbort = useRef<{ cancelled: boolean } | null>(null);

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

  // Hands-free: on each new (non-follow-up, non-setup) question, read it
  // aloud twice, then count down, then auto-start recording — mirrors
  // interview-coach-main's hands-free UX. Guarded by
  // lastAutoStartedQuestionId so this never re-fires for the same question
  // (e.g. on an unrelated re-render) and never runs once the question is
  // already answered/locked.
  useEffect(() => {
    if (
      !handsFree ||
      showSetup ||
      !currentQuestion ||
      pendingFollowUp ||
      checkingFollowUp
    ) {
      return;
    }
    if (answeredQuestions.has(currentQuestion.id)) return;
    if (lastAutoStartedQuestionId.current === currentQuestion.id) return;

    lastAutoStartedQuestionId.current = currentQuestion.id;
    setIsReadingQuestion(true);

    speakRepeated(currentQuestion.promptText, HANDS_FREE_READ_COUNT, () => {
      setIsReadingQuestion(false);
      countdown.start(HANDS_FREE_COUNTDOWN_SECONDS, () => {
        void recorderRef.current?.startRecording();
      });
    });

    return () => {
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdown is a stable hook-returned object; including it would re-fire on every tick
  }, [
    handsFree,
    showSetup,
    currentQuestion,
    pendingFollowUp,
    checkingFollowUp,
    answeredQuestions,
  ]);

  useEffect(() => stopSpeaking, []);

  const pollForFollowUp = (afterAnswerId: string) => {
    const token = { cancelled: false };
    followUpPollAbort.current = token;
    setCheckingFollowUp(true);
    const startedAt = Date.now();

    const poll = async () => {
      if (token.cancelled) return;
      try {
        const res = await fetch(
          `/api/interview/sessions/${sessionId}/follow-up?afterAnswerId=${afterAnswerId}`,
        );
        if (token.cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.followUp) {
            setCheckingFollowUp(false);
            setPendingFollowUp({
              id: data.followUp.id,
              questionText: data.followUp.questionText,
              parentAnswerId: data.followUp.parentAnswerId,
            });
            return;
          }
          if (!data.processing) {
            // Transcription/evaluation finished with no follow-up recommended.
            setCheckingFollowUp(false);
            advanceAfterFollowUpCheck();
            return;
          }
        }
      } catch (error) {
        console.error("Follow-up poll failed:", error);
      }

      if (Date.now() - startedAt >= FOLLOW_UP_POLL_TIMEOUT_MS) {
        setCheckingFollowUp(false);
        advanceAfterFollowUpCheck();
        return;
      }
      setTimeout(poll, FOLLOW_UP_POLL_INTERVAL_MS);
    };

    void poll();
  };

  useEffect(
    () => () => {
      if (followUpPollAbort.current) followUpPollAbort.current.cancelled = true;
    },
    [],
  );

  const advanceAfterFollowUpCheck = () => {
    setCurrentQuestionIndex((prev) =>
      prev < questions.length - 1 ? prev + 1 : prev,
    );
  };

  const handleAnswerSubmitted = (_blob: Blob, _duration: number) => {
    void _blob;
    void _duration;
    if (!currentQuestion) return;

    const newAnswered = new Set(answeredQuestions);
    newAnswered.add(currentQuestion.id);
    setAnsweredQuestions(newAnswered);

    if (!followUpsSupported) return;

    // Interview Coach only: find the answer we just created for this
    // question and start polling for whether it's flagged a follow-up.
    // The upload response itself doesn't carry the new answerId, so we
    // resolve it from the session refetch instead — simplest correct path
    // given AudioRecorder's existing onUploadSuccess signature.
    void fetch(`/api/interview/sessions?sessionId=${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const answer = (payload?.answers ?? []).find(
          (a: { questionId: string }) => a.questionId === currentQuestion.id,
        );
        if (answer?.id) {
          pollForFollowUp(answer.id);
        }
      })
      .catch(() => undefined);
  };

  const handleFollowUpAnswerSubmitted = () => {
    if (!pendingFollowUp) return;
    setPendingFollowUp(null);
    advanceAfterFollowUpCheck();
  };

  const handleSkipFollowUp = () => {
    setPendingFollowUp(null);
    advanceAfterFollowUpCheck();
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

      {checkingFollowUp && (
        <div className="itbd-glow-border flex items-center gap-3 rounded-xl border border-itbd-blue/30 bg-itbd-blue/10 px-4 py-2 text-sm text-itbd-blue">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your answer…
        </div>
      )}

      {pendingFollowUp ? (
        <div className="flex min-h-90 w-full flex-1 flex-col gap-4 md:h-[min(38rem,calc(100dvh-19rem))] md:flex-row">
          <QuestionPlayer
            questionNumber={currentQuestionIndex}
            totalQuestions={questions.length}
            questionText={pendingFollowUp.questionText}
            standardResponses={[]}
            audioOnly={audioOnly}
            className="md:flex-1"
          />
          <AudioRecorder
            sessionId={sessionId}
            questionId={pendingFollowUp.parentAnswerId}
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
              standardResponses={standardResponses}
              audioOnly={audioOnly}
              className="md:flex-1"
            />
            <AudioRecorder
              ref={recorderRef}
              sessionId={sessionId}
              questionId={currentQuestion.id}
              questionIndex={currentQuestionIndex}
              isLocked={currentQuestionAnswered}
              onUploadSuccess={handleAnswerSubmitted}
              className="md:flex-1"
            />
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
          <GreenButton onClick={handleSkipFollowUp}>
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
