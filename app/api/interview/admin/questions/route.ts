import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { interviewQuestions } from "@/DB/interviewSchema";
import { transcribeAudio } from "@/lib/interview/aiServices";
import {
  buildDownloadUrl,
  extractId,
  resolveAbsolutePath,
  saveUpload,
} from "@/lib/uploads";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { z } from "zod";

// Validation schema for creating/updating questions
const createQuestionSchema = z.object({
  moduleId: z.string().uuid(),
  promptText: z.string().min(1).max(2000),
  promptAudioPath: z.string().min(1),
  questionOrder: z.number().int().min(0).optional(),
});

const updateQuestionSchema = z.object({
  questionId: z.string().uuid(),
  promptText: z.string().min(1).max(2000).optional(),
  promptAudioPath: z.string().optional(),
});

async function saveQuestionAudioFile(file: File) {
  const saved = await saveUpload(file, "interview/questions");
  return buildDownloadUrl(saved.id);
}

async function transcribeQuestionPromptAudio(
  promptAudioPath: string,
  questionId: string,
) {
  try {
    const uploadId = extractId(promptAudioPath);
    if (!uploadId) {
      throw new Error("Unable to resolve upload id from promptAudioPath");
    }

    const absolutePath = resolveAbsolutePath(uploadId);
    const audioBuffer = await fs.readFile(absolutePath);
    const result = await transcribeAudio(audioBuffer, `question-${questionId}`);

    return {
      transcript: result.text,
      transcriptLanguage: result.language,
      failed: false,
    };
  } catch (error) {
    console.warn("Failed to transcribe question prompt audio", {
      questionId,
      error,
    });
    return {
      transcript: null,
      transcriptLanguage: null,
      failed: true,
    };
  }
}

/**
 * POST /api/interview/admin/questions
 * Create a new question in a module (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const questionOrderRaw = formData.get("questionOrder");
      const promptAudioFile = formData.get("promptAudio");

      let promptAudioPath =
        typeof formData.get("promptAudioPath") === "string"
          ? String(formData.get("promptAudioPath") || "")
          : "";

      if (promptAudioFile instanceof File && promptAudioFile.size > 0) {
        promptAudioPath = await saveQuestionAudioFile(promptAudioFile);
      }

      payload = {
        moduleId: String(formData.get("moduleId") || ""),
        promptText: String(formData.get("promptText") || ""),
        promptAudioPath: promptAudioPath || undefined,
        questionOrder:
          typeof questionOrderRaw === "string" && questionOrderRaw.length > 0
            ? Number(questionOrderRaw)
            : undefined,
      };
    } else {
      payload = await request.json();
    }

    const validated = createQuestionSchema.parse(payload);

    const questionId = randomUUID();
    const now = new Date().toISOString();

    // Auto-increment questionOrder if not provided
    let questionOrder = validated.questionOrder;
    if (questionOrder === undefined) {
      const lastQuestion = await db
        .select({ questionOrder: interviewQuestions.questionOrder })
        .from(interviewQuestions)
        .where(eq(interviewQuestions.moduleId, validated.moduleId))
        .orderBy(desc(interviewQuestions.questionOrder))
        .limit(1);
      questionOrder =
        lastQuestion.length > 0 ? lastQuestion[0].questionOrder + 1 : 0;
    }

    let promptTranscript: string | null = null;

    if (validated.promptAudioPath) {
      const transcriptResult = await transcribeQuestionPromptAudio(
        validated.promptAudioPath,
        questionId,
      );
      promptTranscript = transcriptResult.transcript;
    }

    await db.insert(interviewQuestions).values({
      id: questionId,
      moduleId: validated.moduleId,
      promptText: validated.promptText,
      promptAudioPath: validated.promptAudioPath || null,
      promptTranscript,
      questionOrder: questionOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const [question] = await db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, questionId))
      .limit(1);

    return Response.json(question, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    console.error("POST /api/interview/admin/questions:", error);
    return Response.json(
      { error: "Failed to create question" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/interview/admin/modules/{moduleId}/questions
 * List questions in a module (admin only)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");

    if (!moduleId) {
      return Response.json(
        { error: "moduleId query parameter is required" },
        { status: 400 },
      );
    }

    const questions = await db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.moduleId, moduleId))
      .orderBy(interviewQuestions.questionOrder);

    return Response.json(questions, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/admin/questions:", error);
    return Response.json(
      { error: "Failed to fetch questions" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/interview/admin/questions/{questionId}
 * Delete a question (admin only)
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");

    if (!questionId) {
      return Response.json(
        { error: "questionId query parameter is required" },
        { status: 400 },
      );
    }

    await db
      .delete(interviewQuestions)
      .where(eq(interviewQuestions.id, questionId));

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/interview/admin/questions:", error);
    return Response.json(
      { error: "Failed to delete question" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/interview/admin/questions
 * Update question text and/or prompt audio (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const promptAudioFile = formData.get("promptAudio");

      let promptAudioPath =
        typeof formData.get("promptAudioPath") === "string"
          ? String(formData.get("promptAudioPath") || "")
          : "";

      if (promptAudioFile instanceof File && promptAudioFile.size > 0) {
        promptAudioPath = await saveQuestionAudioFile(promptAudioFile);
      }

      payload = {
        questionId: String(formData.get("questionId") || ""),
        promptText:
          typeof formData.get("promptText") === "string" &&
          String(formData.get("promptText") || "").trim().length > 0
            ? String(formData.get("promptText") || "")
            : undefined,
        promptAudioPath: promptAudioPath || undefined,
      };
    } else {
      payload = await request.json();
    }

    const validated = updateQuestionSchema.parse(payload);

    const [existingQuestion] = await db
      .select({ id: interviewQuestions.id })
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, validated.questionId))
      .limit(1);

    if (!existingQuestion) {
      return Response.json({ error: "Question not found" }, { status: 404 });
    }

    const updates: Partial<typeof interviewQuestions.$inferInsert> = {};

    if (validated.promptText !== undefined) {
      updates.promptText = validated.promptText;
    }

    if (validated.promptAudioPath !== undefined) {
      updates.promptAudioPath = validated.promptAudioPath;
      const transcriptResult = await transcribeQuestionPromptAudio(
        validated.promptAudioPath,
        validated.questionId,
      );
      updates.promptTranscript = transcriptResult.transcript;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "No valid fields provided for update" },
        { status: 400 },
      );
    }

    await db
      .update(interviewQuestions)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(interviewQuestions.id, validated.questionId));

    const [question] = await db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, validated.questionId))
      .limit(1);

    return Response.json(question, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    console.error("PATCH /api/interview/admin/questions:", error);
    return Response.json(
      { error: "Failed to update question" },
      { status: 500 },
    );
  }
}
