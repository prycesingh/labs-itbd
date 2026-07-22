"use client";

// Shared UI primitives for the Wireshark packet-capture workbench simulator.
// Same general spirit as the Power-Platform/Purview/Sentinel/Defender/Azure-
// DevOps/Meraki `*-ui.tsx` files (presentation-only components wrapping
// wireshark-console.module.css classes so callers never hand-write `ws-*`
// strings), but this suite's primitive set is workbench-shaped, not
// portal-shaped: a real dropdown `MenuDropdown` (replacing source's
// `prompt()`-driven numbered submenus, wireshark-main.js:279-307) is the
// centerpiece, plus a generic `Modal` for the Statistics/Reference/TLS-keys/
// Coloring-rules modal-content agents, `DataTable` for tabular modal content,
// and small helpers (`StatusPill`, `IconButton`, `Tooltip`, `exportCsv`).

import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./wireshark-console.module.css";

// ===== Modal =====
// Generic centered overlay dialog. Used by the Statistics/Reference/TLS-keys/
// Coloring-rules/Saved-filters modal-content agents — this component owns
// only the backdrop/frame/header/close-button/footer chrome, never the body
// content (that's each modal-content agent's job).
export function Modal({
  title,
  onClose,
  width,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <div
        className={styles.modal}
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.modalHeader}>
          <span>{title}</span>
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

// ===== MenuDropdown =====
// A REAL dropdown menu — replaces source's `prompt()`-based numbered-submenu
// hack (`WSharkApp._menuClick`, wireshark-main.js:279-307). Click the label to
// open a popup list of items; click an item fires its `onSelect` and closes
// the popup. Uses the `.menuPopup`/`.mpItem`/`.mpShortcut`/`.mpSep` classes
// the source CSS anticipated but never had real markup for.
export type MenuDropdownItem =
  | { kind?: "item"; label: string; shortcut?: string; disabled?: boolean; onSelect: () => void }
  | { kind: "separator" };

export function MenuDropdown({
  label,
  items,
}: {
  label: string;
  items: MenuDropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={rootRef}>
      <button
        type="button"
        className={`${styles.menuItem} ${open ? styles.menuItemOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </button>
      {open ? (
        <div className={styles.menuPopup} role="menu">
          {items.map((item, i) =>
            item.kind === "separator" ? (
              <div key={`sep-${i}`} className={styles.mpSep} role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`${styles.mpItem} ${item.disabled ? styles.mpItemDisabled : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.shortcut ? <span className={styles.mpShortcut}>{item.shortcut}</span> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

// ===== StatusPill / Badge =====
// Capture-status badge (idle/capturing/stopped) for the title bar, plus a
// generic small pill other modal-content agents can reuse for row-level
// status (e.g. coloring-rule enabled/disabled).
export type StatusTone = "idle" | "capturing" | "stopped";

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const toneClass = tone === "capturing" ? styles.badgeCapturing : tone === "stopped" ? styles.badgeStopped : styles.badgeIdle;
  return (
    <span className={`${styles.captureBadge} ${toneClass}`}>
      <span className={styles.dot} />
      {children}
    </span>
  );
}

export function Badge({ tone = "idle", children }: { tone?: StatusTone; children: ReactNode }) {
  return <StatusPill tone={tone}>{children}</StatusPill>;
}

// ===== IconButton =====
// Small square toolbar-style button — used by the toolbar for capture/save
// actions and by modal-content agents for compact icon actions.
export function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className={styles.tbBtn} title={title} onClick={onClick} disabled={disabled} aria-label={title}>
      {children}
    </button>
  );
}

// ===== Tooltip =====
// Minimal native-title-based tooltip wrapper — the source app has no rich
// tooltip system, and a workbench toolbar's hover hints are adequately served
// by the native `title` attribute. Kept as a component so callers have one
// consistent way to add a hint without repeating `title=` everywhere.
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span title={label} style={{ display: "inline-flex" }}>
      {children}
    </span>
  );
}

// ===== DataTable =====
// Generic sortable-ready table, same general shape as every prior port's
// DataTable (Meraki/Power-Platform/Purview/Sentinel/Defender/Azure-DevOps):
// caller supplies column defs + rows, this renders the table/thead/tbody
// chrome, click-to-sort header affordance, and empty state. Sorting itself
// (if a modal wants it) is left to the caller via `onSort` — this component
// stays presentation-only.
export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  onSort?: () => void;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "No results.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${onRowClick ? styles.tableClickable : ""}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width, textAlign: c.align ?? "left" }}
                onClick={c.onSort}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "center", padding: 20 }}>
                <span className={styles.small}>{emptyMessage}</span>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ===== Tabs =====
// Simple tab bar for modal content (e.g. Statistics sub-tabs, Protocol
// Reference categories) — matches source's `.ws-tabs`/`.ws-tab` styling.
export function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <button key={t.key} type="button" className={`${styles.tab} ${active === t.key ? styles.tabActive : ""}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ===== Empty state =====
export function EmptyState({ message }: { message: string }) {
  return <div className={styles.empty}>{message}</div>;
}

// ===== CSV export =====
// Blob-based CSV export, matching the same signature convention used by every
// prior port (Meraki/Power-Platform/Purview/Sentinel/Defender/Azure-DevOps),
// so Save-As and future export features behave consistently.
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== JSON export =====
// Small sibling to exportCsv for "Save As" -> JSON, since a packet capture's
// natural interchange format is JSON (each packet's dissection tree doesn't
// flatten losslessly into CSV columns). Genuinely functional, not a stub.
export function exportJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
