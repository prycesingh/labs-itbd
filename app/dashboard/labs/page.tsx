import { LabsSectionGrid } from "@/components/labs/labs-section-grid";

const SECTIONS = [
  {
    href: "/dashboard/labs/glossary",
    title: "Glossary",
    description: "Plain-English definitions for cloud, identity, security, and networking terms.",
    icon: "book" as const,
  },
  {
    href: "/dashboard/labs/quizzes",
    title: "Practice Quizzes",
    description: "Exam-style multiple choice for AZ-104, AZ-500, SC-200, MS-102, MD-102, AZ-700.",
    icon: "checks" as const,
  },
  {
    href: "/dashboard/labs/simulators",
    title: "Simulators",
    description: "Hands-on practice environments modeled on real admin consoles — Azure, M365, AD, and more.",
    icon: "terminal" as const,
  },
  {
    href: "/dashboard/labs/services-catalog",
    title: "Services Catalog",
    description: "Azure and Microsoft 365 services with when-to-use guidance, alternatives, and pricing tier.",
    icon: "layers" as const,
  },
  {
    href: "/dashboard/labs/cloud-comparison",
    title: "Cloud Comparison",
    description: "Side-by-side Azure, AWS, and GCP service equivalents across every major category.",
    icon: "compare" as const,
  },
  {
    href: "/dashboard/labs/gotchas",
    title: "Common Gotchas",
    description: "Real-world symptom → cause → fix write-ups for the mistakes admins actually hit.",
    icon: "alert" as const,
  },
  {
    href: "/dashboard/labs/cert-roadmap",
    title: "Certification Roadmap",
    description: "Microsoft certification tracks with study time, exam format, and related skills.",
    icon: "map" as const,
  },
  {
    href: "/dashboard/labs/production-checklists",
    title: "Production Checklists",
    description: "Go-live checklists for Azure VM, AKS, App Service, SQL Database, Storage, and more.",
    icon: "checks" as const,
  },
  {
    href: "/dashboard/labs/kql-playground",
    title: "KQL Playground",
    description: "Beginner-to-advanced Kusto queries for Sentinel and Log Analytics hunting.",
    icon: "terminal" as const,
  },
  {
    href: "/dashboard/labs/troubleshoot-flowcharts",
    title: "Troubleshooting Flowcharts",
    description: "Linear step-by-step runbooks for login failures, mail delivery, VPN, AD replication, and more.",
    icon: "flow" as const,
  },
  {
    href: "/dashboard/labs/articles",
    title: "Articles",
    description: "Long-form reference reading — fundamentals, end-to-end projects, API guides, and postmortems.",
    icon: "article" as const,
  },
];

export default function LabsHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          Technical <span className="text-itbd-blue">Lab</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Reference material and practice quizzes for cloud, identity, security, and networking.
        </p>
      </div>
      <LabsSectionGrid sections={SECTIONS} />
    </div>
  );
}
