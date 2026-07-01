"use client";

import DefaultButton from "@/components/app_componentes/customButtons";
import { cn } from "@/lib/utils";
import { ArrowRight, Cog, MessagesSquare } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

/**
 * Icons live INSIDE this client component and are selected by a string key —
 * a lucide component can't be passed as a prop from the server page across the
 * RSC boundary (functions aren't serializable).
 */
const ICONS = {
  technical: Cog,
  communication: MessagesSquare,
} as const;

export type LabCardIcon = keyof typeof ICONS;

/**
 * Feature card for the landing-page bottom row (grid divs 7 & 8):
 * "Technical Lab" and "Communication Lab".
 *
 * Matches the login-card family: `itbd-glow-border` + translucent blurred
 * surface, with the same cursor-follow spotlight hover used in `loginCard.tsx`
 * so the whole page reads as one product. Enters with a `whileInView` fade+rise
 * and lifts slightly on hover.
 *
 * Brand: `accent` tints the icon + a hairline top border. Blue is the primary
 * accent; green is used only as this sparing icon/border accent (never a solid
 * green fill). The "Explore →" CTA is always the blue `DefaultButton`.
 *
 * `prefers-reduced-motion`: no entrance travel, no hover lift, no spotlight —
 * the card renders static and fully readable.
 *
 * The "Explore →" button is a styled placeholder for now (no handler).
 */
export function LabCard({
  icon,
  title,
  description,
  accent = "blue",
  className,
}: {
  icon: LabCardIcon;
  title: string;
  description: string;
  accent?: "blue" | "green";
  className?: string;
}) {
  const Icon = ICONS[icon];
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const accentText = accent === "green" ? "text-itbd-green" : "text-itbd-blue";
  const spotlightRGB =
    accent === "green" ? "190,214,47" : "0,175,221"; // green / blue

  return (
    <motion.div
      ref={ref}
      onPointerMove={reduce ? undefined : onMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "itbd-glow-border relative flex w-full flex-col overflow-hidden rounded-2xl bg-black/40 p-5 backdrop-blur-md sm:p-6",
        className,
      )}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Hairline accent along the top edge */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-px",
          accent === "green"
            ? "bg-linear-to-r from-transparent via-itbd-green to-transparent"
            : "bg-linear-to-r from-transparent via-itbd-blue to-transparent",
        )}
      />

      {/* Cursor-follow spotlight (skipped under reduced motion) */}
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
          style={{
            opacity: hovered ? 0.4 : 0,
            background: `radial-gradient(260px circle at ${pos.x}px ${pos.y}px, rgba(${spotlightRGB},0.16), transparent 70%)`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col">
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5",
              accentText,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-extrabold tracking-wide text-white uppercase sm:text-xl">
            {title}
          </h3>
        </div>

        {/* Blurb */}
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {description}
        </p>

        {/* CTA — styled placeholder (no destination yet). Blue per brand. */}
        <div className="mt-4">
          <DefaultButton size="sm" className="gap-2">
            Explore
            <ArrowRight className="h-4 w-4" />
          </DefaultButton>
        </div>
      </div>
    </motion.div>
  );
}
