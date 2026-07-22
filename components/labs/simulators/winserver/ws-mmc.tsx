"use client";

import type { ReactNode } from "react";

import styles from "./winserver-console.module.css";

export type WsTreeNode = {
  id: string;
  icon: string;
  label: string;
  children?: WsTreeNode[];
};

export function MmcLayout({ tree, content, actions, dialogs }: { tree: ReactNode; content: ReactNode; actions?: ReactNode; dialogs?: ReactNode }) {
  return (
    <div className={styles.mmcLayout}>
      <div className={styles.mmcTree}>{tree}</div>
      <div className={styles.mmcContent}>{content}</div>
      {actions ? <div className={styles.mmcActions}>{actions}</div> : null}
      {dialogs}
    </div>
  );
}

export function ActionsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.apGroup}>
      <div className={styles.apGroupTitle}>{title}</div>
      {children}
    </div>
  );
}

export function ActionItem({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <div className={`${styles.apItem} ${disabled ? styles.apItemDisabled : ""}`} onClick={disabled ? undefined : onClick}>
      {label}
    </div>
  );
}

export function SplitVert({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <div className={styles.splitVert}>
      <div className={styles.svTop}>{top}</div>
      <div className={styles.svBottom}>{bottom}</div>
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
  node: WsTreeNode;
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
            <MmcTreeNode key={child.id} node={child} depth={depth + 1} selected={selected} expanded={expanded} onSelect={onSelect} onToggle={onToggle} onContextMenu={onContextMenu} />
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

export function VSettingsLayout({
  groups,
  activeItem,
  onSelect,
  children,
}: {
  groups: { title: string; items: { key: string; label: string }[] }[];
  activeItem: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.vsettingsLayout}>
      <div className={styles.vsettingsNav}>
        {groups.map((g) => (
          <div key={g.title}>
            <div className={styles.vsGroupTitle}>{g.title}</div>
            {g.items.map((it) => (
              <div key={it.key} className={`${styles.vsItem} ${activeItem === it.key ? styles.vsItemActive : ""}`} onClick={() => onSelect(it.key)}>
                {it.label}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.vsettingsBody}>{children}</div>
    </div>
  );
}
