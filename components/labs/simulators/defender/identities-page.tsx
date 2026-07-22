"use client";

// Identities page — ported from itbd-lab/simulators/defender/js/defender-identity.js
// (renderIdentities/riskySignIns/openIdentity/action). Identity inventory with
// risk badges, MFA coverage, risky sign-ins table, and a detail flyout.
// Stat tiles and the MFA coverage % are genuine derived numbers computed via
// .filter()/.length over live state, matching source's live-data convention
// (see home-page.tsx). Row actions (reset / revoke / confirm-compromised) are
// toast-only, matching source: there is no dedicated reducer action for
// identity risk mutation, and source itself never mutates `u` — it only calls
// DefenderPortal.toast(...) + DefenderData.logActivity(...). A small additive
// reducer action (e.g. to flip mfaRegistered on "reset" or clear signInRisk on
// "confirm-compromised") would be a reasonable future enhancement, but is
// deliberately not added here to keep this page read-mostly matching source.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderIdentity, DefenderState } from "@/lib/labs/simulators/defender/types";
import { DataTable, Flyout, SeverityBadge, StatRow, StatusPill, type DataTableColumn } from "./defender-ui";
import styles from "./defender-console.module.css";

type RiskFilter = "all" | "High" | "Medium" | "Low" | "None";

const RISK_FILTERS: RiskFilter[] = ["all", "High", "Medium", "Low", "None"];

function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60) return `${Math.floor(diffSec)} sec ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
}

// Maps source's riskBadge()/df-risk class (which reuses the same red/orange/
// yellow/grey scale as df-sev) onto the shared SeverityBadge component — the
// CSS module's sev* classes are keyed by the same severity vocabulary
// (High/Medium/Low/Informational), so "None" is rendered via the
// Informational tone.
function RiskBadge({ risk }: { risk: DefenderIdentity["signInRisk"] }) {
  return <SeverityBadge severity={risk === "None" ? "Informational" : risk} />;
}

type ActionKind = "reset" | "revoke" | "confirm-compromised";

const ACTION_LABELS: Record<ActionKind, string> = {
  reset: "Password reset triggered",
  revoke: "Sessions revoked",
  "confirm-compromised": "User marked compromised",
};

export function IdentitiesPage({ state }: { state: DefenderState }) {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selected, setSelected] = useState<DefenderIdentity | null>(null);

  const identities = state.identities;

  // ----- Live derived stats (real .filter()/.length over state) -----
  const riskyCount = identities.filter((u) => u.signInRisk !== "None" || u.userRisk !== "None").length;
  const mfaRegisteredCount = identities.filter((u) => u.mfaRegistered).length;
  const mfaPct = identities.length > 0 ? Math.round((mfaRegisteredCount / identities.length) * 100) : 0;
  const privilegedCount = identities.filter((u) => u.privilegedRoles.length > 0).length;

  const filtered = useMemo(
    () => identities.filter((u) => riskFilter === "all" || u.signInRisk === riskFilter),
    [identities, riskFilter]
  );

  const riskySignIns = useMemo(() => identities.filter((u) => u.lastRiskySignIn), [identities]);

  const columns: DataTableColumn<DefenderIdentity>[] = [
    {
      key: "user",
      header: "User",
      render: (u) => (
        <>
          <span className={styles.rowLink}>{u.displayName}</span>
          <div style={{ fontSize: 11, color: "#605e5c" }}>{u.upn}</div>
        </>
      ),
    },
    { key: "department", header: "Department", render: (u) => u.department },
    { key: "jobTitle", header: "Job title", render: (u) => u.jobTitle },
    { key: "signInRisk", header: "Sign-in risk", render: (u) => <RiskBadge risk={u.signInRisk} /> },
    { key: "userRisk", header: "User risk", render: (u) => <RiskBadge risk={u.userRisk} /> },
    {
      key: "mfa",
      header: "MFA",
      render: (u) => (u.mfaRegistered ? <StatusPill tone="ok">Registered</StatusPill> : <StatusPill tone="warn">Not registered</StatusPill>),
    },
    { key: "riskySignIns", header: "Risky sign-ins", render: (u) => u.riskySignIns },
    { key: "lastSignIn", header: "Last sign-in", render: (u) => timeAgo(u.lastSignIn) },
  ];

  const riskySignInColumns: DataTableColumn<DefenderIdentity>[] = [
    { key: "date", header: "Date", render: (u) => timeAgo(u.lastRiskySignIn) },
    { key: "user", header: "User", render: (u) => u.displayName },
    { key: "upn", header: "UPN", render: (u) => u.upn },
    { key: "risk", header: "Risk level", render: (u) => <RiskBadge risk={u.signInRisk} /> },
    { key: "riskType", header: "Risk type", render: () => "Anonymous IP" },
    { key: "ip", header: "IP", render: () => "198.51.100.34" },
    { key: "location", header: "Location", render: () => "Romania" },
    { key: "result", header: "Result", render: () => <StatusPill tone="warn">Success</StatusPill> },
  ];

  function runAction(kind: ActionKind, identity: DefenderIdentity) {
    toast.success(`${ACTION_LABELS[kind]} for ${identity.displayName}`);
  }

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>/</span>
        <a>Assets</a>
        <span>/</span>
        <a>Identities</a>
      </div>
      <div className={styles.pageH1}>Identities</div>
      <div className={styles.pageSub}>Users and service principals monitored by Defender for Identity and Entra ID Protection.</div>

      <StatRow
        stats={[
          { label: "Total identities", value: identities.length },
          { label: "Risky users", value: riskyCount },
          { label: "MFA coverage", value: `${mfaPct}%` },
          { label: "Privileged accounts", value: privilegedCount },
          { label: "Sensitive accounts", value: identities.filter((u) => u.isSensitive).length },
        ]}
      />

      <div className={styles.filterRow}>
        {RISK_FILTERS.map((r) => (
          <button key={r} type="button" className={`${styles.chip} ${riskFilter === r ? styles.chipActive : ""}`} onClick={() => setRiskFilter(r)}>
            {r === "all" ? "Risk: any" : r}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filtered} getRowKey={(u) => u.id} onRowClick={(u) => setSelected(u)} emptyMessage="No identities match this filter." />

      <div className={styles.h2}>Recent risky sign-ins</div>
      <DataTable
        columns={riskySignInColumns}
        rows={riskySignIns}
        getRowKey={(u) => u.id}
        emptyMessage="No risky sign-ins in the last 7 days."
      />

      {selected ? (
        <Flyout
          title={selected.displayName}
          subtitle="Identity"
          onClose={() => setSelected(null)}
          footer={
            <>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => runAction("reset", selected)}>
                Reset password
              </button>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => runAction("revoke", selected)}>
                Revoke sessions
              </button>
              <button type="button" className={styles.btn} onClick={() => runAction("confirm-compromised", selected)}>
                Confirm compromised
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12, marginBottom: 18 }}>
            <div>
              <div style={{ color: "#605e5c" }}>UPN</div>
              {selected.upn}
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Job title</div>
              {selected.jobTitle}
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Department</div>
              {selected.department}
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>Sign-in risk</div>
              <RiskBadge risk={selected.signInRisk} />
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>User risk</div>
              <RiskBadge risk={selected.userRisk} />
            </div>
            <div>
              <div style={{ color: "#605e5c" }}>MFA</div>
              {selected.mfaRegistered ? "Registered" : "Not registered"}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>MFA methods</div>
            {selected.mfaMethods.length > 0 ? (
              <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                {selected.mfaMethods.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 12, color: "#605e5c" }}>No MFA methods registered. Consider enforcing registration via Conditional Access.</div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Risk detections (last 30 days)</div>
            {selected.riskySignIns > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Risk type</th>
                      <th>Level</th>
                      <th>Detection time</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Anonymous IP address</td>
                      <td>
                        <RiskBadge risk={selected.signInRisk} />
                      </td>
                      <td>{timeAgo(selected.lastRiskySignIn)}</td>
                      <td>
                        <StatusPill tone="warn">Success</StatusPill>
                      </td>
                    </tr>
                    <tr>
                      <td>Atypical travel</td>
                      <td>
                        <RiskBadge risk="Medium" />
                      </td>
                      <td>3 days ago</td>
                      <td>
                        <StatusPill tone="muted">Blocked by CA</StatusPill>
                      </td>
                    </tr>
                    <tr>
                      <td>Unfamiliar sign-in properties</td>
                      <td>
                        <RiskBadge risk="Low" />
                      </td>
                      <td>5 days ago</td>
                      <td>
                        <StatusPill tone="muted">Success</StatusPill>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#605e5c" }}>No risk detections.</div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Privileged roles</div>
            {selected.privilegedRoles.length > 0 ? (
              <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                {selected.privilegedRoles.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 12, color: "#605e5c" }}>No privileged roles assigned.</div>
            )}
          </div>
        </Flyout>
      ) : null}
    </div>
  );
}
