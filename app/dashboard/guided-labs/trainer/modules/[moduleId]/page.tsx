import { notFound } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle } from "@/components/labPractice/shared";
import {
  ModuleSettingsCard,
  ModuleTreeCard,
  type BuilderModule,
} from "@/components/labPractice/trainer/module-builder";
import { EnrollmentPanel } from "@/components/labPractice/trainer/trainer-widgets";
import { BatchesPanel, type BatchRow } from "@/components/labPractice/trainer/visibility-widgets";
import { listModuleBatches } from "@/lib/labPractice/batches";
import { loadModuleTree } from "@/lib/labPractice/curriculum";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listModuleEnrollments } from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

export default async function TrainerModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const actor = await requirePageTrainer();
  const id = Number((await params).moduleId);
  const tree = Number.isInteger(id) && id > 0 ? await loadModuleTree(id) : null;
  if (!tree) notFound();

  const [moduleEnrollments, batchList] = await Promise.all([
    listModuleEnrollments(tree.id),
    listModuleBatches(tree.id, actor.canViewAll ? undefined : actor.trainer.id),
  ]);
  const enrollments = moduleEnrollments.filter((e) => e.trainerId === actor.trainer.id);
  const activeLabIds = new Set(tree.labs.filter((l) => l.isActive).map((l) => l.id));
  const batches: BatchRow[] = batchList.map((b) => {
    const members = moduleEnrollments.filter((e) => e.batchId === b.id && e.isActive);
    return {
      id: b.id,
      name: b.name,
      isActive: b.isActive,
      trainerName: b.trainerName,
      isMine: b.trainerId === actor.trainer.id,
      memberCount: b.memberCount,
      visibleLabs: b.labIds.filter((id) => activeLabIds.has(id)).length,
      avgPercent: members.length
        ? Math.round(members.reduce((sum, m) => sum + m.percent, 0) / members.length)
        : null,
    };
  });

  // Plain, serialisable shape for the client builder.
  const mod: BuilderModule = {
    id: tree.id,
    title: tree.title,
    info: tree.info,
    progressionMode: tree.progressionMode,
    isActive: tree.isActive,
    labs: tree.labs.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      scenario: l.scenario,
      isActive: l.isActive,
      tasks: l.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        isActive: t.isActive,
        steps: t.steps.map((s) => ({
          id: s.id,
          title: s.title,
          instructions: s.instructions,
          requiresPhoto: s.requiresPhoto,
          isActive: s.isActive,
        })),
      })),
    })),
  };

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle title={tree.title} accent="Builder" sub="Labs, tasks and steps run in the order shown." />
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Curriculum</h2>
            <ModuleTreeCard mod={mod} />
          </div>
        </AdminMotionCard>
        <div className="flex flex-col gap-6">
          <AdminMotionCard className="p-6" delay={0.05}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <ModuleSettingsCard mod={mod} />
            </div>
          </AdminMotionCard>
          <AdminMotionCard className="p-6" delay={0.08}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Batches</h2>
              <BatchesPanel
                moduleId={tree.id}
                totalLabs={activeLabIds.size}
                batches={batches}
                canCreate={tree.isActive}
              />
            </div>
          </AdminMotionCard>
          <AdminMotionCard className="p-6" delay={0.1}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">My trainees</h2>
              <EnrollmentPanel moduleId={tree.id} moduleTitle={tree.title} moduleActive={tree.isActive} enrollments={enrollments} />
            </div>
          </AdminMotionCard>
        </div>
      </div>
    </main>
  );
}
