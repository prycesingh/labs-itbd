import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

const SECTIONS = [
  {
    href: "/dashboard/interview/PracticalLearning",
    title: "Interview",
    description:
      "Audio-based practical interview modules: record answers, run AI transcription + evaluation, review results.",
  },
  {
    href: "/dashboard/emailAssessments/take",
    title: "Email Assessments",
    description:
      "Scenario-based written email assessments with AI scoring, manual review, and session reporting.",
  },
];

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Choose a module to get started.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
