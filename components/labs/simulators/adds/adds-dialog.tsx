"use client";

import { type ReactNode, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

import styles from "./adds-console.module.css";

export type AddsDialogButton = {
  label: string;
  primary?: boolean;
  /** Return false to keep the dialog open (validation failed / multi-step wizard). */
  onClick?: () => boolean | void;
};

export function AddsDialog({
  title,
  width,
  onClose,
  buttons,
  children,
}: {
  title: string;
  width?: string;
  onClose: () => void;
  buttons?: AddsDialogButton[];
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <AnimatePresence>
      <motion.div
        className={styles.dlgOverlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          className={styles.dlg}
          style={width ? { width } : undefined}
          initial={{ opacity: 0, scale: 0.97, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <div className={styles.dlgTitle}>
            <span>{title}</span>
            <button type="button" className={styles.dlgClose} onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className={styles.dlgBody} ref={bodyRef}>
            {children}
          </div>
          {buttons && buttons.length > 0 ? (
            <div className={styles.dlgFooter}>
              {buttons.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  className={b.primary ? styles.btnPrimary : styles.btn}
                  onClick={() => {
                    const result = b.onClick ? b.onClick() : true;
                    if (result !== false) onClose();
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.formRow}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function CheckboxRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.checkboxRow}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.formSection}>
      <b>{title}</b>
      {children}
    </div>
  );
}

export function HelpText({ children }: { children: ReactNode }) {
  return <div className={styles.helpText}>{children}</div>;
}

export function EmptyPane({ children }: { children: ReactNode }) {
  return <div className={styles.emptyPane}>{children}</div>;
}
