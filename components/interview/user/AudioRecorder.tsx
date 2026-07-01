"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface AudioRecorderProps {
  sessionId: string;
  questionId: string;
  questionIndex: number;
  isLocked?: boolean;
  maxAttempts?: number;
  onUploadSuccess?: (blob: Blob, duration: number) => void;
}

export function AudioRecorder({
  sessionId,
  questionId,
  questionIndex,
  isLocked = false,
  maxAttempts = 2,
  onUploadSuccess,
}: AudioRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [playback, setPlayback] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRecordedBlob(null);
    setDuration(0);
    setAttemptNumber(1);
    setPlayback(false);
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
    if (playback) setPlayback(false);

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
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Record Your Answer</h3>
        <div className="text-sm text-muted-foreground">
          {isLocked
            ? "Submitted"
            : `Attempt ${attemptNumber} of ${maxAttempts}`}
        </div>
      </div>

      {isLocked ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          This answer has already been submitted. Re-recording is disabled for
          this question.
        </div>
      ) : null}

      {!recordedBlob ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {isRecording && (
              <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse" />
            )}
            {!isRecording && <Mic className="h-6 w-6 text-muted-foreground" />}
          </div>

          <p className="text-lg font-medium">{formatTime(duration)}</p>

          <div className="flex gap-2">
            {!isRecording ? (
              <Button onClick={startRecording} size="lg" disabled={isLocked}>
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                disabled={isLocked}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Speak naturally. You&apos;ll be able to listen to your recording
            before submitting.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded">
            <p className="text-sm font-medium mb-2">
              Recording Duration: {formatTime(duration)}
            </p>
            <audio ref={audioRef} controls className="w-full">
              <source
                src={URL.createObjectURL(recordedBlob)}
                type={recordedBlob.type}
              />
            </audio>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploading || isLocked}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Submit Answer"}
            </Button>

            {!isLocked && attemptNumber < maxAttempts && (
              <Button
                onClick={handleDiscard}
                disabled={uploading}
                variant="outline"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Discard & Retry
              </Button>
            )}
          </div>

          {attemptNumber >= maxAttempts && (
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ No more attempts available. Please submit your answer.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
