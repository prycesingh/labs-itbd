import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle } from "@/components/labPractice/shared";
import { DayPointerPanel } from "@/components/labPractice/trainer/pacing-widgets";
import { ScheduleBatchRoster, type RosterTrainee } from "@/components/labPractice/trainer/schedule-widgets";
import { BatchSettings } from "@/components/labPractice/trainer/visibility-widgets";
import { parseId } from "@/lib/labPractice/api";
import { canManageBatch, canReadBatch, getBatch, listBatches, listMembers } from "@/lib/labPractice/batches";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listBatchEnrollments } from "@/lib/labPractice/queries";
import { dayStates, loadDayExceptions } from "@/lib/labPractice/pacing";
import { countPending } from "@/lib/labPractice/review";
import { getScheduleDetail, overriddenLabsByEnrollment } from "@/lib/labPractice/schedules";

export const dynamic = "force-dynamic";

/** A batch: who is in it, which day it's on, and each trainee × day. */
export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const actor = await requirePageTrainer();
  const id = parseId((await params).batchId);
  const batch = id ? await getBatch(id) : null;
  if (!batch || !canReadBatch(actor, batch)) notFound();
  if (batch.scheduleId == null) {
    if (batch.moduleId != null) redirect(`/dashboard/guided-labs/trainer/modules/${batch.moduleId}/batches/${batch.id}`);
    notFound();
  }

  const [detail, members, enrollments, [meta], pending, exceptions] = await Promise.all([
    getScheduleDetail(batch.scheduleId),
    listMembers(batch.id),
    listBatchEnrollments(batch.id),
    listBatches({ scheduleId: batch.scheduleId }).then((all) => all.filter((b) => b.id === batch.id)),
    countPending({ trainerId: batch.trainerId, batchId: batch.id }),
    loadDayExceptions([batch.id]).then((m) => m.get(batch.id) ?? new Map<number, boolean>()),
  ]);
  if (!detail) notFound();
  const overridden = await overriddenLabsByEnrollment(enrollments.map((m) => m.id));
  const writable = canManageBatch(actor, batch);
  const states = dayStates(detail.days, batch.currentDay, exceptions);

  // Trainee × day view built from per-enrollment, per-visible-lab progress.
  // Membership is the roster; a member with no linked enrollment yet (e.g.
  // every module is owned by another trainer) still shows up.
  const dayOfLab = new Map(detail.days.flatMap((d) => d.labs.map((l) => [l.labId, d.id] as const)));
  const byTrainee = new Map<number, typeof enrollments>();
  for (const e of enrollments) byTrainee.set(e.traineeId, [...(byTrainee.get(e.traineeId) ?? []), e]);

  const trainees: RosterTrainee[] = members.map((m) => {
    const list = byTrainee.get(m.traineeId) ?? [];
    const done = list.reduce((n, e) => n + e.done, 0);
    const total = list.reduce((n, e) => n + e.total, 0);
    const last = list.map((e) => e.lastActivityAt).filter(Boolean).sort().at(-1) ?? null;
    const days: RosterTrainee["days"] = {};
    for (const day of detail.days) {
      let dDone = 0;
      let dTotal = 0;
      let visible = false;
      let isOverridden = false;
      for (const e of list) {
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
      traineeId: m.traineeId,
      name: m.fullName,
      email: m.email,
      percent: total ? Math.round((done / total) * 100) : 0,
      lastActivityAt: last,
      moduleCount: list.length,
      days,
    };
  });

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <div className="space-y-2">
        <Link
          href="/dashboard/guided-labs/trainer/batches"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4" /> Batches
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle
            title={batch.name}
            accent={batch.isActive ? undefined : "· Archived"}
            sub={[
              `${trainees.length} ${trainees.length === 1 ? "trainee" : "trainees"}`,
              `follows ${detail.schedule.name}`,
              writable ? null : `Trainer: ${meta?.trainerName ?? "another trainer"} (view only)`,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {pending > 0 && (
            <Link
              href={`/dashboard/guided-labs/trainer?batch=${batch.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-itbd-blue/40 bg-itbd-blue/10 px-3 py-2 text-sm text-white hover:bg-itbd-blue/20"
            >
              <Inbox className="size-4 text-itbd-blue" />
              <span className="tabular-nums">{pending}</span> waiting for review
            </Link>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_0.5fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Trainees</h2>
            <ScheduleBatchRoster
              batchId={batch.id}
              writable={writable}
              batchActive={batch.isActive}
              days={detail.days.map((d) => ({
                id: d.id,
                dayNo: d.dayNo,
                title: d.title,
                batchActive: states.get(d.id)?.open ?? false,
              }))}
              trainees={trainees}
            />
          </div>
        </AdminMotionCard>

        <div className="flex flex-col gap-6">
          <AdminMotionCard className="p-6" delay={0.05}>
            <div className="relative z-10 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-white">Pacing</h2>
                <Link
                  href={`/dashboard/guided-labs/trainer/schedules/${detail.schedule.id}`}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Edit schedule
                </Link>
              </div>
              <DayPointerPanel
                batchId={batch.id}
                currentDay={batch.currentDay}
                writable={writable && batch.isActive}
                days={detail.days.map((d) => ({
                  id: d.id,
                  dayNo: d.dayNo,
                  title: d.title,
                  labCount: d.labs.length,
                  isActive: d.isActive,
                  open: states.get(d.id)?.open ?? false,
                  exception: states.get(d.id)?.exception ?? null,
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
                  backHref="/dashboard/guided-labs/trainer/batches"
                />
              </div>
            </AdminMotionCard>
          )}
        </div>
      </div>
    </main>
  );
}
