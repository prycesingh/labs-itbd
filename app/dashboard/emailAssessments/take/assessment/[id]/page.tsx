import { eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/DB/drizzle";
import {
  emailAssessmentAssessments as assessments,
  emailAssessmentScenarios as scenarios,
} from "@/DB/emailAssessmentSchema";
import { AssessmentEditor } from "@/components/emailAssessment/assessment-editor";
import { requireRole } from "@/lib/emailAssessment/auth";

const TAKE_BASE = "/dashboard/emailAssessments/take";

type AssessmentWithScenario = {
  assessment: typeof assessments.$inferSelect;
  scenario: typeof scenarios.$inferSelect;
};

export default async function EmailAssessmentTakeAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const user = await requireRole(["candidate", "admin"]);
  const { id } = await params;
  const { sessionId } = await searchParams;

  const [record] = await db
    .select({
      assessment: assessments,
      scenario: scenarios,
    })
    .from(assessments)
    .innerJoin(scenarios, eq(assessments.scenarioId, scenarios.id))
    .where(eq(assessments.id, id))
    .limit(1);

  if (!record || record.assessment.candidateId !== user.id) {
    notFound();
  }

  if (record.assessment.status !== "in_progress") {
    redirect(`${TAKE_BASE}/results/${record.assessment.id}`);
  }

  // Load sibling assessments in the same session for navigation
  let sessionAssessments: AssessmentWithScenario[] = [];
  const effSessionId = sessionId ?? record.assessment.sessionId;

  if (effSessionId) {
    const rows = await db
      .select({
        assessment: assessments,
        scenario: scenarios,
      })
      .from(assessments)
      .innerJoin(scenarios, eq(assessments.scenarioId, scenarios.id))
      .where(
        sql`${assessments.sessionId} = ${effSessionId} AND ${assessments.candidateId} = ${user.id}`
      )
      .orderBy(assessments.sessionIndex);

    sessionAssessments = rows;
  }

  const currentIndex = sessionAssessments.findIndex((a) => a.assessment.id === id);
  const totalInSession = sessionAssessments.length > 0 ? sessionAssessments.length : 0;
  const nextAssessment =
    currentIndex >= 0 && currentIndex < sessionAssessments.length - 1
      ? sessionAssessments[currentIndex + 1]
      : null;

  return (
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Email <span className="text-itbd-blue">Assessment</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="itbd-glow-border relative h-fit overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 space-y-4">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ItbdBadge>{record.scenario.difficulty}</ItbdBadge>
                <ItbdBadge>{record.scenario.category}</ItbdBadge>
                {totalInSession > 1 && (
                  <span className="ml-auto text-xs text-white/50">
                    Scenario {currentIndex + 1} of {totalInSession}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white">
                {record.scenario.title}
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Write a professional email response including a subject line.
              </p>
            </div>

            <p className="leading-relaxed text-white/80">
              {record.scenario.prompt}
            </p>

            {totalInSession > 1 && (
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center gap-2">
                  {sessionAssessments.map((a, i) => (
                    <div
                      key={a.assessment.id}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < currentIndex
                          ? "bg-itbd-blue"
                          : i === currentIndex
                            ? "bg-itbd-blue/60"
                            : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <AssessmentEditor
          assessmentId={record.assessment.id}
          sessionId={effSessionId ?? undefined}
          dueAt={record.assessment.dueAt.toISOString()}
          nextAssessmentId={nextAssessment?.assessment.id ?? null}
          currentIndex={currentIndex >= 0 ? currentIndex : 0}
          totalScenarios={totalInSession}
          remainingAssessmentIds={sessionAssessments
            .slice(currentIndex >= 0 ? currentIndex : 0)
            .map((a) => a.assessment.id)}
        />
      </div>
    </main>
  );
}

/** Small pill badge matching the ITBD accent language, replacing shadcn's
 *  default Badge (which carries no brand tint) for this candidate-facing flow. */
function ItbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-itbd-blue/40 bg-itbd-blue/10 px-2.5 py-0.5 text-xs font-semibold text-itbd-blue capitalize">
      {children}
    </span>
  );
}
