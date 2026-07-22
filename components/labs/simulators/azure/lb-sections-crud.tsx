"use client";

import { useState } from "react";

import type { LbBackendTarget, LbHealthProbe, LbNatRule, LbOutboundRule, LbResource, LbRule } from "@/lib/labs/simulators/azure/lbTypes";
import styles from "./azure-portal.module.css";
import { Callout } from "./wizard-fields";

export function SecFrontend({ lb, onAdd, onDelete }: { lb: LbResource; onAdd: () => void; onDelete: (index: number) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Frontend IP configuration</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>IP version</th>
            <th>Details</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lb.frontendConfigs.length === 0 ? (
            <tr>
              <td colSpan={4}>No frontend IP configurations.</td>
            </tr>
          ) : (
            lb.frontendConfigs.map((f, i) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.ipVersion}</td>
                <td>{lb.lbType === "Public" ? `${f.publicIpName ?? "(none)"} / ${f.publicIpSku ?? "Standard"}` : `${f.vnet ?? "—"} / ${f.subnet ?? "—"}`}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={onAdd}>
        + Add
      </button>
    </div>
  );
}

export function SecBackend({
  lb,
  onAdd,
  onDelete,
  onAddTarget,
  onDeleteTarget,
  vms,
}: {
  lb: LbResource;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onAddTarget: (poolIndex: number, target: LbBackendTarget) => void;
  onDeleteTarget: (poolIndex: number, targetIndex: number) => void;
  vms: { id: string; name: string; privateIp: string; os: string }[];
}) {
  const [editingPool, setEditingPool] = useState<number | null>(null);
  const [selectedVm, setSelectedVm] = useState("");
  const [ip, setIp] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Backend pools</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Config</th>
            <th>Targets</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lb.backendPools.length === 0 ? (
            <tr>
              <td colSpan={4}>No backend pools.</td>
            </tr>
          ) : (
            lb.backendPools.map((p, i) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.config}</td>
                <td>{p.targets.map((t) => t.vmName ?? t.ip).join(", ") || "(empty)"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={styles.link} onClick={() => setEditingPool(editingPool === i ? null : i)}>
                      Edit
                    </button>
                    <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={onAdd}>
        + Add
      </button>
      {editingPool !== null && lb.backendPools[editingPool] ? (
        <div className={styles.miniForm}>
          <h4>Edit: {lb.backendPools[editingPool].name}</h4>
          <table className={styles.table} style={{ marginBottom: 8 }}>
            <tbody>
              {lb.backendPools[editingPool].targets.map((t, ti) => (
                <tr key={ti}>
                  <td>{t.vmName ?? t.ip}</td>
                  <td>
                    <button type="button" className={styles.link} onClick={() => onDeleteTarget(editingPool, ti)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lb.backendPools[editingPool].config === "NIC" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <select value={selectedVm} onChange={(e) => setSelectedVm(e.target.value)} className={styles.select} style={{ width: "auto" }}>
                <option value="">— Select a VM —</option>
                {vms.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.privateIp || "no IP"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  const vm = vms.find((v) => v.id === selectedVm);
                  if (!vm) return;
                  onAddTarget(editingPool, { vmId: vm.id, vmName: vm.name, privateIp: vm.privateIp, os: vm.os });
                  setSelectedVm("");
                }}
              >
                + Add VM
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.10" className={styles.input} style={{ width: 160 }} />
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  if (!ip) return;
                  onAddTarget(editingPool, { ip, name: "" });
                  setIp("");
                }}
              >
                + Add IP
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SecProbes({ lb, onAdd, onDelete }: { lb: LbResource; onAdd: (probe: Omit<LbHealthProbe, "id">) => void; onDelete: (index: number) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<"TCP" | "HTTP" | "HTTPS">("TCP");
  const [port, setPort] = useState(80);

  return (
    <div className={styles.sectionCard}>
      <h3>Health probes</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Protocol</th>
            <th>Port</th>
            <th>Interval / Threshold</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lb.healthProbes.length === 0 ? (
            <tr>
              <td colSpan={5}>No health probes defined.</td>
            </tr>
          ) : (
            lb.healthProbes.map((h, i) => (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td>{h.protocol}</td>
                <td>{h.port}</td>
                <td>
                  {h.interval}s / {h.unhealthyThreshold}
                </td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Probe name" className={styles.input} />
            <select value={protocol} onChange={(e) => setProtocol(e.target.value as "TCP" | "HTTP" | "HTTPS")} className={styles.select}>
              <option>TCP</option>
              <option>HTTP</option>
              <option>HTTPS</option>
            </select>
            <input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value, 10) || 0)} placeholder="Port" className={styles.input} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                onAdd({ name, protocol, port, path: "/", interval: 5, unhealthyThreshold: 2 });
                setShowForm(false);
                setName("");
              }}
            >
              Add
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
          + Add
        </button>
      )}
    </div>
  );
}

export function SecLBRules({
  lb,
  onAdd,
  onDelete,
}: {
  lb: LbResource;
  onAdd: (rule: Omit<LbRule, "id">) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [frontendIp, setFrontendIp] = useState(lb.frontendConfigs[0]?.name ?? "");
  const [backendPool, setBackendPool] = useState(lb.backendPools[0]?.name ?? "");
  const [protocol, setProtocol] = useState<"TCP" | "UDP">("TCP");
  const [frontendPort, setFrontendPort] = useState(80);
  const [backendPort, setBackendPort] = useState(80);
  const [healthProbe, setHealthProbe] = useState(lb.healthProbes[0]?.name ?? "");

  const canAdd = lb.frontendConfigs.length > 0 && lb.backendPools.length > 0 && lb.healthProbes.length > 0;

  return (
    <div className={styles.sectionCard}>
      <h3>Load balancing rules</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Frontend IP</th>
            <th>Backend pool</th>
            <th>Protocol</th>
            <th>Port</th>
            <th>Probe</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lb.lbRules.length === 0 ? (
            <tr>
              <td colSpan={7}>No load balancing rules.</td>
            </tr>
          ) : (
            lb.lbRules.map((rl, i) => (
              <tr key={rl.id}>
                <td>{rl.name}</td>
                <td>{rl.frontendIp || "—"}</td>
                <td>{rl.backendPool || "—"}</td>
                <td>{rl.protocol}</td>
                <td>
                  {rl.frontendPort} → {rl.backendPort}
                </td>
                <td>{rl.healthProbe || "—"}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!canAdd ? (
        <Callout tone="warn">Add a frontend IP, backend pool, and health probe before creating a rule.</Callout>
      ) : showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className={styles.input} />
            <select value={frontendIp} onChange={(e) => setFrontendIp(e.target.value)} className={styles.select}>
              {lb.frontendConfigs.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
            <select value={backendPool} onChange={(e) => setBackendPool(e.target.value)} className={styles.select}>
              {lb.backendPools.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value as "TCP" | "UDP")} className={styles.select}>
              <option>TCP</option>
              <option>UDP</option>
            </select>
            <input type="number" value={frontendPort} onChange={(e) => setFrontendPort(parseInt(e.target.value, 10) || 0)} placeholder="Frontend port" className={styles.input} />
            <input type="number" value={backendPort} onChange={(e) => setBackendPort(parseInt(e.target.value, 10) || 0)} placeholder="Backend port" className={styles.input} />
            <select value={healthProbe} onChange={(e) => setHealthProbe(e.target.value)} className={styles.select}>
              {lb.healthProbes.map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                const conflict = lb.lbRules.find((x) => x.frontendIp === frontendIp && x.frontendPort === frontendPort && x.protocol === protocol);
                if (conflict && !confirm(`Frontend port ${frontendPort} on "${frontendIp}" is already used by rule "${conflict.name}". Continue anyway?`)) return;
                onAdd({
                  name,
                  ipVersion: "IPv4",
                  frontendIp,
                  backendPool,
                  protocol,
                  frontendPort,
                  backendPort,
                  healthProbe,
                  sessionPersistence: "None",
                  idleTimeout: 4,
                  tcpReset: false,
                  floatingIp: false,
                });
                setShowForm(false);
                setName("");
              }}
            >
              Add
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
          + Add
        </button>
      )}
    </div>
  );
}

export function SecNATRules({
  lb,
  onAdd,
  onDelete,
}: {
  lb: LbResource;
  onAdd: (rule: Omit<LbNatRule, "id">) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [frontendIp, setFrontendIp] = useState(lb.frontendConfigs[0]?.name ?? "");
  const [portRange, setPortRange] = useState("50000-50099");
  const [backendPool, setBackendPool] = useState(lb.backendPools[0]?.name ?? "");
  const [backendPort, setBackendPort] = useState(3389);

  return (
    <div className={styles.sectionCard}>
      <h3>Inbound NAT rules</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Frontend IP</th>
            <th>Port range</th>
            <th>Backend</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lb.natRules.length === 0 ? (
            <tr>
              <td colSpan={5}>No inbound NAT rules.</td>
            </tr>
          ) : (
            lb.natRules.map((n, i) => (
              <tr key={n.id}>
                <td>{n.name}</td>
                <td>{n.frontendIp || "—"}</td>
                <td>{n.portRange}</td>
                <td>
                  {n.backendPool || "—"}:{n.backendPort}
                </td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {lb.frontendConfigs.length === 0 ? (
        <Callout tone="warn">Add a frontend IP first.</Callout>
      ) : showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className={styles.input} />
            <select value={frontendIp} onChange={(e) => setFrontendIp(e.target.value)} className={styles.select}>
              {lb.frontendConfigs.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
            <input value={portRange} onChange={(e) => setPortRange(e.target.value)} placeholder="50000-50099" className={styles.input} />
            <select value={backendPool} onChange={(e) => setBackendPool(e.target.value)} className={styles.select}>
              {lb.backendPools.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <input type="number" value={backendPort} onChange={(e) => setBackendPort(parseInt(e.target.value, 10) || 0)} placeholder="Backend port" className={styles.input} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                onAdd({ name, frontendIp, portRange, backendPool, backendPort, idleTimeout: 4, tcpReset: false });
                setShowForm(false);
                setName("");
              }}
            >
              Add
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
          + Add
        </button>
      )}
    </div>
  );
}

export function SecOutboundRules({
  lb,
  onAdd,
  onDelete,
}: {
  lb: LbResource;
  onAdd: (rule: Omit<LbOutboundRule, "id">) => void;
  onDelete: (index: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [frontendIp, setFrontendIp] = useState(lb.frontendConfigs[0]?.name ?? "");
  const [protocol, setProtocol] = useState<"All" | "TCP" | "UDP">("All");
  const [backendPool, setBackendPool] = useState(lb.backendPools[0]?.name ?? "");

  if (lb.sku !== "Standard") {
    return (
      <div className={styles.sectionCard}>
        <h3>Outbound rules</h3>
        <Callout tone="warn">Outbound rules require Standard SKU.</Callout>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Outbound rules</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Frontend IP</th>
            <th>Protocol</th>
            <th>Backend pool</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lb.outboundRules.length === 0 ? (
            <tr>
              <td colSpan={5}>No outbound rules.</td>
            </tr>
          ) : (
            lb.outboundRules.map((o, i) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.frontendIp || "—"}</td>
                <td>{o.protocol}</td>
                <td>{o.backendPool || "—"}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {lb.frontendConfigs.length === 0 || lb.backendPools.length === 0 ? (
        <Callout tone="warn">Add a frontend IP and backend pool first.</Callout>
      ) : showForm ? (
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className={styles.input} />
            <select value={frontendIp} onChange={(e) => setFrontendIp(e.target.value)} className={styles.select}>
              {lb.frontendConfigs.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value as "All" | "TCP" | "UDP")} className={styles.select}>
              <option>All</option>
              <option>TCP</option>
              <option>UDP</option>
            </select>
            <select value={backendPool} onChange={(e) => setBackendPool(e.target.value)} className={styles.select}>
              {lb.backendPools.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                if (!name) return;
                onAdd({ name, ipVersion: "IPv4", frontendIp, protocol, backendPool, idleTimeout: 4, tcpReset: false });
                setShowForm(false);
                setName("");
              }}
            >
              Add
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
          + Add
        </button>
      )}
    </div>
  );
}
