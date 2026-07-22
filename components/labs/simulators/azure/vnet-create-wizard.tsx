"use client";

import { useMemo, useState } from "react";

import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import { BASTION_COST, DDOS_COST, DELEGATIONS, FIREWALL_COST, SERVICE_ENDPOINTS, totalAddressSpaceIps } from "@/lib/labs/simulators/azure/vnetData";
import type { VnetResource } from "@/lib/labs/simulators/azure/vnetTypes";
import { freshSubnet } from "@/lib/labs/simulators/azure/vnetTypes";
import {
  freshVnetWizardState,
  validateVnetWizardState,
  type VnetWizardState,
} from "@/lib/labs/simulators/azure/vnetWizardState";
import styles from "./azure-portal.module.css";
import { cliFromVnet } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Field, NativeSelect, RadioInline, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "security", label: "Security" },
  { id: "ip", label: "IP addresses" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function VnetCreateWizard({
  resourceGroups,
  onCancel,
  onCreate,
  onCreateResourceGroup,
}: {
  resourceGroups: string[];
  onCancel: () => void;
  onCreate: (resource: VnetResource) => void;
  onCreateResourceGroup: (name: string) => void;
}) {
  const [state, setState] = useState<VnetWizardState>(freshVnetWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof VnetWizardState>(key: K, value: VnetWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const validationErrors = useMemo(() => validateVnetWizardState(state), [state]);
  const totalIps = useMemo(() => totalAddressSpaceIps(state.addressSpaces), [state.addressSpaces]);

  let monthlyCost = 0;
  const costLines: [string, string][] = [["Virtual Network", "Free"]];
  if (state.bastionEnabled) {
    const c = BASTION_COST[state.bastionTier];
    monthlyCost += c;
    costLines.push([`Azure Bastion (${state.bastionTier})`, `$${c.toFixed(2)}/month`]);
  }
  if (state.firewallEnabled) {
    const c = FIREWALL_COST[state.firewallTier];
    monthlyCost += c;
    costLines.push([`Azure Firewall (${state.firewallTier})`, `$${c.toFixed(2)}/month`]);
  }
  if (state.ddosEnabled) {
    monthlyCost += DDOS_COST;
    costLines.push(["DDoS Network Protection", `$${DDOS_COST.toFixed(2)}/month`]);
  }

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const resource: VnetResource = {
      id: crypto.randomUUID(),
      resourceType: "VirtualNetwork",
      name: state.vnetName,
      resourceGroup: state.resourceGroup,
      region: state.region,
      estimatedCost: monthlyCost,
      addressSpace: state.addressSpaces.slice(),
      subnets: state.subnets.map((s) => ({ ...s })),
      dnsServers: "Azure-provided",
      customDnsServers: [],
      peerings: [],
      ddosProtection: state.ddosEnabled,
      ddosPlan: state.ddosEnabled ? state.ddosPlan : null,
      ddosTier: state.ddosEnabled ? "Network Protection" : "Basic (free)",
      bastionEnabled: state.bastionEnabled,
      bastionTier: state.bastionEnabled ? state.bastionTier : null,
      firewallEnabled: state.firewallEnabled,
      firewallTier: state.firewallEnabled ? state.firewallTier : null,
      alertRules: [],
      ddosAttackHistory: [],
      status: "Succeeded",
      tags: state.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
    };
    onCreate(resource);
  }

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
            <SectionHeader
              title="Project details"
              sub="Select the subscription to manage deployed resources and costs. Use resource groups to organize and manage your resources."
            />
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
            <Field label="Virtual network name" required>
              <input
                value={state.vnetName}
                onChange={(e) => set("vnetName", e.target.value)}
                placeholder="e.g., vnet-prod-eastus"
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
          </>
        )}

        {activeTab === "security" && (
          <>
            <SectionHeader
              title="Azure Bastion"
              sub="Azure Bastion is a fully managed PaaS service that you provision inside your virtual network. It provides secure and seamless RDP/SSH connectivity to your virtual machines directly in the Azure portal over TLS."
            />
            <Field label="Azure Bastion">
              <RadioInline
                name="bastionEnabled"
                value={state.bastionEnabled ? "Enable" : "Disable"}
                onChange={(v) => set("bastionEnabled", v === "Enable")}
                choices={["Disable", "Enable"]}
              />
            </Field>
            {state.bastionEnabled ? (
              <>
                <Field label="Tier" help={`Estimated cost: $${BASTION_COST[state.bastionTier].toFixed(2)}/month`}>
                  <NativeSelect value={state.bastionTier} onChange={(v) => set("bastionTier", v as VnetWizardState["bastionTier"])}>
                    <option>Basic</option>
                    <option>Standard</option>
                  </NativeSelect>
                </Field>
                <Field
                  label="AzureBastionSubnet address space"
                  help="Must be /26 or larger. Name will be AzureBastionSubnet (reserved)."
                >
                  <input
                    value={state.bastionSubnet}
                    onChange={(e) => set("bastionSubnet", e.target.value)}
                    placeholder="10.0.1.0/26"
                    className={styles.input}
                  />
                </Field>
                <Field label="Public IP address">
                  <NativeSelect value={state.bastionPublicIp} onChange={(v) => set("bastionPublicIp", v)}>
                    <option>(new) bastion-pip</option>
                    <option>Use existing</option>
                  </NativeSelect>
                </Field>
              </>
            ) : (
              <Callout tone="info">Azure Bastion will not be deployed. You can deploy it later from the resource page.</Callout>
            )}

            <SectionHeader
              title="Azure Firewall"
              sub="Azure Firewall is a managed, cloud-based network security service that protects your Azure Virtual Network resources. It is a fully stateful firewall-as-a-service with built-in high availability."
            />
            <Field label="Azure Firewall">
              <RadioInline
                name="firewallEnabled"
                value={state.firewallEnabled ? "Enable" : "Disable"}
                onChange={(v) => set("firewallEnabled", v === "Enable")}
                choices={["Disable", "Enable"]}
              />
            </Field>
            {state.firewallEnabled ? (
              <>
                <Field label="Firewall tier" help={`Estimated cost: $${FIREWALL_COST[state.firewallTier].toFixed(2)}/month`}>
                  <NativeSelect value={state.firewallTier} onChange={(v) => set("firewallTier", v as VnetWizardState["firewallTier"])}>
                    <option>Basic</option>
                    <option>Standard</option>
                    <option>Premium</option>
                  </NativeSelect>
                </Field>
                <Field
                  label="AzureFirewallSubnet address space"
                  help="Must be /26 or larger. Name will be AzureFirewallSubnet (reserved)."
                >
                  <input
                    value={state.firewallSubnet}
                    onChange={(e) => set("firewallSubnet", e.target.value)}
                    placeholder="10.0.2.0/26"
                    className={styles.input}
                  />
                </Field>
                <Field label="Public IP address">
                  <NativeSelect value={state.firewallPublicIp} onChange={(v) => set("firewallPublicIp", v)}>
                    <option>(new) firewall-pip</option>
                    <option>Use existing</option>
                  </NativeSelect>
                </Field>
              </>
            ) : (
              <Callout tone="info">Azure Firewall will not be deployed. You can deploy it later.</Callout>
            )}

            <SectionHeader
              title="Azure DDoS Network Protection"
              sub="Azure DDoS Network Protection enables enhanced DDoS mitigation features to defend against DDoS attacks. It is automatically tuned to help protect your specific Azure resources in a virtual network."
            />
            <Field label="Azure DDoS Network Protection">
              <RadioInline
                name="ddosEnabled"
                value={state.ddosEnabled ? "Enable" : "Disable"}
                onChange={(v) => set("ddosEnabled", v === "Enable")}
                choices={["Disable", "Enable"]}
              />
            </Field>
            {state.ddosEnabled ? (
              <Field label="DDoS protection plan" help={`Estimated cost: $${DDOS_COST.toFixed(2)}/month (per plan, covers up to 100 public IPs)`}>
                <NativeSelect value={state.ddosPlan} onChange={(v) => set("ddosPlan", v)}>
                  <option value="">Select a plan</option>
                  <option>(new) ddos-plan-default</option>
                </NativeSelect>
              </Field>
            ) : null}
          </>
        )}

        {activeTab === "ip" && (
          <>
            <SectionHeader
              title="IPv4 address space"
              sub="Define the address space for your virtual network using one or more IPv4 or IPv6 ranges in CIDR notation. Address ranges cannot overlap with other ranges in the same virtual network or peered networks."
            />
            {state.addressSpaces.map((a, i) => (
              <div key={i} className={styles.cidrRow}>
                <input
                  value={a}
                  onChange={(e) => {
                    const next = [...state.addressSpaces];
                    next[i] = e.target.value;
                    set("addressSpaces", next);
                  }}
                  placeholder="10.0.0.0/16"
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    if (state.addressSpaces.length <= 1) return;
                    set("addressSpaces", state.addressSpaces.filter((_, idx) => idx !== i));
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.link}
              onClick={() => set("addressSpaces", [...state.addressSpaces, `10.${state.addressSpaces.length}.0.0/16`])}
            >
              + Add IPv4 address space
            </button>
            <Callout tone="info">Use of a /16 address space allows {totalIps.toLocaleString()} IP addresses.</Callout>

            <SectionHeader
              title="Subnets"
              sub="The subnet's address range in CIDR notation (e.g. 192.168.1.0/24). It must be contained by the address space of the virtual network."
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>IPv4</th>
                  <th>Default outbound</th>
                  <th>NAT gateway</th>
                  <th>NSG</th>
                  <th>Delegation</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.subnets.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No subnets defined. Click &quot;Add a subnet&quot; to add one.</td>
                  </tr>
                ) : (
                  state.subnets.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <input
                          value={s.name}
                          onChange={(e) => {
                            const next = [...state.subnets];
                            next[i] = { ...next[i], name: e.target.value };
                            set("subnets", next);
                          }}
                          className={styles.input}
                        />
                      </td>
                      <td>
                        <input
                          value={s.addressRange}
                          onChange={(e) => {
                            const next = [...state.subnets];
                            next[i] = { ...next[i], addressRange: e.target.value };
                            set("subnets", next);
                          }}
                          className={styles.input}
                          style={{ fontFamily: "Consolas, monospace" }}
                        />
                      </td>
                      <td>{s.defaultOutbound ? "On" : "Off"}</td>
                      <td>{s.natGateway || "—"}</td>
                      <td>{s.nsg || "—"}</td>
                      <td>{s.delegation || "—"}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() => set("subnets", state.subnets.filter((_, idx) => idx !== i))}
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
              onClick={() => set("subnets", [...state.subnets, freshSubnet(state.subnets.length)])}
            >
              + Add a subnet
            </button>

            <SectionHeader title="Outbound access" />
            <Callout tone="warn">
              By default, all virtual machines in a new subnet can access the internet using a Default Outbound IP,
              which Microsoft is retiring on September 30, 2025. To prevent connection issues, attach a NAT gateway,
              load balancer, or public IP to each VM.
            </Callout>
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader
              title="Tags"
              sub="Tags are name/value pairs that enable you to categorize resources and view consolidated billing by applying the same tag to multiple resources and resource groups."
            />
            <Callout tone="info">
              Tags applied here will be applied to the virtual network. To add tags to other resources, edit those
              resources directly.
            </Callout>
            <table className={styles.table} style={{ marginTop: 12 }}>
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
            <div className={styles.sectionCard}>
              <h3>Pricing</h3>
              {costLines.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span>{k}</span>
                  <span>
                    <b>{v}</b>
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span>
                  <b>Estimated total</b>
                </span>
                <span>
                  <b>${monthlyCost.toFixed(2)}/month (USD)</b>
                </span>
              </div>
              <p className={styles.help}>
                Estimated cost. Virtual networks themselves are free; charges apply to add-on services like Bastion,
                Firewall, and DDoS plans.
              </p>
            </div>
            <ReviewSection
              title="Basics"
              rows={[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Name", state.vnetName || "— not set —"],
                ["Region", state.region],
              ]}
            />
            <ReviewSection
              title="Security"
              rows={[
                ["Azure Bastion", state.bastionEnabled ? `Enabled (${state.bastionTier})` : "Disabled"],
                ["Azure Firewall", state.firewallEnabled ? `Enabled (${state.firewallTier})` : "Disabled"],
                ["DDoS Network Protection", state.ddosEnabled ? `Enabled (${state.ddosPlan || "plan not selected"})` : "Disabled"],
              ]}
            />
            <ReviewSection
              title="IP addresses"
              rows={[
                ["Address space", state.addressSpaces.join(", ")],
                ["Subnets", state.subnets.map((s) => `${s.name} (${s.addressRange})`).join(", ") || "(none)"],
              ]}
            />
            <ReviewSection
              title="Tags"
              rows={state.tags.length === 0 ? [["(no tags)", ""]] : state.tags.map((t) => [t.key || "(empty)", t.value || ""])}
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
      {showCli ? <CliPanel title="Equivalent CLI for this virtual network" command={cliFromVnet(state)} onClose={() => setShowCli(false)} /> : null}
    </div>
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
