"use client";

import {
  BookOpen,
  Cloud,
  FileText,
  GitCompareArrows,
  Layers,
  ListChecks,
  Map,
  ShieldAlert,
  SquareTerminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

/**
 * Icons are selected by a string key inside this client component — a lucide
 * component can't be passed as a prop from the server page across the RSC
 * boundary (functions aren't serializable). Mirrors the pattern in `LabCard`.
 */
const ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  checks: ListChecks,
  terminal: SquareTerminal,
  layers: Layers,
  compare: GitCompareArrows,
  alert: ShieldAlert,
  map: Map,
  flow: Workflow,
  article: FileText,
  cloud: Cloud,
};

type Section = {
  href: string;
  title: string;
  description: string;
  icon: keyof typeof ICONS;
};

export function LabsSectionGrid({ sections }: { sections: Section[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section, i) => {
        const Icon = ICONS[section.icon];
        return (
          <motion.div
            key={section.href}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            whileHover={reduce ? undefined : { y: -4 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href={section.href}
              className="itbd-glow-border group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-white/5"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
              />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-itbd-blue/10 text-itbd-blue">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-white">{section.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{section.description}</p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
