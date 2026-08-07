"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

const STEPS = [
  {
    title: "Choose a Lab",
    description: "Select from technical or communication labs",
  },
  {
    title: "Practice & Learn",
    description: "Complete modules and real-world scenarios",
  },
  {
    title: "Get Feedback",
    description: "Receive AI-powered feedback and scores",
  },
  {
    title: "Track Progress",
    description: "Monitor your growth and earn badges",
  },
] as const;

/**
 * "How It Works" section for the dashboard Lab Catalog page — 4 steps in a
 * row, chevron-connected, on the same `itbd-glow-border` / `bg-black/40
 * backdrop-blur-md` surface as `LabCard` so it reads as the same product.
 */
export function HowItWorks({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "itbd-glow-border relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-black/40 p-5 backdrop-blur-md sm:p-6 lg:flex-row lg:items-center mb-5",
        className,
      )}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      <div className="shrink-0 lg:w-40">
        <h2 className="text-2xl font-bold tracking-wide text-white uppercase">
          <span className="block">How To</span>
          <span className="block text-itbd-blue">Works</span>
        </h2>
      </div>

      {/* Vertical separator between the label and the steps — fades out at
          both ends via a mask so it reads as "disappearing", not a hard rule. */}
      <div
        aria-hidden
        className="hidden w-px shrink-0 self-stretch lg:block"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--itbd-blue), transparent)",
        }}
      />

      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            className="flex flex-1 items-start gap-2"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 0.4,
              delay: reduce ? 0 : i * 0.1,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                <span className="text-itbd-blue">{i + 1}.</span> {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                {step.description}
              </p>
            </div>
            {i < STEPS.length - 1 ? (
              <Image
                src="/login-images/how-it-works-arrows.png"
                alt=""
                aria-hidden
                width={1366}
                height={768}
                className="mt-1 hidden h-13 w-auto shrink-0 object-contain sm:block"
              />
            ) : null}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
