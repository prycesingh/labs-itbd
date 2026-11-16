import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { PageTitle } from "@/components/labPractice/shared";
import { TraineeRoster } from "@/components/labPractice/trainer/trainee-roster";
import { TrainerPicker } from "@/components/labPractice/trainer/trainer-widgets";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import {
  groupByTrainee,
  listAllEnrollments,
  listTrainerEnrollments,
  listTrainers,
} from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

/** Every trainee the trainer owns, with per-module progress. Oversight
 *  (guidedLabs.viewAll) can switch to another trainer or all of them. */
export default async function TrainerTraineesPage({
  searchParams,
}: {
  searchParams: Promise<{ trainer?: string }>;
}) {
  const actor = await requirePageTrainer();
  const myId = actor.trainer.id;

  const requested = (await searchParams).trainer;
  const selection: "all" | number = !actor.canViewAll
    ? myId
    : requested === "all"
      ? "all"
      : Number.isInteger(Number(requested)) && Number(requested) > 0
        ? Number(requested)
        : myId;

  const [enrollments, trainers] = await Promise.all([
    selection === "all" ? listAllEnrollments() : listTrainerEnrollments(selection),
    actor.canViewAll ? listTrainers() : Promise.resolve([]),
  ]);
  const groups = groupByTrainee(enrollments);
  const pickerValue = selection === "all" ? "all" : selection === myId ? "me" : String(selection);
  const selectedName =
    selection === "all" || selection === myId ? null : trainers.find((t) => t.id === selection)?.fullName;
  const title =
    selection === "all" ? "All trainees" : selection === myId ? "My trainees" : `${selectedName ?? "Trainer"}'s trainees`;

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Trainees"
          sub={`${groups.length} ${groups.length === 1 ? "trainee" : "trainees"} · progress across every module they're enrolled in.`}
        />
        {actor.canViewAll && <TrainerPicker value={pickerValue} trainers={trainers} myTrainerId={myId} />}
      </div>
      <AdminMotionCard className="p-6">
        <div className="relative z-10 space-y-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-white/50">
              {selection === myId
                ? "Add trainees to a batch (or enroll them in a module) and they'll appear here."
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
