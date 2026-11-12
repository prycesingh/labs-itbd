/**
 * Question prompt audio: find questions whose audio is missing and
 * regenerate it with OpenAI text-to-speech.
 *
 * Why this runs on the server (as a background job) rather than as a local
 * script: prompt MP3s live in the app server's upload storage, while the
 * database is shared. The original generator
 * (scripts/generate-interview-coach-prompt-audio.ts) wrote files to the disk
 * of whichever machine ran it but stored the paths in the shared DB, so
 * every other environment 404'd on them — the "question audio shows 0:00"
 * bug. Generating inside the app guarantees the file lands where the app
 * serves it from.
 *
 * "Needs audio" = no promptAudioPath, or a managed path whose file is not on
 * this server's disk. Reviewed question rewrites
 * (scripts/rewrite-interview-coach-questions.ts) clear promptAudioPath on
 * apply, so stale audio that no longer matches the text is caught too.
 */
import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
import {
  buildDownloadUrl,
  deleteManagedUpload,
  extractId,
  resolveAbsolutePath,
  saveBufferAsUpload,
} from "@/lib/uploads";
import { and, eq } from "drizzle-orm";
import { stat } from "node:fs/promises";
import { OpenAI } from "openai";

export const PROMPT_AUDIO_CATEGORY = "interview/question-prompts";
const TTS_MODEL = "tts-1";
const TTS_VOICE = "onyx"; // same voice the original backfill used

export interface QuestionAudioStatus {
  id: string;
  promptText: string;
  promptAudioPath: string | null;
}

/** True when the audio path points at a file this server can serve. */
export async function promptAudioFileExists(
  promptAudioPath: string | null,
): Promise<boolean> {
  if (!promptAudioPath?.trim()) return false;
  // External URLs aren't ours to check — assume they work.
  if (/^https?:/i.test(promptAudioPath)) return true;
  const id = extractId(promptAudioPath);
  if (!id) return false;
  try {
    return (await stat(resolveAbsolutePath(id))).isFile();
  } catch {
    return false;
  }
}

/** Active questions assigned to the module, with whether audio is playable. */
export async function getModulePromptAudioStatus(moduleId: string): Promise<{
  total: number;
  missing: QuestionAudioStatus[];
}> {
  const rows = await db
    .select({
      id: interviewQuestionBank.id,
      promptText: interviewQuestionBank.promptText,
      promptAudioPath: interviewQuestionBank.promptAudioPath,
    })
    .from(interviewModuleQuestionAssignments)
    .innerJoin(
      interviewQuestionBank,
      eq(interviewQuestionBank.id, interviewModuleQuestionAssignments.questionId),
    )
    .where(
      and(
        eq(interviewModuleQuestionAssignments.moduleId, moduleId),
        eq(interviewModuleQuestionAssignments.isActive, true),
        eq(interviewQuestionBank.isActive, true),
      ),
    );

  const checks = await Promise.all(
    rows.map(async (row) => ({
      row,
      exists: await promptAudioFileExists(row.promptAudioPath),
    })),
  );

  return {
    total: rows.length,
    missing: checks.filter((c) => !c.exists).map((c) => c.row),
  };
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — cannot generate audio.");
  }
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

/**
 * Generates TTS audio for one question, stores it, and points the question
 * at it. promptTranscript is set to the text verbatim — the transcript of a
 * TTS reading of promptText is promptText. A timestamped file name (not a
 * fixed one) keeps browsers from replaying a cached old recording.
 */
export async function regenerateQuestionPromptAudio(
  question: QuestionAudioStatus,
): Promise<string> {
  const response = await getOpenAI().audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: question.promptText,
    response_format: "mp3",
  });
  const buffer = Buffer.from(await response.arrayBuffer());

  const saved = await saveBufferAsUpload(
    buffer,
    PROMPT_AUDIO_CATEGORY,
    `${question.id}-${Date.now()}.mp3`,
    "audio/mpeg",
  );
  const audioPath = buildDownloadUrl(saved.id);

  await db
    .update(interviewQuestionBank)
    .set({ promptAudioPath: audioPath, promptTranscript: question.promptText })
    .where(eq(interviewQuestionBank.id, question.id));

  // The old file (if it was ours and still exists) is now orphaned.
  if (question.promptAudioPath && question.promptAudioPath !== audioPath) {
    await deleteManagedUpload(question.promptAudioPath).catch(() => undefined);
  }

  return audioPath;
}
