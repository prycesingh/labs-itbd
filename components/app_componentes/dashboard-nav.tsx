"use client";

import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

const NAV: { section: string; links: NavLink[] }[] = [
  {
    section: "Interview",
    links: [
      { href: "/dashboard/interview/PracticalLearning", label: "Practical Learning" },
      { href: "/dashboard/interview/MyEvaluations", label: "My Evaluations" },
      { href: "/dashboard/interview/Module", label: "Modules (Admin)" },
      { href: "/dashboard/interview/results", label: "Results (Admin)" },
    ],
  },
  {
    section: "Email Assessments",
    links: [
      { href: "/dashboard/emailAssessments/take", label: "Take Assessment" },
      { href: "/dashboard/emailAssessments", label: "Sessions (Admin)" },
      { href: "/dashboard/emailAssessments/scenarios", label: "Scenarios (Admin)" },
      { href: "/dashboard/emailAssessments/submissions", label: "Submissions (Admin)" },
      { href: "/dashboard/emailAssessments/prompts", label: "Prompts (Admin)" },
    ],
  },
];

export function DashboardNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b p-4">
        <Link href="/dashboard" className="text-lg font-semibold">
          Labs ITBD
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {user.name ?? user.email}
        </p>
        {user.role ? (
          <p className="text-[10px] uppercase text-muted-foreground">{user.role}</p>
        ) : null}
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="px-2 pb-1 text-xs font-medium uppercase text-muted-foreground">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active && "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
