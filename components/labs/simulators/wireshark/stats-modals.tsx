"use client";

// ===== WIRESHARK SIMULATOR — STATISTICS MODALS =====
// Real, working modal-content components for the 5 Statistics-menu entries
// that source's WSStats.show() never actually implemented (no such function
// exists in itbd-lab/simulators/wireshark/js/wireshark-stats.js despite the
// menu items dispatching to it) — every "Statistics: ..." button in
// wireshark-shell.tsx silently did nothing in source. This file is purely
// presentational: all aggregation math is delegated to the already-ported,
// pure functions in stats-engine.ts (getProtocolHierarchy/getConversations/
// getEndpoints/getPacketLengthHistogram/getIoGraphBuckets/followStream) —
// nothing here recomputes or fabricates data.
//
// Rendering choices ported from wireshark-stats.js's renderProtocolHierarchy/
// renderConversations/renderEndpoints/renderPacketLengths/renderIoGraph/
// followStream (lines 22-229, 408-438), translated from string-concatenated
// HTML into React using the shared Modal/TabBar/DataTable primitives from
// wireshark-ui.tsx and the `.protoTreeRow`/`.streamClient`/`.streamServer`/
// `.ioCanvas` classes the CSS module already anticipated. The canvas-based
// I/O graph (source used a raw <canvas> + setTimeout-deferred draw, lines
// 176-229) is replaced with a real inline SVG polyline computed straight from
// getIoGraphBuckets()'s output — no canvas imperative-draw dance needed, and
// no fabricated canned curve.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { WsConversation, WsEndpoint, WsPacket } from "@/lib/labs/simulators/wireshark/types";
import {
  followStream,
  getConversations,
  getEndpoints,
  getIoGraphBuckets,
  getPacketLengthHistogram,
  getProtocolHierarchy,
} from "@/lib/labs/simulators/wireshark/stats-engine";
import { DataTable, type DataTableColumn, EmptyState, Modal, TabBar } from "./wireshark-ui";
import styles from "./wireshark-console.module.css";

// Wide modals for tabular/chart-heavy stats content — bigger than the
// Modal component's implicit ~480px default (see wireshark-ui.tsx's
// `.modal { min-width: 480px }`), matching source's 760px-wide canvases/tables.
const WIDE_MODAL = "920px";

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

// ===== 1. Protocol Hierarchy =====

type FlatHierarchyRow = {
  key: string;
  depth: number;
  protocol: string;
  packets: number;
  bytes: number;
  pctPackets: number;
  pctBytes: number;
};

function flattenHierarchy(
  nodes: ReturnType<typeof getProtocolHierarchy>,
  depth: number,
  parentKey: string,
  out: FlatHierarchyRow[],
): void {
  nodes.forEach((node, i) => {
    const key = `${parentKey}/${node.protocol}-${i}`;
    out.push({
      key,
      depth,
      protocol: node.protocol,
      packets: node.packets,
      bytes: node.bytes,
      pctPackets: node.pctPackets,
      pctBytes: node.pctBytes,
    });
    if (node.children.length > 0) flattenHierarchy(node.children, depth + 1, key, out);
  });
}

export function ProtocolHierarchyModal({ packets, onClose }: { packets: WsPacket[]; onClose: () => void }) {
  const rows = useMemo(() => {
    const hierarchy = getProtocolHierarchy(packets);
    const flat: FlatHierarchyRow[] = [];
    flattenHierarchy(hierarchy, 0, "root", flat);
    return flat;
  }, [packets]);

  const totalBytes = useMemo(() => packets.reduce((s, p) => s + p.length, 0), [packets]);

  return (
    <Modal title="Statistics: Protocol Hierarchy" onClose={onClose} width={WIDE_MODAL}>
      <div className={styles.small} style={{ marginBottom: 10 }}>
        Total packets: <strong>{packets.length}</strong>, total bytes: <strong>{formatBytes(totalBytes)}</strong>
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No packets captured yet." />
      ) : (
        <div>
          <div className={styles.protoTreeRow} style={{ fontWeight: 600, background: "#e8e8e8" }}>
            <span className={styles.protoTreeName}>Protocol</span>
            <span className={styles.protoTreeCol}>Packets</span>
            <span className={styles.protoTreeCol}>Bytes</span>
            <span className={styles.protoTreeCol}>% Packets</span>
            <span className={styles.protoTreeCol}>% Bytes</span>
          </div>
          {rows.map((row) => (
            <div key={row.key} className={styles.protoTreeRow}>
              <span className={styles.protoTreeName} style={{ paddingLeft: row.depth * 16 }}>
                {row.protocol}
              </span>
              <span className={styles.protoTreeCol}>{row.packets}</span>
              <span className={styles.protoTreeCol}>{formatBytes(row.bytes)}</span>
              <span className={styles.protoTreeCol}>{row.pctPackets.toFixed(1)}%</span>
              <span className={styles.protoTreeCol}>{row.pctBytes.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ===== 2. Conversations =====

const CONVERSATION_TABS = [
  { key: "eth", label: "Ethernet" },
  { key: "ipv4", label: "IPv4" },
  { key: "tcp", label: "TCP" },
  { key: "udp", label: "UDP" },
] as const;

type ConvLayer = (typeof CONVERSATION_TABS)[number]["key"];

export function ConversationsModal({ packets, onClose }: { packets: WsPacket[]; onClose: () => void }) {
  const [tab, setTab] = useState<ConvLayer>("ipv4");
  const allConversations = useMemo(() => getConversations(packets), [packets]);
  const rows = useMemo(() => allConversations.filter((c) => c.layer === tab), [allConversations, tab]);

  const columns: DataTableColumn<WsConversation>[] = [
    { key: "a", header: "Address A", render: (r) => r.a },
    { key: "b", header: "Address B", render: (r) => r.b },
    { key: "pAB", header: "Packets A→B", render: (r) => r.packetsAtoB, align: "right" },
    { key: "pBA", header: "Packets B→A", render: (r) => r.packetsBtoA, align: "right" },
    { key: "bAB", header: "Bytes A→B", render: (r) => formatBytes(r.bytesAtoB), align: "right" },
    { key: "bBA", header: "Bytes B→A", render: (r) => formatBytes(r.bytesBtoA), align: "right" },
    { key: "dur", header: "Duration", render: (r) => `${r.duration.toFixed(3)} s`, align: "right" },
  ];

  return (
    <Modal title="Statistics: Conversations" onClose={onClose} width={WIDE_MODAL}>
      <TabBar tabs={CONVERSATION_TABS as unknown as { key: string; label: string }[]} active={tab} onChange={(k) => setTab(k as ConvLayer)} />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        emptyMessage="No conversations of this type in this capture."
      />
    </Modal>
  );
}

// ===== 3. Endpoints =====

const ENDPOINT_TABS = CONVERSATION_TABS; // same 4 layers, same order

type EndpLayer = (typeof ENDPOINT_TABS)[number]["key"];

export function EndpointsModal({ packets, onClose }: { packets: WsPacket[]; onClose: () => void }) {
  const [tab, setTab] = useState<EndpLayer>("ipv4");
  const allEndpoints = useMemo(() => getEndpoints(packets), [packets]);
  const rows = useMemo(() => allEndpoints.filter((e) => e.layer === tab), [allEndpoints, tab]);

  const columns: DataTableColumn<WsEndpoint>[] = [
    { key: "address", header: "Address", render: (r) => r.address },
    { key: "packets", header: "Packets", render: (r) => r.packets, align: "right" },
    { key: "bytes", header: "Bytes", render: (r) => formatBytes(r.bytes), align: "right" },
    { key: "tx", header: "Tx Packets", render: (r) => r.txPackets, align: "right" },
    { key: "rx", header: "Rx Packets", render: (r) => r.rxPackets, align: "right" },
  ];

  return (
    <Modal title="Statistics: Endpoints" onClose={onClose} width={WIDE_MODAL}>
      <TabBar tabs={ENDPOINT_TABS as unknown as { key: string; label: string }[]} active={tab} onChange={(k) => setTab(k as EndpLayer)} />
      <DataTable columns={columns} rows={rows} getRowKey={(r) => `${r.layer}:${r.address}`} emptyMessage="No data." />
    </Modal>
  );
}

// ===== 4. I/O Graph =====

const BUCKET_OPTIONS = [
  { key: "0.25", label: "0.25 s", value: 0.25 },
  { key: "1", label: "1 s", value: 1 },
  { key: "5", label: "5 s", value: 5 },
] as const;

const CHART_WIDTH = 860;
const CHART_HEIGHT = 260;
const CHART_PAD_LEFT = 44;
const CHART_PAD_RIGHT = 12;
const CHART_PAD_TOP = 12;
const CHART_PAD_BOTTOM = 26;

export function IoGraphModal({ packets, onClose }: { packets: WsPacket[]; onClose: () => void }) {
  const [bucketSeconds, setBucketSeconds] = useState<number>(0.25);
  const buckets = useMemo(() => getIoGraphBuckets(packets, bucketSeconds), [packets, bucketSeconds]);
  const histogram = useMemo(() => getPacketLengthHistogram(packets), [packets]);

  const maxCount = Math.max(1, ...buckets.map((b) => b.packets));
  const maxHistCount = Math.max(1, ...histogram.map((h) => h.count));

  const plotW = CHART_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const plotH = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;

  const points = buckets.map((b, i) => {
    const x = CHART_PAD_LEFT + (buckets.length > 1 ? (i / (buckets.length - 1)) * plotW : 0);
    const y = CHART_PAD_TOP + plotH - (b.packets / maxCount) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const firstTime = buckets.length > 0 ? buckets[0].bucketStart : 0;
  const lastTime = buckets.length > 0 ? buckets[buckets.length - 1].bucketStart + bucketSeconds : 0;

  return (
    <Modal title="Statistics: I/O Graph" onClose={onClose} width={WIDE_MODAL}>
      <div className={styles.flex} style={{ marginBottom: 10 }}>
        <span className={styles.small}>Bucket size:</span>
        {BUCKET_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={styles.btn}
            style={opt.value === bucketSeconds ? { background: "#e0ecf8", borderColor: "#2a72c4" } : undefined}
            onClick={() => setBucketSeconds(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {buckets.length === 0 ? (
        <EmptyState message="No packets captured yet." />
      ) : (
        <>
          <svg
            className={styles.ioCanvas}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Packets per bucket over time"
          >
            {/* gridlines */}
            {Array.from({ length: 5 }, (_, g) => {
              const y = CHART_PAD_TOP + (g * plotH) / 4;
              return <line key={g} x1={CHART_PAD_LEFT} y1={y} x2={CHART_WIDTH - CHART_PAD_RIGHT} y2={y} stroke="#dcdcdc" strokeWidth={1} />;
            })}
            {/* axes */}
            <line x1={CHART_PAD_LEFT} y1={CHART_PAD_TOP} x2={CHART_PAD_LEFT} y2={CHART_PAD_TOP + plotH} stroke="#888" strokeWidth={1} />
            <line
              x1={CHART_PAD_LEFT}
              y1={CHART_PAD_TOP + plotH}
              x2={CHART_WIDTH - CHART_PAD_RIGHT}
              y2={CHART_PAD_TOP + plotH}
              stroke="#888"
              strokeWidth={1}
            />
            {/* data line */}
            <polyline points={points.join(" ")} fill="none" stroke="#2a72c4" strokeWidth={1.5} />
            {/* axis labels */}
            <text x={4} y={CHART_PAD_TOP + 8} fontSize={10} fill="#222">
              {maxCount}
            </text>
            <text x={4} y={CHART_PAD_TOP + plotH} fontSize={10} fill="#222">
              0
            </text>
            <text x={CHART_PAD_LEFT} y={CHART_HEIGHT - 6} fontSize={10} fill="#222">
              {firstTime.toFixed(1)}s
            </text>
            <text x={CHART_WIDTH - CHART_PAD_RIGHT - 30} y={CHART_HEIGHT - 6} fontSize={10} fill="#222">
              {lastTime.toFixed(1)}s
            </text>
          </svg>
          <div className={styles.small} style={{ marginTop: 6 }}>
            Packets per {bucketSeconds}s bucket ({buckets.length} buckets, peak {maxCount} pkt/bucket)
          </div>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <div className={styles.small} style={{ marginBottom: 6, fontWeight: 600 }}>
          Packet Length Distribution
        </div>
        {histogram.every((h) => h.count === 0) ? (
          <EmptyState message="No packets captured yet." />
        ) : (
          <div>
            {histogram.map((h) => (
              <div key={h.bucket} className={styles.protoTreeRow}>
                <span className={styles.protoTreeName}>{h.bucket}</span>
                <span className={styles.protoTreeCol} style={{ width: 60 }}>
                  {h.count}
                </span>
                <span style={{ flex: 2 }}>
                  <div
                    style={{
                      height: 10,
                      width: `${Math.max(h.count > 0 ? 2 : 0, (h.count / maxHistCount) * 100)}%`,
                      background: "#2a72c4",
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ===== 5. Follow Stream =====

export function FollowStreamModal({
  packets,
  streamKey,
  onClose,
}: {
  packets: WsPacket[];
  streamKey: string;
  onClose: () => void;
}) {
  const segments = useMemo(() => followStream(packets, streamKey), [packets, streamKey]);

  useEffect(() => {
    if (segments.length === 0) toast.error("No packets match this stream.");
    // Only re-notify when the stream selection actually changes, not on every
    // unrelated re-render of the parent shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamKey]);

  const streamPackets = packets.filter((p) => p.stream === streamKey);
  const clientIp = streamPackets.length > 0 ? streamPackets[0].src : null;
  const serverIp = streamPackets.length > 0 ? streamPackets[0].dst : null;

  return (
    <Modal title={`Follow Stream: ${streamKey}`} onClose={onClose} width={WIDE_MODAL}>
      {segments.length === 0 ? (
        <EmptyState message="No packets match this stream." />
      ) : (
        <>
          <div className={styles.small} style={{ marginBottom: 8 }}>
            Stream: <strong>{streamKey}</strong> —{" "}
            <span className={styles.streamClient}>{clientIp}</span> {"→"}{" "}
            <span className={styles.streamServer}>{serverIp}</span> — {streamPackets.length} packets
          </div>
          <div className={styles.streamContent}>
            {segments.map((seg, i) => (
              <span key={i} className={seg.side === "client" ? styles.streamClient : styles.streamServer}>
                {seg.text}
              </span>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
