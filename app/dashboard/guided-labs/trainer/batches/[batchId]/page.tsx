import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle } from "@/components/labPractice/shared";
import {
  BatchDaysPanel,
  ScheduleBatchRoster,
  type RosterTrainee,
} from "@/components/labPractice/trainer/schedule-widgets";
import { BatchSettings } from "@/components/labPractice/trainer/visibility-widgets";
import { parseId } from "@/lib/labPractice/api";
import { canManageBatch, canReadBatch, getBatch } from "@/lib/labPractice/batches";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listBatchEnrollments } from "@/lib/labPractice/queries";
import {
  activeDayIds,
  getScheduleDetail,
  listScheduleBatches,
  overriddenLabsByEnrollment,
} from "@/lib/labPractice/schedules";

export const dynamic = "force-dynamic";

/** A batch that follows a day schedule: open days, members, trainee × day grid. */
export default async function ScheduleBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const actor = await requirePageTrainer();
  const id = parseId((await params).batchId);
  const batch = id ? await getBatch(id) : null;
  if (!batch || !canReadBatch(actor, batch)) notFound();
  if (batch.scheduleId == null) {
    if (batch.moduleId != null) redirect(`/dashboard/guided-labs/trainer/modules/${batch.moduleId}/batches/${batch.id}`);
    notFound();
  }

  const [detail, active, members, [meta]] = await Promise.all([
    getScheduleDetail(batch.scheduleId),
    activeDayIds(batch.id),
    listBatchEnrollments(batch.id),
    listScheduleBatches(batch.scheduleId).then((all) => all.filter((b) => b.id === batch.id)),
  ]);
  if (!detail) notFound();
  const overridden = await overriddenLabsByEnrollment(members.map((m) => m.id));
  const writable = Boolean(canManageBatch(actor, batch));

  // Trainee × day view built from per-enrollment, per-visible-lab progress.
  const dayOfLab = new Map(detail.days.flatMap((d) => d.labs.map((l) => [l.labId, d.id] as const)));
  const byTrainee = new Map<number, typeof members>();
  for (const m of members) byTrainee.set(m.traineeId, [...(byTrainee.get(m.traineeId) ?? []), m]);

  const trainees: RosterTrainee[] = [...byTrainee.values()]
    .map((enrollments) => {
      const first = enrollments[0];
      const done = enrollments.reduce((n, e) => n + e.done, 0);
      const total = enrollments.reduce((n, e) => n + e.total, 0);
      const last = enrollments.map((e) => e.lastActivityAt).filter(Boolean).sort().at(-1) ?? null;
      const days: RosterTrainee["days"] = {};
      for (const day of detail.days) {
        let dDone = 0;
        let dTotal = 0;
        let visible = false;
        let isOverridden = false;
        for (const e of enrollments) {
          for (const lp of e.labProgress) {
            if (dayOfLab.get(lp.labId) !== day.id) continue;
            visible = true;
            dDone += lp.done;
            dTotal += lp.total;
          }
          const ov = overridden.get(e.id);
          if (ov && day.labs.some((l) => ov.has(l.labId))) isOverridden = true;
        }
        days[day.id] = {
          visible,
          overridden: isOverridden,
          percent: visible ? (dTotal ? Math.round((dDone / dTotal) * 100) : 0) : null,
        };
      }
      return {
        traineeId: first.traineeId,
        name: first.traineeName,
        email: first.traineeEmail,
        percent: total ? Math.round((done / total) * 100) : 0,
        lastActivityAt: last,
        moduleCount: enrollments.length,
        days,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const lastOpen = detail.days.filter((d) => active.has(d.id)).at(-1);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <div className="space-y-2">
        <Link
          href={`/dashboard/guided-labs/trainer/schedules/${detail.schedule.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4" /> {detail.schedule.name}
        </Link>
        <PageTitle
          title={batch.name}
          accent={batch.isActive ? undefined : "· Archived"}
          sub={[
            `${trainees.length} ${trainees.length === 1 ? "trainee" : "trainees"}`,
            lastOpen ? `open up to Day ${lastOpen.dayNo}` : "no days open yet",
            writable ? null : `Trainer: ${meta?.trainerName ?? "another trainer"} (view only)`,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_0.5fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Trainees</h2>
            <ScheduleBatchRoster
              batchId={batch.id}
              writable={writable}
              batchActive={batch.isActive}
              days={detail.days.map((d) => ({ id: d.id, dayNo: d.dayNo, title: d.title, batchActive: active.has(d.id) }))}
              trainees={trainees}
            />
          </div>
        </AdminMotionCard>

        <div className="flex flex-col gap-6">
          <AdminMotionCard className="p-6" delay={0.05}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Days</h2>
              <BatchDaysPanel
                batchId={batch.id}
                writable={writable}
                days={detail.days.map((d) => ({
                  id: d.id,
                  dayNo: d.dayNo,
                  title: d.title,
                  labCount: d.labs.length,
                  active: active.has(d.id),
                }))}
              />
            </div>
          </AdminMotionCard>
          {writable && (
            <AdminMotionCard className="p-6" delay={0.1}>
              <div className="relative z-10 space-y-3">
                <h2 className="text-lg font-bold text-white">Settings</h2>
                <BatchSettings
                  key={`${batch.name}-${batch.isActive}`}
                  batch={{ id: batch.id, name: batch.name, isActive: batch.isActive }}
                  backHref={`/dashboard/guided-labs/trainer/schedules/${detail.schedule.id}`}
                />
              </div>
            </AdminMotionCard>
          )}
        </div>
      </div>
    </main>
  );
}
