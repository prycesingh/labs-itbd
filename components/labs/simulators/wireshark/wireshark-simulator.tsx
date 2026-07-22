"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { generateLivePacket } from "@/lib/labs/simulators/wireshark/capture-engine";
import { wiresharkReducer } from "@/lib/labs/simulators/wireshark/reducer";
import { freshWiresharkState } from "@/lib/labs/simulators/wireshark/seedData";
import type { WiresharkState } from "@/lib/labs/simulators/wireshark/types";
import { DetailsAndBytesPanes } from "./details-bytes-panes";
import { PacketListPane } from "./packet-list-pane";
import {
  ColoringRulesModal,
  ProtocolReferenceModal,
  SavedFiltersModal,
  TlsKeysModal,
} from "./reference-modals";
import {
  ConversationsModal,
  EndpointsModal,
  FollowStreamModal,
  IoGraphModal,
  ProtocolHierarchyModal,
} from "./stats-modals";
import { WiresharkShell, type WiresharkModalKind } from "./wireshark-shell";

const SIMULATOR_KEY = "wireshark";
const SAVE_DEBOUNCE_MS = 1200;
const CAPTURE_TICK_MS = 1800;
// Live-captured packets are ephemeral (like opening a fresh capture file) —
// only the first N packets from the seed data plus a bounded tail of newly
// captured ones are persisted, so an indefinitely-running capture doesn't
// bloat the saved simulator-state row forever.
const MAX_PERSISTED_PACKETS = 800;

function statePreparedForSave(state: WiresharkState): WiresharkState {
  if (state.packets.length <= MAX_PERSISTED_PACKETS) return state;
  return { ...state, packets: state.packets.slice(-MAX_PERSISTED_PACKETS) };
}

export function WiresharkSimulator() {
  const [state, dispatch] = useReducer(wiresharkReducer, undefined, freshWiresharkState);
  const [openModal, setOpenModal] = useState<WiresharkModalKind>(null);
  const [displayedCount, setDisplayedCount] = useState<number | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`)
      .then((res) => (res.ok ? res.json() : { state: null }))
      .then((data) => {
        if (cancelled) return;
        if (data.state) {
          dispatch({ type: "LOAD_STATE", state: data.state as WiresharkState });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const saveState = useCallback(() => {
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: statePreparedForSave(stateRef.current) }),
    }).catch(() => {
      /* best-effort — a failed save just means this session's changes won't
         survive logout; the simulator itself keeps working from local state */
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveState, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, loaded, saveState]);

  useEffect(() => {
    return () => saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────── Live-capture engine ─────────
  useEffect(() => {
    if (state.captureStatus !== "capturing") {
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
        captureInterval.current = null;
      }
      return;
    }
    captureInterval.current = setInterval(() => {
      const current = stateRef.current;
      const packet = generateLivePacket(current.nextFrameNo, current.packets, current.nextFrameNo, Date.now());
      dispatch({ type: "APPEND_LIVE_PACKET", packet });
    }, CAPTURE_TICK_MS);
    return () => {
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
        captureInterval.current = null;
      }
    };
  }, [state.captureStatus]);

  if (!loaded) {
    return <div style={{ padding: 48, textAlign: "center", color: "#605e5c" }}>Loading…</div>;
  }

  const selectedPacket = state.packets.find((p) => p.no === state.selectedPacketNo) ?? null;

  return (
    <>
      <WiresharkShell state={state} dispatch={dispatch} onOpenModal={setOpenModal} displayedCount={displayedCount}>
        <PacketListPane state={state} dispatch={dispatch} onDisplayedCountChange={setDisplayedCount} />
        <DetailsAndBytesPanes packet={selectedPacket} />
      </WiresharkShell>

      {openModal === "protocol-hierarchy" ? (
        <ProtocolHierarchyModal packets={state.packets} onClose={() => setOpenModal(null)} />
      ) : null}
      {openModal === "conversations" ? (
        <ConversationsModal packets={state.packets} onClose={() => setOpenModal(null)} />
      ) : null}
      {openModal === "endpoints" ? <EndpointsModal packets={state.packets} onClose={() => setOpenModal(null)} /> : null}
      {openModal === "io-graph" ? <IoGraphModal packets={state.packets} onClose={() => setOpenModal(null)} /> : null}
      {openModal === "follow-stream" && selectedPacket ? (
        <FollowStreamModal packets={state.packets} streamKey={selectedPacket.stream} onClose={() => setOpenModal(null)} />
      ) : null}
      {openModal === "coloring-rules" ? (
        <ColoringRulesModal state={state} dispatch={dispatch} onClose={() => setOpenModal(null)} />
      ) : null}
      {openModal === "saved-filters" ? (
        <SavedFiltersModal state={state} dispatch={dispatch} onClose={() => setOpenModal(null)} />
      ) : null}
      {openModal === "protocol-reference" ? <ProtocolReferenceModal onClose={() => setOpenModal(null)} /> : null}
      {openModal === "tls-keys" ? <TlsKeysModal onClose={() => setOpenModal(null)} /> : null}
    </>
  );
}
