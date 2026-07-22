"use client";

// ===== WIRESHARK SIMULATOR — PACKET LIST PANE (top pane) =====
// Ports itbd-lab/simulators/wireshark/js/wireshark-list.js's table renderer
// (No./Time/Source/Destination/Protocol/Length/Info columns), coloring-rule
// application (`colorClass(p)` in source), row click -> select, and the
// marked (bookmark)/ignored (dimmed) row states — as one React pane driven by
// the shared `WiresharkState`/`wiresharkReducer` instead of source's direct
// DOM mutation + `WSData.state` globals.
//
// Deliberate differences from source, all within the approved scope:
//   - Source's right-click context menu (mark/ignore/follow-stream) is
//     replaced by small per-row IconButton affordances — a real native
//     contextmenu popup is extra complexity not essential to the core
//     feature (per this pane's spec).
//   - Source falls back to showing an unfiltered list when the filter fails
//     to compile (WSFilter.applyFilter returns `{ok:false}` -> source shows
//     the previous/all packets rather than an empty table); this port
//     reproduces that graceful-degradation behavior explicitly via
//     `compile().error` plus an inline error hint instead of silently
//     failing.
//   - Coloring rule predicates are compiled ONCE per render pass (not per
//     cell) since `state.coloringRules` can now grow at runtime via the
//     Coloring Rules modal — perf-sensitive across 426+ seeded rows plus
//     live-capture growth.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { WiresharkState, WsPacket } from "@/lib/labs/simulators/wireshark/types";
import type { WiresharkAction } from "@/lib/labs/simulators/wireshark/reducer";
import { applyFilter, compile } from "@/lib/labs/simulators/wireshark/filter-engine";
import { EmptyState } from "./wireshark-ui";
import styles from "./wireshark-console.module.css";

type ColorRuleMatcher = {
  bg: string;
  fg: string;
  predicate: (packet: WsPacket) => boolean;
};

/** Compiles every enabled coloring rule once per render pass (not per cell/row). */
function useCompiledColoringRules(state: WiresharkState): ColorRuleMatcher[] {
  return useMemo(() => {
    const matchers: ColorRuleMatcher[] = [];
    for (const rule of state.coloringRules) {
      if (!rule.enabled) continue;
      const compiled = compile(rule.filter);
      if (!compiled.ok || !compiled.predicate) continue;
      matchers.push({ bg: rule.bg, fg: rule.fg, predicate: compiled.predicate });
    }
    return matchers;
  }, [state.coloringRules]);
}

/** First matching enabled coloring rule's bg/fg, mirroring source's `colorClass(p)`. */
function colorStyleFor(packet: WsPacket, matchers: ColorRuleMatcher[]): React.CSSProperties | undefined {
  for (const m of matchers) {
    if (m.predicate(packet)) {
      return { background: m.bg, color: m.fg };
    }
  }
  return undefined;
}

export function PacketListPane({
  state,
  dispatch,
  onDisplayedCountChange,
}: {
  state: WiresharkState;
  dispatch: React.Dispatch<WiresharkAction>;
  onDisplayedCountChange?: (count: number) => void;
}) {
  const [markedOnly, setMarkedOnly] = useState(false);

  // ───────── Display filter (graceful degradation on parse error, matches
  // source's WSList.applyFilter() falling back to the full/previous list) ─────────
  const compiledFilter = useMemo(() => compile(state.displayFilter), [state.displayFilter]);
  const filtered = useMemo(() => {
    if (compiledFilter.error) return state.packets;
    return applyFilter(state.packets, state.displayFilter);
  }, [state.packets, state.displayFilter, compiledFilter.error]);

  const displayed = useMemo(() => (markedOnly ? filtered.filter((p) => p.marked) : filtered), [filtered, markedOnly]);

  useEffect(() => {
    onDisplayedCountChange?.(displayed.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed.length]);

  const colorMatchers = useCompiledColoringRules(state);

  function selectPacket(no: number) {
    dispatch({ type: "SELECT_PACKET", packetNo: no });
  }

  function toggleMark(e: React.MouseEvent, no: number) {
    e.stopPropagation();
    dispatch({ type: "TOGGLE_MARK_FRAME", packetNo: no });
  }

  function toggleIgnore(e: React.MouseEvent, packet: WsPacket) {
    e.stopPropagation();
    dispatch({ type: "SET_IGNORED", packetNo: packet.no, ignored: !packet.ignored });
  }

  function clearAllMarks() {
    if (state.markedFrames.length === 0) {
      toast("No marked frames to clear.");
      return;
    }
    dispatch({ type: "CLEAR_ALL_MARKS" });
    toast.success("Cleared all marks.");
  }

  return (
    <div className={styles.paneList} role="region" aria-label="Packet list">
      {/* ===== Toolbar strip ===== */}
      <div className={`${styles.flexBetween}`} style={{ padding: "4px 8px", borderBottom: "1px solid #c8c8c8", position: "sticky", top: 0, background: "#f2f2f2", zIndex: 5 }}>
        <div className={styles.flex}>
          <span className={styles.small}>
            {displayed.length.toLocaleString()} of {state.packets.length.toLocaleString()} packets displayed
          </span>
          {compiledFilter.error ? (
            <span className={styles.small} style={{ color: "#c44d4d" }} role="alert">
              Invalid filter — showing all packets ({compiledFilter.error})
            </span>
          ) : null}
        </div>
        <div className={styles.flex}>
          <button
            type="button"
            className={`${styles.btn} ${markedOnly ? styles.btnPrimary : ""}`}
            onClick={() => setMarkedOnly((v) => !v)}
            aria-pressed={markedOnly}
            title="Show only marked packets"
          >
            {markedOnly ? "Showing marked only" : "Marked only"}
          </button>
          <button type="button" className={styles.btn} onClick={clearAllMarks} title="Clear all marks">
            Clear all marks
          </button>
        </div>
      </div>

      {/* ===== Table ===== */}
      {displayed.length === 0 ? (
        <EmptyState message={markedOnly ? "No marked packets." : "No packets match the current display filter."} />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 60, textAlign: "right" }}>No.</th>
              <th style={{ width: 100 }}>Time</th>
              <th style={{ width: 140 }}>Source</th>
              <th style={{ width: 140 }}>Destination</th>
              <th style={{ width: 80 }}>Protocol</th>
              <th style={{ width: 60, textAlign: "right" }}>Length</th>
              <th style={{ width: 40 }} aria-label="Mark / ignore actions" />
              <th>Info</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((packet) => {
              const colorStyle = colorStyleFor(packet, colorMatchers);
              const isSelected = packet.no === state.selectedPacketNo;
              const rowStyle: React.CSSProperties = {
                ...colorStyle,
                ...(packet.ignored ? { opacity: 0.35 } : null),
                ...(isSelected ? { background: "#2a72c4", color: "#fff" } : null),
                fontWeight: packet.marked ? 700 : undefined,
                cursor: "pointer",
              };
              return (
                <tr
                  key={packet.no}
                  style={rowStyle}
                  onClick={() => selectPacket(packet.no)}
                  aria-selected={isSelected}
                  data-marked={packet.marked || undefined}
                  data-ignored={packet.ignored || undefined}
                >
                  <td style={{ textAlign: "right" }}>{packet.no}</td>
                  <td>{packet.time.toFixed(6)}</td>
                  <td>{packet.src || "-"}</td>
                  <td>{packet.dst || "-"}</td>
                  <td>{packet.protocol}</td>
                  <td style={{ textAlign: "right" }}>{packet.length}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={(e) => toggleMark(e, packet.no)}
                      title={packet.marked ? "Unmark frame" : "Mark frame"}
                      aria-label={packet.marked ? "Unmark frame" : "Mark frame"}
                      aria-pressed={packet.marked}
                      style={{ background: "none", border: 0, cursor: "pointer", padding: "0 2px", color: "inherit" }}
                    >
                      {packet.marked ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleIgnore(e, packet)}
                      title={packet.ignored ? "Un-ignore frame" : "Ignore frame"}
                      aria-label={packet.ignored ? "Un-ignore frame" : "Ignore frame"}
                      aria-pressed={packet.ignored}
                      style={{ background: "none", border: 0, cursor: "pointer", padding: "0 2px", color: "inherit" }}
                    >
                      {packet.ignored ? "◉" : "○"}
                    </button>
                  </td>
                  <td>{packet.info}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
