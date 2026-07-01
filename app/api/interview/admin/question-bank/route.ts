import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewQuestionBank,
} from "@/DB/interviewSchema";
import { transcribeAudio } from "@/lib/interview/aiServices";
import {
  buildDownloadUrl,
  extractId,
  resolveAbsolutePath,
  saveUpload,
} from "@/lib/uploads";
import { createBankQuestionSchema } from "@/lib/validation/interview";
import { count, eq, ilike, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

async function saveBankQuestionAudio(file: File) {
  const saved = await saveUpload(file, "interview/questions");
  return buildDownloadUrl(saved.id);
}

async function transcribeBankQuestionAudio(
  promptAudioPath: string,
  questionId: string,
) {
  try {
    const uploadId = extractId(promptAudioPath);
    if (!uploadId) throw new Error("Unable to resolve upload id");
    const absolutePath = resolveAbsolutePath(uploadId);
    const audioBuffer = await fs.readFile(absolutePath);
    const result = await transcribeAudio(audioBuffer, `question-${questionId}`);
    return { transcript: result.text, failed: false };
  } catch (error) {
    console.warn("Failed to transcribe bank question audio", {
      questionId,
      error,
    });
    return { transcript: null, failed: true };
  }
}

/**
 * GET /api/interview/admin/question-bank
 * List all bank questions with assignment + response counts.
 * Query params: ?search=, ?isActive=true|false, ?page=1, ?limit=20
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const isActiveParam = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
    );
    const offset = (page - 1) * limit;

    const conditions = [];
    if (isActiveParam === "true")
      conditions.push(eq(interviewQuestionBank.isActive, true));
    if (isActiveParam === "false")
      conditions.push(eq(interviewQuestionBank.isActive, false));
    if (search.length > 0)
      conditions.push(ilike(interviewQuestionBank.promptText, `%${search}%`));

    const whereClause =
      conditions.length > 0
        ? conditions.reduce(
            (acc, cond) => (acc ? sql`${acc} AND ${cond}` : cond),
            null as ReturnType<typeof sql> | null,
          )
        : undefined;

    const [questions, [{ total }]] = await Promise.all([
      db
        .select({
          id: interviewQuestionBank.id,
          promptText: interviewQuestionBank.promptText,
          promptAudioPath: interviewQuestionBank.promptAudioPath,
          promptTranscript: interviewQuestionBank.promptTranscript,
          isActive: interviewQuestionBank.isActive,
          createdAt: interviewQuestionBank.createdAt,
          updatedAt: interviewQuestionBank.updatedAt,
          assignmentCount: count(interviewModuleQuestionAssignments.id),
        })
        .from(interviewQuestionBank)
        .leftJoin(
          interviewModuleQuestionAssignments,
          eq(
            interviewModuleQuestionAssignments.questionId,
            interviewQuestionBank.id,
          ),
        )
        .where(whereClause ?? sql`1=1`)
        .groupBy(interviewQuestionBank.id)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(interviewQuestionBank)
        .where(whereClause ?? sql`1=1`),
    ]);

    return Response.json(
      {
        questions,
        total,
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/interview/admin/question-bank:", error);
    return Response.json(
      { error: "Failed to fetch question bank" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/interview/admin/question-bank
 * Create a bank question (independent of any module).
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let promptAudioPath: string | undefined;
    let promptText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      promptText = String(formData.get("promptText") ?? "");
      const audioFile = formData.get("promptAudio");
      if (audioFile instanceof File && audioFile.size > 0) {
        promptAudioPath = await saveBankQuestionAudio(audioFile);
      } else if (typeof formData.get("promptAudioPath") === "string") {
        promptAudioPath = String(formData.get("promptAudioPath")) || undefined;
      }
    } else {
      const body = await request.json();
      promptText = body.promptText ?? "";
      promptAudioPath = body.promptAudioPath;
    }

    const validated = createBankQuestionSchema.safeParse({
      promptText,
      promptAudioPath,
    });
    if (!validated.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const questionId = randomUUID();
    const now = new Date().toISOString();

    let promptTranscript: string | null = null;
    if (validated.data.promptAudioPath) {
      const result = await transcribeBankQuestionAudio(
        validated.data.promptAudioPath,
        questionId,
      );
      promptTranscript = result.transcript;
    }

    await db.insert(interviewQuestionBank).values({
      id: questionId,
      promptText: validated.data.promptText,
      promptAudioPath: validated.data.promptAudioPath ?? null,
      promptTranscript,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const [question] = await db
      .select()
      .from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId))
      .limit(1);

    return Response.json(question, { status: 201 });
  } catch (error) {
    console.error("POST /api/interview/admin/question-bank:", error);
    return Response.json(
      { error: "Failed to create bank question" },
      { status: 500 },
    );
  }
}
