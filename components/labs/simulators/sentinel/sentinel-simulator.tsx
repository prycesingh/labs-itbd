"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { sentinelReducer } from "@/lib/labs/simulators/sentinel/reducer";
import { freshSentinelState } from "@/lib/labs/simulators/sentinel/seedData";
import type { SentinelState } from "@/lib/labs/simulators/sentinel/types";
import { ContentHubPage } from "./content-hub-page";
import { DataConnectorsPage, RepositoriesPage, SettingsPage, WorkspaceManagerPage } from "./connectors-repos-settings-page";
import { HuntingPage } from "./hunting-page";
import { IncidentsPage } from "./incidents-page";
import { KqlPlaygroundPage } from "./kql-playground-page";
import { LogsPage } from "./logs-page";
import { OverviewPage } from "./overview-page";
import { AutomationRulesPage, PlaybooksPage } from "./playbooks-page";
import { RulesPage } from "./rules-page";
import { SentinelShell, type SentinelPage } from "./sentinel-shell";
import { MitrePage, NotebooksPage, UebaPage } from "./ueba-mitre-page";
import { ThreatIntelPage, WatchlistsPage } from "./watchlists-ti-page";
import { WorkbooksPage } from "./workbooks-page";

const SIMULATOR_KEY = "sentinel";
const SAVE_DEBOUNCE_MS = 1200;

export function SentinelSimulator() {
  const [state, dispatch] = useReducer(sentinelReducer, undefined, freshSentinelState);
  const [current, setCurrent] = useState<SentinelPage>("overview");
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
          dispatch({ type: "LOAD_STATE", state: data.state as SentinelState });
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

  return (
    <SentinelShell state={state} page={current} onNavigate={setCurrent}>
      {current === "overview" ? <OverviewPage state={state} onNavigate={setCurrent} /> : null}
      {current === "logs" ? <LogsPage state={state} dispatch={dispatch} /> : null}
      {current === "incidents" ? <IncidentsPage state={state} dispatch={dispatch} /> : null}
      {current === "hunting" ? <HuntingPage state={state} dispatch={dispatch} /> : null}
      {current === "rules" ? <RulesPage state={state} dispatch={dispatch} /> : null}
      {current === "playbooks" ? <PlaybooksPage state={state} dispatch={dispatch} /> : null}
      {current === "automation-rules" ? <AutomationRulesPage state={state} dispatch={dispatch} /> : null}
      {current === "workbooks" ? <WorkbooksPage state={state} dispatch={dispatch} /> : null}
      {current === "ueba" ? <UebaPage state={state} dispatch={dispatch} /> : null}
      {current === "mitre" ? <MitrePage state={state} /> : null}
      {current === "notebooks" ? <NotebooksPage state={state} /> : null}
      {current === "watchlists" ? <WatchlistsPage state={state} /> : null}
      {current === "threat-intel" ? <ThreatIntelPage state={state} dispatch={dispatch} /> : null}
      {current === "content-hub" ? <ContentHubPage state={state} dispatch={dispatch} /> : null}
      {current === "kql-playground" ? <KqlPlaygroundPage /> : null}
      {current === "data-connectors" ? <DataConnectorsPage state={state} dispatch={dispatch} /> : null}
      {current === "repositories" ? <RepositoriesPage state={state} dispatch={dispatch} /> : null}
      {current === "workspace-manager" ? <WorkspaceManagerPage /> : null}
      {current === "settings" ? <SettingsPage state={state} dispatch={dispatch} /> : null}
    </SentinelShell>
  );
}
