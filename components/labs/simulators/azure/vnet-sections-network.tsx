"use client";

import { useState } from "react";

import { validCidr, availableIps, BASTION_COST, FIREWALL_COST, DDOS_COST, DELEGATIONS, SERVICE_ENDPOINTS } from "@/lib/labs/simulators/azure/vnetData";
import type { VnetResource, VnetSubnet } from "@/lib/labs/simulators/azure/vnetTypes";
import styles from "./azure-portal.module.css";
import { Field, NativeSelect } from "./wizard-fields";

export function SecAddressSpace({
  vnet,
  onSave,
}: {
  vnet: VnetResource;
  onSave: (cidrs: string[]) => void;
}) {
  const [values, setValues] = useState<string[]>(vnet.addressSpace);

  return (
    <div className={styles.sectionCard}>
      <h3>Address space</h3>
      <p>The virtual network&apos;s address space, specified as one or more address prefixes in CIDR notation.</p>
      {values.map((a, i) => (
        <div key={i} className={styles.cidrRow}>
          <input
            value={a}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              setValues(next);
            }}
            placeholder="10.0.0.0/16"
            className={styles.input}
          />
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              if (values.length <= 1) return;
              setValues(values.filter((_, idx) => idx !== i));
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.link}
        onClick={() => setValues([...values, `10.${values.length}.0.0/16`])}
      >
        + Add address range
      </button>
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const cidrs = values.filter(Boolean);
            if (cidrs.length === 0 || cidrs.some((c) => !validCidr(c))) return;
            onSave(cidrs);
          }}
        >
          Save
        </button>{" "}
        <button type="button" className={styles.btnOutline} onClick={() => setValues(vnet.addressSpace)}>
          Discard
        </button>
      </div>
    </div>
  );
}

export function SecConnected({
  vnet,
  vms,
}: {
  vnet: VnetResource;
  vms: { id: string; name: string; privateIp?: string; subnet?: string; publicIpAddress?: string | null }[];
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Connected devices</h3>
      <p>Network interfaces and other resources connected to this virtual network.</p>
      {vms.length === 0 ? (
        <p>No connected devices.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Device name</th>
              <th>Type</th>
              <th>Private IP</th>
              <th>Subnet</th>
              <th>Public IP</th>
            </tr>
          </thead>
          <tbody>
            {vms.map((v) => (
              <tr key={v.id}>
                <td>{v.name}-nic</td>
                <td>{v.name}</td>
                <td>{v.privateIp || "—"}</td>
                <td>{v.subnet || "—"}</td>
                <td>{v.publicIpAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: "#605e5c" }}>Resource group: {vnet.resourceGroup}</p>
    </div>
  );
}

export function SecSubnets({
  vnet,
  nsgs,
  onAdd,
  onUpdate,
  onDelete,
  onToggleEndpoint,
}: {
  vnet: VnetResource;
  nsgs: string[];
  onAdd: () => void;
  onUpdate: (index: number, subnet: VnetSubnet) => void;
  onDelete: (index: number) => void;
  onToggleEndpoint: (index: number, endpoint: string) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editing = editingIndex !== null ? vnet.subnets[editingIndex] : null;

  return (
    <div className={styles.sectionCard}>
      <h3>Subnets</h3>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            onAdd();
            setEditingIndex(vnet.subnets.length);
          }}
        >
          + Subnet
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>IPv4 range</th>
            <th>Available IPs</th>
            <th>Delegated to</th>
            <th>Security group</th>
            <th>Route table</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {vnet.subnets.length === 0 ? (
            <tr>
              <td colSpan={7}>No subnets defined.</td>
            </tr>
          ) : (
            vnet.subnets.map((s, i) => (
              <tr key={s.id}>
                <td>
                  <button type="button" className={styles.link} onClick={() => setEditingIndex(i)}>
                    {s.name}
                  </button>
                </td>
                <td>{s.addressRange}</td>
                <td>{availableIps(s.addressRange)}</td>
                <td>{s.delegation || "—"}</td>
                <td>{s.nsg || "—"}</td>
                <td>{s.routeTable || "—"}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => setEditingIndex(i)}>
                    Edit
                  </button>{" "}
                  |{" "}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => {
                      onDelete(i);
                      if (editingIndex === i) setEditingIndex(null);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {editing && editingIndex !== null ? (
        <div className={styles.subnetEditor}>
          <h4>Edit subnet: {editing.name}</h4>
          <Field label="Name" required>
            <input
              value={editing.name}
              onChange={(e) => onUpdate(editingIndex, { ...editing, name: e.target.value })}
              className={styles.input}
            />
          </Field>
          <Field label="Subnet address range" required>
            <input
              value={editing.addressRange}
              onChange={(e) => onUpdate(editingIndex, { ...editing, addressRange: e.target.value })}
              placeholder="10.0.0.0/24"
              className={styles.input}
            />
          </Field>
          <Field label="NAT gateway">
            <NativeSelect
              value={editing.natGateway ? "nat-gateway-default" : ""}
              onChange={(v) => onUpdate(editingIndex, { ...editing, natGateway: v })}
            >
              <option value="">None</option>
              <option value="nat-gateway-default">nat-gateway-default</option>
            </NativeSelect>
          </Field>
          <Field label="Network security group">
            <NativeSelect value={editing.nsg} onChange={(v) => onUpdate(editingIndex, { ...editing, nsg: v })}>
              <option value="">None</option>
              {nsgs.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Route table">
            <NativeSelect
              value={editing.routeTable ? "rt-default" : ""}
              onChange={(v) => onUpdate(editingIndex, { ...editing, routeTable: v })}
            >
              <option value="">None</option>
              <option value="rt-default">rt-default</option>
            </NativeSelect>
          </Field>
          <Field label="Service endpoints" help="Selected services will receive an optimized route from this subnet.">
            <div className={styles.multiList}>
              {SERVICE_ENDPOINTS.map((ep) => (
                <label key={ep}>
                  <input
                    type="checkbox"
                    checked={editing.serviceEndpoints.includes(ep)}
                    onChange={() => onToggleEndpoint(editingIndex, ep)}
                  />{" "}
                  {ep}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Subnet delegation" help="Delegate the subnet to a service to allow it to deploy resources here.">
            <NativeSelect value={editing.delegation} onChange={(v) => onUpdate(editingIndex, { ...editing, delegation: v })}>
              {DELEGATIONS.map((d) => (
                <option key={d} value={d}>
                  {d === "" ? "None" : d}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Private endpoint network policies">
            <NativeSelect
              value={editing.privateEndpointPolicies}
              onChange={(v) => onUpdate(editingIndex, { ...editing, privateEndpointPolicies: v as VnetSubnet["privateEndpointPolicies"] })}
            >
              <option>Disabled</option>
              <option>Network security groups</option>
              <option>Route tables</option>
            </NativeSelect>
          </Field>
          <div style={{ marginTop: 12 }}>
            <button type="button" className={styles.btn} onClick={() => setEditingIndex(null)}>
              Save
            </button>{" "}
            <button type="button" className={styles.btnOutline} onClick={() => setEditingIndex(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SecDdos({ vnet, onSetDdos }: { vnet: VnetResource; onSetDdos: (enabled: boolean) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>DDoS protection</h3>
      <p>
        Distributed denial of service (DDoS) attacks are some of the largest availability and security concerns.
        Azure DDoS Network Protection provides enhanced DDoS mitigation features.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className={styles.checkboxRow}>
          <input type="radio" name="ddosTier" checked={!vnet.ddosProtection} onChange={() => onSetDdos(false)} />
          Disable (basic protection at no extra cost)
        </label>
        <label className={styles.checkboxRow}>
          <input type="radio" name="ddosTier" checked={vnet.ddosProtection} onChange={() => onSetDdos(true)} />
          Enable (DDoS Network Protection, additional cost)
        </label>
      </div>
      {vnet.ddosProtection ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "#605e5c" }}>
          DDoS Network Protection plan: <b>{vnet.ddosPlan || "ddos-plan-default"}</b>
          <br />
          Estimated cost: ${DDOS_COST.toFixed(2)}/month per plan.
        </p>
      ) : (
        <p style={{ marginTop: 12, fontSize: 13, color: "#605e5c" }}>
          Basic DDoS infrastructure protection is enabled by default at no extra cost.
        </p>
      )}
    </div>
  );
}

export function SecFirewall({
  vnet,
  onDeploy,
  onRemove,
}: {
  vnet: VnetResource;
  onDeploy: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Firewall</h3>
      {vnet.firewallEnabled ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#605e5c" }}>Firewall name</div>
              <div>{vnet.name}-firewall</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#605e5c" }}>Tier</div>
              <div>{vnet.firewallTier}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#605e5c" }}>Firewall subnet</div>
              <div>AzureFirewallSubnet</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#605e5c" }}>Estimated cost</div>
              <div>${FIREWALL_COST[vnet.firewallTier ?? "Standard"].toFixed(2)}/month</div>
            </div>
          </div>
          <button type="button" className={styles.btnOutline} style={{ marginTop: 12 }} onClick={onRemove}>
            Disable firewall
          </button>
        </>
      ) : (
        <>
          <p>No firewall is deployed in this virtual network.</p>
          <button type="button" className={styles.btn} onClick={onDeploy}>
            Deploy Azure Firewall
          </button>
        </>
      )}
    </div>
  );
}

export function SecPeerings({
  vnet,
  otherVnets,
  onAdd,
  onDelete,
}: {
  vnet: VnetResource;
  otherVnets: string[];
  onAdd: (peering: { name: string; remoteVnet: string; gatewayTransit: boolean; useRemoteGateway: boolean }) => void;
  onDelete: (index: number) => void;
}) {
  const [name, setName] = useState("");
  const [remote, setRemote] = useState(otherVnets[0] ?? "");
  const [gatewayTransit, setGatewayTransit] = useState(false);
  const [useRemoteGateway, setUseRemoteGateway] = useState(false);

  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Peerings</h3>
        <p>
          Virtual network peering enables a seamless connection between two Azure Virtual Networks. Once peered, the
          virtual networks appear as one for connectivity purposes.
        </p>
        {vnet.peerings.length === 0 ? (
          <p>No peerings defined for this virtual network.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Peering state</th>
                <th>Peer</th>
                <th>Gateway transit</th>
                <th>Use remote gateway</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vnet.peerings.map((p, i) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <span className={`${styles.peerState} ${p.state === "Connected" ? styles.peerStateConnected : styles.peerStateDisconnected}`}>
                      {p.state}
                    </span>
                  </td>
                  <td>{p.remoteVnet}</td>
                  <td>{p.gatewayTransit ? "Yes" : "No"}</td>
                  <td>{p.useRemoteGateway ? "Yes" : "No"}</td>
                  <td>
                    <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className={styles.sectionCard}>
        <h3>Add a peering</h3>
        <Field label="Peering link name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="peer-to-prod-vnet" className={styles.input} />
        </Field>
        <Field label="Remote virtual network" required>
          <NativeSelect value={remote} onChange={setRemote}>
            {otherVnets.length === 0 ? (
              <option>(no other VNets — create one first)</option>
            ) : (
              otherVnets.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))
            )}
          </NativeSelect>
        </Field>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={gatewayTransit} onChange={(e) => setGatewayTransit(e.target.checked)} />
          Allow gateway transit
        </label>
        <label className={styles.checkboxRow} style={{ marginTop: 6 }}>
          <input type="checkbox" checked={useRemoteGateway} onChange={(e) => setUseRemoteGateway(e.target.checked)} />
          Use remote virtual network gateway
        </label>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              if (!name || !remote || otherVnets.length === 0) return;
              if (vnet.peerings.some((p) => p.name === name)) return;
              onAdd({ name, remoteVnet: remote, gatewayTransit, useRemoteGateway });
              setName("");
              setGatewayTransit(false);
              setUseRemoteGateway(false);
            }}
          >
            + Add peering
          </button>
        </div>
      </div>
    </>
  );
}

export function SecServiceEndpoints({ vnet, onManageSubnets }: { vnet: VnetResource; onManageSubnets: () => void }) {
  const eps = vnet.subnets.flatMap((s) => s.serviceEndpoints.map((ep) => ({ subnet: s.name, service: ep })));
  return (
    <div className={styles.sectionCard}>
      <h3>Service endpoints</h3>
      <p>
        Virtual network service endpoints extend your virtual network private address space and identity to Azure
        services over a direct connection.
      </p>
      {eps.length === 0 ? (
        <p>No service endpoints configured. Edit a subnet to add endpoints.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Service</th>
              <th>Subnet</th>
              <th>Provisioning state</th>
            </tr>
          </thead>
          <tbody>
            {eps.map((e, i) => (
              <tr key={i}>
                <td>{e.service}</td>
                <td>{e.subnet}</td>
                <td>
                  <span className={`${styles.badge} ${styles.badgeRunning}`}>Succeeded</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className={styles.link} style={{ marginTop: 8 }} onClick={onManageSubnets}>
        Manage via subnets &gt;
      </button>
    </div>
  );
}

export function SecPrivateEndpoints() {
  return (
    <div className={styles.sectionCard}>
      <h3>Private endpoints</h3>
      <p>
        A private endpoint is a network interface that uses a private IP address from this virtual network. It
        connects you privately and securely to an Azure PaaS resource.
      </p>
      <p>No private endpoints in this virtual network.</p>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }}>
        + Private endpoint
      </button>
    </div>
  );
}

export function SecDns({
  vnet,
  onSetMode,
  onSaveServers,
}: {
  vnet: VnetResource;
  onSetMode: (mode: "Azure-provided" | "Custom") => void;
  onSaveServers: (servers: string[]) => void;
}) {
  const custom = vnet.dnsServers === "Custom";
  const [ips, setIps] = useState<string[]>(vnet.customDnsServers);

  return (
    <div className={styles.sectionCard}>
      <h3>DNS servers</h3>
      <p>
        DNS servers can be configured at the virtual network level. The DNS configuration applies to all the
        resources in the virtual network.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className={styles.checkboxRow}>
          <input type="radio" name="dnsMode" checked={!custom} onChange={() => onSetMode("Azure-provided")} />
          Default (Azure-provided)
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="radio"
            name="dnsMode"
            checked={custom}
            onChange={() => {
              onSetMode("Custom");
              setIps(vnet.customDnsServers.length > 0 ? vnet.customDnsServers : ["8.8.8.8"]);
            }}
          />
          Custom
        </label>
      </div>
      {custom ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 420, marginTop: 12 }}>
            {ips.length === 0 ? (
              <p>No custom DNS servers.</p>
            ) : (
              ips.map((ip, i) => (
                <div key={i} className={styles.cidrRow}>
                  <input
                    value={ip}
                    onChange={(e) => {
                      const next = [...ips];
                      next[i] = e.target.value;
                      setIps(next);
                    }}
                    placeholder="8.8.8.8"
                    className={styles.input}
                  />
                  <button type="button" className={styles.link} onClick={() => setIps(ips.filter((_, idx) => idx !== i))}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          <button type="button" className={styles.link} style={{ marginTop: 8 }} onClick={() => setIps([...ips, ""])}>
            + Add DNS server
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                const valid = ips.filter((ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip));
                onSaveServers(valid);
              }}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <p style={{ marginTop: 12, fontSize: 13, color: "#605e5c" }}>
          Resources in this virtual network will use Azure-provided DNS (168.63.129.16) for name resolution.
        </p>
      )}
    </div>
  );
}
