/**
 * Thin wrapper around the browser's native window.speechSynthesis API —
 * used by Interview Coach's hands-free/audio-only modes to read a question
 * aloud, matching interview-coach-main's approach (it also used
 * browser-native TTS, not a paid voice service, so this carries zero
 * incremental cost). Client-only; every export is a safe no-op if
 * speechSynthesis is unavailable (SSR, unsupported browser).
 *
 * Hardened against the Chromium speechSynthesis failure modes that made
 * "listening" fail for whole sessions:
 * - speak() issued synchronously after cancel() is sometimes silently
 *   dropped → a short delay separates them.
 * - Utterances longer than ~15 s stop mid-sentence and never fire onend
 *   (hands-free then hung on "Reading question aloud…" forever) → text is
 *   spoken in sentence-sized chunks, each with a watchdog timeout, plus a
 *   periodic resume() keep-alive.
 * - cancel() fires onerror("interrupted"/"canceled") on the in-flight
 *   utterance, which the old wrapper treated as "finished" — stopping
 *   playback on navigation started the hands-free countdown and
 *   auto-recorded → a generation counter discards callbacks from any run
 *   that was stopped or superseded.
 * - getVoices() is empty until "voiceschanged" fires on first use → wait
 *   briefly and pick an English voice explicitly.
 * Genuine failures (no voices, synthesis-failed, not-allowed) are reported
 * via onError so callers can fall back to showing the text.
 */

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  /** Fires once when the whole text has finished speaking. */
  onEnd?: () => void;
  /**
   * Fires instead of onEnd when speech could not be produced at all.
   * Never fires for a run that was stopped/superseded by the app itself.
   */
  onError?: (reason: string) => void;
  /**
   * Fires instead of onEnd/onError when this run is stopped or superseded
   * before finishing (stopSpeaking(), or another speak() call). Without
   * it, a caller waiting on the run — hands-free mode — waited forever,
   * stuck on "Reading question aloud…".
   */
  onInterrupted?: () => void;
}

const CANCEL_SETTLE_MS = 60;
const VOICE_WAIT_MS = 1500;
const KEEP_ALIVE_MS = 10_000;
const MAX_CHUNK_CHARS = 180;

// Incremented by every speak()/stopSpeaking() — a run whose generation no
// longer matches has been superseded and must not fire any callback.
let generation = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
// onInterrupted of the run currently speaking; cleared when it finishes.
let interruptActiveRun: (() => void) | null = null;

function interruptPreviousRun() {
  const interrupt = interruptActiveRun;
  interruptActiveRun = null;
  interrupt?.();
}

function clearKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function splitIntoChunks(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?;:])\s+/);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK_CHARS) {
      chunks.push(sentence);
      continue;
    }
    // Over-long sentence: break on commas, then on word boundaries.
    let current = "";
    for (const word of sentence.split(/(?<=,)\s+|\s+/)) {
      if ((current + " " + word).trim().length > MAX_CHUNK_CHARS && current) {
        chunks.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const finish = () => {
      synth.removeEventListener("voiceschanged", finish);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(finish, VOICE_WAIT_MS);
    synth.addEventListener("voiceschanged", finish);
  });
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const english = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith("en"),
  );
  return (
    english.find((voice) => voice.lang === "en-US" && voice.localService) ??
    english.find((voice) => voice.lang === "en-US") ??
    english.find((voice) => voice.localService) ??
    english[0] ??
    voices.find((voice) => voice.default) ??
    voices[0]
  );
}

/** Cancels anything currently speaking/queued, then speaks `text`. */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isSupported()) {
    options.onError?.("unsupported");
    return;
  }
  if (!text.trim()) {
    options.onEnd?.();
    return;
  }

  const synth = window.speechSynthesis;
  interruptPreviousRun();
  const runId = ++generation;
  const isCurrent = () => runId === generation;
  const myInterrupt = options.onInterrupted ?? null;
  interruptActiveRun = myInterrupt;

  clearKeepAlive();
  synth.cancel();

  void (async () => {
    const [voices] = await Promise.all([
      waitForVoices(),
      new Promise((resolve) => setTimeout(resolve, CANCEL_SETTLE_MS)),
    ]);
    if (!isCurrent()) return;

    const voice = pickVoice(voices);
    const chunks = splitIntoChunks(text);
    let index = 0;
    let spokeAnything = false;

    const finish = (error?: string) => {
      if (!isCurrent()) return;
      clearKeepAlive();
      if (interruptActiveRun === myInterrupt) interruptActiveRun = null;
      if (error && !spokeAnything) {
        options.onError?.(error);
      } else {
        options.onEnd?.();
      }
    };

    const speakChunk = () => {
      if (!isCurrent()) return;
      if (index >= chunks.length) {
        finish();
        return;
      }

      const chunk = chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "en-US";
      }
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;

      let settled = false;
      // Watchdog: Chromium sometimes never fires onend (long text, tab
      // backgrounded, audio device change). Advance anyway so hands-free
      // can never hang on a chunk. Budget ≈ generous speaking time.
      const watchdog = setTimeout(
        () => settle(),
        3000 + (chunk.length * 120) / (options.rate ?? 1),
      );

      function settle(error?: string) {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        if (!isCurrent()) return;
        if (error) {
          finish(error);
          return;
        }
        index += 1;
        speakChunk();
      }

      utterance.onstart = () => {
        spokeAnything = true;
      };
      utterance.onend = () => settle();
      utterance.onerror = (event) => {
        // "interrupted"/"canceled" come from our own cancel() calls — the
        // generation check inside settle() already discards superseded runs.
        if (event.error === "interrupted" || event.error === "canceled") {
          settle();
          return;
        }
        settle(event.error || "synthesis-failed");
      };

      synth.speak(utterance);
    };

    if (voices.length === 0) {
      // Some engines speak with an implicit default voice even when the
      // list is empty — try anyway; onError fires if nothing is produced.
      console.warn("[textToSpeech] No speech voices reported by browser");
    }

    keepAliveTimer = setInterval(() => {
      if (!isCurrent()) {
        clearKeepAlive();
        return;
      }
      // Chromium pauses long-running synthesis; resume() is a no-op if not.
      if (synth.speaking) synth.resume();
    }, KEEP_ALIVE_MS);

    speakChunk();
  })();
}

/**
 * Speaks `text` `times` times in sequence (interview-coach-main's
 * hands-free mode reads each question twice before the countdown starts),
 * then calls onDone once. onError fires instead if speech is unavailable.
 */
export function speakRepeated(
  text: string,
  times: number,
  onDone?: () => void,
  onError?: (reason: string) => void,
  onInterrupted?: () => void,
): void {
  if (times <= 0 || !text.trim()) {
    onDone?.();
    return;
  }

  let remaining = times;
  const speakNext = () => {
    remaining -= 1;
    speak(text, {
      onEnd: remaining <= 0 ? onDone : speakNext,
      onError,
      onInterrupted,
    });
  };
  speakNext();
}

/** Stops speech. The stopped run gets onInterrupted, never onEnd/onError. */
export function stopSpeaking(): void {
  interruptPreviousRun();
  generation += 1;
  clearKeepAlive();
  if (isSupported()) window.speechSynthesis.cancel();
}

export function isSpeechSynthesisSupported(): boolean {
  return isSupported();
}

/** Promise form of speakRepeated for callers that await the outcome. */
export function speakRepeatedAsync(
  text: string,
  times: number,
): Promise<"ended" | "interrupted" | "failed"> {
  return new Promise((resolve) => {
    speakRepeated(
      text,
      times,
      () => resolve("ended"),
      () => resolve("failed"),
      () => resolve("interrupted"),
    );
  });
}
