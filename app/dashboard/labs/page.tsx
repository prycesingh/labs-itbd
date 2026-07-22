import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/dashboard/labs/glossary",
    title: "Glossary",
    description: "Plain-English definitions for cloud, identity, security, and networking terms.",
  },
  {
    href: "/dashboard/labs/quizzes",
    title: "Practice Quizzes",
    description: "Exam-style multiple choice for AZ-104, AZ-500, SC-200, MS-102, MD-102, AZ-700.",
  },
  {
    href: "/dashboard/labs/simulators",
    title: "Simulators",
    description: "Hands-on practice environments modeled on real admin consoles — Azure, M365, AD, and more.",
  },
  {
    href: "/dashboard/labs/services-catalog",
    title: "Services Catalog",
    description: "Azure and Microsoft 365 services with when-to-use guidance, alternatives, and pricing tier.",
  },
  {
    href: "/dashboard/labs/cloud-comparison",
    title: "Cloud Comparison",
    description: "Side-by-side Azure, AWS, and GCP service equivalents across every major category.",
  },
  {
    href: "/dashboard/labs/gotchas",
    title: "Common Gotchas",
    description: "Real-world symptom → cause → fix write-ups for the mistakes admins actually hit.",
  },
  {
    href: "/dashboard/labs/cert-roadmap",
    title: "Certification Roadmap",
    description: "Microsoft certification tracks with study time, exam format, and related skills.",
  },
  {
    href: "/dashboard/labs/production-checklists",
    title: "Production Checklists",
    description: "Go-live checklists for Azure VM, AKS, App Service, SQL Database, Storage, and more.",
  },
  {
    href: "/dashboard/labs/kql-playground",
    title: "KQL Playground",
    description: "Beginner-to-advanced Kusto queries for Sentinel and Log Analytics hunting.",
  },
  {
    href: "/dashboard/labs/troubleshoot-flowcharts",
    title: "Troubleshooting Flowcharts",
    description: "Linear step-by-step runbooks for login failures, mail delivery, VPN, AD replication, and more.",
  },
  {
    href: "/dashboard/labs/articles",
    title: "Articles",
    description: "Long-form reference reading — fundamentals, end-to-end projects, API guides, and postmortems.",
  },
];

export default function LabsHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Technical Lab</h1>
        <p className="text-muted-foreground">
          Reference material and practice quizzes for cloud, identity, security, and networking.
        </p>
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
