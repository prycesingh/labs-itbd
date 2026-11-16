import type { ReactNode } from "react";

import { TrainerTabs } from "@/components/labPractice/trainer/trainer-tabs";
import { requirePageTrainer } from "@/lib/labPractice/identity";
import { countPending } from "@/lib/labPractice/review";

export const dynamic = "force-dynamic";

/** Trainer workspace shell: Review · Batches · Trainees · Curriculum. */
export default async function TrainerLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageTrainer();
  const pending = await countPending({ trainerId: actor.trainer.id });
  return (
    <div className="flex w-full flex-col gap-6">
      <TrainerTabs pending={pending} />
      {children}
    </div>
  );
}
