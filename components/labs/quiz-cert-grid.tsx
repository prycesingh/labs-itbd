"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

export function QuizCertGrid({ certs }: { certs: { id: string; code: string; name: string }[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {certs.map((cert, i) => (
        <motion.div
          key={cert.id}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          whileHover={reduce ? undefined : { y: -4 }}
          transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={`/dashboard/labs/quizzes/${cert.id}`}
            className="itbd-glow-border relative flex h-full flex-col overflow-hidden rounded-2xl bg-black/40 p-5 backdrop-blur-md transition-colors hover:bg-white/5"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
            />
            <h3 className="font-semibold text-itbd-blue">{cert.code}</h3>
            <p className="mt-1 text-sm leading-relaxed text-white/60">{cert.name}</p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
