import { ArrowRight, CalendarDays, GraduationCap } from "lucide-react";
import Link from "next/link";

import { AdminMotionCard } from "@/components/labs/admin/admin-motion-card";
import { EnrollmentTimes, PageTitle, ProgressBar } from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { requirePageActor } from "@/lib/labPractice/identity";
import { listTraineeEnrollments } from "@/lib/labPractice/queries";

export const dynamic = "force-dynamic";

export default async function PracticeHomePage() {
  const actor = await requirePageActor();
  const all = actor.employee ? await listTraineeEnrollments(actor.employee.id) : [];
  // Modules with nothing open yet (e.g. later weeks of a bootcamp) go last.
  const enrollments = [...all].sort((a, b) => Number(b.visibleLabs > 0) - Number(a.visibleLabs > 0));
  // Day schedule: the latest open day across modules, and where its labs are.
  const todayNo = Math.max(0, ...all.map((e) => e.latestDay?.no ?? 0));
  const today = todayNo
    ? {
        no: todayNo,
        title: all.find((e) => e.latestDay?.no === todayNo)?.latestDay?.title ?? null,
        modules: all.filter((e) => e.latestDay?.no === todayNo),
      }
    : null;

  return (
    <main className="flex w-full flex-col gap-6 pb-10">
      <PageTitle title="Guided" accent="Labs" sub="Hands-on labs assigned to you by your trainer." />

      {actor.trainer && (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/guided-labs/trainer"
            className="inline-flex items-center gap-2 rounded-lg border border-itbd-blue/40 px-3 py-2 text-sm text-white hover:bg-itbd-blue/10"
          >
            <GraduationCap className="size-4 text-itbd-blue" /> Trainer workspace
          </Link>
        </div>
      )}

      {!actor.employee ? (
        <AdminMotionCard className="p-6">
          <p className="relative z-10 text-sm text-white/70">
            We couldn&apos;t find <span className="text-white">{actor.email}</span> in the HRIS
            employee list, so no practice modules can be assigned to you yet. Ask your trainer to run an
            HRIS sync if you joined recently.
          </p>
        </AdminMotionCard>
      ) : enrollments.length === 0 ? (
        <AdminMotionCard className="p-6">
          <p className="relative z-10 text-sm text-white/70">
            No modules assigned yet. Your trainer will enroll you when your practice starts.
          </p>
        </AdminMotionCard>
      ) : (
        <>
        {today && (
          <AdminMotionCard className="p-5">
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
                <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-itbd-blue/15 text-itbd-blue ring-1 ring-itbd-blue/30">
                  <CalendarDays className="size-4" aria-hidden />
                  <span className="text-sm font-bold tabular-nums">{today.no}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-itbd-blue uppercase">Day {today.no} is open</p>
                  <p className="truncate text-sm font-semibold text-white">{today.title ?? "Today's labs"}</p>
                </div>
              </div>
              <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
                {today.modules.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/dashboard/guided-labs/${e.id}`}
                      className="group inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:border-itbd-blue/50 hover:bg-itbd-blue/5"
                    >
                      <span className="max-w-56 truncate text-white">{e.moduleTitle}</span>
                      <span className="text-xs text-white/50 tabular-nums">
                        {e.latestDay!.labs} {e.latestDay!.labs === 1 ? "lab" : "labs"} · {e.latestDay!.percent}%
                      </span>
                      <ArrowRight className="size-3.5 text-white/30 group-hover:text-itbd-blue" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </AdminMotionCard>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {enrollments.map((e, i) => (
            <AdminMotionCard key={e.id} className={e.visibleLabs === 0 ? "p-5 opacity-60" : "p-5"} delay={i * 0.04}>
              <Link href={`/dashboard/guided-labs/${e.id}`} className="relative z-10 flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold text-white">{e.moduleTitle}</h2>
                  {(!e.isActive || !e.moduleActive) && (
                    <Badge variant="outline" className="shrink-0 text-white/60">
                      Closed
                    </Badge>
                  )}
                </div>
                {e.moduleInfo && <p className="line-clamp-2 text-sm text-white/60">{e.moduleInfo}</p>}
                {e.visibleLabs === 0 && (
                  <p className="text-xs text-white/40">Not open yet — your trainer will unlock it.</p>
                )}
                <div className="mt-auto space-y-1.5">
                  <ProgressBar percent={e.percent} label={`${e.moduleTitle} progress`} />
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>
                      {e.done}/{e.total} steps · {e.percent}%
                    </span>
                    <ArrowRight className="size-4 text-itbd-blue" />
                  </div>
                  <EnrollmentTimes
                    enrolledAt={e.enrolledAt}
                    lastActivityAt={e.lastActivityAt}
                    completedAt={e.completedAt}
                    className="pt-1"
                  />
                </div>
              </Link>
            </AdminMotionCard>
          ))}
        </div>
        </>
      )}
    </main>
  );
}
