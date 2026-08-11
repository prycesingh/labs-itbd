"use client";

import TextType from "@/components/TextType";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Hero headline for the landing page (grid div 2).
 *
 * Three brand words stacked on three lines — PRACTICE. / PERFORM. / EXCEL. —
 * revealed CUMULATIVELY by a typewriter: line 1 types and stays, then line 2
 * types below it and stays, then line 3. After the third finishes (plus a
 * pause) the whole sequence restarts — a sequential infinite loop.
 *
 * Each line is its own single-shot `TextType` (`loop={false}`) with a staggered
 * `initialDelay` so line N only begins once line N-1 has finished typing. A
 * `cycle` key remounts all three to replay the sequence.
 *
 * `prefers-reduced-motion`: skip typing and render the three words static.
 */

const TYPING_SPEED = 70; // ms per character
const GAP_BETWEEN_LINES = 300; // ms pause before the next line starts
const HOLD_AFTER_LAST = 2200; // ms the full headline stays before replaying

type Line = { text: string; color: string };

const LINES: Line[] = [
  { text: "PRACTICE", color: "#ffffff" },
  { text: "PERFORM", color: "var(--itbd-blue)" },
  { text: "EXCEL", color: "var(--itbd-green)" },
];

// When each line should START typing = sum of prior lines' typing time + gaps.
const startDelays = LINES.reduce<number[]>((acc, line, i) => {
  if (i === 0) return [0];
  const prev = LINES[i - 1];
  acc.push(acc[i - 1] + prev.text.length * TYPING_SPEED + GAP_BETWEEN_LINES);
  return acc;
}, []);

// Total time for the whole sequence to finish typing, then the replay interval.
const lastLine = LINES[LINES.length - 1];
const totalTypeMs =
  startDelays[startDelays.length - 1] + lastLine.text.length * TYPING_SPEED;
const CYCLE_MS = totalTypeMs + HOLD_AFTER_LAST;

const TAGLINE = "Real-world labs   ✦   Real skills   ✦   Real impact";

export function HeroHeadline({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  // Restart the stacked sequence on an interval (the "infinite loop").
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center overflow-hidden",
        className,
      )}
    >
      <h1 className="flex flex-col gap-1 text-3xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl">
        {reduce
          ? // Static, fully readable fallback — all three words stacked.
            LINES.map((line) => (
              <span key={line.text} style={{ color: line.color }}>
                {line.text}
              </span>
            ))
          : LINES.map((line, i) => (
              <TextType
                // key includes `cycle` so all three remount to replay together.
                key={`${cycle}-${line.text}`}
                as="span"
                text={line.text}
                typingSpeed={TYPING_SPEED}
                initialDelay={startDelays[i]}
                loop={false}
                // Only the last line keeps a blinking cursor once done.
                showCursor={i === LINES.length - 1}
                cursorCharacter="_"
                cursorClassName="text-itbd-blue"
                className="block whitespace-nowrap"
                style={{ color: line.color }}
              />
            ))}
      </h1>

      <p className="mt-6 text-base font-light tracking-wide text-white/70 sm:text-lg">
        {TAGLINE}
      </p>
    </div>
  );
}
