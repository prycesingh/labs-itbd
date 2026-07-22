"use client";

import { useMemo, useState } from "react";

import {
  DISK_TYPES,
  INBOUND_PORT_OPTIONS,
  REGIONS,
  VM_IMAGES,
  VM_SIZES,
} from "@/lib/labs/simulators/azure/vmData";
import { defaultBootDiag, type VmResource } from "@/lib/labs/simulators/azure/types";
import {
  freshWizardState,
  validateWizardState,
  type VmWizardState,
} from "@/lib/labs/simulators/azure/wizardState";
import { cliFromVm } from "@/lib/labs/simulators/azure/cliTranslator";
import styles from "./azure-portal.module.css";
import { CliPanel } from "./cli-panel";
import { Callout, Checkbox, Field, NativeSelect, RadioInline, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "disks", label: "Disks" },
  { id: "networking", label: "Networking" },
  { id: "management", label: "Management" },
  { id: "monitoring", label: "Monitoring" },
  { id: "advanced", label: "Advanced" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function VmCreateWizard({
  resourceGroups,
  onCreate,
  onCreateResourceGroup,
  onCancel,
}: {
  resourceGroups: string[];
  onCreate: (resource: VmResource) => void;
  onCreateResourceGroup: (name: string) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<VmWizardState>(freshWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);

  const image = VM_IMAGES.find((i) => i.id === state.image) ?? VM_IMAGES[0];
  const isLinux = image.os === "Linux";
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof VmWizardState>(key: K, value: VmWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function togglePort(port: string) {
    setState((s) => ({
      ...s,
      selectedPorts: s.selectedPorts.includes(port)
        ? s.selectedPorts.filter((p) => p !== port)
        : [...s.selectedPorts, port],
    }));
  }

  function commit() {
    const errors = validateWizardState(state);
    if (errors.length > 0) {
      setActiveTab("review");
      return;
    }
    const size = VM_SIZES.find((s) => s.name === state.size) ?? VM_SIZES[0];
    const resource: VmResource = {
      id: crypto.randomUUID(),
      resourceType: "VirtualMachine",
      name: state.vmName,
      resourceGroup: state.resourceGroup,
      region: state.region,
      status: "Running",
      os: image.os,
      osImage: image.name,
      size: size.name,
      vcpus: size.vcpus,
      ram: size.ram,
      estimatedCost: size.cost,
      username: state.username,
      authType: state.authType,
      virtualNetwork: state.virtualNetwork,
      subnet: state.subnet,
      publicIp: state.publicIp,
      privateIp: `10.0.0.${4 + Math.floor(Math.random() * 250)}`,
      publicIpAddress:
        state.publicIp === "None"
          ? null
          : Array.from({ length: 4 }, () => Math.floor(Math.random() * 255)).join("."),
      nicNsg: state.nicNsg,
      inboundPorts: state.inboundPorts === "None" ? [] : [...state.selectedPorts],
      osDiskType: state.osDiskType,
      dataDisks: [...state.dataDisks],
      enableAutoShutdown: state.enableAutoShutdown,
      autoShutdownTime: state.autoShutdownTime,
      enableBackup: state.enableBackup,
      tags: state.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      extensions: [],
      bootDiag: defaultBootDiag(),
      restorePoints: [],
      asr: { enabled: false },
      alertRules: [],
      policyCompliance: [],
      createdAt: new Date().toISOString(),
    };
    onCreate(resource);
  }

  const validationErrors = useMemo(() => validateWizardState(state), [state]);

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
            <Field label="Virtual machine name" required>
              <input
                value={state.vmName}
                onChange={(e) => set("vmName", e.target.value)}
                placeholder="e.g., myVM"
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
            <Field label="Security type">
              <NativeSelect value={state.securityType} onChange={(v) => set("securityType", v)}>
                <option>Trusted launch virtual machines</option>
                <option>Standard</option>
                <option>Confidential virtual machines</option>
              </NativeSelect>
            </Field>
            <Field label="Image" required>
              <NativeSelect value={state.image} onChange={(v) => set("image", v)}>
                {VM_IMAGES.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Checkbox
              label="Run with Azure Spot discount"
              checked={state.runWithSpot}
              onChange={(v) => set("runWithSpot", v)}
              help="Save up to 90% compared to pay-as-you-go prices. Workload must tolerate interruption."
            />
            <Field label="Size" required>
              <NativeSelect value={state.size} onChange={(v) => set("size", v)}>
                {VM_SIZES.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} - {s.vcpus} vcpu, {s.ram} GiB memory (${s.cost.toFixed(2)}/mo)
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <SectionHeader title="Administrator account" />
            {isLinux ? (
              <RadioInline
                name="authType"
                value={state.authType}
                onChange={(v) => set("authType", v as VmWizardState["authType"])}
                choices={["SSH public key", "Password"]}
              />
            ) : null}
            <Field label="Username" required>
              <input
                value={state.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="azureuser"
                className={styles.input}
              />
            </Field>
            {isLinux && state.authType === "SSH public key" ? (
              <Field label="Key pair name" required>
                <input
                  value={state.sshKeyName}
                  onChange={(e) => set("sshKeyName", e.target.value)}
                  placeholder={`${state.vmName || "myVM"}_key`}
                  className={styles.input}
                />
              </Field>
            ) : (
              <Field label="Password" required>
                <input
                  type="password"
                  value={state.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="At least 12 characters, complex"
                  className={styles.input}
                />
              </Field>
            )}

            <SectionHeader
              title="Inbound port rules"
              sub="Select which VM network ports are accessible from the public internet."
            />
            <RadioInline
              name="inboundPorts"
              value={state.inboundPorts}
              onChange={(v) => set("inboundPorts", v as VmWizardState["inboundPorts"])}
              choices={["None", "Allow selected ports"]}
            />
            {state.inboundPorts === "Allow selected ports" ? (
              <>
                <div className={styles.radioRow} style={{ marginTop: 8 }}>
                  {INBOUND_PORT_OPTIONS.map((p) => (
                    <label key={p} className={styles.radioOption}>
                      <input
                        type="checkbox"
                        checked={state.selectedPorts.includes(p)}
                        onChange={() => togglePort(p)}
                      />
                      {p}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Callout tone="warn">
                    This will allow all IP addresses to access your virtual machine. Only recommended for
                    testing.
                  </Callout>
                </div>
              </>
            ) : null}
          </>
        )}

        {activeTab === "disks" && (
          <>
            <SectionHeader
              title="Disk options"
              sub="The size of the VM determines the type of storage you can use and the number of data disks allowed."
            />
            <Field label="OS disk type" required help={DISK_TYPES.find((d) => d.id === state.osDiskType)?.desc}>
              <NativeSelect value={state.osDiskType} onChange={(v) => set("osDiskType", v)}>
                {DISK_TYPES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Checkbox
              label="Delete OS disk when VM is deleted"
              checked={state.deleteOsDiskWithVm}
              onChange={(v) => set("deleteOsDiskWithVm", v)}
            />
            <Checkbox
              label="Use ephemeral OS disk"
              checked={state.useEphemeralOsDisk}
              onChange={(v) => set("useEphemeralOsDisk", v)}
              help="Ephemeral OS disks are stored on the local VM storage and not saved to remote Azure Storage."
            />

            <SectionHeader
              title={`Data disks for ${state.vmName || "myVM"}`}
              sub="You can add additional data disks for your virtual machine."
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>LUN</th>
                  <th>Name</th>
                  <th>Size (GiB)</th>
                  <th>Disk type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.dataDisks.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#605e5c" }}>
                      No data disks.
                    </td>
                  </tr>
                ) : (
                  state.dataDisks.map((d, i) => (
                    <tr key={i}>
                      <td>{i + 2}</td>
                      <td>{d.name}</td>
                      <td>{d.sizeGiB} GiB</td>
                      <td>{d.type}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.link}
                          onClick={() =>
                            set(
                              "dataDisks",
                              state.dataDisks.filter((_, idx) => idx !== i),
                            )
                          }
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
              onClick={() =>
                set("dataDisks", [
                  ...state.dataDisks,
                  { name: `${state.vmName || "myVM"}_DataDisk_${state.dataDisks.length}`, sizeGiB: 1024, type: "Premium_LRS" },
                ])
              }
            >
              + Create and attach a new disk
            </button>
          </>
        )}

        {activeTab === "networking" && (
          <>
            <SectionHeader
              title="Network interface"
              sub="When creating a virtual machine, a network interface will be created for you."
            />
            <Field label="Virtual network" required>
              <NativeSelect value={state.virtualNetwork} onChange={(v) => set("virtualNetwork", v)}>
                <option value="(new) vnet-default">(new) vnet-default</option>
              </NativeSelect>
            </Field>
            <Field label="Subnet" required>
              <NativeSelect value={state.subnet} onChange={(v) => set("subnet", v)}>
                <option>(new) default (10.0.0.0/24)</option>
                <option>(new) workload (10.0.1.0/24)</option>
              </NativeSelect>
            </Field>
            <Field label="Public IP">
              <NativeSelect value={state.publicIp} onChange={(v) => set("publicIp", v)}>
                <option>(new) auto-generated</option>
                <option>None</option>
              </NativeSelect>
            </Field>
            <Field label="NIC network security group">
              <RadioInline
                name="nicNsg"
                value={state.nicNsg}
                onChange={(v) => set("nicNsg", v as VmWizardState["nicNsg"])}
                choices={["None", "Basic", "Advanced"]}
              />
            </Field>
            <Checkbox
              label="Delete public IP and NIC when VM is deleted"
              checked={state.deletePublicIpWithVm}
              onChange={(v) => set("deletePublicIpWithVm", v)}
            />
            <Checkbox
              label="Enable accelerated networking"
              checked={state.acceleratedNetworking}
              onChange={(v) => set("acceleratedNetworking", v)}
              help="Receive lower latency, lower jitter, and lower CPU utilization for VMs."
            />

            <SectionHeader
              title="Load balancing"
              sub="You can place this virtual machine in the backend pool of an existing Azure load balancing solution."
            />
            <RadioInline
              name="loadBalancing"
              value={state.loadBalancing}
              onChange={(v) => set("loadBalancing", v)}
              choices={["None", "Azure load balancer", "Application gateway"]}
            />
          </>
        )}

        {activeTab === "management" && (
          <>
            <SectionHeader title="Identity" />
            <Checkbox
              label="Enable system assigned managed identity"
              checked={state.enableSystemIdentity}
              onChange={(v) => set("enableSystemIdentity", v)}
              help="Allows your VM to authenticate to other Azure services without storing credentials."
            />

            <SectionHeader title="Microsoft Entra ID" />
            <Checkbox
              label="Login with Microsoft Entra ID"
              checked={state.enableEntraLogin}
              onChange={(v) => set("enableEntraLogin", v)}
            />

            <SectionHeader title="Auto-shutdown" />
            <Checkbox
              label="Enable auto-shutdown"
              checked={state.enableAutoShutdown}
              onChange={(v) => set("enableAutoShutdown", v)}
              help="Configure auto-shutdown to save costs when the VM is not in use."
            />
            {state.enableAutoShutdown ? (
              <Field label="Shutdown time">
                <input
                  type="time"
                  value={state.autoShutdownTime}
                  onChange={(e) => set("autoShutdownTime", e.target.value)}
                  className={styles.input}
                  style={{ width: "auto" }}
                />
              </Field>
            ) : null}

            <SectionHeader title="Backup" />
            <Checkbox
              label="Enable backup"
              checked={state.enableBackup}
              onChange={(v) => set("enableBackup", v)}
            />

            <SectionHeader title="Guest OS updates" />
            <Field label="Patch orchestration option">
              <NativeSelect value={state.patchOrchestration} onChange={(v) => set("patchOrchestration", v)}>
                <option>Image default</option>
                <option>Azure-orchestrated patching</option>
                <option>Manual updates</option>
              </NativeSelect>
            </Field>

            <SectionHeader title="Boot diagnostics" />
            <Field label="Boot diagnostics" help="Allows you to capture serial console output and screenshots of the VM.">
              <NativeSelect value={state.bootDiagnostics} onChange={(v) => set("bootDiagnostics", v)}>
                <option>Enable with managed storage account</option>
                <option>Enable with custom storage account</option>
                <option>Disable</option>
              </NativeSelect>
            </Field>
          </>
        )}

        {activeTab === "monitoring" && (
          <>
            <SectionHeader title="Alerts" sub="Get notified when your VM has issues or anomalous activity." />
            <Checkbox
              label="Enable recommended alert rules"
              checked={state.enableAlerts}
              onChange={(v) => set("enableAlerts", v)}
              help="CPU >80%, available memory <10%, disk usage >90%."
            />
            <SectionHeader title="VM Insights" />
            <Checkbox
              label="Enable VM Insights"
              checked={state.enableInsights}
              onChange={(v) => set("enableInsights", v)}
            />
            <SectionHeader title="Application health monitoring" />
            <Checkbox
              label="Enable health monitoring"
              checked={state.healthMonitoring}
              onChange={(v) => set("healthMonitoring", v)}
            />
          </>
        )}

        {activeTab === "advanced" && (
          <>
            <SectionHeader title="Custom data" sub="Pass a script or configuration into the VM while it is being provisioned." />
            <textarea
              value={state.customData}
              onChange={(e) => set("customData", e.target.value)}
              rows={4}
              placeholder="#!/bin/bash&#10;apt-get update -y"
              className={styles.textarea}
            />
            <SectionHeader title="User data" sub="Accessible to your applications throughout the VM's lifetime." />
            <textarea
              value={state.userData}
              onChange={(e) => set("userData", e.target.value)}
              rows={3}
              placeholder="Optional"
              className={styles.textarea}
            />
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader title="Tags" sub="Name/value pairs that enable you to categorize resources." />
            <Callout tone="info">
              Tags applied here will be applied to the VM, the OS disk, the network interface, and the
              public IP.
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
            <ReviewSection
              title="Pricing"
              rows={[[VM_SIZES.find((s) => s.name === state.size)?.name ?? state.size, `$${(VM_SIZES.find((s) => s.name === state.size)?.cost ?? 0).toFixed(2)}/month (USD)`]]}
            />
            <ReviewSection
              title="Basics"
              rows={[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Virtual machine name", state.vmName || "— not set —"],
                ["Region", state.region],
                ["Image", image.name],
                ["Size", state.size],
                ["Authentication type", state.authType],
                ["Username", state.username],
                ["Public inbound ports", state.inboundPorts === "None" ? "None" : state.selectedPorts.join(", ")],
              ]}
            />
            <ReviewSection
              title="Disks"
              rows={[
                ["OS disk type", DISK_TYPES.find((d) => d.id === state.osDiskType)?.label ?? ""],
                ["Data disks", state.dataDisks.length === 0 ? "None" : `${state.dataDisks.length} disk(s)`],
              ]}
            />
            <ReviewSection
              title="Networking"
              rows={[
                ["Virtual network", state.virtualNetwork],
                ["Subnet", state.subnet],
                ["Public IP", state.publicIp],
                ["Accelerated networking", state.acceleratedNetworking ? "On" : "Off"],
              ]}
            />
            <ReviewSection
              title="Tags"
              rows={state.tags.length === 0 ? [["(no tags)", ""]] : state.tags.map((t) => [t.key || "(empty)", t.value])}
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
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => setActiveTab(TABS[activeIndex - 1].id)}
          >
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
      {showCli ? <CliPanel title="Equivalent CLI for this VM" command={cliFromVm(state)} onClose={() => setShowCli(false)} /> : null}
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
