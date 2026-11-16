"use client";

import { BookOpen, Inbox, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const BASE = "/dashboard/guided-labs/trainer";

/** Workspace sections, ordered by how often a trainer needs them. Detail
 *  pages light up their parent tab (a module or schedule → Curriculum). */
const TABS = [
  { href: BASE, label: "Review", icon: Inbox, match: (p: string) => p === BASE },
  { href: `${BASE}/batches`, label: "Batches", icon: UsersRound, match: (p: string) => p.startsWith(`${BASE}/batches`) },
  {
    href: `${BASE}/trainees`,
    label: "Trainees",
    icon: Users,
    match: (p: string) => p.startsWith(`${BASE}/trainees`),
  },
  {
    href: `${BASE}/curriculum`,
    label: "Curriculum",
    icon: BookOpen,
    match: (p: string) => ["curriculum", "modules", "schedules"].some((s) => p.startsWith(`${BASE}/${s}`)),
  },
];

export function TrainerTabs({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    // Sideways scroll only kicks in on narrow phones; no visible scrollbar,
    // and nothing may overflow vertically (that showed a scrollbar before).
    <nav
      aria-label="Trainer workspace"
      className="-mx-1 overflow-x-auto overflow-y-hidden border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active ? "text-white" : "text-white/55 hover:text-white",
                )}
              >
                <Icon className={cn("size-4", active && "text-itbd-blue")} />
                {t.label}
                {t.label === "Review" && pending > 0 && (
                  <span
                    className="min-w-5 rounded-full bg-itbd-blue px-1.5 text-center text-[11px] leading-5 font-semibold text-black tabular-nums"
                    aria-label={`${pending} waiting for review`}
                  >
                    {pending > 999 ? "999+" : pending}
                  </span>
                )}
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-itbd-blue" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
