"use client";

import { AudioPlayer } from "@/components/app_componentes/AudioPlayer";
import DefaultButton from "@/components/app_componentes/customButtons";
import { Progress } from "@/components/ui/progress";
import { speak } from "@/lib/interview/textToSpeech";
import { cn } from "@/lib/utils";
import { Ear, Volume2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface StandardResponse {
  id: string;
  responseText: string;
}

interface QuestionPlayerProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  questionAudioPath?: string;
  standardResponses: StandardResponse[];
  className?: string;
  // Interview Coach only: hides questionText and shows a replay button
  // (browser TTS) instead, so the candidate answers purely from listening —
  // matches interview-coach-main's "audio-only" setup toggle.
  audioOnly?: boolean;
}

/**
 * Question display for an interview session — brought in line with the
 * ITBD-branded `itbd-glow-border` / `bg-black/40 backdrop-blur-md` surface
 * used across the landing page and dashboard (`LabCard`, `HowItWorks`),
 * so the interview module reads as the same product rather than a plain
 * shadcn default.
 */
export function QuestionPlayer({
  questionNumber,
  totalQuestions,
  questionText,
  questionAudioPath,
  className,
  audioOnly = false,
}: QuestionPlayerProps) {
  const reduce = useReducedMotion();
  const progress = ((questionNumber + 1) / totalQuestions) * 100;

  return (
    <motion.div
      className={cn(
        "itbd-glow-border relative flex w-full flex-col overflow-hidden rounded-2xl bg-black/40 p-4 backdrop-blur-md sm:p-5",
        className,
      )}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-wide text-white uppercase sm:text-xl">
            Question{" "}
            <span className="text-itbd-blue">{questionNumber + 1}</span>{" "}
            <span className="text-white/50">of {totalQuestions}</span>
          </h2>
          <span className="shrink-0 text-sm font-semibold text-itbd-blue tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>

        <Progress value={progress} className="h-1.5 bg-white/10" />

        {audioOnly ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <Ear className="h-6 w-6 text-itbd-blue" />
            <p className="text-sm text-white/70">
              Listen to the question, then record your answer. Replay it as
              many times as you need.
            </p>
            <DefaultButton
              onClick={() => speak(questionText)}
              className="w-fit"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              Replay Question
            </DefaultButton>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-base leading-relaxed text-white/90">
              {questionText}
            </p>
          </div>
        )}

        {questionAudioPath && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-itbd-blue uppercase">
              <Volume2 className="h-3.5 w-3.5" />
              Question Audio
            </label>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <AudioPlayer key={questionAudioPath} src={questionAudioPath} />
            </div>
          </div>
        )}

        <p className="mt-auto text-xs text-white/50">
          Take your time to understand the question. You&apos;ll have a chance
          to record your answer next.
        </p>
      </div>
    </motion.div>
  );
}
