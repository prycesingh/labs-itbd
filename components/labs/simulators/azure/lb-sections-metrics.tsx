"use client";

import { useMemo } from "react";

import styles from "./azure-portal.module.css";

function Bars({ heights }: { heights: number[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 160,
        border: "1px solid #edebe9",
        borderRadius: 2,
        background: "#faf9f8",
        padding: 8,
      }}
    >
      {heights.map((h, i) => (
        <div key={i} style={{ flex: 1, height: `${h}%`, background: "#0078d4", borderRadius: "2px 2px 0 0" }} />
      ))}
    </div>
  );
}

export function SecMetrics() {
  const heights = useMemo(() => Array.from({ length: 24 }, () => 20 + Math.random() * 70), []);
  return (
    <div className={styles.sectionCard}>
      <h3>Metrics</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Data path availability</option>
          <option>Health probe status</option>
          <option>Byte count</option>
          <option>SYN count</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Avg</option>
          <option>Min</option>
          <option>Max</option>
        </select>
        <select className={styles.select} style={{ width: "auto" }}>
          <option>Last 24 hours</option>
          <option>Last hour</option>
        </select>
      </div>
      <Bars heights={heights} />
    </div>
  );
}
