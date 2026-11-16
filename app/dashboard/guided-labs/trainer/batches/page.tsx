import { asc, eq } from "drizzle-orm";
import { ArrowRight, Inbox, Users } from "lucide-react";
import Link from "next/link";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle, ProgressBar } from "@/components/labPractice/shared";
import { CreateBatchForm } from "@/components/labPractice/trainer/batch-widgets";
import { Badge } from "@/components/ui/badge";
import { db } from "@/DB/drizzle";
import { labPracticeModules } from "@/DB/labPracticeSchema";
import { listBatches, type BatchSummary } from "@/lib/labPractice/batches";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { countPending } from "@/lib/labPractice/review";
import { listSchedules } from "@/lib/labPractice/schedules";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** All of the trainer's batches in one place (oversight sees everyone's):
 *  which day each is on, how many trainees, and what's waiting for review. */
export default async function TrainerBatchesPage() {
  const actor = await requirePageTrainer();
  const [batches, schedules, modules] = await Promise.all([
    listBatches({ trainerId: actor.canViewAll ? undefined : actor.trainer.id }),
    listSchedules(),
    db
      .select({ id: labPracticeModules.id, title: labPracticeModules.title })
      .from(labPracticeModules)
      .where(eq(labPracticeModules.isActive, true))
      .orderBy(asc(labPracticeModules.title)),
  ]);
  const pending = new Map(
    await Promise.all(
      batches
        .filter((b) => b.isActive)
        .map(async (b) => [b.id, await countPending({ trainerId: b.trainerId, batchId: b.id })] as const),
    ),
  );

  const mine = batches.filter((b) => b.trainerId === actor.trainer.id);
  const others = batches.filter((b) => b.trainerId !== actor.trainer.id);
  const sections: { title: string; rows: BatchSummary[] }[] = [
    { title: actor.canViewAll ? "My batches" : "Batches", rows: mine },
    ...(others.length ? [{ title: "Other trainers", rows: others }] : []),
  ];

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle
        title="Batches"
        sub="A batch is a group of trainees following one day schedule — across as many modules as the schedule uses."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          {sections.map((section, si) => (
            <AdminMotionCard key={section.title} className="p-6" delay={si * 0.05}>
              <div className="relative z-10 space-y-3">
                <h2 className="flex items-baseline gap-2 text-lg font-bold text-white">
                  {section.title}
                  <span className="text-sm font-normal text-white/50 tabular-nums">{section.rows.length}</span>
                </h2>
                {section.rows.length === 0 ? (
                  <p className="text-sm text-white/50">No batches yet. Create one to start pacing trainees by day.</p>
                ) : (
                  <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                    {section.rows.map((b) => {
                      const waiting = pending.get(b.id) ?? 0;
                      const legacy = b.scheduleId == null;
                      const percent = b.totalDays ? Math.round((b.currentDay / b.totalDays) * 100) : 0;
                      return (
                        <li key={b.id}>
                          <Link
                            href={`/dashboard/guided-labs/trainer/batches/${b.id}`}
                            className="group grid items-center gap-x-4 gap-y-2 px-3 py-3 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_9rem_auto_1rem]"
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className={cn("truncate text-sm font-medium", b.isActive ? "text-white" : "text-white/50")}>
                                  {b.name}
                                </span>
                                {!b.isActive && (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-white/60">
                                    Archived
                                  </Badge>
                                )}
                                {legacy && (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-white/60">
                                    Module batch · convert
                                  </Badge>
                                )}
                              </span>
                              <span className="flex flex-wrap gap-x-3 text-xs text-white/50">
                                <span className="truncate">{b.scheduleName ?? b.moduleTitle ?? "—"}</span>
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Users className="size-3" /> {b.memberCount}
                                </span>
                                {others.includes(b) && <span className="text-white/40">{b.trainerName}</span>}
                              </span>
                            </span>
                            {legacy ? (
                              <span />
                            ) : (
                              <span className="space-y-1">
                                <span className="block text-xs text-white/70 tabular-nums">
                                  {b.currentDay ? `Day ${b.currentDay}` : "Not started"}
                                  <span className="text-white/40"> / {b.totalDays}</span>
                                </span>
                                <ProgressBar percent={percent} label={`${b.name} schedule position`} className="h-1" />
                              </span>
                            )}
                            <span className="text-xs tabular-nums">
                              {waiting > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-itbd-blue/15 px-2 py-0.5 text-itbd-blue">
                                  <Inbox className="size-3" /> {waiting}
                                </span>
                              ) : null}
                            </span>
                            <ArrowRight className="hidden size-4 text-white/30 transition-colors group-hover:text-itbd-blue sm:block" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </AdminMotionCard>
          ))}
        </div>

        <AdminMotionCard className="p-6" delay={0.08}>
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">New batch</h2>
            <CreateBatchForm
              schedules={schedules.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name, dayCount: s.dayCount }))}
              modules={modules}
            />
          </div>
        </AdminMotionCard>
      </div>
    </main>
  );
}
