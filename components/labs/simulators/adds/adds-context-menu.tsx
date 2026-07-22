"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./adds-console.module.css";

export type ContextMenuItem =
  | "-"
  | {
      key: string;
      label: string;
      onClick?: () => void;
      children?: ContextMenuItem[];
      disabled?: boolean;
    };

type ContextMenuState = { x: number; y: number; items: ContextMenuItem[] } | null;

let listeners: ((state: ContextMenuState) => void)[] = [];
let currentState: ContextMenuState = null;

function setState(state: ContextMenuState) {
  currentState = state;
  listeners.forEach((l) => l(state));
}

export const AddsContextMenu = {
  show(x: number, y: number, items: ContextMenuItem[]) {
    setState({ x, y, items });
  },
  close() {
    setState(null);
  },
};

function MenuLevel({ items, onPick }: { items: ContextMenuItem[]; onPick: (fn: () => void) => void }) {
  return (
    <>
      {items.map((item, i) =>
        item === "-" ? (
          <div key={i} className={styles.ctxSep} />
        ) : (
          <div key={item.key} className={`${styles.ctxItem} ${item.children ? styles.ctxHasSub : ""} ${item.disabled ? styles.ctxDisabled : ""}`}>
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                if (item.onClick) onPick(item.onClick);
              }}
            >
              {item.label}
            </span>
            {item.children ? (
              <div className={styles.ctxSub}>
                <MenuLevel items={item.children} onPick={onPick} />
              </div>
            ) : null}
          </div>
        ),
      )}
    </>
  );
}

export function AddsContextMenuHost() {
  const [state, setLocalState] = useState<ContextMenuState>(currentState);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listeners.push(setLocalState);
    return () => {
      listeners = listeners.filter((l) => l !== setLocalState);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) AddsContextMenu.close();
    }
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [state]);

  if (!state || typeof document === "undefined") return null;

  const menuHeight = state.items.length * 26 + 8;
  const left = Math.min(state.x, window.innerWidth - 240);
  const top = Math.min(state.y, window.innerHeight - menuHeight);

  return createPortal(
    <div ref={ref} className={styles.ctxMenu} style={{ left, top }}>
      <MenuLevel items={state.items} onPick={(fn) => {
        AddsContextMenu.close();
        fn();
      }} />
    </div>,
    document.body,
  );
}
