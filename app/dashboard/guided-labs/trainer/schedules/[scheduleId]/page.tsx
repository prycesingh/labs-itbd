import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle } from "@/components/labPractice/shared";
import {
  ScheduleBatches,
  ScheduleBuilder,
  ScheduleSettings,
} from "@/components/labPractice/trainer/schedule-widgets";
import { parseId } from "@/lib/labPractice/api";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { getScheduleDetail, listScheduleBatches } from "@/lib/labPractice/schedules";

export const dynamic = "force-dynamic";

/** Day builder: put labs from any module into Day 1..n, then pace batches by day. */
export default async function SchedulePage({ params }: { params: Promise<{ scheduleId: string }> }) {
  const actor = await requirePageTrainer();
  const id = parseId((await params).scheduleId);
  const detail = id ? await getScheduleDetail(id) : null;
  if (!detail) notFound();

  // Every trainer's batches (the delete warning counts them all); the list
  // shows your own unless you have oversight.
  const allBatches = await listScheduleBatches(detail.schedule.id);
  const batches = actor.canViewAll ? allBatches : allBatches.filter((b) => b.trainerId === actor.trainer.id);
  const labCount = detail.days.reduce((n, d) => n + d.labs.length, 0);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <div className="space-y-2">
        <Link
          href="/dashboard/guided-labs/trainer"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4" /> Trainer workspace
        </Link>
        <PageTitle
          title={detail.schedule.name}
          accent={detail.schedule.isActive ? "Schedule" : "· Archived"}
          sub={`${detail.days.length} days · ${labCount} labs across ${new Set(detail.days.flatMap((d) => d.labs.map((l) => l.moduleId))).size} modules`}
        />
      </div>

      <AdminMotionCard className="p-6">
        <div className="relative z-10 space-y-4">
          <h2 className="text-lg font-bold text-white">Days</h2>
          <ScheduleBuilder
            data={{
              scheduleId: detail.schedule.id,
              days: detail.days.map((d) => ({ id: d.id, dayNo: d.dayNo, title: d.title, labs: d.labs })),
              unscheduled: detail.unscheduled,
              modules: detail.modules,
            }}
          />
        </div>
      </AdminMotionCard>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <AdminMotionCard className="p-6" delay={0.05}>
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Batches</h2>
            <p className="text-xs text-white/50">
              A batch follows this schedule: switch days on and every lab in those days opens for its trainees.
            </p>
            <ScheduleBatches
              scheduleId={detail.schedule.id}
              totalDays={detail.days.length}
              batches={batches.map((b) => ({
                id: b.id,
                name: b.name,
                isActive: b.isActive,
                trainerName: b.trainerName,
                memberCount: b.memberCount,
                activeDays: b.activeDays,
                lastActiveDay: b.lastActiveDay,
              }))}
            />
          </div>
        </AdminMotionCard>
        <AdminMotionCard className="p-6" delay={0.1}>
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Settings</h2>
            <ScheduleSettings
              key={`${detail.schedule.name}-${detail.schedule.isActive}`}
              schedule={{ id: detail.schedule.id, name: detail.schedule.name, isActive: detail.schedule.isActive }}
              batchCount={allBatches.length}
              traineeCount={allBatches.reduce((n, b) => n + b.memberCount, 0)}
            />
          </div>
        </AdminMotionCard>
      </div>
    </main>
  );
}
