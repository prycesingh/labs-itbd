"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { purviewReducer } from "@/lib/labs/simulators/purview/reducer";
import { freshPurviewState } from "@/lib/labs/simulators/purview/seedData";
import type { PurviewState } from "@/lib/labs/simulators/purview/types";
import { AuditPage } from "./audit-page";
import { CommCompliancePage } from "./comm-compliance-page";
import { ComplianceManagerPage } from "./compliance-manager-page";
import { DataMapPage } from "./data-map-page";
import { DlmAdaptiveScopesPage, DlmLabelsPage, DlmPoliciesPage, RecordsManagementPage } from "./dlm-records-page";
import { DlpPage } from "./dlp-page";
import { EDiscoveryPremiumPage, EDiscoveryStandardPage } from "./ediscovery-page";
import { HomePage } from "./home-page";
import { InformationProtectionPage } from "./information-protection-page";
import { InsiderRiskPage } from "./insider-risk-page";
import { PurviewShell, type PurviewPage } from "./purview-shell";
import { DataEstateInsightsPage, DataQualityPage, InformationBarriersPage, RolesScopesPage, SettingsPage } from "./static-pages";

const SIMULATOR_KEY = "purview";
const SAVE_DEBOUNCE_MS = 1200;

export function PurviewSimulator() {
  const [state, dispatch] = useReducer(purviewReducer, undefined, freshPurviewState);
  const [current, setCurrent] = useState<PurviewPage>("home");
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
          dispatch({ type: "LOAD_STATE", state: data.state as PurviewState });
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
    <PurviewShell state={state} page={current} onNavigate={setCurrent}>
      {current === "home" ? <HomePage state={state} onNavigate={setCurrent} /> : null}
      {current === "audit" ? <AuditPage state={state} dispatch={dispatch} /> : null}
      {current === "data-map" ? <DataMapPage state={state} dispatch={dispatch} /> : null}
      {current === "data-estate-insights" ? <DataEstateInsightsPage state={state} /> : null}
      {current === "data-quality" ? <DataQualityPage /> : null}
      {current === "comm-compliance" ? <CommCompliancePage state={state} dispatch={dispatch} /> : null}
      {current === "compliance-manager" ? <ComplianceManagerPage state={state} dispatch={dispatch} /> : null}
      {current === "dlm-policies" ? <DlmPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "dlm-labels" ? <DlmLabelsPage state={state} dispatch={dispatch} /> : null}
      {current === "dlm-adaptive-scopes" ? <DlmAdaptiveScopesPage state={state} dispatch={dispatch} /> : null}
      {current === "records-management" ? <RecordsManagementPage state={state} dispatch={dispatch} /> : null}
      {current === "dlp" ? <DlpPage state={state} dispatch={dispatch} /> : null}
      {current === "ediscovery-standard" ? <EDiscoveryStandardPage state={state} dispatch={dispatch} /> : null}
      {current === "ediscovery-premium" ? <EDiscoveryPremiumPage state={state} dispatch={dispatch} /> : null}
      {current === "information-barriers" ? <InformationBarriersPage /> : null}
      {current === "information-protection" ? <InformationProtectionPage state={state} dispatch={dispatch} /> : null}
      {current === "insider-risk" ? <InsiderRiskPage state={state} dispatch={dispatch} /> : null}
      {current === "roles-scopes" ? <RolesScopesPage /> : null}
      {current === "settings" ? <SettingsPage /> : null}
    </PurviewShell>
  );
}
