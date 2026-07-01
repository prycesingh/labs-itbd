import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewModules,
  interviewQuestionBank,
  interviewQuestionStandardResponses,
} from "@/DB/interviewSchema";
import { transcribeAudio } from "@/lib/interview/aiServices";
import {
  buildDownloadUrl,
  extractId,
  resolveAbsolutePath,
  saveUpload,
} from "@/lib/uploads";
import { updateBankQuestionSchema } from "@/lib/validation/interview";
import { count, eq, sql } from "drizzle-orm";
import fs from "node:fs/promises";
import { z } from "zod";

const paramsSchema = z.object({ questionId: z.string().uuid() });

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
 * GET /api/interview/admin/question-bank/{questionId}
 * Fetch a single bank question with its assignments (module context) and standard response count.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const session = await auth();
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const { questionId } = parsed.data;

    const [question] = await db
      .select()
      .from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId))
      .limit(1);

    if (!question) {
      return Response.json({ error: "Question not found" }, { status: 404 });
    }

    // Fetch assignments with module context (for the delete-with-usage dialog)
    const assignments = await db
      .select({
        assignmentId: interviewModuleQuestionAssignments.id,
        moduleId: interviewModuleQuestionAssignments.moduleId,
        questionOrder: interviewModuleQuestionAssignments.questionOrder,
        isActive: interviewModuleQuestionAssignments.isActive,
        moduleName: interviewModules.name,
        moduleIsActive: interviewModules.isActive,
        questionDisplayCount: interviewModules.questionDisplayCount,
      })
      .from(interviewModuleQuestionAssignments)
      .innerJoin(
        interviewModules,
        eq(interviewModules.id, interviewModuleQuestionAssignments.moduleId),
      )
      .where(eq(interviewModuleQuestionAssignments.questionId, questionId));

    // Count active assignments per module to compute auto-deactivation risk
    const moduleIds = [...new Set(assignments.map((a) => a.moduleId))];
    const activeCountsRaw =
      moduleIds.length > 0
        ? await Promise.all(
            moduleIds.map((mId) =>
              db
                .select({ moduleId: sql<string>`${mId}`, activeCount: count() })
                .from(interviewModuleQuestionAssignments)
                .where(
                  sql`${interviewModuleQuestionAssignments.moduleId} = ${mId} AND ${interviewModuleQuestionAssignments.isActive} = true`,
                )
                .limit(1),
            ),
          )
        : [];

    const activeCountMap: Record<string, number> = {};
    for (const rows of activeCountsRaw) {
      if (rows[0])
        activeCountMap[rows[0].moduleId] = Number(rows[0].activeCount);
    }

    const assignmentsWithCount = assignments.map((a) => ({
      ...a,
      activeQuestionCount: activeCountMap[a.moduleId] ?? 0,
    }));

    const [{ responseCount }] = await db
      .select({ responseCount: count() })
      .from(interviewQuestionStandardResponses)
      .where(eq(interviewQuestionStandardResponses.questionId, questionId));

    return Response.json(
      {
        ...question,
        assignments: assignmentsWithCount,
        standardResponseCount: Number(responseCount),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "GET /api/interview/admin/question-bank/{questionId}:",
      error,
    );
    return Response.json(
      { error: "Failed to fetch question" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/interview/admin/question-bank/{questionId}
 * Edit promptText, promptAudioPath (triggers re-transcription), or isActive.
 * Change propagates to ALL modules using this question.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const session = await auth();
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const { questionId } = parsed.data;

    const [existing] = await db
      .select({ id: interviewQuestionBank.id })
      .from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Question not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let rawPayload: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      if (formData.has("promptText"))
        rawPayload.promptText = String(formData.get("promptText"));
      if (formData.has("isActive"))
        rawPayload.isActive = formData.get("isActive") === "true";
      const audioFile = formData.get("promptAudio");
      if (audioFile instanceof File && audioFile.size > 0) {
        rawPayload.promptAudioPath = await saveBankQuestionAudio(audioFile);
      }
    } else {
      rawPayload = await request.json();
    }

    const validated = updateBankQuestionSchema.safeParse(rawPayload);
    if (!validated.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (validated.data.promptText !== undefined)
      updates.promptText = validated.data.promptText;
    if (validated.data.isActive !== undefined)
      updates.isActive = validated.data.isActive;

    if (validated.data.promptAudioPath !== undefined) {
      updates.promptAudioPath = validated.data.promptAudioPath;
      // Re-transcribe on audio change
      const result = await transcribeBankQuestionAudio(
        validated.data.promptAudioPath,
        questionId,
      );
      updates.promptTranscript = result.transcript;
    }

    await db
      .update(interviewQuestionBank)
      .set(updates)
      .where(eq(interviewQuestionBank.id, questionId));

    const [updated] = await db
      .select()
      .from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId))
      .limit(1);

    return Response.json(updated, { status: 200 });
  } catch (error) {
    console.error(
      "PATCH /api/interview/admin/question-bank/{questionId}:",
      error,
    );
    return Response.json(
      { error: "Failed to update question" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/interview/admin/question-bank/{questionId}
 * Delete a bank question. Blocked with 409 if it has active assignments.
 * The 409 body includes full assignment context for the UI to render the usage dialog.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const session = await auth();
    if (!["devAdmin", "adminTeam"].includes(session?.user?.role ?? "user")) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const { questionId } = parsed.data;

    const [existing] = await db
      .select({ id: interviewQuestionBank.id })
      .from(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Question not found" }, { status: 404 });
    }

    // Check for existing assignments
    const assignments = await db
      .select({
        assignmentId: interviewModuleQuestionAssignments.id,
        moduleId: interviewModuleQuestionAssignments.moduleId,
        moduleName: interviewModules.name,
        moduleIsActive: interviewModules.isActive,
        questionDisplayCount: interviewModules.questionDisplayCount,
      })
      .from(interviewModuleQuestionAssignments)
      .innerJoin(
        interviewModules,
        eq(interviewModules.id, interviewModuleQuestionAssignments.moduleId),
      )
      .where(eq(interviewModuleQuestionAssignments.questionId, questionId));

    if (assignments.length > 0) {
      // Fetch per-module active question counts so the UI can show ⚠ deactivation warnings
      const activeCounts = await Promise.all(
        assignments.map(async (a) => {
          const [row] = await db
            .select({ activeCount: count() })
            .from(interviewModuleQuestionAssignments)
            .where(
              sql`${interviewModuleQuestionAssignments.moduleId} = ${a.moduleId} AND ${interviewModuleQuestionAssignments.isActive} = true`,
            );
          return { moduleId: a.moduleId, count: Number(row?.activeCount ?? 0) };
        }),
      );

      const countMap = Object.fromEntries(
        activeCounts.map((r) => [r.moduleId, r.count]),
      );

      return Response.json(
        {
          error: "Question is assigned to modules",
          assignments: assignments.map((a) => ({
            assignmentId: a.assignmentId,
            moduleId: a.moduleId,
            moduleName: a.moduleName,
            moduleIsActive: a.moduleIsActive,
            questionDisplayCount: a.questionDisplayCount,
            activeQuestionCount: countMap[a.moduleId] ?? 0,
          })),
        },
        { status: 409 },
      );
    }

    // No assignments — safe to delete (standard responses cascade via FK)
    await db
      .delete(interviewQuestionBank)
      .where(eq(interviewQuestionBank.id, questionId));

    return Response.json({ success: true, id: questionId }, { status: 200 });
  } catch (error) {
    console.error(
      "DELETE /api/interview/admin/question-bank/{questionId}:",
      error,
    );
    return Response.json(
      { error: "Failed to delete question" },
      { status: 500 },
    );
  }
}
