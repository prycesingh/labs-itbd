"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { freshNetSimState, netSimReducer } from "@/lib/labs/simulators/netsim-pro/reducer";
import type { NetSimState, NetSimTab } from "@/lib/labs/simulators/netsim-pro/types";
import { CliTab } from "./cli-tab";
import { DashboardTab } from "./dashboard-tab";
import { LearnTab } from "./learn-tab";
import { NetSimShell } from "./netsim-shell";
import { TopologyTab } from "./topology-tab";
import { ReferenceTab, ScenariosTab, TroubleshootTab } from "./troubleshoot-scenarios-reference-tabs";

const SIMULATOR_KEY = "netsim-pro";
const SAVE_DEBOUNCE_MS = 1200;

export function NetSimProSimulator() {
  const [state, dispatch] = useReducer(netSimReducer, undefined, freshNetSimState);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`)
      .then((res) => (res.ok ? res.json() : { state: null }))
      .then((data) => {
        if (cancelled) return;
        if (data.state) {
          dispatch({ type: "LOAD_STATE", state: data.state as NetSimState });
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
      body: JSON.stringify({ state: stateRef.current }),
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

  if (!loaded) {
    return <div style={{ padding: 48, textAlign: "center", color: "#605e5c" }}>Loading…</div>;
  }

  const onNavigate = (tab: NetSimTab) => dispatch({ type: "SET_ACTIVE_TAB", tab });

  return (
    <NetSimShell state={state} dispatch={dispatch}>
      {state.activeTab === "dashboard" ? <DashboardTab state={state} onNavigate={onNavigate} /> : null}
      {state.activeTab === "learn" ? <LearnTab state={state} dispatch={dispatch} /> : null}
      {state.activeTab === "topology" ? <TopologyTab state={state} dispatch={dispatch} /> : null}
      {state.activeTab === "troubleshoot" ? <TroubleshootTab state={state} dispatch={dispatch} /> : null}
      {state.activeTab === "scenarios" ? <ScenariosTab state={state} dispatch={dispatch} /> : null}
      {state.activeTab === "reference" ? <ReferenceTab state={state} /> : null}
      {state.activeTab === "cli" ? <CliTab state={state} dispatch={dispatch} /> : null}
    </NetSimShell>
  );
}
