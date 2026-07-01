/**
 * Interview AI Services Layer
 *
 * OpenAI API integration with:
 * - Transcription (Whisper)
 * - Structured evaluation (GPT-4)
 * - Session summary (GPT-4o-mini)
 * - Retry logic + error handling
 * - Cost tracking
 */

import { AIEvaluationStructured, TokenUsage } from "@/types/interview";
import { DeepgramClient } from "@deepgram/sdk";
import { OpenAI } from "openai";
import {
  calculateBackoffDelay,
  EvaluationError,
  parseOpenAIError,
  TranscriptionError,
  validateEvaluationStructure,
} from "./errors";
import { INTERVIEW_CONFIG } from "./jobConstants";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OPENAI CLIENT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Lazily construct the OpenAI client. Constructing eagerly at module load
// throws when OPENAI_API_KEY is unset, which would break the Next.js build's
// page-data collection step even for routes that never call OpenAI.
let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openaiClient;
}

function getDeepgramApiKey(): string | null {
  const raw = process.env.DEEPGRAM_API_KEY;
  if (typeof raw !== "string") {
    return null;
  }

  // Trim whitespace and optional surrounding quotes that can appear in env files.
  const cleaned = raw
    .trim()
    .replace(/^['\"]|['\"]$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TRANSCRIPTION SERVICE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TranscriptionResult {
  text: string;
  language: string;
  provider: "deepgram" | "openai";
  confidence?: number;
  tokensUsed?: number;
  rawResponse: unknown;
}

type DeepgramWord = {
  word?: string;
  punctuated_word?: string;
  start?: number;
  end?: number;
  confidence?: number;
  language?: string;
};

function buildTranscriptFromDeepgramWords(words: DeepgramWord[]): string {
  if (words.length === 0) {
    return "";
  }

  const transcriptParts: string[] = [];
  let previousEnd: number | null = null;

  for (const item of words) {
    const token =
      typeof item.word === "string" && item.word.trim().length > 0
        ? item.word.trim()
        : typeof item.punctuated_word === "string" &&
            item.punctuated_word.trim().length > 0
          ? item.punctuated_word.trim()
          : "";

    if (!token) {
      continue;
    }

    if (
      previousEnd !== null &&
      typeof item.start === "number" &&
      item.start - previousEnd >= 0.75
    ) {
      transcriptParts.push("[pause]");
    }

    transcriptParts.push(token);

    previousEnd = typeof item.end === "number" ? item.end : previousEnd;
  }

  return transcriptParts.join(" ").replace(/\s+/g, " ").trim();
}

function detectDeepgramLanguage(
  words: DeepgramWord[],
  languageCandidates?: string[],
  fallbackLanguage?: string,
): string {
  const languages = Array.from(
    new Set(
      [
        ...words.map((item) =>
          typeof item.language === "string" ? item.language.trim() : "",
        ),
        ...(languageCandidates ?? []).map((item) => item.trim()),
      ].filter((item) => item.length > 0),
    ),
  );

  if (languages.length > 0) {
    return languages.join(",");
  }

  return fallbackLanguage ?? "und";
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEEPGRAM TRANSCRIPTION PROVIDER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Transcribe audio using Deepgram Nova-3.
 *
 * Advantages over hosted Whisper for interview audio:
 * - No hallucination on silence/noise (VAD-gated internally)
 * - Preserves filler words, disfluencies, code-switching
 * - Supports multilingual code-switching with per-word language metadata
 * - Returns per-word confidence scores
 */
async function transcribeWithDeepgram(
  audioBuffer: Buffer,
  answerId: string,
  attempt: number,
): Promise<TranscriptionResult> {
  const apiKey = getDeepgramApiKey();
  if (!apiKey)
    throw new TranscriptionError(
      answerId,
      attempt,
      "DEEPGRAM_API_KEY not set",
      false,
    );

  // Deepgram v5 SDK: constructor takes { apiKey } object
  const deepgram = new DeepgramClient({ apiKey });

  // v5 transcribeFile returns the response body directly â€” no { result, error } wrapper
  let rawData: unknown;
  try {
    rawData = await deepgram.listen.v1.media.transcribeFile(audioBuffer, {
      model: "nova-3",
      language: "multi",
      smart_format: false, // no capitalisation / number reformatting
      punctuate: false, // no added punctuation
      filler_words: true, // preserve uh, um, ah, you know
      utterances: true,
    });
  } catch (err) {
    throw new TranscriptionError(
      answerId,
      attempt,
      `Deepgram error: ${err instanceof Error ? err.message : String(err)}`,
      true,
    );
  }

  type DGResponse = {
    results?: {
      channels?: Array<{
        detected_language?: string;
        alternatives?: Array<{
          transcript?: string;
          confidence?: number;
          languages?: string[];
          words?: DeepgramWord[];
        }>;
      }>;
    };
  };
  const dgData = rawData as DGResponse;
  const channel = dgData?.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const wordLevelTranscript = buildTranscriptFromDeepgramWords(
    alternative?.words ?? [],
  );
  const transcriptText =
    wordLevelTranscript || alternative?.transcript?.trim() || "";

  if (!transcriptText) {
    throw new TranscriptionError(
      answerId,
      attempt,
      "Deepgram returned empty transcript",
      true,
    );
  }

  return {
    text: transcriptText,
    language: detectDeepgramLanguage(
      alternative?.words ?? [],
      alternative?.languages,
      channel?.detected_language,
    ),
    provider: "deepgram",
    confidence: alternative?.confidence,
    rawResponse: rawData,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OPENAI WHISPER TRANSCRIPTION PROVIDER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Transcribe audio using OpenAI Whisper (verbose_json).
 * Keeps raw segmented transcript text by default to preserve multilingual and low-volume speech.
 */
async function transcribeWithWhisper(
  audioBuffer: Buffer,
  answerId: string,
  attempt: number,
  language?: string,
): Promise<TranscriptionResult> {
  const audioFile = new File([new Uint8Array(audioBuffer)], "audio.wav", {
    type: "audio/wav",
  });

  const transcriptionPrompt =
    "Transcribe this audio as strictly verbatim as possible. Preserve filler words like ah, uh, um, repeated words, false starts, pauses as [pause], stutters, and code-switching/mixed-language words. Do not correct grammar, pronunciation, or wording.";

  const response = await getOpenAIClient().audio.transcriptions.create({
    file: audioFile,
    model: INTERVIEW_CONFIG.OPENAI_TRANSCRIPTION_MODEL,
    ...(language ? { language } : {}),
    temperature: 0,
    response_format: "verbose_json",
    prompt: transcriptionPrompt,
  });

  const rawResponse = response as {
    text?: string;
    language?: string;
    segments?: Array<{ text: string; no_speech_prob?: number }>;
  };

  // Opt-in legacy silence filtering. Keep disabled by default for raw transcript fidelity.
  const shouldFilterNoSpeech = process.env.WHISPER_FILTER_NO_SPEECH === "true";

  const allSegments = rawResponse.segments ?? [];
  const selectedSegments = shouldFilterNoSpeech
    ? allSegments.filter((seg) => (seg.no_speech_prob ?? 0) < 0.5)
    : allSegments;

  let transcriptText: string;
  if (allSegments.length > 0) {
    transcriptText = selectedSegments
      .map((seg) => seg.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } else {
    transcriptText =
      typeof rawResponse.text === "string" ? rawResponse.text.trim() : "";
  }

  if (!transcriptText) {
    throw new TranscriptionError(
      answerId,
      attempt,
      "Transcription returned empty text",
      true,
    );
  }

  const detectedLanguage =
    typeof rawResponse.language === "string"
      ? rawResponse.language
      : language || "und";

  return {
    text: transcriptText,
    language: detectedLanguage,
    provider: "openai",
    confidence: undefined,
    rawResponse: response,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TRANSCRIPTION ROUTER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Transcribe interview audio.
 *
 * Provider selection (checked in order):
 * 1. TRANSCRIPTION_PROVIDER=openai  â†’ Whisper only
 * 2. DEEPGRAM_API_KEY present        â†’ Deepgram Nova-3 (primary) with Whisper fallback
 * 3. fallback                        â†’ Whisper only
 *
 * Retry logic: up to 3 attempts with exponential backoff.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  answerId: string,
  language?: string,
  attempt: number = 0,
): Promise<TranscriptionResult> {
  const MAX_ATTEMPTS = 3;

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new TranscriptionError(
      answerId,
      attempt,
      "Audio buffer is empty",
      false,
    );
  }

  const forceOpenAI = process.env.TRANSCRIPTION_PROVIDER === "openai";
  const hasDeepgram = !!getDeepgramApiKey() && !forceOpenAI;

  try {
    if (hasDeepgram) {
      try {
        return await transcribeWithDeepgram(audioBuffer, answerId, attempt);
      } catch (deepgramError) {
        // If Deepgram fails, log and fall through to Whisper
        const msg =
          deepgramError instanceof Error
            ? deepgramError.message
            : String(deepgramError);
        console.warn(
          `[Transcription] Deepgram failed (attempt ${attempt}), falling back to Whisper: ${msg}`,
        );
        return await transcribeWithWhisper(
          audioBuffer,
          answerId,
          attempt,
          language,
        );
      }
    }

    return await transcribeWithWhisper(
      audioBuffer,
      answerId,
      attempt,
      language,
    );
  } catch (error) {
    const { message, retriable } = parseOpenAIError(error);

    if (retriable && attempt < MAX_ATTEMPTS - 1) {
      const delay = calculateBackoffDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return transcribeAudio(audioBuffer, answerId, language, attempt + 1);
    }

    throw new TranscriptionError(
      answerId,
      attempt,
      `Transcription failed: ${message}`,
      false,
    );
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EVALUATION SERVICE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface EvaluationResult {
  evaluation: AIEvaluationStructured;
  tokensUsed: TokenUsage;
  rawResponse: unknown;
  modelUsed: string;
}

export interface EvaluationPromptOptions {
  moduleTitle?: string;
  standardResponses?: string[];
  scoringWeights?: Record<string, number>;
}

const DEFAULT_SCORING_WEIGHTS: Record<string, number> = {
  courtesy: 0.2,
  empathy: 0.2,
  professionalism_and_tone: 0.2,
  communication_clarity: 0.2,
  engagement_and_problem_handling: 0.2,
};

/**
 * Build evaluation prompt with structured output schema
 */
function buildEvaluationPrompt(
  transcript: string,
  questionText: string,
  options: EvaluationPromptOptions = {},
): { systemPrompt: string; userMessage: string } {
  const moduleTitle = options.moduleTitle?.trim() || "Customer Service";
  const standardResponses =
    options.standardResponses
      ?.map((item) => item.trim())
      .filter((item) => item.length > 0) ?? [];
  const scoringWeights = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...(options.scoringWeights ?? {}),
  };

  const systemPrompt = `You are evaluating a candidate's verbal response to a customer service scenario in the module "${moduleTitle}".

Be strict about accuracy, but fair about intent. Judge what the candidate actually said in the transcript, including wording mistakes, weak vocabulary, awkward phrasing, missing empathy, and incomplete handling steps. Do not invent details that are not in the transcript.

If the candidate makes language, wording, grammar, or vocabulary mistakes that affect professionalism or clarity, reflect that in communication_clarity, professionalism_and_tone, and improvement_areas. If the answer is generic, evasive, or does not address the scenario directly, reduce engagement_and_problem_handling accordingly.

Return ONLY a valid JSON object. No markdown, no explanation outside JSON.`;

  const userMessage = `â”€â”€â”€ SCENARIO / QUESTION â”€â”€â”€
${questionText}

â”€â”€â”€ CANDIDATE'S RESPONSE (transcribed) â”€â”€â”€
${transcript}

â”€â”€â”€ STANDARD REFERENCE RESPONSES â”€â”€â”€
${standardResponses.length > 0 ? standardResponses.map((item, index) => `${index + 1}. ${item}`).join("\n") : "No standard responses were configured for this question."}

â”€â”€â”€ SCORING WEIGHTS â”€â”€â”€
${JSON.stringify(scoringWeights, null, 2)}

â”€â”€â”€ EVALUATION RUBRIC â”€â”€â”€

Rate the candidate's response on each dimension using a 0-10 scale. Apply the scoring weights above to calculate total_score as a weighted average normalized to a 0-1 scale.

Dimensions:
1. Courtesy â€” Politeness, professional greeting, willingness to help.
2. Empathy â€” Understanding the customer's frustration and acknowledging their feelings.
3. Professionalism and Tone â€” Respectful, calm, professional delivery that maintains credibility.
4. Communication Clarity â€” Clear language, avoidance of jargon, logical structure.
5. Engagement and Problem Handling â€” Active listening, clarifying questions, ownership, and concrete next steps.

â”€â”€â”€ SCORING GUIDELINES â”€â”€â”€
- 0-2: Very poor â€” rude, dismissive, or completely off-topic.
- 3-4: Below average â€” minimal effort, lacks empathy or clarity.
- 5-6: Average â€” acceptable but generic, room for improvement.
- 7-8: Good â€” genuine empathy, clear communication, helpful approach.
- 9-10: Excellent â€” outstanding empathy, proactive ownership, clear and warm.

Be fair and balanced. Give credit for genuine effort, empathy, and willingness to help even if the response is not perfectly structured. Be constructive in your feedback.

â”€â”€â”€ REQUIRED JSON OUTPUT â”€â”€â”€

Return ONLY a valid JSON object with this structure:

{
  "total_score": 0.0,
  "dimensions": {
    "courtesy": {
      "score": 0.0,
      "reason": "brief rationale"
    },
    "empathy": {
      "score": 0.0,
      "reason": "brief rationale"
    },
    "professionalism_and_tone": {
      "score": 0.0,
      "reason": "brief rationale"
    },
    "communication_clarity": {
      "score": 0.0,
      "reason": "brief rationale"
    },
    "engagement_and_problem_handling": {
      "score": 0.0,
      "reason": "brief rationale"
    }
  },
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvement_areas": ["specific area 1", "specific area 2"],
  "final_summary": "A 2-3 sentence constructive summary of the candidate's performance."
}`;

  return { systemPrompt, userMessage };
}

const EVALUATION_DIMENSIONS = [
  "courtesy",
  "empathy",
  "professionalism_and_tone",
  "communication_clarity",
  "engagement_and_problem_handling",
] as const;

function isSchemaCapableEvaluationModel(modelName: string): boolean {
  return (
    /^gpt-4o/i.test(modelName) ||
    /^gpt-4\.1/i.test(modelName) ||
    /^o[134]/i.test(modelName) ||
    /^gpt-5/i.test(modelName)
  );
}

function resolveEvaluationModel(): {
  modelName: string;
  forcedFallback: boolean;
} {
  const configuredModel = INTERVIEW_CONFIG.OPENAI_EVALUATION_MODEL;

  if (isSchemaCapableEvaluationModel(configuredModel)) {
    return {
      modelName: configuredModel,
      forcedFallback: false,
    };
  }

  return {
    modelName: "gpt-4o-mini",
    forcedFallback: configuredModel !== "gpt-4o-mini",
  };
}

const EVALUATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "total_score",
    "dimensions",
    "strengths",
    "improvement_areas",
    "final_summary",
  ],
  properties: {
    total_score: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: EVALUATION_DIMENSIONS,
      properties: {
        courtesy: {
          type: "object",
          additionalProperties: false,
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 10 },
            reason: { type: "string" },
          },
        },
        empathy: {
          type: "object",
          additionalProperties: false,
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 10 },
            reason: { type: "string" },
          },
        },
        professionalism_and_tone: {
          type: "object",
          additionalProperties: false,
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 10 },
            reason: { type: "string" },
          },
        },
        communication_clarity: {
          type: "object",
          additionalProperties: false,
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 10 },
            reason: { type: "string" },
          },
        },
        engagement_and_problem_handling: {
          type: "object",
          additionalProperties: false,
          required: ["score", "reason"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 10 },
            reason: { type: "string" },
          },
        },
      },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    improvement_areas: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    final_summary: { type: "string", minLength: 1 },
  },
};

const EVALUATION_DIMENSION_ALIASES: Record<string, string> = {
  professionalismandtone: "professionalism_and_tone",
  professionalism_and_tone: "professionalism_and_tone",
  "professionalism and tone": "professionalism_and_tone",
  communicationclarity: "communication_clarity",
  communication_clarity: "communication_clarity",
  "communication clarity": "communication_clarity",
  respect: "professionalism_and_tone",
  tone: "professionalism_and_tone",
  engagementandproblemhandling: "engagement_and_problem_handling",
  engagement_and_problem_handling: "engagement_and_problem_handling",
  "engagement and problem handling": "engagement_and_problem_handling",
  engagement: "engagement_and_problem_handling",
  problemhandling: "engagement_and_problem_handling",
  problem_handling: "engagement_and_problem_handling",
  "problem handling": "engagement_and_problem_handling",
  problem_handling_approach: "engagement_and_problem_handling",
  "problem handling approach": "engagement_and_problem_handling",
};

type CanonicalEvaluationDimension = (typeof EVALUATION_DIMENSIONS)[number];

type DimensionCandidate = {
  score: number | null;
  reason: string;
};

const LEGACY_DIMENSION_GROUPS: Record<CanonicalEvaluationDimension, string[]> =
  {
    courtesy: ["courtesy"],
    empathy: ["empathy"],
    professionalism_and_tone: [
      "professionalism_and_tone",
      "professionalism and tone",
      "respect",
      "tone",
    ],
    communication_clarity: [
      "communication_clarity",
      "communication clarity",
      "communicationclarity",
    ],
    engagement_and_problem_handling: [
      "engagement_and_problem_handling",
      "engagement and problem handling",
      "engagement",
      "problem_handling",
      "problem handling",
      "problem_handling_approach",
      "problem handling approach",
      "problemhandling",
    ],
  };

function extractLikelyJson(content: string): unknown {
  const trimmed = content.trim();

  const tryParse = (candidate: string) => {
    const normalized = candidate
      .replace(/[\u0000-\u0019]+/g, " ")
      .replace(/[â€œâ€]/g, '"')
      .replace(/[â€˜â€™]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(normalized);
  };

  const extractBalancedObjects = (source: string): string[] => {
    const results: string[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") {
        if (depth === 0) {
          start = i;
        }
        depth += 1;
        continue;
      }

      if (ch === "}" && depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          results.push(source.slice(start, i + 1));
          start = -1;
        }
      }
    }

    return results;
  };

  try {
    return tryParse(trimmed);
  } catch {
    // Fall through to repair attempts below
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return tryParse(fencedMatch[1]);
    } catch {
      // Fall through to object substring parse
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);

    try {
      return tryParse(candidate);
    } catch {
      // Fall through to balanced object attempts below.
    }
  }

  for (const candidate of extractBalancedObjects(trimmed)) {
    try {
      return tryParse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("Response does not contain valid JSON");
}

function normalizeScore(value: unknown, max: number): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(max, num));
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|,|;|\u2022|\-/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function toDimensionCandidate(
  alias: string,
  value: unknown,
): DimensionCandidate | null {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const score = normalizeScore(record.score, 10);
    const reason =
      typeof record.reason === "string" ? record.reason.trim() : "";

    if (score === null && !reason) {
      return null;
    }

    return {
      score,
      reason: reason || `Mapped from ${alias}`,
    };
  }

  if (typeof value === "number" || typeof value === "string") {
    return {
      score: normalizeScore(value, 10),
      reason: `Mapped from ${alias}`,
    };
  }

  return null;
}

function buildNormalizedDimension(
  key: CanonicalEvaluationDimension,
  source: Record<string, unknown>,
) {
  const aliases = Array.from(
    new Set([
      key,
      key.replace(/_/g, " "),
      key.replace(/_/g, ""),
      ...LEGACY_DIMENSION_GROUPS[key],
      ...Object.keys(EVALUATION_DIMENSION_ALIASES).filter(
        (alias) => EVALUATION_DIMENSION_ALIASES[alias] === key,
      ),
    ]),
  );

  const candidates = aliases
    .map((alias) => toDimensionCandidate(alias, source[alias]))
    .filter((candidate): candidate is DimensionCandidate => candidate !== null);

  if (candidates.length === 0) {
    return null;
  }

  const scores = candidates
    .map((candidate) => candidate.score)
    .filter((score): score is number => score !== null);
  const reasons = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.reason.trim())
        .filter((reason) => reason.length > 0),
    ),
  );

  if (scores.length === 0) {
    return null;
  }

  return {
    score: Number(
      (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(
        2,
      ),
    ),
    reason: reasons.join(" ") || "No reason provided",
  };
}

function normalizeEvaluationPayload(
  data: unknown,
): AIEvaluationStructured | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const dimensionsInput = (() => {
    if (record.dimensions && typeof record.dimensions === "object") {
      return record.dimensions as Record<string, unknown>;
    }

    const sentiment =
      record.sentiment_breakdown &&
      typeof record.sentiment_breakdown === "object"
        ? (record.sentiment_breakdown as Record<string, unknown>)
        : {};
    const handling =
      record.handling_breakdown && typeof record.handling_breakdown === "object"
        ? (record.handling_breakdown as Record<string, unknown>)
        : {};

    const merged = { ...sentiment, ...handling };
    return Object.keys(merged).length > 0 ? merged : null;
  })();

  if (!dimensionsInput) {
    return null;
  }

  const normalizedDimensions = {} as AIEvaluationStructured["dimensions"];

  for (const key of EVALUATION_DIMENSIONS) {
    const normalizedDimension = buildNormalizedDimension(key, dimensionsInput);

    if (!normalizedDimension) {
      return null;
    }

    normalizedDimensions[key] = normalizedDimension;
  }

  const weightedFromDimensions = Number(
    EVALUATION_DIMENSIONS.reduce((sum, key) => {
      return sum + (normalizedDimensions[key].score / 10) * 0.2;
    }, 0).toFixed(4),
  );

  const totalScore =
    normalizeScore(record.total_score, 1) ?? weightedFromDimensions;
  if (totalScore === null) {
    return null;
  }

  const strengths = normalizeStringList(record.strengths);
  const improvementAreas = normalizeStringList(record.improvement_areas);
  const finalSummary =
    typeof record.final_summary === "string" ? record.final_summary.trim() : "";

  if (!finalSummary) {
    return null;
  }

  return {
    total_score: totalScore,
    dimensions: normalizedDimensions,
    strengths: strengths.length > 0 ? strengths : ["Needs manual review"],
    improvement_areas:
      improvementAreas.length > 0 ? improvementAreas : ["Needs manual review"],
    final_summary: finalSummary,
    evaluation_source: "ai",
    validation_status: "valid",
  };
}

function buildFallbackEvaluation(
  transcript: string,
  questionText: string,
  reason: string,
): AIEvaluationStructured {
  const clippedQuestion = questionText.trim().slice(0, 120);
  const baselineScore = 0.5;

  const dimension = {
    score: 5,
    reason,
  };

  return {
    total_score: baselineScore,
    dimensions: {
      courtesy: dimension,
      empathy: dimension,
      professionalism_and_tone: dimension,
      communication_clarity: dimension,
      engagement_and_problem_handling: dimension,
    },
    strengths: [
      "Candidate provided a response relevant to the prompt",
      "Response was captured successfully for review",
    ],
    improvement_areas: [
      "Requires manual evaluator verification",
      "AI output format failed structured validation",
    ],
    final_summary: `Automated fallback evaluation was applied for question: "${clippedQuestion}" due to repeated invalid AI response format. Manual review is recommended.`,
    evaluation_source: "fallback",
    validation_status: "invalid_json",
  };
}

/**
 * Evaluate candidate answer using OpenAI
 *
 * Returns structured evaluation + token usage for cost tracking
 * Retries on failure with exponential backoff
 */
export async function evaluateAnswer(
  transcript: string,
  questionText: string,
  answerId: string,
  options: EvaluationPromptOptions = {},
  attempt: number = 0,
): Promise<EvaluationResult> {
  const MAX_ATTEMPTS = INTERVIEW_CONFIG.EVALUATION_INTERNAL_MAX_ATTEMPTS;
  const { modelName, forcedFallback } = resolveEvaluationModel();

  try {
    // Validate inputs
    if (!transcript || transcript.trim().length === 0) {
      throw new EvaluationError(
        answerId,
        attempt,
        "Transcript is empty",
        false, // Non-retriable
      );
    }

    const { systemPrompt, userMessage } = buildEvaluationPrompt(
      transcript,
      questionText,
      options,
    );
    if (forcedFallback) {
      console.warn(
        `[InterviewEvaluation] Configured model "${INTERVIEW_CONFIG.OPENAI_EVALUATION_MODEL}" does not support strict JSON schema reliably. Falling back to "${modelName}" for structured evaluation.`,
      );
    }

    const responseFormat = isSchemaCapableEvaluationModel(modelName)
      ? {
          type: "json_schema",
          json_schema: {
            name: "interview_evaluation",
            strict: true,
            schema: EVALUATION_JSON_SCHEMA,
          },
        }
      : {
          type: "json_object",
        };

    // Call a schema-capable model with structured output.
    const response = await getOpenAIClient().chat.completions.create(
      {
        model: modelName,
        temperature: INTERVIEW_CONFIG.EVALUATION_TEMPERATURE, // 0 = deterministic
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        response_format: responseFormat as never,
        max_tokens: INTERVIEW_CONFIG.OPENAI_EVALUATION_MAX_TOKENS,
      },
      {
        timeout: INTERVIEW_CONFIG.OPENAI_EVALUATION_TIMEOUT_MS,
      },
    );

    // Parse response
    if (
      !response.choices ||
      response.choices.length === 0 ||
      !response.choices[0].message.content
    ) {
      throw new EvaluationError(
        answerId,
        attempt,
        "Empty response from OpenAI",
        true, // Retriable
      );
    }

    const content = response.choices[0].message.content;
    let parsed: unknown;
    try {
      parsed = extractLikelyJson(content);
    } catch (parseError) {
      throw new EvaluationError(
        answerId,
        attempt,
        `Invalid evaluation payload format: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        true,
      );
    }

    const normalized = normalizeEvaluationPayload(parsed);

    if (!normalized) {
      throw new EvaluationError(
        answerId,
        attempt,
        "Invalid evaluation payload format",
        true,
      );
    }

    // Validate structure
    const { valid, errors } = validateEvaluationStructure(normalized);
    if (!valid) {
      throw new EvaluationError(
        answerId,
        attempt,
        `Invalid evaluation structure: ${errors.join(", ")}`,
        true,
      );
    }

    // Extract token usage
    const tokensUsed: TokenUsage = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    };

    return {
      evaluation: normalized,
      tokensUsed,
      rawResponse: response,
      modelUsed: modelName,
    };
  } catch (error) {
    if (error instanceof EvaluationError) {
      if (error.retriable && attempt < MAX_ATTEMPTS - 1) {
        const delay = calculateBackoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return evaluateAnswer(
          transcript,
          questionText,
          answerId,
          options,
          attempt + 1,
        );
      }

      const canFallback =
        error.message.includes("Invalid evaluation structure") ||
        error.message.includes("Invalid evaluation payload format") ||
        error.message.includes("Empty response from OpenAI");

      if (canFallback) {
        return {
          evaluation: buildFallbackEvaluation(
            transcript,
            questionText,
            error.message,
          ),
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          rawResponse: {
            fallback: true,
            reason: error.message,
            attempt,
            evaluation_source: "fallback",
            validation_status: "invalid_json",
          },
          modelUsed: modelName,
        };
      }

      throw error;
    }

    // Handle OpenAI errors
    const { message, retriable } = parseOpenAIError(error);

    // Retry logic
    if (retriable && attempt < MAX_ATTEMPTS - 1) {
      const delay = calculateBackoffDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return evaluateAnswer(
        transcript,
        questionText,
        answerId,
        options,
        attempt + 1,
      );
    }

    // Failed after all retries
    throw new EvaluationError(
      answerId,
      attempt,
      `Evaluation failed: ${message}`,
      false,
    );
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SESSION SUMMARY SERVICE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SummaryResult {
  strengths: string[];
  improvementAreas: string[];
  summary: string;
  tokensUsed: TokenUsage;
}

/**
 * Generate session-level summary from all evaluations
 */
export async function generateSessionSummary(
  allEvaluations: AIEvaluationStructured[],
  sessionId: string,
): Promise<SummaryResult> {
  try {
    void sessionId;

    if (!allEvaluations || allEvaluations.length === 0) {
      throw new Error("No evaluations provided for summary");
    }

    // Aggregate strengths and improvement areas
    const aggregatedStrengths: Record<string, number> = {};
    const aggregatedImprovements: Record<string, number> = {};

    for (const evaluation of allEvaluations) {
      evaluation.strengths.forEach((strength) => {
        aggregatedStrengths[strength] =
          (aggregatedStrengths[strength] || 0) + 1;
      });
      evaluation.improvement_areas.forEach((area) => {
        aggregatedImprovements[area] = (aggregatedImprovements[area] || 0) + 1;
      });
    }

    // Get top 3 in each category
    const topStrengths = Object.entries(aggregatedStrengths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([strength]) => strength);

    const topImprovements = Object.entries(aggregatedImprovements)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([area]) => area);

    // Calculate average score
    const avgScore =
      allEvaluations.reduce((sum, e) => sum + e.total_score, 0) /
      allEvaluations.length;

    // Generate summary text
    const summaryPrompt = `Based on the following interview evaluation data, provide a 2-3 sentence professional summary:
  - Overall performance: ${(avgScore * 100).toFixed(1)}/100
- Top strengths: ${topStrengths.join(", ")}
- Areas for improvement: ${topImprovements.join(", ")}

Provide a concise, constructive summary suitable for a performance review.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini", // Faster + cheaper for summary
      temperature: 0.3, // Slightly creative but consistent
      messages: [
        {
          role: "user",
          content: summaryPrompt,
        },
      ],
      max_tokens: 150,
    });

    const summaryText =
      response.choices[0]?.message.content || "Session completed successfully.";

    return {
      strengths: topStrengths,
      improvementAreas: topImprovements,
      summary: summaryText,
      tokensUsed: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    console.error("Summary generation error:", error);
    // Return fallback summary on error
    return {
      strengths: [],
      improvementAreas: [],
      summary: "Session completed. Review individual evaluations for details.",
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
    };
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// COST TRACKING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calculate cost for OpenAI API calls
 *
 * Pricing (as of 2024):
 * - Whisper: $0.02 per minute of audio
 * - GPT-4 Turbo: $0.01/1K prompt tokens, $0.03/1K completion tokens
 * - GPT-4o-mini: $0.15/1M prompt tokens, $0.60/1M completion tokens
 */
export function calculateCost(
  model: string,
  tokensUsed?: TokenUsage,
  audioMinutes?: number,
): number {
  let cost = 0;

  if (model === "whisper-1" && audioMinutes) {
    cost += audioMinutes * 0.02;
  }

  if (model === "gpt-4-turbo" && tokensUsed) {
    cost += (tokensUsed.prompt / 1000) * 0.01;
    cost += (tokensUsed.completion / 1000) * 0.03;
  }

  if (model === "gpt-4o-mini" && tokensUsed) {
    cost += (tokensUsed.prompt / 1_000_000) * 0.15;
    cost += (tokensUsed.completion / 1_000_000) * 0.6;
  }

  return parseFloat(cost.toFixed(6)); // 6 decimal places for USD
}

/**
 * Track token usage for billing + analytics
 */
export async function trackTokenUsage(
  sessionId: string,
  model: string,
  tokensUsed: TokenUsage,
): Promise<void> {
  const cost = calculateCost(model, tokensUsed);

  // TODO: Store in database for analytics
  console.log(
    `[TokenUsage] Session: ${sessionId}, Model: ${model}, Tokens: ${tokensUsed.total}, Cost: $${cost.toFixed(6)}`,
  );
}
