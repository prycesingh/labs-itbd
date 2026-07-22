"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import styles from "./azure-portal.module.css";

export function CliPanel({ title, command, onClose }: { title: string; command: string; onClose: () => void }) {
  const [visible, setVisible] = useState(true);

  return (
    <AnimatePresence onExitComplete={onClose}>
      {visible ? (
        <motion.div
          key="cli-overlay"
          className={styles.cliOverlay}
          onClick={() => setVisible(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      ) : null}
      {visible ? (
        <motion.div
          key="cli-panel"
          className={styles.cliPanel}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div className={styles.cliHead}>
            <div>
              <b>{title}</b>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                Copy and run in Bash / PowerShell after logging in with <code>az login</code>
              </div>
            </div>
            <button type="button" className={styles.cliClose} onClick={() => setVisible(false)} aria-label="Close">
              ×
            </button>
          </div>
          <pre className={styles.cliBody}>
            <code>{command}</code>
          </pre>
          <div className={styles.cliFoot}>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(command);
                  toast.success("CLI command copied to clipboard");
                } catch {
                  toast.error("Copy blocked by browser");
                }
              }}
            >
              Copy to clipboard
            </button>
            <div style={{ flex: 1 }} />
            <button type="button" className={styles.btn} onClick={() => setVisible(false)}>
              Close
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
