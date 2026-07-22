"use client";

import { useMemo, useState } from "react";

import {
  APP_INSIGHTS_COST,
  APP_SERVICE_PLANS,
  APP_SERVICE_STACKS,
  isStandardOrBetter,
  parsePlanCost,
} from "@/lib/labs/simulators/azure/appServiceData";
import type { AppServiceResource } from "@/lib/labs/simulators/azure/appServiceTypes";
import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import {
  freshAppServiceWizardState,
  validateAppServiceWizardState,
  type AppServiceWizardState,
} from "@/lib/labs/simulators/azure/appServiceWizardState";
import styles from "./azure-portal.module.css";
import { cliFromAppService } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Checkbox, Field, NativeSelect, RadioInline, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "deployment", label: "Deployment" },
  { id: "networking", label: "Networking" },
  { id: "monitoring", label: "Monitoring" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppServiceCreateWizard({
  resourceGroups,
  virtualNetworks,
  onCancel,
  onCreate,
  onCreateResourceGroup,
}: {
  resourceGroups: string[];
  virtualNetworks: string[];
  onCancel: () => void;
  onCreate: (resource: AppServiceResource) => void;
  onCreateResourceGroup: (name: string) => void;
}) {
  const [state, setState] = useState<AppServiceWizardState>(freshAppServiceWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof AppServiceWizardState>(key: K, value: AppServiceWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setPlan(planName: string) {
    setState((s) => {
      const next = { ...s, [s.operatingSystem === "Linux" ? "linuxPlan" : "windowsPlan"]: planName };
      if (planName.includes("F1")) next.planTier = "F1";
      else if (planName.includes("B1")) next.planTier = "B1";
      else if (planName.includes("S1")) next.planTier = "S1";
      else if (planName.includes("P1v3")) next.planTier = "P1v3";
      if (next.planTier === "F1" || next.planTier === "B1") next.zoneRedundancy = false;
      return next;
    });
  }

  const validationErrors = useMemo(() => validateAppServiceWizardState(state), [state]);
  const isLinux = state.operatingSystem === "Linux";
  const currentPlan = isLinux ? state.linuxPlan : state.windowsPlan;

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const resource: AppServiceResource = {
      id: crypto.randomUUID(),
      resourceType: "AppService",
      name: state.appName,
      resourceGroup: state.resourceGroup,
      region: state.region,
      status: "Running",
      publish: state.publish,
      runtimeStack: state.runtimeStack,
      operatingSystem: state.operatingSystem,
      appServicePlan: currentPlan,
      planTier: state.planTier,
      defaultUrl: `https://${state.appName}.azurewebsites.net`,
      estimatedCost: parsePlanCost(APP_SERVICE_PLANS.find((p) => p.name === currentPlan)?.cost ?? "Free"),
      appSettings: {},
      connectionStrings: [],
      customDomains: [],
      corsOrigins: [],
      publicAccess: state.publicAccess === "On",
      appInsights: state.enableAppInsights === "Yes",
      basicAuthEnabled: state.basicAuth === "Enable",
      zoneRedundancy: state.zoneRedundancy,
      instances: 1,
      slots: [],
      continuousDeployment: state.continuousDeployment === "Enable",
      cdProvider: state.cdProvider,
      cdRepo: `${state.cdOrg}/${state.cdRepo}`,
      cdBranch: state.cdBranch,
      vnetIntegration: state.networkInjection === "Virtual network" ? state.vnet : null,
      tags: state.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
    };
    onCreate(resource);
  }

  const planCost = parsePlanCost(APP_SERVICE_PLANS.find((p) => p.name === currentPlan)?.cost ?? "Free");
  const aiCost = state.enableAppInsights === "Yes" ? APP_INSIGHTS_COST : 0;

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
            <SectionHeader title="Project Details" sub="Select a subscription and resource group to manage this app." />
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

            <SectionHeader title="Instance Details" />
            <Field label="Name" required help={`URL: https://${state.appName || "<name>"}.azurewebsites.net`}>
              <input
                value={state.appName}
                onChange={(e) => set("appName", e.target.value)}
                placeholder="e.g., mywebapp"
                className={styles.input}
              />
            </Field>
            <Field label="Publish">
              <RadioInline
                name="publish"
                value={state.publish}
                onChange={(v) => set("publish", v as AppServiceWizardState["publish"])}
                choices={["Code", "Container", "Static Web App"]}
              />
            </Field>
            {state.publish === "Code" ? (
              <Field label="Runtime stack" required>
                <NativeSelect value={state.runtimeStack} onChange={(v) => set("runtimeStack", v)}>
                  {APP_SERVICE_STACKS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <Callout tone="info">
                {state.publish === "Container"
                  ? "Container publish mode lets you deploy a Docker image from a registry. Image selection happens on the Deployment tab."
                  : "Static Web App pairs a globally hosted static site with serverless APIs. Source repository selection happens on the Deployment tab."}
              </Callout>
            )}
            <Field label="Operating System">
              <RadioInline
                name="operatingSystem"
                value={state.operatingSystem}
                onChange={(v) => set("operatingSystem", v as AppServiceWizardState["operatingSystem"])}
                choices={["Linux", "Windows"]}
              />
            </Field>
            <Field label="Region" required help="Not finding your App Service Plan? Try a different region.">
              <NativeSelect value={state.region} onChange={(v) => set("region", v)}>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
            </Field>

            <SectionHeader
              title="Pricing plans"
              sub="App Service plan pricing tier determines the location, features, cost, and compute resources."
            />
            <Field label={`${isLinux ? "Linux" : "Windows"} Plan (${state.region})`} required>
              <NativeSelect value={currentPlan} onChange={setPlan}>
                {APP_SERVICE_PLANS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.cores} core(s), {p.ram}, {p.cost})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Checkbox
              label="Enable zone redundancy"
              checked={state.zoneRedundancy}
              onChange={(v) => set("zoneRedundancy", v)}
              help={
                isStandardOrBetter(state.planTier)
                  ? "Distribute instances across availability zones for high availability."
                  : "Zone redundancy is only available for Standard or Premium plans."
              }
            />
          </>
        )}

        {activeTab === "deployment" && (
          <>
            <SectionHeader
              title="GitHub Actions settings"
              sub="Configure continuous deployment from a source control repository so new commits automatically build and deploy."
            />
            <Field label="Continuous deployment">
              <RadioInline
                name="continuousDeployment"
                value={state.continuousDeployment}
                onChange={(v) => set("continuousDeployment", v as AppServiceWizardState["continuousDeployment"])}
                choices={["Disable", "Enable"]}
              />
            </Field>
            {state.continuousDeployment === "Enable" ? (
              <>
                <SectionHeader title="GitHub / DevOps / Bitbucket settings" sub="Configure source control for continuous deployment." />
                <Field label="Provider">
                  <RadioInline
                    name="cdProvider"
                    value={state.cdProvider}
                    onChange={(v) => set("cdProvider", v as AppServiceWizardState["cdProvider"])}
                    choices={["GitHub", "Azure DevOps", "Bitbucket"]}
                  />
                </Field>
                <Field label="Organization">
                  <input
                    value={state.cdOrg}
                    onChange={(e) => set("cdOrg", e.target.value)}
                    placeholder="org-name"
                    className={styles.input}
                  />
                </Field>
                <Field label="Repository">
                  <input
                    value={state.cdRepo}
                    onChange={(e) => set("cdRepo", e.target.value)}
                    placeholder="repository-name"
                    className={styles.input}
                  />
                </Field>
                <Field label="Branch">
                  <input
                    value={state.cdBranch}
                    onChange={(e) => set("cdBranch", e.target.value)}
                    placeholder="main"
                    className={styles.input}
                  />
                </Field>
              </>
            ) : (
              <Callout tone="info">
                Continuous deployment is disabled. You can enable it later in the Deployment Center after
                creating the app.
              </Callout>
            )}

            <SectionHeader
              title="Basic authentication"
              sub="Basic authentication enables publishing profiles for legacy clients. Microsoft Entra ID is recommended."
            />
            <Field label="Basic authentication">
              <RadioInline
                name="basicAuth"
                value={state.basicAuth}
                onChange={(v) => set("basicAuth", v as AppServiceWizardState["basicAuth"])}
                choices={["Enable", "Disable"]}
              />
            </Field>
            <Callout tone={state.basicAuth === "Disable" ? "info" : "warn"}>
              {state.basicAuth === "Disable"
                ? "When disabled, publishing profiles and FTP/WebDeploy clients must use Microsoft Entra ID."
                : "Basic authentication is less secure. Consider Microsoft Entra ID for production."}
            </Callout>
          </>
        )}

        {activeTab === "networking" && (
          <>
            <SectionHeader
              title="Network Injection"
              sub="You can give your app network injection by integrating into a virtual network. This will allow your app to make outbound calls to private resources."
            />
            <Field label="Enable public access">
              <RadioInline
                name="publicAccess"
                value={state.publicAccess}
                onChange={(v) => set("publicAccess", v as AppServiceWizardState["publicAccess"])}
                choices={["On", "Off"]}
              />
            </Field>
            <Callout tone="info">
              {state.publicAccess === "Off"
                ? "When public access is off, your app is only reachable through private endpoints."
                : "Public access allows the app to be reached over the internet at its azurewebsites.net URL."}
            </Callout>
            <Field label="Enable network injection">
              <RadioInline
                name="networkInjection"
                value={state.networkInjection}
                onChange={(v) => set("networkInjection", v as AppServiceWizardState["networkInjection"])}
                choices={["Off", "Virtual network"]}
              />
            </Field>
            {state.networkInjection === "Virtual network" ? (
              <>
                <Field label="Virtual network" required>
                  <NativeSelect value={state.vnet} onChange={(v) => set("vnet", v)}>
                    <option value="">(no virtual networks — create one first)</option>
                    {virtualNetworks.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Subnet" required>
                  <NativeSelect value={state.subnet} onChange={(v) => set("subnet", v)}>
                    <option value="">(create new) appservice-subnet (10.0.2.0/24)</option>
                    <option value="default">default (10.0.0.0/24)</option>
                  </NativeSelect>
                </Field>
                <Checkbox
                  label="Enable outbound access via VNet integration"
                  checked={state.outboundVnetIntegration}
                  onChange={(v) => set("outboundVnetIntegration", v)}
                  help="Route all outbound traffic from the app through the selected virtual network."
                />
              </>
            ) : (
              <p style={{ fontSize: 12, color: "#605e5c" }}>
                Without network injection, the app reaches Azure services and the internet through the
                shared App Service outbound IPs.
              </p>
            )}
          </>
        )}

        {activeTab === "monitoring" && (
          <>
            <SectionHeader
              title="Application Insights"
              sub="Application Insights provides application performance management and instant analytics on your live web applications."
            />
            <Field label="Enable Application Insights">
              <RadioInline
                name="enableAppInsights"
                value={state.enableAppInsights}
                onChange={(v) => set("enableAppInsights", v as AppServiceWizardState["enableAppInsights"])}
                choices={["Yes", "No"]}
              />
            </Field>
            {state.enableAppInsights === "Yes" ? (
              <>
                <Field label="Region">
                  <NativeSelect value={state.appInsightsRegion} onChange={(v) => set("appInsightsRegion", v)}>
                    {REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Log Analytics Workspace name">
                  <input
                    value={state.appInsightsWorkspace}
                    onChange={(e) => set("appInsightsWorkspace", e.target.value)}
                    placeholder="DefaultWorkspace"
                    className={styles.input}
                  />
                </Field>
                <Callout tone="info">
                  Application Insights collects telemetry from your app: page views, performance,
                  exceptions, and dependencies. Estimated cost: ${APP_INSIGHTS_COST.toFixed(2)}/month.
                </Callout>
              </>
            ) : (
              <Callout tone="warn">Without Application Insights, diagnostic and performance data will be limited.</Callout>
            )}
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader title="Tags" sub="Tags are name/value pairs that enable you to categorize resources." />
            <Callout tone="info">Tags applied here will be applied to the App Service and its associated App Service plan.</Callout>
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
              <h3>Pricing estimate</h3>
              <ReviewRow label={`App Service plan (${currentPlan})`} value={`$${planCost.toFixed(2)}/month`} />
              {state.enableAppInsights === "Yes" ? (
                <ReviewRow label="Application Insights" value={`$${aiCost.toFixed(2)}/month`} />
              ) : null}
              <div style={{ borderTop: "1px solid #edebe9", paddingTop: 8, marginTop: 8 }}>
                <ReviewRow label="Estimated total" value={`$${(planCost + aiCost).toFixed(2)}/month (USD)`} bold />
              </div>
            </div>
            <ReviewSection
              title="Basics"
              rows={[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Name", state.appName || "— not set —"],
                ["Publish", state.publish],
                ["Runtime stack", state.publish === "Code" ? state.runtimeStack : "—"],
                ["Operating system", state.operatingSystem],
                ["Region", state.region],
                ["App Service plan", currentPlan],
                ["Zone redundancy", state.zoneRedundancy ? "Enabled" : "Disabled"],
              ]}
            />
            <ReviewSection
              title="Deployment"
              rows={[
                ["Continuous deployment", state.continuousDeployment],
                ["Provider", state.continuousDeployment === "Enable" ? state.cdProvider : "—"],
                ["Repository", state.continuousDeployment === "Enable" ? `${state.cdOrg}/${state.cdRepo}` : "—"],
                ["Basic authentication", state.basicAuth],
              ]}
            />
            <ReviewSection
              title="Networking"
              rows={[
                ["Enable public access", state.publicAccess],
                ["Network injection", state.networkInjection],
              ]}
            />
            <ReviewSection
              title="Monitoring"
              rows={[["Application Insights", state.enableAppInsights]]}
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
      {showCli ? <CliPanel title="Equivalent CLI for this App Service" command={cliFromAppService(state)} onClose={() => setShowCli(false)} /> : null}
    </div>
  );
}

function ReviewRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{value}</span>
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
