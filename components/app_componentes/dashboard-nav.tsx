"use client";

import { isAdminRole, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  DatabaseZap,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  ListChecks,
  LogOut,
  MailPlus,
  MessagesSquare,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};
type NavGroup = { section: string; links: NavLink[] };

// `adminOnly` links are hidden from non-admin users. Every link has an icon so
// the collapsed rail stays legible (Aceternity-style hover-to-expand).
const NAV: NavGroup[] = [
  {
    section: "Interview",
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
    section: "Email Assessments",
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
  {
    section: "Technical Lab",
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
        href: "/dashboard/labs/simulators",
        label: "Simulators",
        icon: MonitorPlay,
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
];

const EASE: Transition["ease"] = [0.22, 1, 0.36, 1];
const COLLAPSED_W = 68;
const EXPANDED_W = 256;

/**
 * Dashboard sidebar — an Aceternity-style icon rail that expands on hover to
 * reveal labels. Icons are always visible; labels fade + slide in with the
 * width animation. The active route is marked by an ITBD-blue light bar that
 * glides between rows (shared-element `layoutId`). Fully role-gated: admin-only
 * links (and the Admin Panel) are hidden from non-admins. Reduced-motion users
 * get a static expanded rail with no width/slide animation.
 */
export function DashboardNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const isAdmin = isAdminRole((user.role ?? null) as Role | null);
  // `pinned` = user toggled the rail open to stay; `hovering` = transient hover.
  // The rail is expanded when pinned OR hovered (or when reduced-motion).
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);

  const expanded = reduce ? true : pinned || hovering;

  const groups = NAV.map((g) => ({
    ...g,
    links: g.links.filter((l) => (l.adminOnly ? isAdmin : true)),
  })).filter((g) => g.links.length > 0);

  return (
    <motion.aside
      onHoverStart={() => setHovering(true)}
      onHoverEnd={() => setHovering(false)}
      initial={false}
      animate={{ width: reduce ? EXPANDED_W : expanded ? EXPANDED_W : COLLAPSED_W }}
      transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
      className="relative z-20 flex h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      {/* Brand header — ITBD logo + collapse/pin toggle */}
      <div className="flex items-center gap-2 border-b border-sidebar-border p-3">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center"
          title="Labs ITBD"
        >
          {/* Logo only — no box/border/shadow. Collapsed: mark (7.png).
              Expanded: full ITBD wordmark. */}
          {expanded ? (
            <Image
              src="/itbd_logo_img.png"
              alt="Labs ITBD"
              width={911}
              height={344}
              priority
              className="h-8 w-auto max-w-40 object-contain object-left"
            />
          ) : (
            <Image
              src="/login-images/7.png"
              alt="Labs ITBD"
              width={40}
              height={40}
              priority
              className="h-9 w-9 object-contain"
            />
          )}
        </Link>

        {/* Pin / collapse toggle — only meaningful when expanded (hover or pin).
            Hidden with reduced motion since the rail is always expanded then. */}
        {!reduce && expanded ? (
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-label={pinned ? "Collapse sidebar" : "Keep sidebar open"}
            title={pinned ? "Collapse sidebar" : "Keep sidebar open"}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {pinned ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      {/* User */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase">
          {(user.name ?? user.email ?? "?").slice(0, 2)}
        </span>
        <ExpandLabel expanded={expanded} reduce={!!reduce}>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">
              {user.name ?? user.email}
            </p>
            {user.role ? (
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {user.role}
              </p>
            ) : null}
          </div>
        </ExpandLabel>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
        {/* Home / module picker. Exact-match so it is NOT active on sub-routes
            like /dashboard/labs — gives the landing page a visible active row
            (previously only the logo linked here, with no active state). */}
        <ul className="space-y-0.5">
          <NavRow
            link={{ href: "/dashboard", label: "Dashboard", icon: Home }}
            active={pathname === "/dashboard"}
            expanded={expanded}
            reduce={!!reduce}
          />
        </ul>

        {groups.map((group) => (
          <div key={group.section}>
            <div className="h-4 px-2">
              <ExpandLabel expanded={expanded} reduce={!!reduce}>
                <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.section}
                </span>
              </ExpandLabel>
            </div>
            <ul className="mt-1 space-y-0.5">
              {group.links.map((link) => (
                <NavRow
                  key={link.href}
                  link={link}
                  active={pathname === link.href}
                  expanded={expanded}
                  reduce={!!reduce}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Admin panel — admins only */}
      {isAdmin ? (
        <div className="border-t border-sidebar-border p-3">
          <NavRow
            link={{ href: "/admin", label: "Admin Panel", icon: ShieldCheck }}
            active={pathname.startsWith("/admin")}
            expanded={expanded}
            reduce={!!reduce}
            emphasize
          />
        </div>
      ) : null}

      {/* Sign out */}
      <div className="border-t border-sidebar-border p-3">
        <motion.button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          whileHover={reduce ? undefined : { x: 3 }}
          whileTap={reduce ? undefined : { scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <ExpandLabel expanded={expanded} reduce={!!reduce}>
            <span className="whitespace-nowrap">Sign out</span>
          </ExpandLabel>
        </motion.button>
      </div>
    </motion.aside>
  );
}

/** A label that fades + slides in when the rail expands, out when it collapses.
 *  Reduced motion → always shown, no transition. */
function ExpandLabel({
  expanded,
  reduce,
  children,
}: {
  expanded: boolean;
  reduce: boolean;
  children: React.ReactNode;
}) {
  if (reduce) return <>{children}</>;
  return (
    <AnimatePresence initial={false}>
      {expanded ? (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A nav row: always-visible icon + expand-in label, with the shared-element
 *  ITBD-blue active bar and a hover nudge. */
function NavRow({
  link,
  active,
  expanded,
  reduce,
  emphasize,
}: {
  link: NavLink;
  active: boolean;
  expanded: boolean;
  reduce: boolean;
  emphasize?: boolean;
}) {
  const Icon = link.icon;
  const glide: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 500, damping: 40 };

  return (
    <li>
      <motion.div
        whileHover={reduce ? undefined : { x: 3 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <Link
          href={link.href}
          title={link.label}
          className={cn(
            "relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            active
              ? "font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80",
            emphasize && !active && "text-primary",
          )}
        >
          {active ? (
            <motion.span
              layoutId="activeNav"
              className="absolute inset-0 -z-10 rounded-md bg-sidebar-accent"
              transition={glide}
            />
          ) : null}
          {active ? (
            <motion.span
              layoutId="activeNavBar"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-itbd-blue shadow-[0_0_8px_var(--itbd-blue)]"
              transition={glide}
            />
          ) : null}
          <Icon
            className={cn(
              "h-5 w-5 shrink-0",
              active || emphasize ? "text-itbd-blue" : "",
            )}
          />
          <ExpandLabel expanded={expanded} reduce={reduce}>
            <span className="whitespace-nowrap">{link.label}</span>
          </ExpandLabel>
        </Link>
      </motion.div>
    </li>
  );
}
