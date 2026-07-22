"use client";

import { useMemo, useState } from "react";

import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import type { NsgResource } from "@/lib/labs/simulators/azure/nsgTypes";
import {
  freshNsgWizardState,
  validateNsgWizardState,
  type NsgWizardState,
} from "@/lib/labs/simulators/azure/nsgWizardState";
import styles from "./azure-portal.module.css";
import { cliFromNsg } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Field, NativeSelect, ResourceGroupField, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function NsgCreateWizard({
  resourceGroups,
  onCancel,
  onCreate,
  onCreateResourceGroup,
}: {
  resourceGroups: string[];
  onCancel: () => void;
  onCreate: (resource: NsgResource) => void;
  onCreateResourceGroup: (name: string) => void;
}) {
  const [state, setState] = useState<NsgWizardState>(freshNsgWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof NsgWizardState>(key: K, value: NsgWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const validationErrors = useMemo(() => validateNsgWizardState(state), [state]);

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const resource: NsgResource = {
      id: crypto.randomUUID(),
      resourceType: "NetworkSecurityGroup",
      name: state.nsgName,
      resourceGroup: state.resourceGroup,
      region: state.region,
      estimatedCost: 0,
      inboundRules: [],
      outboundRules: [],
      associatedSubnets: [],
      associatedNICs: [],
      tags: state.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
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
              sub="Select the subscription to manage deployed resources and costs."
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
            <Field label="Name" required>
              <input
                value={state.nsgName}
                onChange={(e) => set("nsgName", e.target.value)}
                placeholder="e.g., nsg-web-tier"
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

            <Callout tone="info">
              A network security group (NSG) contains a list of security rules that allow or deny inbound
              or outbound network traffic to/from several types of Azure resources.
            </Callout>
          </>
        )}

        {activeTab === "tags" && (
          <>
            <SectionHeader
              title="Tags"
              sub="Tags are name/value pairs that enable you to categorize resources and view consolidated billing."
            />
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
            <div className={styles.sectionCard}>
              <h3>Basics</h3>
              {[
                ["Resource group", state.resourceGroup || "— not selected —"],
                ["Name", state.nsgName || "— not set —"],
                ["Region", state.region],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span style={{ color: "#605e5c", fontWeight: 600 }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <Callout tone="info">
              After creation, you can add inbound and outbound security rules from the resource detail page.
            </Callout>
          </>
        )}
      </div>
      {showCli ? <CliPanel title="Equivalent CLI for this NSG" command={cliFromNsg(state)} onClose={() => setShowCli(false)} /> : null}

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
    </div>
  );
}
