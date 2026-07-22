"use client";

/*
 * Ported from itbd-lab/simulators/avd/js/avd-image-update-private.js
 * (AvdImageUpdatePrivate). The source covers three related "advanced /
 * reference" admin tools in one file: Custom Image Templates (a thin
 * AVD-specific wrapper around Azure VM Image Builder), Update Plans (the
 * newer agent-update rolling-refresh orchestration), and Private Link
 * (private endpoint configuration for the AVD control plane). The shell
 * (avd-shell.tsx) lists these as three separate nav pages
 * ("image-builder" | "update-plans" | "private-link"), so this file
 * exports ONE component, `ImageUpdatePrivatePage`, that takes a `view`
 * prop selecting which of the three sub-tools to render — callers wire
 * each of the three shell routes to the same component with a different
 * `view`. This mirrors the source's single `view` variable + `go(view)`
 * router inside one IIFE, just split across React props instead of DOM
 * mutation. The source's fourth internal tab, "Image build recipe", had
 * no independent nav entry in avd-shell.tsx, so it is folded into the
 * Image Builder view as a "Sample build recipe" reference section rather
 * than invented as a fourth top-level page.
 */

import { useState } from "react";
import { toast } from "sonner";

import type { AvdImageTemplate, AvdPrivateEndpoint, AvdState, AvdUpdatePlan } from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";

import styles from "./avd-console.module.css";
import { Callout, Checkbox, DataTable, EmptyState, Field, NativeSelect, PropPair, RadioInline, StatusBadge, WizardFooter } from "./avd-ui";

export type ImageUpdatePrivateView = "image-builder" | "update-plans" | "private-link";

// ─── Sample 14-step customization recipe (source: SAMPLE_CUSTOMIZATIONS) ───
// Static reference content — the source hardcodes this as illustrative of
// what an image build recipe contains; it isn't tied to any one template's
// live state, so it's reproduced as-is rather than invented per template.
const SAMPLE_CUSTOMIZATIONS: { step: number; type: string; desc: string }[] = [
  { step: 1, type: "WindowsRestart", desc: "Boot freshly cloned image" },
  { step: 2, type: "WindowsUpdate", desc: "Apply all critical + security updates (up to 40 KBs)" },
  { step: 3, type: "PowerShell", desc: "avd-optimize.ps1 — disable Cortana, Windows Search Service, fingerprint, etc." },
  { step: 4, type: "PowerShell", desc: "install-fslogix.ps1 — install latest FSLogix + configure profile container path" },
  { step: 5, type: "PowerShell", desc: "install-m365-apps.ps1 — install M365 Apps via ODT, shared activation" },
  { step: 6, type: "PowerShell", desc: "teams-vdi.ps1 — install Teams VDI version, WebRTC redirector, registry tweaks" },
  { step: 7, type: "PowerShell", desc: "install-onedrive.ps1 — per-machine OneDrive install + KFM redirect" },
  { step: 8, type: "PowerShell", desc: "mde-onboard.ps1 — onboard to Defender for Endpoint with ASR rules" },
  { step: 9, type: "PowerShell", desc: "cis-baseline.ps1 — CIS Level 1 hardening" },
  { step: 10, type: "PowerShell", desc: "install-corp-apps.ps1 — Genesys Cloud, ServiceNow chrome ext, Slack" },
  { step: 11, type: "WindowsUpdate", desc: "Re-apply updates installed during customization" },
  { step: 12, type: "WindowsRestart", desc: "Final reboot" },
  { step: 13, type: "PowerShell", desc: "sysprep + cleanup logs" },
  { step: 14, type: "distribute → SharedImage", desc: "Push to gal_corp_prod_eastus, replicate to EastUS, WestUS2, NorthEurope, CentralIndia, EastAsia" },
];

// Simulated build-history rows shown by "Run history" (source: openHistory).
// Fixed sample telemetry in the source — not derived from any live field.
const BUILD_HISTORY = [
  { ts: "2026-05-14 04:12", status: "Succeeded", duration: "52 min", version: "1.0.5", changes: "M365 Apps 16.0.18027.20140; FSLogix 2.9.8716.30441" },
  { ts: "2026-04-30 04:14", status: "Succeeded", duration: "54 min", version: "1.0.4", changes: "Windows 11 23H2 KB5037771; Teams 24074.1407" },
  { ts: "2026-04-16 04:11", status: "Succeeded", duration: "49 min", version: "1.0.3", changes: "M365 Apps update; CIS baseline v3.0" },
  { ts: "2026-04-02 04:18", status: "Failed", duration: "38 min", version: "—", changes: "Win Update KB5036893 hung — retried" },
  { ts: "2026-04-02 05:01", status: "Succeeded", duration: "52 min", version: "1.0.2", changes: "(retry of above)" },
];

const SOURCE_IMAGE_OPTIONS = [
  "Win11 23H2 multi-session",
  "Win11 23H2 (Personal)",
  "Win11 23H2 multi-session + M365 Apps",
  "Win Server 2022 Datacenter",
  "Custom from existing image version",
];

const IMAGE_SCHEDULE_OPTIONS = [
  "Manual only",
  "Daily 02:00 UTC",
  "Weekly Sun 02:00 UTC",
  "Bi-weekly Wed 02:00 UTC",
  "Monthly first Sun 02:00 UTC",
];

const UPDATE_PLAN_WINDOW_OPTIONS = [
  "Sunday 02:00 IST",
  "Sunday 02:00 UTC",
  "Saturday 22:00 IST",
  "Friday 23:00 PST",
  "Daily 02:00-04:00 UTC",
  "Manual only",
];

function newImageTemplateDraft(): {
  name: string;
  source: string;
  customs: string;
  dest: string;
  schedule: string;
  pools: string[];
} {
  return {
    name: "tpl-avd-new",
    source: "Win11 23H2 multi-session",
    customs: "M365 Apps,FSLogix,Teams VDI,Defender for Endpoint",
    dest: "gal_corp_prod_eastus",
    schedule: "Weekly Sun 02:00 UTC",
    pools: [],
  };
}

function newUpdatePlanDraft(): {
  name: string;
  hostPool: string;
  maintenance: string;
  maxConcurrent: number;
  drainTimeout: number;
  postValidation: boolean;
} {
  return {
    name: "up-prod-canary",
    hostPool: "",
    maintenance: "Sunday 02:00 IST",
    maxConcurrent: 2,
    drainTimeout: 30,
    postValidation: true,
  };
}

export function ImageUpdatePrivatePage({
  view,
  state,
  dispatch,
}: {
  view: ImageUpdatePrivateView;
  state: AvdState;
  dispatch: React.Dispatch<AvdAction>;
}) {
  if (view === "image-builder") return <ImageBuilderView state={state} dispatch={dispatch} />;
  if (view === "update-plans") return <UpdatePlansView state={state} dispatch={dispatch} />;
  return <PrivateLinkView state={state} dispatch={dispatch} />;
}

// ============================= Image Builder =============================

function ImageBuilderView({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [creating, setCreating] = useState(false);
  const [historyForId, setHistoryForId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState("");

  function handleRunBuild(tpl: AvdImageTemplate) {
    dispatch({ type: "RUN_IMAGE_BUILD", id: tpl.id });
    toast.success(`Build triggered for "${tpl.name}" — estimated 45-90 minutes, ~$0.50 per build.`);
  }

  function handleDelete(tpl: AvdImageTemplate) {
    if (!window.confirm(`Delete image template "${tpl.name}"? Existing image versions in the Compute Gallery are preserved.`)) return;
    dispatch({ type: "DELETE_IMAGE_TEMPLATE", id: tpl.id });
    toast.info(`Image template "${tpl.name}" deleted`);
  }

  function startEditSchedule(tpl: AvdImageTemplate) {
    setEditingScheduleId(tpl.id);
    setScheduleDraft(tpl.schedule);
  }

  function saveSchedule(tpl: AvdImageTemplate) {
    const value = scheduleDraft.trim();
    if (!value) return;
    dispatch({ type: "UPDATE_IMAGE_TEMPLATE", id: tpl.id, patch: { schedule: value } });
    toast.success(`Schedule updated for "${tpl.name}"`);
    setEditingScheduleId(null);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Custom Image Templates</h1>
      <p className={styles.help} style={{ marginBottom: 16 }}>
        AVD Custom Image Templates wrap Azure VM Image Builder for AVD scenarios. Auto-rebuild on schedule,
        auto-distribute to Compute Gallery, auto-update host pool reference.
      </p>

      <div className={styles.sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ border: "none", margin: 0, padding: 0 }}>Templates</h3>
          <button type="button" className={styles.btn} onClick={() => setCreating(true)}>
            + Create image template
          </button>
        </div>

        {state.imageTemplates.length === 0 ? (
          <EmptyState message='No image templates yet. Click "+ Create image template" to create one.' />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {state.imageTemplates.map((tpl) => (
              <div key={tpl.id} className={styles.card} style={{ padding: "12px 16px", borderLeft: "3px solid #5c2d91" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ color: "#5c2d91" }}>{tpl.name}</strong>
                  <StatusBadge status={tpl.status} />
                </div>
                <PropPair label="Source image" value={tpl.source} />
                <PropPair label="Customizations" value={tpl.customizations} />
                <PropPair
                  label="Last built"
                  value={tpl.lastBuilt === "Never" ? "Never" : `${new Date(tpl.lastBuilt).toLocaleString()} (${tpl.duration})`}
                />
                <PropPair label="Destination" value={`${tpl.destinationGallery} → ${tpl.destinationImage}`} />
                <PropPair
                  label="Schedule"
                  value={
                    editingScheduleId === tpl.id ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className={styles.input}
                          value={scheduleDraft}
                          onChange={(e) => setScheduleDraft(e.target.value)}
                          autoFocus
                        />
                        <button type="button" className={styles.btnOutline} onClick={() => saveSchedule(tpl)}>
                          Save
                        </button>
                        <button type="button" className={styles.link} onClick={() => setEditingScheduleId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      tpl.schedule
                    )
                  }
                />
                <PropPair label="Assigned host pools" value={tpl.assignedHostPools.join(", ") || "None"} />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button type="button" className={styles.btn} onClick={() => handleRunBuild(tpl)}>
                    Run build now
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => setHistoryForId(tpl.id)}>
                    Run history
                  </button>
                  {editingScheduleId !== tpl.id ? (
                    <button type="button" className={styles.btnOutline} onClick={() => startEditSchedule(tpl)}>
                      Edit schedule
                    </button>
                  ) : null}
                  <button type="button" className={styles.btnOutline} style={{ color: "#a4262c" }} onClick={() => handleDelete(tpl)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Callout tone="info">
          <strong>Why AVD-specific:</strong> Azure VM Image Builder works for any VM image. AVD Custom Image
          Templates is a thin wrapper that ALSO auto-updates the host pool&apos;s &quot;VM image reference&quot; +
          auto-publishes via Compute Gallery + supports session-host rolling refresh tied to Update Plans.
        </Callout>
      </div>

      <div className={styles.sectionCard}>
        <h3>Sample build recipe</h3>
        <p style={{ marginBottom: 12 }}>
          Sample 14-step recipe for an AVD multi-session image. Sequence matters — sysprep is the last step.
        </p>
        <DataTable columns={["Step", "Type", "Description"]}>
          {SAMPLE_CUSTOMIZATIONS.map((c) => (
            <tr key={c.step}>
              <td style={{ textAlign: "center", fontWeight: 600 }}>{c.step}</td>
              <td>
                <code style={{ background: "#f3f2f1", color: "#5c2d91", padding: "1px 6px", borderRadius: 3, fontFamily: "Consolas, monospace", fontSize: 11 }}>
                  {c.type}
                </code>
              </td>
              <td style={{ fontSize: 12 }}>{c.desc}</td>
            </tr>
          ))}
        </DataTable>
        <Callout tone="warn">
          <strong>Build VM size:</strong> Standard_D4s_v5 minimum (16 GB RAM). Smaller hits Windows Update timeouts.
          Build duration 45-90 min for multi-session. Cost: ~$0.50 per build run.
        </Callout>
      </div>

      {creating ? (
        <CreateImageTemplateWizard
          hostPoolNames={state.hostPools.map((p) => p.name)}
          onCancel={() => setCreating(false)}
          onFinish={(draft) => {
            const customsCount = draft.customs
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean).length;
            const template: AvdImageTemplate = {
              id: `img-tmpl-${crypto.randomUUID()}`,
              name: draft.name,
              source: draft.source,
              customizations: `${customsCount} steps: ${draft.customs}`,
              lastBuilt: "Never",
              duration: "—",
              status: "Not run",
              destinationGallery: draft.dest,
              destinationImage: draft.name.replace(/^tpl-/, "img-"),
              schedule: draft.schedule,
              assignedHostPools: draft.pools,
            };
            dispatch({ type: "ADD_IMAGE_TEMPLATE", template });
            toast.success(`Image template "${template.name}" created`);
            setCreating(false);
          }}
        />
      ) : null}

      {historyForId ? (
        <BuildHistoryPanel
          templateName={state.imageTemplates.find((t) => t.id === historyForId)?.name ?? ""}
          onClose={() => setHistoryForId(null)}
        />
      ) : null}
    </div>
  );
}

function CreateImageTemplateWizard({
  hostPoolNames,
  onCancel,
  onFinish,
}: {
  hostPoolNames: string[];
  onCancel: () => void;
  onFinish: (draft: ReturnType<typeof newImageTemplateDraft>) => void;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(newImageTemplateDraft);

  const totalSteps = 5;

  function togglePool(name: string) {
    setDraft((d) => ({
      ...d,
      pools: d.pools.includes(name) ? d.pools.filter((p) => p !== name) : [...d.pools, name],
    }));
  }

  return (
    <div className={styles.sectionCard} style={{ marginTop: 16 }}>
      <h3>Create image template — step {step} of {totalSteps}</h3>

      {step === 1 ? (
        <Field label="Template name" required>
          <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </Field>
      ) : null}

      {step === 2 ? (
        <Field label="Source image" required>
          <RadioInline name="itSrc" value={draft.source} onChange={(v) => setDraft((d) => ({ ...d, source: v }))} choices={SOURCE_IMAGE_OPTIONS} />
        </Field>
      ) : null}

      {step === 3 ? (
        <>
          <Field label="Customization steps" help='Comma-separated, e.g. "M365 Apps,FSLogix,Teams VDI,MDE"'>
            <textarea
              rows={3}
              className={styles.textarea}
              value={draft.customs}
              onChange={(e) => setDraft((d) => ({ ...d, customs: e.target.value }))}
            />
          </Field>
          <Callout tone="warn">
            Recipe runs in order: Windows Update → custom PowerShell scripts → final Windows Update → sysprep.
          </Callout>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Field label="Destination Compute Gallery" required>
            <input className={styles.input} value={draft.dest} onChange={(e) => setDraft((d) => ({ ...d, dest: e.target.value }))} />
          </Field>
          <Field label="Assign to host pools">
            {hostPoolNames.length === 0 ? (
              <p className={styles.help}>No host pools available yet. Create one in Host pools first.</p>
            ) : (
              <div className={styles.multiList}>
                {hostPoolNames.map((name) => (
                  <label key={name}>
                    <input type="checkbox" checked={draft.pools.includes(name)} onChange={() => togglePool(name)} /> {name}
                  </label>
                ))}
              </div>
            )}
          </Field>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Field label="Schedule">
            <NativeSelect value={draft.schedule} onChange={(v) => setDraft((d) => ({ ...d, schedule: v }))}>
              {IMAGE_SCHEDULE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className={styles.miniForm}>
            <h4>Summary</h4>
            <PropPair label="Name" value={draft.name} />
            <PropPair label="Source" value={draft.source} />
            <PropPair label="Customizations" value={draft.customs} />
            <PropPair label="Destination" value={draft.dest} />
            <PropPair label="Assigned pools" value={draft.pools.join(", ") || "None"} />
            <PropPair label="Schedule" value={draft.schedule} />
          </div>
        </>
      ) : null}

      <WizardFooter
        onCancel={onCancel}
        onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
        onNext={() => (step < totalSteps ? setStep((s) => s + 1) : onFinish(draft))}
        nextLabel={step < totalSteps ? "Next" : "Create template"}
      />
    </div>
  );
}

function BuildHistoryPanel({ templateName, onClose }: { templateName: string; onClose: () => void }) {
  return (
    <div className={styles.sectionCard} style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>Build history — {templateName}</h3>
        <button type="button" className={styles.actBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <DataTable columns={["Timestamp", "Status", "Duration", "Version", "Changes"]}>
        {BUILD_HISTORY.map((r, i) => (
          <tr key={i}>
            <td>{r.ts}</td>
            <td style={{ color: r.status === "Succeeded" ? "#0e700e" : "#a4262c", fontWeight: 600 }}>{r.status}</td>
            <td>{r.duration}</td>
            <td>
              <code>{r.version}</code>
            </td>
            <td style={{ fontSize: 11 }}>{r.changes}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

// ============================= Update Plans =============================

const LIFECYCLE_STEPS = [
  "1. Set drain mode on host (no new sessions accepted)",
  '2. Notify active users: "Save your work — log off in 30 min"',
  "3. Wait grace period (configurable)",
  "4. Force log off remaining sessions",
  "5. Stop VM (deallocate)",
  "6. Update VM disk to new image version (from Compute Gallery)",
  "7. Start VM",
  "8. Wait for AVD agent + RDS health check to pass",
  "9. Run post-update validation script (optional)",
  "10. Remove drain mode — host returns to active pool",
  "11. Wait (stagger interval) — move to next host",
];

function UpdatePlansView({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [creating, setCreating] = useState(false);

  function handleRunNow(plan: AvdUpdatePlan) {
    if (
      !window.confirm(
        `Trigger update plan "${plan.name}" now?\n\nThis will start the rolling refresh of ${plan.hosts} host(s).\nUsers will see drain warnings 30 min before their session host updates.`,
      )
    )
      return;
    dispatch({ type: "RUN_UPDATE_PLAN", id: plan.id });
    toast.success(`Update plan "${plan.name}" running`);
  }

  function handleDelete(plan: AvdUpdatePlan) {
    if (!window.confirm(`Delete update plan "${plan.name}"? Any running rollout will continue.`)) return;
    dispatch({ type: "DELETE_UPDATE_PLAN", id: plan.id });
    toast.info(`Update plan "${plan.name}" deleted`);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Update Plans (new)</h1>
      <p className={styles.help} style={{ marginBottom: 16 }}>
        New AVD Agent Update Plans orchestrate rolling session-host refresh. Drains user sessions → updates →
        reboots → returns to pool.
      </p>

      <div className={styles.sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ border: "none", margin: 0, padding: 0 }}>Plans</h3>
          <button type="button" className={styles.btn} onClick={() => setCreating(true)}>
            + Create update plan
          </button>
        </div>

        {state.updatePlans.length === 0 ? (
          <EmptyState message='No update plans yet. Click "+ Create update plan" to create one.' />
        ) : (
          <DataTable columns={["Update plan", "Host pool", "Stage", "Schedule", "Hosts", "Status", "Last run", ""]}>
            {state.updatePlans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong>{plan.name}</strong>
                </td>
                <td>{plan.hostPool}</td>
                <td>{plan.stage}</td>
                <td style={{ fontSize: 11 }}>{plan.schedule}</td>
                <td style={{ textAlign: "right" }}>{plan.hosts}</td>
                <td>
                  <StatusBadge status={plan.status} />
                </td>
                <td style={{ fontSize: 11 }}>
                  {plan.lastRun === "Never" ? "Never" : new Date(plan.lastRun).toLocaleString()}
                </td>
                <td>
                  <button type="button" className={styles.link} onClick={() => handleRunNow(plan)}>
                    Run now
                  </button>{" "}
                  <button type="button" className={styles.link} style={{ color: "#a4262c" }} onClick={() => handleDelete(plan)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <div className={styles.sectionCard}>
        <h3>Rolling-update lifecycle per host</h3>
        <pre
          style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: "14px 18px",
            borderRadius: 6,
            fontFamily: "Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {LIFECYCLE_STEPS.join("\n")}
        </pre>
        <Callout tone="info">
          <strong>Replaces:</strong> the old manual &quot;drain, snapshot, image-swap&quot; process. Update Plans
          makes it native AVD ops — one click in portal or one PowerShell cmdlet kicks off the whole rolling refresh.
        </Callout>
      </div>

      {creating ? (
        <CreateUpdatePlanWizard
          hostPools={state.hostPools.map((p) => ({ name: p.name, type: p.type }))}
          onCancel={() => setCreating(false)}
          onFinish={(draft) => {
            const plan: AvdUpdatePlan = {
              id: `upd-plan-${crypto.randomUUID()}`,
              name: draft.name,
              hostPool: draft.hostPool || "(unassigned)",
              stage: `Rolling ${draft.maxConcurrent} at a time`,
              schedule: draft.maintenance,
              hosts: 0,
              status: "Not started",
              lastRun: "Never",
            };
            dispatch({ type: "ADD_UPDATE_PLAN", plan });
            toast.success(`Update plan "${plan.name}" created`);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateUpdatePlanWizard({
  hostPools,
  onCancel,
  onFinish,
}: {
  hostPools: { name: string; type: string }[];
  onCancel: () => void;
  onFinish: (draft: ReturnType<typeof newUpdatePlanDraft>) => void;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(newUpdatePlanDraft);

  const totalSteps = 4;

  return (
    <div className={styles.sectionCard} style={{ marginTop: 16 }}>
      <h3>Create update plan — step {step} of {totalSteps}</h3>

      {step === 1 ? (
        <Field label="Plan name" required>
          <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </Field>
      ) : null}

      {step === 2 ? (
        <Field label="Target host pool">
          {hostPools.length === 0 ? (
            <p className={styles.help}>No host pools available. Create one first.</p>
          ) : (
            <RadioInline
              name="upPool"
              value={draft.hostPool}
              onChange={(v) => setDraft((d) => ({ ...d, hostPool: v }))}
              choices={hostPools.map((p) => p.name)}
            />
          )}
        </Field>
      ) : null}

      {step === 3 ? (
        <>
          <Field label="Maintenance window">
            <NativeSelect value={draft.maintenance} onChange={(v) => setDraft((d) => ({ ...d, maintenance: v }))}>
              {UPDATE_PLAN_WINDOW_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Max concurrent hosts">
            <input
              type="number"
              min={1}
              max={20}
              className={styles.input}
              value={draft.maxConcurrent}
              onChange={(e) => setDraft((d) => ({ ...d, maxConcurrent: parseInt(e.target.value, 10) || 1 }))}
            />
          </Field>
          <Field label="Drain timeout (minutes)">
            <input
              type="number"
              min={5}
              max={240}
              className={styles.input}
              value={draft.drainTimeout}
              onChange={(e) => setDraft((d) => ({ ...d, drainTimeout: parseInt(e.target.value, 10) || 30 }))}
            />
          </Field>
          <Checkbox
            label="Run post-update validation script (recommended)"
            checked={draft.postValidation}
            onChange={(v) => setDraft((d) => ({ ...d, postValidation: v }))}
          />
        </>
      ) : null}

      {step === 4 ? (
        <div className={styles.miniForm}>
          <h4>Summary</h4>
          <PropPair label="Name" value={draft.name} />
          <PropPair label="Host pool" value={draft.hostPool || "(not selected)"} />
          <PropPair label="Window" value={draft.maintenance} />
          <PropPair label="Max concurrent" value={`${draft.maxConcurrent} hosts`} />
          <PropPair label="Drain timeout" value={`${draft.drainTimeout} min`} />
          <PropPair label="Post-update validation" value={draft.postValidation ? "Yes" : "No"} />
        </div>
      ) : null}

      <WizardFooter
        onCancel={onCancel}
        onBack={step > 1 ? () => setStep((s) => s - 1) : undefined}
        onNext={() => (step < totalSteps ? setStep((s) => s + 1) : onFinish(draft))}
        nextLabel={step < totalSteps ? "Next" : "Create plan"}
      />
    </div>
  );
}

// ============================= Private Link =============================

const PRIVATE_DNS_ZONE_OPTIONS = ["privatelink.wvd.microsoft.com", "privatelink-global.wvd.microsoft.com"];

function newPrivateEndpointDraft(): {
  resource: string;
  subResource: AvdPrivateEndpoint["subResource"];
  name: string;
  vnet: string;
  subnet: string;
  privateDnsZone: string;
} {
  return {
    resource: "",
    subResource: "connection",
    name: "",
    vnet: "",
    subnet: "",
    privateDnsZone: PRIVATE_DNS_ZONE_OPTIONS[0],
  };
}

const SUB_RESOURCE_ORDER: Record<AvdPrivateEndpoint["subResource"], string> = {
  global: "1. FIRST (singleton per tenant)",
  feed: "2. Per workspace",
  connection: "3. Per host pool (data plane)",
};

function PrivateLinkView({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(newPrivateEndpointDraft);

  function handleDelete(pe: AvdPrivateEndpoint) {
    if (!window.confirm(`Delete private endpoint "${pe.name}"?`)) return;
    dispatch({ type: "DELETE_PRIVATE_ENDPOINT", id: pe.id });
    toast.info(`Private endpoint "${pe.name}" deleted`);
  }

  function handleCreate() {
    if (!draft.resource.trim() || !draft.name.trim()) {
      toast.error("Resource and private endpoint name are required");
      return;
    }
    const endpoint: AvdPrivateEndpoint = {
      id: `pe-${crypto.randomUUID()}`,
      resource: draft.resource,
      subResource: draft.subResource,
      name: draft.name,
      vnet: draft.vnet,
      subnet: draft.subnet,
      privateDnsZone: draft.privateDnsZone,
      approvalStatus: "Pending",
    };
    dispatch({ type: "ADD_PRIVATE_ENDPOINT", endpoint });
    toast.success(`Private endpoint "${endpoint.name}" created`);
    setCreating(false);
    setDraft(newPrivateEndpointDraft());
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Private Link</h1>
      <p className={styles.help} style={{ marginBottom: 16 }}>
        AVD Private Link eliminates all public DNS lookups for the AVD control plane. Three sub-resource types —
        order of deployment matters.
      </p>

      <div className={styles.sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ border: "none", margin: 0, padding: 0 }}>Private endpoints</h3>
          <button type="button" className={styles.btn} onClick={() => setCreating(true)}>
            + Create private endpoint
          </button>
        </div>

        {state.privateEndpoints.length === 0 ? (
          <EmptyState message='No private endpoints configured yet. Click "+ Create private endpoint" to add one.' />
        ) : (
          <DataTable columns={["Resource", "Sub-resource", "Private endpoint", "VNet / subnet", "Private DNS zone", "Deploy order", "Approval", ""]}>
            {state.privateEndpoints.map((pe) => (
              <tr key={pe.id}>
                <td style={{ fontSize: 11 }}>{pe.resource}</td>
                <td>
                  <code style={{ background: "#f3f2f1", color: "#5c2d91", padding: "1px 6px", borderRadius: 3, fontFamily: "Consolas, monospace", fontSize: 11 }}>
                    {pe.subResource}
                  </code>
                </td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{pe.name}</td>
                <td style={{ fontSize: 11 }}>
                  {pe.vnet}
                  {pe.subnet ? ` / ${pe.subnet}` : ""}
                </td>
                <td style={{ fontFamily: "Consolas, monospace", fontSize: 11 }}>{pe.privateDnsZone}</td>
                <td style={{ fontSize: 11, fontWeight: 600 }}>{SUB_RESOURCE_ORDER[pe.subResource]}</td>
                <td>
                  <StatusBadge status={pe.approvalStatus === "Approved" ? "Succeeded" : pe.approvalStatus === "Rejected" ? "Failed" : "Not started"} />
                </td>
                <td>
                  <button type="button" className={styles.link} style={{ color: "#a4262c" }} onClick={() => handleDelete(pe)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {creating ? (
        <div className={styles.sectionCard}>
          <h3>Create private endpoint</h3>
          <Field label="Resource" required help='e.g. "Host pool hp-prod-pooled" or "Workspace - feed (ws-prod)"'>
            <input className={styles.input} value={draft.resource} onChange={(e) => setDraft((d) => ({ ...d, resource: e.target.value }))} />
          </Field>
          <Field label="Sub-resource" required>
            <NativeSelect value={draft.subResource} onChange={(v) => setDraft((d) => ({ ...d, subResource: v as AvdPrivateEndpoint["subResource"] }))}>
              <option value="global">global</option>
              <option value="feed">feed</option>
              <option value="connection">connection</option>
            </NativeSelect>
          </Field>
          <Field label="Private endpoint name" required help="e.g. pe-avd-hp-prod-pooled-conn">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </Field>
          <Field label="VNet">
            <input className={styles.input} value={draft.vnet} onChange={(e) => setDraft((d) => ({ ...d, vnet: e.target.value }))} placeholder="e.g. vnet-spoke-avd" />
          </Field>
          <Field label="Subnet">
            <input className={styles.input} value={draft.subnet} onChange={(e) => setDraft((d) => ({ ...d, subnet: e.target.value }))} placeholder="e.g. snet-avd-hosts" />
          </Field>
          <Field label="Private DNS zone" required>
            <NativeSelect value={draft.privateDnsZone} onChange={(v) => setDraft((d) => ({ ...d, privateDnsZone: v }))}>
              {PRIVATE_DNS_ZONE_OPTIONS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className={styles.btn} onClick={handleCreate}>
              Create
            </button>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => {
                setCreating(false);
                setDraft(newPrivateEndpointDraft());
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.sectionCard}>
        <h3>Required Private DNS zones</h3>
        <ul style={{ fontFamily: "Consolas, monospace", fontSize: 12, color: "#323130", lineHeight: 1.7, paddingLeft: 20 }}>
          <li>
            <strong>privatelink.wvd.microsoft.com</strong> — for workspace feed + host pool connection
          </li>
          <li>
            <strong>privatelink-global.wvd.microsoft.com</strong> — for global tenant-wide discovery
          </li>
        </ul>
      </div>

      <div className={styles.sectionCard}>
        <h3>PowerShell deployment</h3>
        <pre
          style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: "12px 16px",
            borderRadius: 3,
            fontFamily: "Consolas, monospace",
            fontSize: 11,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
{`# 1. Create Private DNS zones
New-AzPrivateDnsZone -Name "privatelink-global.wvd.microsoft.com" -ResourceGroupName rg-dns
New-AzPrivateDnsZone -Name "privatelink.wvd.microsoft.com" -ResourceGroupName rg-dns

# 2. Link zones to VNet
New-AzPrivateDnsVirtualNetworkLink -ResourceGroupName rg-dns -ZoneName privatelink-global.wvd.microsoft.com -Name link-hub -VirtualNetworkId $vnetId

# 3. Create Global private endpoint FIRST (one per tenant)
$global = Get-AzResource -ResourceType "Microsoft.DesktopVirtualization/scalingplans" ... # need workspace global resource
New-AzPrivateEndpoint -Name pe-avd-global -ResourceGroupName rg-net -Subnet $subnet -PrivateLinkServiceConnection (New-AzPrivateLinkServiceConnection -Name conn -PrivateLinkServiceId $globalId -GroupId global)

# 4. Then per-workspace feed + per-host pool connection PEs`}
        </pre>
        <Callout tone="warn">
          <strong>Reverse order to delete:</strong> Delete <code>connection</code> PEs first, then <code>feed</code>{" "}
          PEs, then <code>global</code> PE last. Removing Global while feeds still depend on it leaves orphaned DNS
          that takes 7+ days to clean up.
        </Callout>
      </div>
    </div>
  );
}
