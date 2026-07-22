// ===== WIRESHARK SIMULATOR — REDUCER =====
// This is a NEW reducer — source (wireshark-*.js, all direct-mutation-then-`save()`)
// has no reducer/action concept at all. Every action below corresponds to either a
// real mutation call site in source (grep for `WSData.state.*` writes and the
// `WSharkApp._*` handlers across wireshark-main.js/wireshark-list.js), or a source
// interaction that was decorative/no-op and is now made real per the approved
// bug-fix scope (called out in each case's comment below).
//
// Bug fix #2 (approved): source has TWO unsynchronized "saved filters" schemas —
// `state.savedFilters` (real state, read by nothing) AND a separate ad hoc
// `localStorage.getItem('wshark_saved_filters')` written directly by `_saveFilter()`
// in main.js. This reducer has exactly ONE canonical `state.savedFilters` — there is
// no second save path anywhere in this layer.
//
// Bug fix #3 (approved): source's Coloring Rules editor renders rows with
// data-cr-up/-down/-del/-enable handlers wired against `WSData.state.coloringRules`
// directly (no reducer to route through) — this reducer provides the real
// ADD/UPDATE/DELETE/TOGGLE/REORDER actions so a future UI can wire them for real.
//
// Capture engine (approved "make it real" upgrade): source's Start/Stop/Restart
// buttons are 100% decorative (`_capture()` only calls `alert(...)`, see
// wireshark-main.js:253-256 — no timer, no packets ever appended). START_CAPTURE/
// STOP_CAPTURE/RESTART_CAPTURE below are real state transitions; APPEND_LIVE_PACKET
// is what the UI's `setInterval` (calling capture-engine.ts's `generateLivePacket`)
// dispatches repeatedly while `captureStatus === "capturing"`.

import type { WiresharkState, WsColoringRule, WsPacket, WsPrefs, WsSavedFilter } from "./types";
import { freshWiresharkState } from "./seedData";

export type WiresharkAction =
  | { type: "LOAD_STATE"; state: WiresharkState }

  // ───────── Display filter bar (wireshark-main.js's filter input + Ctrl+F) ─────────
  | { type: "SET_DISPLAY_FILTER"; expr: string }

  // ───────── Packet list selection (wireshark-list.js row click) ─────────
  | { type: "SELECT_PACKET"; packetNo: number | null }

  // ───────── Mark / ignore frame (wireshark-list.js `.marked`/`.ignored` classes) ─────────
  | { type: "TOGGLE_MARK_FRAME"; packetNo: number }
  | { type: "SET_IGNORED"; packetNo: number; ignored: boolean }
  // Real mutation covering source's implicit "clear all marks" intent (Edit menu /
  // right-click "Unmark All Displayed" in real Wireshark) — no dedicated per-frame
  // clear action exists in source, but a workbench UI plausibly needs a bulk clear.
  | { type: "CLEAR_ALL_MARKS" }

  // ───────── Capture interface selection (wireshark-main.js's Capture > Options) ─────────
  | { type: "SET_ACTIVE_INTERFACE"; interfaceId: string }

  // ───────── Capture engine (the approved "make it real" upgrade — source's
  // Start/Stop/Restart were `alert()`-only, see file header) ─────────
  | { type: "START_CAPTURE" }
  | { type: "STOP_CAPTURE" }
  | { type: "RESTART_CAPTURE" }
  // Dispatched repeatedly by the UI's setInterval while captureStatus === "capturing",
  // each carrying one packet produced by capture-engine.ts's `generateLivePacket`.
  | { type: "APPEND_LIVE_PACKET"; packet: WsPacket }

  // ───────── Coloring rules editor (bug fix #3 — see file header) ─────────
  | { type: "ADD_COLORING_RULE"; rule: WsColoringRule }
  | { type: "UPDATE_COLORING_RULE"; id: string; patch: Partial<WsColoringRule> }
  | { type: "DELETE_COLORING_RULE"; id: string }
  | { type: "TOGGLE_COLORING_RULE"; id: string }
  | { type: "REORDER_COLORING_RULE"; id: string; direction: "up" | "down" }
  // Ports source's "Reset to Defaults" button (wireshark-stats.js renderColoringRules()'s
  // `#wsCrReset`).
  | { type: "RESET_COLORING_RULES" }

  // ───────── Saved filters (bug fix #2 — the ONE canonical schema, see file header) ─────────
  | { type: "ADD_SAVED_FILTER"; filter: WsSavedFilter }
  | { type: "DELETE_SAVED_FILTER"; id: string }

  // ───────── Recent filters (source's `state.recentFilters`, populated on successful
  // filter application — main.js's Enter-to-apply handler) ─────────
  | { type: "ADD_RECENT_FILTER"; expr: string }

  // ───────── Preferences (wireshark-main.js's View menu column toggles / time format) ─────────
  | { type: "UPDATE_PREFS"; patch: Partial<WsPrefs> }

  // ───────── Capture profile (source's `state.profile`, a bare string in source;
  // kept as a real action for a future profile-switcher UI) ─────────
  | { type: "SET_PROFILE_NAME"; name: string };

const MAX_RECENT_FILTERS = 10;

export function wiresharkReducer(state: WiresharkState, action: WiresharkAction): WiresharkState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    // ───────── Display filter ─────────
    case "SET_DISPLAY_FILTER":
      return { ...state, displayFilter: action.expr };

    // ───────── Packet selection ─────────
    case "SELECT_PACKET":
      return { ...state, selectedPacketNo: action.packetNo };

    // ───────── Mark / ignore ─────────
    case "TOGGLE_MARK_FRAME": {
      const isMarked = state.markedFrames.includes(action.packetNo);
      return {
        ...state,
        packets: state.packets.map((p) => (p.no === action.packetNo ? { ...p, marked: !isMarked } : p)),
        markedFrames: isMarked ? state.markedFrames.filter((n) => n !== action.packetNo) : [...state.markedFrames, action.packetNo],
      };
    }
    case "SET_IGNORED":
      return {
        ...state,
        packets: state.packets.map((p) => (p.no === action.packetNo ? { ...p, ignored: action.ignored } : p)),
      };
    case "CLEAR_ALL_MARKS":
      return {
        ...state,
        packets: state.packets.map((p) => (p.marked ? { ...p, marked: false } : p)),
        markedFrames: [],
      };

    // ───────── Capture interface ─────────
    case "SET_ACTIVE_INTERFACE": {
      const exists = state.interfaces.some((i) => i.id === action.interfaceId);
      if (!exists) return state;
      return { ...state, activeInterfaceId: action.interfaceId };
    }

    // ───────── Capture engine ─────────
    case "START_CAPTURE":
      return { ...state, captureStatus: "capturing" };
    case "STOP_CAPTURE":
      return { ...state, captureStatus: "stopped" };
    case "RESTART_CAPTURE": {
      // Reseed packets/nextFrameNo/selectedPacketNo/markedFrames only — prefs,
      // coloringRules, savedFilters, recentFilters, profile, interfaces all persist.
      const fresh = freshWiresharkState();
      return {
        ...state,
        packets: fresh.packets,
        nextFrameNo: fresh.nextFrameNo,
        selectedPacketNo: null,
        markedFrames: [],
        captureStatus: "capturing",
      };
    }
    case "APPEND_LIVE_PACKET": {
      const interfaces = state.interfaces.map((i) => (i.id === state.activeInterfaceId ? { ...i, packetsCaptured: i.packetsCaptured + 1 } : i));
      return {
        ...state,
        packets: [...state.packets, action.packet],
        nextFrameNo: state.nextFrameNo + 1,
        interfaces,
      };
    }

    // ───────── Coloring rules ─────────
    case "ADD_COLORING_RULE":
      return { ...state, coloringRules: [...state.coloringRules, action.rule] };
    case "UPDATE_COLORING_RULE":
      return {
        ...state,
        coloringRules: state.coloringRules.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case "DELETE_COLORING_RULE":
      return { ...state, coloringRules: state.coloringRules.filter((r) => r.id !== action.id) };
    case "TOGGLE_COLORING_RULE":
      return {
        ...state,
        coloringRules: state.coloringRules.map((r) => (r.id === action.id ? { ...r, enabled: !r.enabled } : r)),
      };
    case "REORDER_COLORING_RULE": {
      const idx = state.coloringRules.findIndex((r) => r.id === action.id);
      if (idx === -1) return state;
      const swapWith = action.direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= state.coloringRules.length) return state;
      const rules = state.coloringRules.slice();
      [rules[idx], rules[swapWith]] = [rules[swapWith], rules[idx]];
      return { ...state, coloringRules: rules };
    }
    case "RESET_COLORING_RULES": {
      const fresh = freshWiresharkState();
      return { ...state, coloringRules: fresh.coloringRules };
    }

    // ───────── Saved filters (ONE canonical schema) ─────────
    case "ADD_SAVED_FILTER":
      return { ...state, savedFilters: [...state.savedFilters, action.filter] };
    case "DELETE_SAVED_FILTER":
      return { ...state, savedFilters: state.savedFilters.filter((f) => f.id !== action.id) };

    // ───────── Recent filters ─────────
    case "ADD_RECENT_FILTER": {
      if (!action.expr.trim()) return state;
      const withoutDup = state.recentFilters.filter((f) => f !== action.expr);
      return { ...state, recentFilters: [action.expr, ...withoutDup].slice(0, MAX_RECENT_FILTERS) };
    }

    // ───────── Preferences ─────────
    case "UPDATE_PREFS":
      return { ...state, prefs: { ...state.prefs, ...action.patch, columns: { ...state.prefs.columns, ...action.patch.columns } } };

    // ───────── Profile ─────────
    case "SET_PROFILE_NAME":
      return { ...state, profile: { ...state.profile, name: action.name } };

    default:
      return state;
  }
}
