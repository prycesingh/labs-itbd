"use client";

import { AudioPlayer } from "@/components/app_componentes/AudioPlayer";
import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";
import { cn } from "@/lib/utils";
import { Mic, Square, Trash2, Upload } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface AudioRecorderProps {
  sessionId: string;
  questionId: string;
  questionIndex: number;
  isLocked?: boolean;
  maxAttempts?: number;
  onUploadSuccess?: (blob: Blob, duration: number) => void;
  className?: string;
}

export function AudioRecorder({
  sessionId,
  questionId,
  questionIndex,
  isLocked = false,
  maxAttempts = 2,
  onUploadSuccess,
  className,
}: AudioRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const reduce = useReducedMotion();

  // Memoized so a re-render doesn't leak a fresh object URL every time —
  // only regenerate when the blob itself actually changes.
  const recordedUrl = useMemo(
    () => (recordedBlob ? URL.createObjectURL(recordedBlob) : null),
    [recordedBlob],
  );

  useEffect(() => {
    if (!recordedUrl) return;
    return () => URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  useEffect(() => {
    setRecordedBlob(null);
    setDuration(0);
    setAttemptNumber(1);
    setIsRecording(false);
  }, [questionId]);

  const startRecording = async () => {
    if (isLocked) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type so the blob label always matches the actual encoding.
      // Ordered by preference: webm (Chrome/Firefox) → mp4 (Safari) → ogg fallback.
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType =
        preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ??
        "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      mediaRecorder.onstart = () => {
        setDuration(0);
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      };

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        // Use the recorder's actual mimeType so the label matches the binary content.
        const blob = new Blob(chunks, {
          type: mediaRecorder.mimeType || mimeType,
        });
        setRecordedBlob(blob);
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch {
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDiscard = () => {
    if (isLocked) return;

    setRecordedBlob(null);
    setDuration(0);

    if (attemptNumber < maxAttempts) {
      setAttemptNumber(attemptNumber + 1);
    } else {
      toast.warning(`Maximum ${maxAttempts} attempts reached`);
    }
  };

  const handleUpload = async () => {
    if (!recordedBlob || isLocked) return;

    setUploading(true);
    try {
      const formData = new FormData();
      // Strip codec suffix (e.g. "audio/webm;codecs=opus" → "audio/webm") so the
      // base MIME type passes server-side enum validation.
      const baseMimeType = (recordedBlob.type || "audio/webm")
        .split(";")[0]
        .trim();
      const fileExt = baseMimeType.split("/")[1] ?? "webm";

      formData.append("sessionId", sessionId);
      formData.append("questionId", questionId);
      formData.append("questionIndex", questionIndex.toString());
      formData.append("audio", recordedBlob, `recording.${fileExt}`);
      formData.append("audioDuration", (duration * 1000).toString());
      formData.append("audioMimeType", baseMimeType);

      const response = await fetch("/api/interview/upload-audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Try to get the server's error message; fall back to status text.
        // A 413 from Nginx returns HTML, not JSON — handle both gracefully.
        let message = `Upload failed (${response.status})`;
        if (response.status === 413) {
          message =
            "Recording is too large to upload. Please shorten your answer and try again.";
        } else {
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const body = await response.json().catch(() => null);
            if (body?.error) message = body.error;
          } else {
            message = `Upload failed: ${response.statusText}`;
          }
        }
        throw new Error(message);
      }

      toast.success("Answer recorded successfully");
      if (onUploadSuccess) {
        onUploadSuccess(recordedBlob, duration);
      }
      setRecordedBlob(null);
      setDuration(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      className={cn(
        "itbd-glow-border relative flex w-full flex-col overflow-hidden rounded-2xl bg-black/40 p-4 backdrop-blur-md sm:p-5",
        className,
      )}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: reduce ? 0 : 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold tracking-wide text-white uppercase">
            Record Your Answer
          </h3>
          <div className="text-sm font-semibold text-itbd-blue">
            {isLocked
              ? "Submitted"
              : `Attempt ${attemptNumber} of ${maxAttempts}`}
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-itbd-green/30 bg-itbd-green/10 p-3 text-sm text-itbd-green">
            This answer has already been submitted. Re-recording is disabled for
            this question.
          </div>
        ) : null}

        {!recordedBlob ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5",
                isRecording && "border-red-500/40",
              )}
            >
              {isRecording ? (
                <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-red-500" />
              ) : (
                <Mic className="h-5 w-5 text-itbd-blue" />
              )}
            </div>

            <p className="text-base font-semibold text-white tabular-nums">
              {formatTime(duration)}
            </p>

            {!isRecording ? (
              <DefaultButton onClick={startRecording} disabled={isLocked}>
                <Mic className="mr-2 h-4 w-4" />
                Start Recording
              </DefaultButton>
            ) : (
              <DefaultButton
                onClick={stopRecording}
                disabled={isLocked}
                className="bg-red-600 text-white hover:bg-red-600/90"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Recording
              </DefaultButton>
            )}

            <p className="max-w-xs text-center text-xs text-white/50">
              Speak naturally. You&apos;ll be able to listen to your recording
              before submitting.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-sm font-medium text-white/80">
                Recording Duration:{" "}
                <span className="text-itbd-blue">{formatTime(duration)}</span>
              </p>
              {recordedUrl && <AudioPlayer src={recordedUrl} />}
            </div>

            <div className="flex gap-2">
              <DefaultButton
                onClick={handleUpload}
                disabled={uploading || isLocked}
                loading={uploading}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Submit Answer
              </DefaultButton>

              {!isLocked && attemptNumber < maxAttempts && (
                <GreenButton
                  onClick={handleDiscard}
                  disabled={uploading}
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Discard & Retry
                </GreenButton>
              )}
            </div>

            {attemptNumber >= maxAttempts && (
              <p className="text-center text-xs text-white/50">
                No more attempts available. Please submit your answer.
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
