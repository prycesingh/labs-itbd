import { asc } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { EnrollmentTimes, MODE_LABELS, PageTitle, ProgressBar } from "@/components/labPractice/shared";
import { BulkImportCard } from "@/components/labPractice/trainer/bulk-import";
import { CreateModuleForm } from "@/components/labPractice/trainer/trainer-widgets";
import { Badge } from "@/components/ui/badge";
import { db } from "@/DB/drizzle";
import { labPracticeModules } from "@/DB/labPracticeSchema";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listTrainerEnrollments } from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

export default async function TrainerHomePage() {
  const actor = await requirePageTrainer();
  const [modules, trainees] = await Promise.all([
    db.select().from(labPracticeModules).orderBy(asc(labPracticeModules.title)),
    listTrainerEnrollments(actor.trainer.id),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle
        title="Trainer"
        accent="Workspace"
        sub="Build practice modules, enroll trainees and review their progress."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <AdminMotionCard className="p-6">
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">New module</h2>
              <CreateModuleForm />
            </div>
          </AdminMotionCard>
          <AdminMotionCard className="p-6" delay={0.03}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Bulk import from Excel</h2>
              <BulkImportCard />
            </div>
          </AdminMotionCard>
        </div>

        <AdminMotionCard className="p-6" delay={0.05}>
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Modules</h2>
            {modules.length === 0 ? (
              <p className="text-sm text-white/50">No modules yet.</p>
            ) : (
              <div className="divide-y divide-white/10 rounded-lg border border-white/10">
                {modules.map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/guided-labs/trainer/modules/${m.id}`}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{m.title}</span>
                      <span className="text-xs text-white/50">{MODE_LABELS[m.progressionMode]}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!m.isActive && (
                        <Badge variant="outline" className="text-white/60">
                          Inactive
                        </Badge>
                      )}
                      <ArrowRight className="size-4 text-itbd-blue" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </AdminMotionCard>
      </div>

      <AdminMotionCard className="p-6" delay={0.1}>
        <div className="relative z-10 space-y-3">
          <h2 className="text-lg font-bold text-white">My trainees</h2>
          {trainees.length === 0 ? (
            <p className="text-sm text-white/50">
              Open a module to enroll trainees — they&apos;ll appear here.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {trainees.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/guided-labs/trainer/trainees/${t.id}`}
                  className="space-y-2 rounded-lg border border-white/10 p-3 hover:border-itbd-blue/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{t.traineeName}</span>
                      <span className="block truncate text-xs text-white/50">{t.moduleTitle}</span>
                    </span>
                    {!t.isActive && (
                      <Badge variant="outline" className="shrink-0 text-white/60">
                        Unassigned
                      </Badge>
                    )}
                  </div>
                  <ProgressBar percent={t.percent} label={`${t.traineeName} progress`} />
                  <p className="text-xs text-white/50">
                    {t.done}/{t.total} steps · {t.percent}%
                  </p>
                  <EnrollmentTimes
                    enrolledAt={t.enrolledAt}
                    lastActivityAt={t.lastActivityAt}
                    completedAt={t.completedAt}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </AdminMotionCard>
    </main>
  );
}
