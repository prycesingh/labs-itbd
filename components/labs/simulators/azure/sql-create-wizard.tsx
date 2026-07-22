"use client";

import { useMemo, useState } from "react";

import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import {
  BACKUP_REDUNDANCIES,
  COLLATIONS,
  DTU_TIERS,
  HARDWARE_FAMILIES,
  VCORE_TIERS,
  estimateMonthlyCost,
} from "@/lib/labs/simulators/azure/sqlData";
import type { SqlResource } from "@/lib/labs/simulators/azure/sqlTypes";
import {
  freshSqlWizardState,
  validateSqlWizardState,
  type SqlWizardState,
} from "@/lib/labs/simulators/azure/sqlWizardState";
import styles from "./azure-portal.module.css";
import { cliFromSql } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Field, NativeSelect, RadioInline, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "networking", label: "Networking" },
  { id: "security", label: "Security" },
  { id: "additional", label: "Additional settings" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SqlCreateWizard({
  resourceGroups,
  existingServers,
  onCancel,
  onCreate,
  onCreateResourceGroup,
}: {
  resourceGroups: string[];
  existingServers: { name: string; adminLogin: string; authMethod: string; fqdn: string }[];
  onCancel: () => void;
  onCreate: (resource: SqlResource) => void;
  onCreateResourceGroup: (name: string) => void;
}) {
  const [state, setState] = useState<SqlWizardState>(freshSqlWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof SqlWizardState>(key: K, value: SqlWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const validationErrors = useMemo(
    () => validateSqlWizardState(state, existingServers.map((s) => s.name)),
    [state, existingServers],
  );

  const cost = useMemo(
    () =>
      estimateMonthlyCost({
        pricingModel: state.pricingModel,
        dtuTier: state.dtuTier,
        dtuMaxGB: state.dtuMaxGB,
        vcoreTier: state.vcoreTier,
        vCores: state.vCores,
        dataMaxGB: state.dataMaxGB,
        backupRedundancy: state.backupRedundancy,
      }),
    [state.pricingModel, state.dtuTier, state.dtuMaxGB, state.vcoreTier, state.vCores, state.dataMaxGB, state.backupRedundancy],
  );

  const needsSqlAuth = state.authMethod === "Use SQL authentication" || state.authMethod === "Use both SQL and Microsoft Entra authentication";
  const passMismatch = state.adminPassword && state.adminPasswordConfirm && state.adminPassword !== state.adminPasswordConfirm;

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const serverName = state.serverChoice === "new" ? state.serverName : state.existingServer;
    const existing = existingServers.find((s) => s.name === state.existingServer);
    const vcoreTierLabel = VCORE_TIERS.find((t) => t.id === state.vcoreTier)?.label ?? state.vcoreTier;
    const serviceTier = state.pricingModel === "DTU" ? state.dtuTier : vcoreTierLabel;
    const serverFQDN = state.serverChoice === "new" ? `${serverName}.database.windows.net` : existing?.fqdn ?? `${serverName}.database.windows.net`;
    const serverAdminLogin = state.serverChoice === "new" ? state.serverAdminLogin : existing?.adminLogin ?? state.serverAdminLogin;
    const authMethod = state.serverChoice === "new" ? state.authMethod : existing?.authMethod ?? state.authMethod;

    const fwRules = state.firewallRules.slice();
    if (state.addClientIp) fwRules.unshift({ name: "AllowClientIPAddress", startIp: "203.0.113.42", endIp: "203.0.113.42" });

    const resource: SqlResource = {
      id: crypto.randomUUID(),
      resourceType: "SqlDatabase",
      name: state.databaseName,
      resourceGroup: state.resourceGroup,
      region: state.serverLocation,
      server: serverName,
      serverAdminLogin,
      serverFQDN,
      pricingModel: state.pricingModel,
      serviceTier,
      computeTier: state.computeTier,
      vCores: state.pricingModel === "vCore" ? state.vCores : null,
      dtu: state.pricingModel === "DTU" ? state.dtuValue : null,
      hardwareFamily: state.pricingModel === "vCore" ? state.hardwareFamily : null,
      dataMaxGB: state.pricingModel === "vCore" ? state.dataMaxGB : state.dtuMaxGB,
      backupRedundancy: state.backupRedundancy,
      status: "Online",
      collation: state.collation,
      publicAccess: state.networkConnectivity === "Public endpoint",
      allowAzureServices: state.allowAzureServices,
      firewallRules: fwRules,
      connectionPolicy: state.connectionPolicy,
      minTlsVersion: state.minTlsVersion,
      defender: state.defenderForSql === "Start free trial",
      ledger: state.enableLedger,
      tdeOption: state.tdeOption,
      authMethod,
      useExistingData: state.useExistingData,
      maintenanceWindow: state.maintenanceWindow,
      workloadEnv: state.workloadEnv,
      estimatedCost: cost.total,
      ltrWeekly: 0,
      ltrMonthly: 0,
      ltrYearly: 0,
      auditingEnabled: false,
      auditRetentionDays: 90,
      alertRules: [],
      diagSettings: [],
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
            <SectionHeader title="Project details" sub="Select the subscription to manage deployed resources and costs. Use resource groups to organize all your resources." />
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

            <SectionHeader title="Database details" sub="Enter required settings for this database, including picking a logical server and configuring the compute and storage resources." />
            <Field label="Database name" required>
              <input value={state.databaseName} onChange={(e) => set("databaseName", e.target.value)} placeholder="e.g., contoso-db" className={styles.input} />
            </Field>

            <SectionHeader title="Server" sub="A logical server contains a group of databases managed as a group." />
            <RadioInline
              name="sqlServerChoice"
              value={state.serverChoice === "new" ? "Create new" : "Use existing"}
              onChange={(v) => set("serverChoice", v === "Create new" ? "new" : "existing")}
              choices={["Create new", "Use existing"]}
            />
            {state.serverChoice === "new" ? (
              <>
                <Field label="Server name" required help={`${state.serverName || "<servername>"}.database.windows.net`}>
                  <input value={state.serverName} onChange={(e) => set("serverName", e.target.value)} placeholder="e.g., myserver" className={styles.input} />
                </Field>
                <Field label="Location" required>
                  <NativeSelect value={state.serverLocation} onChange={(v) => set("serverLocation", v)}>
                    {REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Authentication method">
                  <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                    {(["Use SQL authentication", "Use Microsoft Entra-only authentication", "Use both SQL and Microsoft Entra authentication"] as const).map((m) => (
                      <label key={m} className={styles.radioOption}>
                        <input type="radio" name="sqlAuth" checked={state.authMethod === m} onChange={() => set("authMethod", m)} />
                        {m}
                      </label>
                    ))}
                  </div>
                </Field>
                {needsSqlAuth ? (
                  <>
                    <Field label="Server admin login" required>
                      <input value={state.serverAdminLogin} onChange={(e) => set("serverAdminLogin", e.target.value)} placeholder="sqladmin" className={styles.input} />
                    </Field>
                    <Field label="Password" required help="Your password must be at least 8 characters and contain upper case, lower case, and a digit.">
                      <input type="password" value={state.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} placeholder="At least 8 chars, upper+lower+digit" className={styles.input} />
                    </Field>
                    <Field label="Confirm password" required>
                      <input type="password" value={state.adminPasswordConfirm} onChange={(e) => set("adminPasswordConfirm", e.target.value)} placeholder="Re-enter password" className={styles.input} />
                      {passMismatch ? <Callout tone="warn">Passwords do not match.</Callout> : null}
                    </Field>
                  </>
                ) : null}
                {state.authMethod !== "Use SQL authentication" ? (
                  <Field label="Microsoft Entra admin" required>
                    <input value={`${state.serverAdminLogin}@contoso.onmicrosoft.com`} readOnly className={styles.input} />
                  </Field>
                ) : null}
              </>
            ) : (
              <Field label="Existing server" required>
                <NativeSelect value={state.existingServer} onChange={(v) => set("existingServer", v)}>
                  <option value="">(select an existing server)</option>
                  {existingServers.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <SectionHeader title="Elastic pool" sub="Azure SQL elastic pools enable you to share resources between databases." />
            <Field label="Want to use SQL elastic pool?">
              <RadioInline name="sqlUseEP" value={state.useElasticPool} onChange={(v) => set("useElasticPool", v as "No" | "Yes")} choices={["No", "Yes"]} />
            </Field>
            {state.useElasticPool === "Yes" ? (
              <>
                <Field label="Elastic pool name" required>
                  <input value={state.elasticPoolName} onChange={(e) => set("elasticPoolName", e.target.value)} placeholder="pool-name" className={styles.input} />
                </Field>
                <Field label="Service tier">
                  <NativeSelect value={state.elasticPoolTier} onChange={(v) => set("elasticPoolTier", v)}>
                    <option>Basic</option>
                    <option>Standard</option>
                    <option>Premium</option>
                    <option>GeneralPurpose</option>
                    <option>BusinessCritical</option>
                  </NativeSelect>
                </Field>
              </>
            ) : null}

            <SectionHeader title="Workload environment" />
            <Field label="Workload environment" help="Development uses the cheapest defaults. Production raises compute, storage, and enables geo-redundant backups.">
              <RadioInline name="sqlWorkEnv" value={state.workloadEnv} onChange={(v) => set("workloadEnv", v as "Development" | "Production")} choices={["Development", "Production"]} />
            </Field>

            <SectionHeader title="Compute + storage" sub="Configure the compute generation, vCores or DTU, and storage for your database." />
            <div className={styles.sectionCard}>
              <b>Configure database</b>
              <p className={styles.help}>Choose the pricing model and resources for this database. You can change this later.</p>
              <div style={{ marginTop: 10 }}>
                <RadioInline name="sqlPricingModel" value={state.pricingModel === "DTU" ? "DTU model" : "vCore model (recommended)"} onChange={(v) => set("pricingModel", v.startsWith("DTU") ? "DTU" : "vCore")} choices={["DTU model", "vCore model (recommended)"]} />
              </div>
              {state.pricingModel === "DTU" ? (
                <DtuTierPicker state={state} set={set} />
              ) : (
                <VcoreTierPicker state={state} set={set} />
              )}
              <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid #edebe9" }} />
              <Field label="Backup storage redundancy" help="LRS — cheapest, single zone. ZRS — cross-zone in region. GRS — cross-region, recommended for production.">
                <NativeSelect value={state.backupRedundancy} onChange={(v) => set("backupRedundancy", v)}>
                  {BACKUP_REDUNDANCIES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Callout tone="info">
                <b>Estimated cost:</b> ${cost.total.toFixed(2)}/month (compute ${cost.compute.toFixed(2)} + storage ${cost.storage.toFixed(2)} + backup ${cost.backup.toFixed(2)})
              </Callout>
            </div>
          </>
        )}

        {activeTab === "networking" && (
          <>
            <SectionHeader title="Network connectivity" sub="Control how clients connect to the database." />
            <Field label="Connectivity method">
              <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                {(["Public endpoint", "Private endpoint", "No access"] as const).map((c) => (
                  <label key={c} className={styles.radioOption}>
                    <input type="radio" name="sqlNetConn" checked={state.networkConnectivity === c} onChange={() => set("networkConnectivity", c)} />
                    {c}
                  </label>
                ))}
              </div>
            </Field>

            {state.networkConnectivity === "Public endpoint" ? (
              <>
                <SectionHeader title="Firewall rules" sub="Add rules to allow specific clients through the SQL server firewall." />
                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={state.addClientIp} onChange={(e) => set("addClientIp", e.target.checked)} />
                  Add current client IP address (203.0.113.42)
                </label>
                <label className={styles.checkboxRow} style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={state.allowAzureServices} onChange={(e) => set("allowAzureServices", e.target.checked)} />
                  Allow Azure services and resources to access this server
                </label>
                <p className={styles.help}>If yes, this server will accept connections from all Azure resources, including resources not in your subscription.</p>
                <table className={styles.table} style={{ marginTop: 14 }}>
                  <thead>
                    <tr>
                      <th>Rule name</th>
                      <th>Start IP</th>
                      <th>End IP</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.firewallRules.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No firewall rules.</td>
                      </tr>
                    ) : (
                      state.firewallRules.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              value={r.name}
                              onChange={(e) => {
                                const next = [...state.firewallRules];
                                next[i] = { ...next[i], name: e.target.value };
                                set("firewallRules", next);
                              }}
                              className={styles.input}
                            />
                          </td>
                          <td>
                            <input
                              value={r.startIp}
                              onChange={(e) => {
                                const next = [...state.firewallRules];
                                next[i] = { ...next[i], startIp: e.target.value };
                                set("firewallRules", next);
                              }}
                              placeholder="0.0.0.0"
                              className={styles.input}
                            />
                          </td>
                          <td>
                            <input
                              value={r.endIp}
                              onChange={(e) => {
                                const next = [...state.firewallRules];
                                next[i] = { ...next[i], endIp: e.target.value };
                                set("firewallRules", next);
                              }}
                              placeholder="0.0.0.0"
                              className={styles.input}
                            />
                          </td>
                          <td>
                            <button type="button" className={styles.link} onClick={() => set("firewallRules", state.firewallRules.filter((_, idx) => idx !== i))}>
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
                  onClick={() => set("firewallRules", [...state.firewallRules, { name: `rule-${state.firewallRules.length + 1}`, startIp: "", endIp: "" }])}
                >
                  + Add a firewall rule
                </button>
              </>
            ) : state.networkConnectivity === "Private endpoint" ? (
              <Callout tone="info">
                Private endpoint connections allow clients on a virtual network to access this server. After creation, configure private endpoints from the Networking blade.
              </Callout>
            ) : (
              <Callout tone="warn">No public network access. The database is reachable only through private endpoints. Used for highest-security workloads.</Callout>
            )}

            <SectionHeader title="Connection policy" />
            <Field label="Connection policy">
              <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                <label className={styles.radioOption}>
                  <input type="radio" name="sqlConnPolicy" checked={state.connectionPolicy === "Default"} onChange={() => set("connectionPolicy", "Default")} />
                  Default — Redirect inside Azure, Proxy outside
                </label>
                <label className={styles.radioOption}>
                  <input type="radio" name="sqlConnPolicy" checked={state.connectionPolicy === "Proxy"} onChange={() => set("connectionPolicy", "Proxy")} />
                  Proxy — All connections through gateway (higher latency)
                </label>
                <label className={styles.radioOption}>
                  <input type="radio" name="sqlConnPolicy" checked={state.connectionPolicy === "Redirect"} onChange={() => set("connectionPolicy", "Redirect")} />
                  Redirect — Direct connection to backend (lowest latency)
                </label>
              </div>
            </Field>

            <SectionHeader title="Encryption" />
            <Field label="Minimum TLS version" help="Minimum TLS version that clients must use. TLS 1.2 is recommended.">
              <NativeSelect value={state.minTlsVersion} onChange={(v) => set("minTlsVersion", v as "1.0" | "1.1" | "1.2")}>
                <option>1.0</option>
                <option>1.1</option>
                <option>1.2</option>
              </NativeSelect>
            </Field>
          </>
        )}

        {activeTab === "security" && (
          <>
            <SectionHeader title="Microsoft Defender for SQL" sub="Helps detect anomalous activities indicating attempts to access or exploit databases." />
            <Field label="Enable Microsoft Defender for SQL" help="Defender for SQL costs $15/server/month after the free trial.">
              <RadioInline name="sqlDefender" value={state.defenderForSql} onChange={(v) => set("defenderForSql", v as "Start free trial" | "Not now")} choices={["Start free trial", "Not now"]} />
            </Field>

            <SectionHeader title="Ledger" sub="Provides tamper-evidence capabilities in your database. Cryptographically attest to other parties that your data has not been tampered with." />
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={state.enableLedger} onChange={(e) => set("enableLedger", e.target.checked)} />
              Enable ledger
            </label>
            {state.enableLedger ? <Callout tone="info">Ledger will be enabled on all tables in this database. This setting cannot be changed later.</Callout> : null}

            <SectionHeader title="Transparent data encryption (TDE)" sub="TDE performs real-time encryption of the database, associated backups, and transaction logs at rest." />
            <Field label="Transparent data encryption">
              <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                <label className={styles.radioOption}>
                  <input type="radio" name="sqlTde" checked={state.tdeOption === "Service-managed key"} onChange={() => set("tdeOption", "Service-managed key")} />
                  Service-managed key (default)
                </label>
                <label className={styles.radioOption}>
                  <input type="radio" name="sqlTde" checked={state.tdeOption === "Customer-managed key"} onChange={() => set("tdeOption", "Customer-managed key")} />
                  Customer-managed key (BYOK) — from Key Vault
                </label>
              </div>
            </Field>
          </>
        )}

        {activeTab === "additional" && (
          <>
            <SectionHeader title="Data source" sub="Start with a blank database, restore from a backup, or select sample data." />
            <Field label="Use existing data">
              <RadioInline name="sqlData" value={state.useExistingData} onChange={(v) => set("useExistingData", v as "None" | "Backup" | "Sample")} choices={["None", "Backup", "Sample"]} />
            </Field>

            <SectionHeader title="Database collation" sub="Defines the rules that sort and compare data; cannot be changed after creation." />
            <Field label="Collation">
              <NativeSelect value={state.collation} onChange={(v) => set("collation", v)}>
                {COLLATIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>

            <SectionHeader title="Maintenance window" sub="Schedule when Azure can apply planned maintenance." />
            <Field label="Maintenance window">
              <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                {(["System default", "Custom (Weekday 10pm-6am)", "Custom (Weekend 10pm-6am)"] as const).map((m) => (
                  <label key={m} className={styles.radioOption}>
                    <input type="radio" name="sqlMaint" checked={state.maintenanceWindow === m} onChange={() => set("maintenanceWindow", m)} />
                    {m === "System default" ? "System default (5pm to 8am)" : m.replace("Custom (", "").replace(")", "")}
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader title="Tags" sub="Tags are name/value pairs that enable you to categorize resources and view consolidated billing." />
            <Callout tone="info">Tags applied here will be applied to the database, the logical server (if new), and related resources.</Callout>
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
              <h3>Pricing summary</h3>
              <ReviewRow k="Compute" v={`$${cost.compute.toFixed(2)}/month`} />
              <ReviewRow k="Storage" v={`$${cost.storage.toFixed(2)}/month`} />
              <ReviewRow k={`Backup (${state.backupRedundancy.split(" ")[0]})`} v={`$${cost.backup.toFixed(2)}/month`} />
              <ReviewRow k="Total estimated" v={`$${cost.total.toFixed(2)}/month (USD)`} />
            </div>
            <ReviewSection
              title="Basics"
              rows={[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Database name", state.databaseName || "— not set —"],
                ["Server", state.serverChoice === "new" ? (state.serverName ? `${state.serverName}.database.windows.net` : "— not set —") : state.existingServer || "— not selected —"],
                ["Authentication method", state.authMethod],
                ["Workload environment", state.workloadEnv],
                ["Compute + storage", `${state.pricingModel === "DTU" ? `${state.dtuTier} (${state.dtuValue} DTU)` : `${VCORE_TIERS.find((t) => t.id === state.vcoreTier)?.label} (${state.vCores} vCore)`}, ${state.pricingModel === "DTU" ? state.dtuMaxGB : state.dataMaxGB} GB`],
                ["Backup redundancy", state.backupRedundancy],
              ]}
            />
            <ReviewSection
              title="Networking"
              rows={[
                ["Connectivity", state.networkConnectivity],
                ["Allow Azure services", state.allowAzureServices ? "Yes" : "No"],
                ["Firewall rules", `${state.firewallRules.length}${state.addClientIp ? " (+ current client IP)" : ""}`],
                ["Connection policy", state.connectionPolicy],
                ["Minimum TLS", state.minTlsVersion],
              ]}
            />
            <ReviewSection
              title="Security"
              rows={[
                ["Defender for SQL", state.defenderForSql],
                ["Ledger", state.enableLedger ? "Enabled" : "Disabled"],
                ["TDE", state.tdeOption],
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
      {showCli ? <CliPanel title="Equivalent CLI for this SQL database" command={cliFromSql(state)} onClose={() => setShowCli(false)} /> : null}
    </div>
  );
}

function DtuTierPicker({ state, set }: { state: SqlWizardState; set: <K extends keyof SqlWizardState>(key: K, value: SqlWizardState[K]) => void }) {
  const tier = DTU_TIERS.find((t) => t.id === state.dtuTier) ?? DTU_TIERS[1];
  return (
    <>
      <div style={{ marginTop: 10 }}>
        {DTU_TIERS.map((t) => (
          <div
            key={t.id}
            className={`${styles.tierCard} ${state.dtuTier === t.id ? styles.tierCardActive : ""}`}
            onClick={() => set("dtuTier", t.id)}
          >
            <b>{t.label}</b> — up to {t.dtu} DTUs, {t.maxGB} GB
            <span style={{ float: "right" }}>${t.cost.toFixed(2)}/mo</span>
            <p className={styles.help}>{t.desc}</p>
          </div>
        ))}
      </div>
      <div className={styles.sliderRow}>
        <span>DTUs</span>
        <input type="range" min={5} max={tier.dtu} value={state.dtuValue} onChange={(e) => set("dtuValue", parseInt(e.target.value, 10))} />
        <span className="val">{state.dtuValue} DTU</span>
      </div>
      <div className={styles.sliderRow}>
        <span>Data max size (GB)</span>
        <input type="range" min={1} max={tier.maxGB} value={state.dtuMaxGB} onChange={(e) => set("dtuMaxGB", parseInt(e.target.value, 10))} />
        <span className="val">{state.dtuMaxGB} GB</span>
      </div>
    </>
  );
}

function VcoreTierPicker({ state, set }: { state: SqlWizardState; set: <K extends keyof SqlWizardState>(key: K, value: SqlWizardState[K]) => void }) {
  const hw = HARDWARE_FAMILIES.find((h) => h.id === state.hardwareFamily) ?? HARDWARE_FAMILIES[0];
  return (
    <>
      <div style={{ marginTop: 10 }}>
        {VCORE_TIERS.map((t) => (
          <div
            key={t.id}
            className={`${styles.tierCard} ${state.vcoreTier === t.id ? styles.tierCardActive : ""}`}
            onClick={() => set("vcoreTier", t.id)}
          >
            <b>{t.label}</b>
            <p className={styles.help}>{t.desc}</p>
          </div>
        ))}
      </div>
      <Field label="Compute tier">
        <RadioInline name="sqlComputeTier" value={state.computeTier} onChange={(v) => set("computeTier", v as "Provisioned" | "Serverless")} choices={["Provisioned", "Serverless"]} />
      </Field>
      <Field label="Hardware family" help={hw.desc}>
        <NativeSelect value={state.hardwareFamily} onChange={(v) => set("hardwareFamily", v as SqlWizardState["hardwareFamily"])}>
          {HARDWARE_FAMILIES.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className={styles.sliderRow}>
        <span>vCores</span>
        <input type="range" min={2} max={128} step={2} value={state.vCores} onChange={(e) => set("vCores", parseInt(e.target.value, 10))} />
        <span className="val">{state.vCores} vCore</span>
      </div>
      <div className={styles.sliderRow}>
        <span>Data max size (GB)</span>
        <input type="range" min={1} max={4096} value={state.dataMaxGB} onChange={(e) => set("dataMaxGB", parseInt(e.target.value, 10))} />
        <span className="val">{state.dataMaxGB} GB</span>
      </div>
    </>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
      <span>{k}</span>
      <span>
        <b>{v}</b>
      </span>
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
