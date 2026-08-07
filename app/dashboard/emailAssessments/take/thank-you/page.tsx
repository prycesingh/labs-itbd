import Link from "next/link";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import DefaultButton, {
  GreenButton,
} from "@/components/app_componentes/customButtons";
import { requireRole } from "@/lib/emailAssessment/auth";

const TAKE_BASE = "/dashboard/emailAssessments/take";

export default async function EmailAssessmentThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  await requireRole(["candidate", "admin"]);
  const { reason } = await searchParams;
  const isTabSwitch = reason === "tab-switch";

  return (
    <main className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        Email <span className="text-itbd-blue">Assessment</span>
      </h1>

      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <div className="itbd-glow-border relative w-full max-w-xl overflow-hidden rounded-2xl bg-black/40 p-8 text-center backdrop-blur-md">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
          />
          <div className="relative z-10 space-y-4">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                isTabSwitch ? "bg-orange-500/10" : "bg-itbd-blue/10"
              }`}
            >
              {isTabSwitch ? (
                <ShieldAlert className="h-10 w-10 text-orange-400" />
              ) : (
                <CheckCircle2 className="h-10 w-10 text-itbd-blue" />
              )}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {isTabSwitch ? "Session Auto-Submitted" : "Assessment Completed"}
            </h2>
            <p className="text-base text-white/70">
              {isTabSwitch
                ? "A tab or window switch event was detected."
                : "Thank you for completing your email writing assessment."}
            </p>

            {isTabSwitch ? (
              <div className="space-y-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-left text-sm leading-relaxed">
                <p className="font-semibold text-orange-300">
                  Security Policy Triggered
                </p>
                <p className="text-orange-100">
                  To maintain the integrity of our evaluations, switching
                  windows, opening new tabs, minimizing the browser, or
                  navigating away during the test is strictly prohibited.
                </p>
                <p className="text-xs text-orange-200/70">
                  Your draft was automatically submitted, all remaining
                  scenarios in this session have been closed, and a 10%
                  penalty has been applied to the overall score.
                </p>
              </div>
            ) : (
              <p className="leading-relaxed text-white/60">
                Your responses have been successfully recorded and submitted.
                Our automated evaluation system and assessors will review
                your writing tone, grammar, structure, and clarity.
              </p>
            )}
            <p className="text-xs text-white/40">
              You can now close this window or return to your dashboard.
            </p>

            <div className="flex justify-center gap-3 border-t border-white/10 pt-4">
              <GreenButton asChild>
                <Link href={TAKE_BASE}>Dashboard</Link>
              </GreenButton>
              <DefaultButton asChild>
                <Link href="/dashboard">Home</Link>
              </DefaultButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
