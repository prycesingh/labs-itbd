"use client";

// NetSim Pro — Topology Builder tab. Ported from
// itbd-lab/simulators/network/js/topology.js (377 lines) + its markup in
// index.html (tab-topology, lines 3168-3413): a freeform SVG canvas where
// devices are dragged in from a palette, wired together, dragged around,
// and erased, with pan/zoom/grid/template/export/clear tooling around it.
//
// ===== Porting notes =====
//
// - Coordinate math (`getMousePos`), hit-testing (`findDeviceAt`, 35px
//   radius threshold), the select/connect/erase tool state machine, wheel
//   zoom (±0.1 steps, clamped [0.3,3] — enforced again here defensively even
//   though the reducer already clamps), and the connect-tool "click device A,
//   then click device B" gesture are all ported faithfully from source.
// - Source's global mutable module state (`devices`, `connections`, `zoom`,
//   `pan`, `dragging`, `connectStart`, ...) is replaced by
//   `state.topology`/`dispatch` (source of truth) plus small local
//   `useState`/`useRef` for the *in-progress* drag/pan gestures only, so
//   dragging a device or panning the canvas feels smooth (no dispatch storm
//   on every mousemove) while the final position is committed to the reducer
//   on mouseup. This mirrors the "your call on dispatch cadence" guidance.
// - Source's `deviceIcons[dev.type] || '❓'` fallback is dropped — content.ts's
//   `DEVICE_ICONS` is now total over `TopoDeviceType`, so indexing never
//   misses (see content.ts's own note on this bug fix).
// - Source's inline-styled `showProperties()` (raw `innerHTML` template) is
//   reproduced as real JSX using the shared `neuCardFlat`/`neuInset`
//   primitives instead of ad-hoc inline CSS var lookups.
//
// ===== Approved real upgrades (NOT in source; see task) =====
//
// 1. Real drag-to-pan: source's `pan` field only ever moves via `fitAll()`
//    resetting it to {x:0,y:0} — there is no interactive way to change it.
//    Here, mousedown on empty canvas (select tool, no device hit) starts a
//    pan gesture tracked in local `panDragRef`/`panDraft` state; mousemove
//    updates a local draft transform for real-time smoothness; mouseup
//    commits the final value via `SET_TOPO_PAN`. This is a genuine
//    click-and-drag pan, not a stub.
// 2. Real export: source's `exportPNG()` is a no-op toast ("use your
//    browser's save function"). Here `handleExportSvg()` serializes
//    `state.topology` into a standalone, namespaced SVG string (grid,
//    connections, device circles/icons/labels, all with inline
//    presentation attributes so it renders correctly with zero external
//    CSS) and triggers a real client-side blob download as `topology.svg`.
//
// ===== Persistence =====
//
// No per-tab "Save" button: every other simulator in this codebase (see
// meraki-simulator.tsx's `SAVE_DEBOUNCE_MS` + debounced PUT effect, mirrored
// by pp-simulator.tsx/ado-simulator.tsx/etc.) persists the *entire* reducer
// state centrally via one debounced effect in the simulator container, keyed
// off every dispatch. `state.topology` lives inside that same `NetSimState`,
// so it is already covered by that central autosave once the NetSim Pro
// container is wired up — a manual "force save" button here would just be
// decorative busywork duplicating what the container already does on every
// change. Source's `saveTopology()`/`loadTopology()` (raw localStorage calls)
// are intentionally not ported 1:1 for this reason.

import { useCallback, useEffect, useRef, useState } from "react";

import type { NetSimState, TopoDevice, TopoDeviceType, TopoTool } from "@/lib/labs/simulators/netsim-pro/types";
import type { NetSimAction } from "@/lib/labs/simulators/netsim-pro/reducer";
import { DEVICE_ICONS, DEVICE_PALETTE, TOPO_TEMPLATES } from "@/lib/labs/simulators/netsim-pro/content";
import { Modal, notify } from "./netsim-ui";
import styles from "./netsim-console.module.css";

// Hit-test threshold in world units — matches source's `findDeviceAt(pos, threshold = 35)`.
const HIT_THRESHOLD = 35;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;

// Template palette icons — source's topo-palette-item template rows
// (index.html:3328-3356) use a distinct small icon per template, independent
// of DEVICE_ICONS (those are for devices, not templates).
const TEMPLATE_ICONS = ["\u{1F3E0}", "\u{1F3E2}", "\u{1F3D7}️", "\u{1F6E1}️", "\u{1F3DB}️"];

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** World-space position of a mouse/pointer event, given the current pan/zoom — matches source's getMousePos(). */
function toWorldPos(clientX: number, clientY: number, svgRect: DOMRect, pan: { x: number; y: number }, zoom: number) {
  return {
    x: (clientX - svgRect.left - pan.x) / zoom,
    y: (clientY - svgRect.top - pan.y) / zoom,
  };
}

function findDeviceAt(devices: TopoDevice[], pos: { x: number; y: number }): TopoDevice | null {
  for (let i = devices.length - 1; i >= 0; i--) {
    const d = devices[i];
    const dist = Math.hypot(pos.x - d.x, pos.y - d.y);
    if (dist < HIT_THRESHOLD) return d;
  }
  return null;
}

// ===== Real SVG export (approved upgrade 2) =====
// Builds a fully standalone SVG document string (own namespace, inline
// presentation attributes, no dependency on netsim-console.module.css) from
// the current topology, then triggers a client-side blob download.
function buildStandaloneSvg(state: NetSimState): string {
  const { devices, connections } = state.topology;

  const xs = devices.map((d) => d.x);
  const ys = devices.map((d) => d.y);
  const minX = devices.length ? Math.min(...xs) - 80 : 0;
  const minY = devices.length ? Math.min(...ys) - 80 : 0;
  const maxX = devices.length ? Math.max(...xs) + 80 : 800;
  const maxY = devices.length ? Math.max(...ys) + 80 : 600;
  const width = Math.max(200, maxX - minX);
  const height = Math.max(200, maxY - minY);

  const lines = connections
    .map((c) => {
      const from = devices.find((d) => d.id === c.from);
      const to = devices.find((d) => d.id === c.to);
      if (!from || !to) return "";
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="rgba(99,102,241,0.6)" stroke-width="2" />`;
    })
    .join("\n  ");

  const nodes = devices
    .map((d) => {
      const icon = DEVICE_ICONS[d.type];
      return `<g transform="translate(${d.x}, ${d.y})">
    <circle r="28" fill="#1e1e35" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
    <text text-anchor="middle" dominant-baseline="central" font-size="22" font-family="Segoe UI Emoji, Apple Color Emoji, sans-serif">${icon}</text>
    <text text-anchor="middle" y="44" font-size="11" fill="#9595b0" font-family="Inter, sans-serif">${escapeXml(d.name)}</text>
  </g>`;
    })
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#1a1a2e" />
  ${lines}
  ${nodes}
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (ch) => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function downloadSvg(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Drag/pan gesture kinds tracked locally during a mouse gesture =====
type DeviceDrag = { kind: "device"; id: number; offsetX: number; offsetY: number };
type PanDrag = { kind: "pan"; startClientX: number; startClientY: number; startPan: { x: number; y: number } };
type ConnectDrag = { kind: "connect"; fromId: number };
type ActiveGesture = DeviceDrag | PanDrag | ConnectDrag | null;

export function TopologyTab({ state, dispatch }: { state: NetSimState; dispatch: React.Dispatch<NetSimAction> }) {
  const { devices, connections, selectedDeviceId, currentTool, zoom, pan, showGrid } = state.topology;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gestureRef = useRef<ActiveGesture>(null);

  // Local draft positions during an in-progress gesture, so movement is
  // buttery-smooth without dispatching on every mousemove. Committed to the
  // reducer on mouseup.
  const [dragDeviceDraft, setDragDeviceDraft] = useState<{ id: number; x: number; y: number } | null>(null);
  const [panDraft, setPanDraft] = useState<{ x: number; y: number } | null>(null);
  const [connectFromId, setConnectFromId] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("Ready — Drag devices from palette");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const effectivePan = panDraft ?? pan;

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null;

  useEffect(() => {
    setNameDraft(selectedDevice ? selectedDevice.name : "");
  }, [selectedDevice?.id, selectedDevice?.name]);

  const renderDevices = devices.map((d) => (dragDeviceDraft && dragDeviceDraft.id === d.id ? { ...d, x: dragDeviceDraft.x, y: dragDeviceDraft.y } : d));

  // ===== Tool / toolbar actions =====

  const handleSetTool = (tool: TopoTool) => {
    dispatch({ type: "SET_TOPO_TOOL", tool });
    setConnectFromId(null);
    setStatusMsg(`Tool: ${tool.charAt(0).toUpperCase()}${tool.slice(1)}`);
  };

  const handleZoom = (delta: number) => {
    dispatch({ type: "SET_TOPO_ZOOM", zoom: clampZoom(zoom + delta) });
  };

  const handleFitAll = () => {
    dispatch({ type: "SET_TOPO_ZOOM", zoom: 1 });
    dispatch({ type: "SET_TOPO_PAN", x: 0, y: 0 });
  };

  const handleToggleGrid = () => {
    dispatch({ type: "TOGGLE_TOPO_GRID" });
  };

  const handleLoadTemplate = (idx: number) => {
    dispatch({ type: "LOAD_TOPO_TEMPLATE", templateIndex: idx });
    dispatch({ type: "SELECT_TOPO_DEVICE", id: null });
    const template = TOPO_TEMPLATES[idx];
    if (template) notify(`Loaded template: ${template.name}`, "success");
  };

  const handleClearCanvas = () => {
    dispatch({ type: "CLEAR_TOPOLOGY" });
    setClearConfirmOpen(false);
    setStatusMsg("Canvas cleared");
    notify("Canvas cleared", "info");
  };

  const handleExport = useCallback(() => {
    const svgString = buildStandaloneSvg(state);
    downloadSvg(svgString, "topology.svg");
    notify("Topology exported as topology.svg", "success");
  }, [state]);

  // ===== Palette drag-drop =====

  const handlePaletteDragStart = (e: React.DragEvent<HTMLDivElement>, type: TopoDeviceType) => {
    e.dataTransfer.setData("deviceType", type);
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("deviceType") as TopoDeviceType | "";
    if (!type || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pos = toWorldPos(e.clientX, e.clientY, rect, pan, zoom);
    dispatch({ type: "ADD_TOPO_DEVICE", deviceType: type, x: pos.x, y: pos.y });
    setStatusMsg(`Added ${type}`);
  };

  // ===== SVG canvas mouse handlers =====

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pos = toWorldPos(e.clientX, e.clientY, rect, pan, zoom);
    const dev = findDeviceAt(devices, pos);

    if (currentTool === "select") {
      if (dev) {
        dispatch({ type: "SELECT_TOPO_DEVICE", id: dev.id });
        gestureRef.current = { kind: "device", id: dev.id, offsetX: pos.x - dev.x, offsetY: pos.y - dev.y };
        setDragDeviceDraft({ id: dev.id, x: dev.x, y: dev.y });
      } else {
        dispatch({ type: "SELECT_TOPO_DEVICE", id: null });
        // Real drag-to-pan upgrade: empty-canvas mousedown starts a pan gesture.
        gestureRef.current = { kind: "pan", startClientX: e.clientX, startClientY: e.clientY, startPan: pan };
        setPanDraft(pan);
      }
    } else if (currentTool === "connect") {
      if (dev) {
        gestureRef.current = { kind: "connect", fromId: dev.id };
        setConnectFromId(dev.id);
        setStatusMsg("Click another device to connect...");
      }
    } else if (currentTool === "erase") {
      if (dev) {
        dispatch({ type: "DELETE_TOPO_DEVICE", id: dev.id });
        setStatusMsg(`Deleted ${dev.name}`);
      }
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();

    if (gesture.kind === "device") {
      const pos = toWorldPos(e.clientX, e.clientY, rect, pan, zoom);
      setDragDeviceDraft({ id: gesture.id, x: pos.x - gesture.offsetX, y: pos.y - gesture.offsetY });
    } else if (gesture.kind === "pan") {
      // Screen-space delta converted to pan-space (pan isn't itself zoom-scaled
      // in the transform order `translate(pan) scale(zoom)`, so raw client
      // delta maps 1:1 to pan delta).
      const dx = e.clientX - gesture.startClientX;
      const dy = e.clientY - gesture.startClientY;
      setPanDraft({ x: gesture.startPan.x + dx, y: gesture.startPan.y + dy });
    }
  };

  const handleSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === "device") {
      if (dragDeviceDraft) {
        dispatch({ type: "MOVE_TOPO_DEVICE", id: dragDeviceDraft.id, x: dragDeviceDraft.x, y: dragDeviceDraft.y });
      }
      setDragDeviceDraft(null);
    } else if (gesture.kind === "pan") {
      if (panDraft) {
        dispatch({ type: "SET_TOPO_PAN", x: panDraft.x, y: panDraft.y });
      }
      setPanDraft(null);
    } else if (gesture.kind === "connect") {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const pos = toWorldPos(e.clientX, e.clientY, rect, pan, zoom);
        const dev = findDeviceAt(devices, pos);
        if (dev && dev.id !== gesture.fromId) {
          dispatch({ type: "ADD_TOPO_CONNECTION", from: gesture.fromId, to: dev.id });
          const fromDev = devices.find((d) => d.id === gesture.fromId);
          setStatusMsg(`Connected ${fromDev?.name ?? gesture.fromId} ↔ ${dev.name}`);
        }
      }
      setConnectFromId(null);
    }

    gestureRef.current = null;
  };

  const handleSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    dispatch({ type: "SET_TOPO_ZOOM", zoom: clampZoom(zoom + delta) });
  };

  // ===== Properties panel =====

  const handleRenameCommit = () => {
    if (selectedDevice && nameDraft !== selectedDevice.name) {
      dispatch({ type: "RENAME_TOPO_DEVICE", id: selectedDevice.id, name: nameDraft || selectedDevice.name });
    }
  };

  const selectedConnectionCount = selectedDevice
    ? connections.filter((c) => c.from === selectedDevice.id || c.to === selectedDevice.id).length
    : 0;

  const cursor = currentTool === "connect" ? "crosshair" : currentTool === "erase" ? "not-allowed" : panDraft ? "grabbing" : "default";

  return (
    <div>
      <h2 className={styles.sectionTitle}>{"\u{1F5A7}"} Topology Builder</h2>

      <div style={{ display: "flex", height: "calc(100vh - 180px)", minHeight: 560, gap: 12 }}>
        {/* ===== Left: Device palette ===== */}
        <div className={styles.neuCardFlat} style={{ width: 190, flexShrink: 0, overflowY: "auto", padding: 12 }}>
          <div className={styles.holoText} style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            {"\u{1F4E6}"} Devices
          </div>
          {DEVICE_PALETTE.map((group) => (
            <div key={group.category} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>{group.category}</div>
              {group.items.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, item.type)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 8,
                    borderRadius: 8,
                    cursor: "grab",
                    marginBottom: 4,
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{DEVICE_ICONS[item.type]}</span>
                  <span style={{ color: "var(--text-primary)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}

          <div style={{ marginTop: 12, borderTop: "1px solid var(--glass-border)", paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Templates</div>
            {TOPO_TEMPLATES.map((template, idx) => (
              <button
                key={template.name}
                type="button"
                onClick={() => handleLoadTemplate(idx)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                  cursor: "pointer",
                  marginBottom: 4,
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  fontSize: 12,
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 14 }}>{TEMPLATE_ICONS[idx % TEMPLATE_ICONS.length]}</span>
                <span style={{ color: "var(--text-secondary)" }}>{template.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Center: Toolbar + canvas ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div className={styles.neuCardFlat} style={{ padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${currentTool === "select" ? styles.btnPrimary : styles.btnGhost}`}
              onClick={() => handleSetTool("select")}
              title="Select"
            >
              {"\u{1F5B1}️"} Select
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${currentTool === "connect" ? styles.btnPrimary : styles.btnGhost}`}
              onClick={() => handleSetTool("connect")}
              title="Connect"
            >
              {"\u{1F517}"} Connect
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${currentTool === "erase" ? styles.btnPrimary : styles.btnGhost}`}
              onClick={() => handleSetTool("erase")}
              title="Erase"
            >
              {"\u{1F5D1}️"} Erase
            </button>

            <div style={{ width: 1, height: 20, background: "var(--glass-border)", margin: "0 4px" }} />

            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => handleZoom(ZOOM_STEP)} title="Zoom In">
              {"\u{1F50D}"}+
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => handleZoom(-ZOOM_STEP)} title="Zoom Out">
              {"\u{1F50D}"}−
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={handleFitAll} title="Fit All">
              {"⬜"} Fit
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={handleToggleGrid} title="Toggle Grid">
              {"⊞"} Grid
            </button>

            <div style={{ width: 1, height: 20, background: "var(--glass-border)", margin: "0 4px" }} />

            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={handleExport} title="Export as SVG">
              {"\u{1F4F8}"} Export
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => setClearConfirmOpen(true)} title="Clear canvas">
              {"\u{1F9F9}"} Clear
            </button>

            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{statusMsg}</span>
          </div>

          {/* SVG Canvas */}
          <div
            className={styles.neuInset}
            style={{ flex: 1, overflow: "hidden", position: "relative", borderRadius: 12, minHeight: 400 }}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{ cursor, display: "block" }}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              onWheel={handleSvgWheel}
            >
              <defs>
                <pattern id="topoGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(99,102,241,0.06)" strokeWidth={0.5} />
                </pattern>
              </defs>
              {showGrid ? <rect width={4000} height={4000} x={-2000} y={-2000} fill="url(#topoGrid)" /> : null}

              <g transform={`translate(${effectivePan.x},${effectivePan.y}) scale(${zoom})`}>
                <g>
                  {connections.map((c, i) => {
                    const d1 = renderDevices.find((d) => d.id === c.from);
                    const d2 = renderDevices.find((d) => d.id === c.to);
                    if (!d1 || !d2) return null;
                    return (
                      <line
                        key={`${c.from}-${c.to}-${i}`}
                        x1={d1.x}
                        y1={d1.y}
                        x2={d2.x}
                        y2={d2.y}
                        stroke="rgba(99,102,241,0.4)"
                        strokeWidth={2}
                        strokeDasharray={currentTool === "erase" ? "5,5" : undefined}
                      />
                    );
                  })}
                </g>
                <g>
                  {renderDevices.map((d) => (
                    <g key={d.id} transform={`translate(${d.x}, ${d.y})`} style={{ cursor: "pointer" }}>
                      <circle
                        r={28}
                        fill={selectedDeviceId === d.id ? "rgba(99,102,241,0.3)" : "rgba(30,30,53,0.9)"}
                        stroke={
                          connectFromId === d.id
                            ? "var(--accent)"
                            : selectedDeviceId === d.id
                              ? "var(--accent)"
                              : "rgba(255,255,255,0.1)"
                        }
                        strokeWidth={2}
                      />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={22}>
                        {DEVICE_ICONS[d.type]}
                      </text>
                      <text textAnchor="middle" y={44} fontSize={11} fill="#9595b0">
                        {d.name}
                      </text>
                    </g>
                  ))}
                </g>
              </g>
            </svg>

            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 10,
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(0,0,0,0.5)",
                color: "var(--text-secondary)",
                fontSize: 11,
              }}
            >
              Zoom: {Math.round(zoom * 100)}%
            </div>
          </div>
        </div>

        {/* ===== Right: Properties panel ===== */}
        <div className={styles.neuCardFlat} style={{ width: 220, flexShrink: 0, overflowY: "auto", padding: 14 }}>
          <div className={styles.holoText} style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            {"⚙️"} Properties
          </div>
          {selectedDevice ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>{DEVICE_ICONS[selectedDevice.type]}</div>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={handleRenameCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameCommit();
                      e.currentTarget.blur();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: "var(--neu-bg-dark)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ marginBottom: 4 }}>Type: {selectedDevice.type}</div>
              <div style={{ marginBottom: 4 }}>
                X: {Math.round(selectedDevice.x)}, Y: {Math.round(selectedDevice.y)}
              </div>
              <div style={{ marginBottom: 4 }}>Connections: {selectedConnectionCount}</div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Select a device to view/edit its properties.</p>
          )}
        </div>
      </div>

      {clearConfirmOpen ? (
        <Modal
          title="Clear canvas?"
          onClose={() => setClearConfirmOpen(false)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setClearConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClearCanvas}>
                Clear canvas
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            This removes every device and connection from the current topology. This cannot be undone.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
