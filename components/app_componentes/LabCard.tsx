"use client";

import DefaultButton from "@/components/app_componentes/customButtons";
import { cn } from "@/lib/utils";
import { ArrowRight, Cog, MessagesSquare, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
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

export type LabCardGridItem = { href: string; label: string; iconSrc: string };
export type LabCardListItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  tags: string[];
};

/**
 * A titled sub-section inside a card (e.g. Technical Lab → Simulators /
 * Guided Labs). The header row carries the section name, an optional count
 * and an optional "View all" link; the body is a grid or list as below.
 */
export type LabCardSection = {
  key: string;
  title: string;
  icon: LucideIcon;
  /** Short muted context next to the title, e.g. "15 consoles". */
  meta?: string;
  /** Header link (right side). */
  link?: { href: string; label: string };
  variant: "grid" | "list";
  gridItems?: LabCardGridItem[];
  listItems?: LabCardListItem[];
};

/**
 * Feature card for the landing page and dashboard "Lab Catalog" — Technical
 * Lab / Communication Lab.
 *
 * Matches the login-card family: `itbd-glow-border` + translucent blurred
 * surface, with the same cursor-follow spotlight hover used in `loginCard.tsx`
 * so the whole app reads as one product. Enters with a `whileInView` fade+rise
 * and lifts slightly on hover.
 *
 * Brand: `accent` tints the icon + a hairline top border. Blue is the primary
 * accent; green is used only as this sparing icon/border accent (never a solid
 * green fill).
 *
 * Two content variants:
 * - `grid` — a tight grid of small icon tiles (Technical Lab: featured
 *   simulators), each linking out, below a centered "View all" CTA.
 * - `list` — stacked module rows (Communication Lab), each with an icon,
 *   title, description, uppercase meta tags, and its own "Start Module" CTA,
 *   followed by a centered "View all" CTA.
 * - `sections` — titled sub-sections, each a grid or list with its own header
 *   link (dashboard Technical Lab: Simulators + Guided Labs). Overrides the
 *   single-variant props above.
 *
 * `prefers-reduced-motion`: no entrance travel, no hover lift, no spotlight —
 * the card renders static and fully readable.
 */
export function LabCard({
  icon,
  title,
  description,
  accent = "blue",
  className,
  href,
  variant,
  gridItems,
  listItems,
  ctaLabel = "Explore",
  ctaHref,
  sections,
}: {
  icon: LabCardIcon;
  title: string;
  description?: string;
  accent?: "blue" | "green";
  className?: string;
  href?: string;
  variant?: "grid" | "list";
  gridItems?: LabCardGridItem[];
  listItems?: LabCardListItem[];
  /** Overrides the CTA button's label (default "Explore"). */
  ctaLabel?: string;
  /** Overrides the CTA button's destination; falls back to `href`. */
  ctaHref?: string;
  /** Titled sub-sections; when given, replaces `variant`/`gridItems`/`listItems`. */
  sections?: LabCardSection[];
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
  const spotlightRGB = accent === "green" ? "190,214,47" : "0,175,221"; // green / blue
  const finalHref = ctaHref ?? href;

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
        <div className="flex gap-3">
          <span className={cn("flex shrink-0 items-center justify-center", accentText)}>
            <Icon className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 lg:h-16 lg:w-16" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h3
              className={cn(
                "text-lg font-bold tracking-wide uppercase sm:text-lg md:text-xl lg:text-2xl",
                accentText,
              )}
            >
              {title}
            </h3>
            <p className="text-xs leading-relaxed text-white/70 sm:text-sm">
              {description}
            </p>
          </div>
        </div>

        {sections ? (
          <div className="mt-5 flex flex-col">
            {sections.map((section, i) => (
              <section
                key={section.key}
                aria-labelledby={`labcard-${section.key}`}
                className={cn(i > 0 && "mt-5 border-t border-white/10 pt-5")}
              >
                <div className="mb-3 flex items-center gap-2">
                  <section.icon className={cn("h-4 w-4 shrink-0", accentText)} aria-hidden />
                  <h4 id={`labcard-${section.key}`} className="text-sm font-semibold text-white">
                    {section.title}
                  </h4>
                  {section.meta ? <span className="text-xs text-white/45">{section.meta}</span> : null}
                  {section.link ? (
                    <Link
                      href={section.link.href}
                      className={cn(
                        "group/sec ml-auto inline-flex items-center gap-1 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-itbd-blue focus-visible:outline-none",
                        accentText,
                      )}
                    >
                      {section.link.label}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/sec:translate-x-0.5" />
                    </Link>
                  ) : null}
                </div>
                {section.variant === "grid" && section.gridItems?.length ? (
                  <GridItems items={section.gridItems} className="mt-0" />
                ) : null}
                {section.variant === "list" && section.listItems?.length ? (
                  <ListItems items={section.listItems} accentText={accentText} className="mt-0" />
                ) : null}
              </section>
            ))}
          </div>
        ) : (
          <>
            {variant === "grid" && gridItems && gridItems.length > 0 ? <GridItems items={gridItems} /> : null}
            {variant === "list" && listItems && listItems.length > 0 ? (
              <ListItems items={listItems} accentText={accentText} />
            ) : null}
          </>
        )}

        {/* CTA pinned to the bottom. Blue per brand. Only rendered when a
            destination exists — no dead `#` placeholder link. */}
        {finalHref ? (
          <div className="mt-auto pt-5 text-center">
            <Link
              href={finalHref}
              className={cn(
                "group/cta relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-5 py-2 text-sm font-semibold transition-all duration-300",
                accent === "green"
                  ? "border-itbd-green/50 text-itbd-green hover:border-itbd-green hover:shadow-[0_0_20px_-4px_var(--itbd-green)]"
                  : "border-itbd-blue/50 text-itbd-blue hover:border-itbd-blue hover:shadow-[0_0_20px_-4px_var(--itbd-blue)]",
              )}
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
            </Link>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

const HAIRLINE = "linear-gradient(to right, transparent, var(--itbd-blue), transparent) 1";

/** Tight grid of icon tiles (simulator consoles). */
function GridItems({ items, className }: { items: LabCardGridItem[]; className?: string }) {
  return (
    <ul className={cn("mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5", className)}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-t border-b bg-white/5 p-1 text-center transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-itbd-blue focus-visible:outline-none"
            style={{ borderImage: HAIRLINE }}
          >
            <Image
              src={item.iconSrc}
              alt=""
              aria-hidden
              width={60}
              height={60}
              className="h-12 w-12 object-contain sm:h-15 sm:w-15"
            />
            <span className="line-clamp-2 text-[12px] leading-tight text-white/75">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Stacked module rows: icon, title, description, meta tags, Start CTA. */
function ListItems({
  items,
  accentText,
  className,
}: {
  items: LabCardListItem[];
  accentText: string;
  className?: string;
}) {
  return (
    <ul className={cn("mt-5 space-y-3", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-3 rounded-xl border-t border-b bg-white/5 p-3 transition-colors hover:bg-white/[0.07]"
          style={{ borderImage: HAIRLINE }}
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5", accentText)}>
            <item.icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/60">{item.description}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-[10px] font-medium tracking-wide text-white/40 uppercase">
              {item.tags.map((tag, i) => (
                <span key={tag}>
                  {tag}
                  {i < item.tags.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          </div>
          <DefaultButton size="xs" className="shrink-0 gap-1" asChild>
            <Link href={item.href} aria-label={`Start ${item.label}`}>
              Start
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </DefaultButton>
        </li>
      ))}
    </ul>
  );
}
