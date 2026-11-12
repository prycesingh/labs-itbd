"use client";

import { cn } from "@/lib/utils";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * ITBD-branded replacement for the native `<audio controls>` UI, which can't
 * be restyled directly (it's rendered by the OS/browser chrome, not the
 * page). Wraps a hidden `<audio>` element and drives play/pause, the
 * scrubber, and elapsed/total time from its JS API instead.
 */
export function AudioPlayer({
  src,
  className,
  onDurationChange,
  onError,
}: {
  src: string;
  className?: string;
  /** Fires once the real decoded duration (seconds) of `src` is known. */
  onDurationChange?: (seconds: number) => void;
  /**
   * Fires when `src` can't be loaded or played (404, unsupported format).
   * Without this the player sat at 0:00 with a dead Play button and an
   * unhandled play() rejection — see QuestionPlayer's TTS fallback.
   */
  onError?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const discoveringDuration = useRef(false);
  // Set when Play is clicked while the duration-discovery seek (below) is
  // still pending, so onSeeked can start playback once currentTime is
  // actually back at 0 instead of wherever the discovery seek left it.
  const playPending = useRef(false);

  // A new `src` (different question/recording) always starts paused at 0 —
  // reset local state so a stale scrubber position from the previous audio
  // doesn't flash before the new metadata loads.
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setFailed(false);
    discoveringDuration.current = false;
    playPending.current = false;
  }, [src]);

  const handleFailure = () => {
    setPlaying(false);
    setFailed(true);
    onError?.();
  };

  // play() returns a promise that rejects when the source is missing or
  // unsupported — always handle it rather than letting it go unhandled.
  const safePlay = (el: HTMLAudioElement) => {
    el.play().catch((error: unknown) => {
      // AbortError = a pause()/new src interrupted play(); not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      handleFailure();
    });
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      // The duration-discovery seek (onLoadedMetadata below) briefly leaves
      // currentTime at the end of the track while it scans for the real
      // duration. Starting playback during that window plays from the end
      // (or wherever the scan currently is) instead of the beginning, then
      // gets yanked back to 0 once the seek resolves — the "starts from the
      // middle" bug. Defer the actual play() until onSeeked confirms we're
      // back at 0.
      if (discoveringDuration.current) {
        playPending.current = true;
        return;
      }
      safePlay(el);
    } else {
      el.pause();
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const value = Number(e.target.value);
    el.currentTime = value;
    setCurrentTime(value);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          // MediaRecorder-produced WebM blobs often omit a valid Duration in
          // their EBML header, so Chromium reports Infinity/NaN here until
          // the container is scanned. Forcing a seek past the end triggers
          // that scan; the one-time "seeked" handler below reads the real
          // value and seeks back to the start. Guarded by a ref (not state)
          // so a user's own manual scrub doesn't get caught by this dance.
          if (!Number.isFinite(el.duration)) {
            discoveringDuration.current = true;
            el.currentTime = Number.MAX_SAFE_INTEGER;
          } else {
            setDuration(el.duration);
            onDurationChange?.(el.duration);
          }
        }}
        onDurationChange={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) {
            setDuration(e.currentTarget.duration);
            onDurationChange?.(e.currentTarget.duration);
          }
        }}
        onSeeked={(e) => {
          if (!discoveringDuration.current) return;
          discoveringDuration.current = false;
          const el = e.currentTarget;
          if (Number.isFinite(el.duration)) {
            setDuration(el.duration);
            onDurationChange?.(el.duration);
          }
          el.currentTime = 0;
          if (playPending.current) {
            playPending.current = false;
            safePlay(el);
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={handleFailure}
        className="hidden"
      >
        Your browser does not support the audio element.
      </audio>

      <button
        type="button"
        onClick={togglePlay}
        disabled={failed}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-itbd-blue text-black transition",
          "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itbd-blue",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={onSeek}
        className="itbd-scrubber h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--itbd-blue) ${
            duration ? (currentTime / duration) * 100 : 0
          }%, rgba(255,255,255,0.1) 0%)`,
        }}
        aria-label="Seek"
      />

      <span className="w-20 shrink-0 text-right text-xs text-white/50 tabular-nums">
        {failed
          ? "Unavailable"
          : `${formatTime(currentTime)} / ${formatTime(duration)}`}
      </span>
    </div>
  );
}
