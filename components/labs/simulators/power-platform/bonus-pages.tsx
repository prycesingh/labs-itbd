"use client";

// Six standalone "bonus" pages for the Power Platform Admin Center simulator.
// Ported from itbd-lab/simulators/powerplatform/js/pp-portal.js, which folds
// all of these into one big shell file (renderPages()/renderPowerBI()/
// renderIsolation()/renderLockbox()/renderCmk()/renderSettingsCard()) — here
// each becomes its own routed page component per pp-shell.tsx's `PpPage`
// union ("power-pages-sites" / "power-bi-workspaces" / "tenant-isolation" /
// "customer-lockbox" / "customer-managed-key" / "settings").
//
// No native prompt()/alert()/confirm() anywhere — every destructive or
// confirming action routes through <Modal/> + toast (sonner), matching the
// house convention already established in apps-page.tsx /
// analytics-capacity-licenses-page.tsx / overview-page.tsx.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PpBiWorkspace,
  PpCmk,
  PpLockboxRequest,
  PpPagesSite,
  PpState,
} from "@/lib/labs/simulators/power-platform/types";
import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Modal,
  NativeSelect,
  StatRow,
  StatusPill,
  exportCsv,
  statusTone,
  type DataTableColumn,
} from "./pp-ui";
import styles from "./pp-console.module.css";

// ===================================================================
// 1. Power Pages sites
// ===================================================================

const PAGES_TEMPLATES = ["Blank", "Customer self-service", "Partner portal", "Employee self-service", "Community portal", "Event registration"];

function genPagesSiteId(): string {
  return `pages-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function PowerPagesSitesPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PpPagesSite | null>(null);

  const envNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const env of state.environments) map.set(env.id, env.name);
    return map;
  }, [state.environments]);

  function handleExport() {
    const headers = ["Name", "Environment", "URL", "Status", "Template", "Page views (30d)", "Created"];
    const rows = state.pagesSites.map((s) => [s.name, envNameById.get(s.envId) ?? s.envId, s.url, s.status, s.template, s.pageViews30d, s.createdOn]);
    exportCsv("power-pages-sites.csv", headers, rows);
    toast.success(`Exported ${state.pagesSites.length} sites to CSV`);
  }

  function handleToggle(site: PpPagesSite) {
    dispatch({ type: "TOGGLE_PAGES_SITE", id: site.id });
    toast.success(`Site ${site.name} ${site.status === "Active" ? "stopped" : "started"}`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_PAGES_SITE", id: deleteTarget.id });
    toast.success("Site deleted");
    setDeleteTarget(null);
  }

  const columns: DataTableColumn<PpPagesSite>[] = [
    {
      key: "name",
      header: "Site",
      render: (s) => (
        <>
          <strong>{s.name}</strong>
          <br />
          <span className={styles.muted} style={{ fontSize: 11 }}>
            <code className={styles.code}>{s.url}</code>
          </span>
        </>
      ),
    },
    { key: "env", header: "Environment", render: (s) => envNameById.get(s.envId) ?? s.envId },
    { key: "status", header: "Status", render: (s) => <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill> },
    { key: "template", header: "Template", render: (s) => s.template },
    { key: "pageViews", header: "Page views / 30d", render: (s) => s.pageViews30d.toLocaleString() },
    {
      key: "actions",
      header: "Actions",
      render: (s) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={styles.rowLink} onClick={() => handleToggle(s)}>
            {s.status === "Active" ? "Stop" : "Start"}
          </button>
          <button
            type="button"
            className={styles.rowLink}
            style={{ color: "#a4262c" }}
            onClick={() => setDeleteTarget(s)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Power Pages sites</div>
      <div className={styles.pageSub}>Low-code business websites in the tenant.</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => setShowNew(true)}>
          + New site
        </button>
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export CSV
        </button>
      </div>

      <DataTable columns={columns} rows={state.pagesSites} getRowKey={(s) => s.id} emptyMessage="No Power Pages sites yet." />

      {showNew ? <NewSiteModal state={state} dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}

      {deleteTarget ? (
        <Modal
          title="Delete site"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete site <strong>{deleteTarget.name}</strong>? This cannot be undone.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function NewSiteModal({
  state,
  dispatch,
  onClose,
}: {
  state: PpState;
  dispatch: React.Dispatch<PpAction>;
  onClose: () => void;
}) {
  const [name, setName] = useState("New site");
  const [envId, setEnvId] = useState(state.environments[0]?.id ?? "");
  const [template, setTemplate] = useState(PAGES_TEMPLATES[0]);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning("Site name is required.");
      return;
    }
    if (!envId) {
      toast.warning("Select an environment.");
      return;
    }
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "new-site";
    dispatch({
      type: "ADD_PAGES_SITE",
      site: {
        id: genPagesSiteId(),
        name: trimmed,
        envId,
        url: `https://${slug}.powerappsportals.com`,
        status: "Active",
        createdOn: new Date().toISOString().slice(0, 10),
        template,
        pageViews30d: 0,
      },
    });
    toast.success(`Provisioning ${trimmed} — site URL active in ~3 minutes`);
    onClose();
  }

  return (
    <Modal
      title="Create a Power Pages site"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleCreate}>
            Create site
          </button>
        </>
      }
    >
      <Field label="Site name">
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Environment">
        <NativeSelect value={envId} onChange={setEnvId} options={state.environments.map((e) => ({ value: e.id, label: e.name }))} />
      </Field>
      <Field label="Template">
        <NativeSelect value={template} onChange={setTemplate} options={PAGES_TEMPLATES.map((t) => ({ value: t, label: t }))} />
      </Field>
    </Modal>
  );
}

// ===================================================================
// 2. Power BI workspaces
// ===================================================================

function genBiWorkspaceId(): string {
  return `bi-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function PowerBiWorkspacesPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [showNew, setShowNew] = useState(false);
  const { workspaces, tenantSettings } = state.powerBI;

  const totalCapacityMB = workspaces.reduce((acc, w) => acc + w.capacityUsedMB, 0);

  function handleSettingChange(patch: Partial<typeof tenantSettings>) {
    dispatch({ type: "UPDATE_BI_TENANT_SETTINGS", patch });
    toast.success("Tenant setting updated. Affects all users within 15 minutes.");
  }

  const columns: DataTableColumn<PpBiWorkspace>[] = [
    { key: "name", header: "Name", render: (w) => <strong>{w.name}</strong> },
    { key: "type", header: "Type", render: (w) => <StatusPill tone={w.type === "My workspace" ? "muted" : "info"}>{w.type}</StatusPill> },
    { key: "capacity", header: "Capacity used", render: (w) => `${(w.capacityUsedMB / 1024).toFixed(2)} GB` },
    { key: "reports", header: "Reports", render: (w) => w.reports },
    { key: "datasets", header: "Datasets", render: (w) => w.datasets },
    { key: "members", header: "Members", render: (w) => w.members },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Power BI workspaces</div>
      <div className={styles.pageSub}>Tenant-level admin view of Power BI workspaces and tenant policies.</div>

      <StatRow
        stats={[
          { label: "Workspaces", value: workspaces.length },
          { label: "Members", value: workspaces.reduce((a, w) => a + w.members, 0) },
          { label: "Datasets", value: workspaces.reduce((a, w) => a + w.datasets, 0) },
          { label: "Reports", value: workspaces.reduce((a, w) => a + w.reports, 0) },
          { label: "Capacity used", value: `${(totalCapacityMB / 1024).toFixed(1)} GB` },
        ]}
      />

      <div className={styles.toolbar}>
        <button type="button" className={styles.btn} onClick={() => setShowNew(true)}>
          + New workspace
        </button>
      </div>

      <DataTable columns={columns} rows={workspaces} getRowKey={(w) => w.id} emptyMessage="No Power BI workspaces yet." />

      <div className={styles.h2}>Tenant settings</div>
      <div className={styles.card}>
        <Checkbox
          label="Export to Excel / CSV / PDF enabled"
          checked={tenantSettings.exportEnabled}
          onChange={(checked) => handleSettingChange({ exportEnabled: checked })}
        />
        <Checkbox
          label="Publish to web enabled"
          checked={tenantSettings.publishToWebEnabled}
          onChange={(checked) => handleSettingChange({ publishToWebEnabled: checked })}
        />
        <Checkbox
          label="Guest access enabled"
          checked={tenantSettings.guestAccessEnabled}
          onChange={(checked) => handleSettingChange({ guestAccessEnabled: checked })}
        />
      </div>

      {showNew ? <NewWorkspaceModal dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}
    </div>
  );
}

function NewWorkspaceModal({ dispatch, onClose }: { dispatch: React.Dispatch<PpAction>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PpBiWorkspace["type"]>("Workspace");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning("Workspace name is required.");
      return;
    }
    dispatch({
      type: "ADD_BI_WORKSPACE",
      workspace: {
        id: genBiWorkspaceId(),
        name: trimmed,
        type,
        capacityUsedMB: 0,
        reports: 0,
        datasets: 0,
        members: 1,
      },
    });
    toast.success(`Workspace ${trimmed} created`);
    onClose();
  }

  return (
    <Modal
      title="Create a Power BI workspace"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleCreate}>
            Create workspace
          </button>
        </>
      }
    >
      <Field label="Workspace name">
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Type">
        <NativeSelect
          value={type}
          onChange={(v) => setType(v as PpBiWorkspace["type"])}
          options={[
            { value: "Workspace", label: "Workspace" },
            { value: "My workspace", label: "My workspace" },
          ]}
        />
      </Field>
    </Modal>
  );
}

// ===================================================================
// 3. Tenant isolation
// ===================================================================

export function TenantIsolationPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [newDomain, setNewDomain] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const { isolation } = state.security;

  function handleToggle() {
    dispatch({ type: "TOGGLE_TENANT_ISOLATION" });
    toast.success(`Tenant isolation ${isolation.enabled ? "disabled" : "enabled"}`);
  }

  function handleAddDomain() {
    const domain = newDomain.trim();
    if (!domain) {
      toast.warning("Enter a tenant domain.");
      return;
    }
    if (isolation.allowList.includes(domain)) {
      toast.info("Already allowed");
      return;
    }
    dispatch({ type: "ADD_ISOLATION_ALLOWED_DOMAIN", domain });
    toast.success(`Added ${domain} to allow-list`);
    setNewDomain("");
  }

  function handleRemove() {
    if (!removeTarget) return;
    dispatch({ type: "REMOVE_ISOLATION_ALLOWED_DOMAIN", domain: removeTarget });
    toast.success(`${removeTarget} removed`);
    setRemoveTarget(null);
  }

  return (
    <div>
      <div className={styles.pageH1}>Tenant isolation</div>
      <div className={styles.pageSub}>
        Restrict inbound and outbound Power Platform connections to and from other tenants. When enabled, makers cannot create
        connections to external tenants except those on the allow-list.
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Tenant isolation</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={isolation.enabled} onChange={handleToggle} />
            <span className={styles.slider} />
          </label>
          <span>Restrict cross-tenant Power Platform connections by default.</span>
        </div>
        <div className={styles.muted} style={{ fontSize: 12, marginTop: 8 }}>
          {isolation.enabled
            ? `Cross-tenant connections are BLOCKED unless the partner tenant is in the allow-list. Mode: ${isolation.mode}.`
            : "All cross-tenant connections are allowed (not recommended for production)."}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Allowed tenants ({isolation.allowList.length})</div>
        {isolation.allowList.length === 0 ? (
          <EmptyState message="No tenants allowed. With isolation ON, all cross-tenant connections will be blocked." />
        ) : (
          <div className={styles.tableWrap} style={{ marginTop: 8 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tenant domain</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {isolation.allowList.map((domain) => (
                  <tr key={domain}>
                    <td>
                      <code className={styles.code}>{domain}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.rowLink}
                        style={{ color: "#a4262c" }}
                        onClick={() => setRemoveTarget(domain)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Field label="Tenant domain">
            <input
              className={styles.input}
              placeholder="contoso.onmicrosoft.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
          </Field>
          <button type="button" className={styles.btn} onClick={handleAddDomain}>
            + Add tenant to allow-list
          </button>
        </div>
      </div>

      {removeTarget ? (
        <Modal
          title="Remove tenant"
          onClose={() => setRemoveTarget(null)}
          footer={
            <>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => setRemoveTarget(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleRemove}>
                Remove
              </button>
            </>
          }
        >
          <p>
            Remove <strong>{removeTarget}</strong> from the allow-list? Existing connections to this tenant will be blocked.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// 4. Customer Lockbox
// ===================================================================

export function CustomerLockboxPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [denyTarget, setDenyTarget] = useState<PpLockboxRequest | null>(null);
  const { lockbox } = state.security;
  const pending = lockbox.requests.filter((r) => r.status === "Pending").length;

  function handleToggle() {
    dispatch({ type: "TOGGLE_LOCKBOX" });
    toast.success(`Customer Lockbox ${lockbox.enabled ? "disabled" : "enabled"}`);
  }

  function handleApprove(request: PpLockboxRequest) {
    dispatch({ type: "RESOLVE_LOCKBOX_REQUEST", id: request.id, status: "Approved" });
    toast.success("Access approved — engineer can begin investigation");
  }

  function handleDeny() {
    if (!denyTarget) return;
    dispatch({ type: "RESOLVE_LOCKBOX_REQUEST", id: denyTarget.id, status: "Denied" });
    toast.success("Access denied");
    setDenyTarget(null);
  }

  const columns: DataTableColumn<PpLockboxRequest>[] = [
    { key: "requestedBy", header: "Requested by", render: (r) => r.requestedBy },
    { key: "reason", header: "Reason", render: (r) => <span style={{ fontSize: 12 }}>{r.reason}</span> },
    { key: "requestedOn", header: "Requested on", render: (r) => new Date(r.requestedOn).toLocaleString() },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
    {
      key: "actions",
      header: "Actions",
      render: (r) =>
        r.status === "Pending" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={styles.rowLink} onClick={() => handleApprove(r)}>
              Approve
            </button>
            <button type="button" className={styles.rowLink} style={{ color: "#a4262c" }} onClick={() => setDenyTarget(r)}>
              Deny
            </button>
          </div>
        ) : (
          <span className={styles.muted} style={{ fontSize: 11 }}>
            Decided
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Customer Lockbox</div>
      <div className={styles.pageSub}>
        Approve Microsoft engineer access requests to your Power Platform data. With Lockbox ON, no Microsoft engineer can
        read your data without your explicit approval.
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Customer Lockbox</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={lockbox.enabled} onChange={handleToggle} />
            <span className={styles.slider} />
          </label>
          <span>Require explicit approval before a Microsoft support engineer can access tenant data.</span>
        </div>
        <div className={styles.muted} style={{ fontSize: 12, marginTop: 8 }}>
          {lockbox.enabled
            ? pending > 0
              ? `${pending} request${pending === 1 ? "" : "s"} awaiting approval.`
              : "No pending requests."
            : "Lockbox is OFF — Microsoft engineers have standing access (audit-logged but not approval-gated)."}
        </div>
      </div>

      <div className={styles.h2}>Access request history</div>
      <DataTable columns={columns} rows={lockbox.requests} getRowKey={(r) => r.id} emptyMessage="No requests." />

      {denyTarget ? (
        <Modal
          title="Deny access request"
          onClose={() => setDenyTarget(null)}
          footer={
            <>
              <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={() => setDenyTarget(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDeny}>
                Deny
              </button>
            </>
          }
        >
          <p>
            Deny this access request from <strong>{denyTarget.requestedBy}</strong>? The engineer will not be able to access
            data and the support case may be delayed.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// 5. Customer-managed key (CMK)
// ===================================================================

// ADVANCE_CMK_SETUP (reducer.ts) is a single-step transition per dispatch:
// Validating -> Re-encrypting -> Active. Two consecutive "Advance" clicks are
// needed to reach Active from a freshly-started setup — reflected below by
// always presenting one "Advance to <next status>" action at a time rather
// than jumping straight to Active.
function nextCmkStatus(status: PpCmk["status"]): PpCmk["status"] | null {
  if (status === "Validating") return "Re-encrypting";
  if (status === "Re-encrypting") return "Active";
  return null;
}

export function CustomerManagedKeyPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [showSetup, setShowSetup] = useState(false);
  const { cmk } = state.security;
  const next = nextCmkStatus(cmk.status);

  function handleAdvance() {
    dispatch({ type: "ADVANCE_CMK_SETUP" });
    if (next) toast.success(`Customer-managed key setup advanced to ${next}`);
  }

  return (
    <div>
      <div className={styles.pageH1}>Customer-managed key</div>
      <div className={styles.pageSub}>
        Encrypt your Dataverse data using a key stored in your own Azure Key Vault. By default Microsoft manages the
        encryption key — switching to CMK gives you key custody.
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Encryption key</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <StatusPill tone={statusTone(cmk.status)}>{cmk.status}</StatusPill>
          {cmk.keyVaultUri ? (
            <code className={styles.code}>{cmk.keyVaultUri}</code>
          ) : null}
        </div>

        {cmk.status === "Not configured" ? (
          <>
            <div className={styles.muted}>
              No customer-managed key configured. Dataverse is encrypted with a Microsoft-managed key (default — meets ISO
              27001, SOC 2, HIPAA).
            </div>
            {showSetup ? (
              <CmkSetupForm dispatch={dispatch} onDone={() => setShowSetup(false)} />
            ) : (
              <div style={{ marginTop: 10 }}>
                <button type="button" className={styles.btn} onClick={() => setShowSetup(true)}>
                  Configure key
                </button>
              </div>
            )}
          </>
        ) : cmk.status === "Validating" || cmk.status === "Re-encrypting" ? (
          <>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: cmk.status === "Validating" ? "40%" : "80%" }} />
            </div>
            <div className={styles.muted} style={{ fontSize: 12, marginBottom: 10 }}>
              {cmk.status === "Validating"
                ? "Validating Power Platform service principal access to the specified key…"
                : "Re-encrypting Dataverse tables with the new key. This can take 1-4 hours in a real tenant."}
            </div>
            <button type="button" className={styles.btn} onClick={handleAdvance}>
              Advance to {next}
            </button>
          </>
        ) : (
          <div className={styles.muted}>
            Dataverse is fully encrypted with your customer-managed key. All tables have completed re-encryption.
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>When to use CMK?</div>
        <ul style={{ margin: "8px 0 0 18px", fontSize: 13, lineHeight: 1.7 }}>
          <li>Regulatory requirement (banking, healthcare, defence — some interpretations of GDPR Article 32, HIPAA 164.312).</li>
          <li>
            You need the ability to <b>revoke access</b> instantly by deleting / disabling the key (data becomes unreadable).
          </li>
          <li>
            Your security team wants to <b>audit every key access</b> via Key Vault diagnostic logs.
          </li>
        </ul>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#605e5c" }}>
          <b>Cost:</b> ~$1/key/month + KV operations. <b>Recovery:</b> if you lose the key permanently, your Dataverse data
          is unrecoverable — back up the Key Vault.
        </p>
      </div>
    </div>
  );
}

function CmkSetupForm({ dispatch, onDone }: { dispatch: React.Dispatch<PpAction>; onDone: () => void }) {
  const [keyVaultUri, setKeyVaultUri] = useState("");

  function handleSetup() {
    const trimmed = keyVaultUri.trim();
    if (!trimmed) {
      toast.warning("Key Vault URI is required.");
      return;
    }
    dispatch({ type: "START_CMK_SETUP", keyVaultUri: trimmed });
    toast.success("CMK setup started — validating Key Vault access.");
    onDone();
  }

  return (
    <div style={{ marginTop: 12 }}>
      <Field label="Key Vault URI" help="The Key Vault must be in the same Entra tenant, with wrapKey + unwrapKey granted to the Power Platform service principal.">
        <input
          className={styles.input}
          placeholder="https://cloudlab-prod-kv.vault.azure.net/keys/dataverse-encryption-key"
          value={keyVaultUri}
          onChange={(e) => setKeyVaultUri(e.target.value)}
        />
      </Field>
      <button type="button" className={styles.btn} onClick={handleSetup}>
        Set up
      </button>
    </div>
  );
}

// ===================================================================
// 6. Settings
// ===================================================================

// Read-only tenant info + at-a-glance security posture. Source's
// renderSettingsCard() has per-row edit controls (edit-text/edit-number/
// toggle/select), but none of those wire to a real, already-built reducer
// action — the ONLY real settings actions in reducer.ts are isolation/
// lockbox/CMK, which already have their own dedicated pages. So this page
// stays read-only per the porting brief, linking out to those pages rather
// than duplicating their controls.
export function SettingsPage({ state }: { state: PpState }) {
  const { tenant, security } = state;

  return (
    <div>
      <div className={styles.pageH1}>Settings</div>
      <div className={styles.pageSub}>Tenant-wide configuration for {tenant.name}.</div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Tenant info</div>
        <div className={styles.reviewGrid}>
          <div className={styles.lbl}>Tenant name</div>
          <div>{tenant.name}</div>
          <div className={styles.lbl}>Domain</div>
          <div>
            <code className={styles.code}>{tenant.domain}</code>
          </div>
          <div className={styles.lbl}>Tenant ID</div>
          <div>
            <code className={styles.code}>{tenant.tenantId}</code>
          </div>
          <div className={styles.lbl}>Region</div>
          <div>{tenant.region}</div>
        </div>
      </div>

      <div className={styles.h2}>Privacy + security at a glance</div>
      <div className={styles.cardGrid}>
        <div className={styles.tile}>
          <div className={styles.tileTitle}>Tenant isolation</div>
          <div className={styles.tileSub}>
            <StatusPill tone={security.isolation.enabled ? "default" : "muted"}>
              {security.isolation.enabled ? "Enabled" : "Disabled"}
            </StatusPill>{" "}
            &middot; {security.isolation.allowList.length} tenant(s) allow-listed
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileTitle}>Customer Lockbox</div>
          <div className={styles.tileSub}>
            <StatusPill tone={security.lockbox.enabled ? "default" : "muted"}>
              {security.lockbox.enabled ? "Enabled" : "Disabled"}
            </StatusPill>{" "}
            &middot; {security.lockbox.requests.filter((r) => r.status === "Pending").length} pending request(s)
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileTitle}>Customer-managed key</div>
          <div className={styles.tileSub}>
            <StatusPill tone={statusTone(security.cmk.status)}>{security.cmk.status}</StatusPill>
          </div>
        </div>
      </div>
    </div>
  );
}
