import {
  AlertTriangle,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  Cloud,
  DatabaseZap,
  FileText,
  GitBranch,
  GraduationCap,
  Home,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MailPlus,
  MessagesSquare,
  MonitorPlay,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/rbac";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden unless the user's role holds this permission (lib/rbac.ts).
   *  Keep in sync with ROUTE_RULES there. */
  permission?: Permission;
};
export type NavSubgroup = { label: string; links: NavLink[] };
export type NavSection = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  subgroups: NavSubgroup[];
};

export const LAB_CATALOG: NavLink = {
  href: "/dashboard",
  label: "Lab Catalog",
  icon: Home,
};

// Links with a `permission` are hidden from roles lacking it. Also used to build the
// dashboard breadcrumb trail — each route's section/subgroup/label is looked
// up from here rather than duplicated.
export const SECTIONS: NavSection[] = [
  {
    key: "communication-lab",
    href: "/dashboard/interview/PracticalLearning",
    label: "Communication Lab",
    icon: MessagesSquare,
    subgroups: [
      {
        label: "Interview",
        links: [
          {
            href: "/dashboard/interview/PracticalLearning",
            label: "Practical Learning",
            icon: GraduationCap,
          },
          {
            href: "/dashboard/interview/MyEvaluations",
            label: "My Evaluations",
            icon: ClipboardCheck,
          },
          {
            href: "/dashboard/interview/Module",
            label: "Modules",
            icon: LayoutGrid,
            permission: "content.view",
          },
          {
            href: "/dashboard/interview/results",
            label: "Results",
            icon: BarChart3,
            permission: "results.view",
          },
        ],
      },
      {
        label: "Email Assessments",
        links: [
          {
            href: "/dashboard/emailAssessments/take",
            label: "Take Assessment",
            icon: MailPlus,
          },
          {
            href: "/dashboard/emailAssessments/my-evaluations",
            label: "My Evaluations",
            icon: ClipboardCheck,
          },
          {
            href: "/dashboard/emailAssessments",
            label: "Sessions",
            icon: CalendarClock,
            permission: "results.view",
          },
          {
            href: "/dashboard/emailAssessments/scenarios",
            label: "Scenarios",
            icon: MessagesSquare,
            permission: "content.view",
          },
          {
            href: "/dashboard/emailAssessments/prompts",
            label: "Prompts",
            icon: Sparkles,
            permission: "content.view",
          },
        ],
      },
      {
        label: "Admin",
        links: [
          {
            href: "/dashboard/AttemptOverrides",
            label: "Attempt Overrides",
            icon: ShieldAlert,
            permission: "content.view",
          },
          {
            href: "/dashboard/ModuleCapabilities",
            label: "Module Capabilities",
            icon: SlidersHorizontal,
            permission: "content.view",
          },
        ],
      },
    ],
  },
  {
    key: "technical-lab",
    href: "/dashboard/labs",
    label: "Technical Lab",
    icon: LayoutDashboard,
    subgroups: [
      {
        // Unlabelled: Labs Home sits above the titled sections with no heading.
        label: "",
        links: [
          {
            href: "/dashboard/labs",
            label: "Labs Home",
            icon: LayoutDashboard,
          },
        ],
      },
      {
        label: "Simulators",
        links: [
          {
            href: "/dashboard/labs/simulators",
            label: "Simulators",
            icon: MonitorPlay,
          },
        ],
      },
      {
        label: "Guided Labs",
        links: [
          {
            href: "/dashboard/guided-labs",
            label: "My Labs",
            icon: ClipboardCheck,
          },
          {
            href: "/dashboard/guided-labs/trainer",
            label: "Trainer Workspace",
            icon: Users,
            permission: "guidedLabs.train",
          },
        ],
      },
      {
        label: "Resources",
        links: [
          {
            href: "/dashboard/labs/glossary",
            label: "Glossary",
            icon: BookOpen,
          },
          {
            href: "/dashboard/labs/quizzes",
            label: "Practice Quizzes",
            icon: ListChecks,
          },
          {
            href: "/dashboard/labs/services-catalog",
            label: "Services Catalog",
            icon: DatabaseZap,
          },
          {
            href: "/dashboard/labs/cloud-comparison",
            label: "Cloud Comparison",
            icon: Cloud,
          },
          {
            href: "/dashboard/labs/gotchas",
            label: "Common Gotchas",
            icon: AlertTriangle,
          },
          {
            href: "/dashboard/labs/cert-roadmap",
            label: "Certification Roadmap",
            icon: GraduationCap,
          },
          {
            href: "/dashboard/labs/production-checklists",
            label: "Production Checklists",
            icon: CheckSquare,
          },
          {
            href: "/dashboard/labs/kql-playground",
            label: "KQL Playground",
            icon: TerminalSquare,
          },
          {
            href: "/dashboard/labs/troubleshoot-flowcharts",
            label: "Troubleshooting Flowcharts",
            icon: GitBranch,
          },
          {
            href: "/dashboard/labs/articles",
            label: "Articles",
            icon: FileText,
          },
          {
            href: "/dashboard/labs/admin/glossary",
            label: "Glossary Admin",
            icon: BookMarked,
            permission: "content.view",
          },
          {
            href: "/dashboard/labs/admin/seed",
            label: "Content Import",
            icon: DatabaseZap,
            permission: "content.view",
          },
        ],
      },
    ],
  },
];

/** Resolve a pathname to its breadcrumb trail: [section, subgroup?, link].
 *  Falls back to matching the longest link href that prefixes the pathname,
 *  so nested/dynamic routes (e.g. /dashboard/interview/[sessionId]/results)
 *  still resolve to their parent link's trail. */
export function resolveBreadcrumbTrail(pathname: string) {
  if (pathname === LAB_CATALOG.href) {
    return { section: null, subgroup: null, link: LAB_CATALOG };
  }

  let best: {
    section: NavSection;
    subgroup: NavSubgroup;
    link: NavLink;
  } | null = null;

  for (const section of SECTIONS) {
    for (const subgroup of section.subgroups) {
      for (const link of subgroup.links) {
        if (
          pathname === link.href || pathname.startsWith(link.href + "/")
        ) {
          if (!best || link.href.length > best.link.href.length) {
            best = { section, subgroup, link };
          }
        }
      }
    }
  }

  return best;
}
