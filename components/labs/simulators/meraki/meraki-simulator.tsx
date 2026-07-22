"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { merakiReducer } from "@/lib/labs/simulators/meraki/reducer";
import { freshMerakiState } from "@/lib/labs/simulators/meraki/seedData";
import type { MerakiState } from "@/lib/labs/simulators/meraki/types";
import { MerakiShell, type MerakiPage } from "./meraki-shell";
import { CamCamerasPage, SensorSensorsPage } from "./cameras-sensors-pages";
import { HomePage } from "./home-page";
import {
  InsightApplicationsPage,
  InsightWanHealthPage,
  InsightWebAppsPage,
  OrgAuditLogPage,
  OrgInventoryPage,
  OrgLicensePage,
  OrgOverviewPage,
} from "./insight-org-pages";
import {
  NwAdminsPage,
  NwAlertsPage,
  NwClientsPage,
  NwDevicesPage,
  NwGeneralPage,
  NwHealthPage,
  NwOverviewPage,
  NwTemplatesPage,
  NwTopologyPage,
  NwTrafficAnalyticsPage,
} from "./network-wide-pages";
import {
  SecAddressingVlansPage,
  SecApplianceStatusPage,
  SecCenterPage,
  SecContentFilteringPage,
  SecFirewallPage,
  SecNatPage,
  SecRoutingPage,
  SecSdwanPage,
  SecSiteToSiteVpnPage,
  SecVpnStatusPage,
} from "./security-sdwan-pages";
import { SwAclPage, SwPortsPage, SwRoutingDhcpPage, SwSwitchesPage } from "./switch-pages";
import { WlAccessPointsPage, WlAirMarshalPage, WlBluetoothPage, WlSsidsPage } from "./wireless-pages";

const SIMULATOR_KEY = "meraki";
const SAVE_DEBOUNCE_MS = 1200;

export function MerakiSimulator() {
  const [state, dispatch] = useReducer(merakiReducer, undefined, freshMerakiState);
  const [current, setCurrent] = useState<MerakiPage>("nw-overview");
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
          dispatch({ type: "LOAD_STATE", state: data.state as MerakiState });
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
    <MerakiShell
      state={state}
      page={current}
      onNavigate={setCurrent}
      dispatch={dispatch}
      onNetworkChange={(networkId) => dispatch({ type: "SET_CURRENT_NETWORK", networkId })}
    >
      {current === "nw-overview" ? <NwOverviewPage state={state} /> : null}
      {current === "nw-clients" ? <NwClientsPage state={state} dispatch={dispatch} /> : null}
      {current === "nw-devices" ? <NwDevicesPage state={state} dispatch={dispatch} /> : null}
      {current === "nw-topology" ? <NwTopologyPage state={state} /> : null}
      {current === "nw-traffic-analytics" ? <NwTrafficAnalyticsPage state={state} /> : null}
      {current === "nw-health" ? <NwHealthPage state={state} /> : null}
      {current === "nw-alerts" ? <NwAlertsPage state={state} dispatch={dispatch} /> : null}
      {current === "nw-general" ? <NwGeneralPage state={state} /> : null}
      {current === "nw-admins" ? <NwAdminsPage state={state} dispatch={dispatch} /> : null}
      {current === "nw-templates" ? <NwTemplatesPage state={state} /> : null}

      {current === "sec-appliance-status" ? <SecApplianceStatusPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-center" ? <SecCenterPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-vpn-status" ? <SecVpnStatusPage state={state} /> : null}
      {current === "sec-addressing-vlans" ? <SecAddressingVlansPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-nat" ? <SecNatPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-site-to-site-vpn" ? <SecSiteToSiteVpnPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-routing" ? <SecRoutingPage state={state} /> : null}
      {current === "sec-firewall" ? <SecFirewallPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-content-filtering" ? <SecContentFilteringPage state={state} dispatch={dispatch} /> : null}
      {current === "sec-sdwan" ? <SecSdwanPage state={state} /> : null}

      {current === "sw-switches" ? <SwSwitchesPage state={state} onSelectSwitch={() => setCurrent("sw-ports")} /> : null}
      {current === "sw-ports" ? <SwPortsPage state={state} dispatch={dispatch} /> : null}
      {current === "sw-routing-dhcp" ? <SwRoutingDhcpPage state={state} /> : null}
      {current === "sw-acl" ? <SwAclPage state={state} /> : null}

      {current === "wl-access-points" ? <WlAccessPointsPage state={state} dispatch={dispatch} /> : null}
      {current === "wl-ssids" ? <WlSsidsPage state={state} dispatch={dispatch} /> : null}
      {current === "wl-air-marshal" ? <WlAirMarshalPage state={state} /> : null}
      {current === "wl-bluetooth" ? <WlBluetoothPage state={state} /> : null}

      {current === "cam-cameras" ? <CamCamerasPage state={state} /> : null}
      {current === "sensor-sensors" ? <SensorSensorsPage state={state} /> : null}

      {current === "insight-web-apps" ? <InsightWebAppsPage state={state} /> : null}
      {current === "insight-wan-health" ? <InsightWanHealthPage state={state} /> : null}
      {current === "insight-applications" ? <InsightApplicationsPage state={state} /> : null}

      {current === "org-overview" ? <OrgOverviewPage state={state} /> : null}
      {current === "org-inventory" ? <OrgInventoryPage state={state} dispatch={dispatch} /> : null}
      {current === "org-license" ? <OrgLicensePage state={state} /> : null}
      {current === "org-audit-log" ? <OrgAuditLogPage state={state} /> : null}
    </MerakiShell>
  );
}
