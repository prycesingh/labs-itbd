"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { intuneReducer } from "@/lib/labs/simulators/intune/reducer";
import { freshIntuneState } from "@/lib/labs/simulators/intune/seedData";
import type { IntuneState } from "@/lib/labs/simulators/intune/types";
import { AppProtectionPage } from "./app-protection-page";
import { AppsPage } from "./apps-page";
import { AutopilotPage } from "./autopilot-page";
import { CaPage } from "./ca-page";
import { CompliancePage } from "./compliance-page";
import { ConfigPage } from "./config-page";
import { DevicesPage } from "./devices-page";
import { EndpointSecurityPage } from "./endpoint-security-page";
import { HomePage } from "./home-page";
import { IntuneShell, type IntunePage } from "./intune-shell";
import { ReportsTenantPage } from "./reports-tenant-page";
import { TunnelPage } from "./tunnel-page";
import { UpdateRingsPage } from "./update-rings-page";
import { GroupsPage, UsersPage } from "./users-groups-page";

const SIMULATOR_KEY = "intune";
const SAVE_DEBOUNCE_MS = 1200;

export function IntuneSimulator() {
  const [state, dispatch] = useReducer(intuneReducer, undefined, freshIntuneState);
  const [current, setCurrent] = useState<IntunePage>("home");
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
          dispatch({ type: "LOAD_STATE", state: data.state as IntuneState });
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
    <IntuneShell current={current} onNavigate={setCurrent}>
      {current === "home" ? <HomePage state={state} onNavigate={setCurrent} /> : null}
      {current === "devices-all" ? <DevicesPage state={state} dispatch={dispatch} /> : null}
      {current === "compliance-policies" ? <CompliancePage state={state} dispatch={dispatch} /> : null}
      {current === "config-profiles" ? <ConfigPage state={state} dispatch={dispatch} /> : null}
      {current === "apps-all" ? <AppsPage state={state} dispatch={dispatch} /> : null}
      {current === "conditional-access" ? <CaPage state={state} dispatch={dispatch} /> : null}
      {current === "autopilot" ? <AutopilotPage state={state} dispatch={dispatch} /> : null}
      {current === "endpoint-security" ? <EndpointSecurityPage state={state} /> : null}
      {current === "app-protection" ? <AppProtectionPage state={state} /> : null}
      {current === "update-rings" ? <UpdateRingsPage state={state} /> : null}
      {current === "reports-tenant" ? <ReportsTenantPage state={state} /> : null}
      {current === "tunnel" ? <TunnelPage /> : null}
      {current === "users" ? <UsersPage state={state} dispatch={dispatch} /> : null}
      {current === "groups" ? <GroupsPage state={state} /> : null}
      {current === "tenant-admin" ? <ReportsTenantPage state={state} /> : null}
    </IntuneShell>
  );
}
