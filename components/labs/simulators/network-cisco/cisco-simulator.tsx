"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { ciscoReducer } from "@/lib/labs/simulators/network-cisco/reducer";
import { freshCiscoState } from "@/lib/labs/simulators/network-cisco/seedData";
import type { CiscoState } from "@/lib/labs/simulators/network-cisco/types";
import { CiscoShell, type CiscoPage } from "./cisco-shell";
import {
  DeviceInfoPage,
  EnvironmentPage,
  EtherchannelPage,
  InterfacesPage,
  SpanningTreePage,
  VlansPage,
  VtpPage,
} from "./device-interfaces-switching-pages";
import {
  AaaEventsPage,
  FilesPage,
  FirewallStatsPage,
  HttpsSshPage,
  RoutingEventsPage,
  SyslogPage,
  TopTalkersPage,
  VoicePage,
  WirelessPage,
} from "./management-monitoring-pages";
import { OverviewPage } from "./overview-page";
import {
  BgpPage,
  DiagHistoryPage,
  EigrpPage,
  OspfPage,
  PingTraceroutePage,
  RipPage,
  StaticRoutesPage,
} from "./routing-diagnostics-pages";
import { AaaPage, AclsPage, CertificatesPage, IpsPage, LocalUsersPage, NatPage } from "./security-pages";
import { DhcpPage, IpsecTunnelsPage, NtpPage, QosPage, SnmpPage, SslVpnPage } from "./vpn-services-pages";

const SIMULATOR_KEY = "network-cisco";
const SAVE_DEBOUNCE_MS = 1200;

export function CiscoSimulator() {
  const [state, dispatch] = useReducer(ciscoReducer, undefined, freshCiscoState);
  const [current, setCurrent] = useState<CiscoPage>("overview");
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
          dispatch({ type: "LOAD_STATE", state: data.state as CiscoState });
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
    <CiscoShell state={state} page={current} onNavigate={setCurrent} dispatch={dispatch}>
      {current === "overview" ? <OverviewPage state={state} onNavigate={setCurrent} /> : null}
      {current === "device-info" ? <DeviceInfoPage state={state} dispatch={dispatch} /> : null}
      {current === "environment" ? <EnvironmentPage state={state} /> : null}
      {current === "interfaces" ? <InterfacesPage state={state} dispatch={dispatch} /> : null}
      {current === "etherchannel" ? <EtherchannelPage state={state} /> : null}
      {current === "vlans" ? <VlansPage state={state} dispatch={dispatch} /> : null}
      {current === "vtp" ? <VtpPage state={state} /> : null}
      {current === "spanning-tree" ? <SpanningTreePage state={state} /> : null}

      {current === "static-routes" ? <StaticRoutesPage state={state} dispatch={dispatch} /> : null}
      {current === "rip" ? <RipPage state={state} /> : null}
      {current === "eigrp" ? <EigrpPage state={state} dispatch={dispatch} /> : null}
      {current === "ospf" ? <OspfPage state={state} dispatch={dispatch} /> : null}
      {current === "bgp" ? <BgpPage state={state} dispatch={dispatch} /> : null}

      {current === "acls" ? <AclsPage state={state} dispatch={dispatch} /> : null}
      {current === "nat" ? <NatPage state={state} dispatch={dispatch} /> : null}
      {current === "aaa" ? <AaaPage state={state} /> : null}
      {current === "local-users" ? <LocalUsersPage state={state} dispatch={dispatch} /> : null}
      {current === "certificates" ? <CertificatesPage state={state} /> : null}
      {current === "ips" ? <IpsPage state={state} /> : null}

      {current === "ipsec-tunnels" ? <IpsecTunnelsPage state={state} /> : null}
      {current === "ssl-vpn" ? <SslVpnPage state={state} /> : null}

      {current === "dhcp" ? <DhcpPage state={state} dispatch={dispatch} /> : null}
      {current === "snmp" ? <SnmpPage state={state} /> : null}
      {current === "ntp" ? <NtpPage state={state} /> : null}
      {current === "qos" ? <QosPage state={state} /> : null}

      {current === "https-ssh" ? <HttpsSshPage state={state} /> : null}
      {current === "syslog" ? <SyslogPage state={state} dispatch={dispatch} /> : null}
      {current === "files" ? <FilesPage state={state} /> : null}

      {current === "ping-traceroute" ? <PingTraceroutePage state={state} dispatch={dispatch} /> : null}
      {current === "diag-history" ? <DiagHistoryPage state={state} dispatch={dispatch} /> : null}

      {current === "voice" ? <VoicePage state={state} /> : null}
      {current === "wireless" ? <WirelessPage state={state} /> : null}

      {current === "top-talkers" ? <TopTalkersPage state={state} /> : null}
      {current === "firewall-stats" ? <FirewallStatsPage state={state} /> : null}
      {current === "aaa-events" ? <AaaEventsPage state={state} /> : null}
      {current === "routing-events" ? <RoutingEventsPage state={state} /> : null}
    </CiscoShell>
  );
}
