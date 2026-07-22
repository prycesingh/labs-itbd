"use client";

// Power Apps inventory page for the Power Platform Admin Center simulator.
// Ported from itbd-lab/simulators/powerplatform/js/pp-apps.js (503 lines):
// a filterable table of every canvas/model-driven app in the tenant, a
// detail flyout (Details / Sharing / Canvas Studio tabs), a "Share app"
// mini-flow, and CSV export.
//
// Filtering: source used filter chips (all/personal/shared/recent/canvas/
// model) plus a free-text search box. This port follows the porting brief's
// requested filter bar shape instead — environment `NativeSelect`, type
// `NativeSelect` (Canvas/Model-driven/All), and an owner text filter — which
// covers the same underlying app fields (`envId`, `type`, `owner`) source's
// chips/search partially exposed, via the shared NativeSelect/Field
// primitives rather than hand-rolled filter-chip markup.
//
// Known source bug fixed here, not replicated: source's exportCsv() read
// `a.environment` and `a.status` — neither field exists on the real `PpApp`
// object (see types.ts: apps have `envId`, not `environment`; there is no
// `status` field on apps at all, only on flows — see `PpFlow.status`).
// This port resolves `envId` -> environment name for the export column and
// drops the status column entirely rather than fabricating one.
//
// Canvas Studio: source's flyStudio() is a large (~200 line) 4-pane mockup
// of the real Power Apps Studio editor (tree view / insert panel / phone
// preview / properties pane) with click-to-select screens/controls and a
// hardcoded BrowseScreen/DetailScreen/EditScreen inventory-app preview. Per
// the porting brief this is ported as a simplified STATIC illustrative
// mockup (not a real editor, no per-control selection state) — a
// phone-shaped frame with placeholder label/button/gallery/form blocks,
// clearly read-only, using only existing pp-console.module.css classes.
//
// No native prompt()/alert()/confirm() anywhere — all confirmations route
// through toast (sonner), per house convention (see overview-page.tsx /
// analytics-capacity-licenses-page.tsx for the sibling idiom this follows).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PpApp, PpConnector, PpState } from "@/lib/labs/simulators/power-platform/types";
import type { PpAction } from "@/lib/labs/simulators/power-platform/reducer";
import {
  DataTable,
  Field,
  Flyout,
  NativeSelect,
  StatusPill,
  TabBar,
  exportCsv,
  type DataTableColumn,
} from "./pp-ui";
import styles from "./pp-console.module.css";

type DetailTab = "details" | "sharing" | "studio";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "Canvas", label: "Canvas" },
  { value: "Model-driven", label: "Model-driven" },
];

export function AppsPage({ state, dispatch }: { state: PpState; dispatch: React.Dispatch<PpAction> }) {
  const [envFilter, setEnvFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("");

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("details");

  const envNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const env of state.environments) map.set(env.id, env.name);
    return map;
  }, [state.environments]);

  const connectorById = useMemo(() => {
    const map = new Map<string, PpConnector>();
    for (const c of state.connectors) map.set(c.id, c);
    return map;
  }, [state.connectors]);

  const filteredApps = useMemo(() => {
    const ownerQuery = ownerFilter.trim().toLowerCase();
    return state.apps.filter((a) => {
      if (envFilter !== "all" && a.envId !== envFilter) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (ownerQuery && !a.owner.toLowerCase().includes(ownerQuery)) return false;
      return true;
    });
  }, [state.apps, envFilter, typeFilter, ownerFilter]);

  const selectedApp = selectedAppId ? state.apps.find((a) => a.id === selectedAppId) ?? null : null;

  function openDetail(app: PpApp) {
    setSelectedAppId(app.id);
    setDetailTab("details");
  }

  function closeDetail() {
    setSelectedAppId(null);
  }

  function handleExport() {
    const headers = ["Name", "Type", "Owner", "Environment", "Shared with", "Connectors", "Last modified"];
    const rows = state.apps.map((a) => [
      a.name,
      a.type,
      a.owner,
      envNameById.get(a.envId) ?? a.envId,
      a.sharedCount,
      a.connectors.length,
      a.modified,
    ]);
    exportCsv("powerapps-inventory.csv", headers, rows);
    toast.success(`Exported ${state.apps.length} apps to CSV`);
  }

  const columns: DataTableColumn<PpApp>[] = [
    { key: "name", header: "Name", render: (a) => <strong>{a.name}</strong> },
    { key: "type", header: "Type", render: (a) => <StatusPill tone={a.type === "Model-driven" ? "info" : "muted"}>{a.type}</StatusPill> },
    { key: "owner", header: "App owner", render: (a) => a.owner },
    { key: "envId", header: "Environment", render: (a) => envNameById.get(a.envId) ?? a.envId },
    { key: "sharedCount", header: "Sharing", render: (a) => (a.sharedCount > 0 ? `${a.sharedCount} users` : <span className={styles.muted}>Private</span>) },
    { key: "modified", header: "Last modified", render: (a) => a.modified },
    {
      key: "dlp",
      header: "DLP",
      render: (a) => (a.dlpFlagged ? <StatusPill tone="err">Flagged</StatusPill> : <span className={styles.muted}>&mdash;</span>),
    },
  ];

  return (
    <div>
      <div className={styles.pageH1}>Power Apps inventory</div>
      <div className={styles.pageSub}>Every canvas and model-driven app across the tenant.</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export to CSV
        </button>
      </div>

      <div className={styles.filterRow}>
        <NativeSelect
          value={envFilter}
          onChange={setEnvFilter}
          options={[{ value: "all", label: "All environments" }, ...state.environments.map((e) => ({ value: e.id, label: e.name }))]}
        />
        <NativeSelect value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
        <input
          className={styles.input}
          style={{ maxWidth: 240 }}
          placeholder="Filter by owner"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        />
      </div>

      <DataTable columns={columns} rows={filteredApps} getRowKey={(a) => a.id} onRowClick={openDetail} emptyMessage="No apps match your filter." />

      {selectedApp ? (
        <AppDetailFlyout
          app={selectedApp}
          dispatch={dispatch}
          envNameById={envNameById}
          connectorById={connectorById}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={closeDetail}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// Detail flyout
// ===================================================================

function AppDetailFlyout({
  app,
  dispatch,
  envNameById,
  connectorById,
  tab,
  onTabChange,
  onClose,
}: {
  app: PpApp;
  dispatch: React.Dispatch<PpAction>;
  envNameById: Map<string, string>;
  connectorById: Map<string, PpConnector>;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
}) {
  const envName = envNameById.get(app.envId) ?? app.envId;

  const tabs = [
    { key: "details", label: "Details" },
    { key: "sharing", label: "Sharing" },
    ...(app.type === "Canvas" ? [{ key: "studio", label: "Canvas Studio" }] : []),
  ];

  return (
    <Flyout
      title={app.name}
      subtitle={
        <>
          {app.type} &middot; {envName} &middot; {app.owner}
        </>
      }
      onClose={onClose}
      tabs={<TabBar tabs={tabs} active={tab} onChange={(key) => onTabChange(key as DetailTab)} />}
      footer={
        <button type="button" className={`${styles.btnOutline} ${styles.btn}`} onClick={onClose}>
          Close
        </button>
      }
    >
      {tab === "details" ? <DetailsTab app={app} envName={envName} connectorById={connectorById} /> : null}
      {tab === "sharing" ? <SharingTab app={app} dispatch={dispatch} /> : null}
      {tab === "studio" && app.type === "Canvas" ? <CanvasStudioTab /> : null}
    </Flyout>
  );
}

// ----- Details tab -----
function DetailsTab({
  app,
  envName,
  connectorById,
}: {
  app: PpApp;
  envName: string;
  connectorById: Map<string, PpConnector>;
}) {
  return (
    <div>
      <div className={styles.reviewGrid}>
        <div className={styles.lbl}>App owner</div>
        <div>{app.owner}</div>
        <div className={styles.lbl}>Environment</div>
        <div>{envName}</div>
        <div className={styles.lbl}>Created on</div>
        <div>{app.created}</div>
        <div className={styles.lbl}>Last modified</div>
        <div>{app.modified}</div>
        <div className={styles.lbl}>Shared with</div>
        <div>{app.sharedCount > 0 ? `${app.sharedCount} users` : "Private"}</div>
        {app.dlpFlagged ? (
          <>
            <div className={styles.lbl}>DLP status</div>
            <div>
              <StatusPill tone="err">Flagged{app.dlpFlagReason ? `: ${app.dlpFlagReason}` : ""}</StatusPill>
            </div>
          </>
        ) : null}
      </div>

      <div className={styles.h3}>Connectors used</div>
      {app.connectors.length === 0 ? (
        <div className={styles.empty}>No connectors in use.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Connector</th>
                <th>Publisher</th>
                <th>Tier</th>
                <th>DLP class</th>
              </tr>
            </thead>
            <tbody>
              {app.connectors.map((cid) => {
                const c = connectorById.get(cid);
                if (!c) return null;
                return (
                  <tr key={cid}>
                    <td>{c.name}</td>
                    <td>{c.publisher}</td>
                    <td>
                      <StatusPill tone={c.premium ? "warn" : "muted"}>{c.premium ? "Premium" : "Standard"}</StatusPill>
                    </td>
                    <td>
                      <StatusPill tone="info">{c.def}</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----- Sharing tab -----
function SharingTab({ app, dispatch }: { app: PpApp; dispatch: React.Dispatch<PpAction> }) {
  const [who, setWho] = useState("");
  const [role, setRole] = useState("Can use");

  function handleShare() {
    const target = who.trim();
    if (!target) {
      toast.warning("Enter a user or group.");
      return;
    }
    dispatch({ type: "SHARE_APP", id: app.id });
    toast.success(`Shared with ${target} as ${role}`);
    setWho("");
  }

  return (
    <div>
      <div className={styles.h3}>Owner</div>
      <div className={styles.card} style={{ padding: 10 }}>
        <strong>{app.owner}</strong> &middot; <span className={styles.muted}>App owner</span>
      </div>

      <div className={styles.h3}>Shared with</div>
      {app.sharedCount > 0 ? (
        <div className={styles.card} style={{ padding: 10 }}>
          <span className={styles.muted}>{app.sharedCount} users currently have access to this app.</span>
        </div>
      ) : (
        <div className={styles.empty}>No one else has access yet.</div>
      )}

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Add user
      </div>
      <div className={styles.formRow}>
        <Field label="Add user or group">
          <input
            className={styles.input}
            placeholder="user@cloudlab.in or group name"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          />
        </Field>
        <Field label="Role">
          <NativeSelect
            value={role}
            onChange={setRole}
            options={[
              { value: "Can use", label: "Can use" },
              { value: "Co-owner", label: "Co-owner" },
            ]}
          />
        </Field>
      </div>
      <button type="button" className={styles.btn} onClick={handleShare}>
        Share
      </button>
    </div>
  );
}

// ----- Canvas Studio tab -----
// Static, read-only illustrative mockup — NOT a real editor. Ported down from
// source's flyStudio() 4-pane layout (tree view / insert panel / phone
// preview / properties pane) into a single simplified phone-frame preview
// with placeholder control blocks (label, button, gallery, form), matching
// the porting brief. No selection state, no editable formulas.
function CanvasStudioTab() {
  return (
    <div>
      <div className={styles.h3}>Canvas Studio (preview)</div>
      <div className={styles.pageSub}>
        A simplified, read-only illustration of this app&apos;s screens and controls — not the real editor.
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
        <div
          style={{
            background: "#fff",
            width: 280,
            border: "1px solid #c8c6c4",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Label control (header) */}
          <div style={{ background: "#742774", color: "#fff", padding: "12px 14px", fontWeight: 600, fontSize: 13 }}>BrowseScreen</div>

          {/* Text input control */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #edebe9" }}>
            <div style={{ border: "1px solid #c8c6c4", borderRadius: 2, padding: 6, fontSize: 11, color: "#605e5c" }}>
              🔍 Search...
            </div>
          </div>

          {/* Gallery control */}
          <div style={{ flex: 1, background: "#faf9f8", padding: "6px 0" }}>
            {["Item one", "Item two", "Item three"].map((label) => (
              <div
                key={label}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #edebe9",
                  fontSize: 11,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{label}</span>
                <span style={{ color: "#605e5c" }}>&rsaquo;</span>
              </div>
            ))}
          </div>

          {/* Button control (form action) */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid #edebe9" }}>
            <div
              style={{
                background: "#742774",
                color: "#fff",
                textAlign: "center",
                padding: "8px",
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              + New
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#f4eaf7",
          padding: "10px 14px",
          borderLeft: "3px solid #742774",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <b>About this view:</b> Illustrative only — a simplified mockup of a canvas app&apos;s screen layout (label, search input,
        gallery, and a primary action button). The real Power Apps Studio at <code className={styles.code}>make.powerapps.com</code>{" "}
        provides a full drag-and-drop editor with a tree view, insert panel, live preview, and a Power Fx formula bar.
      </div>
    </div>
  );
}
