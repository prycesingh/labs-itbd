import { asc } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { MODE_LABELS, PageTitle } from "@/components/labPractice/shared";
import { BulkImportCard } from "@/components/labPractice/trainer/bulk-import";
import { SchedulesCard } from "@/components/labPractice/trainer/schedule-widgets";
import { TraineeRoster } from "@/components/labPractice/trainer/trainee-roster";
import { CreateModuleForm, TrainerPicker } from "@/components/labPractice/trainer/trainer-widgets";
import { Badge } from "@/components/ui/badge";
import { db } from "@/DB/drizzle";
import { labPracticeModules } from "@/DB/labPracticeSchema";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listSchedules } from "@/lib/labPractice/schedules";
import {
  groupByTrainee,
  listAllEnrollments,
  listTrainerEnrollments,
  listTrainers,
} from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

export default async function TrainerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ trainer?: string }>;
}) {
  const actor = await requirePageTrainer();
  const myId = actor.trainer.id;

  // Oversight (guidedLabs.viewAll) sees every trainer's roster, defaulting to
  // all of them; everyone else only ever sees their own trainees.
  const requested = (await searchParams).trainer;
  const selection: "all" | number = !actor.canViewAll
    ? myId
    : requested === "me"
      ? myId
      : Number.isInteger(Number(requested)) && Number(requested) > 0
        ? Number(requested)
        : "all";

  const [modules, enrollments, trainers, schedules] = await Promise.all([
    db.select().from(labPracticeModules).orderBy(asc(labPracticeModules.title)),
    selection === "all" ? listAllEnrollments() : listTrainerEnrollments(selection),
    actor.canViewAll ? listTrainers() : Promise.resolve([]),
    listSchedules(),
  ]);
  const groups = groupByTrainee(enrollments);
  const pickerValue = selection === "all" ? "all" : selection === myId ? "me" : String(selection);
  const selectedName =
    selection === "all" || selection === myId ? null : trainers.find((t) => t.id === selection)?.fullName;
  const rosterTitle =
    selection === "all" ? "All trainees" : selection === myId ? "My trainees" : `${selectedName ?? "Trainer"}'s trainees`;

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
          <AdminMotionCard className="p-6" delay={0.02}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Day schedules</h2>
              <SchedulesCard schedules={schedules} />
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
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-baseline gap-2 text-lg font-bold text-white">
              {rosterTitle}
              {groups.length > 0 && (
                <span className="text-sm font-normal text-white/50 tabular-nums">{groups.length}</span>
              )}
            </h2>
            {actor.canViewAll && <TrainerPicker value={pickerValue} trainers={trainers} myTrainerId={myId} />}
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-white/50">
              {selection === myId
                ? "Open a module to enroll trainees — they'll appear here."
                : selection === "all"
                  ? "No trainer has enrolled anyone yet."
                  : "This trainer hasn't enrolled anyone yet."}
            </p>
          ) : (
            <TraineeRoster groups={groups} byTrainer={selection === "all"} />
          )}
        </div>
      </AdminMotionCard>
    </main>
  );
}
