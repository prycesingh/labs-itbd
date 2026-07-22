"use client";

import { useMemo, useState } from "react";

import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import { PRIMARY_SERVICES, REDUNDANCY, TLS_VERSIONS, estimateMonthlyCost } from "@/lib/labs/simulators/azure/storageData";
import { primaryEndpointsFor, randomKey } from "@/lib/labs/simulators/azure/storageData";
import type { StorageResource } from "@/lib/labs/simulators/azure/storageTypes";
import { freshSasState } from "@/lib/labs/simulators/azure/storageTypes";
import {
  freshStorageWizardState,
  validateStorageWizardState,
  type StorageWizardState,
} from "@/lib/labs/simulators/azure/storageWizardState";
import styles from "./azure-portal.module.css";
import { cliFromStorage } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Checkbox, Field, NativeSelect, RadioInline, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "advanced", label: "Advanced" },
  { id: "networking", label: "Networking" },
  { id: "dataprotection", label: "Data protection" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function StorageCreateWizard({
  resourceGroups,
  onCancel,
  onCreate,
  onCreateResourceGroup,
}: {
  resourceGroups: string[];
  onCancel: () => void;
  onCreate: (resource: StorageResource) => void;
  onCreateResourceGroup: (name: string) => void;
}) {
  const [state, setState] = useState<StorageWizardState>(freshStorageWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof StorageWizardState>(key: K, value: StorageWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const validationErrors = useMemo(() => validateStorageWizardState(state), [state]);
  const monthlyCost = useMemo(
    () => estimateMonthlyCost({ performance: state.performance, redundancy: state.redundancy, accessTier: state.accessTier }),
    [state.performance, state.redundancy, state.accessTier],
  );
  const nameValid = state.storageName === "" || /^[a-z0-9]{3,24}$/.test(state.storageName);

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const name = state.storageName;
    const resource: StorageResource = {
      id: crypto.randomUUID(),
      resourceType: "StorageAccount",
      name,
      resourceGroup: state.resourceGroup,
      region: state.region,
      performance: state.performance,
      redundancy: state.redundancy,
      primaryService: state.primaryService,
      secureTransfer: state.secureTransfer,
      tlsVersion: state.tlsVersion,
      hierarchicalNamespace: state.hierarchicalNamespace,
      accessTier: state.accessTier,
      networkAccess: state.networkAccess,
      routingPreference: state.routingPreference,
      allowBlobPublicAccess: state.allowPublicAccessContainers,
      enableStorageKeyAccess: state.enableStorageKeyAccess,
      defaultEntraAuth: state.defaultEntraAuth,
      enableSftp: state.enableSftp,
      enableNfsV3: state.enableNfsV3,
      allowCrossTenantReplication: state.allowCrossTenantReplication,
      largeFileShares: state.largeFileShares,
      enablePointInTimeRestore: state.enablePointInTimeRestore,
      pointInTimeRestoreDays: state.pointInTimeRestoreDays,
      enableSoftDeleteBlobs: state.enableSoftDeleteBlobs,
      softDeleteBlobsDays: state.softDeleteBlobsDays,
      enableSoftDeleteContainers: state.enableSoftDeleteContainers,
      softDeleteContainersDays: state.softDeleteContainersDays,
      enableSoftDeleteFileShares: state.enableSoftDeleteFileShares,
      softDeleteFileSharesDays: state.softDeleteFileSharesDays,
      enableBlobVersioning: state.enableBlobVersioning,
      enableBlobChangeFeed: state.enableBlobChangeFeed,
      enableVersionLevelImmutability: state.enableVersionLevelImmutability,
      encryptionKey: state.enableCustomerManagedKey ? "Customer-managed key" : "Microsoft-managed key",
      primaryEndpoints: primaryEndpointsFor(name),
      key1: `fake-base64-key-${randomKey()}`,
      key2: `fake-base64-key-${randomKey()}`,
      containers: [],
      fileShares: [],
      queues: [],
      tables: [],
      networkVnets: [],
      networkIps: [],
      privateEndpoints: [],
      lifecycleRules: [],
      objectReplRules: [],
      inventoryRules: [],
      alertRules: [],
      frontDoorProfile: null,
      defenderForStorage: { enabled: false, plan: "On-upload", sensitiveDataDiscovery: false, malwareScanning: false },
      sas: freshSasState(),
      estimatedCost: monthlyCost,
      tags: state.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
      status: "Succeeded",
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
              sub="Select the subscription in which to create the new storage account. Choose a new or existing resource group to organize and manage your storage account along with other resources."
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

            <SectionHeader
              title="Instance details"
              sub="The default deployment model is Resource Manager, which supports the latest Azure features."
            />
            <Field
              label="Storage account name"
              required
              help="The name must be unique across all existing storage account names in Azure. Lowercase letters and numbers, between 3 and 24 characters."
            >
              <input value={state.storageName} onChange={(e) => set("storageName", e.target.value)} placeholder="e.g., mystorage123" className={styles.input} />
              {!nameValid ? <Callout tone="warn">Storage account name must be 3-24 characters and contain only lowercase letters and numbers.</Callout> : null}
            </Field>
            <Field label="Region" required help="Azure regions are organized into geographies.">
              <NativeSelect value={state.region} onChange={(v) => set("region", v)}>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Primary service" help="The primary service that you plan to use with this storage account.">
              <NativeSelect value={state.primaryService} onChange={(v) => set("primaryService", v)}>
                {PRIMARY_SERVICES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Performance"
              required
              help="Standard: recommended for most scenarios (general-purpose v2). Premium: low-latency scenarios (block blob, file share, page blob)."
            >
              <RadioInline name="performance" value={state.performance} onChange={(v) => set("performance", v as "Standard" | "Premium")} choices={["Standard", "Premium"]} />
            </Field>

            <SectionHeader title="Redundancy" sub="Replicating your data ensures durability and high availability of your storage account." />
            <div className={styles.redundancyList}>
              {REDUNDANCY.map((r) => (
                <label key={r.id}>
                  <input type="radio" name="redundancy" checked={state.redundancy === r.id} onChange={() => set("redundancy", r.id)} />
                  <span>
                    <b>{r.name}</b>
                    <span className="desc">{r.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {activeTab === "advanced" && (
          <>
            <SectionHeader title="Security" sub="Configure security settings that impact your storage account." />
            <Checkbox
              label="Require secure transfer for REST API operations"
              checked={state.secureTransfer}
              onChange={(v) => set("secureTransfer", v)}
              help="The secure transfer option enhances the security of your storage account by only allowing requests to the storage account by a secure connection."
            />
            <Checkbox
              label="Allow enabling public access on individual containers"
              checked={state.allowPublicAccessContainers}
              onChange={(v) => set("allowPublicAccessContainers", v)}
              help="When disabled, no anonymous access to any container or blob is permitted."
            />
            <Checkbox
              label="Enable storage account key access"
              checked={state.enableStorageKeyAccess}
              onChange={(v) => set("enableStorageKeyAccess", v)}
              help="When allowed, requests authorized with account access keys are permitted. When disallowed, all requests must be authorized with Microsoft Entra ID."
            />
            <Checkbox
              label="Default to Microsoft Entra authorization in the Azure portal"
              checked={state.defaultEntraAuth}
              onChange={(v) => set("defaultEntraAuth", v)}
              help="Microsoft Entra ID will be the default selection in the Azure portal when navigating to data resources in this storage account."
            />
            <Field label="Minimum TLS version" help="The minimum version of TLS required for incoming requests.">
              <NativeSelect value={state.tlsVersion} onChange={(v) => set("tlsVersion", v)}>
                {TLS_VERSIONS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </NativeSelect>
            </Field>

            <SectionHeader
              title="Hierarchical namespace"
              sub="The Azure Data Lake Storage Gen2 hierarchical namespace accelerates big data analytics workloads and enables file-level access control lists (ACLs)."
            />
            <Checkbox
              label="Enable hierarchical namespace"
              checked={state.hierarchicalNamespace}
              onChange={(v) => set("hierarchicalNamespace", v)}
              help="Storage account features such as soft delete, change feed, and versioning are not currently supported when hierarchical namespace is enabled."
            />

            <SectionHeader title="Access protocols" />
            <Checkbox label="Enable SFTP" checked={state.enableSftp} onChange={(v) => set("enableSftp", v)} help="Enable the SSH File Transfer Protocol (SFTP). Requires hierarchical namespace." />
            <Checkbox
              label="Enable network file system v3"
              checked={state.enableNfsV3}
              onChange={(v) => set("enableNfsV3", v)}
              help="Network file system v3 provides Linux file system compatibility at object storage scale. Requires hierarchical namespace."
            />

            <SectionHeader title="Blob storage" />
            <Checkbox
              label="Allow cross-tenant replication"
              checked={state.allowCrossTenantReplication}
              onChange={(v) => set("allowCrossTenantReplication", v)}
              help="Allow object replication across Microsoft Entra tenants."
            />
            <Field label="Access tier" help="Hot: optimized for frequent access. Cool: optimized for infrequent access (stored for at least 30 days).">
              <RadioInline name="accessTier" value={state.accessTier} onChange={(v) => set("accessTier", v as "Hot" | "Cool")} choices={["Hot", "Cool"]} />
            </Field>

            <SectionHeader title="Azure Files" />
            <Checkbox
              label="Enable large file shares"
              checked={state.largeFileShares}
              onChange={(v) => set("largeFileShares", v)}
              help="Provides file share support up to a maximum of 100 TiB. Large file share storage accounts do not have the ability to convert to geo-redundant storage."
            />

            <SectionHeader title="Tables and queues" />
            <Callout tone="info">Account-scoped encryption keys for Tables and Queues are configured by default with Microsoft-managed keys.</Callout>
          </>
        )}

        {activeTab === "networking" && (
          <>
            <SectionHeader
              title="Network connectivity"
              sub="You can connect to your storage account either publicly, via public IP addresses or service endpoints, or privately, using a private endpoint."
            />
            <Field label="Network access">
              <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                {(["Enable from all networks", "Enable from selected virtual networks and IP addresses", "Disable public access and use private access"] as const).map((c) => (
                  <label key={c} className={styles.radioOption}>
                    <input type="radio" name="networkAccess" checked={state.networkAccess === c} onChange={() => set("networkAccess", c)} />
                    {c}
                  </label>
                ))}
              </div>
            </Field>
            {state.networkAccess === "Enable from all networks" ? (
              <Callout tone="warn">All networks, including the internet, can access this storage account. This is not recommended for production workloads with sensitive data.</Callout>
            ) : state.networkAccess === "Enable from selected virtual networks and IP addresses" ? (
              <Callout tone="info">Only the virtual networks and IP addresses you configure will have access. You can add virtual networks and firewall rules after the storage account is created.</Callout>
            ) : (
              <Callout tone="info">Public access is disabled. You must use a private endpoint to access the storage account.</Callout>
            )}

            <SectionHeader
              title="Network routing"
              sub="Determine how you would like to route your traffic as it travels from its source to its Azure endpoint. Microsoft network routing is recommended for most customers."
            />
            <Field label="Routing preference">
              <RadioInline
                name="routingPreference"
                value={state.routingPreference}
                onChange={(v) => set("routingPreference", v as "Microsoft network routing" | "Internet routing")}
                choices={["Microsoft network routing", "Internet routing"]}
              />
            </Field>
            <p className={styles.help}>
              Microsoft network routing routes traffic over the Microsoft global wide area network. Internet routing routes traffic to the closest POP and offers a lower cost.
            </p>
          </>
        )}

        {activeTab === "dataprotection" && (
          <>
            <SectionHeader title="Recovery" sub="Protect your data from accidental or erroneous deletion or modification." />
            <Checkbox
              label="Enable point-in-time restore for containers"
              checked={state.enablePointInTimeRestore}
              onChange={(v) => set("enablePointInTimeRestore", v)}
              help="Use point-in-time restore to restore one or more containers to an earlier state. Requires versioning, change feed, and soft delete for blobs."
            />
            {state.enablePointInTimeRestore ? (
              <SliderRow label="Maximum restore point (days)" value={state.pointInTimeRestoreDays} min={1} max={365} onChange={(v) => set("pointInTimeRestoreDays", v)} />
            ) : null}
            <Checkbox
              label="Enable soft delete for blobs"
              checked={state.enableSoftDeleteBlobs}
              onChange={(v) => set("enableSoftDeleteBlobs", v)}
              help="Soft delete enables you to recover blobs that were previously marked for deletion, including blobs that were overwritten."
            />
            {state.enableSoftDeleteBlobs ? (
              <SliderRow label="Days to retain deleted blobs" value={state.softDeleteBlobsDays} min={1} max={365} onChange={(v) => set("softDeleteBlobsDays", v)} />
            ) : null}
            <Checkbox
              label="Enable soft delete for containers"
              checked={state.enableSoftDeleteContainers}
              onChange={(v) => set("enableSoftDeleteContainers", v)}
              help="Soft delete enables you to recover containers that were previously marked for deletion."
            />
            {state.enableSoftDeleteContainers ? (
              <SliderRow label="Days to retain deleted containers" value={state.softDeleteContainersDays} min={1} max={365} onChange={(v) => set("softDeleteContainersDays", v)} />
            ) : null}
            <Checkbox
              label="Enable soft delete for file shares"
              checked={state.enableSoftDeleteFileShares}
              onChange={(v) => set("enableSoftDeleteFileShares", v)}
              help="Soft delete enables you to recover file shares that were previously marked for deletion."
            />
            {state.enableSoftDeleteFileShares ? (
              <SliderRow label="Days to retain deleted file shares" value={state.softDeleteFileSharesDays} min={1} max={365} onChange={(v) => set("softDeleteFileSharesDays", v)} />
            ) : null}

            <SectionHeader title="Tracking" sub="Manage versions and keep track of changes made to your blob data." />
            <Checkbox label="Enable versioning for blobs" checked={state.enableBlobVersioning} onChange={(v) => set("enableBlobVersioning", v)} help="Use versioning to automatically maintain previous versions of your blobs." />
            <Checkbox label="Enable blob change feed" checked={state.enableBlobChangeFeed} onChange={(v) => set("enableBlobChangeFeed", v)} help="Keep track of create, modification, and delete changes to blobs in your account." />
            <Checkbox
              label="Enable version-level immutability support"
              checked={state.enableVersionLevelImmutability}
              onChange={(v) => set("enableVersionLevelImmutability", v)}
              help="Allows setting time-based retention policies on individual blob versions for regulatory compliance."
            />

            <SectionHeader title="Access control" />
            <Checkbox
              label="Enable customer-managed key support"
              checked={state.enableCustomerManagedKey}
              onChange={(v) => set("enableCustomerManagedKey", v)}
              help="Customer-managed keys allow you to control the encryption keys used to protect your data at rest. Keys are stored in Azure Key Vault."
            />
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader title="Tags" sub="Tags are name/value pairs that enable you to categorize resources and view consolidated billing." />
            <Callout tone="info">Note that if you create tags and then change resource settings on other tabs, your tags will be automatically updated.</Callout>
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
                        <button type="button" className={styles.link} onClick={() => set("tags", state.tags.filter((_, idx) => idx !== i))}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <button type="button" className={styles.link} style={{ marginTop: 8 }} onClick={() => set("tags", [...state.tags, { key: "", value: "" }])}>
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span>Storage capacity (first 50 TB)</span>
                <span>
                  <b>${monthlyCost.toFixed(2)}/month</b> (USD, estimated)
                </span>
              </div>
              <p className={styles.help}>
                Estimated cost based on {state.performance} performance and {state.redundancy} redundancy. Actual cost varies based on storage usage, transactions, egress, and region.
              </p>
            </div>
            <ReviewSection
              title="Basics"
              rows={[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Storage account name", state.storageName || "— not set —"],
                ["Region", state.region],
                ["Primary service", state.primaryService],
                ["Performance", state.performance],
                ["Redundancy", REDUNDANCY.find((r) => r.id === state.redundancy)?.name ?? state.redundancy],
              ]}
            />
            <ReviewSection
              title="Advanced"
              rows={[
                ["Require secure transfer", state.secureTransfer ? "Enabled" : "Disabled"],
                ["Allow blob public access", state.allowPublicAccessContainers ? "Enabled" : "Disabled"],
                ["Storage account key access", state.enableStorageKeyAccess ? "Enabled" : "Disabled"],
                ["Default to Microsoft Entra authorization", state.defaultEntraAuth ? "Enabled" : "Disabled"],
                ["Minimum TLS version", state.tlsVersion],
                ["Hierarchical namespace", state.hierarchicalNamespace ? "Enabled" : "Disabled"],
                ["SFTP", state.enableSftp ? "Enabled" : "Disabled"],
                ["NFS v3", state.enableNfsV3 ? "Enabled" : "Disabled"],
                ["Access tier", state.accessTier],
                ["Large file shares", state.largeFileShares ? "Enabled" : "Disabled"],
              ]}
            />
            <ReviewSection title="Networking" rows={[["Network access", state.networkAccess], ["Routing preference", state.routingPreference]]} />
            <ReviewSection
              title="Data protection"
              rows={[
                ["Point-in-time restore", state.enablePointInTimeRestore ? `${state.pointInTimeRestoreDays} days` : "Disabled"],
                ["Soft delete for blobs", state.enableSoftDeleteBlobs ? `${state.softDeleteBlobsDays} days` : "Disabled"],
                ["Soft delete for containers", state.enableSoftDeleteContainers ? `${state.softDeleteContainersDays} days` : "Disabled"],
                ["Soft delete for file shares", state.enableSoftDeleteFileShares ? `${state.softDeleteFileSharesDays} days` : "Disabled"],
                ["Blob versioning", state.enableBlobVersioning ? "Enabled" : "Disabled"],
                ["Blob change feed", state.enableBlobChangeFeed ? "Enabled" : "Disabled"],
                ["Version-level immutability", state.enableVersionLevelImmutability ? "Enabled" : "Disabled"],
                ["Customer-managed key", state.enableCustomerManagedKey ? "Enabled" : "Disabled"],
              ]}
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
      {showCli ? <CliPanel title="Equivalent CLI for this storage account" command={cliFromStorage(state)} onClose={() => setShowCli(false)} /> : null}
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.field} style={{ paddingLeft: 28 }}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.sliderRow}>
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} />
        <span className="val">{value} days</span>
      </div>
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
