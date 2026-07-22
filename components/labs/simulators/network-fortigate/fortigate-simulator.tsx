"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { fortiReducer } from "@/lib/labs/simulators/network-fortigate/reducer";
import { freshFortiGateState } from "@/lib/labs/simulators/network-fortigate/seedData";
import type { FortiGateState } from "@/lib/labs/simulators/network-fortigate/types";
import { FortiShell, type FortiPage } from "./fortigate-shell";
import { DhcpPage, InterfacesPage, PolicyRoutesPage, StaticRoutesPage, ZonesPage } from "./network-pages";
import { OverviewPage } from "./overview-page";
import { AddressesPage, FirewallPoliciesPage, IpPoolsPage, SchedulesPage, ServicesPage, VipsPage } from "./policy-objects-pages";
import {
  AppControlProfilesPage,
  AvProfilesPage,
  DnsFilterProfilesPage,
  IpsProfilesPage,
  OtherProfilesPage,
  SslProfilesPage,
  WebFilterProfilesPage,
} from "./security-profiles-pages";
import { AdministratorsPage, AdminProfilesPage, EventLogsPage, ForwardLogsPage, HaStatusPage } from "./system-logs-pages";
import { IpsecTunnelsPage, LdapRadiusPage, LocalUsersPage, SslVpnPage, UserGroupsPage } from "./vpn-users-pages";

const SIMULATOR_KEY = "network-fortigate";
const SAVE_DEBOUNCE_MS = 1200;

export function FortiGateSimulator() {
  const [state, dispatch] = useReducer(fortiReducer, undefined, freshFortiGateState);
  const [current, setCurrent] = useState<FortiPage>("overview");
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
          dispatch({ type: "LOAD_STATE", state: data.state as FortiGateState });
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
    <FortiShell state={state} page={current} onNavigate={setCurrent} dispatch={dispatch}>
      {current === "overview" ? <OverviewPage state={state} onNavigate={setCurrent} /> : null}

      {current === "interfaces" ? <InterfacesPage state={state} dispatch={dispatch} /> : null}
      {current === "zones" ? <ZonesPage state={state} dispatch={dispatch} /> : null}
      {current === "static-routes" ? <StaticRoutesPage state={state} dispatch={dispatch} /> : null}
      {current === "policy-routes" ? <PolicyRoutesPage state={state} /> : null}
      {current === "dhcp" ? <DhcpPage state={state} dispatch={dispatch} /> : null}

      {current === "firewall-policies" ? <FirewallPoliciesPage state={state} dispatch={dispatch} /> : null}
      {current === "addresses" ? <AddressesPage state={state} dispatch={dispatch} /> : null}
      {current === "services" ? <ServicesPage state={state} dispatch={dispatch} /> : null}
      {current === "schedules" ? <SchedulesPage state={state} dispatch={dispatch} /> : null}
      {current === "vips" ? <VipsPage state={state} dispatch={dispatch} /> : null}
      {current === "ip-pools" ? <IpPoolsPage state={state} dispatch={dispatch} /> : null}

      {current === "av-profiles" ? <AvProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "web-filter-profiles" ? <WebFilterProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "ips-profiles" ? <IpsProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "app-control-profiles" ? <AppControlProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "ssl-profiles" ? <SslProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "dns-filter-profiles" ? <DnsFilterProfilesPage state={state} dispatch={dispatch} /> : null}
      {current === "other-profiles" ? <OtherProfilesPage state={state} dispatch={dispatch} /> : null}

      {current === "ipsec-tunnels" ? <IpsecTunnelsPage state={state} dispatch={dispatch} /> : null}
      {current === "ssl-vpn" ? <SslVpnPage state={state} dispatch={dispatch} /> : null}

      {current === "local-users" ? <LocalUsersPage state={state} dispatch={dispatch} /> : null}
      {current === "user-groups" ? <UserGroupsPage state={state} dispatch={dispatch} /> : null}
      {current === "ldap-radius" ? <LdapRadiusPage state={state} /> : null}

      {current === "administrators" ? <AdministratorsPage state={state} dispatch={dispatch} /> : null}
      {current === "admin-profiles" ? <AdminProfilesPage state={state} /> : null}
      {current === "ha-status" ? <HaStatusPage state={state} /> : null}

      {current === "forward-logs" ? <ForwardLogsPage state={state} dispatch={dispatch} /> : null}
      {current === "event-logs" ? <EventLogsPage state={state} dispatch={dispatch} /> : null}
    </FortiShell>
  );
}
