"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, useTransition } from "react";

/**
 * The login card on the unauthenticated landing page — a 3D flip card.
 *
 * FRONT (default): welcome copy, "LOG IN TO CONTINUE" banner, the real
 * Microsoft SSO button, and a small "Admin login" button.
 * BACK (flipped): credential fields (username, password, remember me, forgot
 * password) + a sign-in button — the credential path is admin-only.
 *
 * The flip is a Framer Motion `rotateY` on a `preserve-3d` container; each face
 * is `backface-hidden` and the back is pre-rotated 180°. Both faces are stacked
 * in a CSS grid cell so the card sizes to its TALLER face and never jumps height
 * mid-flip. `prefers-reduced-motion` swaps the 3D rotation for a cross-fade.
 *
 * The card fills its parent (h-full/w-full) so it occupies the whole grid cell
 * it's placed in; it stays responsive (single column on mobile, full cell at md+).
 *
 * NOTE: there is no credentials provider wired in this app — the admin form is
 * presentational and calls `onAdminSubmit` if provided, otherwise no-ops. Real
 * SSO is the only working path (the front button).
 */
export function LoginCard({
  signInAction,
  onAdminSubmit,
  className,
}: {
  signInAction: () => Promise<void>;
  onAdminSubmit?: (username: string, password: string) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  const flipT = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      className={cn(
        // Fill the grid cell but center the (content-sized) card within it, so
        // it stays compact instead of stretching to fill the tall cell.
        "flex h-full w-full items-center justify-center perspective-[2000px]",
        className,
      )}
    >
      <motion.div
        className="relative grid w-full transform-3d"
        animate={reduce ? undefined : { rotateY: flipped ? 180 : 0 }}
        // Subtle grow-on-hover (spring); the flip uses its own tween.
        whileHover={reduce ? undefined : { scale: 1.02 }}
        transition={{
          rotateY: flipT,
          scale: { type: "spring", stiffness: 300, damping: 22 },
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT face */}
        <Face side="front" flipped={flipped} reduce={reduce}>
          <FrontContent
            signInAction={signInAction}
            onFlip={() => setFlipped(true)}
          />
        </Face>

        {/* BACK face */}
        <Face side="back" flipped={flipped} reduce={reduce}>
          <AdminContent
            onBack={() => setFlipped(false)}
            onAdminSubmit={onAdminSubmit}
            active={flipped}
          />
        </Face>
      </motion.div>
    </div>
  );
}

/**
 * A single card face. Both faces occupy the same grid cell (row/col 1) so the
 * card sizes to the taller one. `backface-hidden` hides whichever face points
 * away. For reduced motion we cross-fade opacity instead of rotating.
 */
function Face({
  side,
  flipped,
  reduce,
  children,
}: {
  side: "front" | "back";
  flipped: boolean;
  reduce: boolean | null;
  children: React.ReactNode;
}) {
  const isVisible = side === "front" ? !flipped : flipped;

  if (reduce) {
    return (
      <div className="col-start-1 row-start-1 h-full w-full">
        <AnimatePresence>
          {isVisible && (
            <motion.div
              className="h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "col-start-1 row-start-1 h-full w-full backface-hidden transform-[translateZ(0)]",
        side === "back" && "transform-[rotateY(180deg)]",
      )}
      // Hide the face pointing away from taps/focus so its controls aren't
      // interactable while mirrored behind the visible face.
      aria-hidden={!isVisible}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
    >
      {children}
    </div>
  );
}

/**
 * Shared card shell: the glow/blur/rounded surface both faces share, plus two
 * cursor-follow hover effects (adapted from React Bits SpotlightCard + BorderGlow
 * to stay inside our own surface and not fight the 3D flip transforms):
 *   1. Spotlight — a soft radial ITBD-blue glow that tracks the pointer across
 *      the card surface.
 *   2. Border glow — a ring that brightens (green→blue) at the edge nearest the
 *      cursor, via a radial-gradient mask.
 * Both fade in on hover and out on leave. Reduced motion → static surface, no
 * tracking (the base `itbd-glow-border` still provides a resting glow).
 */
function CardShell({ children }: { children: React.ReactNode }) {
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

  // Static surface for reduced motion — no cursor tracking.
  if (reduce) {
    return (
      <div className="itbd-glow-border flex h-full w-full flex-col rounded-3xl bg-black/40 p-6 backdrop-blur-md sm:p-8">
        {children}
      </div>
    );
  }

  const active = hovered ? 1 : 0;

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="itbd-glow-border relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-black/40 p-6 backdrop-blur-md sm:p-8"
    >
      {/* Border glow — brightens at the edge nearest the cursor. A gradient
          painted on the border box, masked to a thin ring. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
        style={{
          opacity: active * 0.9,
          padding: "1px",
          background: `radial-gradient(200px circle at ${pos.x}px ${pos.y}px, var(--itbd-blue), var(--itbd-blue) 45%, transparent 75%)`,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Spotlight — soft radial glow following the cursor across the surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
        style={{
          opacity: active * 0.5,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, rgba(0,173,218,0.14), transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

/* ------------------------------- FRONT ---------------------------------- */

function FrontContent({
  signInAction,
  onFlip,
}: {
  signInAction: () => Promise<void>;
  onFlip: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <CardShell>
      {/* Welcome copy */}
      <div className="text-center">
        <p className="text-2xl font-bold text-itbd-blue sm:text-3xl">
          Welcome to IT by Design Lab
        </p>
        <p className="mx-auto mt-2 max-w-sm text-base leading-relaxed text-white/85">
          your all-in-one platform to master technology, communication, and
          workplace excellence.
        </p>
      </div>

      {/* Log in banner */}
      <div className="itbd-glow-border mt-6 rounded-full bg-white/3 py-4 text-center">
        <span className="text-xl font-extrabold tracking-wide sm:text-2xl">
          <span className="text-itbd-blue">LOG IN</span>{" "}
          <span className="text-white">TO CONTINUE</span>
        </span>
      </div>

      {/* Real auth path: Microsoft SSO */}
      <p className="mt-6 mb-4 text-center text-xs font-bold tracking-[0.2em] text-itbd-blue">
        USER LOGIN
      </p>

      <form action={() => startTransition(() => signInAction())}>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "itbd-glow-border flex w-full items-center justify-center gap-3 rounded-xl bg-black/60 py-3.5 font-semibold text-white transition",
            "hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itbd-blue",
            pending && "cursor-not-allowed opacity-70",
          )}
        >
          <MicrosoftLogo />
          {pending ? "Redirecting…" : "Sign in with Microsoft"}
        </button>
      </form>

      {/* Feature highlights — fill the front face so it doesn't read empty
          (both flip faces share the taller face's height for a stable flip). */}
      <ul className="my-6 space-y-3 text-sm text-white/70">
        {[
          "Hands-on technical & communication labs",
          "Real-world simulations, zero production risk",
          "Track, analyze, and improve your skills",
        ].map((f) => (
          <li key={f} className="flex items-center gap-3">
            <Check className="h-4 w-4 shrink-0 text-itbd-blue" />
            {f}
          </li>
        ))}
      </ul>

      {/* Admin login flip trigger — pinned to the bottom of the shared height */}
      <button
        type="button"
        onClick={onFlip}
        className={cn(
          "mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white/70 transition",
          "hover:border-itbd-blue hover:text-itbd-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itbd-blue",
        )}
      >
        <ShieldCheck className="h-4 w-4" />
        Admin login
      </button>
    </CardShell>
  );
}

/* -------------------------------- BACK ---------------------------------- */

function AdminContent({
  onBack,
  onAdminSubmit,
  active,
}: {
  onBack: () => void;
  onAdminSubmit?: (username: string, password: string) => void;
  active: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <CardShell>
      {/* Header with back control */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to sign-in options"
          tabIndex={active ? 0 : -1}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/70 transition",
            "hover:border-itbd-blue hover:text-itbd-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itbd-blue",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xl font-bold text-itbd-blue">Admin Login</p>
          <p className="text-sm text-white/85">
            Credential access is restricted to administrators.
          </p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onAdminSubmit?.(username.trim(), password.trim());
        }}
      >
        <input
          type="text"
          placeholder="Username or Email"
          autoComplete="username"
          tabIndex={active ? 0 : -1}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-itbd-blue focus:outline-none"
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            tabIndex={active ? 0 : -1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 pr-11 text-sm text-white placeholder:text-white/40 focus:border-itbd-blue focus:outline-none"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={active ? 0 : -1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white/70"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-white/60">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              tabIndex={active ? 0 : -1}
              className="accent-itbd-blue"
            />
            Remember me
          </label>
          <button
            type="button"
            tabIndex={active ? 0 : -1}
            className="font-semibold text-itbd-blue transition hover:text-white"
          >
            Forgot Password?
          </button>
        </div>

        {/* Blue is primary (2026 guidelines) → the working admin CTA. Black text
            on ITBD Blue for AA contrast at this weight. */}
        <button
          type="submit"
          tabIndex={active ? 0 : -1}
          className={cn(
            "mt-2 w-full rounded-xl bg-itbd-blue py-3.5 text-sm font-bold uppercase tracking-widest text-black transition",
            "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itbd-blue",
          )}
        >
          Sign in
        </button>
      </form>

      {/* User login — re-flips to the front. Mirrors the front's "Admin login". */}
      <button
        type="button"
        onClick={onBack}
        tabIndex={active ? 0 : -1}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white/70 transition",
          "hover:border-itbd-blue hover:text-itbd-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itbd-blue",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        User login
      </button>
    </CardShell>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
