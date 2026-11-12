import { db } from "@/DB/drizzle";
import { candidateInterviewSessions } from "@/DB/interviewSchema";
import { can } from "@/lib/rbac";
import { eq } from "drizzle-orm";

/**
 * Who may hear a recorded interview answer: the candidate who recorded it,
 * or anyone whose role grants results.view (reviewers/auditors/admins).
 * Being signed in is not enough — answer audio is personal assessment data,
 * and before this check any authenticated user could fetch any answer's
 * audio given its answerId or storage path.
 */
export async function canAccessInterviewSession(
  user: { id: string; role?: string | null },
  sessionId: string,
): Promise<boolean> {
  if (can(user.role, "results.view")) return true;

  const [row] = await db
    .select({ candidateId: candidateInterviewSessions.candidateId })
    .from(candidateInterviewSessions)
    .where(eq(candidateInterviewSessions.id, sessionId))
    .limit(1);

  return row?.candidateId === user.id;
}

/**
 * Extracts the interview session id from a managed upload id such as
 * "interview/answers/{sessionId}/{file}.webm" (see audioStorage.ts →
 * saveBufferAsUpload). Returns null for any other upload category.
 * Segments are normalized the same way resolveAbsolutePath() normalizes
 * them, so "./", "..", or doubled slashes can't be used to dodge the check.
 */
export function interviewAnswerSessionIdFromUploadId(
  uploadId: string,
): string | null {
  const segments = uploadId
    .split(/[/\\]+/g)
    .filter((segment) => segment && segment !== ".." && segment !== ".");
  if (
    segments.length >= 3 &&
    segments[0].toLowerCase() === "interview" &&
    segments[1].toLowerCase() === "answers"
  ) {
    return segments[2];
  }
  return null;
}
