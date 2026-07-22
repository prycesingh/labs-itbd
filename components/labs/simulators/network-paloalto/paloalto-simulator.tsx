"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { paloReducer } from "@/lib/labs/simulators/network-paloalto/reducer";
import { freshPaloState } from "@/lib/labs/simulators/network-paloalto/seedData";
import type { PaloState } from "@/lib/labs/simulators/network-paloalto/types";
import {
  AdministratorsPage,
  AuthProfilesPage,
  CertificatesPage,
  HighAvailabilityPage,
  LocalUsersPage,
  ServerProfilesPage,
  SystemLogsPage,
  ThreatLogsPage,
  TrafficLogsPage,
  UrlLogsPage,
  UserGroupsPage,
  WildfireSubmissionsPage,
} from "./device-users-logs-pages";
import { InterfacesPage, VirtualRoutersPage, VlansPage, ZonesPage } from "./network-pages";
import { AddressesPage, ApplicationsPage, ServicesPage, TagsPage } from "./objects-pages";
import { OverviewPage } from "./overview-page";
import { PaloShell, type PaloPage } from "./paloalto-shell";
import { AuthPoliciesPage, DecryptionPoliciesPage, NatPoliciesPage, SecurityPoliciesPage } from "./policies-pages";
import {
  AsProfilesPage,
  AvProfilesPage,
  DataProfileGroupsPage,
  FileWildfireProfilesPage,
  UrlProfilesPage,
  VpProfilesPage,
} from "./security-profiles-pages";
import { GlobalProtectPage, IkeGatewaysPage, IpsecTunnelsPage } from "./vpn-pages";

const SIMULATOR_KEY = "network-paloalto";
const SAVE_DEBOUNCE_MS = 1200;

export function PaloAltoSimulator() {
  const [state, dispatch] = useReducer(paloReducer, undefined, freshPaloState);
  const [current, setCurrent] = useState<PaloPage>("overview");
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
          dispatch({ type: "LOAD_STATE", state: data.state as PaloState });
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
    <PaloShell state={state} page={current} onNavigate={setCurrent} dispatch={dispatch}>
      {current === "overview" ? <OverviewPage state={state} onNavigate={setCurrent} /> : null}

      {current === "interfaces" ? <InterfacesPage state={state} dispatch={dispatch} /> : null}
      {current === "zones" ? <ZonesPage state={state} dispatch={dispatch} /> : null}
      {current === "virtual-routers" ? <VirtualRoutersPage state={state} dispatch={dispatch} /> : null}
      {current === "vlans" ? <VlansPage state={state} /> : null}

      {current === "addresses" ? <AddressesPage state={state} dispatch={dispatch} /> : null}
      {current === "services" ? <ServicesPage state={state} dispatch={dispatch} /> : null}
      {current === "applications" ? <ApplicationsPage state={state} /> : null}
      {current === "tags" ? <TagsPage state={state} dispatch={dispatch} /> : null}

      {current === "security-policies" ? <SecurityPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "nat-policies" ? <NatPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "decryption-policies" ? <DecryptionPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "auth-policies" ? <AuthPoliciesPage state={state} dispatch={dispatch} /> : null}

      {current === "av-profiles" ? <AvProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "as-profiles" ? <AsProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "vp-profiles" ? <VpProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "url-profiles" ? <UrlProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "file-wildfire-profiles" ? <FileWildfireProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "data-profile-groups" ? <DataProfileGroupsPage state={state} dispatch={dispatch} /> : null}

      {current === "ipsec-tunnels" ? <IpsecTunnelsPage state={state} dispatch={dispatch} /> : null}
      {current === "ike-gateways" ? <IkeGatewaysPage state={state} dispatch={dispatch} /> : null}
      {current === "global-protect" ? <GlobalProtectPage state={state} dispatch={dispatch} /> : null}

      {current === "administrators" ? <AdministratorsPage state={state} dispatch={dispatch} /> : null}
      {current === "certificates" ? <CertificatesPage state={state} /> : null}
      {current === "server-profiles" ? <ServerProfilesPage state={state} /> : null}
      {current === "high-availability" ? <HighAvailabilityPage state={state} dispatch={dispatch} /> : null}
      {current === "local-users" ? <LocalUsersPage state={state} dispatch={dispatch} /> : null}
      {current === "user-groups" ? <UserGroupsPage state={state} dispatch={dispatch} /> : null}
      {current === "auth-profiles" ? <AuthProfilesPage state={state} /> : null}

      {current === "traffic-logs" ? <TrafficLogsPage state={state} dispatch={dispatch} /> : null}
      {current === "threat-logs" ? <ThreatLogsPage state={state} dispatch={dispatch} /> : null}
      {current === "url-logs" ? <UrlLogsPage state={state} dispatch={dispatch} /> : null}
      {current === "wildfire-submissions" ? <WildfireSubmissionsPage state={state} /> : null}
      {current === "system-logs" ? <SystemLogsPage state={state} dispatch={dispatch} /> : null}
    </PaloShell>
  );
}
