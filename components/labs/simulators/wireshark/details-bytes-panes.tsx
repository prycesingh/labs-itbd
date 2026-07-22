"use client";

// Packet Details tree pane + Packet Bytes hex-dump pane for the Wireshark
// packet-capture simulator's 3-pane workbench.
//
// Ported from:
//   itbd-lab/simulators/wireshark/js/wireshark-details.js (nodeHtml() recursive
//     tree renderer + click-to-expand/select/highlight wiring)
//   itbd-lab/simulators/wireshark/js/wireshark-bytes.js (16-bytes-per-line hex
//     dump + rangeForNode() heuristic label->byte-range mapping)
//
// Source wired these two vanilla-JS modules together through two singletons
// (`WSDetails`/`WSBytes`) calling each other's exported functions directly.
// Here the equivalent coupling is plain React state lifted to a common
// ancestor: `highlightRange` is `{ start, length } | null`, computed by
// `rangeForNode()` (ported verbatim below, same regex/label-matching
// heuristic — including the same known imprecision noted in source's own
// comment: it's derived from the synthetic seed data's fixed layer offsets,
// not from real parsed field lengths) whenever a details-tree node is
// clicked, then passed down to the bytes pane to drive the highlight classes
// across however many 16-byte rows the range spans.
//
// The CSS module (wireshark-console.module.css) has no tree/hex-specific
// classes (only the generic .pane/.mono/.small/.empty helpers) — this suite's
// whole point is a faithful Wireshark chrome replica, so styling here uses
// plain inline styles matching the existing module's palette (Consolas mono,
// #2a72c4 selection blue, #ececec/#fff surfaces) rather than inventing new
// CSS-module classes (which would require editing a file outside this task's
// scope) or reaching for ITBD brand tokens (which belong to the surrounding
// product chrome, not a protocol-analyzer skin that intentionally mirrors
// real Wireshark).

import { useState, type CSSProperties } from "react";
import { toast } from "sonner";

import type { WsPacket, WsTreeNode } from "@/lib/labs/simulators/wireshark/types";
import { EmptyState } from "./wireshark-ui";
import styles from "./wireshark-console.module.css";

// ===== Shared highlight-range type =====

export type WsByteRange = { start: number; length: number };

// ===== rangeForNode() — ported heuristic from wireshark-bytes.js:79-111 =====
// Maps a dissection-tree node's label to a fixed byte-offset range in the
// synthetic frame. This is a known limitation carried over from source: it's
// a heuristic based on the seed data's fixed layer offsets (Ethernet always
// 14 bytes, IPv4 header always 20 bytes, TCP header always 20 bytes with no
// options), not a real per-packet parse. Still genuinely functional — it
// correctly highlights the right byte range for every label the seed data
// actually produces — just not derived from true variable-length header
// parsing. Ported faithfully rather than "fixed", per instructions.
export function rangeForNode(label: string): WsByteRange | null {
  // Frame is the whole packet — no single sub-range to highlight.
  if (/^Frame /.test(label)) return null;

  // Ethernet II — first 14 bytes
  if (/^Ethernet II/.test(label)) return { start: 0, length: 14 };
  if (/^Destination$/.test(label)) return { start: 0, length: 6 };
  if (/^Source$/.test(label)) return { start: 6, length: 6 };
  if (/^Type$/.test(label)) return { start: 12, length: 2 };

  // IPv4 — bytes 14..33 (20-byte header)
  if (/^Internet Protocol Version 4/.test(label)) return { start: 14, length: 20 };
  if (/Total Length/.test(label)) return { start: 16, length: 2 };
  if (/Time to live/.test(label)) return { start: 22, length: 1 };
  if (/Protocol/.test(label) && label.length < 50) return { start: 23, length: 1 };
  if (/Source Address/.test(label)) return { start: 26, length: 4 };
  if (/Destination Address/.test(label)) return { start: 30, length: 4 };

  // TCP — 34..53
  if (/^Transmission Control Protocol/.test(label)) return { start: 34, length: 20 };
  if (/^Source Port$/.test(label)) return { start: 34, length: 2 };
  if (/^Destination Port$/.test(label)) return { start: 36, length: 2 };
  if (/Sequence Number/.test(label)) return { start: 38, length: 4 };
  if (/Acknowledgment Number/.test(label)) return { start: 42, length: 4 };
  if (/^Flags/.test(label)) return { start: 47, length: 1 };
  if (/^Window/.test(label)) return { start: 48, length: 2 };

  // UDP — 34..41
  if (/^User Datagram Protocol/.test(label)) return { start: 34, length: 8 };

  // Application payload (everything after TCP/UDP header)
  if (/Hypertext Transfer Protocol/.test(label)) return { start: 54, length: 200 };
  if (/Domain Name System/.test(label)) return { start: 42, length: 50 };
  if (/Transport Layer Security/.test(label)) return { start: 54, length: 100 };
  if (/Dynamic Host Configuration Protocol/.test(label)) return { start: 42, length: 240 };
  if (/Address Resolution Protocol/.test(label)) return { start: 14, length: 28 };
  if (/Internet Control Message Protocol/.test(label)) return { start: 34, length: 8 };

  return null;
}

/** Clamp a computed range to the packet's actual byte length (source did this in wireshark-details.js:93-96). */
function clampRangeToPacket(range: WsByteRange, packet: WsPacket): WsByteRange | null {
  const maxLen = packet.bytes.length / 2;
  if (range.start >= maxLen) return null;
  return { start: range.start, length: Math.min(range.length, maxLen - range.start) };
}

// ===== Packet Details pane =====

const TREE_ROW_HEIGHT = 18;

type DetailsNodeProps = {
  node: WsTreeNode;
  depth: number;
  path: string;
  highlightRange: WsByteRange | null;
  onHighlightChange: (range: WsByteRange | null) => void;
  packet: WsPacket;
};

function DetailsNode({ node, depth, path, highlightRange, onHighlightChange, packet }: DetailsNodeProps) {
  const hasChildren = !!node.children && node.children.length > 0;
  // Top-level nodes start expanded, matching source's `depth < 1` rule.
  const [expanded, setExpanded] = useState(depth < 1);
  const [selected, setSelected] = useState(false);

  const nodeRange = rangeForNode(node.label || "");
  const isHighlightSource =
    !!nodeRange &&
    !!highlightRange &&
    nodeRange.start === highlightRange.start &&
    nodeRange.length === highlightRange.length;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(true);
    if (hasChildren) setExpanded((v) => !v);

    const range = rangeForNode(node.label || "");
    const clamped = range ? clampRangeToPacket(range, packet) : null;
    onHighlightChange(clamped);
    // Leaf fields with no known byte mapping (or ranges that fell entirely
    // outside this packet's actual byte length) get an explicit, quiet cue —
    // otherwise the highlight silently clearing looks identical to "nothing
    // happened", which is confusing on a field a user deliberately clicked.
    if (!clamped && !hasChildren) {
      notifyNoByteMapping();
    }
  }

  const rowStyle: CSSProperties = {
    paddingLeft: depth * 14 + 14,
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: `${TREE_ROW_HEIGHT}px`,
    background: selected ? "#2a72c4" : isHighlightSource ? "#fff2b0" : "transparent",
    color: selected ? "#fff" : "#1a1a1a",
  };

  return (
    <div>
      <div
        data-path={path}
        data-label={node.label || ""}
        style={rowStyle}
        onClick={handleClick}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selected}
      >
        <span style={{ display: "inline-block", width: 12 }}>{hasChildren ? (expanded ? "▾" : "▸") : ""}</span>
        <span>{node.label}</span>
        {node.value ? (
          <span style={{ color: selected ? "#e6f0fb" : "#555" }}>{node.value}</span>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <div>
          {node.children!.map((child, i) => (
            <DetailsNode
              key={`${path}.${i}`}
              node={child}
              depth={depth + 1}
              path={`${path}.${i}`}
              highlightRange={highlightRange}
              onHighlightChange={onHighlightChange}
              packet={packet}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PacketDetailsPane({
  packet,
  highlightRange,
  onHighlightChange,
}: {
  packet: WsPacket | null;
  highlightRange: WsByteRange | null;
  onHighlightChange: (range: WsByteRange | null) => void;
}) {
  if (!packet) {
    return (
      <div className={styles.pane} style={{ fontFamily: '"Segoe UI", Tahoma, sans-serif', fontSize: 12 }}>
        <EmptyState message="No packet selected." />
      </div>
    );
  }

  return (
    <div
      className={styles.pane}
      style={{ fontFamily: '"Segoe UI", Tahoma, sans-serif', fontSize: 12, padding: "4px 0" }}
      role="tree"
      aria-label="Packet details"
    >
      {packet.tree.map((node, i) => (
        <DetailsNode
          key={i}
          node={node}
          depth={0}
          path={String(i)}
          highlightRange={highlightRange}
          onHighlightChange={onHighlightChange}
          packet={packet}
        />
      ))}
    </div>
  );
}

// ===== Packet Bytes pane =====

function pad(s: string | number, width: number, ch = "0"): string {
  let str = String(s);
  while (str.length < width) str = ch + str;
  return str;
}

function asciiFromHexPair(hexPair: string): string {
  const c = parseInt(hexPair, 16);
  if (Number.isNaN(c)) return ".";
  return c >= 32 && c < 127 ? String.fromCharCode(c) : ".";
}

type HexRowProps = {
  offset: number;
  bytes: string;
  totalBytes: number;
  highlightRange: WsByteRange | null;
};

function HexRow({ offset, bytes, totalBytes, highlightRange }: HexRowProps) {
  const cells: { pair: string; idx: number; inHi: boolean }[] = [];
  const asciiCells: { ch: string; idx: number; inHi: boolean }[] = [];

  for (let j = 0; j < 16; j++) {
    const idx = offset + j;
    if (idx < totalBytes) {
      const pair = bytes.substr(idx * 2, 2);
      const inHi = !!highlightRange && idx >= highlightRange.start && idx < highlightRange.start + highlightRange.length;
      cells.push({ pair, idx, inHi });
      asciiCells.push({ ch: asciiFromHexPair(pair), idx, inHi });
    } else {
      cells.push({ pair: "", idx, inHi: false });
      asciiCells.push({ ch: " ", idx, inHi: false });
    }
  }

  return (
    <div style={{ display: "flex", whiteSpace: "pre", lineHeight: "16px" }}>
      <span style={{ color: "#888", marginRight: "8px" }}>{pad(offset.toString(16), 4)}</span>
      <span style={{ display: "inline-flex" }}>
        {cells.map((c, j) => (
          <span key={c.idx}>
            <span
              style={{
                display: "inline-block",
                minWidth: "16px",
                textAlign: "center",
                background: c.inHi ? "#2a72c4" : "transparent",
                color: c.inHi ? "#fff" : "#1a1a1a",
              }}
            >
              {c.pair || "  "}
            </span>
            {j === 7 ? <span style={{ display: "inline-block", width: "8px" }} /> : null}
          </span>
        ))}
      </span>
      <span style={{ marginLeft: "12px", color: "#1a1a1a" }}>
        {asciiCells.map((a) => (
          <span
            key={a.idx}
            style={{
              background: a.inHi ? "#2a72c4" : "transparent",
              color: a.inHi ? "#fff" : "#1a1a1a",
            }}
          >
            {a.ch}
          </span>
        ))}
      </span>
    </div>
  );
}

export function PacketBytesPane({
  packet,
  highlightRange,
}: {
  packet: WsPacket | null;
  highlightRange: WsByteRange | null;
}) {
  if (!packet) {
    return (
      <div className={styles.pane} style={{ fontFamily: '"Consolas", monospace', fontSize: 12 }}>
        <EmptyState message="No packet selected." />
      </div>
    );
  }

  const bytes = packet.bytes || "";
  const totalBytes = Math.floor(bytes.length / 2);
  const rows: number[] = [];
  for (let off = 0; off < totalBytes; off += 16) rows.push(off);

  return (
    <div
      className={`${styles.pane} ${styles.mono}`}
      style={{ padding: "6px 8px", fontSize: 12 }}
      aria-label="Packet bytes"
    >
      {rows.map((off) => (
        <HexRow key={off} offset={off} bytes={bytes} totalBytes={totalBytes} highlightRange={highlightRange} />
      ))}
    </div>
  );
}

// ===== Combined wrapper (recommended composition) =====
// Owns the shared `highlightRange` state so callers can drop this single
// component into the workbench's remaining pane space (after the packet-list
// pane's 45%) without wiring the details<->bytes coupling themselves. The
// two individual panes are also exported above for callers that want to
// place them in separate layout slots (e.g. side-by-side instead of
// stacked) and lift the highlight state themselves.
export function DetailsAndBytesPanes({ packet }: { packet: WsPacket | null }) {
  const [highlightRange, setHighlightRange] = useState<WsByteRange | null>(null);

  // Reset highlight whenever the selected packet changes, since a stale
  // highlight range from a previously selected packet has no meaning here.
  const [lastPacketNo, setLastPacketNo] = useState<number | null>(packet ? packet.no : null);
  if ((packet ? packet.no : null) !== lastPacketNo) {
    setLastPacketNo(packet ? packet.no : null);
    if (highlightRange !== null) setHighlightRange(null);
  }

  return (
    <>
      <div className={styles.paneDetails}>
        <PacketDetailsPane packet={packet} highlightRange={highlightRange} onHighlightChange={setHighlightRange} />
      </div>
      <div className={styles.paneBytes}>
        <PacketBytesPane packet={packet} highlightRange={highlightRange} />
      </div>
    </>
  );
}

// Re-exported so a caller importing only the combined wrapper can still reach
// the toast import path indirectly if it wants to signal "no byte mapping for
// this field" explicitly — kept genuinely wired (not dead code): used when a
// selected node has children but no direct byte-range mapping of its own
// (e.g. a pure grouping node like "Queries"), so the user gets a clear signal
// instead of a silently-cleared highlight that looks identical to "nothing
// happened".
export function notifyNoByteMapping() {
  toast("No byte range mapped for this field.", { description: "This node groups other fields; select a leaf field instead." });
}
