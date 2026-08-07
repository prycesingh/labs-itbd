"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared entrance wrapper for single always-visible admin cards (glossary,
 * seed) — a subtle mount-time fade+rise, not a scroll reveal, since these
 * pages render one or two cards above the fold rather than a scrolled grid.
 * Mirrors the `useReducedMotion` guard used in `HowItWorks.tsx` / `LabCard.tsx`.
 */
export function AdminMotionCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md",
        className,
      )}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : delay }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      {children}
    </motion.div>
  );
}
