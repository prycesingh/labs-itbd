"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

export function SimulatorLaunchCard({
  title,
  description,
  href,
  logoSrc,
  index = 0,
}: {
  title: string;
  description: string;
  href?: string;
  logoSrc?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const disabled = !href;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="itbd-glow-border group relative flex h-full overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
      />

      {/* Logo panel — fills the left half of the card. */}
      <div className="relative flex w-2/5 shrink-0 items-center justify-center bg-white/5 p-4">
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-itbd-blue/40 to-transparent"
        />
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt=""
            aria-hidden
            width={96}
            height={96}
            className="h-16 w-16 object-contain transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20"
          />
        ) : null}
      </div>

      {/* Content — title, description, and the round launch control. */}
      <div className="relative z-10 flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="flex-1 text-sm leading-relaxed text-white/60">{description}</p>

        <div className="mt-2 flex items-center justify-end">
          {disabled ? (
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/40">
              Coming soon
            </span>
          ) : (
            <Link
              href={href}
              aria-label={`Launch ${title}`}
              className="group/launch relative flex items-center"
            >
              {/* "Launch" label — hidden, slides out from behind the avatar on hover. */}
              <span
                className={
                  "mr-2 max-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap text-itbd-blue opacity-0 " +
                  "transition-all duration-300 ease-out group-hover/launch:max-w-24 group-hover/launch:opacity-100"
                }
              >
                Launch
              </span>
              <span
                className={
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-itbd-blue/50 bg-itbd-blue/10 text-itbd-blue " +
                  "transition-colors duration-300 group-hover/launch:border-itbd-blue group-hover/launch:bg-itbd-blue group-hover/launch:text-black " +
                  "group-hover/launch:shadow-[0_0_20px_-4px_var(--itbd-blue)]"
                }
              >
                <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover/launch:translate-x-0.5" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
