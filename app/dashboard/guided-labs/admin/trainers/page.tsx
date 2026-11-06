import { asc, eq, sql } from "drizzle-orm";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import {
  HrisSyncPanel,
  TrainerRegistry,
} from "@/components/labPractice/admin/trainer-registry";
import { PageTitle } from "@/components/labPractice/shared";
import { db } from "@/DB/drizzle";
import { labPracticeEmployees, labPracticeTrainers } from "@/DB/labPracticeSchema";
import { lastSyncedAt } from "@/lib/labPractice/hris";
import { requirePageAdmin } from "@/lib/labPractice/identity";

export const dynamic = "force-dynamic";

export default async function PracticeTrainersAdminPage() {
  await requirePageAdmin();

  const [trainers, [counts], last] = await Promise.all([
    db
      .select({
        id: labPracticeTrainers.id,
        isActive: labPracticeTrainers.isActive,
        employeeId: labPracticeEmployees.id,
        empId: labPracticeEmployees.empId,
        fullName: labPracticeEmployees.fullName,
        email: labPracticeEmployees.email,
        employeeActive: labPracticeEmployees.isActive,
      })
      .from(labPracticeTrainers)
      .innerJoin(labPracticeEmployees, eq(labPracticeEmployees.id, labPracticeTrainers.employeeId))
      .orderBy(asc(labPracticeEmployees.fullName)),
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${labPracticeEmployees.isActive} then 1 else 0 end)`,
      })
      .from(labPracticeEmployees),
    lastSyncedAt(),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle
        title="Guided Labs"
        accent="Trainers"
        sub="Register who can build modules and coach trainees. Employees come from the HRIS."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <AdminMotionCard className="p-6">
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">HRIS employees</h2>
            <HrisSyncPanel
              status={{
                total: Number(counts?.total ?? 0),
                active: Number(counts?.active ?? 0),
                lastSyncedAt: last ? last.toISOString() : null,
                configured: Boolean(process.env.HRIS_API_KEY?.trim()),
              }}
            />
          </div>
        </AdminMotionCard>
        <AdminMotionCard className="p-6" delay={0.05}>
          <div className="relative z-10 space-y-3">
            <h2 className="text-lg font-bold text-white">Trainer registry</h2>
            <TrainerRegistry trainers={trainers} />
          </div>
        </AdminMotionCard>
      </div>
    </main>
  );
}
