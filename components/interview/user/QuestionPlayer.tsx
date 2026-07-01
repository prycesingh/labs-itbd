"use client";

import { Card } from "@/components/ui/card";

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
}

export function QuestionPlayer({
  questionNumber,
  totalQuestions,
  questionText,
  questionAudioPath,
}: QuestionPlayerProps) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">
          Question {questionNumber + 1} of {totalQuestions}
        </h2>
        <div className="text-sm text-muted-foreground">
          Progress: {Math.round(((questionNumber + 1) / totalQuestions) * 100)}
          &%
        </div>
      </div>

      {/* Question Text */}
      <div className="bg-muted p-4 rounded">
        <p className="text-lg leading-relaxed">{questionText}</p>
      </div>

      {/* Question Audio (if available) */}
      {questionAudioPath && (
        <div>
          <label className="text-sm font-medium">Question Audio</label>
          <audio
            key={questionAudioPath}
            controls
            preload="metadata"
            className="w-full mt-2"
            src={questionAudioPath}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Take your time to understand the question. You&apos;ll have a chance to
        record your answer next.
      </p>
    </Card>
  );
}
