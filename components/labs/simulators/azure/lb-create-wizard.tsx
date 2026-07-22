"use client";

import { useMemo, useState } from "react";

import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import type { LbResource } from "@/lib/labs/simulators/azure/lbTypes";
import {
  freshBackendPool,
  freshFrontendConfig,
  freshHealthProbe,
  freshLbRule,
  freshLbWizardState,
  freshNatRule,
  freshOutboundRule,
  portConflict,
  validateLbWizardState,
  type LbWizardState,
} from "@/lib/labs/simulators/azure/lbWizardState";
import styles from "./azure-portal.module.css";
import { cliFromLb } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Field, NativeSelect, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "frontend", label: "Frontend IP configuration" },
  { id: "backend", label: "Backend pools" },
  { id: "inbound", label: "Inbound rules" },
  { id: "outbound", label: "Outbound rules" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LbCreateWizard({
  resourceGroups,
  virtualNetworks,
  vms,
  onCancel,
  onCreate,
  onCreateResourceGroup,
}: {
  resourceGroups: string[];
  virtualNetworks: string[];
  vms: { id: string; name: string; privateIp: string; os: string }[];
  onCancel: () => void;
  onCreate: (resource: LbResource) => void;
  onCreateResourceGroup: (name: string) => void;
}) {
  const [state, setState] = useState<LbWizardState>(freshLbWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof LbWizardState>(key: K, value: LbWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const validationErrors = useMemo(() => validateLbWizardState(state), [state]);

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const resource: LbResource = {
      id: crypto.randomUUID(),
      resourceType: "LoadBalancer",
      name: state.lbName,
      resourceGroup: state.resourceGroup,
      region: state.region,
      estimatedCost: state.sku === "Standard" ? 24.9 : 0,
      sku: state.sku,
      tier: state.sku === "Standard" ? state.tier : "Regional",
      lbType: state.lbType,
      frontendConfigs: state.frontendConfigs,
      backendPools: state.backendPools,
      healthProbes: state.healthProbes,
      lbRules: state.lbRules,
      natRules: state.natRules,
      outboundRules: state.outboundRules,
      tags: state.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
    };
    onCreate(resource);
  }

  const lastFrontend = state.frontendConfigs[state.frontendConfigs.length - 1];
  const lastPool = state.backendPools[state.backendPools.length - 1];
  const lastProbe = state.healthProbes[state.healthProbes.length - 1];
  const lastRule = state.lbRules[state.lbRules.length - 1];
  const lastNat = state.natRules[state.natRules.length - 1];
  const lastOut = state.outboundRules[state.outboundRules.length - 1];

  return (
    <div className={styles.wizard}>
      <div className={styles.wizTabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.wizTab} ${tab.id === activeTab ? styles.wizTabActive : i < activeIndex ? styles.wizTabDone : ""}`}
          >
            {i < activeIndex ? "✓ " : ""}
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.wizBody}>
        {activeTab === "basics" && (
          <>
            <SectionHeader title="Project details" sub="Select the subscription to manage deployed resources and costs." />
            <Field label="Subscription" required>
              <NativeSelect value="CloudLab-Training-Sub" onChange={() => {}}>
                <option>CloudLab-Training-Sub</option>
              </NativeSelect>
            </Field>
            <ResourceGroupField
              resourceGroups={resourceGroups}
              value={state.resourceGroup}
              onChange={(v) => set("resourceGroup", v)}
              onCreate={onCreateResourceGroup}
            />

            <SectionHeader title="Instance details" />
            <Field label="Name" required>
              <input
                value={state.lbName}
                onChange={(e) => set("lbName", e.target.value)}
                placeholder="e.g., myLoadBalancer"
                className={styles.input}
              />
            </Field>
            <Field label="Region" required>
              <NativeSelect value={state.region} onChange={(v) => set("region", v)}>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="SKU"
              required
              help="Standard SKU is recommended. It supports availability zones, HA ports, secure-by-default, and a richer feature set."
            >
              <NativeSelect value={state.sku} onChange={(v) => set("sku", v as LbWizardState["sku"])}>
                <option>Standard</option>
                <option>Basic</option>
              </NativeSelect>
            </Field>
            {state.sku === "Basic" ? (
              <Callout tone="warn">
                Basic Load Balancer is being retired on September 30, 2025. Microsoft recommends Standard
                SKU for new deployments.
              </Callout>
            ) : (
              <Field label="Tier">
                <NativeSelect value={state.tier} onChange={(v) => set("tier", v as LbWizardState["tier"])}>
                  <option>Regional</option>
                  <option>Global</option>
                </NativeSelect>
              </Field>
            )}
            <Field
              label="Type"
              required
              help="Public load balancers distribute traffic from the internet to VMs. Internal load balancers distribute traffic within a virtual network."
            >
              <NativeSelect value={state.lbType} onChange={(v) => set("lbType", v as LbWizardState["lbType"])}>
                <option>Public</option>
                <option>Internal</option>
              </NativeSelect>
            </Field>
          </>
        )}

        {activeTab === "frontend" && (
          <>
            <SectionHeader
              title="Frontend IP configuration"
              sub={
                state.lbType === "Public"
                  ? "A frontend IP configuration is the IP address used by clients to reach the load balancer. For a public load balancer, this is a public IP."
                  : "For an internal load balancer, this is a private IP from a virtual network subnet."
              }
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IP version</th>
                  <th>{state.lbType === "Public" ? "Public IP address / SKU" : "VNet / Subnet"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.frontendConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No frontend IP configurations.</td>
                  </tr>
                ) : (
                  state.frontendConfigs.map((f, i) => (
                    <tr key={f.id}>
                      <td>{f.name}</td>
                      <td>{f.ipVersion}</td>
                      <td>
                        {state.lbType === "Public"
                          ? `${f.publicIpName ?? "(not set)"} / ${f.publicIpSku ?? "Standard"}`
                          : `${f.vnet ?? "—"} / ${f.subnet ?? "—"}`}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() => set("frontendConfigs", state.frontendConfigs.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <button
              type="button"
              className={styles.link}
              style={{ marginTop: 8 }}
              onClick={() => set("frontendConfigs", [...state.frontendConfigs, freshFrontendConfig(state)])}
            >
              + Add a frontend IP configuration
            </button>
            {lastFrontend ? (
              <div className={styles.miniForm}>
                <h4>Edit: {lastFrontend.name}</h4>
                <Field label="Name" required>
                  <input
                    value={lastFrontend.name}
                    onChange={(e) =>
                      set(
                        "frontendConfigs",
                        state.frontendConfigs.map((f) => (f.id === lastFrontend.id ? { ...f, name: e.target.value } : f)),
                      )
                    }
                    className={styles.input}
                  />
                </Field>
                {state.lbType === "Public" ? (
                  <Field label="Public IP name" required>
                    <input
                      value={lastFrontend.publicIpName ?? ""}
                      onChange={(e) =>
                        set(
                          "frontendConfigs",
                          state.frontendConfigs.map((f) =>
                            f.id === lastFrontend.id ? { ...f, publicIpName: e.target.value } : f,
                          ),
                        )
                      }
                      placeholder={`pip-${state.lbName || "lb"}`}
                      className={styles.input}
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Virtual network" required>
                      <NativeSelect
                        value={lastFrontend.vnet ?? ""}
                        onChange={(v) =>
                          set(
                            "frontendConfigs",
                            state.frontendConfigs.map((f) => (f.id === lastFrontend.id ? { ...f, vnet: v } : f)),
                          )
                        }
                      >
                        <option value="">(create a virtual network first)</option>
                        {virtualNetworks.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="Subnet" required>
                      <NativeSelect
                        value={lastFrontend.subnet ?? ""}
                        onChange={(v) =>
                          set(
                            "frontendConfigs",
                            state.frontendConfigs.map((f) => (f.id === lastFrontend.id ? { ...f, subnet: v } : f)),
                          )
                        }
                      >
                        <option>default (10.0.0.0/24)</option>
                        <option>workload (10.0.1.0/24)</option>
                      </NativeSelect>
                    </Field>
                  </>
                )}
              </div>
            ) : null}
          </>
        )}

        {activeTab === "backend" && (
          <>
            <SectionHeader
              title="Backend pools"
              sub="A backend pool is a set of virtual machines or IP addresses that the load balancer distributes traffic to."
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Configuration / Targets</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.backendPools.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No backend pools.</td>
                  </tr>
                ) : (
                  state.backendPools.map((p, i) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        {p.config} ({p.targets.length} target{p.targets.length === 1 ? "" : "s"})
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() => set("backendPools", state.backendPools.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <button
              type="button"
              className={styles.link}
              style={{ marginTop: 8 }}
              onClick={() => set("backendPools", [...state.backendPools, freshBackendPool(state)])}
            >
              + Add a backend pool
            </button>
            {lastPool ? (
              <div className={styles.miniForm}>
                <h4>Edit: {lastPool.name}</h4>
                <Field label="Name" required>
                  <input
                    value={lastPool.name}
                    onChange={(e) =>
                      set(
                        "backendPools",
                        state.backendPools.map((p) => (p.id === lastPool.id ? { ...p, name: e.target.value } : p)),
                      )
                    }
                    className={styles.input}
                  />
                </Field>
                <Field label="Backend Pool Configuration">
                  <NativeSelect
                    value={lastPool.config}
                    onChange={(v) =>
                      set(
                        "backendPools",
                        state.backendPools.map((p) =>
                          p.id === lastPool.id ? { ...p, config: v as "NIC" | "IP Address" } : p,
                        ),
                      )
                    }
                  >
                    <option>NIC</option>
                    <option>IP Address</option>
                  </NativeSelect>
                </Field>
                {lastPool.config === "NIC" ? (
                  <VmTargetPicker
                    pool={lastPool}
                    vms={vms}
                    onAdd={(target) =>
                      set(
                        "backendPools",
                        state.backendPools.map((p) => (p.id === lastPool.id ? { ...p, targets: [...p.targets, target] } : p)),
                      )
                    }
                    onRemove={(ti) =>
                      set(
                        "backendPools",
                        state.backendPools.map((p) =>
                          p.id === lastPool.id ? { ...p, targets: p.targets.filter((_, idx) => idx !== ti) } : p,
                        ),
                      )
                    }
                  />
                ) : (
                  <IpTargetPicker
                    pool={lastPool}
                    onAdd={(target) =>
                      set(
                        "backendPools",
                        state.backendPools.map((p) => (p.id === lastPool.id ? { ...p, targets: [...p.targets, target] } : p)),
                      )
                    }
                    onRemove={(ti) =>
                      set(
                        "backendPools",
                        state.backendPools.map((p) =>
                          p.id === lastPool.id ? { ...p, targets: p.targets.filter((_, idx) => idx !== ti) } : p,
                        ),
                      )
                    }
                  />
                )}
              </div>
            ) : null}
            <p className={styles.help} style={{ marginTop: 12 }}>
              <button type="button" className={styles.link} onClick={() => setActiveTab("inbound")}>
                Configure health probes &amp; load balancing rules →
              </button>
            </p>
          </>
        )}

        {activeTab === "inbound" && (
          <>
            <SectionHeader title="Inbound rules" sub="Configure load balancing rules and inbound NAT rules for this load balancer." />
            <div className={styles.subTabs}>
              <button
                type="button"
                className={`${styles.subTab} ${state.inboundSubTab === "lbrules" ? styles.subTabActive : ""}`}
                onClick={() => set("inboundSubTab", "lbrules")}
              >
                Load balancing rules
              </button>
              <button
                type="button"
                className={`${styles.subTab} ${state.inboundSubTab === "natrules" ? styles.subTabActive : ""}`}
                onClick={() => set("inboundSubTab", "natrules")}
              >
                Inbound NAT rules
              </button>
            </div>

            {state.inboundSubTab === "lbrules" ? (
              <>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Frontend IP</th>
                      <th>Backend pool</th>
                      <th>Protocol</th>
                      <th>Port</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.lbRules.length === 0 ? (
                      <tr>
                        <td colSpan={6}>No load balancing rules.</td>
                      </tr>
                    ) : (
                      state.lbRules.map((r, i) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.frontendIp || "—"}</td>
                          <td>{r.backendPool || "—"}</td>
                          <td>{r.protocol}</td>
                          <td>
                            {r.frontendPort} → {r.backendPort}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => set("lbRules", state.lbRules.filter((_, idx) => idx !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={styles.link}
                  style={{ marginTop: 8 }}
                  onClick={() => set("lbRules", [...state.lbRules, freshLbRule(state)])}
                >
                  + Add a load balancing rule
                </button>

                <div style={{ marginTop: 24 }}>
                  <b style={{ fontSize: 13 }}>Health probes</b>
                  <p className={styles.help}>Health probes determine if a backend instance is healthy. Required by load balancing rules.</p>
                </div>
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
                    {state.healthProbes.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No health probes defined.</td>
                      </tr>
                    ) : (
                      state.healthProbes.map((h, i) => (
                        <tr key={h.id}>
                          <td>{h.name}</td>
                          <td>{h.protocol}</td>
                          <td>{h.port}</td>
                          <td>
                            {h.interval}s / {h.unhealthyThreshold}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => set("healthProbes", state.healthProbes.filter((_, idx) => idx !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={styles.link}
                  style={{ marginTop: 8 }}
                  onClick={() => set("healthProbes", [...state.healthProbes, freshHealthProbe(state)])}
                >
                  + Add a health probe
                </button>
                {lastProbe ? (
                  <div className={styles.miniForm}>
                    <h4>Edit probe: {lastProbe.name}</h4>
                    <div className={styles.ruleGrid}>
                      <Field label="Name" required>
                        <input
                          value={lastProbe.name}
                          onChange={(e) =>
                            set(
                              "healthProbes",
                              state.healthProbes.map((h) => (h.id === lastProbe.id ? { ...h, name: e.target.value } : h)),
                            )
                          }
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Protocol">
                        <NativeSelect
                          value={lastProbe.protocol}
                          onChange={(v) =>
                            set(
                              "healthProbes",
                              state.healthProbes.map((h) =>
                                h.id === lastProbe.id ? { ...h, protocol: v as "TCP" | "HTTP" | "HTTPS" } : h,
                              ),
                            )
                          }
                        >
                          <option>TCP</option>
                          <option>HTTP</option>
                          <option>HTTPS</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Port" required>
                        <input
                          type="number"
                          value={lastProbe.port}
                          onChange={(e) =>
                            set(
                              "healthProbes",
                              state.healthProbes.map((h) =>
                                h.id === lastProbe.id ? { ...h, port: parseInt(e.target.value, 10) || 0 } : h,
                              ),
                            )
                          }
                          className={styles.input}
                        />
                      </Field>
                    </div>
                  </div>
                ) : null}
                {lastRule ? (
                  <div className={styles.miniForm}>
                    <h4>Edit rule: {lastRule.name}</h4>
                    {(() => {
                      const conflict = portConflict(lastRule, state.lbRules);
                      return conflict ? (
                        <div className={styles.warnBanner}>
                          Warning: Frontend port {lastRule.frontendPort} on frontend IP &quot;{lastRule.frontendIp}
                          &quot; is already in use by rule &quot;{conflict}&quot;.
                        </div>
                      ) : null;
                    })()}
                    <div className={styles.ruleGrid}>
                      <Field label="Name" required>
                        <input
                          value={lastRule.name}
                          onChange={(e) =>
                            set("lbRules", state.lbRules.map((r) => (r.id === lastRule.id ? { ...r, name: e.target.value } : r)))
                          }
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Frontend IP address" required>
                        <NativeSelect
                          value={lastRule.frontendIp}
                          onChange={(v) => set("lbRules", state.lbRules.map((r) => (r.id === lastRule.id ? { ...r, frontendIp: v } : r)))}
                        >
                          <option value="">— Select —</option>
                          {state.frontendConfigs.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Backend pool" required>
                        <NativeSelect
                          value={lastRule.backendPool}
                          onChange={(v) => set("lbRules", state.lbRules.map((r) => (r.id === lastRule.id ? { ...r, backendPool: v } : r)))}
                        >
                          <option value="">— Select —</option>
                          {state.backendPools.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Protocol">
                        <NativeSelect
                          value={lastRule.protocol}
                          onChange={(v) => set("lbRules", state.lbRules.map((r) => (r.id === lastRule.id ? { ...r, protocol: v as "TCP" | "UDP" } : r)))}
                        >
                          <option>TCP</option>
                          <option>UDP</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Port" required>
                        <input
                          type="number"
                          value={lastRule.frontendPort}
                          onChange={(e) =>
                            set(
                              "lbRules",
                              state.lbRules.map((r) =>
                                r.id === lastRule.id ? { ...r, frontendPort: parseInt(e.target.value, 10) || 0 } : r,
                              ),
                            )
                          }
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Backend port" required>
                        <input
                          type="number"
                          value={lastRule.backendPort}
                          onChange={(e) =>
                            set(
                              "lbRules",
                              state.lbRules.map((r) =>
                                r.id === lastRule.id ? { ...r, backendPort: parseInt(e.target.value, 10) || 0 } : r,
                              ),
                            )
                          }
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Health probe" required>
                        <NativeSelect
                          value={lastRule.healthProbe}
                          onChange={(v) => set("lbRules", state.lbRules.map((r) => (r.id === lastRule.id ? { ...r, healthProbe: v } : r)))}
                        >
                          <option value="">— Select —</option>
                          {state.healthProbes.map((h) => (
                            <option key={h.id} value={h.name}>
                              {h.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Frontend IP</th>
                      <th>Frontend port range</th>
                      <th>Backend pool : port</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.natRules.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No inbound NAT rules.</td>
                      </tr>
                    ) : (
                      state.natRules.map((n, i) => (
                        <tr key={n.id}>
                          <td>{n.name}</td>
                          <td>{n.frontendIp || "—"}</td>
                          <td>{n.portRange}</td>
                          <td>
                            {n.backendPool || "—"}:{n.backendPort}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => set("natRules", state.natRules.filter((_, idx) => idx !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={styles.link}
                  style={{ marginTop: 8 }}
                  onClick={() => set("natRules", [...state.natRules, freshNatRule(state)])}
                >
                  + Add an inbound NAT rule
                </button>
                {lastNat ? (
                  <div className={styles.miniForm}>
                    <h4>Edit NAT rule: {lastNat.name}</h4>
                    <div className={styles.ruleGrid}>
                      <Field label="Name" required>
                        <input
                          value={lastNat.name}
                          onChange={(e) =>
                            set("natRules", state.natRules.map((n) => (n.id === lastNat.id ? { ...n, name: e.target.value } : n)))
                          }
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Frontend IP address" required>
                        <NativeSelect
                          value={lastNat.frontendIp}
                          onChange={(v) => set("natRules", state.natRules.map((n) => (n.id === lastNat.id ? { ...n, frontendIp: v } : n)))}
                        >
                          <option value="">— Select —</option>
                          {state.frontendConfigs.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Port range" required>
                        <input
                          value={lastNat.portRange}
                          onChange={(e) =>
                            set("natRules", state.natRules.map((n) => (n.id === lastNat.id ? { ...n, portRange: e.target.value } : n)))
                          }
                          placeholder="50000-50100"
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Backend pool" required>
                        <NativeSelect
                          value={lastNat.backendPool}
                          onChange={(v) => set("natRules", state.natRules.map((n) => (n.id === lastNat.id ? { ...n, backendPool: v } : n)))}
                        >
                          <option value="">— Select —</option>
                          {state.backendPools.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Backend port" required>
                        <input
                          type="number"
                          value={lastNat.backendPort}
                          onChange={(e) =>
                            set(
                              "natRules",
                              state.natRules.map((n) =>
                                n.id === lastNat.id ? { ...n, backendPort: parseInt(e.target.value, 10) || 0 } : n,
                              ),
                            )
                          }
                          className={styles.input}
                        />
                      </Field>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}

        {activeTab === "outbound" && (
          <>
            <SectionHeader
              title="Outbound rules"
              sub="Outbound rules define how outbound NAT translation occurs. Use them to control outbound connectivity from backend instances."
            />
            {state.sku !== "Standard" ? (
              <Callout tone="warn">Outbound rules require Standard SKU. Switch to Standard on the Basics tab.</Callout>
            ) : (
              <>
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
                    {state.outboundRules.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No outbound rules.</td>
                      </tr>
                    ) : (
                      state.outboundRules.map((o, i) => (
                        <tr key={o.id}>
                          <td>{o.name}</td>
                          <td>{o.frontendIp || "—"}</td>
                          <td>{o.protocol}</td>
                          <td>{o.backendPool || "—"}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => set("outboundRules", state.outboundRules.filter((_, idx) => idx !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={styles.link}
                  style={{ marginTop: 8 }}
                  onClick={() => set("outboundRules", [...state.outboundRules, freshOutboundRule(state)])}
                >
                  + Add an outbound rule
                </button>
                {lastOut ? (
                  <div className={styles.miniForm}>
                    <h4>Edit rule: {lastOut.name}</h4>
                    <div className={styles.ruleGrid}>
                      <Field label="Name" required>
                        <input
                          value={lastOut.name}
                          onChange={(e) =>
                            set("outboundRules", state.outboundRules.map((o) => (o.id === lastOut.id ? { ...o, name: e.target.value } : o)))
                          }
                          className={styles.input}
                        />
                      </Field>
                      <Field label="Frontend IP addresses" required>
                        <NativeSelect
                          value={lastOut.frontendIp}
                          onChange={(v) => set("outboundRules", state.outboundRules.map((o) => (o.id === lastOut.id ? { ...o, frontendIp: v } : o)))}
                        >
                          <option value="">— Select —</option>
                          {state.frontendConfigs.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Protocol">
                        <NativeSelect
                          value={lastOut.protocol}
                          onChange={(v) =>
                            set(
                              "outboundRules",
                              state.outboundRules.map((o) => (o.id === lastOut.id ? { ...o, protocol: v as "All" | "TCP" | "UDP" } : o)),
                            )
                          }
                        >
                          <option>All</option>
                          <option>TCP</option>
                          <option>UDP</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Backend pool" required>
                        <NativeSelect
                          value={lastOut.backendPool}
                          onChange={(v) => set("outboundRules", state.outboundRules.map((o) => (o.id === lastOut.id ? { ...o, backendPool: v } : o)))}
                        >
                          <option value="">— Select —</option>
                          {state.backendPools.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader title="Tags" sub="Tags are name/value pairs that enable you to categorize resources." />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.tags.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "#605e5c" }}>
                      No tags added.
                    </td>
                  </tr>
                ) : (
                  state.tags.map((t, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          value={t.key}
                          onChange={(e) => {
                            const tags = [...state.tags];
                            tags[i] = { ...tags[i], key: e.target.value };
                            set("tags", tags);
                          }}
                          placeholder="Name"
                          className={styles.input}
                        />
                      </td>
                      <td>
                        <input
                          value={t.value}
                          onChange={(e) => {
                            const tags = [...state.tags];
                            tags[i] = { ...tags[i], value: e.target.value };
                            set("tags", tags);
                          }}
                          placeholder="Value"
                          className={styles.input}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() => set("tags", state.tags.filter((_, idx) => idx !== i))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <button
              type="button"
              className={styles.link}
              style={{ marginTop: 8 }}
              onClick={() => set("tags", [...state.tags, { key: "", value: "" }])}
            >
              + Add tag
            </button>
          </>
        )}

        {activeTab === "review" && (
          <>
            {validationErrors.length === 0 ? (
              <Callout tone="info">✓ Validation passed</Callout>
            ) : (
              <Callout tone="warn">
                <b>Validation failed:</b>
                <ul style={{ marginTop: 6, paddingLeft: 20 }}>
                  {validationErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Callout>
            )}
            <button type="button" className={styles.btnOutline} style={{ marginBottom: 12 }} onClick={() => setShowCli(true)}>
              View as Azure CLI command
            </button>
            <ReviewSection
              title="Basics"
              rows={[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Name", state.lbName || "— not set —"],
                ["Region", state.region],
                ["SKU", state.sku],
                ["Type", state.lbType],
              ]}
            />
            <ReviewSection
              title="Frontend IP configuration"
              rows={state.frontendConfigs.length === 0 ? [["(none)", ""]] : state.frontendConfigs.map((f) => [f.name, f.ipVersion])}
            />
            <ReviewSection
              title="Backend pools"
              rows={state.backendPools.length === 0 ? [["(none)", ""]] : state.backendPools.map((p) => [p.name, `${p.config}, ${p.targets.length} target(s)`])}
            />
            <ReviewSection
              title="Load balancing rules"
              rows={
                state.lbRules.length === 0
                  ? [["(none)", ""]]
                  : state.lbRules.map((r) => [r.name, `${r.protocol} ${r.frontendPort} → ${r.backendPort}`])
              }
            />
          </>
        )}
      </div>

      <div className={styles.wizFooter}>
        <button type="button" className={styles.btnOutline} onClick={onCancel}>
          Cancel
        </button>
        <div style={{ flex: 1 }} />
        {activeIndex > 0 ? (
          <button type="button" className={styles.btnOutline} onClick={() => setActiveTab(TABS[activeIndex - 1].id)}>
            &lt; Previous
          </button>
        ) : null}
        {activeIndex < TABS.length - 1 ? (
          <button type="button" className={styles.btn} onClick={() => setActiveTab(TABS[activeIndex + 1].id)}>
            Next: {TABS[activeIndex + 1].label} &gt;
          </button>
        ) : (
          <button type="button" className={styles.btn} onClick={commit}>
            Create
          </button>
        )}
      </div>
      {showCli ? <CliPanel title="Equivalent CLI for this load balancer" command={cliFromLb(state)} onClose={() => setShowCli(false)} /> : null}
    </div>
  );
}

function VmTargetPicker({
  pool,
  vms,
  onAdd,
  onRemove,
}: {
  pool: { targets: { vmId?: string; vmName?: string; privateIp?: string; os?: string }[] };
  vms: { id: string; name: string; privateIp: string; os: string }[];
  onAdd: (target: { vmId: string; vmName: string; privateIp: string; os: string }) => void;
  onRemove: (index: number) => void;
}) {
  const [selected, setSelected] = useState("");
  return (
    <>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>Targets (NICs)</div>
      <table className={styles.table} style={{ marginTop: 6 }}>
        <thead>
          <tr>
            <th>VM name</th>
            <th>Private IP</th>
            <th>OS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pool.targets.length === 0 ? (
            <tr>
              <td colSpan={4}>No VMs added.</td>
            </tr>
          ) : (
            pool.targets.map((t, i) => (
              <tr key={i}>
                <td>{t.vmName}</td>
                <td>{t.privateIp || "—"}</td>
                <td>{t.os || "—"}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onRemove(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className={styles.select} style={{ width: "auto" }}>
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
            const vm = vms.find((v) => v.id === selected);
            if (!vm) return;
            onAdd({ vmId: vm.id, vmName: vm.name, privateIp: vm.privateIp, os: vm.os });
            setSelected("");
          }}
        >
          + Add VM
        </button>
      </div>
    </>
  );
}

function IpTargetPicker({
  pool,
  onAdd,
  onRemove,
}: {
  pool: { targets: { ip?: string; name?: string }[] };
  onAdd: (target: { ip: string; name: string }) => void;
  onRemove: (index: number) => void;
}) {
  const [ip, setIp] = useState("");
  const [name, setName] = useState("");
  return (
    <>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>Targets (IP addresses)</div>
      <table className={styles.table} style={{ marginTop: 6 }}>
        <thead>
          <tr>
            <th>IP address</th>
            <th>Name</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pool.targets.length === 0 ? (
            <tr>
              <td colSpan={3}>No IP addresses added.</td>
            </tr>
          ) : (
            pool.targets.map((t, i) => (
              <tr key={i}>
                <td>{t.ip}</td>
                <td>{t.name || "—"}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onRemove(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.10" className={styles.input} style={{ width: 160 }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={styles.input} style={{ width: 160 }} />
        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => {
            if (!ip) return;
            onAdd({ ip, name });
            setIp("");
            setName("");
          }}
        >
          + Add IP
        </button>
      </div>
    </>
  );
}

function ReviewSection({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className={styles.sectionCard}>
      <h3>{title}</h3>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
          <span style={{ color: "#605e5c", fontWeight: 600 }}>{k}</span>
          <span>{v || "—"}</span>
        </div>
      ))}
    </div>
  );
}
