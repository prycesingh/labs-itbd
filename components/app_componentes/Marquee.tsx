interface MarqueeProps {
  /** The text to scroll. A trailing separator (e.g. " | ") reads best at the loop seam. */
  text: string;
  /** Applied to the text spans — pass brand colour / size / weight here. */
  className?: string;
  /** Seconds for one full loop. Larger = slower. Defaults to the CSS 30s. */
  durationSeconds?: number;
}

/**
 * Pure-CSS infinite marquee. The track holds two identical copies of the text;
 * the `animate-marquee` keyframes (in globals.css) translate it by -50% so the
 * second copy lands exactly where the first began — a seamless loop that never
 * runs out. No JS, no measurement, honours `prefers-reduced-motion`.
 */
export default function Marquee({
  text,
  className,
  durationSeconds,
}: MarqueeProps) {
  return (
    <div className="w-full overflow-hidden">
      <div
        className="flex w-max whitespace-nowrap"
        style={{
          animation: `itbd-marquee ${durationSeconds ?? 30}s linear infinite`,
          willChange: "transform",
        }}
      >
        {/* Second copy is decorative — hide it from the accessibility tree. */}
        <span className={className}>{text}</span>
        <span className={className} aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
}
