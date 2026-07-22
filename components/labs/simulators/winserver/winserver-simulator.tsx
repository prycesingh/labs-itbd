"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { winServerReducer } from "@/lib/labs/simulators/winserver/reducer";
import { freshWinServerState } from "@/lib/labs/simulators/winserver/seedData";
import type { WinServerState } from "@/lib/labs/simulators/winserver/types";
import { AdcsConsole } from "./adcs-console";
import { DhcpConsole } from "./dhcp-console";
import { FailoverConsole } from "./failover-console";
import { FileshareConsole } from "./fileshare-console";
import { HyperVConsole } from "./hyperv-console";
import { PrintserverConsole } from "./printserver-console";
import { RrasConsole } from "./rras-console";
import { ServerManagerDashboard } from "./server-manager";
import { WacConsole } from "./wac-console";
import { WsContextMenuHost } from "./ws-context-menu";
import { WsShell, type WsTool } from "./ws-shell";
import { WsusConsole } from "./wsus-console";

const SIMULATOR_KEY = "winserver";
const SAVE_DEBOUNCE_MS = 1200;

export function WinServerSimulator() {
  const [state, dispatch] = useReducer(winServerReducer, undefined, freshWinServerState);
  const [current, setCurrent] = useState<WsTool>("dashboard");
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
          dispatch({ type: "LOAD_STATE", state: data.state as WinServerState });
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

  function onExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <WsShell
      current={current}
      onSwitch={setCurrent}
      server={state.server}
      vmCount={state.hyperv.vms.length}
      shareCount={state.fileshare.shares.length}
      scopeCount={state.dhcp.scopes.length}
      updateCount={state.wsus.updates.filter((u) => u.approval === "Not approved").length}
      onExport={onExport}
    >
      {current === "dashboard" ? <ServerManagerDashboard state={state} onLaunch={setCurrent} /> : null}
      {current === "hyperv" ? <HyperVConsole state={state} dispatch={dispatch} /> : null}
      {current === "fileshare" ? <FileshareConsole state={state} dispatch={dispatch} /> : null}
      {current === "dhcp" ? <DhcpConsole state={state} dispatch={dispatch} /> : null}
      {current === "wsus" ? <WsusConsole state={state} dispatch={dispatch} /> : null}
      {current === "wac" ? <WacConsole state={state} /> : null}
      {current === "adcs" ? <AdcsConsole state={state} dispatch={dispatch} /> : null}
      {current === "failover" ? <FailoverConsole state={state} dispatch={dispatch} /> : null}
      {current === "rras" ? <RrasConsole state={state} dispatch={dispatch} /> : null}
      {current === "printserver" ? <PrintserverConsole state={state} dispatch={dispatch} /> : null}
      <WsContextMenuHost />
    </WsShell>
  );
}
