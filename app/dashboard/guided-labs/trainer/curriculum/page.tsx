import { asc } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { MODE_LABELS, PageTitle } from "@/components/labPractice/shared";
import { BulkImportCard } from "@/components/labPractice/trainer/bulk-import";
import { SchedulesCard } from "@/components/labPractice/trainer/schedule-widgets";
import { CreateModuleForm } from "@/components/labPractice/trainer/trainer-widgets";
import { Badge } from "@/components/ui/badge";
import { db } from "@/DB/drizzle";
import { labPracticeModules } from "@/DB/labPracticeSchema";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listSchedules } from "@/lib/labPractice/schedules";

export const dynamic = "force-dynamic";

/** Shared curriculum: modules (labs → tasks → steps) and the day schedules
 *  that batches follow. Authoring lives here, away from daily review. */
export default async function TrainerCurriculumPage() {
  await requirePageTrainer();
  const [modules, schedules] = await Promise.all([
    db.select().from(labPracticeModules).orderBy(asc(labPracticeModules.title)),
    listSchedules(),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle
        title="Curriculum"
        sub="Modules hold the labs. Schedules arrange labs from any modules into days — batches follow a schedule."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10 space-y-3">
            <h2 className="flex items-baseline gap-2 text-lg font-bold text-white">
              Modules <span className="text-sm font-normal text-white/50 tabular-nums">{modules.length}</span>
            </h2>
            {modules.length === 0 ? (
              <p className="text-sm text-white/50">No modules yet — create one or import from Excel.</p>
            ) : (
              <div className="divide-y divide-white/10 rounded-lg border border-white/10">
                {modules.map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/guided-labs/trainer/modules/${m.id}`}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
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

        <div className="flex flex-col gap-6">
          <AdminMotionCard className="p-6" delay={0.03}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Day schedules</h2>
              <SchedulesCard schedules={schedules} />
            </div>
          </AdminMotionCard>
          <AdminMotionCard className="p-6" delay={0.05}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">New module</h2>
              <CreateModuleForm />
            </div>
          </AdminMotionCard>
          <AdminMotionCard className="p-6" delay={0.08}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Bulk import from Excel</h2>
              <BulkImportCard />
            </div>
          </AdminMotionCard>
        </div>
      </div>
    </main>
  );
}
