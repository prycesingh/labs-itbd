"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { defenderReducer } from "@/lib/labs/simulators/defender/reducer";
import { freshDefenderState } from "@/lib/labs/simulators/defender/seedData";
import type { DefenderState } from "@/lib/labs/simulators/defender/types";
import { CustomDetectionPage } from "./custom-detection-page";
import { DefenderShell, type DefenderPage } from "./defender-shell";
import { EmailAttackSimPage, EmailCampaignsPage, EmailExplorerPage, EmailInvestigationsPage, EmailSubmissionsPage, EmailThreatTrackerPage } from "./email-collab-page";
import { QuarantinePage, TenantAllowBlockPage, ThreatExplorerPage } from "./email-extras-page";
import { EmailPoliciesPage } from "./email-policies-page";
import { AssetInventoryPage, EndpointsDevicesPage, VulnMgmtPage } from "./endpoints-page";
import { HomePage } from "./home-page";
import { HuntingPage } from "./hunting-page";
import { IdentitiesPage } from "./identities-page";
import { AlertsPage, IncidentsPage } from "./incidents-page";
import {
  CloudAppsConnectorsPage,
  CloudAppsDiscoveredPage,
  CloudAppsOauthPage,
  CloudAppsSessionPoliciesPage,
  ItdrHoneytokensPage,
  ItdrLateralMovementPage,
  ItdrPosturePage,
} from "./itdr-cloudapps-page";
import { PermissionsPage } from "./permissions-page";
import { SecureScorePage } from "./secure-score-page";
import { LearningHubPage, MoreResourcesPage, ReportsPage, SettingsPage } from "./static-pages";
import { ActionCenterPage, ThreatAnalyticsPage } from "./threat-analytics-action-center-page";

const SIMULATOR_KEY = "defender";
const SAVE_DEBOUNCE_MS = 1200;

export function DefenderSimulator() {
  const [state, dispatch] = useReducer(defenderReducer, undefined, freshDefenderState);
  const [current, setCurrent] = useState<DefenderPage>("home");
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
          dispatch({ type: "LOAD_STATE", state: data.state as DefenderState });
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
    <DefenderShell page={current} onNavigate={setCurrent}>
      {current === "home" ? <HomePage state={state} onNavigate={setCurrent} /> : null}
      {current === "incidents" ? <IncidentsPage state={state} dispatch={dispatch} /> : null}
      {current === "alerts" ? <AlertsPage state={state} /> : null}
      {current === "hunting" ? <HuntingPage state={state} dispatch={dispatch} /> : null}
      {current === "custom-detection" ? <CustomDetectionPage state={state} dispatch={dispatch} /> : null}
      {current === "endpoints-devices" ? <EndpointsDevicesPage state={state} /> : null}
      {current === "endpoints-vuln-mgmt" ? <VulnMgmtPage state={state} /> : null}
      {current === "endpoints-asset-inventory" ? <AssetInventoryPage state={state} dispatch={dispatch} /> : null}
      {current === "identities" ? <IdentitiesPage state={state} /> : null}
      {current === "secure-score" ? <SecureScorePage state={state} dispatch={dispatch} /> : null}
      {current === "email-explorer" ? <EmailExplorerPage state={state} /> : null}
      {current === "email-threat-explorer" ? <ThreatExplorerPage state={state} /> : null}
      {current === "email-campaigns" ? <EmailCampaignsPage state={state} /> : null}
      {current === "email-submissions" ? <EmailSubmissionsPage state={state} /> : null}
      {current === "email-attack-sim" ? <EmailAttackSimPage state={state} /> : null}
      {current === "email-threat-tracker" ? <EmailThreatTrackerPage state={state} /> : null}
      {current === "email-investigations" ? <EmailInvestigationsPage /> : null}
      {current === "email-policies" ? <EmailPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "email-tenant-allow-block" ? <TenantAllowBlockPage state={state} dispatch={dispatch} /> : null}
      {current === "email-quarantine" ? <QuarantinePage state={state} dispatch={dispatch} /> : null}
      {current === "itdr-posture" ? <ItdrPosturePage state={state} /> : null}
      {current === "itdr-lateral-movement" ? <ItdrLateralMovementPage state={state} /> : null}
      {current === "itdr-honeytokens" ? <ItdrHoneytokensPage state={state} dispatch={dispatch} /> : null}
      {current === "cloudapps-discovered" ? <CloudAppsDiscoveredPage state={state} dispatch={dispatch} /> : null}
      {current === "cloudapps-oauth" ? <CloudAppsOauthPage state={state} dispatch={dispatch} /> : null}
      {current === "cloudapps-connectors" ? <CloudAppsConnectorsPage state={state} /> : null}
      {current === "cloudapps-session-policies" ? <CloudAppsSessionPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "permissions" ? <PermissionsPage state={state} dispatch={dispatch} /> : null}
      {current === "threat-analytics" ? <ThreatAnalyticsPage state={state} dispatch={dispatch} /> : null}
      {current === "action-center" ? <ActionCenterPage state={state} dispatch={dispatch} /> : null}
      {current === "reports" ? <ReportsPage /> : null}
      {current === "settings" ? <SettingsPage /> : null}
      {current === "learning-hub" ? <LearningHubPage /> : null}
      {current === "more-resources" ? <MoreResourcesPage /> : null}
    </DefenderShell>
  );
}
