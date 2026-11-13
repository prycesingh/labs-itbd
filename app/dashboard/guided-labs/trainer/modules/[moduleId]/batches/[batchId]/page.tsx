import { inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle } from "@/components/labPractice/shared";
import {
  BatchLabsEditor,
  BatchMembersPanel,
  BatchSettings,
} from "@/components/labPractice/trainer/visibility-widgets";
import { db } from "@/DB/drizzle";
import { labPracticeEnrollmentLabOverrides } from "@/DB/labPracticeSchema";
import { parseId } from "@/lib/labPractice/api";
import { canManageBatch, canReadBatch, getBatch, listModuleBatches } from "@/lib/labPractice/batches";
import { loadModuleTree } from "@/lib/labPractice/curriculum";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { listBatchEnrollments, listModuleEnrollments } from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

/** One pacing batch: which labs its trainees see, its members, and a
 *  trainee × lab progress grid for reviewing the batch at a glance. */
export default async function BatchPage({
  params,
}: {
  params: Promise<{ moduleId: string; batchId: string }>;
}) {
  const actor = await requirePageTrainer();
  const p = await params;
  const moduleId = parseId(p.moduleId);
  const batchId = parseId(p.batchId);
  const batch = batchId ? await getBatch(batchId) : null;
  if (!batch || batch.moduleId !== moduleId || !canReadBatch(actor, batch)) notFound();

  const [tree, members, moduleEnrollments, [batchMeta]] = await Promise.all([
    loadModuleTree(batch.moduleId),
    listBatchEnrollments(batch.id),
    listModuleEnrollments(batch.moduleId),
    listModuleBatches(batch.moduleId, batch.trainerId).then((all) => all.filter((b) => b.id === batch.id)),
  ]);
  if (!tree) notFound();

  const writable = Boolean(canManageBatch(actor, batch));
  const labs = tree.labs
    .filter((l) => l.isActive)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((l) => ({ id: l.id, title: l.title }));
  const activeIds = new Set(labs.map((l) => l.id));
  const selected = (batchMeta?.labIds ?? []).filter((id) => activeIds.has(id));

  const overrideRows = members.length
    ? await db
        .selectDistinct({ enrollmentId: labPracticeEnrollmentLabOverrides.enrollmentId })
        .from(labPracticeEnrollmentLabOverrides)
        .where(
          inArray(
            labPracticeEnrollmentLabOverrides.enrollmentId,
            members.map((m) => m.id),
          ),
        )
    : [];
  const withOverrides = new Set(overrideRows.map((r) => r.enrollmentId));

  const candidates = moduleEnrollments
    .filter((e) => e.trainerId === batch.trainerId && e.isActive && e.batchId !== batch.id)
    .map((e) => ({ traineeId: e.traineeId, traineeName: e.traineeName, batchName: e.batchName }));

  const activeMembers = members.filter((m) => m.isActive);
  const avg = activeMembers.length
    ? Math.round(activeMembers.reduce((s, m) => s + m.percent, 0) / activeMembers.length)
    : null;
  const shown = selected.length || Math.min(1, labs.length);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <div className="space-y-2">
        <Link
          href={`/dashboard/guided-labs/trainer/modules/${batch.moduleId}`}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4" /> {tree.title}
        </Link>
        <PageTitle
          title={batch.name}
          accent={batch.isActive ? undefined : "· Archived"}
          sub={[
            `${activeMembers.length} ${activeMembers.length === 1 ? "trainee" : "trainees"}`,
            `${shown}/${labs.length} labs shown`,
            avg !== null ? `avg ${avg}% of shown labs` : null,
            writable ? null : `Trainer: ${batchMeta?.trainerName ?? "another trainer"} (view only)`,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Trainees</h2>
            <BatchMembersPanel
              batchId={batch.id}
              writable={writable}
              batchActive={batch.isActive}
              labs={labs}
              members={members.map((m) => ({
                enrollmentId: m.id,
                traineeId: m.traineeId,
                traineeName: m.traineeName,
                traineeEmail: m.traineeEmail,
                isActive: m.isActive,
                percent: m.percent,
                done: m.done,
                total: m.total,
                lastActivityAt: m.lastActivityAt,
                hasOverrides: withOverrides.has(m.id),
                labProgress: m.labProgress.map((l) => ({ labId: l.labId, percent: l.percent })),
              }))}
              candidates={candidates}
            />
          </div>
        </AdminMotionCard>

        <div className="flex flex-col gap-6">
          <AdminMotionCard className="p-6" delay={0.05}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Visible labs</h2>
              <BatchLabsEditor
                key={selected.join(",")}
                batchId={batch.id}
                labs={labs}
                initialSelected={selected}
                writable={writable}
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
                  moduleId={batch.moduleId}
                />
              </div>
            </AdminMotionCard>
          )}
        </div>
      </div>
    </main>
  );
}
