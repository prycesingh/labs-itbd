"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { ppReducer } from "@/lib/labs/simulators/power-platform/reducer";
import { freshPpState } from "@/lib/labs/simulators/power-platform/seedData";
import type { PpState } from "@/lib/labs/simulators/power-platform/types";
import { PpShell, type PpPage } from "./pp-shell";
import { AnalyticsPage, CapacityPage, LicensesPage } from "./analytics-capacity-licenses-page";
import { AppsPage } from "./apps-page";
import {
  CustomerLockboxPage,
  CustomerManagedKeyPage,
  PowerBiWorkspacesPage,
  PowerPagesSitesPage,
  SettingsPage,
  TenantIsolationPage,
} from "./bonus-pages";
import { CopilotStudioPage } from "./copilot-studio-page";
import { DlpPoliciesPage } from "./dlp-policies-page";
import { EnvironmentsPage } from "./environments-page";
import { FlowsPage } from "./flows-page";
import { OverviewPage } from "./overview-page";

const SIMULATOR_KEY = "power-platform";
const SAVE_DEBOUNCE_MS = 1200;

export function PpSimulator() {
  const [state, dispatch] = useReducer(ppReducer, undefined, freshPpState);
  const [current, setCurrent] = useState<PpPage>("overview");
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
          dispatch({ type: "LOAD_STATE", state: data.state as PpState });
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
    <PpShell state={state} page={current} onNavigate={setCurrent} dispatch={dispatch}>
      {current === "overview" ? <OverviewPage state={state} onNavigate={setCurrent} /> : null}
      {current === "environments" ? <EnvironmentsPage state={state} dispatch={dispatch} /> : null}
      {current === "apps" ? <AppsPage state={state} dispatch={dispatch} /> : null}
      {current === "flows" ? <FlowsPage state={state} dispatch={dispatch} /> : null}
      {current === "dlp-policies" ? <DlpPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "analytics" ? <AnalyticsPage state={state} /> : null}
      {current === "capacity" ? <CapacityPage state={state} dispatch={dispatch} /> : null}
      {current === "licenses" ? <LicensesPage state={state} dispatch={dispatch} /> : null}
      {current === "power-pages-sites" ? <PowerPagesSitesPage state={state} dispatch={dispatch} /> : null}
      {current === "power-bi-workspaces" ? <PowerBiWorkspacesPage state={state} dispatch={dispatch} /> : null}
      {current === "copilot-studio" ? <CopilotStudioPage state={state} dispatch={dispatch} /> : null}
      {current === "tenant-isolation" ? <TenantIsolationPage state={state} dispatch={dispatch} /> : null}
      {current === "customer-lockbox" ? <CustomerLockboxPage state={state} dispatch={dispatch} /> : null}
      {current === "customer-managed-key" ? <CustomerManagedKeyPage state={state} dispatch={dispatch} /> : null}
      {current === "settings" ? <SettingsPage state={state} /> : null}
    </PpShell>
  );
}
