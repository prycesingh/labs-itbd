/**
 * Delivery / Acoustic Scoring
 *
 * Ported from interview-coach-main's audio_analysis.py + llm.py delivery
 * rubric — computed in Node instead of via faster-whisper/praat-parselmouth
 * (neither of which is deployable on this project's Hostinger zip-deploy
 * host). Pace/pause/filler come from Deepgram's word-level timestamps
 * (already available from the existing transcription pipeline); pitch and
 * loudness come from pitchy/pitchfinder (pitch) and meyda (loudness) —
 * pure-JS, MIT-licensed, no native/WASM build step.
 *
 * ONLY invoked for answers whose session's module has the delivery_scoring
 * capability enabled (see moduleCapabilities.ts) — every other module never
 * calls into this file at all.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PitchDetector } from "pitchy";
import Pitchfinder from "pitchfinder";
import Meyda from "meyda";
import { db } from "@/DB/drizzle";
import {
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewDeliveryMetrics,
} from "@/DB/interviewSchema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { TranscriptWordTiming } from "./aiServices";
import {
  CAPABILITY_KEYS,
  getModuleCapability,
  type CalibrationMode,
} from "./moduleCapabilities";

const execFileAsync = promisify(execFile);

// Port of audio_analysis.py's PAUSE_THRESHOLD_S.
const PAUSE_THRESHOLD_S = 0.6;

// Port of audio_analysis.py's _HESITATION_RE / FILLER_WORDS / FILLER_BIGRAMS.
// Non-lexical filled pauses (um/uh/er/hmm/ah...) including elongations.
const HESITATION_RE =
  /\b(?:u+h[-\s]?(?:huh|uh)|u+m[-\s]?h+um|u+m[-\s]?h+m*|u+m[-\s]?u+m|u+m[-\s]?u+h|u+h[-\s]?u+m|er[-\s]?um|m+[-\s]?h+m*|u+h+m+|u+h+|u+m+|e+h+m+|e+h+|e+r+m+|e+r+|a+h+|h+u+h+|em|en|h+m+|m+h+m*|m{2,}|mn|nuh|om|ugh|urgh)\b/gi;
const FILLER_WORDS = new Set([
  "like",
  "basically",
  "actually",
  "literally",
  "honestly",
  "right",
]);
const FILLER_BIGRAMS = ["you know", "sort of", "kind of", "i mean"];

function isHesitation(token: string): boolean {
  const t = token
    .trim()
    .toLowerCase()
    .replace(/^[.,;:!?\-—"']+|[.,;:!?\-—"']+$/g, "");
  if (!t) return false;
  const re = new RegExp(`^(?:${HESITATION_RE.source})$`, "i");
  return re.test(t);
}

function countFillers(words: TranscriptWordTiming[]): number {
  const joined = words
    .map((w) => w.word)
    .join(" ")
    .toLowerCase();
  const hesitations = (joined.match(HESITATION_RE) ?? []).length;
  const lexical = joined
    .split(/\s+/)
    .filter((t) => FILLER_WORDS.has(t.replace(/[^a-z']/g, ""))).length;
  const bigrams = FILLER_BIGRAMS.reduce(
    (sum, bg) => sum + joined.split(bg).length - 1,
    0,
  );
  return hesitations + lexical + bigrams;
}

export interface PaceMetrics {
  wpm: number;
  pauseCount: number;
  totalPauseS: number;
  longestPauseS: number;
  pauseRatio: number;
  fillerCount: number;
  fillersPerMin: number;
}

/**
 * Pace/pause/filler purely from Deepgram word timestamps + transcript text
 * — no new library needed, matches audio_analysis.py's compute_delivery()
 * for these three metrics exactly (pace here uses transcript word count,
 * not the acoustic syllable-nuclei cross-check the Python app also had;
 * that fallback isn't needed since Deepgram's timestamps are reliable).
 */
export function computePaceMetrics(
  words: TranscriptWordTiming[],
): PaceMetrics | null {
  const contentWords = words.filter((w) => !isHesitation(w.word));
  if (contentWords.length === 0) return null;

  const spanS = Math.max(
    0.001,
    words[words.length - 1].end - words[0].start,
  );
  const wpm = (contentWords.length / spanS) * 60;

  const pauses: number[] = [];
  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE_THRESHOLD_S) pauses.push(gap);
  }
  const totalPauseS = pauses.reduce((s, p) => s + p, 0);
  const longestPauseS = pauses.length > 0 ? Math.max(...pauses) : 0;
  const fillerCount = countFillers(words);

  return {
    wpm: Number(wpm.toFixed(1)),
    pauseCount: pauses.length,
    totalPauseS: Number(totalPauseS.toFixed(2)),
    longestPauseS: Number(longestPauseS.toFixed(2)),
    pauseRatio: Number((totalPauseS / spanS).toFixed(3)),
    fillerCount,
    fillersPerMin: Number(((fillerCount / spanS) * 60).toFixed(2)),
  };
}

// ─────────────────────────────────────────────
// AUDIO DECODE (ffmpeg-static → 16kHz mono f32le PCM)
// ─────────────────────────────────────────────

// ffmpeg-static's own entry point computes its bundled binary's path from
// its own __dirname at require-time. A static `import ffmpegPath from
// "ffmpeg-static"` lets Turbopack trace into and bundle that module into a
// server chunk — which changes what __dirname resolves to there, and on
// this project's Next 16/Turbopack production build has been observed to
// go further and rewrite the require into a hashed module id
// ("ffmpeg-static-<hash>") that doesn't exist in the deployed output at
// all, hard-crashing with "Cannot find module" (serverExternalPackages in
// next.config.ts was expected to prevent this but did not, in practice, on
// this setup). Resolving it via createRequire at the moment this function
// actually runs is a genuine dynamic call whose target Turbopack cannot
// see/rewrite at build time, so Node's real module resolution (against the
// real node_modules on disk) runs unmodified, exactly as it would outside
// any bundler.
let cachedFfmpegPath: string | null | undefined;

async function resolveFfmpegPath(): Promise<string | null> {
  if (cachedFfmpegPath !== undefined) {
    return cachedFfmpegPath;
  }

  try {
    const { createRequire } = await import("node:module");
    const runtimeRequire = createRequire(import.meta.url);
    const resolved = runtimeRequire("ffmpeg-static") as string | null;
    cachedFfmpegPath = resolved ?? null;
  } catch (error) {
    console.warn(
      "[deliveryScoring] Failed to resolve ffmpeg-static binary path:",
      error,
    );
    cachedFfmpegPath = null;
  }

  return cachedFfmpegPath;
}

/**
 * Decode any ffmpeg-readable input (webm/opus, m4a, wav, ...) to raw
 * 16kHz mono 32-bit float PCM samples — the format pitchy/pitchfinder/meyda
 * all expect. Uses the ffmpeg-static prebuilt binary via child_process, the
 * same approach the Python app used (its own ffmpeg dependency), just
 * bundled as an npm package instead of a system install — safe for a
 * zip-deploy host since it ships as a plain file inside node_modules.
 */
async function decodeToFloat32PCM(
  audioBuffer: Buffer,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const ffmpegPath = await resolveFfmpegPath();
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found");
  }

  const sampleRate = 16000;
  const os = await import("node:os");
  const path = await import("node:path");
  const fs = await import("node:fs/promises");

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `delivery-in-${randomUUID()}.bin`);
  const outputPath = path.join(tmpDir, `delivery-out-${randomUUID()}.f32le`);

  await fs.writeFile(inputPath, audioBuffer);
  try {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "f32le",
      outputPath,
    ]);

    const raw = await fs.readFile(outputPath);
    const samples = new Float32Array(
      raw.buffer,
      raw.byteOffset,
      raw.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    // Copy out of the shared buffer before the temp file's backing memory
    // is released, since raw.buffer may be reused/pooled by Node internals.
    return { samples: Float32Array.from(samples), sampleRate };
  } finally {
    await fs.rm(inputPath, { force: true });
    await fs.rm(outputPath, { force: true });
  }
}

// ─────────────────────────────────────────────
// PITCH (pitchy MPM + pitchfinder YIN cross-check)
// ─────────────────────────────────────────────

export interface PitchMetrics {
  pitchMeanHz: number;
  pitchDynamismSt: number;
  pitchRangeSt: number;
}

const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;
// Frames below this RMS are treated as silence and excluded from pitch
// tracking (autocorrelation-family trackers degrade badly on near-silence).
const SILENCE_RMS_THRESHOLD = 0.01;
// pitchy's clarity score (0-1): below this, the detected pitch for that
// frame is discarded as unreliable.
const MIN_CLARITY = 0.85;

function frameRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * Per-frame F0 extraction using pitchy (McLeod Pitch Method) as primary,
 * cross-validated against pitchfinder's YIN — frames where the two
 * disagree by more than a fifth of an octave are dropped as unreliable
 * rather than averaged, since a wrong-octave reading from either detector
 * would otherwise skew the dynamism/range stats.
 */
function extractPitchSeries(
  samples: Float32Array,
  sampleRate: number,
): number[] {
  const mpm = PitchDetector.forFloat32Array(FRAME_SIZE);
  const yin = Pitchfinder.YIN({ sampleRate });

  const hz: number[] = [];
  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    if (frameRMS(frame) < SILENCE_RMS_THRESHOLD) continue;

    const [mpmHz, clarity] = mpm.findPitch(frame, sampleRate);
    if (mpmHz <= 0 || clarity < MIN_CLARITY) continue;

    const yinHz = yin(frame);
    if (!yinHz || yinHz <= 0) continue;

    const octaveRatio = Math.max(mpmHz, yinHz) / Math.min(mpmHz, yinHz);
    if (octaveRatio > Math.pow(2, 1 / 5)) continue; // disagree by > ~1/5 octave

    hz.push(mpmHz);
  }
  return hz;
}

/**
 * Pitch dynamism/range in semitones relative to the ANSWER'S OWN median —
 * ports audio_analysis.py's normalization exactly (12 * log2(f/median)) so
 * a naturally low- or high-voiced speaker is never penalized for their
 * baseline pitch, only for how much it varies.
 */
export function computePitchMetrics(
  samples: Float32Array,
  sampleRate: number,
): PitchMetrics | null {
  const hz = extractPitchSeries(samples, sampleRate);
  if (hz.length < 6) return null; // not enough voiced signal to trust

  const sorted = [...hz].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median <= 0) return null;

  const semitones = hz.map((f) => 12 * Math.log2(f / median));
  const mean = semitones.reduce((s, v) => s + v, 0) / semitones.length;
  const variance =
    semitones.reduce((s, v) => s + (v - mean) ** 2, 0) / semitones.length;
  const dynamismSt = Math.sqrt(variance);

  const sortedSemis = [...semitones].sort((a, b) => a - b);
  const p5 = sortedSemis[Math.floor(sortedSemis.length * 0.05)];
  const p95 = sortedSemis[Math.floor(sortedSemis.length * 0.95)];

  return {
    pitchMeanHz: Number(
      (hz.reduce((s, v) => s + v, 0) / hz.length).toFixed(1),
    ),
    pitchDynamismSt: Number(dynamismSt.toFixed(3)),
    pitchRangeSt: Number((p95 - p5).toFixed(3)),
  };
}

// ─────────────────────────────────────────────
// LOUDNESS (meyda)
// ─────────────────────────────────────────────

export interface LoudnessMetrics {
  loudnessDbMean: number;
  loudnessVariationDb: number;
}

/**
 * RMS-derived dB per frame, keeping only frames within 25dB of the loudest
 * (matches audio_analysis.py's silence-filtering approach so lead-in/out
 * silence doesn't dominate the mean/variation stats).
 */
export function computeLoudnessMetrics(
  samples: Float32Array,
): LoudnessMetrics | null {
  const dbFrames: number[] = [];
  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    let rms: number;
    try {
      const features = Meyda.extract(["rms"], frame) as { rms?: number } | null;
      rms = features?.rms ?? frameRMS(frame);
    } catch {
      rms = frameRMS(frame);
    }
    if (rms <= 0) continue;
    dbFrames.push(20 * Math.log10(rms));
  }
  if (dbFrames.length === 0) return null;

  const peak = Math.max(...dbFrames);
  const speechFrames = dbFrames.filter((db) => db >= peak - 25);
  if (speechFrames.length < 3) return null;

  const mean =
    speechFrames.reduce((s, v) => s + v, 0) / speechFrames.length;
  const variance =
    speechFrames.reduce((s, v) => s + (v - mean) ** 2, 0) /
    speechFrames.length;

  return {
    loudnessDbMean: Number(mean.toFixed(1)),
    loudnessVariationDb: Number(Math.sqrt(variance).toFixed(3)),
  };
}

// ─────────────────────────────────────────────
// BANDING (1-5 scores) — ported from llm.py
// ─────────────────────────────────────────────

export interface DeliveryScores {
  pace: number;
  pausing: number;
  fluency: number;
  expressiveness: number;
}

function paceScore(wpm: number): number {
  if (wpm >= 120 && wpm <= 150) return 5;
  if ((wpm >= 105 && wpm < 120) || (wpm > 150 && wpm <= 165)) return 4;
  if ((wpm >= 90 && wpm < 105) || (wpm > 165 && wpm <= 180)) return 3;
  if ((wpm >= 75 && wpm < 90) || (wpm > 180 && wpm <= 200)) return 2;
  return 1;
}

function pausingScore(longestPauseS: number, pauseRatio: number): number {
  if (longestPauseS <= 1.2 && pauseRatio <= 0.2) return 5;
  if (longestPauseS <= 2.0 && pauseRatio <= 0.3) return 4;
  if (longestPauseS <= 3.0) return 3;
  if (longestPauseS <= 4.5) return 2;
  return 1;
}

function fillerComponent(fillersPerMin: number): number {
  if (fillersPerMin <= 1) return 5;
  if (fillersPerMin <= 3) return 4;
  if (fillersPerMin <= 5) return 3;
  if (fillersPerMin <= 8) return 2;
  return 1;
}

// Static default bands, ported directly from llm.py's _expressiveness_score.
// A calm/measured speaker (0.8-1.2st) is scored as fine, not penalized —
// only genuinely flat/robotic delivery scores low.
function expressivenessScoreStatic(dynamismSt: number): number {
  if (dynamismSt >= 1.8) return 5;
  if (dynamismSt >= 1.2) return 4;
  if (dynamismSt >= 0.8) return 3;
  if (dynamismSt >= 0.5) return 2;
  return 1;
}

/**
 * Population-relative banding: percentile cutoffs computed from this
 * module's own accumulated `interview_delivery_metrics` rows, so scoring
 * reflects this module's actual candidate population instead of thresholds
 * tuned against the Python app's original (different) sample set. Falls
 * back to the static bands until enough samples exist for the percentiles
 * to be meaningful.
 */
const MIN_SAMPLES_FOR_POPULATION_RELATIVE = 50;

async function expressivenessScorePopulationRelative(
  dynamismSt: number,
  moduleId: string,
): Promise<number> {
  const rows = await db
    .select({ dynamism: interviewDeliveryMetrics.pitchDynamismSt })
    .from(interviewDeliveryMetrics)
    .innerJoin(
      candidateInterviewAnswers,
      eq(candidateInterviewAnswers.id, interviewDeliveryMetrics.answerId),
    )
    .innerJoin(
      candidateInterviewSessions,
      eq(
        candidateInterviewSessions.id,
        candidateInterviewAnswers.sessionId,
      ),
    )
    .where(eq(candidateInterviewSessions.moduleId, moduleId));

  const values = rows
    .map((r) => (r.dynamism !== null ? Number(r.dynamism) : null))
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);

  if (values.length < MIN_SAMPLES_FOR_POPULATION_RELATIVE) {
    return expressivenessScoreStatic(dynamismSt);
  }

  const percentile =
    values.filter((v) => v <= dynamismSt).length / values.length;
  if (percentile >= 0.8) return 5;
  if (percentile >= 0.6) return 4;
  if (percentile >= 0.4) return 3;
  if (percentile >= 0.2) return 2;
  return 1;
}

// ─────────────────────────────────────────────
// ORCHESTRATION
// ─────────────────────────────────────────────

export interface DeliveryScoringInput {
  answerId: string;
  moduleId: string;
  audioBuffer: Buffer;
  words: TranscriptWordTiming[] | undefined;
}

/**
 * Runs the full delivery-scoring pipeline for one answer and persists the
 * result to interview_delivery_metrics. Call ONLY after confirming the
 * session's module has the delivery_scoring capability enabled — this
 * function does not re-check that itself, since callers (the transcription
 * job handler) already resolve the capability once and branch on it before
 * ever reaching this file.
 */
export async function scoreAndPersistDelivery(
  input: DeliveryScoringInput,
): Promise<void> {
  const { answerId, moduleId, audioBuffer, words } = input;

  const pace = words ? computePaceMetrics(words) : null;

  let pitch: PitchMetrics | null = null;
  let loudness: LoudnessMetrics | null = null;
  try {
    const { samples, sampleRate } = await decodeToFloat32PCM(audioBuffer);
    pitch = computePitchMetrics(samples, sampleRate);
    loudness = computeLoudnessMetrics(samples);
  } catch (err) {
    console.warn(
      `[deliveryScoring] Acoustic decode/analysis failed for answer ${answerId}, continuing with pace-only metrics:`,
      err,
    );
  }

  const deliveryCapability = await getModuleCapability(
    moduleId,
    CAPABILITY_KEYS.DELIVERY_SCORING,
  );
  const calibrationMode: CalibrationMode =
    (deliveryCapability.config as { calibrationMode?: CalibrationMode })
      .calibrationMode ?? "static";

  const scores: DeliveryScores = {
    pace: pace ? paceScore(pace.wpm) : 3,
    pausing: pace ? pausingScore(pace.longestPauseS, pace.pauseRatio) : 3,
    fluency: pace ? fillerComponent(pace.fillersPerMin) : 3,
    expressiveness: pitch
      ? calibrationMode === "population-relative"
        ? await expressivenessScorePopulationRelative(
            pitch.pitchDynamismSt,
            moduleId,
          )
        : expressivenessScoreStatic(pitch.pitchDynamismSt)
      : 3,
  };

  const deliveryOverall =
    (scores.pace + scores.pausing + scores.fluency + scores.expressiveness) /
    4;

  const [existing] = await db
    .select({ id: interviewDeliveryMetrics.id })
    .from(interviewDeliveryMetrics)
    .where(eq(interviewDeliveryMetrics.answerId, answerId))
    .limit(1);

  const values = {
    wpm: pace ? String(pace.wpm) : null,
    pauseCount: pace?.pauseCount ?? null,
    totalPauseS: pace ? String(pace.totalPauseS) : null,
    longestPauseS: pace ? String(pace.longestPauseS) : null,
    pauseRatio: pace ? String(pace.pauseRatio) : null,
    fillerCount: pace?.fillerCount ?? null,
    fillersPerMin: pace ? String(pace.fillersPerMin) : null,
    pitchMeanHz: pitch ? String(pitch.pitchMeanHz) : null,
    pitchDynamismSt: pitch ? String(pitch.pitchDynamismSt) : null,
    pitchRangeSt: pitch ? String(pitch.pitchRangeSt) : null,
    loudnessDbMean: loudness ? String(loudness.loudnessDbMean) : null,
    loudnessVariationDb: loudness
      ? String(loudness.loudnessVariationDb)
      : null,
    deliveryScores: scores,
    deliveryOverall: deliveryOverall.toFixed(1),
    calibrationMode,
  };

  if (existing) {
    await db
      .update(interviewDeliveryMetrics)
      .set(values)
      .where(eq(interviewDeliveryMetrics.id, existing.id));
  } else {
    await db.insert(interviewDeliveryMetrics).values({
      id: randomUUID(),
      answerId,
      ...values,
    });
  }
}
