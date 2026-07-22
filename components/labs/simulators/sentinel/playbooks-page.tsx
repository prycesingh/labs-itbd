"use client";

// Automation (Logic Apps playbooks) — ported from sentinel-playbooks.js
// listHtml()/designerHtml()/automationRulesHtml(). Source rendered "Active
// playbooks" / "Playbook templates" / "Automation rules" as three sub-tabs of
// one page component; this app's shell (sentinel-shell.tsx) instead carries
// "playbooks" and "automation-rules" as two separate top-level nav pages, so
// this file exports two components to match — PlaybooksPage (list + designer
// flyout) and AutomationRulesPage (CRUD table). "Playbook templates" (a
// static, non-interactive tile grid of Microsoft/community template cards,
// out of scope per the task spec) is intentionally not ported here.
//
// Source's "Recent runs" table faked a run log on every render with
// `i*47+12` minutes-ago math and Math.random()-free but still synthetic
// duration numbers — recomputed differently each render. This port instead
// derives a small "recent runs" summary deterministically from the
// playbook's real, persisted runsTotal/runsSuccess/runsFailed fields: the
// same state always produces the same table (no Math.random(), no
// re-randomization), and it never invents facts state doesn't already have.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SentinelPlaybook, SentinelPlaybookStep, SentinelState } from "@/lib/labs/simulators/sentinel/types";
import type { SentinelAction } from "@/lib/labs/simulators/sentinel/reducer";
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  Flyout,
  Modal,
  StatusPill,
  statusTone,
} from "./sentinel-ui";
import styles from "./sentinel-console.module.css";

// ===================== PlaybooksPage =====================

function stepClass(type: SentinelPlaybookStep["type"]): string {
  if (type === "Trigger") return styles.pbStepTrigger;
  if (type === "Condition") return styles.pbStepCondition;
  if (type === "For each") return styles.pbStepForeach;
  return "";
}

// Deterministic recent-runs summary derived from the playbook's real,
// persisted counters — no Math.random(), no per-render re-randomization.
// Shows up to 10 rows; the pass/fail pattern is spread evenly across the
// rows so the displayed ratio matches the playbook's real success ratio as
// closely as an integer row count allows (e.g. runsFailed=1/runsTotal=23 ->
// 1 failing row out of the 10 shown, proportionally placed).
type RecentRun = { index: number; succeeded: boolean };

function recentRuns(playbook: SentinelPlaybook): RecentRun[] {
  const rowCount = Math.max(0, Math.min(playbook.runsTotal, 10));
  if (rowCount === 0) return [];
  const failRatio = playbook.runsTotal > 0 ? playbook.runsFailed / playbook.runsTotal : 0;
  const failCount = Math.min(rowCount, Math.round(failRatio * rowCount));
  // Spread failures evenly across the row span instead of clustering them,
  // e.g. failCount=2 of rowCount=10 -> fails at index 4 and 9.
  const failIndexes = new Set<number>();
  for (let f = 1; f <= failCount; f++) {
    failIndexes.add(Math.floor((f * rowCount) / (failCount + 1)));
  }
  return Array.from({ length: rowCount }, (_, i) => ({ index: i, succeeded: !failIndexes.has(i) }));
}

function PlaybookDesignerFlyout({ playbook, onClose }: { playbook: SentinelPlaybook; onClose: () => void }) {
  const runs = useMemo(() => recentRuns(playbook), [playbook]);

  const runColumns: DataTableColumn<RecentRun>[] = [
    { key: "num", header: "#", render: (r) => r.index + 1 },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={r.succeeded ? "ok" : "err"}>{r.succeeded ? "Succeeded" : "Failed"}</StatusPill> },
    { key: "trigger", header: "Triggered by", render: () => playbook.trigger },
  ];

  return (
    <Flyout title={playbook.name} subtitle={playbook.description} onClose={onClose}>
      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className={styles.cardTitle}>{playbook.name}</div>
            <div style={{ fontSize: 13, color: "#605e5c" }}>{playbook.description}</div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Trigger: <strong>{playbook.trigger}</strong>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>
              <StatusPill tone={statusTone(playbook.state)}>{playbook.state}</StatusPill>
            </div>
            <div style={{ fontSize: 12, color: "#605e5c", marginTop: 4 }}>
              Total runs: {playbook.runsTotal} &middot; Success: {playbook.runsSuccess} &middot; Failed: {playbook.runsFailed}
            </div>
            <div style={{ fontSize: 11, color: "#605e5c" }}>Last run: {playbook.lastRun}</div>
          </div>
        </div>
      </div>

      <div className={styles.h2}>Logic App designer</div>
      <div className={styles.pbCanvas}>
        {playbook.steps.map((step, i) => (
          <div key={`${step.type}-${step.name}-${i}`}>
            <div className={`${styles.pbStep} ${stepClass(step.type)}`}>
              <div className={styles.pbStepType}>{step.type}</div>
              <div className={styles.pbStepName}>{step.name}</div>
              <div className={styles.pbStepDetails}>{step.details}</div>
            </div>
            {i < playbook.steps.length - 1 ? <div className={styles.pbArrow} /> : null}
          </div>
        ))}
      </div>

      <div className={styles.h2}>Recent runs</div>
      {runs.length === 0 ? (
        <EmptyState message="This playbook has never run." />
      ) : (
        <DataTable columns={runColumns} rows={runs} getRowKey={(r) => String(r.index)} />
      )}
    </Flyout>
  );
}

export function PlaybooksPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? state.playbooks.find((p) => p.id === selectedId) ?? null : null;

  function toggleState(playbook: SentinelPlaybook) {
    dispatch({ type: "TOGGLE_PLAYBOOK_STATE", id: playbook.id });
    toast.success(`${playbook.name} ${playbook.state === "Enabled" ? "disabled" : "enabled"}.`);
  }

  const columns: DataTableColumn<SentinelPlaybook>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div>
          <div>{p.name}</div>
          <div style={{ fontSize: 11, color: "#605e5c" }}>{p.description}</div>
        </div>
      ),
    },
    { key: "trigger", header: "Trigger", render: (p) => p.trigger },
    { key: "state", header: "State", render: (p) => <StatusPill tone={statusTone(p.state)}>{p.state}</StatusPill> },
    { key: "lastRun", header: "Last run", render: (p) => p.lastRun },
    { key: "runsTotal", header: "Total runs", render: (p) => p.runsTotal },
    {
      key: "successFailed",
      header: "Success / Failed",
      render: (p) => (
        <span>
          <span style={{ color: "#107c10" }}>{p.runsSuccess}</span> / <span style={{ color: "#cf2030" }}>{p.runsFailed}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <button
          type="button"
          className={styles.btnOutline}
          onClick={(e) => {
            e.stopPropagation();
            toggleState(p);
          }}
        >
          {p.state === "Enabled" ? "Disable" : "Enable"}
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.sub}>Logic Apps that automate response to Sentinel incidents and alerts.</div>
      <DataTable columns={columns} rows={state.playbooks} getRowKey={(p) => p.id} onRowClick={(p) => setSelectedId(p.id)} emptyMessage="No playbooks configured." />

      {selected ? <PlaybookDesignerFlyout playbook={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}

// ===================== AutomationRulesPage =====================

type NewRuleForm = { name: string; trigger: string; action: string; order: string };

const EMPTY_FORM: NewRuleForm = { name: "", trigger: "", action: "", order: "" };

export function AutomationRulesPage({ state, dispatch }: { state: SentinelState; dispatch: React.Dispatch<SentinelAction> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<NewRuleForm>(EMPTY_FORM);

  const sortedRules = useMemo(() => [...state.automationRules].sort((a, b) => a.order - b.order), [state.automationRules]);

  function closeAdd() {
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  function submitAdd() {
    const name = form.name.trim();
    const trigger = form.trigger.trim();
    const action = form.action.trim();
    const order = Number.parseInt(form.order, 10);

    if (!name || !trigger || !action || !Number.isFinite(order)) {
      toast.error("Fill in name, trigger, action, and a valid order number.");
      return;
    }

    dispatch({
      type: "ADD_AUTOMATION_RULE",
      rule: { id: "ar-" + crypto.randomUUID(), name, order, trigger, action, enabled: true },
    });
    toast.success(`Automation rule "${name}" created.`);
    closeAdd();
  }

  function deleteRule(id: string, name: string) {
    dispatch({ type: "DELETE_AUTOMATION_RULE", id });
    toast.success(`Automation rule "${name}" deleted.`);
  }

  const columns: DataTableColumn<SentinelState["automationRules"][number]>[] = [
    { key: "order", header: "Order", render: (r) => r.order, width: "70px" },
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "trigger", header: "Trigger", render: (r) => r.trigger },
    { key: "action", header: "Actions", render: (r) => r.action },
    { key: "enabled", header: "Status", render: (r) => <StatusPill tone={r.enabled ? "ok" : "muted"}>{r.enabled ? "Enabled" : "Disabled"}</StatusPill> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          type="button"
          className={styles.btnOutline}
          onClick={(e) => {
            e.stopPropagation();
            deleteRule(r.id, r.name);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.sub}>Automation rules tag, assign and route incidents without writing Logic Apps.</div>
      <div style={{ marginBottom: 10 }}>
        <button type="button" className={styles.btn} onClick={() => setShowAdd(true)}>
          + Add automation rule
        </button>
      </div>

      <DataTable columns={columns} rows={sortedRules} getRowKey={(r) => r.id} emptyMessage="No automation rules configured." />

      {showAdd ? (
        <Modal
          title="Add automation rule"
          onClose={closeAdd}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={closeAdd}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={submitAdd}>
                Create
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auto-assign high severity" />
          </Field>
          <Field label="Trigger">
            <input className={styles.input} value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} placeholder="e.g. When incident created &amp; severity = High" />
          </Field>
          <Field label="Actions">
            <input className={styles.input} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} placeholder="e.g. Assign to admin@ &middot; Tag: P1" />
          </Field>
          <Field label="Order">
            <input className={styles.input} type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} placeholder="e.g. 5" />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
