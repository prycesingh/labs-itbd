"use client";

// Shared UI primitives for the NetSim Pro learning-platform simulator,
// following the Meraki/Power-Platform/Purview/Sentinel/Defender/
// Azure-DevOps `*-ui.tsx` pattern: small, presentation-only components that
// wrap netsim-console.module.css classes so page-building agents never
// hand-write `neu-*`/`holo-*`-equivalent class names directly. Only minor
// one-off inline `style={{}}` (computed widths, ring stroke offsets, accent
// colors passed as props) is used — all real visual styling lives in the
// CSS module.
//
// Source (itbd-lab/simulators/network/index.html + js/*.js) renders
// everything via string-templated innerHTML and toggles `.active`/inline
// styles directly on the DOM (see `.modal-overlay.active`, `.tab-content
// .active`, notification auto-dismiss via CSS animation). These primitives
// reproduce the same visual behavior as real React components: `Modal` is
// conditionally rendered by the caller (no internal open/closed state),
// and the toast system uses a small module-level pub/sub store + a timer
// per toast so `useToast()` works from any client component without lifting
// toast state through every page.

import { useCallback, useEffect, useState, type ReactNode } from "react";

import styles from "./netsim-console.module.css";

// ===== Card primitives =====
// Source's `.neu-card` (raised neumorphic card, hover lift) and
// `.holo-border` (rotating rainbow-gradient border) are folded into one
// flexible `Card` with a `variant` prop, per the task's suggested "your
// call" — a single component reduces duplication across the 5 in-scope
// pages that all reach for "a card" far more often than they reach for a
// specific card flavor.
export type CardVariant = "neu" | "neuFlat" | "holo" | "glass" | "inset";

export function Card({
  variant = "neu",
  clickable,
  className,
  onClick,
  children,
}: {
  variant?: CardVariant;
  clickable?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const variantClass =
    variant === "neuFlat" ? styles.neuCardFlat :
    variant === "holo" ? styles.holoBorder :
    variant === "glass" ? styles.glassPanel :
    variant === "inset" ? styles.neuInset :
    styles.neuCard;
  const classes = [variantClass, clickable ? styles.neuCardClickable : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

// Convenience aliases matching the source class names 1:1, for callers that
// want the explicit name rather than remembering a variant string.
export function NeuCard({ className, clickable, onClick, children }: { className?: string; clickable?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <Card variant="neu" className={className} clickable={clickable} onClick={onClick}>
      {children}
    </Card>
  );
}

export function HoloBorder({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Card variant="holo" className={className}>
      {children}
    </Card>
  );
}

// ===== Badge =====
export type BadgeTone = "blue" | "green" | "yellow" | "purple" | "red";

export function Badge({ tone = "blue", children }: { tone?: BadgeTone; children: ReactNode }) {
  const toneClass =
    tone === "green" ? styles.badgeGreen :
    tone === "yellow" ? styles.badgeYellow :
    tone === "purple" ? styles.badgePurple :
    tone === "red" ? styles.badgeRed :
    styles.badgeBlue;
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

// ===== Progress bar =====
// Matches source's `.progress-bar`/`.progress-fill` (index.html:472-485),
// used per-module on the Dashboard's "Learning Modules" grid.
export function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

// ===== Progress ring =====
// Circular SVG ring matching source's Dashboard hero (index.html:683-699):
// a track circle + a gradient-stroked progress circle animated via
// stroke-dashoffset, with the percentage centered as text. Source hardcodes
// r=42/size=100; both are parameterized here (default to source's values)
// so it can be reused at a smaller size if a future page wants one.
let ringGradientCounter = 0;

export function ProgressRing({
  value,
  max,
  size = 100,
  strokeWidth = 8,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const [gradientId] = useState(() => `netsimHoloGrad${ringGradientCounter++}`);
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * pct) / 100;
  const center = size / 2;

  return (
    <div className={styles.progressRingWrap}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={r} fill="none" stroke="var(--neu-bg-dark)" strokeWidth={strokeWidth} />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff006e" />
              <stop offset="33%" stopColor="#8338ec" />
              <stop offset="66%" stopColor="#3a86ff" />
              <stop offset="100%" stopColor="#06d6a0" />
            </linearGradient>
          </defs>
          <text x={center} y={center} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.2} fontWeight={800} fill="var(--text-primary)">
            {pct}%
          </text>
        </svg>
      </div>
      {label ? <div className={styles.progressRingLabel}>{label}</div> : null}
    </div>
  );
}

// ===== Stat card =====
// Matches source's Dashboard stat-row cells (index.html:704-725): big emoji
// icon, big number/value, small label caption.
export function StatCard({ icon, label, value, sub, valueColor }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; valueColor?: string }) {
  return (
    <Card className={undefined} clickable={false}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: valueColor ?? "var(--text-primary)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
        {sub ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div> : null}
      </div>
    </Card>
  );
}

// ===== Buttons =====
// Thin wrappers so page-building agents reach for `<PrimaryButton>` /
// `<GhostButton>` instead of hand-assembling `styles.btn` + variant class
// strings. Matches source's `.btn.btn-primary` / `.btn.btn-ghost`.
export function PrimaryButton({
  onClick,
  small,
  className,
  children,
}: {
  onClick?: () => void;
  small?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = [styles.btn, styles.btnPrimary, small ? styles.btnSm : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

export function GhostButton({
  onClick,
  small,
  fullWidthLeft,
  className,
  children,
}: {
  onClick?: () => void;
  small?: boolean;
  fullWidthLeft?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = [styles.btn, styles.btnGhost, small ? styles.btnSm : "", fullWidthLeft ? styles.btnGhostLeft : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

// ===== Modal =====
// Centered dialog matching source's `.modal-overlay`/`.modal`
// (index.html:552-578). Caller controls visibility by conditionally
// rendering `<Modal>` — no internal open state, matching every other
// simulator's Modal primitive in this app.
export function Modal({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ===== Toast / notification system =====
// Matches source's `NetSim.notify(message, type)` (auto-dismiss after 3s,
// stacked top-right, index.html:507-539). Implemented as a tiny module-level
// pub/sub store rather than React context, so any client component can call
// `notify(...)` directly (matching source's global `NetSim.notify` being
// callable from anywhere) while `<ToastContainer />` — mounted once by
// netsim-shell.tsx — is the only subscriber that actually renders them.
export type ToastType = "success" | "error" | "info" | "warning";
export type Toast = { id: number; message: string; type: ToastType };

type ToastListener = (toasts: Toast[]) => void;

let toastIdCounter = 0;
let toastState: Toast[] = [];
const toastListeners = new Set<ToastListener>();

function emitToasts() {
  toastListeners.forEach((listener) => listener(toastState));
}

/** Push a toast; matches source's 3-second auto-dismiss. Callable from anywhere. */
export function notify(message: string, type: ToastType = "info") {
  const id = toastIdCounter++;
  toastState = [...toastState, { id, message, type }];
  emitToasts();
  setTimeout(() => {
    toastState = toastState.filter((t) => t.id !== id);
    emitToasts();
  }, 3000);
}

/** Hook form of `notify`, for symmetry with other simulators' `useToast()` primitives. */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(toastState);

  useEffect(() => {
    const listener: ToastListener = (next) => setToasts(next);
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return { toasts, notify };
}

export function ToastContainer() {
  const { toasts } = useToast();
  const dismiss = useCallback((id: number) => {
    toastState = toastState.filter((t) => t.id !== id);
    emitToasts();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.notificationContainer}>
      {toasts.map((t) => {
        const toneClass =
          t.type === "success" ? styles.notificationSuccess :
          t.type === "error" ? styles.notificationError :
          t.type === "warning" ? styles.notificationWarning :
          styles.notificationInfo;
        return (
          <div key={t.id} className={`${styles.notification} ${toneClass}`} onClick={() => dismiss(t.id)}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

// ===== Accordion / expandable card =====
// Structural addition (source's Learn/Troubleshoot/Scenarios/Reference pages
// each hand-roll expand/collapse via inline onclick + class toggling) —
// consolidated here so the 4 pages that need it share one implementation.
export function Accordion({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className={styles.accordionHeader} onClick={onToggle}>
        {title}
        <span className={`${styles.accordionCaret} ${expanded ? styles.accordionCaretOpen : ""}`}>&#9656;</span>
      </div>
      {expanded ? <div className={styles.accordionBody}>{children}</div> : null}
    </Card>
  );
}

// ===== kbd =====
// Matches source's inline-styled <kbd> elements (index.html:994-1025) used
// on the Dashboard's Keyboard Shortcuts grid.
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
