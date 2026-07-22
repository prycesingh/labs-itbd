"use client";

import { useState } from "react";

import type { M365State } from "@/lib/labs/simulators/m365/types";
import { BarListCard, CircularGauge, Modal, Pill, StatRow } from "./m365-ui";
import styles from "./m365-console.module.css";

type SecurityTab = "conditional-access" | "mfa-sspr" | "secure-score" | "threat-protection";

const SUBTABS: { key: SecurityTab; label: string }[] = [
  { key: "conditional-access", label: "Conditional Access" },
  { key: "mfa-sspr", label: "MFA & SSPR" },
  { key: "secure-score", label: "Secure Score" },
  { key: "threat-protection", label: "Threat protection" },
];

const MFA_METHODS: { name: string; enabled: boolean; note: string }[] = [
  { name: "Microsoft Authenticator", enabled: true, note: "Recommended — push notification and passwordless sign-in." },
  { name: "FIDO2 security key", enabled: true, note: "Recommended — phishing-resistant hardware key." },
  { name: "Windows Hello for Business", enabled: true, note: "Recommended for managed Windows devices." },
  { name: "Certificate-based authentication", enabled: true, note: "Recommended for high-assurance scenarios." },
  { name: "OATH hardware token", enabled: true, note: "Acceptable fallback for users without a smartphone." },
  { name: "SMS", enabled: true, note: "Discouraged — vulnerable to SIM-swap and interception." },
  { name: "Voice call", enabled: true, note: "Discouraged — vulnerable to social engineering." },
  { name: "Email (SSPR only)", enabled: true, note: "SSPR verification method only, not a sign-in method." },
  { name: "Security questions (SSPR only)", enabled: false, note: "SSPR verification method only; weakest option." },
];

const THREAT_POLICIES: { name: string; type: string }[] = [
  { name: "Default anti-phishing policy", type: "Anti-phishing" },
  { name: "Default anti-spam policy", type: "Anti-spam" },
  { name: "Default anti-malware policy", type: "Anti-malware" },
  { name: "Standard protection — Safe Links", type: "Safe Links" },
  { name: "Standard protection — Safe Attachments", type: "Safe Attachments" },
];

const IMPROVEMENT_ACTIONS: { action: string; points: number; status: "To address" | "Planned" | "Completed" }[] = [
  { action: "Enable self-service password reset", points: 6, status: "To address" },
  { action: "Turn on user risk policy", points: 8, status: "To address" },
  { action: "Designate emergency access (break-glass) accounts", points: 4, status: "Planned" },
  { action: "Review and reduce Global Administrator assignments", points: 5, status: "Planned" },
  { action: "Require MFA for all users", points: 10, status: "Completed" },
];

export function SecurityPage({ state }: { state: M365State }) {
  const [tab, setTab] = useState<SecurityTab>("conditional-access");
  const [showNewPolicy, setShowNewPolicy] = useState(false);

  const { security } = state;

  return (
    <div>
      <h1 className={styles.pageH1}>Security</h1>
      <p className={styles.pageSub}>Conditional Access, authentication methods, secure score, and threat protection for {state.tenant.name}.</p>

      <div className={styles.subtabs}>
        {SUBTABS.map((t) => (
          <button key={t.key} type="button" className={`${styles.subtab} ${tab === t.key ? styles.subtabActive : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "conditional-access" ? (
        <div>
          <div style={{ marginBottom: 10 }}>
            <button type="button" className={styles.btn} onClick={() => setShowNewPolicy(true)}>
              + New policy
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>State</th>
                  <th>Users</th>
                  <th>Apps</th>
                  <th>Conditions</th>
                  <th>Grant</th>
                  <th>Session</th>
                </tr>
              </thead>
              <tbody>
                {security.conditionalAccessPolicies.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>
                      <Pill tone={p.state === "On" ? "ok" : p.state === "Off" ? "muted" : "info"}>{p.state}</Pill>
                    </td>
                    <td>{p.users}</td>
                    <td>{p.apps}</td>
                    <td>{p.conditions}</td>
                    <td>{p.grant}</td>
                    <td>{p.session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.h2}>Named locations</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Value</th>
                  <th>Trusted</th>
                </tr>
              </thead>
              <tbody>
                {security.namedLocations.map((loc) => (
                  <tr key={loc.name}>
                    <td>{loc.name}</td>
                    <td>{loc.kind}</td>
                    <td>{loc.value}</td>
                    <td>
                      <Pill tone={loc.trusted ? "ok" : "muted"}>{loc.trusted ? "Trusted" : "Not trusted"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "mfa-sspr" ? (
        <div>
          <StatRow
            stats={[
              { label: "Total users", value: state.users.length },
              { label: "MFA-enabled", value: state.users.filter((u) => u.mfaEnabled).length },
              { label: "MFA registration rate", value: state.users.length ? `${Math.round((state.users.filter((u) => u.mfaEnabled).length / state.users.length) * 100)}%` : "0%" },
              { label: "SSPR enabled", value: "Yes" },
            ]}
          />

          <div className={styles.h2}>Authentication methods</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>State</th>
                  <th>Guidance</th>
                </tr>
              </thead>
              <tbody>
                {MFA_METHODS.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>
                      <Pill tone={m.enabled ? "ok" : "muted"}>{m.enabled ? "On" : "Off"}</Pill>
                    </td>
                    <td>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Recommendation</div>
            <p className={styles.muted}>
              SMS and voice call are still enabled and are the weakest verification methods in use. Steer users toward Microsoft Authenticator or a FIDO2
              security key, and plan to disable SMS/voice once adoption of stronger methods is high enough.
            </p>
          </div>
        </div>
      ) : null}

      {tab === "secure-score" ? (
        <div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Microsoft Secure Score</div>
            <CircularGauge current={security.secureScore.current} max={security.secureScore.max} label="Overall score" />
          </div>

          <div className={styles.h2}>Score breakdown by category</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Score</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {security.secureScoreCategories.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td>
                      {c.current} / {c.max}
                    </td>
                    <td>
                      <div className={styles.bar}>
                        <div className={styles.fill} style={{ width: `${c.max > 0 ? (c.current / c.max) * 100 : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.h2}>Top improvement actions</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Points available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {IMPROVEMENT_ACTIONS.map((a) => (
                  <tr key={a.action}>
                    <td>{a.action}</td>
                    <td>{a.points}</td>
                    <td>
                      <Pill tone={a.status === "Completed" ? "ok" : a.status === "Planned" ? "info" : "warn"}>{a.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "threat-protection" ? (
        <div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {THREAT_POLICIES.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.type}</td>
                    <td>
                      <Pill tone="ok">Active</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.h2}>Attack simulation training</div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Last simulation summary</div>
            <StatRow
              stats={[
                { label: "Users targeted", value: Math.max(1, Math.round(state.users.length * 0.6)) },
                { label: "Click rate", value: "14%" },
                { label: "Report rate", value: "38%" },
                { label: "Compromised credentials", value: "2" },
              ]}
            />
          </div>
          <BarListCard
            title="Simulation results by campaign"
            rows={[
              { label: "Credential harvest — Payroll update", value: 22 },
              { label: "Malware attachment — Invoice", value: 9 },
              { label: "Drive-by URL — IT helpdesk", value: 14 },
            ]}
          />
        </div>
      ) : null}

      {showNewPolicy ? (
        <Modal
          title="New Conditional Access policy"
          onClose={() => setShowNewPolicy(false)}
          width="560px"
          footer={
            <button type="button" className={styles.btnOutline} onClick={() => setShowNewPolicy(false)}>
              Close
            </button>
          }
        >
          <p className={styles.muted} style={{ marginBottom: 12 }}>
            In the real Microsoft Entra admin center, a Conditional Access policy is built in five steps:
          </p>
          <div className={styles.reviewGrid}>
            <div className={styles.lbl}>1. Users</div>
            <div>Choose which users and groups the policy applies to (include/exclude).</div>
            <div className={styles.lbl}>2. Target resources</div>
            <div>Pick the cloud apps or actions the policy protects.</div>
            <div className={styles.lbl}>3. Conditions</div>
            <div>Scope by sign-in risk, device platform, location, or client app.</div>
            <div className={styles.lbl}>4. Grant</div>
            <div>Require MFA, a compliant device, an app protection policy, or block access.</div>
            <div className={styles.lbl}>5. Session</div>
            <div>Control sign-in frequency, persistent browser sessions, or app enforced restrictions.</div>
          </div>
          <div style={{ marginTop: 14, padding: "10px 12px", background: "#fff4ce", borderLeft: "3px solid #ffaa44", fontSize: 12, color: "#3b3a39" }}>
            This simulator provides a read-only view of Conditional Access — policy authoring isn&apos;t wired up.
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
