/**
 * One-time backfill: generates TTS prompt audio + sets promptTranscript for
 * every question owned by the "Interview Coach" module that's missing them.
 *
 * Why this exists: the interview-coach-main migration (see
 * migrate-interview-coach-questions.ts) only ported promptText — the
 * original Python app never had prompt audio at all (it read questions
 * aloud client-side via the browser's SpeechSynthesis API, not pre-recorded
 * files). labs-itbd's module-activation gate (app/api/interview/admin/modules/
 * route.ts) requires every active question to have promptAudioPath AND
 * promptTranscript before a module can go active, so Interview Coach can't
 * be turned on without this content existing.
 *
 * promptTranscript is set to promptText verbatim — the transcript of a TTS
 * reading of promptText necessarily IS promptText, no separate transcription
 * pass needed.
 *
 * Idempotent: skips any question that already has both fields set, so it's
 * safe to re-run after adding new questions.
 *
 * Usage: npx tsx -r dotenv/config scripts/generate-interview-coach-prompt-audio.ts dotenv_config_path=.env
 */

import { and, eq, isNull, or } from "drizzle-orm";
import { OpenAI } from "openai";
import { db } from "../DB/drizzle";
import { interviewModules, interviewQuestionBank } from "../DB/interviewSchema";
import { buildDownloadUrl, saveBufferAsUpload } from "../lib/uploads";

const MODULE_NAME = "Interview Coach";
const TTS_MODEL = "tts-1";
const TTS_VOICE = "onyx"; // a neutral, professional interviewer-style voice

async function findModuleId(): Promise<string> {
  const [module] = await db
    .select({ id: interviewModules.id })
    .from(interviewModules)
    .where(eq(interviewModules.name, MODULE_NAME))
    .limit(1);
  if (!module) {
    throw new Error(
      `Module "${MODULE_NAME}" not found — run migrate-interview-coach-questions.ts first.`,
    );
  }
  return module.id;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — cannot generate TTS audio.");
  }
  const client = new OpenAI({ apiKey });

  const moduleId = await findModuleId();

  const questions = await db
    .select({
      id: interviewQuestionBank.id,
      promptText: interviewQuestionBank.promptText,
      promptAudioPath: interviewQuestionBank.promptAudioPath,
      promptTranscript: interviewQuestionBank.promptTranscript,
    })
    .from(interviewQuestionBank)
    .where(
      and(
        eq(interviewQuestionBank.primaryModuleId, moduleId),
        or(
          isNull(interviewQuestionBank.promptAudioPath),
          isNull(interviewQuestionBank.promptTranscript),
        ),
      ),
    );

  console.log(
    `[generate-audio] ${questions.length} Interview Coach questions need prompt audio/transcript.`,
  );

  let succeeded = 0;
  let failed = 0;

  for (const [index, question] of questions.entries()) {
    try {
      const needsAudio = !question.promptAudioPath;
      let audioPath = question.promptAudioPath;

      if (needsAudio) {
        const response = await client.audio.speech.create({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: question.promptText,
          response_format: "mp3",
        });
        const buffer = Buffer.from(await response.arrayBuffer());

        const saved = await saveBufferAsUpload(
          buffer,
          "interview/question-prompts",
          `${question.id}.mp3`,
          "audio/mpeg",
        );
        audioPath = buildDownloadUrl(saved.id);
      }

      await db
        .update(interviewQuestionBank)
        .set({
          promptAudioPath: audioPath,
          promptTranscript: question.promptText,
        })
        .where(eq(interviewQuestionBank.id, question.id));

      succeeded += 1;
      if ((index + 1) % 20 === 0 || index === questions.length - 1) {
        console.log(
          `[generate-audio] Progress: ${index + 1}/${questions.length}`,
        );
      }
    } catch (err) {
      failed += 1;
      console.error(
        `[generate-audio] Failed for question ${question.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[generate-audio] Done. Succeeded: ${succeeded}, Failed: ${failed}.`,
  );
  if (failed > 0) {
    console.log(
      `[generate-audio] Re-run this script to retry failed questions — it's idempotent.`,
    );
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[generate-audio] Fatal error:", err);
  process.exit(1);
});
