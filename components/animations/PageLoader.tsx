"use client";

import CountUp from "@/components/CountUp";
import DecryptedText from "@/components/DecryptedText";
import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useEffect, useState } from "react";

/**
 * Boot-sequence preloader for the landing page.
 *
 * Modeled on the reference boot screen: a left-aligned status block streams
 * environment lines ("Mounting simulator environments … OK") ONE BY ONE — each
 * line decrypts to completion before the next begins — while a 0→100% counter
 * climbs in lock-step so it lands on 100 exactly as the final line resolves.
 * Then the screen splits — top panel lifts, bottom panel drops — to reveal the
 * page beneath.
 *
 * Both split panels use ONE flat background color (`--loader-bg`) so the seam is
 * invisible while covered and the two halves read as a single continuous screen
 * (matching the reference, which used a single flat `--bg`).
 *
 * Timing model (why it's driven by state, not CSS stagger):
 * - Each line reveals sequentially in `charDelay` ms/char (sequential decrypt),
 *   plus a `LINE_GAP` pause. We advance `activeLine` with a timer chain so line
 *   N+1 only starts once line N has fully resolved.
 * - The counter's `duration` is set to the WHOLE sequence length, so it fills
 *   smoothly across the exact span the lines take — finishing with the last one.
 * - The reveal fires when the last line completes (single source of truth),
 *   NOT off the counter, so they can't drift apart.
 *
 * Building blocks:
 * - `CountUp` (React Bits) drives the number via useSpring over the full span.
 * - `DecryptedText` (React Bits) does the hacker-style glyph scramble per line.
 * - `AnimatePresence` plays the panel `exit` (a `y` transform — NOT clip-path,
 *   which isn't reliably compositor-accelerated) then unmounts.
 *
 * A11y / reliability:
 * - `prefers-reduced-motion` skips the counter/scramble/split and does a short
 *   opacity fade instead.
 * - Page content lives behind this overlay and is never gated on it — if
 *   animation fails the overlay simply unmounts.
 */

const BOOT_LINES = [
  "Mounting simulator environments",
  "Loading technical lab",
  "Loading communication lab",
  "Securing session",
] as const;

/** ms per character while a line decrypts (sequential reveal cadence). */
const CHAR_DELAY = 32;
/** ms pause after a line fully resolves before the next one starts. */
const LINE_GAP = 320;

/** How long (ms) each line takes to fully reveal: chars * cadence + gap. */
const lineDurationMs = (text: string) => text.length * CHAR_DELAY + LINE_GAP;

/**
 * Floating-blob backdrop for the loader — a few large, soft, blurred radial
 * blobs in ITBD blue/green that drift slowly behind the boot text. Sits above
 * the flat panel fill but below the boot content, so it splits away with the
 * panels on reveal and never bleeds onto the page. Animates transform/opacity
 * only. Static (no drift) under reduced motion.
 */
function BootBackdrop({ reduce }: { reduce: boolean | null }) {
  const blobs = [
    {
      className: "left-[-10%] top-[-10%] bg-[radial-gradient(circle,var(--itbd-blue),transparent_70%)]",
      size: "h-[42vmax] w-[42vmax]",
      drift: { x: [0, 60, 0], y: [0, 40, 0] },
      duration: 16,
    },
    {
      className: "right-[-12%] bottom-[-12%] bg-[radial-gradient(circle,var(--itbd-green),transparent_70%)]",
      size: "h-[38vmax] w-[38vmax]",
      drift: { x: [0, -50, 0], y: [0, -30, 0] },
      duration: 20,
    },
    {
      className: "left-[40%] top-[30%] bg-[radial-gradient(circle,var(--itbd-blue),transparent_70%)]",
      size: "h-[28vmax] w-[28vmax]",
      drift: { x: [0, 40, 0], y: [0, -40, 0] },
      duration: 14,
    },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute rounded-full opacity-15 blur-3xl",
            b.size,
            b.className,
          )}
          animate={reduce ? undefined : b.drift}
          transition={
            reduce
              ? undefined
              : {
                  duration: b.duration,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }
          }
        />
      ))}
    </div>
  );
}

export function PageLoader({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"loading" | "reveal" | "gone">("loading");
  // Index of the line currently decrypting; lines > this stay hidden.
  const [activeLine, setActiveLine] = useState(0);

  const finish = () => setPhase((p) => (p === "loading" ? "reveal" : p));

  // Total time the whole streamed sequence takes — drives the counter span so
  // it lands on 100 in sync with the final line.
  const totalMs = reduce
    ? 300
    : BOOT_LINES.reduce((sum, l) => sum + lineDurationMs(l), 0);

  // Chain the lines: reveal one, wait its duration, reveal the next; after the
  // last resolves, trigger the split reveal. Reduced motion skips straight to it.
  useEffect(() => {
    if (reduce) {
      const t = setTimeout(finish, totalMs);
      return () => clearTimeout(t);
    }
    if (activeLine >= BOOT_LINES.length) {
      finish();
      return;
    }
    const t = setTimeout(
      () => setActiveLine((i) => i + 1),
      lineDurationMs(BOOT_LINES[activeLine]),
    );
    return () => clearTimeout(t);
  }, [activeLine, reduce, totalMs]);

  const panelT = { duration: 0.9, ease: [0.76, 0, 0.24, 1] as const };
  const topPanel: Variants = {
    initial: { y: 0 },
    exit: reduce ? { opacity: 0 } : { y: "-100%", transition: panelT },
  };
  const bottomPanel: Variants = {
    initial: { y: 0 },
    exit: reduce
      ? { opacity: 0 }
      : { y: "100%", transition: { ...panelT, delay: 0.06 } },
  };
  const core: Variants = {
    initial: { opacity: 1 },
    exit: reduce
      ? { opacity: 0 }
      : { opacity: 0, transition: { duration: 0.35, ease: "easeIn" } },
  };
  const seam: Variants = {
    initial: { scaleX: 0, opacity: 0 },
    exit: reduce
      ? { opacity: 0 }
      : {
          scaleX: [0, 1, 1],
          opacity: [0, 1, 0],
          transition: { duration: 0.7, ease: "easeInOut" },
        },
  };

  // Per-line entrance (each row fades/slides in when it becomes active).
  const line: Variants = {
    hidden: { opacity: 0, x: reduce ? 0 : -8 },
    shown: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <AnimatePresence onExitComplete={() => setPhase("gone")}>
      {phase === "loading" && (
        <motion.div
          key="page-loader"
          className={cn(
            "fixed inset-0 z-100 overflow-hidden text-white",
            // Flat loader background as a CSS var used by both panels.
            "[--loader-bg:#03111d]",
            className,
          )}
          aria-hidden="true"
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Twin panels — identical flat fill so the split is seamless */}
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2 bg-(--loader-bg)"
            variants={topPanel}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-(--loader-bg)"
            variants={bottomPanel}
          />

          {/* ITBD Blue seam that flashes across the split at reveal */}
          <motion.div
            className="absolute inset-x-0 top-1/2 h-0.5 origin-center -translate-y-1/2 bg-itbd-blue"
            style={{ boxShadow: "0 0 24px 2px var(--itbd-blue)" }}
            variants={seam}
          />

          {/* Content: a single left-aligned boot block, vertically centered.
              The floating-blob backdrop lives inside this layer so it fades out
              with the content on reveal (and the panels split over it). */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center px-6"
            variants={core}
          >
            <BootBackdrop reduce={reduce} />
            <div className="relative w-full max-w-lg font-mono">
              {/* Brand */}
              <div className="mb-6 text-2xl font-extrabold tracking-[0.15em] sm:text-3xl">
                <span className="text-white">IT BY </span>
                <span className="text-itbd-blue">DESIGN</span>
              </div>

              {/* Streaming status lines — revealed one at a time. Line N only
                  appears (and starts decrypting) once line N-1 has resolved.
                  `OK` fades in after its line finishes decrypting. */}
              <ul className="space-y-2 text-xs tracking-[0.12em] text-white/50 sm:text-sm">
                {BOOT_LINES.map((l, i) => {
                  // Line i starts decrypting when it becomes the active line.
                  const started = reduce || i <= activeLine;
                  // Line i is resolved once the sequence has moved past it.
                  const resolved = reduce || i < activeLine;
                  return (
                    <motion.li
                      key={l}
                      className="flex items-center justify-between gap-4 uppercase"
                      variants={line}
                      initial="hidden"
                      animate={started ? "shown" : "hidden"}
                    >
                      <span className="truncate">
                        {reduce || !started ? (
                          l
                        ) : (
                          <DecryptedText
                            text={l}
                            animateOn="view"
                            sequential
                            speed={CHAR_DELAY}
                            revealDirection="start"
                            className="text-white/50"
                            encryptedClassName="text-itbd-blue/40"
                          />
                        )}
                      </span>
                      {/* Green kept here only as the single "success" accent
                          (per 2026 guidelines: green = sparing/emergency use). */}
                      <motion.span
                        className="shrink-0 font-semibold text-itbd-green"
                        initial={false}
                        animate={{ opacity: resolved ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        OK
                      </motion.span>
                    </motion.li>
                  );
                })}
              </ul>

              {/* Counter + progress bar */}
              <div className="mt-8">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[0.7rem] uppercase tracking-[0.3em] text-itbd-blue/70">
                    Loading Lab
                  </span>
                  <span className="flex items-baseline gap-1 tabular-nums">
                    {reduce ? (
                      <span className="text-3xl font-extrabold text-itbd-blue">
                        100
                      </span>
                    ) : (
                      <CountUp
                        to={100}
                        /* Spring settles asymptotically, so give it ~85% of the
                           span to reach 100 with a beat to spare before the
                           split — otherwise it still reads ~98 at reveal. */
                        duration={(totalMs / 1000) * 0.85}
                        className="text-3xl font-extrabold text-itbd-blue"
                      />
                    )}
                    <span className="text-lg font-bold text-itbd-blue">%</span>
                  </span>
                </div>

                <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full w-full origin-left rounded-full bg-linear-to-r from-itbd-blue to-itbd-green"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: totalMs / 1000, ease: "linear" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
