"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import DefaultButton from "@/components/app_componentes/customButtons";

export function SimulatorLaunchCard({
  title,
  description,
  href,
  index = 0,
}: {
  title: string;
  description: string;
  href?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="itbd-glow-border relative flex h-full flex-col overflow-hidden rounded-2xl bg-black/40 p-5 backdrop-blur-md"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-white/60">{description}</p>
      <div className="mt-4">
        {href ? (
          <DefaultButton asChild size="sm" className="w-full">
            <Link href={href}>Launch</Link>
          </DefaultButton>
        ) : (
          <DefaultButton size="sm" className="w-full" disabled>
            Coming soon
          </DefaultButton>
        )}
      </div>
    </motion.div>
  );
}
