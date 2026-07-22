"use client";

import type { ReactNode } from "react";

import styles from "./adds-console.module.css";

export type TreeNode = {
  id: string;
  icon: string;
  label: string;
  children?: TreeNode[];
};

export function MmcLayout({ tree, content, dialogs }: { tree: ReactNode; content: ReactNode; dialogs?: ReactNode }) {
  return (
    <div className={styles.mmcLayout}>
      <div className={styles.mmcTree}>{tree}</div>
      <div className={styles.mmcContent}>{content}</div>
      {dialogs}
    </div>
  );
}

export function MmcTreeNode({
  node,
  depth = 0,
  selected,
  expanded,
  onSelect,
  onToggle,
  onContextMenu,
}: {
  node: TreeNode;
  depth?: number;
  selected: string;
  expanded: Record<string, boolean>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isOpen = !!expanded[node.id];
  return (
    <div>
      <div
        className={`${styles.treeRow} ${selected === node.id ? styles.treeRowSelected : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => {
          if (hasChildren) onToggle(node.id);
          onSelect(node.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect(node.id);
          onContextMenu?.(e, node.id);
        }}
      >
        <span className={styles.twisty}>{hasChildren ? (isOpen ? "▾" : "▸") : ""}</span>
        <span className={styles.ti}>{node.icon}</span>
        <span className={styles.tlabel}>{node.label}</span>
      </div>
      {hasChildren && isOpen ? (
        <div>
          {node.children!.map((child) => (
            <MmcTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ContentHeading({ children }: { children: ReactNode }) {
  return <div className={styles.contentHeading}>{children}</div>;
}

export function ContentBody({ children, onContextMenu }: { children: ReactNode; onContextMenu?: (e: React.MouseEvent) => void }) {
  return (
    <div className={styles.contentBody} onContextMenu={onContextMenu}>
      {children}
    </div>
  );
}

export function ItemListTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <table className={styles.itemList}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function TabbedPanel({
  tabs,
  activeTab,
  onTabChange,
  renderTab,
}: {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  renderTab: (tab: string) => ReactNode;
}) {
  return (
    <div className={styles.tabs}>
      <div className={styles.tabsStrip}>
        {tabs.map((t) => (
          <div key={t} className={`${styles.tab} ${t === activeTab ? styles.tabActive : ""}`} onClick={() => onTabChange(t)}>
            {t}
          </div>
        ))}
      </div>
      <div className={styles.tabPanel}>{renderTab(activeTab)}</div>
    </div>
  );
}

export function ListBox({
  items,
  selected,
  onSelect,
  multi = false,
  height,
}: {
  items: { key: string; label: string }[];
  selected: string[];
  onSelect: (keys: string[]) => void;
  multi?: boolean;
  height?: number;
}) {
  return (
    <div className={styles.listBox} style={height ? { height } : undefined}>
      {items.map((it) => (
        <div
          key={it.key}
          className={`${styles.lbItem} ${selected.includes(it.key) ? styles.lbItemSelected : ""}`}
          onClick={(e) => {
            if (multi && (e.ctrlKey || e.metaKey)) {
              onSelect(selected.includes(it.key) ? selected.filter((k) => k !== it.key) : [...selected, it.key]);
            } else {
              onSelect([it.key]);
            }
          }}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
