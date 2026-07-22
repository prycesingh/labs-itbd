"use client";

// eDiscovery (Standard + Premium) — ported from
// itbd-lab/simulators/purview/js/purview-ediscovery.js (PurviewEDiscovery
// module). Case list per tier, case detail with tabs (Overview, Holds,
// Searches, Exports, Notifications, +Custodians for Premium), and a 4-step
// case-creation wizard (Basics -> Investigators -> Settings -> Review).
//
// The one deliberate deviation from source: source's "search execution" and
// "search preview" were entirely fake — `saveSearch()` stored
// `Math.floor(Math.random() * 2000) + 20` items / random size, and
// `openSearch()` always rendered the SAME static first-30-rows of
// `contentSearch` regardless of the query text. Here:
//   - creating a search dispatches ADD_SEARCH, which (in reducer.ts) already
//     runs the real `runContentSearchQuery()` engine to compute genuine
//     items/sizeMB from the query text against `state.contentSearch`;
//   - "Preview results" on an existing search calls `runContentSearchQuery()`
//     LIVE against `state.contentSearch` and renders the real filtered rows,
//     so changing the query text genuinely changes what's shown — never a
//     fabricated/static result set.
//
// Both tiers are one shared implementation (`EDiscoveryTierPage`) parameterized
// by `tier`, exported as two thin wrappers so the page-router in purview-shell
// consumers can render "ediscovery-standard" / "ediscovery-premium" directly.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PurviewCustodian,
  PurviewEDiscoveryCase,
  PurviewHold,
  PurviewSearch,
  PurviewState,
} from "@/lib/labs/simulators/purview/types";
import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import { runContentSearchQuery } from "@/lib/labs/simulators/purview/search-engine";
import { DataTable, EmptyState, Field, Modal, StatusPill, statusTone, TabBar } from "./purview-ui";
import styles from "./purview-console.module.css";

type Tier = "Standard" | "Premium";

// ----------------------------------------------------------------------
// Case-creation wizard
// ----------------------------------------------------------------------

type WizardStepId = "basics" | "investigators" | "settings" | "review";
const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: "basics", label: "Name & description" },
  { id: "investigators", label: "Add investigators" },
  { id: "settings", label: "Initial settings" },
  { id: "review", label: "Review" },
];

function defaultCaseNumber(): string {
  return `CASE-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;
}

function CreateCaseWizard({
  tier,
  state,
  onClose,
  onCreate,
}: {
  tier: Tier;
  state: PurviewState;
  onClose: () => void;
  onCreate: (draft: { name: string; caseNumber: string; description: string; investigators: string[] }) => void;
}) {
  const [step, setStep] = useState<WizardStepId>("basics");
  const [name, setName] = useState("");
  const [caseNumber, setCaseNumber] = useState(defaultCaseNumber());
  const [description, setDescription] = useState("");
  const [investigators, setInvestigators] = useState<string[]>([]);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  function toggleInvestigator(upn: string) {
    setInvestigators((prev) => (prev.includes(upn) ? prev.filter((u) => u !== upn) : [...prev, upn]));
  }

  function goNext() {
    if (step === "basics" && !name.trim()) {
      toast.warning("Case name is required.");
      return;
    }
    if (stepIndex < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[stepIndex + 1].id);
  }
  function goPrev() {
    if (stepIndex > 0) setStep(WIZARD_STEPS[stepIndex - 1].id);
  }
  function finish() {
    if (!name.trim()) {
      toast.warning("Case name is required.");
      setStep("basics");
      return;
    }
    onCreate({
      name: name.trim(),
      caseNumber: caseNumber.trim() || defaultCaseNumber(),
      description: description.trim(),
      investigators: investigators.length > 0 ? investigators : ["admin@itbd.net"],
    });
  }

  return (
    <Modal
      title={`Create eDiscovery (${tier}) case`}
      onClose={onClose}
      width="820px"
      steps={
        <>
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.wizStep} ${step === s.id ? styles.wizStepActive : ""} ${i < stepIndex ? styles.wizStepDone : ""}`}
              onClick={() => setStep(s.id)}
            >
              {i < stepIndex ? "✓ " : null}
              {s.label}
            </button>
          ))}
        </>
      }
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <div className={styles.toolbarSpacer} />
          {stepIndex > 0 ? (
            <button type="button" className={styles.btnOutline} onClick={goPrev}>
              Back
            </button>
          ) : null}
          {step === "review" ? (
            <button type="button" className={styles.btn} onClick={finish}>
              Create case
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={goNext}>
              Next
            </button>
          )}
        </>
      }
    >
      {step === "basics" ? (
        <>
          <Field label="Case name *">
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Litigation-2026-002"
              autoFocus
            />
          </Field>
          <Field label="Case number">
            <input className={styles.input} value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </>
      ) : null}

      {step === "investigators" ? (
        <>
          <p style={{ fontSize: 12, color: "#605e5c", marginTop: 0 }}>Click to toggle each investigator for this case.</p>
          <Field label={`Investigators (${investigators.length} selected)`}>
            <div className={styles.filterRow}>
              {state.users.map((u) => (
                <button
                  key={u.userPrincipalName}
                  type="button"
                  className={`${styles.filterChip} ${investigators.includes(u.userPrincipalName) ? styles.filterChipActive : ""}`}
                  onClick={() => toggleInvestigator(u.userPrincipalName)}
                  title={u.displayName}
                >
                  {u.userPrincipalName}
                </button>
              ))}
            </div>
          </Field>
        </>
      ) : null}

      {step === "settings" ? (
        <>
          <Field label="Default analytics">
            <select className={styles.select} disabled value={tier === "Premium" ? "premium" : "standard"}>
              <option value="premium">Analytics enabled (Premium)</option>
              <option value="standard">Standard analytics</option>
            </select>
          </Field>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked readOnly />
            <span>Enable case auditing</span>
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" disabled />
            <span>Allow case investigators to escalate to {tier === "Premium" ? "eDiscovery Administrator" : "Premium tier"}</span>
          </label>
        </>
      ) : null}

      {step === "review" ? (
        <div className={styles.inspector}>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Tier</div>
            <div className={styles.fieldValue}>{tier}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Name</div>
            <div className={styles.fieldValue}>{name}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Case number</div>
            <div className={styles.fieldValue}>{caseNumber}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Description</div>
            <div className={styles.fieldValue}>{description || "-"}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Investigators</div>
            <div className={styles.fieldValue}>{(investigators.length > 0 ? investigators : ["admin@itbd.net"]).join(", ")}</div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Add hold modal
// ----------------------------------------------------------------------

function AddHoldModal({ onClose, onSave }: { onClose: () => void; onSave: (hold: PurviewHold) => void }) {
  const [name, setName] = useState(`Hold-${Math.floor(Math.random() * 1000)}`);
  const [locations, setLocations] = useState("All custodians");

  function save() {
    if (!name.trim()) {
      toast.warning("Hold name is required.");
      return;
    }
    onSave({
      name: name.trim(),
      locations: locations.trim() || "All custodians",
      placed: new Date().toISOString(),
      itemCount: Math.floor(Math.random() * 10000),
      status: "On",
    });
  }

  return (
    <Modal
      title="Create hold"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={save}>
            Create hold
          </button>
        </>
      }
    >
      <Field label="Hold name">
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Locations">
        <input className={styles.input} value={locations} onChange={(e) => setLocations(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// New search modal — creation itself dispatches ADD_SEARCH, which computes
// genuine items/sizeMB via the real search engine inside the reducer.
// ----------------------------------------------------------------------

function NewSearchModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: { name: string; query: string; locations: string; dateRange: string }) => void;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState("All custodians");
  const [dateRange, setDateRange] = useState("2024-01-01 to 2024-12-31");

  function save() {
    if (!name.trim()) {
      toast.warning("Search name is required.");
      return;
    }
    if (!query.trim()) {
      toast.warning("Keyword query is required.");
      return;
    }
    onCreate({
      name: name.trim(),
      query: query.trim(),
      locations: locations.trim() || "All locations",
      dateRange: dateRange.trim() || "No date range",
    });
  }

  return (
    <Modal
      title="Create search"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={save}>
            Create search
          </button>
        </>
      }
    >
      <Field label="Name">
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Project Helix communications"
          autoFocus
        />
      </Field>
      <Field label="Keyword query (KQL)" help='Try keywords, "quoted phrases", from:name, subject:text, AND/OR.'>
        <textarea
          className={styles.textarea}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='"Project Helix" AND ("contract" OR "termination")'
        />
      </Field>
      <div className={styles.formRow}>
        <Field label="Locations">
          <input className={styles.input} value={locations} onChange={(e) => setLocations(e.target.value)} />
        </Field>
        <Field label="Date range">
          <input className={styles.input} value={dateRange} onChange={(e) => setDateRange(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Preview results modal — calls the REAL search engine live, proving the
// query text genuinely drives what rows show (never a static/random set).
// ----------------------------------------------------------------------

function PreviewSearchModal({ search, state, onClose }: { search: PurviewSearch; state: PurviewState; onClose: () => void }) {
  const results = useMemo(() => runContentSearchQuery(search.query, state.contentSearch), [search.query, state.contentSearch]);

  return (
    <Modal
      title={`Preview: ${search.name}`}
      onClose={onClose}
      width="820px"
      footer={
        <button type="button" className={styles.btn} onClick={onClose}>
          Close
        </button>
      }
    >
      <div className={styles.inspector}>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Query</div>
          <div className={styles.fieldValue}>
            <code>{search.query}</code>
          </div>
        </div>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Locations</div>
          <div className={styles.fieldValue}>{search.locations}</div>
        </div>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Date range</div>
          <div className={styles.fieldValue}>{search.dateRange}</div>
        </div>
      </div>
      <div className={styles.h3}>
        Live results from the real query engine — {results.length} of {state.contentSearch.length} items matched
      </div>
      <DataTable
        columns={[
          { key: "subject", header: "Subject", render: (r) => r.subject },
          { key: "sender", header: "Sender", render: (r) => r.sender },
          { key: "location", header: "Location", render: (r) => r.location },
          { key: "receivedOn", header: "Received", render: (r) => new Date(r.receivedOn).toLocaleDateString() },
          { key: "sizeKB", header: "Size", render: (r) => `${r.sizeKB} KB` },
        ]}
        rows={results}
        getRowKey={(r) => r.id}
        emptyMessage="No items matched this query against the content-search universe."
      />
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Compose notification modal
// ----------------------------------------------------------------------

function ComposeNotificationModal({ onClose, onSend }: { onClose: () => void; onSend: (subject: string, to: string) => void }) {
  const [subject, setSubject] = useState("Legal Hold Notice - Important");
  const [to, setTo] = useState("All custodians");
  const [body, setBody] = useState(
    "You are receiving this notice because data in your custody may be relevant to a legal matter. Please preserve all related documents and communications.",
  );

  function send() {
    if (!subject.trim() || !to.trim()) {
      toast.warning("Subject and recipient are required.");
      return;
    }
    onSend(subject.trim(), to.trim());
  }

  return (
    <Modal
      title="Compose legal hold notice"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={send}>
            Send
          </button>
        </>
      }
    >
      <Field label="Subject">
        <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
      </Field>
      <Field label="To">
        <input className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <Field label="Body">
        <textarea className={styles.textarea} style={{ minHeight: 140 }} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Add custodian modal (Premium only)
// ----------------------------------------------------------------------

function AddCustodianModal({ onClose, onSave }: { onClose: () => void; onSave: (custodian: PurviewCustodian) => void }) {
  const [upn, setUpn] = useState("");
  const [sourcesText, setSourcesText] = useState("Exchange, OneDrive");

  function save() {
    if (!upn.trim()) {
      toast.warning("Custodian UPN is required.");
      return;
    }
    const sources = sourcesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({ upn: upn.trim(), sources: sources.length > 0 ? sources : ["Exchange"], status: "On hold" });
  }

  return (
    <Modal
      title="Add custodian"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={save}>
            Add custodian
          </button>
        </>
      }
    >
      <Field label="Custodian UPN" help="user@domain.com">
        <input className={styles.input} value={upn} onChange={(e) => setUpn(e.target.value)} placeholder="user@cloudlab.in" autoFocus />
      </Field>
      <Field label="Data sources" help="Comma-separated: Exchange, OneDrive, SharePoint, Teams">
        <input className={styles.input} value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} />
      </Field>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Case detail
// ----------------------------------------------------------------------

type CaseTab = "overview" | "holds" | "searches" | "exports" | "notifications" | "custodians";

function CaseDetail({
  purviewCase,
  state,
  dispatch,
  onBack,
}: {
  purviewCase: PurviewEDiscoveryCase;
  state: PurviewState;
  dispatch: React.Dispatch<PurviewAction>;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<CaseTab>("overview");
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [custodianModalOpen, setCustodianModalOpen] = useState(false);
  const [previewSearch, setPreviewSearch] = useState<PurviewSearch | null>(null);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "holds", label: "Holds" },
    { key: "searches", label: "Searches" },
    { key: "exports", label: "Exports" },
    { key: "notifications", label: "Notifications" },
    ...(purviewCase.tier === "Premium" ? [{ key: "custodians", label: "Custodians" }] : []),
  ];

  function addHold(hold: PurviewHold) {
    dispatch({ type: "ADD_HOLD", caseId: purviewCase.id, hold });
    setHoldModalOpen(false);
    toast.success(`Hold "${hold.name}" placed.`);
  }

  function createSearch(draft: { name: string; query: string; locations: string; dateRange: string }) {
    dispatch({ type: "ADD_SEARCH", caseId: purviewCase.id, ...draft });
    setSearchModalOpen(false);
    // Real result count is only known after the reducer runs the engine; find
    // the freshly-added search by matching on name+query since ADD_SEARCH
    // generates its own id. Falls back to a generic toast if not found.
    const created = [...purviewCase.searches].reverse().find((s) => s.name === draft.name && s.query === draft.query);
    toast.success(created ? `Search created and run — ${created.items} real items found.` : "Search created and run.");
  }

  function exportSearch(search: PurviewSearch) {
    dispatch({
      type: "ADD_EXPORT",
      caseId: purviewCase.id,
      export: {
        id: "exp-" + crypto.randomUUID().slice(0, 8),
        name: `${search.name} - export`,
        status: "Completed",
        sizeMB: search.sizeMB,
        items: search.items,
        exportKey: "pk-" + crypto.randomUUID().slice(0, 12),
        exportedOn: new Date().toISOString(),
      },
    });
    toast.success("Export started. Use the export key in the eDiscovery Export tool.");
    setTab("exports");
  }

  function sendNotification(subject: string, to: string) {
    dispatch({
      type: "ADD_NOTIFICATION",
      caseId: purviewCase.id,
      notification: {
        id: "n-" + crypto.randomUUID().slice(0, 8),
        subject,
        to,
        sentOn: new Date().toISOString(),
        status: "Awaiting acknowledgement",
      },
    });
    setNotificationModalOpen(false);
    toast.success("Hold notice sent.");
  }

  function addCustodian(custodian: PurviewCustodian) {
    dispatch({ type: "ADD_CUSTODIAN", caseId: purviewCase.id, custodian });
    setCustodianModalOpen(false);
    toast.success(`Custodian ${custodian.upn} added on hold.`);
  }

  return (
    <div>
      <div className={styles.crumbs}>
        <a onClick={onBack}>{purviewCase.tier} cases</a>
        <span className={styles.crumbsSep}>/</span>
        {purviewCase.name}
      </div>
      <div className={styles.pageH1}>
        {purviewCase.name} <StatusPill tone="purple">{purviewCase.tier}</StatusPill>
      </div>
      <div className={styles.pageSub}>
        {purviewCase.caseNumber} &middot; Created by {purviewCase.createdBy} on {new Date(purviewCase.createdOn).toLocaleDateString()}
      </div>

      <TabBar tabs={tabs} active={tab} onChange={(key) => setTab(key as CaseTab)} />

      {tab === "overview" ? (
        <>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <div className={styles.statVal}>{purviewCase.investigators.length}</div>
              <div className={styles.statLabel}>Investigators</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{purviewCase.custodians.length}</div>
              <div className={styles.statLabel}>Custodians</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{purviewCase.holds.length}</div>
              <div className={styles.statLabel}>Holds</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{purviewCase.searches.length}</div>
              <div className={styles.statLabel}>Searches</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{purviewCase.exports.length}</div>
              <div className={styles.statLabel}>Exports</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Investigators</div>
            <div>
              {purviewCase.investigators.map((u) => (
                <span key={u} style={{ marginRight: 6 }}>
                  <StatusPill tone="purple">{u}</StatusPill>
                </span>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Case description</div>
            <div style={{ fontSize: 13, color: "#605e5c" }}>
              Investigation tied to {purviewCase.caseNumber}. {purviewCase.investigators.length} investigators are assigned. Holds and
              searches are tracked on the other tabs.
            </div>
          </div>
        </>
      ) : null}

      {tab === "holds" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setHoldModalOpen(true)}>
              <span className={styles.tbBtnIco}>+</span> Create hold
            </button>
          </div>
          <DataTable
            columns={[
              { key: "name", header: "Name", render: (h) => h.name },
              { key: "locations", header: "Locations", render: (h) => h.locations },
              { key: "placed", header: "Placed", render: (h) => new Date(h.placed).toLocaleDateString() },
              { key: "itemCount", header: "Items", render: (h) => h.itemCount.toLocaleString() },
              { key: "status", header: "Status", render: (h) => <StatusPill tone={statusTone(h.status)}>{h.status}</StatusPill> },
            ]}
            rows={purviewCase.holds}
            getRowKey={(h) => h.name}
            emptyMessage="No holds yet."
          />
        </>
      ) : null}

      {tab === "searches" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setSearchModalOpen(true)}>
              <span className={styles.tbBtnIco}>+</span> New search
            </button>
          </div>
          <DataTable
            columns={[
              { key: "name", header: "Name", render: (s) => s.name },
              { key: "query", header: "Query", render: (s) => <code style={{ fontSize: 11 }}>{s.query}</code> },
              { key: "locations", header: "Locations", render: (s) => s.locations },
              { key: "dateRange", header: "Date range", render: (s) => s.dateRange },
              { key: "items", header: "Items", render: (s) => s.items.toLocaleString() },
              { key: "sizeMB", header: "Size", render: (s) => `${s.sizeMB} MB` },
              {
                key: "actions",
                header: "",
                render: (s) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewSearch(s);
                      }}
                    >
                      Preview results
                    </button>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={(e) => {
                        e.stopPropagation();
                        exportSearch(s);
                      }}
                    >
                      Export
                    </button>
                  </div>
                ),
              },
            ]}
            rows={purviewCase.searches}
            getRowKey={(s) => s.id}
            emptyMessage="No searches yet."
          />
        </>
      ) : null}

      {tab === "exports" ? (
        <DataTable
          columns={[
            { key: "name", header: "Name", render: (e) => e.name },
            { key: "status", header: "Status", render: (e) => <StatusPill tone={statusTone(e.status)}>{e.status}</StatusPill> },
            { key: "sizeMB", header: "Size", render: (e) => `${e.sizeMB} MB` },
            { key: "items", header: "Items", render: (e) => e.items.toLocaleString() },
            { key: "exportKey", header: "Export key", render: (e) => <code style={{ fontSize: 11 }}>{e.exportKey}</code> },
            { key: "exportedOn", header: "Date", render: (e) => new Date(e.exportedOn).toLocaleDateString() },
          ]}
          rows={purviewCase.exports}
          getRowKey={(e) => e.id}
          emptyMessage="No exports yet. Run a search and click Export."
        />
      ) : null}

      {tab === "notifications" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setNotificationModalOpen(true)}>
              <span className={styles.tbBtnIco}>+</span> Compose hold notice
            </button>
          </div>
          <DataTable
            columns={[
              { key: "subject", header: "Subject", render: (n) => n.subject },
              { key: "to", header: "To", render: (n) => n.to },
              { key: "sentOn", header: "Sent", render: (n) => new Date(n.sentOn).toLocaleDateString() },
              { key: "status", header: "Status", render: (n) => n.status },
            ]}
            rows={purviewCase.notifications}
            getRowKey={(n) => n.id}
            emptyMessage="No notifications sent."
          />
        </>
      ) : null}

      {tab === "custodians" && purviewCase.tier === "Premium" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setCustodianModalOpen(true)}>
              <span className={styles.tbBtnIco}>+</span> Add custodian
            </button>
          </div>
          <DataTable
            columns={[
              { key: "upn", header: "User", render: (c) => c.upn },
              { key: "sources", header: "Data sources", render: (c) => c.sources.join(", ") },
              { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
            ]}
            rows={purviewCase.custodians}
            getRowKey={(c) => c.upn}
            emptyMessage="No custodians yet."
          />
          <div className={styles.h3}>Sources</div>
          {purviewCase.custodians.length === 0 ? (
            <EmptyState message="Add SharePoint sites, OneDrive accounts, Exchange shared mailboxes or Teams not associated with a custodian." />
          ) : (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Non-custodial + custodian-linked sources</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {purviewCase.custodians.map((c) => (
                  <li key={c.upn}>
                    {c.upn}: {c.sources.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}

      {holdModalOpen ? <AddHoldModal onClose={() => setHoldModalOpen(false)} onSave={addHold} /> : null}
      {searchModalOpen ? <NewSearchModal onClose={() => setSearchModalOpen(false)} onCreate={createSearch} /> : null}
      {notificationModalOpen ? (
        <ComposeNotificationModal onClose={() => setNotificationModalOpen(false)} onSend={sendNotification} />
      ) : null}
      {custodianModalOpen ? <AddCustodianModal onClose={() => setCustodianModalOpen(false)} onSave={addCustodian} /> : null}
      {previewSearch ? <PreviewSearchModal search={previewSearch} state={state} onClose={() => setPreviewSearch(null)} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// Case list + tier page
// ----------------------------------------------------------------------

function EDiscoveryTierPage({ tier, state, dispatch }: { tier: Tier; state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const cases = useMemo(() => state.ediscoveryCases.filter((c) => c.tier === tier), [state.ediscoveryCases, tier]);
  const selectedCase = selectedCaseId ? state.ediscoveryCases.find((c) => c.id === selectedCaseId) ?? null : null;

  function createCase(draft: { name: string; caseNumber: string; description: string; investigators: string[] }) {
    const id = "ed-" + crypto.randomUUID();
    dispatch({
      type: "ADD_EDISCOVERY_CASE",
      case: {
        id,
        name: draft.name,
        tier,
        status: "Active",
        caseNumber: draft.caseNumber,
        createdBy: "admin@itbd.net",
        createdOn: new Date().toISOString(),
        investigators: draft.investigators,
        custodians: [],
        holds: [],
        searches: [],
        exports: [],
        notifications: [],
      },
    });
    setWizardOpen(false);
    toast.success(`Case "${draft.name}" created.`);
    setSelectedCaseId(id);
  }

  if (selectedCase) {
    return <CaseDetail purviewCase={selectedCase} state={state} dispatch={dispatch} onBack={() => setSelectedCaseId(null)} />;
  }

  return (
    <div>
      <div className={styles.pageH1}>eDiscovery ({tier})</div>
      <div className={styles.pageSub}>Cases for legal hold, content search, review and export across Microsoft 365 data.</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={() => setWizardOpen(true)}>
          <span className={styles.tbBtnIco}>+</span> Create a case
        </button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name", render: (c) => c.name },
          { key: "caseNumber", header: "Case number", render: (c) => c.caseNumber },
          { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
          { key: "createdBy", header: "Created by", render: (c) => c.createdBy },
          { key: "createdOn", header: "Created on", render: (c) => new Date(c.createdOn).toLocaleDateString() },
          { key: "custodians", header: "Custodians", render: (c) => c.custodians.length },
          { key: "searches", header: "Searches", render: (c) => c.searches.length },
        ]}
        rows={cases}
        getRowKey={(c) => c.id}
        onRowClick={(c) => setSelectedCaseId(c.id)}
        emptyMessage={`No ${tier} eDiscovery cases.`}
      />

      {wizardOpen ? (
        <CreateCaseWizard tier={tier} state={state} onClose={() => setWizardOpen(false)} onCreate={createCase} />
      ) : null}
    </div>
  );
}

export function EDiscoveryStandardPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  return <EDiscoveryTierPage tier="Standard" state={state} dispatch={dispatch} />;
}

export function EDiscoveryPremiumPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  return <EDiscoveryTierPage tier="Premium" state={state} dispatch={dispatch} />;
}
