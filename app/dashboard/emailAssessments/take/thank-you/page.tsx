import Link from "next/link";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <main className="flex w-full flex-col">
      <header className="flex flex-col">
        <h1 className="text-3xl">Email Assessment</h1>
      </header>
      <Separator className="my-2 bg-white" />
      <div className="mt-5 flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-xl text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {isTabSwitch ? (
              <ShieldAlert className="h-10 w-10 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            {isTabSwitch ? "Session Auto-Submitted" : "Assessment Completed"}
          </CardTitle>
          <CardDescription className="text-base">
            {isTabSwitch
              ? "A tab or window switch event was detected."
              : "Thank you for completing your email writing assessment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isTabSwitch ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-left space-y-2 leading-relaxed">
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                Security Policy Triggered
              </p>
              <p>
                To maintain the integrity of our evaluations, switching windows, opening new tabs,
                minimizing the browser, or navigating away during the test is strictly prohibited.
              </p>
              <p className="text-muted-foreground text-xs">
                Your draft was automatically submitted, all remaining scenarios in this session have
                been closed, and a 10% penalty has been applied to the overall score.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              Your responses have been successfully recorded and submitted. Our automated evaluation
              system and assessors will review your writing tone, grammar, structure, and clarity.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            You can now close this window or return to your dashboard.
          </p>

          <div className="flex justify-center gap-3 pt-4 border-t">
            <Button asChild variant="outline">
              <Link href={TAKE_BASE}>Dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
