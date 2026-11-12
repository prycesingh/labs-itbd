import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { EnrollmentTimes, PageTitle, ProgressBar } from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { requirePageActor } from "@/lib/labPractice/identity";
import { listTraineeEnrollments } from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

export default async function PracticeHomePage() {
  const actor = await requirePageActor();
  const enrollments = actor.employee ? await listTraineeEnrollments(actor.employee.id) : [];

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle title="Guided" accent="Labs" sub="Hands-on labs assigned to you by your trainer." />

      {actor.trainer && (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/guided-labs/trainer"
            className="inline-flex items-center gap-2 rounded-lg border border-itbd-blue/40 px-3 py-2 text-sm text-white hover:bg-itbd-blue/10"
          >
            <GraduationCap className="size-4 text-itbd-blue" /> Trainer workspace
          </Link>
        </div>
      )}

      {!actor.employee ? (
        <AdminMotionCard className="p-6">
          <p className="relative z-10 text-sm text-white/70">
            We couldn&apos;t find <span className="text-white">{actor.email}</span> in the HRIS
            employee list, so no practice modules can be assigned to you yet. Ask your trainer to run an
            HRIS sync if you joined recently.
          </p>
        </AdminMotionCard>
      ) : enrollments.length === 0 ? (
        <AdminMotionCard className="p-6">
          <p className="relative z-10 text-sm text-white/70">
            No modules assigned yet. Your trainer will enroll you when your practice starts.
          </p>
        </AdminMotionCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {enrollments.map((e, i) => (
            <AdminMotionCard key={e.id} className="p-5" delay={i * 0.04}>
              <Link href={`/dashboard/guided-labs/${e.id}`} className="relative z-10 flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold text-white">{e.moduleTitle}</h2>
                  {(!e.isActive || !e.moduleActive) && (
                    <Badge variant="outline" className="shrink-0 text-white/60">
                      Closed
                    </Badge>
                  )}
                </div>
                {e.moduleInfo && <p className="line-clamp-2 text-sm text-white/60">{e.moduleInfo}</p>}
                <div className="mt-auto space-y-1.5">
                  <ProgressBar percent={e.percent} label={`${e.moduleTitle} progress`} />
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>
                      {e.done}/{e.total} steps · {e.percent}%
                    </span>
                    <ArrowRight className="size-4 text-itbd-blue" />
                  </div>
                  <EnrollmentTimes
                    enrolledAt={e.enrolledAt}
                    lastActivityAt={e.lastActivityAt}
                    completedAt={e.completedAt}
                    className="pt-1"
                  />
                </div>
              </Link>
            </AdminMotionCard>
          ))}
        </div>
      )}
    </main>
  );
}
