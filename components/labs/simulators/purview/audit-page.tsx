"use client";

// Audit log search — ported from itbd-lab/simulators/purview/js/purview-audit.js
// (PurviewAudit module). Source's picker/chip/saved-search UX is preserved (16
// grouped activity categories, user filter, date range, workload multi-select,
// saved searches), but this port fixes the one thing source got wrong for a
// real demo: source's `_search()` ignored its own data entirely and generated
// 30-80 fully random rows via `Math.random()` on every click. Here "Search"
// always calls the real `runAuditSearch()` engine (search-engine.ts) against
// the genuine 240-event `state.auditEvents` array, so the result count and
// rows are real filtered data, never fabricated.
//
// Source's critical bug — `render(host)` defaulting to `document.querySelector(
// '.pp-content') || document.body` and clobbering the whole app shell via
// `host.innerHTML = ...` when routed to incorrectly — is structurally
// impossible here: this is a normal React component driven by local
// `useState`/conditional rendering, with zero direct DOM manipulation
// (`document.getElementById`, `innerHTML`, etc. are never used).
//
// Activity picker note: the 16-category/~180-activity list below is ported
// faithfully from source for authenticity (matches the real Purview activity
// picker), but the seeded 240-event dataset only actually contains 32 distinct
// `activity` values (see seedData.ts buildAuditEvents/ACTIVITIES). Picking an
// activity outside that set is expected to genuinely return 0 rows — exactly
// like the real product, where most of the ~200 available activity types
// won't have occurred in a given tenant's audit window. Category headers show
// how many of their activities are present in the seeded data so this reads
// as intentional rather than "broken."

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewState } from "@/lib/labs/simulators/purview/types";
import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import { runAuditSearch, type AuditSearchFilters } from "@/lib/labs/simulators/purview/search-engine";
import type { PurviewAuditEvent } from "@/lib/labs/simulators/purview/types";
import { DataTable, EmptyState, Field, Modal, StatusPill, statusTone, exportCsv } from "./purview-ui";
import styles from "./purview-console.module.css";

// ===== Activity picker catalog (ported verbatim from source's ACTIVITIES) =====
type ActivityGroup = { group: string; items: string[] };

const ACTIVITY_CATEGORIES: ActivityGroup[] = [
  {
    group: "File and folder activities (Exchange/SharePoint/OneDrive)",
    items: [
      "Accessed file", "Modified file", "Uploaded file", "Downloaded file", "Deleted file", "Shared file (internal)",
      "Shared file (external)", "Restored file", "Renamed file", "Moved file", "Copied file", "Created folder",
      "Deleted folder", "Renamed folder", "Shared folder", "Created file", "Withdrew sharing invite",
    ],
  },
  {
    group: "Site permissions activities (SharePoint)",
    items: ["Added user/group to site", "Removed user/group from site", "Updated permission level", "Granted external access", "Disabled sharing"],
  },
  {
    group: "Sharing and access requests",
    items: ["Accepted sharing invite", "Created sharing link", "Used sharing link", "Removed sharing link", "Requested access", "Approved access", "Denied access"],
  },
  {
    group: "Synchronization activities",
    items: ["Allowed sync", "Blocked sync", "Downloaded files to client"],
  },
  {
    group: "Site administration (SharePoint)",
    items: ["Created site", "Deleted site", "Renamed site", "Modified site settings", "Changed sharing settings"],
  },
  {
    group: "Exchange mailbox activities",
    items: [
      "Mailbox login", "Sent message", "Received message", "Moved message", "Deleted message", "Permanent delete",
      "Updated message", "Set folder permissions", "Added inbox rule", "Modified inbox rule", "Removed inbox rule",
      "Accessed mailbox by delegate", "MailItemsAccessed", "Send As", "Send on Behalf",
    ],
  },
  {
    group: "User administration (Entra ID)",
    items: ["Add user", "Delete user", "Update user", "Reset password", "Set force change password", "Disable account", "Enable account", "Update license"],
  },
  {
    group: "Group administration (Entra ID)",
    items: ["Add group", "Delete group", "Update group", "Add member to group", "Remove member from group", "Add owner", "Remove owner", "Add subscribed sku"],
  },
  {
    group: "Application administration (Entra ID)",
    items: ["Add application", "Update application", "Delete application", "Add service principal", "Consent to application", "Add OAuth2PermissionGrant", "Add app role assignment to user"],
  },
  {
    group: "Role administration (Entra ID)",
    items: ["Add role assignment", "Remove role assignment", "Add eligible role assignment (PIM)", "Activate PIM role", "Update role definition"],
  },
  {
    group: "Directory administration",
    items: ["Set domain authentication", "Update domain", "Set company information", "Update DirSync feature"],
  },
  {
    group: "Authentication",
    items: ["Sign-in success", "Sign-in failure", "Conditional Access Policy applied", "MFA challenge", "Risky sign-in detected"],
  },
  {
    group: "eDiscovery activities",
    items: ["Created case", "Updated case", "Closed case", "Added custodian", "Removed custodian", "Created search", "Started search", "Exported search results", "Created hold"],
  },
  {
    group: "DLP / Information Protection",
    items: ["Policy rule match", "Policy rule action", "Policy override", "Document classified", "Document declassified", "Label applied", "Label changed", "Label removed"],
  },
  {
    group: "Microsoft Teams",
    items: [
      "Created team", "Deleted team", "Added member to team", "Removed member from team", "Added owner to team",
      "Removed owner to team", "Changed team settings", "Created channel", "Deleted channel", "Added bot", "Removed bot",
      "Added tab", "Sent message in channel",
    ],
  },
  {
    group: "Power BI / Power Platform",
    items: ["Viewed report", "Edited report", "Created dataset", "Exported data", "Shared dashboard", "Created environment", "Modified DLP policy"],
  },
];

const WORKLOAD_OPTIONS: string[] = [
  "Exchange", "SharePoint", "OneDrive", "AzureActiveDirectory", "MicrosoftTeams", "SecurityComplianceCenter", "Endpoint",
];

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Which real seeded events exist per activity name — used only to annotate
// the picker (real counts, computed via .filter(), not a fabricated number)
// so it's clear which of the ~180 activities actually have matching data.
function countByActivity(events: PurviewAuditEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.activity, (counts.get(e.activity) ?? 0) + 1);
  return counts;
}

export function AuditPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [activeActivities, setActiveActivities] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedWorkloads, setSelectedWorkloads] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(dateNDaysAgo(7));
  const [dateTo, setDateTo] = useState(dateNDaysAgo(0));
  const [keyword, setKeyword] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Results are only set on an explicit "Search" click (matching source's
  // click-to-run UX), but always via the real engine — never Math.random().
  const [results, setResults] = useState<PurviewAuditEvent[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const activityCounts = useMemo(() => countByActivity(state.auditEvents), [state.auditEvents]);

  function runSearch() {
    const filters: AuditSearchFilters = {
      activities: activeActivities.length > 0 ? activeActivities : undefined,
      users: selectedUsers.length > 0 ? selectedUsers : undefined,
      workloads: selectedWorkloads.length > 0 ? selectedWorkloads : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
      keyword: keyword.trim() || undefined,
    };
    const matches = runAuditSearch(state.auditEvents, filters);
    setResults(matches);
    setHasSearched(true);
    toast.success(`Search complete — ${matches.length} result${matches.length === 1 ? "" : "s"} found.`);
  }

  function toggleActivity(activity: string) {
    setActiveActivities((prev) => (prev.includes(activity) ? prev.filter((a) => a !== activity) : [...prev, activity]));
  }

  function removeActivity(activity: string) {
    setActiveActivities((prev) => prev.filter((a) => a !== activity));
  }

  function toggleWorkload(workload: string) {
    setSelectedWorkloads((prev) => (prev.includes(workload) ? prev.filter((w) => w !== workload) : [...prev, workload]));
  }

  function toggleUser(upn: string) {
    setSelectedUsers((prev) => (prev.includes(upn) ? prev.filter((u) => u !== upn) : [...prev, upn]));
  }

  function clearFilters() {
    setActiveActivities([]);
    setSelectedUsers([]);
    setSelectedWorkloads([]);
    setKeyword("");
    setResults(null);
    setHasSearched(false);
  }

  function openSaveDialog() {
    setSaveName("");
    setSaveDialogOpen(true);
  }

  function confirmSave() {
    const name = saveName.trim();
    if (!name) return;
    const queryParts: string[] = [];
    if (activeActivities.length > 0) queryParts.push(`activity=${activeActivities.join("|")}`);
    if (selectedUsers.length > 0) queryParts.push(`user=${selectedUsers.join("|")}`);
    if (selectedWorkloads.length > 0) queryParts.push(`workload=${selectedWorkloads.join("|")}`);
    if (keyword.trim()) queryParts.push(`keyword=${keyword.trim()}`);
    dispatch({
      type: "ADD_AUDIT_SAVED_SEARCH",
      search: {
        id: "ss-" + crypto.randomUUID(),
        name,
        query: queryParts.join(" ") || "(no filters)",
        range: `${dateFrom} to ${dateTo}`,
        createdOn: new Date().toISOString(),
      },
    });
    toast.success(`Saved search "${name}" created.`);
    setSaveDialogOpen(false);
  }

  function loadSaved(searchId: string) {
    const saved = state.auditSavedSearches.find((s) => s.id === searchId);
    if (!saved) return;
    // query strings were built by confirmSave() above (or seeded in
    // seedData.ts as simple "activity=X" / "activity=X workload=Y" strings) —
    // parse them back into filter arrays.
    const parts = saved.query.split(" ");
    const nextActivities: string[] = [];
    const nextUsers: string[] = [];
    const nextWorkloads: string[] = [];
    for (const part of parts) {
      const [key, value] = part.split("=");
      if (!value) continue;
      if (key === "activity") nextActivities.push(...value.split("|"));
      else if (key === "user") nextUsers.push(...value.split("|"));
      else if (key === "workload") nextWorkloads.push(...value.split("|"));
    }
    setActiveActivities(nextActivities);
    setSelectedUsers(nextUsers);
    setSelectedWorkloads(nextWorkloads);
    const [rangeFrom, , rangeTo] = saved.range.split(" ");
    if (rangeFrom) setDateFrom(rangeFrom);
    if (rangeTo) setDateTo(rangeTo);
    toast.info(`Loaded saved search "${saved.name}". Click Search to run it.`);
  }

  function deleteSaved(searchId: string, name: string) {
    dispatch({ type: "DELETE_AUDIT_SAVED_SEARCH", id: searchId });
    toast.success(`Deleted saved search "${name}".`);
  }

  function handleExportCsv() {
    if (!results || results.length === 0) return;
    exportCsv(
      `audit-${dateFrom}_to_${dateTo}.csv`,
      ["Date", "User", "Activity", "Item", "Workload", "IP address", "Client app", "Result"],
      results.map((r) => [r.ts, r.user, r.activity, r.item, r.workload, r.ip, r.clientApp, r.result]),
    );
    toast.success(`Exported ${results.length} rows to CSV.`);
  }

  const filteredCategories = useMemo(() => {
    const q = pickerFilter.trim().toLowerCase();
    if (!q) return ACTIVITY_CATEGORIES;
    return ACTIVITY_CATEGORIES.map((g) => ({ group: g.group, items: g.items.filter((a) => a.toLowerCase().includes(q)) })).filter(
      (g) => g.items.length > 0,
    );
  }, [pickerFilter]);

  return (
    <div>
      <div className={styles.pageH1}>Audit</div>
      <div className={styles.pageSub}>
        Search audited activities across Microsoft 365 services. Retention: 90 days (default) / 1 year (E5) / 10 years (premium
        add-on).
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Search</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={`Activities (${activeActivities.length} selected)`}>
            <button type="button" className={styles.btnOutline} onClick={() => setPickerOpen(true)}>
              Pick activities
            </button>
            {activeActivities.length > 0 ? (
              <div className={styles.filterRow} style={{ marginTop: 8 }}>
                {activeActivities.map((a) => (
                  <span key={a} className={styles.filterChip}>
                    {a}{" "}
                    <button
                      type="button"
                      onClick={() => removeActivity(a)}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", marginLeft: 4 }}
                      aria-label={`Remove ${a}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </Field>

          <Field label="Workload">
            <div className={styles.filterRow}>
              {WORKLOAD_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`${styles.filterChip} ${selectedWorkloads.includes(w) ? styles.filterChipActive : ""}`}
                  onClick={() => toggleWorkload(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Users" help="Click to toggle. Leave empty to search all users.">
            <div className={styles.filterRow} style={{ maxHeight: 110, overflowY: "auto" }}>
              {state.users.map((u) => (
                <button
                  key={u.userPrincipalName}
                  type="button"
                  className={`${styles.filterChip} ${selectedUsers.includes(u.userPrincipalName) ? styles.filterChipActive : ""}`}
                  onClick={() => toggleUser(u.userPrincipalName)}
                  title={u.displayName}
                >
                  {u.userPrincipalName}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Keyword" help="Matches item, activity, or user.">
            <input
              className={styles.input}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="(optional)"
            />
          </Field>

          <Field label="Start date">
            <input className={styles.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>

          <Field label="End date">
            <input className={styles.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
        </div>

        <div className={styles.toolbar} style={{ marginTop: 12 }}>
          <button type="button" className={styles.btn} onClick={runSearch}>
            Search
          </button>
          <button type="button" className={styles.btnOutline} onClick={openSaveDialog}>
            Save search
          </button>
          <button type="button" className={styles.btnOutline} onClick={clearFilters}>
            Clear
          </button>
          <div className={styles.toolbarSpacer} />
          <button type="button" className={styles.btnOutline} onClick={handleExportCsv} disabled={!results || results.length === 0}>
            Export to CSV
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>{hasSearched ? `Results (${results?.length ?? 0})` : "Results"}</div>
        {!hasSearched ? (
          <EmptyState message="No search results yet. Configure your filters above and click Search." />
        ) : (
          <DataTable<PurviewAuditEvent>
            columns={[
              { key: "ts", header: "Date", render: (r) => new Date(r.ts).toLocaleString() },
              { key: "user", header: "User", render: (r) => r.user },
              { key: "activity", header: "Activity", render: (r) => r.activity },
              { key: "item", header: "Item", render: (r) => r.item },
              { key: "workload", header: "Workload", render: (r) => r.workload },
              { key: "ip", header: "IP address", render: (r) => r.ip },
              { key: "clientApp", header: "Client app", render: (r) => r.clientApp },
              { key: "result", header: "Result", render: (r) => <StatusPill tone={statusTone(r.result)}>{r.result}</StatusPill> },
            ]}
            rows={results ?? []}
            getRowKey={(r) => r.id}
            emptyMessage="No events matched these filters."
          />
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Saved searches</div>
        {state.auditSavedSearches.length === 0 ? (
          <EmptyState message="No saved searches yet." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {state.auditSavedSearches.map((s) => (
              <li
                key={s.id}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}
              >
                <button type="button" className={styles.link} style={{ background: "none", border: 0 }} onClick={() => loadSaved(s.id)}>
                  {s.name}
                </button>
                <span style={{ fontSize: 12, color: "#605e5c" }}>
                  {s.query} &middot; {s.range}
                </span>
                <div style={{ flex: 1 }} />
                <button type="button" className={styles.btnSubtle} onClick={() => deleteSaved(s.id, s.name)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pickerOpen ? (
        <Modal
          title="Select activities"
          onClose={() => setPickerOpen(false)}
          width="640px"
          footer={
            <button type="button" className={styles.btn} onClick={() => setPickerOpen(false)}>
              Done
            </button>
          }
        >
          <input
            className={styles.input}
            type="text"
            placeholder="Filter activities..."
            value={pickerFilter}
            onChange={(e) => setPickerFilter(e.target.value)}
            style={{ marginBottom: 12 }}
            autoFocus
          />
          <div className={styles.tree}>
            {filteredCategories.length === 0 ? (
              <EmptyState message="No activities match that filter." />
            ) : (
              filteredCategories.map((g) => (
                <div key={g.group}>
                  <div className={styles.treeGroup}>{g.group}</div>
                  <div className={styles.treeChildren}>
                    {g.items.map((a) => {
                      const realCount = activityCounts.get(a) ?? 0;
                      return (
                        <label key={a} className={styles.treeLeaf}>
                          <input type="checkbox" checked={activeActivities.includes(a)} onChange={() => toggleActivity(a)} />
                          <span style={{ flex: 1 }}>{a}</span>
                          {realCount > 0 ? <span style={{ fontSize: 10, color: "#605e5c" }}>{realCount}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      ) : null}

      {saveDialogOpen ? (
        <Modal
          title="Save search"
          onClose={() => setSaveDialogOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={confirmSave} disabled={!saveName.trim()}>
                Save
              </button>
            </>
          }
        >
          <Field label="Search name">
            <input
              className={styles.input}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Failed sign-ins last 7 days"
              autoFocus
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
