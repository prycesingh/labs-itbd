import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentEvaluations as evaluations,
  emailAssessmentManualScores as manualScores,
  emailAssessmentScenarios as scenarios,
  emailAssessmentSessionManualScores as sessionManualScores,
  emailAssessmentSubmissions as submissions,
  type CategoryScores,
} from "@/DB/emailAssessmentSchema";
import {
  scenarioMaxScore,
  sessionGradeFromScore,
  weightedScoreFromPercent,
  type ScenarioDifficulty,
} from "@/lib/emailAssessment/scoring";

type SessionQueryRow = {
  assessment: typeof assessments.$inferSelect;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  scenario: typeof scenarios.$inferSelect;
  submission: typeof submissions.$inferSelect | null;
  evaluation: typeof evaluations.$inferSelect | null;
};

type LatestManualScore = typeof manualScores.$inferSelect;

export type SessionScenarioResult = {
  assessmentId: string;
  sessionIdentifier: string;
  sessionIndex: number | null;
  assessmentStatus: (typeof assessments.$inferSelect)["status"];
  startedAt: Date;
  dueAt: Date;
  completedAt: Date | null;
  scenarioId: string;
  scenarioTitle: string;
  scenarioPrompt: string;
  scenarioModelAnswer: string | null;
  scenarioDifficulty: ScenarioDifficulty;
  scenarioCategory: string;
  scenarioMaxScore: number;
  subject: string | null;
  content: string | null;
  wordCount: number | null;
  copyPenalty: number;
  submittedAt: Date | null;
  submissionId: string | null;
  evaluationStatus: (typeof evaluations.$inferSelect)["status"] | null;
  evaluationOverallScore: number | null;
  evaluationGrade: (typeof evaluations.$inferSelect)["grade"] | null;
  evaluationVerdict: string | null;
  aiDetected: boolean;
  categoryScores: CategoryScores | null;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  aiWeightedScore: number | null;
  manualOverallScore: number | null;
  manualGrade: (typeof manualScores.$inferSelect)["grade"] | null;
  manualSummary: string | null;
  manualNotes: string | null;
  manualImprovementAreas: string[];
  manualWeightedScore: number | null;
};

export type SessionSummary = {
  sessionIdentifier: string;
  displayId: string;
  displayName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  startedAt: Date;
  dueAt: Date;
  lastSubmittedAt: Date | null;
  totalScenarios: number;
  submittedScenarios: number;
  evaluatedScenarios: number;
  manualReviewedScenarios: number;
  statusLabel: "Started" | "In Progress" | "Evaluating" | "Completed" | "Expired" | "Needs Review";
  aiWeightedEarned: number;
  aiWeightedTotal: number | null;
  aiGrade: ReturnType<typeof sessionGradeFromScore> | null;
  manualWeightedEarned: number;
  manualWeightedTotal: number | null;
  manualGrade: ReturnType<typeof sessionGradeFromScore> | null;
  evaluatorScore: number | null;
  evaluatorNotes: string | null;
  scenarios: SessionScenarioResult[];
};

type SessionSummaryOptions = {
  candidateId?: string;
  sessionIdentifier?: string;
  limit?: number;
};

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatSessionDisplayId(sessionIdentifier: string) {
  return `SES-${sessionIdentifier.slice(0, 8).toUpperCase()}`;
}

function buildStatusLabel(
  summary: Pick<
    SessionSummary,
    "evaluatedScenarios" | "submittedScenarios" | "totalScenarios" | "scenarios"
  >
) {
  if (summary.scenarios.some((scenario) => scenario.assessmentStatus === "failed")) {
    return "Needs Review";
  }

  if (summary.evaluatedScenarios === summary.totalScenarios) {
    return "Completed";
  }

  if (summary.scenarios.some((scenario) => scenario.assessmentStatus === "expired")) {
    return "Expired";
  }

  if (summary.submittedScenarios === summary.totalScenarios) {
    return "Evaluating";
  }

  if (summary.submittedScenarios > 0) {
    return "In Progress";
  }

  return "Started";
}

async function getLatestManualScores(submissionIds: string[]) {
  if (submissionIds.length === 0) {
    return new Map<string, LatestManualScore>();
  }

  const records = await db
    .select()
    .from(manualScores)
    .where(inArray(manualScores.submissionId, submissionIds))
    .orderBy(desc(manualScores.createdAt));

  const latestBySubmission = new Map<string, LatestManualScore>();

  for (const record of records) {
    if (!latestBySubmission.has(record.submissionId)) {
      latestBySubmission.set(record.submissionId, record);
    }
  }

  return latestBySubmission;
}

async function getSessionRows(options: SessionSummaryOptions) {
  const filters = [];

  if (options.candidateId) {
    filters.push(eq(assessments.candidateId, options.candidateId));
  }

  if (options.sessionIdentifier) {
    filters.push(
      sql`coalesce(${assessments.sessionId}, ${assessments.id}) = ${options.sessionIdentifier}`
    );
  }

  const query = db
    .select({
      assessment: assessments,
      candidate: {
        id: users.id,
        name: sql<string>`coalesce(${users.name}, ${users.email})`,
        email: users.email,
      },
      scenario: scenarios,
      submission: submissions,
      evaluation: evaluations,
    })
    .from(assessments)
    .innerJoin(users, eq(assessments.candidateId, users.id))
    .innerJoin(scenarios, eq(assessments.scenarioId, scenarios.id))
    .leftJoin(submissions, eq(submissions.assessmentId, assessments.id))
    .leftJoin(evaluations, eq(evaluations.submissionId, submissions.id))
    .orderBy(desc(assessments.startedAt), assessments.sessionIndex);

  const rows = filters.length > 0 ? await query.where(and(...filters)) : await query;

  return typeof options.limit === "number" ? rows.slice(0, options.limit * 5) : rows;
}

async function getSessionManualScore(sessionId: string) {
  const [record] = await db
    .select()
    .from(sessionManualScores)
    .where(eq(sessionManualScores.sessionId, sessionId))
    .limit(1);

  return record ?? null;
}

export async function getSessionSummaries(options: SessionSummaryOptions = {}) {
  const rows = (await getSessionRows(options)) as SessionQueryRow[];
  const submissionIds = rows
    .map((row) => row.submission?.id ?? null)
    .filter((value): value is string => Boolean(value));
  const latestManualBySubmission = await getLatestManualScores(submissionIds);
  const sessionsById = new Map<string, SessionSummary>();

  for (const row of rows) {
    const sessionIdentifier = row.assessment.sessionId ?? row.assessment.id;
    const latestManual =
      row.submission?.id != null ? latestManualBySubmission.get(row.submission.id) ?? null : null;

    const scenarioResult: SessionScenarioResult = {
      assessmentId: row.assessment.id,
      sessionIdentifier,
      sessionIndex: row.assessment.sessionIndex,
      assessmentStatus: row.assessment.status,
      startedAt: row.assessment.startedAt,
      dueAt: row.assessment.dueAt,
      completedAt: row.assessment.completedAt,
      scenarioId: row.scenario.id,
      scenarioTitle: row.scenario.title,
      scenarioPrompt: row.scenario.prompt,
      scenarioModelAnswer: row.scenario.modelAnswer ?? null,
      scenarioDifficulty: row.scenario.difficulty,
      scenarioCategory: row.scenario.category,
      scenarioMaxScore: scenarioMaxScore(row.scenario.difficulty),
      subject: row.submission?.subject ?? null,
      content: row.submission?.content ?? null,
      wordCount: row.submission?.wordCount ?? null,
      copyPenalty: (row.submission?.copyPenalty ?? 0) / 100, // stored as x100 integer
      submittedAt: row.submission?.submittedAt ?? null,
      submissionId: row.submission?.id ?? null,
      evaluationStatus: row.evaluation?.status ?? null,
      evaluationOverallScore: row.evaluation?.overallScore ?? null,
      evaluationGrade: row.evaluation?.grade ?? null,
      evaluationVerdict: row.evaluation?.verdict ?? null,
      aiDetected: row.evaluation?.aiDetected ?? false,
      categoryScores: row.evaluation?.categoryScores ?? null,
      strengths: row.evaluation?.strengths ?? [],
      weaknesses: row.evaluation?.weaknesses ?? [],
      improvements: row.evaluation?.improvements ?? [],
      aiWeightedScore: weightedScoreFromPercent(
        row.evaluation?.overallScore ?? null,
        row.scenario.difficulty
      ),
      manualOverallScore: latestManual?.overallScore ?? null,
      manualGrade: latestManual?.grade ?? null,
      manualSummary: latestManual?.summary ?? null,
      manualNotes: latestManual?.notes ?? null,
      manualImprovementAreas: latestManual?.improvementAreas ?? [],
      manualWeightedScore: weightedScoreFromPercent(
        latestManual?.overallScore ?? null,
        row.scenario.difficulty
      ),
    };

    const current = sessionsById.get(sessionIdentifier);

    if (!current) {
      sessionsById.set(sessionIdentifier, {
        sessionIdentifier,
        displayId: formatSessionDisplayId(sessionIdentifier),
        displayName: sessionIdentifier,
        candidateId: row.candidate.id,
        candidateName: row.candidate.name,
        candidateEmail: row.candidate.email,
        startedAt: row.assessment.startedAt,
        dueAt: row.assessment.dueAt,
        lastSubmittedAt: row.submission?.submittedAt ?? null,
        totalScenarios: 1,
        submittedScenarios: row.submission ? 1 : 0,
        evaluatedScenarios: row.evaluation?.status === "completed" ? 1 : 0,
        manualReviewedScenarios: latestManual ? 1 : 0,
        statusLabel: "Started",
        aiWeightedEarned: scenarioResult.aiWeightedScore ?? 0,
        aiWeightedTotal: null,
        aiGrade: null,
        manualWeightedEarned: scenarioResult.manualWeightedScore ?? 0,
        manualWeightedTotal: null,
        manualGrade: null,
        evaluatorScore: null,
        evaluatorNotes: null,
        scenarios: [scenarioResult],
      });
      continue;
    }

    current.totalScenarios += 1;
    current.startedAt =
      current.startedAt < row.assessment.startedAt ? current.startedAt : row.assessment.startedAt;
    current.dueAt = current.dueAt > row.assessment.dueAt ? current.dueAt : row.assessment.dueAt;
    current.lastSubmittedAt =
      current.lastSubmittedAt && row.submission?.submittedAt
        ? current.lastSubmittedAt > row.submission.submittedAt
          ? current.lastSubmittedAt
          : row.submission.submittedAt
        : current.lastSubmittedAt ?? row.submission?.submittedAt ?? null;
    current.submittedScenarios += row.submission ? 1 : 0;
    current.evaluatedScenarios += row.evaluation?.status === "completed" ? 1 : 0;
    current.manualReviewedScenarios += latestManual ? 1 : 0;
    current.aiWeightedEarned = roundToTwo(current.aiWeightedEarned + (scenarioResult.aiWeightedScore ?? 0));
    current.manualWeightedEarned = roundToTwo(
      current.manualWeightedEarned + (scenarioResult.manualWeightedScore ?? 0)
    );
    current.scenarios.push(scenarioResult);
  }

  // Resolve evaluator scores for each session in parallel
  const sessionIds = [...sessionsById.keys()];
  const evaluatorScoresBySession = await Promise.all(
    sessionIds.map((sid) => getSessionManualScore(sid))
  );
  const evaluatorScoreMap = new Map<string, { score: number; notes: string | null }>();
  sessionIds.forEach((sid, i) => {
    const record = evaluatorScoresBySession[i];
    if (record) {
      evaluatorScoreMap.set(sid, { score: record.score, notes: record.notes ?? null });
    }
  });

  const sessions = [...sessionsById.values()]
    .map((summary) => {
      const scenarios = summary.scenarios.sort((left, right) => {
        const leftIndex = left.sessionIndex ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = right.sessionIndex ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      });
      const aiWeightedTotal =
        summary.evaluatedScenarios === summary.totalScenarios
          ? roundToTwo(summary.aiWeightedEarned)
          : null;
      const manualWeightedTotal =
        summary.manualReviewedScenarios === summary.totalScenarios
          ? roundToTwo(summary.manualWeightedEarned)
          : null;

      const evalRecord = evaluatorScoreMap.get(summary.sessionIdentifier) ?? null;

      const nextSummary: SessionSummary = {
        ...summary,
        scenarios,
        aiWeightedTotal,
        aiGrade: aiWeightedTotal != null ? sessionGradeFromScore(aiWeightedTotal) : null,
        manualWeightedTotal,
        manualGrade: manualWeightedTotal != null ? sessionGradeFromScore(manualWeightedTotal) : null,
        evaluatorScore: evalRecord?.score ?? null,
        evaluatorNotes: evalRecord?.notes ?? null,
        statusLabel: buildStatusLabel({
          evaluatedScenarios: summary.evaluatedScenarios,
          submittedScenarios: summary.submittedScenarios,
          totalScenarios: summary.totalScenarios,
          scenarios,
        }),
      };

      return nextSummary;
    })
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());

  if (typeof options.limit === "number") {
    return sessions.slice(0, options.limit);
  }

  return sessions;
}
