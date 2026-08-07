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
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MailPlus,
  MessagesSquare,
  MonitorPlay,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
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

// `adminOnly` links are hidden from non-admin users. Also used to build the
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
            adminOnly: true,
          },
          {
            href: "/dashboard/interview/results",
            label: "Results",
            icon: BarChart3,
            adminOnly: true,
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
            href: "/dashboard/emailAssessments",
            label: "Sessions",
            icon: CalendarClock,
            adminOnly: true,
          },
          {
            href: "/dashboard/emailAssessments/scenarios",
            label: "Scenarios",
            icon: MessagesSquare,
            adminOnly: true,
          },
          {
            href: "/dashboard/emailAssessments/submissions",
            label: "Submissions",
            icon: Inbox,
            adminOnly: true,
          },
          {
            href: "/dashboard/emailAssessments/prompts",
            label: "Prompts",
            icon: Sparkles,
            adminOnly: true,
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
        label: "Technical Lab",
        links: [
          {
            href: "/dashboard/labs",
            label: "Labs Home",
            icon: LayoutDashboard,
          },
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
            href: "/dashboard/labs/simulators",
            label: "Simulators",
            icon: MonitorPlay,
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
            adminOnly: true,
          },
          {
            href: "/dashboard/labs/admin/seed",
            label: "Content Import",
            icon: DatabaseZap,
            adminOnly: true,
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
