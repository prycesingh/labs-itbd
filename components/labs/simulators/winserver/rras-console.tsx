"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsNatMapping, WsRoute } from "@/lib/labs/simulators/winserver/types";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, TabbedPanel, type WsTreeNode } from "./ws-mmc";
import { CheckboxRow, EmptyPane, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import styles from "./winserver-console.module.css";

type Dialog =
  | { kind: "new-route" }
  | { kind: "routing-table" }
  | { kind: "nat-properties" }
  | { kind: "new-mapping" }
  | { kind: "configure-rras" }
  | { kind: "server-properties" };

function statusPill(status: string): string {
  const s = status.toLowerCase();
  if (s === "up" || s === "connected" || s === "enabled") return styles.pillGreen;
  if (s === "down" || s === "disconnected" || s === "disabled") return styles.pillRed;
  return styles.pillAmber;
}

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function RrasConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("server");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true, server: true, ipv4: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const r = state.rras;

  const tree: WsTreeNode = {
    id: "root",
    icon: "RR",
    label: "Routing and Remote Access",
    children: [
      {
        id: "server",
        icon: "S",
        label: `${state.server.name} (local)`,
        children: [
          { id: "interfaces", icon: "IF", label: "Network Interfaces" },
          {
            id: "ipv4",
            icon: "v4",
            label: "IPv4",
            children: [
              { id: "static-routes", icon: "SR", label: "Static Routes" },
              { id: "nat", icon: "NT", label: "NAT" },
              { id: "dhcp-relay", icon: "DR", label: "DHCP Relay" },
            ],
          },
          { id: "vpn-clients", icon: "VM", label: "Remote Access Clients" },
        ],
      },
    ],
  };

  function headingFor(node: string): string {
    if (node === "root") return "Routing and Remote Access";
    if (node === "server") return `Routing and Remote Access on ${state.server.name}`;
    if (node === "interfaces") return `Network Interfaces (${r.interfaces.length})`;
    if (node === "ipv4") return "IPv4";
    if (node === "static-routes") return `IPv4 Static Routes (${r.routesV4.length})`;
    if (node === "nat") return "NAT";
    if (node === "dhcp-relay") return "DHCP Relay Agent";
    if (node === "vpn-clients") return `Remote Access Clients (${r.vpnClients.length} active)`;
    return "";
  }

  function deleteRoute(destination: string) {
    if (!confirm(`Delete static route to "${destination}"?`)) return;
    dispatch({ type: "DELETE_RRAS_ROUTE", version: "v4", destination });
    toast.success(`Route to ${destination} deleted`);
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const items: WsContextMenuItem[] = [];
    if (nodeId === "root" || nodeId === "server") {
      items.push({ key: "configure", label: "Configure and Enable Routing and Remote Access...", onClick: () => setDialog({ kind: "configure-rras" }) });
      items.push({
        key: "disable",
        label: "Disable Routing and Remote Access",
        onClick: () => toast.info("Routing and Remote Access disabled. (Not persisted in this lab.)"),
      });
      items.push("-");
      items.push({ key: "props", label: "Properties", onClick: () => setDialog({ kind: "server-properties" }) });
    } else if (nodeId === "static-routes") {
      items.push({ key: "new-route", label: "New Static Route...", onClick: () => setDialog({ kind: "new-route" }) });
      items.push({ key: "routing-table", label: "Show IP Routing Table...", onClick: () => setDialog({ kind: "routing-table" }) });
    } else if (nodeId === "nat") {
      items.push({ key: "nat-props", label: "Properties", onClick: () => setDialog({ kind: "nat-properties" }) });
      items.push({ key: "new-mapping", label: "New Mapping...", onClick: () => setDialog({ kind: "new-mapping" }) });
    }
    if (items.length) WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showRouteContextMenu(e: React.MouseEvent, destination: string) {
    WsContextMenu.show(e.clientX, e.clientY, [{ key: "delete", label: "Delete", onClick: () => deleteRoute(destination) }]);
  }

  function renderServer() {
    return (
      <ContentBody>
        <table className={styles.dashTable}>
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Server name</th>
              <td>{state.server.fqdn}</td>
            </tr>
            <tr>
              <th>Configuration</th>
              <td>
                <span className={`${styles.pill} ${r.enabled ? styles.pillGreen : styles.pillRed}`}>{r.enabled ? "Running" : "Not configured"}</span>
              </td>
            </tr>
            <tr>
              <th>Active VPN connections</th>
              <td>{r.vpnClients.length}</td>
            </tr>
            <tr>
              <th>Interfaces</th>
              <td>{r.interfaces.length}</td>
            </tr>
            <tr>
              <th>Static routes (IPv4)</th>
              <td>{r.routesV4.length}</td>
            </tr>
            <tr>
              <th>NAT</th>
              <td>
                <span className={`${styles.pill} ${r.nat.enabled ? styles.pillGreen : styles.pillRed}`}>{r.nat.enabled ? "Enabled" : "Disabled"}</span>
              </td>
            </tr>
            <tr>
              <th>DHCP Relay</th>
              <td>{r.dhcpRelay.serverIps.join(", ")}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "configure-rras" })}>
            Configure and Enable RRAS...
          </button>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "server-properties" })}>
            Properties
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderInterfaces() {
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Type", "Status", "IP Address", "Mask", "Description"]}>
          {r.interfaces.map((i) => (
            <tr key={i.name}>
              <td>{i.name}</td>
              <td>{i.type}</td>
              <td>
                <span className={`${styles.pill} ${statusPill(i.status)}`}>{i.status}</span>
              </td>
              <td>{i.ip}</td>
              <td>{i.mask}</td>
              <td>{i.description}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderStaticRoutes() {
    return (
      <ContentBody>
        <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "new-route" })}>
            New Static Route...
          </button>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "routing-table" })}>
            Show IP Routing Table...
          </button>
        </div>
        <ItemListTable columns={["Destination", "Network Mask", "Gateway", "Interface", "Metric", ""]}>
          {r.routesV4.map((route) => (
            <tr key={route.destination} onContextMenu={(e) => { e.preventDefault(); showRouteContextMenu(e, route.destination); }}>
              <td>{route.destination}</td>
              <td>{route.mask}</td>
              <td>{route.gateway}</td>
              <td>{route.interfaceName}</td>
              <td>{route.metric}</td>
              <td>
                <button type="button" className={styles.btn} onClick={() => deleteRoute(route.destination)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderNat() {
    return (
      <ContentBody>
        <p style={{ marginBottom: 8 }}>
          NAT is <span className={`${styles.pill} ${r.nat.enabled ? styles.pillGreen : styles.pillRed}`}>{r.nat.enabled ? "Enabled" : "Disabled"}</span>. Public
          interface: <b>{r.nat.publicInterface}</b>. Private interface: <b>{r.nat.privateInterface}</b>.
        </p>
        <h3 style={{ color: "#1d6dad", fontSize: 14, marginBottom: 4 }}>Address Pool</h3>
        <p>{r.nat.addressPool}</p>
        <h3 style={{ color: "#1d6dad", fontSize: 14, marginTop: 14, marginBottom: 4 }}>Port Forwarding (Static Mappings)</h3>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-mapping" })}>
            New Mapping...
          </button>
        </div>
        {r.nat.mappings.length === 0 ? (
          <EmptyPane>No port mappings configured.</EmptyPane>
        ) : (
          <ItemListTable columns={["Protocol", "Public Port", "Private Address", "Private Port", "Description"]}>
            {r.nat.mappings.map((m, i) => (
              <tr key={`${m.protocol}-${m.publicPort}-${i}`}>
                <td>{m.protocol}</td>
                <td>{m.publicPort}</td>
                <td>{m.privateAddr}</td>
                <td>{m.privatePort}</td>
                <td>{m.description}</td>
              </tr>
            ))}
          </ItemListTable>
        )}
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "nat-properties" })}>
            Properties
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderDhcpRelay() {
    return (
      <ContentBody>
        <table className={styles.dashTable}>
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>DHCP Servers</th>
              <td>{r.dhcpRelay.serverIps.join(", ")}</td>
            </tr>
            <tr>
              <th>Interfaces</th>
              <td>{r.dhcpRelay.interfaces.join(", ")}</td>
            </tr>
            <tr>
              <th>Boot threshold (seconds)</th>
              <td>{r.dhcpRelay.bootThreshold}</td>
            </tr>
            <tr>
              <th>Max hop count</th>
              <td>{r.dhcpRelay.maxHops}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btn} onClick={() => toast.info("DHCP Relay Agent properties are not persisted in this lab.")}>
            Properties
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderVpnClients() {
    const byProtocol = r.vpnClients.reduce<Record<string, number>>((acc, c) => {
      acc[c.protocol] = (acc[c.protocol] ?? 0) + 1;
      return acc;
    }, {});
    return (
      <ContentBody>
        <h3 style={{ color: "#1d6dad", fontSize: 14, marginBottom: 4 }}>Port Usage</h3>
        <table className={styles.dashTable}>
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Connections by protocol</th>
              <td>
                {Object.keys(byProtocol).length === 0
                  ? "None"
                  : Object.entries(byProtocol)
                      .map(([proto, count]) => `${proto}: ${count}`)
                      .join(", ")}
              </td>
            </tr>
            <tr>
              <th>Total active connections</th>
              <td>{r.vpnClients.length}</td>
            </tr>
          </tbody>
        </table>
        <h3 style={{ color: "#1d6dad", fontSize: 14, marginTop: 14, marginBottom: 4 }}>Active Connections</h3>
        {r.vpnClients.length === 0 ? (
          <EmptyPane>No active remote access connections.</EmptyPane>
        ) : (
          <ItemListTable columns={["User", "Assigned IP", "Protocol", "Duration", "Bytes In", "Bytes Out", "Connected At"]}>
            {r.vpnClients.map((c) => (
              <tr key={`${c.user}-${c.ip}`}>
                <td>{c.user}</td>
                <td>{c.ip}</td>
                <td>{c.protocol}</td>
                <td>{c.duration}</td>
                <td>{bytesLabel(c.bytesIn)}</td>
                <td>{bytesLabel(c.bytesOut)}</td>
                <td>{new Date(c.connectedAt).toLocaleString()}</td>
              </tr>
            ))}
          </ItemListTable>
        )}
      </ContentBody>
    );
  }

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={tree}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((ex) => ({ ...ex, [id]: !ex[id] }))}
          onContextMenu={showTreeContextMenu}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          {selectedNode === "root" || selectedNode === "server" ? (
            renderServer()
          ) : selectedNode === "interfaces" ? (
            renderInterfaces()
          ) : selectedNode === "ipv4" ? (
            <ContentBody>
              <EmptyPane>Select Static Routes, NAT, or DHCP Relay from the tree.</EmptyPane>
            </ContentBody>
          ) : selectedNode === "static-routes" ? (
            renderStaticRoutes()
          ) : selectedNode === "nat" ? (
            renderNat()
          ) : selectedNode === "dhcp-relay" ? (
            renderDhcpRelay()
          ) : selectedNode === "vpn-clients" ? (
            renderVpnClients()
          ) : (
            <EmptyPane>Select an object in the tree.</EmptyPane>
          )}
        </>
      }
      dialogs={<RrasDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} />}
    />
  );
}

function RrasDialogs({
  dialog,
  state,
  dispatch,
  onClose,
}: {
  dialog: Dialog | null;
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  onClose: () => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "new-route") return <NewStaticRouteDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "routing-table") return <RoutingTableDialog state={state} onClose={onClose} />;
  if (dialog.kind === "nat-properties") return <NatPropertiesDialog state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "new-mapping") return <NewMappingDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "configure-rras") return <ConfigureRrasWizard state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "server-properties") return <ServerPropertiesDialog state={state} onClose={onClose} />;
  return null;
}

function NewStaticRouteDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const interfaces = state.rras.interfaces;
  const [destination, setDestination] = useState("10.50.0.0");
  const [mask, setMask] = useState("255.255.255.0");
  const [gateway, setGateway] = useState("10.10.0.1");
  const [interfaceName, setInterfaceName] = useState(interfaces[0]?.name ?? "");
  const [metric, setMetric] = useState(1);

  return (
    <WsDialogComponent
      title="New Static Route"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!destination.trim() || !mask.trim() || !gateway.trim()) {
              alert("Destination, network mask, and gateway are required.");
              return false;
            }
            if (state.rras.routesV4.some((r) => r.destination === destination.trim())) {
              alert("A route to that destination already exists.");
              return false;
            }
            const route: WsRoute = { destination: destination.trim(), mask: mask.trim(), gateway: gateway.trim(), interfaceName, metric };
            dispatch({ type: "ADD_RRAS_ROUTE", version: "v4", route });
            toast.success(`Route to ${route.destination} added`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Interface">
        <select value={interfaceName} onChange={(e) => setInterfaceName(e.target.value)}>
          {interfaces.map((i) => (
            <option key={i.name} value={i.name}>
              {i.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Destination">
        <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} />
      </FormRow>
      <FormRow label="Network mask">
        <input type="text" value={mask} onChange={(e) => setMask(e.target.value)} />
      </FormRow>
      <FormRow label="Gateway">
        <input type="text" value={gateway} onChange={(e) => setGateway(e.target.value)} />
      </FormRow>
      <FormRow label="Metric">
        <input type="number" min={1} max={9999} value={metric} onChange={(e) => setMetric(Number(e.target.value) || 1)} />
      </FormRow>
    </WsDialogComponent>
  );
}

function RoutingTableDialog({ state, onClose }: { state: WinServerState; onClose: () => void }) {
  const lines = [
    "===========================================================================",
    "Interface List",
    ...state.rras.interfaces.map((i, idx) => ` ${idx + 1}...${i.name.padEnd(30)} ${i.description}`),
    "===========================================================================",
    "",
    "IPv4 Route Table",
    "===========================================================================",
    "Active Routes:",
    "Network Destination        Netmask          Gateway       Interface  Metric",
    ...state.rras.routesV4.map(
      (r) => `${r.destination.padEnd(28)}${r.mask.padEnd(17)}${r.gateway.padEnd(14)}${r.interfaceName.padEnd(11)}${r.metric}`,
    ),
    "===========================================================================",
  ];
  return (
    <WsDialogComponent title="IP Routing Table" width="640px" onClose={onClose} buttons={[{ label: "Close", primary: true }]}>
      <pre className={styles.terminal}>{lines.join("\n")}</pre>
    </WsDialogComponent>
  );
}

function NatPropertiesDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const nat = state.rras.nat;
  const interfaces = state.rras.interfaces;
  const [enabled, setEnabled] = useState(nat.enabled);
  const [publicInterface, setPublicInterface] = useState(nat.publicInterface);
  const [privateInterface, setPrivateInterface] = useState(nat.privateInterface);
  const [addressPool, setAddressPool] = useState(nat.addressPool);

  return (
    <WsDialogComponent
      title="NAT Properties"
      width="560px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "SET_NAT_ENABLED", enabled });
            if (publicInterface !== nat.publicInterface || privateInterface !== nat.privateInterface || addressPool !== nat.addressPool) {
              toast.info("Interface and address pool changes are illustrative only in this lab.");
            }
            toast.success(`NAT ${enabled ? "enabled" : "disabled"}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <CheckboxRow id="natEnabled" label="Enable NAT on this server" checked={enabled} onChange={setEnabled} />
      <FormRow label="Public interface">
        <select value={publicInterface} onChange={(e) => setPublicInterface(e.target.value)}>
          {interfaces.map((i) => (
            <option key={i.name} value={i.name}>
              {i.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Private interface">
        <select value={privateInterface} onChange={(e) => setPrivateInterface(e.target.value)}>
          {interfaces.map((i) => (
            <option key={i.name} value={i.name}>
              {i.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormSection title="Address Pool">
        <FormRow label="Range">
          <input type="text" value={addressPool} onChange={(e) => setAddressPool(e.target.value)} />
        </FormRow>
        <HelpText>Interface and address pool fields are illustrative only — only Enable NAT is persisted in this lab.</HelpText>
      </FormSection>
    </WsDialogComponent>
  );
}

function NewMappingDialog({ dispatch, onClose }: { dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [protocol, setProtocol] = useState<"TCP" | "UDP">("TCP");
  const [publicPort, setPublicPort] = useState(80);
  const [privateAddr, setPrivateAddr] = useState("10.10.0.50");
  const [privatePort, setPrivatePort] = useState(80);
  const [description, setDescription] = useState("");

  return (
    <WsDialogComponent
      title="Add Special Port"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!privateAddr.trim()) {
              alert("Private address is required.");
              return false;
            }
            const mapping: WsNatMapping = { protocol, publicPort, privateAddr: privateAddr.trim(), privatePort, description: description.trim() };
            dispatch({ type: "ADD_NAT_MAPPING", mapping });
            toast.success(`Mapping for port ${mapping.publicPort} added`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Protocol">
        <select value={protocol} onChange={(e) => setProtocol(e.target.value as "TCP" | "UDP")}>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
        </select>
      </FormRow>
      <FormRow label="Public port">
        <input type="number" min={1} max={65535} value={publicPort} onChange={(e) => setPublicPort(Number(e.target.value) || 1)} />
      </FormRow>
      <FormRow label="Private address">
        <input type="text" value={privateAddr} onChange={(e) => setPrivateAddr(e.target.value)} />
      </FormRow>
      <FormRow label="Private port">
        <input type="number" min={1} max={65535} value={privatePort} onChange={(e) => setPrivatePort(Number(e.target.value) || 1)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
    </WsDialogComponent>
  );
}

const CONFIGURE_RRAS_STEPS = ["Welcome", "Configuration", "Remote Access", "VPN Connection", "IP Address Assignment", "Authentication", "Summary"] as const;

type ConfigMode = "ras" | "nat" | "vpnnat" | "s2s" | "custom";

const CONFIG_MODE_LABELS: Record<ConfigMode, string> = {
  ras: "Remote access (dial-up or VPN)",
  nat: "Network address translation (NAT)",
  vpnnat: "Virtual private network (VPN) access and NAT",
  s2s: "Secure connection between two private networks",
  custom: "Custom configuration",
};

function ConfigureRrasWizard({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ConfigMode>("vpnnat");
  const [vpnChecked, setVpnChecked] = useState(true);
  const [dialupChecked, setDialupChecked] = useState(false);
  const internetInterfaces = state.rras.interfaces.filter((i) => i.type !== "Internal");
  const [vpnInterface, setVpnInterface] = useState(internetInterfaces[0]?.name ?? "");
  const [assignment, setAssignment] = useState<"dhcp" | "pool">("pool");
  const [poolStart, setPoolStart] = useState("10.40.0.50");
  const [poolEnd, setPoolEnd] = useState("10.40.0.200");
  const [authProvider, setAuthProvider] = useState<"windows" | "radius">("windows");

  const showRemoteAccessStep = mode === "ras" || mode === "vpnnat" || mode === "custom";
  const showVpnStep = mode === "ras" || mode === "vpnnat" || mode === "s2s";

  function visibleSteps(): number[] {
    const indices = [0, 1];
    if (showRemoteAccessStep) indices.push(2);
    if (showVpnStep) indices.push(3);
    indices.push(4, 5, 6);
    return indices;
  }

  function nextVisibleStep(current: number): number {
    const v = visibleSteps();
    const pos = v.indexOf(current);
    return v[pos + 1] ?? current;
  }

  function prevVisibleStep(current: number): number {
    const v = visibleSteps();
    const pos = v.indexOf(current);
    return v[Math.max(pos - 1, 0)];
  }

  function finish() {
    if (mode === "nat" || mode === "vpnnat") {
      dispatch({ type: "SET_NAT_ENABLED", enabled: true });
    }
    toast.success(`Routing and Remote Access configured: ${CONFIG_MODE_LABELS[mode]}`);
    return true;
  }

  const isLast = step === 6;

  return (
    <WsDialogComponent
      title="Routing and Remote Access Server Setup Wizard"
      width="700px"
      onClose={onClose}
      buttons={[
        ...(step > 0 ? [{ label: "< Previous", onClick: () => { setStep(prevVisibleStep(step)); return false; } }] : []),
        isLast
          ? { label: "Finish", primary: true, onClick: finish }
          : {
              label: "Next >",
              primary: true,
              onClick: () => {
                setStep(nextVisibleStep(step));
                return false;
              },
            },
        { label: "Cancel" },
      ]}
    >
      <div className={styles.wizSteps}>
        {CONFIGURE_RRAS_STEPS.map((s, i) => (
          <span key={s} className={i === step ? styles.wizStepActive : i < step ? styles.wizStepDone : styles.wizStep}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div style={{ padding: 14 }}>
        {step === 0 ? (
          <>
            <p style={{ marginBottom: 8 }}>
              <b>Welcome to the Routing and Remote Access Server Setup Wizard</b>
            </p>
            <p>This wizard helps you set up routing and remote access for this server.</p>
          </>
        ) : null}
        {step === 1 ? (
          <FormSection title="Configuration">
            {(Object.keys(CONFIG_MODE_LABELS) as ConfigMode[]).map((m) => (
              <label key={m} style={{ display: "block", marginBottom: 6 }}>
                <input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {CONFIG_MODE_LABELS[m]}
              </label>
            ))}
          </FormSection>
        ) : null}
        {step === 2 ? (
          <>
            <p style={{ marginBottom: 8 }}>Select the remote access methods to enable.</p>
            <CheckboxRow id="cfgVpn" label="VPN" checked={vpnChecked} onChange={setVpnChecked} />
            <CheckboxRow id="cfgDialup" label="Dial-up" checked={dialupChecked} onChange={setDialupChecked} />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <p style={{ marginBottom: 8 }}>Select the network interface that connects this server to the Internet.</p>
            <FormRow label="Interface">
              <select value={vpnInterface} onChange={(e) => setVpnInterface(e.target.value)}>
                {internetInterfaces.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} ({i.ip})
                  </option>
                ))}
              </select>
            </FormRow>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <FormSection title="IP Address Assignment">
              <label style={{ display: "block", marginBottom: 6 }}>
                <input type="radio" checked={assignment === "dhcp"} onChange={() => setAssignment("dhcp")} /> Automatically (DHCP)
              </label>
              <label style={{ display: "block" }}>
                <input type="radio" checked={assignment === "pool"} onChange={() => setAssignment("pool")} /> From a specified range of addresses
              </label>
            </FormSection>
            {assignment === "pool" ? (
              <>
                <FormRow label="Start IP">
                  <input type="text" value={poolStart} onChange={(e) => setPoolStart(e.target.value)} />
                </FormRow>
                <FormRow label="End IP">
                  <input type="text" value={poolEnd} onChange={(e) => setPoolEnd(e.target.value)} />
                </FormRow>
              </>
            ) : null}
          </>
        ) : null}
        {step === 5 ? (
          <FormSection title="Authentication">
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" checked={authProvider === "windows"} onChange={() => setAuthProvider("windows")} /> No, use Routing and Remote Access to
              authenticate connection requests (Windows Authentication)
            </label>
            <label style={{ display: "block" }}>
              <input type="radio" checked={authProvider === "radius"} onChange={() => setAuthProvider("radius")} /> Yes, set up this server to work with a
              RADIUS server (Network Policy Server)
            </label>
          </FormSection>
        ) : null}
        {step === 6 ? (
          <FormSection title="Summary">
            <div>
              <b>Configuration:</b> {CONFIG_MODE_LABELS[mode]}
            </div>
            {showRemoteAccessStep ? (
              <div>
                <b>Remote access:</b> {[vpnChecked && "VPN", dialupChecked && "Dial-up"].filter(Boolean).join(", ") || "None"}
              </div>
            ) : null}
            {showVpnStep ? (
              <div>
                <b>VPN interface:</b> {vpnInterface || "(none)"}
              </div>
            ) : null}
            <div>
              <b>IP address assignment:</b> {assignment === "dhcp" ? "DHCP" : `Pool ${poolStart} - ${poolEnd}`}
            </div>
            <div>
              <b>Authentication:</b> {authProvider === "windows" ? "Windows Authentication" : "RADIUS"}
            </div>
            <HelpText>
              This wizard is illustrative — it does not remap the seeded RRAS configuration one-to-one.
              {mode === "nat" || mode === "vpnnat" ? " NAT will be enabled on completion." : ""}
            </HelpText>
          </FormSection>
        ) : null}
      </div>
    </WsDialogComponent>
  );
}

function ServerPropertiesDialog({ state, onClose }: { state: WinServerState; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("General");
  const [authProvider, setAuthProvider] = useState<"Windows Authentication" | "RADIUS Authentication">("Windows Authentication");
  const [loggingMode, setLoggingMode] = useState(state.rras.logging.mode);
  const [localFile, setLocalFile] = useState(state.rras.logging.localFile);
  const [path, setPath] = useState(state.rras.logging.path);

  const tabs = ["General", "Security", "IPv4", "IPv6", "PPP", "Logging"];

  return (
    <WsDialogComponent
      title={`${state.server.name} (local) Properties`}
      width="560px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            toast.info("Server Properties changes are illustrative only in this lab.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <TabbedPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderTab={(tab) => {
          if (tab === "General")
            return (
              <>
                <CheckboxRow id="genRouter" label="Enable this computer as a router" checked={state.rras.enabled} onChange={() => {}} />
                <CheckboxRow id="genRas" label="IPv4 Remote access server" checked={state.rras.enabled} onChange={() => {}} />
                <HelpText>Router and remote access status reflect the current RRAS configuration.</HelpText>
              </>
            );
          if (tab === "Security")
            return (
              <>
                <FormRow label="Authentication provider">
                  <select value={authProvider} onChange={(e) => setAuthProvider(e.target.value as typeof authProvider)}>
                    <option>Windows Authentication</option>
                    <option>RADIUS Authentication</option>
                  </select>
                </FormRow>
                <HelpText>Decorative in this lab — not persisted.</HelpText>
              </>
            );
          if (tab === "IPv4")
            return (
              <>
                <FormRow label="Static routes">
                  <input type="text" value={String(state.rras.routesV4.length)} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="NAT">
                  <input type="text" value={state.rras.nat.enabled ? "Enabled" : "Disabled"} readOnly style={{ background: "#eee" }} />
                </FormRow>
              </>
            );
          if (tab === "IPv6")
            return (
              <>
                <FormRow label="Static routes">
                  <input type="text" value={String(state.rras.routesV6.length)} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <HelpText>IPv6 routing is not fully modeled in this lab.</HelpText>
              </>
            );
          if (tab === "PPP")
            return (
              <>
                <CheckboxRow id="pppMultilink" label="Multilink connections" checked onChange={() => {}} />
                <CheckboxRow id="pppCompression" label="Software compression" checked onChange={() => {}} />
                <CheckboxRow id="pppLcp" label="Link control protocol (LCP) extensions" checked onChange={() => {}} />
              </>
            );
          if (tab === "Logging")
            return (
              <>
                <FormSection title="Accounting provider">
                  <label style={{ display: "block", marginBottom: 6 }}>
                    <input type="radio" checked={loggingMode === "Windows Accounting"} onChange={() => setLoggingMode("Windows Accounting")} /> Windows
                    Accounting
                  </label>
                  <label style={{ display: "block" }}>
                    <input type="radio" checked={loggingMode === "RADIUS"} onChange={() => setLoggingMode("RADIUS")} /> RADIUS Accounting
                  </label>
                </FormSection>
                <CheckboxRow id="logLocalFile" label="Log to local file" checked={localFile} onChange={setLocalFile} />
                <FormRow label="Log file path">
                  <input type="text" value={path} onChange={(e) => setPath(e.target.value)} disabled={!localFile} />
                </FormRow>
                <HelpText>Logging changes are illustrative only — not persisted in this lab.</HelpText>
              </>
            );
          return <EmptyPane>Not configured in this lab.</EmptyPane>;
        }}
      />
    </WsDialogComponent>
  );
}
