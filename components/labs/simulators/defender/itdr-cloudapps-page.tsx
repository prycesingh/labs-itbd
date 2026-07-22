"use client";

// ITDR (Identity Threat Detection & Response) + Cloud Apps pages — ported from
// itbd-lab/simulators/defender/js/defender-itdr-cloud.js (DefenderITDR +
// DefenderCloudApps). Source keeps both modules' state as module-local JS
// vars (POSTURE/LMP/HONEY/DISCOVERED/OAUTH/CONNECTORS/SESSION_POLICIES) that
// reset on every page load and also re-renders via a wrong-element-id lookup
// bug (`document.getElementById('mainContent')` inside a nested view that
// isn't always the mounted root) — neither issue applies here. All mutable
// state below is real, persisted DefenderState + defenderReducer actions;
// posture findings and lateral movement paths are reference/read-only data
// (source never mutates them either).
//
// Seven page components, one per DefenderPage slot declared in
// defender-shell.tsx: ItdrPosturePage, ItdrLateralMovementPage,
// ItdrHoneytokensPage, CloudAppsDiscoveredPage, CloudAppsOauthPage,
// CloudAppsConnectorsPage, CloudAppsSessionPoliciesPage.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DefenderDiscoveredApp,
  DefenderHoneyToken,
  DefenderLateralMovementPath,
  DefenderLmpNode,
  DefenderOAuthApp,
  DefenderPostureFinding,
  DefenderSessionPolicy,
  DefenderState,
} from "@/lib/labs/simulators/defender/types";
import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import {
  DataTable,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  SeverityBadge,
  StatusPill,
  statusTone,
  type DataTableColumn,
} from "./defender-ui";
import styles from "./defender-console.module.css";

// =====================================================================
// 1. ItdrPosturePage
// =====================================================================

const POSTURE_AREA_OPTIONS = [
  { value: "All", label: "All areas" },
  { value: "Identity hygiene", label: "Identity hygiene" },
  { value: "Privileged access", label: "Privileged access" },
  { value: "Authentication", label: "Authentication" },
  { value: "Lateral movement", label: "Lateral movement" },
  { value: "Network exposure", label: "Network exposure" },
  { value: "Data exposure", label: "Data exposure" },
  { value: "Detection coverage", label: "Detection coverage" },
];

const POSTURE_SEVERITY_OPTIONS = [
  { value: "All", label: "All severities" },
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
];

export function ItdrPosturePage({ state }: { state: DefenderState }) {
  const [area, setArea] = useState("All");
  const [severity, setSeverity] = useState("All");

  const findings = state.postureFindings;
  const critical = findings.filter((p) => p.severity === "Critical").length;
  const high = findings.filter((p) => p.severity === "High").length;
  const medium = findings.filter((p) => p.severity === "Medium").length;
  const open = findings.filter((p) => p.status === "Open").length;

  const filtered = useMemo(
    () =>
      findings.filter((p) => (area === "All" || p.area === area) && (severity === "All" || p.severity === severity)),
    [findings, area, severity],
  );

  const columns: DataTableColumn<DefenderPostureFinding>[] = [
    {
      key: "finding",
      header: "Finding",
      render: (p) => (
        <div>
          <strong>{p.title}</strong>
          <div style={{ fontSize: 11, color: "#605e5c", marginTop: 3 }}>{p.recommendation}</div>
        </div>
      ),
    },
    { key: "area", header: "Area", render: (p) => p.area },
    { key: "severity", header: "Severity", render: (p) => <SeverityBadge severity={p.severity} /> },
    { key: "affected", header: "Affected", render: (p) => p.affected },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill>,
    },
    {
      key: "action",
      header: "",
      render: (p) => (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnOutline}`}
          style={{ fontSize: 11, padding: "3px 10px" }}
          onClick={() => toast.info(`Opening remediation guidance for ${p.id}`)}
        >
          Take action
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span>
        <a>Identity</a>
        <span>&gt;</span> ITDR posture
      </div>
      <div className={styles.pageH1}>Identity Threat Detection &amp; Response</div>
      <div className={styles.pageSub}>
        Posture findings, lateral movement paths, sensitive accounts, and honey tokens — combined from Defender for
        Identity + Entra ID Protection.
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color: "#a4262c" }}>
            {critical}
          </div>
          <div className={styles.statLabel}>Critical</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color: "#d83b01" }}>
            {high}
          </div>
          <div className={styles.statLabel}>High</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color: "#b8860b" }}>
            {medium}
          </div>
          <div className={styles.statLabel}>Medium</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{open}</div>
          <div className={styles.statLabel}>Open</div>
        </div>
      </div>

      <div className={styles.filterRow}>
        <Field label="Area">
          <NativeSelect value={area} onChange={setArea} options={POSTURE_AREA_OPTIONS} />
        </Field>
        <Field label="Severity">
          <NativeSelect value={severity} onChange={setSeverity} options={POSTURE_SEVERITY_OPTIONS} />
        </Field>
      </div>

      <DataTable columns={columns} rows={filtered} getRowKey={(p) => p.id} emptyMessage="No findings match these filters." />

      <div className={styles.tip}>
        These findings come from Defender for Identity sensors on DCs + Entra ID Protection signals. Address Critical
        + High in 30 days. Tip: rotate krbtgt + remove unconstrained delegation FIRST — they unlock the worst
        attacker primitives.
      </div>
    </div>
  );
}

// =====================================================================
// 2. ItdrLateralMovementPage
// =====================================================================

const LMP_NODE_COLOR: Record<DefenderLmpNode["type"], string> = {
  user: "#a4262c",
  creds: "#d83b01",
  group: "#0078d4",
  host: "#5c2d91",
};

function LmpHopChain({ path }: { path: DefenderLmpNode[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", overflowX: "auto", paddingBottom: 8 }}>
      {path.map((node, idx) => (
        <div key={`${node.type}-${node.name}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
          <div
            title={node.detail}
            style={{
              background: LMP_NODE_COLOR[node.type],
              color: "#fff",
              padding: "6px 10px",
              borderRadius: 4,
              minWidth: 160,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>{node.type}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{node.name}</div>
          </div>
          {idx < path.length - 1 ? <div style={{ fontSize: 18, color: "#605e5c" }}>&rarr;</div> : null}
        </div>
      ))}
    </div>
  );
}

function LateralMovementCard({ lmp }: { lmp: DefenderLateralMovementPath }) {
  function investigate() {
    toast.info(`Opening investigation for ${lmp.id} — pivot to Advanced Hunting`);
  }
  function breakChain() {
    if (window.confirm("Remove the highest-cost edge in this path? (will disable a cached credential or remove a Local Admin membership)")) {
      toast.success("Path mitigation queued. Verify with re-scan in 24h.");
    }
  }

  return (
    <div className={styles.card} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <strong>Target:</strong> <code>{lmp.target}</code>
        </div>
        <div>
          <span style={{ background: "#a4262c", color: "#fff", padding: "2px 8px", borderRadius: 8, fontSize: 11 }}>
            Risk score {lmp.riskScore}
          </span>{" "}
          &middot; <span style={{ color: "#605e5c", fontSize: 12 }}>{lmp.hops} hops</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#323130", margin: "6px 0 12px", lineHeight: 1.55 }}>{lmp.description}</div>
      <LmpHopChain path={lmp.path} />
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={investigate}>
          Investigate
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnOutline}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={breakChain}>
          Break the chain
        </button>
      </div>
    </div>
  );
}

export function ItdrLateralMovementPage({ state }: { state: DefenderState }) {
  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span>
        <a>Identity</a>
        <span>&gt;</span> Lateral movement paths
      </div>
      <div className={styles.pageH1}>Lateral movement paths</div>
      <p style={{ fontSize: 13, color: "#605e5c", margin: "6px 0 12px" }}>
        Defender for Identity computes paths from non-sensitive entities to sensitive accounts through cached
        credentials, Local Admin assignments, and Kerberos delegation. Break the shortest paths first.
      </p>

      {state.lateralMovementPaths.length === 0 ? (
        <EmptyState message="No lateral movement paths detected." />
      ) : (
        state.lateralMovementPaths.map((lmp) => <LateralMovementCard key={lmp.id} lmp={lmp} />)
      )}
    </div>
  );
}

// =====================================================================
// 3. ItdrHoneytokensPage
// =====================================================================

const HONEY_TYPE_OPTIONS = [
  { value: "User", label: "User" },
  { value: "Document", label: "Document" },
];

function emptyHoneyDraft(): { name: string; type: DefenderHoneyToken["type"]; placedIn: string } {
  return { name: "", type: "User", placedIn: "OU=Finance" };
}

export function ItdrHoneytokensPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyHoneyDraft());

  function openModal() {
    setDraft(emptyHoneyDraft());
    setModalOpen(true);
  }

  function submit() {
    if (!draft.name.trim()) {
      toast.error("Honey token name is required.");
      return;
    }
    const token: DefenderHoneyToken = {
      id: `ht-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      type: draft.type,
      created: new Date().toISOString().slice(0, 10),
      triggers: 0,
      lastTrigger: "never",
      placedIn: draft.placedIn.trim() || "-",
    };
    dispatch({ type: "ADD_HONEY_TOKEN", token });
    toast.success("Honey token created — wire its trigger via a custom analytics rule in Sentinel");
    setModalOpen(false);
  }

  const columns: DataTableColumn<DefenderHoneyToken>[] = [
    { key: "name", header: "Name", render: (h) => <strong>{h.name}</strong> },
    { key: "type", header: "Type", render: (h) => h.type },
    { key: "created", header: "Created", render: (h) => h.created },
    { key: "placedIn", header: "Placed in", render: (h) => h.placedIn },
    {
      key: "triggers",
      header: "Triggers",
      render: (h) => <span style={{ color: h.triggers === 0 ? "#605e5c" : "#a4262c", fontWeight: 600 }}>{h.triggers}</span>,
    },
    { key: "lastTrigger", header: "Last trigger", render: (h) => h.lastTrigger },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span>
        <a>Identity</a>
        <span>&gt;</span> Honeytokens
      </div>
      <div className={styles.pageH1}>Honey tokens</div>
      <p style={{ fontSize: 13, color: "#605e5c", margin: "6px 0 12px" }}>
        Honey tokens are decoy accounts / documents placed in attractive locations. Any access triggers a
        high-severity alert — by definition, only an attacker (or someone unauthorised) would touch them.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button type="button" className={styles.btnPrimary} onClick={openModal}>
          + Place honey token
        </button>
      </div>

      <DataTable columns={columns} rows={state.honeyTokens} getRowKey={(h) => h.id} emptyMessage="No honey tokens placed yet." />

      <div className={styles.tip}>
        Best honey tokens look real + relate to your environment + appear privileged. Avoid generic names like
        &quot;honeypot&quot; or &quot;decoy&quot; — sophisticated attackers grep for those.
      </div>

      {modalOpen ? (
        <Modal
          title="Place honey token"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={submit}>
                Create
              </button>
            </>
          }
        >
          <Field label="Honey token name" help="e.g. svc-finance-backup">
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="svc-finance-backup" />
          </Field>
          <Field label="Type">
            <NativeSelect value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v as DefenderHoneyToken["type"] }))} options={HONEY_TYPE_OPTIONS} />
          </Field>
          <Field label="Placed in" help="OU / SharePoint / share">
            <input className={styles.input} value={draft.placedIn} onChange={(e) => setDraft((d) => ({ ...d, placedIn: e.target.value }))} placeholder="OU=Finance" />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

// =====================================================================
// 4. CloudAppsDiscoveredPage
// =====================================================================

const APP_TAG_OPTIONS: { value: DefenderDiscoveredApp["tag"]; label: string }[] = [
  { value: "Sanctioned", label: "Sanctioned" },
  { value: "Monitored", label: "Monitored" },
  { value: "Unsanctioned", label: "Unsanctioned" },
  { value: "Block", label: "Block" },
];

const APP_TAG_FILTER_OPTIONS = [{ value: "All", label: "All tags" }, ...APP_TAG_OPTIONS];

function riskColor(risk: number): string {
  return risk >= 7 ? "#a4262c" : risk >= 4 ? "#b8860b" : "#0e700e";
}

export function CloudAppsDiscoveredPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [tagFilter, setTagFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");

  const categories = useMemo(() => {
    const set = new Set(state.discoveredApps.map((a) => a.cat));
    return ["All", ...Array.from(set).sort()];
  }, [state.discoveredApps]);
  const categoryOptions = categories.map((c) => ({ value: c, label: c === "All" ? "All categories" : c }));

  const filtered = useMemo(
    () =>
      state.discoveredApps.filter(
        (a) => (tagFilter === "All" || a.tag === tagFilter) && (catFilter === "All" || a.cat === catFilter),
      ),
    [state.discoveredApps, tagFilter, catFilter],
  );

  function changeTag(name: string, tag: DefenderDiscoveredApp["tag"]) {
    dispatch({ type: "SET_APP_TAG", name, tag });
    toast.success(`Tag updated for ${name}`);
  }

  const columns: DataTableColumn<DefenderDiscoveredApp>[] = [
    {
      key: "name",
      header: "App",
      render: (a) => (
        <span>
          <strong>{a.name}</strong>
          {a.publisherVerified ? (
            <span title="Verified publisher" style={{ color: "#0078d4", marginLeft: 4 }}>
              &#10003;
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "cat", header: "Category", render: (a) => a.cat },
    { key: "users", header: "Users", render: (a) => a.users.toLocaleString() },
    { key: "trafficMB", header: "Traffic (MB)", render: (a) => a.trafficMB.toLocaleString() },
    { key: "risk", header: "Risk", render: (a) => <span style={{ color: riskColor(a.risk), fontWeight: 600 }}>{a.risk}/10</span> },
    { key: "compliance", header: "Compliance", render: (a) => <span style={{ color: "#605e5c", fontSize: 11 }}>{a.compliance}</span> },
    {
      key: "tag",
      header: "Tag",
      render: (a) => (
        <NativeSelect
          value={a.tag}
          onChange={(v) => changeTag(a.name, v as DefenderDiscoveredApp["tag"])}
          options={APP_TAG_OPTIONS}
          style={{ width: 140 }}
        />
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span> Cloud apps
      </div>
      <div className={styles.pageH1}>Discovered apps</div>
      <div className={styles.pageSub}>
        Discovery is built from M365 + cloud-app logs + firewall syslog. Risk score 1-10 blends compliance,
        data-handling, security controls, and legal/regulatory.
      </div>

      <div className={styles.filterRow}>
        <Field label="Tag">
          <NativeSelect value={tagFilter} onChange={setTagFilter} options={APP_TAG_FILTER_OPTIONS} />
        </Field>
        <Field label="Category">
          <NativeSelect value={catFilter} onChange={setCatFilter} options={categoryOptions} />
        </Field>
      </div>

      <DataTable columns={columns} rows={filtered} getRowKey={(a) => a.name} emptyMessage="No apps match these filters." />

      <div className={styles.tip}>
        Discovery is built from M365 + cloud-app logs + firewall syslog (you can upload Defender for Cloud Apps
        &quot;Cloud Discovery snapshot&quot; reports).
      </div>
    </div>
  );
}

// =====================================================================
// 5. CloudAppsOauthPage
// =====================================================================

function oauthRiskColor(risk: number): string {
  return risk >= 7 ? "#a4262c" : risk >= 4 ? "#b8860b" : "#0e700e";
}

export function CloudAppsOauthPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [selected, setSelected] = useState<DefenderOAuthApp | null>(null);
  const [note, setNote] = useState("");

  function openApp(app: DefenderOAuthApp) {
    setSelected(app);
    setNote(app.note);
  }

  function closeFlyout() {
    setSelected(null);
    setNote("");
  }

  function setVerdict(verdict: "Approved" | "Investigate" | "Block") {
    if (!selected) return;
    dispatch({ type: "SET_OAUTH_VERDICT", id: selected.id, verdict, note });
    const labels: Record<typeof verdict, string> = {
      Approved: "Approved",
      Investigate: "Marked for investigation",
      Block: "Blocked tenant-wide (existing consent revoked, new consent disabled)",
    };
    toast.success(`${labels[verdict]}: ${selected.name}`);
    if (verdict === "Block") {
      toast.info("Resetting affected user passwords + alerting Security ops");
    }
    setSelected((prev) => (prev ? { ...prev, verdict, note } : prev));
  }

  const columns: DataTableColumn<DefenderOAuthApp>[] = [
    {
      key: "name",
      header: "App",
      render: (o) => (
        <span className={styles.rowLink}>
          {o.name}
          {o.publisherVerified ? (
            <span title="Verified publisher" style={{ color: "#0078d4", marginLeft: 4 }}>
              &#10003;
            </span>
          ) : (
            <span title="Unverified publisher" style={{ color: "#a4262c", marginLeft: 4 }}>
              !
            </span>
          )}
        </span>
      ),
    },
    { key: "publisher", header: "Publisher", render: (o) => o.publisher },
    { key: "consentType", header: "Consent type", render: (o) => o.consentType },
    { key: "permissionTier", header: "Permission tier", render: (o) => o.permissionTier },
    { key: "risk", header: "Risk", render: (o) => <span style={{ color: oauthRiskColor(o.risk), fontWeight: 600 }}>{o.risk}/10</span> },
    {
      key: "verdict",
      header: "Verdict",
      render: (o) => <StatusPill tone={statusTone(o.verdict)}>{o.verdict}</StatusPill>,
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span> Cloud apps
      </div>
      <div className={styles.pageH1}>OAuth governance</div>

      <div className={styles.tip}>
        <strong>OAuth consent-phishing</strong> is one of the top 2026 attack vectors. Look for: unverified publisher,
        permissions exceeding stated purpose, recent consent date, single victim user, off-pattern UPN. Permission
        scopes like <code>Mail.Send</code> + <code>offline_access</code> on an unverified app = almost always
        malicious.
      </div>

      <DataTable columns={columns} rows={state.oauthApps} getRowKey={(o) => o.id} onRowClick={openApp} emptyMessage="No OAuth apps found." />

      {selected ? (
        <Flyout
          title={selected.name}
          subtitle={
            <>
              {selected.publisher} &middot; Consented {selected.consentedDate} &middot; {selected.consentType}
            </>
          }
          onClose={closeFlyout}
          footer={
            <>
              <button type="button" className={styles.btnPrimary} onClick={() => setVerdict("Approved")}>
                Approve
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setVerdict("Investigate")}>
                Mark for investigation
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                style={{ color: "#a4262c", borderColor: "#a4262c" }}
                onClick={() => setVerdict("Block")}
              >
                Revoke / block tenant-wide
              </button>
            </>
          }
        >
          <div style={{ marginBottom: 14 }}>
            <span style={{ background: oauthRiskColor(selected.risk), color: "#fff", padding: "2px 8px", borderRadius: 8, fontSize: 11, marginRight: 6 }}>
              Risk {selected.risk}/10
            </span>
            <StatusPill tone={statusTone(selected.verdict)}>{selected.verdict}</StatusPill>
          </div>

          <div className={styles.h3}>Permissions requested ({selected.permissionTier} tier)</div>
          <ul style={{ margin: "0 0 14px 18px", fontSize: 13, lineHeight: 1.7 }}>
            {selected.permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>

          <Field label="Investigation notes">
            <textarea className={styles.textarea} style={{ height: 120 }} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Flyout>
      ) : null}
    </div>
  );
}

// =====================================================================
// 6. CloudAppsConnectorsPage
// =====================================================================

export function CloudAppsConnectorsPage({ state }: { state: DefenderState }) {
  function reconnect(name: string) {
    toast.success(`${name} connector refreshed`);
  }

  const columns: DataTableColumn<DefenderState["connectors"][number]>[] = [
    { key: "name", header: "App", render: (c) => c.name },
    { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
    { key: "authMode", header: "Auth mode", render: (c) => c.authMode },
    { key: "lastSync", header: "Last sync", render: (c) => c.lastSync },
    { key: "scopes", header: "Scopes", render: (c) => <span style={{ fontSize: 11, color: "#605e5c" }}>{c.scopes}</span> },
    {
      key: "reconnect",
      header: "",
      render: (c) => (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnOutline}`}
          style={{ fontSize: 11, padding: "3px 10px" }}
          onClick={() => reconnect(c.name)}
        >
          Reconnect
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span> Cloud apps
      </div>
      <div className={styles.pageH1}>App connectors</div>

      <DataTable columns={columns} rows={state.connectors} getRowKey={(c) => c.name} emptyMessage="No connectors configured." />

      <div className={styles.tip}>
        App connectors pull activity logs from connected SaaS apps via OAuth admin consent. Each connector adds
        another data source to Advanced Hunting (CloudAppEvents table).
      </div>
    </div>
  );
}

// =====================================================================
// 7. CloudAppsSessionPoliciesPage
// =====================================================================

function emptyPolicyDraft(): { name: string; appliesTo: string; signals: string; action: string } {
  return { name: "", appliesTo: "ChatGPT, Claude", signals: "Group: Finance", action: "Block upload" };
}

export function CloudAppsSessionPoliciesPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(emptyPolicyDraft());

  function openModal() {
    setDraft(emptyPolicyDraft());
    setModalOpen(true);
  }

  function submit() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      return;
    }
    const policy: DefenderSessionPolicy = {
      id: `sp-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      state: "Report-only",
      appliesTo: draft.appliesTo.trim() || "-",
      signals: draft.signals.trim() || "-",
      action: draft.action.trim() || "Block upload",
    };
    dispatch({ type: "ADD_SESSION_POLICY", policy });
    toast.success(`Policy "${policy.name}" created in Report-only mode. Promote to Active after 7 days of monitoring.`);
    setModalOpen(false);
  }

  const columns: DataTableColumn<DefenderSessionPolicy>[] = [
    { key: "name", header: "Policy", render: (p) => <strong>{p.name}</strong> },
    { key: "state", header: "State", render: (p) => <StatusPill tone={statusTone(p.state)}>{p.state}</StatusPill> },
    { key: "appliesTo", header: "Applies to", render: (p) => p.appliesTo },
    { key: "signals", header: "Signals", render: (p) => <span style={{ fontSize: 11, color: "#605e5c" }}>{p.signals}</span> },
    { key: "action", header: "Action", render: (p) => p.action },
  ];

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a>
        <span>&gt;</span> Cloud apps
      </div>
      <div className={styles.pageH1}>Session policies</div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button type="button" className={styles.btnPrimary} onClick={openModal}>
          + Create session policy
        </button>
      </div>

      <DataTable columns={columns} rows={state.sessionPolicies} getRowKey={(p) => p.id} emptyMessage="No session policies configured." />

      <div className={styles.tip}>
        Session policies use Conditional Access App Control (reverse-proxy session). Real-time enforcement inside
        SaaS app sessions — block downloads from unmanaged devices, watermark sensitive docs, prevent uploads to AI
        tools, force MFA mid-session.
      </div>

      {modalOpen ? (
        <Modal
          title="Create session policy"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={submit}>
                Create
              </button>
            </>
          }
        >
          <Field label="Policy name" help='e.g. "Block uploads to ChatGPT from Finance"'>
            <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </Field>
          <Field label="Applies to apps" help="Comma-separated">
            <input className={styles.input} value={draft.appliesTo} onChange={(e) => setDraft((d) => ({ ...d, appliesTo: e.target.value }))} />
          </Field>
          <Field label="Signals" help="e.g. Group:Finance, Risky sign-in">
            <input className={styles.input} value={draft.signals} onChange={(e) => setDraft((d) => ({ ...d, signals: e.target.value }))} />
          </Field>
          <Field label="Action" help="Block download / Block upload / Apply watermark / Require MFA">
            <input className={styles.input} value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
