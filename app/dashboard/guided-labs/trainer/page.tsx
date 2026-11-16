import { PageTitle } from "@/components/labPractice/shared";
import { ReviewFilters } from "@/components/labPractice/trainer/review-filters";
import { ReviewInbox } from "@/components/labPractice/trainer/review-inbox";
import { parseId } from "@/lib/labPractice/api";
import { listBatches } from "@/lib/labPractice/batches";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { loadReviewQueue } from "@/lib/labPractice/review";

export const dynamic = "force-dynamic";

/**
 * Trainer home = the review queue: every photo submission and daily comment
 * from the trainer's trainees that they haven't looked at yet, oldest first,
 * reviewable in place (approve / reject / browse photos) without opening each
 * trainee's module page.
 */
export default async function TrainerReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ trainee?: string; batch?: string; scope?: string }>;
}) {
  const actor = await requirePageTrainer();
  const sp = await searchParams;
  const allTrainers = actor.canViewAll && sp.scope === "all";
  const batchId = parseId(sp.batch);

  const [queue, batches] = await Promise.all([
    loadReviewQueue(
      { trainerId: allTrainers ? null : actor.trainer.id, batchId },
      parseId(sp.trainee),
      actor,
    ),
    listBatches({ trainerId: allTrainers ? undefined : actor.trainer.id }),
  ]);
  const query: Record<string, string> = {};
  if (batchId) query.batch = String(batchId);
  if (allTrainers) query.scope = "all";

  const stepCount = queue.trainees.reduce((n, t) => n + t.pendingSteps, 0);
  const commentCount = queue.trainees.reduce((n, t) => n + t.pendingComments, 0);
  const sub =
    queue.total === 0
      ? "Nothing waiting. Photo submissions and daily comments appear here as trainees work."
      : [
          stepCount ? `${stepCount} photo ${stepCount === 1 ? "submission" : "submissions"}` : null,
          commentCount ? `${commentCount} ${commentCount === 1 ? "comment" : "comments"}` : null,
        ]
          .filter(Boolean)
          .join(" and ") +
        ` from ${queue.trainees.length} ${queue.trainees.length === 1 ? "trainee" : "trainees"} — oldest first.`;

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="Review" accent="Queue" sub={sub} />
        <ReviewFilters
          batches={batches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }))}
          canViewAll={actor.canViewAll}
        />
      </div>
      <ReviewInbox queue={queue} query={query} />
    </main>
  );
}
