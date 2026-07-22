"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { addsReducer } from "@/lib/labs/simulators/adds/reducer";
import { freshAddsState } from "@/lib/labs/simulators/adds/seedData";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { AadConnectConsole } from "./aadconnect-console";
import { AdcsConsole } from "./adcs-console";
import { AddsContextMenuHost } from "./adds-context-menu";
import { AddsShell, type AddsTool } from "./adds-shell";
import { AdfsConsole } from "./adfs-console";
import { AdsiConsole } from "./adsi-console";
import { AducConsole } from "./aduc-console";
import { BitlockerConsole } from "./bitlocker-console";
import { DhcpConsole } from "./dhcp-console";
import { DnsConsole } from "./dns-console";
import { EventViewerConsole } from "./eventviewer-console";
import { ExtraToolsConsole } from "./extra-tools-console";
import { FirewallConsole } from "./firewall-console";
import { FsmoConsole } from "./fsmo-console";
import { GpoConsole } from "./gpo-console";
import { HealthCheckConsole } from "./health-check-console";
import { KerberosConsole } from "./kerberos-console";
import { NpsConsole } from "./nps-console";
import { PsoConsole } from "./pso-console";
import { RecycleBinConsole } from "./recycle-bin-console";
import { ReplicationConsole } from "./replication-console";
import { RrasConsole } from "./rras-console";
import { ServerManager } from "./server-manager";
import { ServicesConsole } from "./services-console";
import { SitesConsole } from "./sites-console";
import { TaskSchedulerConsole } from "./taskscheduler-console";
import { TopologyConsole } from "./topology-console";
import { TrustsConsole } from "./trusts-console";

const SIMULATOR_KEY = "adds";
const SAVE_DEBOUNCE_MS = 1200;

export function AddsSimulator() {
  const [state, dispatch] = useReducer(addsReducer, undefined, freshAddsState);
  const [current, setCurrent] = useState<AddsTool>("server-mgr");
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
          dispatch({ type: "LOAD_STATE", state: data.state as AddsState });
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
    <AddsShell
      current={current}
      onSwitch={setCurrent}
      domain={state.domain}
      domainControllers={state.domainControllers}
      userCount={state.users.length}
      groupCount={state.groups.length}
      computerCount={state.computers.length}
      onExport={onExport}
    >
      {current === "server-mgr" ? <ServerManager domain={state.domain} onLaunch={setCurrent} /> : null}
      {current === "aduc" ? <AducConsole state={state} dispatch={dispatch} /> : null}
      {current === "gpo" ? <GpoConsole state={state} dispatch={dispatch} /> : null}
      {current === "dns" ? <DnsConsole state={state} dispatch={dispatch} /> : null}
      {current === "fsmo" ? <FsmoConsole state={state} dispatch={dispatch} /> : null}
      {current === "replication" ? <ReplicationConsole state={state} dispatch={dispatch} /> : null}
      {current === "troubleshoot" ? <HealthCheckConsole state={state} /> : null}
      {current === "sites" ? <SitesConsole state={state} dispatch={dispatch} /> : null}
      {current === "topology" ? <TopologyConsole state={state} dispatch={dispatch} /> : null}
      {current === "nps" ? <NpsConsole state={state} dispatch={dispatch} /> : null}
      {current === "eventviewer" ? <EventViewerConsole state={state} dispatch={dispatch} /> : null}
      {current === "recycle-bin" ? <RecycleBinConsole state={state} dispatch={dispatch} /> : null}
      {current === "pso" ? <PsoConsole state={state} dispatch={dispatch} /> : null}
      {current === "adsi" ? <AdsiConsole state={state} dispatch={dispatch} /> : null}
      {current === "adcs" ? <AdcsConsole state={state} dispatch={dispatch} /> : null}
      {current === "adfs" ? <AdfsConsole state={state} dispatch={dispatch} /> : null}
      {current === "trusts" ? <TrustsConsole state={state} dispatch={dispatch} /> : null}
      {current === "kerberos" ? <KerberosConsole state={state} dispatch={dispatch} /> : null}
      {current === "aadconnect" ? <AadConnectConsole state={state} dispatch={dispatch} /> : null}
      {current === "dhcp" ? <DhcpConsole state={state} dispatch={dispatch} /> : null}
      {current === "services" ? <ServicesConsole state={state} dispatch={dispatch} /> : null}
      {current === "taskscheduler" ? <TaskSchedulerConsole state={state} dispatch={dispatch} /> : null}
      {current === "firewall" ? <FirewallConsole state={state} dispatch={dispatch} /> : null}
      {current === "bitlocker" ? <BitlockerConsole state={state} dispatch={dispatch} /> : null}
      {current === "rras" ? <RrasConsole state={state} dispatch={dispatch} /> : null}
      {current === "extra" ? <ExtraToolsConsole state={state} dispatch={dispatch} /> : null}
      <AddsContextMenuHost />
    </AddsShell>
  );
}
