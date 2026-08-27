/**
 * Thin wrapper around the browser's native window.speechSynthesis API —
 * used by Interview Coach's hands-free/audio-only modes to read a question
 * aloud, matching interview-coach-main's approach (it also used
 * browser-native TTS, not a paid voice service, so this carries zero
 * incremental cost). Client-only; every export is a no-op if
 * speechSynthesis is unavailable (SSR, unsupported browser).
 */

function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

/** Cancels anything currently speaking/queued, then speaks `text`. */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isSupported() || !text.trim()) {
    options.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  if (options.onEnd) {
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Speaks `text` `times` times in sequence (interview-coach-main's
 * hands-free mode reads each question twice before the countdown starts),
 * then calls onDone once.
 */
export function speakRepeated(
  text: string,
  times: number,
  onDone?: () => void,
): void {
  if (!isSupported() || times <= 0 || !text.trim()) {
    onDone?.();
    return;
  }

  let remaining = times;
  const speakNext = () => {
    remaining -= 1;
    if (remaining <= 0) {
      speak(text, { onEnd: onDone });
    } else {
      speak(text, { onEnd: speakNext });
    }
  };
  speakNext();
}

export function stopSpeaking(): void {
  if (isSupported()) window.speechSynthesis.cancel();
}

export function isSpeechSynthesisSupported(): boolean {
  return isSupported();
}
