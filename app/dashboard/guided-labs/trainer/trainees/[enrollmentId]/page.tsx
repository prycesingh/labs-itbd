import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PracticeTree, SessionHistory } from "@/components/labPractice/practice/practice-view";
import { PageTitle } from "@/components/labPractice/shared";
import { db } from "@/DB/drizzle";
import { labPracticeEmployees, labPracticeTrainers } from "@/DB/labPracticeSchema";
import {
  enrollmentAccessFor,
  getEnrollment,
  requirePageTrainer,
} from "@/lib/labPractice/identity";
import { getEnrollmentView } from "@/lib/labPractice/practice";
import { serializeEnrollment } from "@/lib/labPractice/serialize";

export const dynamic = "force-dynamic";

/** Owning trainer's review page: progress, photos, practice log, reject.
 *  Oversight viewers (guidedLabs.viewAll) see other trainers' trainees read-only. */
export default async function TrainerTraineePage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const actor = await requirePageTrainer();
  const id = Number((await params).enrollmentId);
  const enrollment = Number.isInteger(id) && id > 0 ? await getEnrollment(id) : null;
  if (!enrollment) notFound();
  const access = enrollmentAccessFor(actor, enrollment);
  const isOwner = access.includes("trainer");
  if (!isOwner && !access.includes("admin")) notFound();

  const [[trainee], [owner], view] = await Promise.all([
    db
      .select({ fullName: labPracticeEmployees.fullName, email: labPracticeEmployees.email })
      .from(labPracticeEmployees)
      .where(eq(labPracticeEmployees.id, enrollment.traineeId))
      .limit(1),
    isOwner
      ? Promise.resolve([undefined])
      : db
          .select({ fullName: labPracticeEmployees.fullName })
          .from(labPracticeTrainers)
          .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeTrainers.employeeId))
          .where(eq(labPracticeTrainers.id, enrollment.trainerId))
          .limit(1),
    getEnrollmentView(enrollment),
  ]);
  const data = serializeEnrollment(enrollment, view);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle
        title={trainee?.fullName ?? "Trainee"}
        accent={`· ${data.module.title}`}
        sub={
          isOwner
            ? trainee?.email
            : `${trainee?.email ?? ""} · Trainer: ${owner?.fullName ?? "another trainer"} (view only)`
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10">
            <PracticeTree data={data} role={isOwner ? "trainer" : "admin"} />
          </div>
        </AdminMotionCard>
        <AdminMotionCard className="p-6" delay={0.05}>
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Practice log</h2>
            <SessionHistory data={data} />
          </div>
        </AdminMotionCard>
      </div>
    </main>
  );
}
