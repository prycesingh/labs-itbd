"use client";

import styles from "./azure-portal.module.css";

export function SecPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.sectionCard}>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}
