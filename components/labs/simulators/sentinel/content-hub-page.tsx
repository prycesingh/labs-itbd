"use client";

// Content Hub — ported from itbd-lab/simulators/sentinel/js/sentinel-content-hub.js.
// 12-solution catalog (rules/workbooks/playbooks/hunting-queries bundles) with a
// genuine 3-step Install wizard (Workspace -> Components -> Review) that on finish
// dispatches INSTALL_SOLUTION, which really pushes new rule/workbook records into
// shared state (dedup-by-name) — the single most "real" CRUD surface in this suite.
// Uninstall dispatches UNINSTALL_SOLUTION, which intentionally leaves those
// rules/workbooks behind, matching real Sentinel Content Hub behavior; the confirm
// step here says so explicitly, mirroring source's confirm() dialog text.
//
// All install/uninstall logic lives in the reducer — this component only renders
// state and dispatches actions, it never re-derives generated rule/workbook names.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SentinelSolution, SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import { Modal, WizStep, Checkbox, StatusPill } from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

type ComponentKind = "rules" | "workbooks" | "playbooks" | "huntingQueries";

const COMPONENT_LABELS: Record<ComponentKind, string> = {
  rules: "Analytics rules",
  workbooks: "Workbooks",
  playbooks: "Playbooks",
  huntingQueries: "Hunting queries",
};

const COMPONENT_KINDS: ComponentKind[] = ["rules", "workbooks", "playbooks", "huntingQueries"];

function summaryLine(components: SentinelSolution["components"]): string {
  return `${components.rules} rules · ${components.workbooks} workbooks · ${components.playbooks} playbooks · ${components.huntingQueries} hunting queries`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ContentHubPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  // Wizard state: which solution is being installed + current step + the
  // per-kind selection (checkbox on/off), pre-seeded with everything checked.
  const [installId, setInstallId] = useState<string | null>(null);
  const [wizStep, setWizStep] = useState(1);
  const [selection, setSelection] = useState<Record<ComponentKind, boolean>>({
    rules: true,
    workbooks: true,
    playbooks: true,
    huntingQueries: true,
  });

  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null);

  const categories = useMemo(() => ["all", ...Array.from(new Set(state.solutions.map((s) => s.category)))], [state.solutions]);

  const solutions = useMemo(() => {
    return state.solutions.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.publisher.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [state.solutions, category, search]);

  const installedIds = useMemo(() => new Set(state.installedSolutions.map((s) => s.id)), [state.installedSolutions]);

  const installSolution = installId ? state.solutions.find((s) => s.id === installId) ?? null : null;
  const uninstallSolution = confirmUninstallId ? state.solutions.find((s) => s.id === confirmUninstallId) ?? null : null;

  function openInstall(id: string) {
    setInstallId(id);
    setWizStep(1);
    setSelection({ rules: true, workbooks: true, playbooks: true, huntingQueries: true });
  }

  function closeInstall() {
    setInstallId(null);
    setWizStep(1);
  }

  function finishInstall() {
    if (!installSolution) return;
    dispatch({ type: "INSTALL_SOLUTION", id: installSolution.id });
    const c = installSolution.components;
    toast.success(`${installSolution.name} installed — ${c.rules} rules, ${c.workbooks} workbooks, ${c.playbooks} playbooks, ${c.huntingQueries} hunting queries added`);
    closeInstall();
  }

  function requestUninstall(id: string) {
    setConfirmUninstallId(id);
  }

  function confirmUninstall() {
    if (!uninstallSolution) return;
    dispatch({ type: "UNINSTALL_SOLUTION", id: uninstallSolution.id });
    toast.success(`${uninstallSolution.name} uninstalled — its rules and workbooks were left in place`);
    setConfirmUninstallId(null);
  }

  const selectedCount = COMPONENT_KINDS.filter((k) => selection[k]).length;

  return (
    <div>
      <div className={styles.h2}>Content hub</div>
      <div className={styles.sub}>
        Discover and install Microsoft Sentinel solutions — bundles of detection rules, workbooks, playbooks and hunting queries.{" "}
        {installedIds.size} of {state.solutions.length} installed.
      </div>

      <div className={styles.filterRow}>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.chip} ${category === c ? styles.chipActive : ""}`}
            onClick={() => setCategory(c)}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
        <input
          type="text"
          className={styles.input}
          placeholder="Search solutions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: "auto", maxWidth: 240 }}
        />
      </div>

      {solutions.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#605e5c" }}>No solutions match the filter.</div>
      ) : (
        <div className={styles.tileGrid}>
          {solutions.map((s) => {
            const installed = installedIds.has(s.id);
            return (
              <div key={s.id} className={styles.tile}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: "linear-gradient(135deg, #0078d4, #5c2df5)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {initials(s.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.tileTitle}>{s.name}</div>
                    <div className={styles.tileSub}>
                      {s.publisher} · {s.category}
                    </div>
                  </div>
                  <StatusPill tone={installed ? "ok" : "info"}>{installed ? "Installed" : "Available"}</StatusPill>
                </div>
                <div style={{ fontSize: 12.5, color: "#424242", margin: "10px 0" }}>{s.description}</div>
                <div className={styles.tileFoot}>{summaryLine(s.components)}</div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  {installed ? (
                    <button type="button" className={styles.btnOutline} onClick={() => requestUninstall(s.id)}>
                      Uninstall
                    </button>
                  ) : (
                    <button type="button" className={styles.btn} onClick={() => openInstall(s.id)}>
                      Install
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Install wizard ===== */}
      {installSolution ? (
        <Modal
          title={`Install ${installSolution.name}`}
          onClose={closeInstall}
          width="720px"
          steps={
            <>
              <WizStep label="1. Workspace" active={wizStep === 1} done={wizStep > 1} onClick={() => setWizStep(1)} />
              <WizStep label="2. Components" active={wizStep === 2} done={wizStep > 2} onClick={wizStep > 1 ? () => setWizStep(2) : undefined} />
              <WizStep label="3. Review" active={wizStep === 3} done={false} onClick={wizStep > 2 ? () => setWizStep(3) : undefined} />
            </>
          }
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <div>
                {wizStep > 1 ? (
                  <button type="button" className={styles.btnOutline} onClick={() => setWizStep(wizStep - 1)}>
                    ← Back
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={styles.btnOutline} onClick={closeInstall}>
                  Cancel
                </button>
                {wizStep < 3 ? (
                  <button type="button" className={styles.btn} onClick={() => setWizStep(wizStep + 1)}>
                    Next →
                  </button>
                ) : (
                  <button type="button" className={styles.btn} onClick={finishInstall}>
                    Install
                  </button>
                )}
              </div>
            </div>
          }
        >
          {wizStep === 1 ? (
            <div>
              <div className={styles.h3}>Target workspace</div>
              <div className={styles.sub}>Solutions install into the workspace the Sentinel admin center is connected to.</div>
              <div className={styles.card}>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <div>
                    <b>Workspace:</b> {state.workspace.name} ({state.workspace.region})
                  </div>
                  <div>
                    <b>Subscription:</b> {state.workspace.subscription}
                  </div>
                  <div>
                    <b>Resource group:</b> {state.workspace.resourceGroup}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {wizStep === 2 ? (
            <div>
              <div className={styles.h3}>Select components to install</div>
              <div className={styles.sub}>All selected by default. Unselect any you don&apos;t want.</div>
              {COMPONENT_KINDS.map((kind) => {
                const count = installSolution.components[kind];
                if (count === 0) return null;
                return (
                  <div key={kind} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}>
                    <Checkbox
                      label={`${COMPONENT_LABELS[kind]} (${count})`}
                      checked={selection[kind]}
                      onChange={(checked) => setSelection((prev) => ({ ...prev, [kind]: checked }))}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {wizStep === 3 ? (
            <div>
              <div className={styles.h3}>Review</div>
              <div className={styles.card}>
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Installing <b>{installSolution.name}</b> with <b>{selectedCount}</b> of {COMPONENT_KINDS.length} component types selected.
                  <br />
                  <br />
                  {COMPONENT_KINDS.filter((k) => selection[k] && installSolution.components[k] > 0)
                    .map((k) => `${installSolution.components[k]} ${COMPONENT_LABELS[k].toLowerCase()}`)
                    .join(", ") || "No components selected."}
                  <br />
                  <br />
                  Rules are added with state = <b>Disabled</b>. After install, open Analytics and enable the ones you want.
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {/* ===== Uninstall confirm ===== */}
      {uninstallSolution ? (
        <Modal title={`Uninstall ${uninstallSolution.name}?`} onClose={() => setConfirmUninstallId(null)} width="480px">
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            This removes the solution record but <b>keeps the analytics rules and workbooks already added</b> — you can disable or delete
            them from Analytics and Workbooks yourself.
          </div>
          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className={styles.btnOutline} onClick={() => setConfirmUninstallId(null)}>
              Cancel
            </button>
            <button type="button" className={styles.btn} onClick={confirmUninstall}>
              Uninstall
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
