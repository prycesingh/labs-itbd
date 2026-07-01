import { db } from "@/DB/drizzle";
import {
  adminInterviewEvaluations,
  aiInterviewEvaluations,
  candidateInterviewAnswers,
  candidateInterviewSessions,
  interviewModuleQuestionAssignments,
  interviewSessionSummaries,
} from "@/DB/interviewSchema";
import { eq, inArray, sql } from "drizzle-orm";

export type ModuleResponseCleanupStats = {
  sessionsDeleted: number;
  answersDeleted: number;
  aiEvaluationsDeleted: number;
  adminEvaluationsDeleted: number;
  summariesDeleted: number;
};

type CleanupDb = Pick<typeof db, "select" | "delete">;

async function deleteSessionResponsesByIds(
  tx: CleanupDb,
  sessionIds: string[],
): Promise<ModuleResponseCleanupStats> {
  if (sessionIds.length === 0) {
    return {
      sessionsDeleted: 0,
      answersDeleted: 0,
      aiEvaluationsDeleted: 0,
      adminEvaluationsDeleted: 0,
      summariesDeleted: 0,
    };
  }

  const [answerCountRow] = await tx
    .select({ total: sql<number>`count(*)` })
    .from(candidateInterviewAnswers)
    .where(inArray(candidateInterviewAnswers.sessionId, sessionIds));

  const [aiCountRow] = await tx
    .select({ total: sql<number>`count(*)` })
    .from(aiInterviewEvaluations)
    .where(inArray(aiInterviewEvaluations.sessionId, sessionIds));

  const [adminCountRow] = await tx
    .select({ total: sql<number>`count(*)` })
    .from(adminInterviewEvaluations)
    .where(inArray(adminInterviewEvaluations.sessionId, sessionIds));

  const [summaryCountRow] = await tx
    .select({ total: sql<number>`count(*)` })
    .from(interviewSessionSummaries)
    .where(inArray(interviewSessionSummaries.sessionId, sessionIds));

  await tx
    .delete(candidateInterviewSessions)
    .where(inArray(candidateInterviewSessions.id, sessionIds));

  return {
    sessionsDeleted: sessionIds.length,
    answersDeleted: Number(answerCountRow?.total ?? 0),
    aiEvaluationsDeleted: Number(aiCountRow?.total ?? 0),
    adminEvaluationsDeleted: Number(adminCountRow?.total ?? 0),
    summariesDeleted: Number(summaryCountRow?.total ?? 0),
  };
}

export async function deleteSessionResponses(
  tx: CleanupDb,
  sessionId: string,
): Promise<ModuleResponseCleanupStats> {
  return deleteSessionResponsesByIds(tx, [sessionId]);
}

async function getModuleSessionIds(tx: CleanupDb, moduleId: string) {
  const sessions = await tx
    .select({ id: candidateInterviewSessions.id })
    .from(candidateInterviewSessions)
    .where(eq(candidateInterviewSessions.moduleId, moduleId));

  return sessions.map((session) => session.id);
}

export async function deleteModuleResponses(
  tx: CleanupDb,
  moduleId: string,
): Promise<ModuleResponseCleanupStats> {
  const sessionIds = await getModuleSessionIds(tx, moduleId);

  return deleteSessionResponsesByIds(tx, sessionIds);
}

export async function deleteModuleQuestionAssignments(
  tx: CleanupDb,
  moduleId: string,
): Promise<number> {
  const assignments = await tx
    .select({ id: interviewModuleQuestionAssignments.id })
    .from(interviewModuleQuestionAssignments)
    .where(eq(interviewModuleQuestionAssignments.moduleId, moduleId));

  if (assignments.length === 0) {
    return 0;
  }

  await tx
    .delete(interviewModuleQuestionAssignments)
    .where(eq(interviewModuleQuestionAssignments.moduleId, moduleId));

  return assignments.length;
}
