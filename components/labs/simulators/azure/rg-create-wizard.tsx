"use client";

import { useMemo, useState } from "react";

import { REGIONS } from "@/lib/labs/simulators/azure/vmData";
import type { RgResource } from "@/lib/labs/simulators/azure/rgTypes";
import {
  freshRgWizardState,
  validateRgWizardState,
  type RgWizardState,
} from "@/lib/labs/simulators/azure/rgWizardState";
import styles from "./azure-portal.module.css";
import { cliFromRg } from "@/lib/labs/simulators/azure/cliTranslator";
import { CliPanel } from "./cli-panel";
import { Callout, Field, NativeSelect, SectionHeader } from "./wizard-fields";

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RgCreateWizard({
  existingNames,
  onCancel,
  onCreate,
}: {
  existingNames: string[];
  onCancel: () => void;
  onCreate: (resource: RgResource) => void;
}) {
  const [state, setState] = useState<RgWizardState>(freshRgWizardState());
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [showCli, setShowCli] = useState(false);
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function set<K extends keyof RgWizardState>(key: K, value: RgWizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  const validationErrors = useMemo(
    () => validateRgWizardState(state, existingNames),
    [state, existingNames],
  );

  function commit() {
    if (validationErrors.length > 0) {
      setActiveTab("review");
      return;
    }
    const resource: RgResource = {
      id: crypto.randomUUID(),
      resourceType: "ResourceGroup",
      name: state.name,
      resourceGroup: state.name,
      region: state.region,
      status: "Succeeded",
      estimatedCost: 0,
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
              sub="Subscriptions hold the costs of your resources. Use resource groups like folders to organize and manage all your resources."
            />
            <Field label="Subscription" required>
              <NativeSelect value="CloudLab-Training-Sub" onChange={() => {}}>
                <option>CloudLab-Training-Sub</option>
              </NativeSelect>
            </Field>
            <SectionHeader title="Resource details" />
            <Field
              label="Resource group"
              required
              help="Must be 1-90 characters, alphanumeric, period, underscore, and hyphen only."
            >
              <input
                value={state.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g., rg-project-prod"
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

        {activeTab === "tags" && (
          <>
            <SectionHeader
              title="Tags"
              sub="Tags are name/value pairs that enable you to categorize resources and view consolidated billing."
            />
            <Callout tone="info">
              Tags applied to a resource group are <b>not</b> inherited by the resources within it.
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
              <h3>Basics</h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "#605e5c", fontWeight: 600 }}>Resource group</span>
                <span>{state.name || "— not set —"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "#605e5c", fontWeight: 600 }}>Region</span>
                <span>{state.region}</span>
              </div>
            </div>
          </>
        )}
      </div>
      {showCli ? <CliPanel title="Equivalent CLI for this resource group" command={cliFromRg(state)} onClose={() => setShowCli(false)} /> : null}

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
