import { notFound, redirect } from "next/navigation";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import {
  PracticeTree,
  SessionHistory,
  TodayPanel,
} from "@/components/labPractice/practice/practice-view";
import { PageTitle } from "@/components/labPractice/shared";
import {
  enrollmentAccessFor,
  getEnrollment,
  requirePageActor,
} from "@/lib/labPractice/identity";
import { getEnrollmentView } from "@/lib/labPractice/practice";
import { serializeEnrollment } from "@/lib/labPractice/serialize";

export const dynamic = "force-dynamic";

/** Trainee's practice page for one enrollment. Trainers are sent to their
 *  review page; admins get a read-only view. */
export default async function TraineeEnrollmentPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const actor = await requirePageActor();
  const id = Number((await params).enrollmentId);
  const enrollment = Number.isInteger(id) && id > 0 ? await getEnrollment(id) : null;
  if (!enrollment) notFound();

  const access = enrollmentAccessFor(actor, enrollment);
  if (access.length === 0) notFound();
  // Trainee wins: a trainer who enrolled themselves practices here. Only a
  // trainer who is NOT the trainee is sent to the review page.
  const isTrainee = access.includes("trainee");
  if (!isTrainee && access.includes("trainer")) {
    redirect(`/dashboard/guided-labs/trainer/trainees/${enrollment.id}`);
  }

  const data = serializeEnrollment(enrollment, await getEnrollmentView(enrollment));

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle title={data.module.title} sub={data.module.info ?? undefined} />
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10">
            <PracticeTree data={data} role={isTrainee ? "trainee" : "admin"} />
          </div>
        </AdminMotionCard>
        <div className="flex flex-col gap-6">
          {isTrainee && data.isActive && data.module.isActive && (
            <AdminMotionCard className="p-6" delay={0.05}>
              <div className="relative z-10">
                <TodayPanel data={data} />
              </div>
            </AdminMotionCard>
          )}
          <AdminMotionCard className="p-6" delay={0.1}>
            <div className="relative z-10 space-y-3">
              <h2 className="text-lg font-bold text-white">Practice log</h2>
              <SessionHistory data={data} />
            </div>
          </AdminMotionCard>
        </div>
      </div>
    </main>
  );
}
