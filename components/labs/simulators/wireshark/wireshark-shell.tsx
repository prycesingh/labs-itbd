"use client";

// Persistent workbench chrome for the Wireshark packet-capture simulator:
// title bar -> menu bar -> toolbar -> filter bar -> {children} (the 3-pane
// split, owned by sibling agents) -> status bar. Unlike every prior ported
// suite (multi-page admin portals with a sidebar), this suite is a
// SINGLE-SCREEN workbench — there is no page-nav/routing concept here at all;
// `children` is always the same 3-pane area, and "modals" are the only
// thing that ever overlays it (via `onOpenModal`, plumbed up to the final
// simulator container which owns which WiresharkModalKind is currently open
// and renders its content).
//
// Ported from itbd-lab/simulators/wireshark/js/wireshark-main.js's
// titleBar()/menuBar()/toolBar()/filterBar()/updateStatus() (lines 49-127),
// replacing:
//   - prompt()-driven numbered submenus (_menuClick(), lines 279-307) with
//     real MenuDropdown popups.
//   - alert()-only Start/Stop/Restart capture (_capture(), lines 253-256)
//     with real START_CAPTURE/STOP_CAPTURE/RESTART_CAPTURE dispatches — the
//     actual setInterval wiring that calls capture-engine.ts's
//     generateLivePacket lives in the final simulator container, not here.
//   - decorative Open/Save As/Close toolbar buttons with: Open -> toast
//     ("not available in this simulator"), Save As -> genuinely functional
//     JSON export of the current packet capture, Close -> clears the current
//     selection (the closest real analogue to "close capture" without
//     discarding state a sibling agent's pane still needs).
//   - window.prompt()-based "Filter name:" save flow (_saveFilter(),
//     line 243) with a small inline text input (`.saveFilterPopover`).
// No native prompt()/alert()/confirm() anywhere in this file — sonner's
// `toast` covers every place source used alert().

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { WiresharkState } from "@/lib/labs/simulators/wireshark/types";
import type { WiresharkAction } from "@/lib/labs/simulators/wireshark/reducer";
import { compile, getSuggestions } from "@/lib/labs/simulators/wireshark/filter-engine";
import { MenuDropdown, StatusPill, exportJson } from "./wireshark-ui";
import styles from "./wireshark-console.module.css";

// ===== Modal-kind union =====
// THE CONFIRMED, definitive list every modal-building agent must render one
// of. Extend here first if a new modal is ever needed — never invent an
// ad-hoc modal id at a call site.
export type WiresharkModalKind =
  | "protocol-hierarchy"
  | "conversations"
  | "endpoints"
  | "io-graph"
  | "follow-stream"
  | "coloring-rules"
  | "saved-filters"
  | "protocol-reference"
  | "tls-keys"
  | null;

const FILTER_DEBOUNCE_MS = 200;

function badgeToneFor(status: WiresharkState["captureStatus"]): "idle" | "capturing" | "stopped" {
  if (status === "capturing") return "capturing";
  if (status === "stopped") return "stopped";
  return "idle";
}

export function WiresharkShell({
  state,
  dispatch,
  onOpenModal,
  displayedCount,
  children,
}: {
  state: WiresharkState;
  dispatch: React.Dispatch<WiresharkAction>;
  onOpenModal: (modal: WiresharkModalKind) => void;
  /** Filtering happens in the packet-list pane component; the shell only renders the count. */
  displayedCount?: number;
  children: ReactNode;
}) {
  const activeInterface = state.interfaces.find((i) => i.id === state.activeInterfaceId);
  const selectedPacket = state.packets.find((p) => p.no === state.selectedPacketNo) ?? null;
  const total = state.packets.length;
  const displayed = displayedCount ?? total;

  // ───────── Filter bar local UI state (debounced text, autocomplete, save popover) ─────────
  const [filterText, setFilterText] = useState(state.displayFilter);
  const [acOpen, setAcOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);

  // Keep local text in sync if displayFilter changes from elsewhere (e.g. a
  // quick-filter button dispatched directly, or RESTART_CAPTURE resetting it
  // — reducer doesn't reset it today, but this keeps the input honest either way).
  useEffect(() => {
    setFilterText(state.displayFilter);
  }, [state.displayFilter]);

  useEffect(() => {
    if (!acOpen && !saveOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setAcOpen(false);
        setSaveOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [acOpen, saveOpen]);

  const compiled = useMemo(() => compile(filterText), [filterText]);
  const suggestions = useMemo(() => (filterText ? getSuggestions(filterText) : []), [filterText]);

  function commitFilter(expr: string) {
    dispatch({ type: "SET_DISPLAY_FILTER", expr });
    if (expr.trim()) dispatch({ type: "ADD_RECENT_FILTER", expr });
  }

  function handleFilterInput(value: string) {
    setFilterText(value);
    setAcOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitFilter(value), FILTER_DEBOUNCE_MS);
  }

  function handleFilterKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      commitFilter(filterText);
      setAcOpen(false);
    } else if (e.key === "Escape") {
      setAcOpen(false);
    }
  }

  function applySuggestion(field: string) {
    const replaced = filterText.replace(/[A-Za-z0-9_.]+$/, field) + " ";
    setFilterText(replaced);
    setAcOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commitFilter(replaced);
  }

  function clearFilter() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilterText("");
    commitFilter("");
    setAcOpen(false);
  }

  function submitSaveFilter() {
    const name = saveName.trim();
    if (!name || !filterText.trim()) {
      toast.error("Enter a name and a non-empty filter to save.");
      return;
    }
    dispatch({ type: "ADD_SAVED_FILTER", filter: { id: `sf-${Date.now()}`, name, expr: filterText } });
    toast.success(`Filter saved: ${name}`);
    setSaveName("");
    setSaveOpen(false);
  }

  // ───────── Toolbar / menu actions ─────────
  function handleSaveAs() {
    if (state.packets.length === 0) {
      toast.error("No packets to save.");
      return;
    }
    exportJson(`${state.profile.name || "capture"}.json`, state.packets);
    toast.success(`Exported ${state.packets.length} packets.`);
  }

  function handleOpen() {
    toast("Not available in this simulator.", { description: "Opening a .pcap from disk isn't supported here." });
  }

  function handleClose() {
    dispatch({ type: "SELECT_PACKET", packetNo: null });
  }

  function handleFind() {
    toast("Use the display filter bar above.", { description: 'Try: frame contains "text"' });
  }

  return (
    <div className={styles.root}>
      {/* ===== TITLE BAR ===== */}
      <div className={styles.titleBar}>
        <span className={styles.sharkIcon} aria-hidden="true" />
        <span className={styles.titleText}>
          Wireshark
          {activeInterface ? <span className={styles.titleInterface}> — {activeInterface.name}</span> : null}
        </span>
        <StatusPill tone={badgeToneFor(state.captureStatus)}>
          {state.captureStatus === "capturing" ? "Capturing" : state.captureStatus === "stopped" ? "Stopped" : "Idle"}
        </StatusPill>
      </div>

      {/* ===== MENU BAR ===== */}
      <div className={styles.menuBar}>
        <MenuDropdown
          label="File"
          items={[
            { label: "Open...", shortcut: "Ctrl+O", onSelect: handleOpen },
            { label: "Save As...", shortcut: "Ctrl+S", onSelect: handleSaveAs },
            { kind: "separator" },
            { label: "Close", shortcut: "Ctrl+W", onSelect: handleClose },
          ]}
        />
        <MenuDropdown
          label="Edit"
          items={[{ label: "Find...", shortcut: "Ctrl+F", onSelect: handleFind }]}
        />
        <MenuDropdown
          label="View"
          items={[{ label: "Coloring Rules...", onSelect: () => onOpenModal("coloring-rules") }]}
        />
        <MenuDropdown
          label="Capture"
          items={[
            ...state.interfaces.map((iface) => ({
              label: `${iface.id === state.activeInterfaceId ? "● " : "○ "}${iface.name}`,
              onSelect: () => dispatch({ type: "SET_ACTIVE_INTERFACE", interfaceId: iface.id }),
            })),
            { kind: "separator" as const },
            { label: "Start", shortcut: "Ctrl+E", onSelect: () => dispatch({ type: "START_CAPTURE" }) },
            { label: "Stop", onSelect: () => dispatch({ type: "STOP_CAPTURE" }) },
            { label: "Restart", onSelect: () => dispatch({ type: "RESTART_CAPTURE" }) },
          ]}
        />
        <MenuDropdown
          label="Analyze"
          items={[
            { label: "Display Filters...", onSelect: () => onOpenModal("saved-filters") },
            {
              label: "Follow Stream",
              disabled: !selectedPacket,
              onSelect: () => {
                if (!selectedPacket) {
                  toast.error("Select a packet first.");
                  return;
                }
                onOpenModal("follow-stream");
              },
            },
          ]}
        />
        <MenuDropdown
          label="Statistics"
          items={[
            { label: "Protocol Hierarchy", onSelect: () => onOpenModal("protocol-hierarchy") },
            { label: "Conversations", onSelect: () => onOpenModal("conversations") },
            { label: "Endpoints", onSelect: () => onOpenModal("endpoints") },
            { label: "IO Graph", onSelect: () => onOpenModal("io-graph") },
          ]}
        />
        <MenuDropdown
          label="Tools"
          items={[
            { label: "Protocol Reference", onSelect: () => onOpenModal("protocol-reference") },
            { label: "TLS Keys", onSelect: () => onOpenModal("tls-keys") },
          ]}
        />
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.tbBtn}
          title="Start capturing"
          onClick={() => dispatch({ type: "START_CAPTURE" })}
          disabled={state.captureStatus === "capturing"}
        >
          &#9654;
        </button>
        <button
          type="button"
          className={styles.tbBtn}
          title="Stop capturing"
          onClick={() => dispatch({ type: "STOP_CAPTURE" })}
          disabled={state.captureStatus !== "capturing"}
        >
          &#9632;
        </button>
        <button type="button" className={styles.tbBtn} title="Restart capture" onClick={() => dispatch({ type: "RESTART_CAPTURE" })}>
          &#8635;
        </button>
        <span className={styles.tbSep} />
        <select
          className={styles.tbSelect}
          title="Capture interface"
          value={state.activeInterfaceId}
          onChange={(e) => dispatch({ type: "SET_ACTIVE_INTERFACE", interfaceId: e.target.value })}
        >
          {state.interfaces.map((iface) => (
            <option key={iface.id} value={iface.id}>
              {iface.name}
            </option>
          ))}
        </select>
        <span className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} title="Save As (export packets to JSON)" onClick={handleSaveAs}>
          &#128190;
        </button>
        <span className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} title="Statistics: Protocol Hierarchy" onClick={() => onOpenModal("protocol-hierarchy")}>
          PH
        </button>
        <button type="button" className={styles.tbBtn} title="Statistics: Conversations" onClick={() => onOpenModal("conversations")}>
          Conv
        </button>
        <button type="button" className={styles.tbBtn} title="Statistics: Endpoints" onClick={() => onOpenModal("endpoints")}>
          Endp
        </button>
        <button type="button" className={styles.tbBtn} title="Statistics: IO Graph" onClick={() => onOpenModal("io-graph")}>
          IO
        </button>
      </div>

      {/* ===== FILTER BAR ===== */}
      <div className={styles.filterBar}>
        <span className={styles.filterBookmark} style={{ display: "none" }} aria-hidden="true" />
        <div className={styles.filterInputWrap} ref={filterWrapRef}>
          <input
            type="text"
            className={`${styles.filterInput} ${!filterText ? styles.filterInputEmpty : compiled.ok ? "" : styles.filterInputInvalid}`}
            placeholder='e.g. tcp.port == 443  ||  http.request.method == "POST"  ||  dns.qry.name contains "evil"'
            value={filterText}
            onChange={(e) => handleFilterInput(e.target.value)}
            onKeyDown={handleFilterKeyDown}
            onFocus={() => setAcOpen(true)}
            aria-label="Display filter"
            aria-invalid={!compiled.ok}
          />
          {acOpen && suggestions.length > 0 ? (
            <div className={styles.filterAutocomplete}>
              {suggestions.map((s) => (
                <button key={s} type="button" className={styles.acItem} onMouseDown={(e) => e.preventDefault()} onClick={() => applySuggestion(s)}>
                  <code>{s}</code>
                </button>
              ))}
            </div>
          ) : null}
          {saveOpen ? (
            <div className={styles.saveFilterPopover}>
              <input
                type="text"
                className={styles.saveFilterInput}
                placeholder="Filter name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSaveFilter();
                  if (e.key === "Escape") setSaveOpen(false);
                }}
                autoFocus
              />
              <button type="button" className={styles.btn} onClick={submitSaveFilter}>
                Save
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" className={styles.filterApply} onClick={() => commitFilter(filterText)}>
          Apply
        </button>
        <button type="button" className={styles.filterClear} onClick={clearFilter}>
          Clear
        </button>
        <button
          type="button"
          className={styles.filterBookmark}
          title="Save filter"
          onClick={() => {
            if (!filterText.trim()) {
              toast.error("Type a filter expression first.");
              return;
            }
            setSaveOpen((v) => !v);
          }}
        >
          &#9733;
        </button>
      </div>

      {/* ===== THREE-PANE SPLIT (owned by sibling agents; this is just the slot) ===== */}
      <div className={styles.panes}>{children}</div>

      {/* ===== STATUS BAR ===== */}
      <div className={styles.statusBar}>
        <span className={styles.sbSection}>
          Packets: {total.toLocaleString()}
        </span>
        <span className={styles.sbSection}>
          Displayed: {displayed.toLocaleString()} ({total > 0 ? Math.round((displayed * 100) / total) : 100}%)
        </span>
        <span className={styles.sbSection}>
          {selectedPacket ? `Frame ${selectedPacket.no}: ${selectedPacket.protocol}, ${selectedPacket.length} bytes` : "No packet selected"}
        </span>
        <span className={styles.sbSection}>Marked: {state.markedFrames.length}</span>
        <span className={styles.sbProfile}>Profile: {state.profile.name}</span>
      </div>
    </div>
  );
}
