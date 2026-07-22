"use client";

// Data Map (Data Governance) page for the Microsoft Purview compliance-portal
// simulator. Ported from itbd-lab/simulators/purview/js/purview-data-map.js
// (976 lines) — six sub-views: Data sources, Scans, Classifications,
// Trainable classifiers, Business glossary, Lineage.
//
// Source is mostly a rich read-only reference/dashboard surface (12 seeded
// sources, 6 scans, 200+ built-in classifications grouped by category, an
// example lineage flow) with only glossary term add/edit and a scan-trigger
// stub as real CRUD — matched here 1:1 against the already-built
// `PurviewState`/`purviewReducer` shapes (`ADD_GLOSSARY_TERM`,
// `UPDATE_GLOSSARY_TERM`, `TRIGGER_SCAN`).
//
// Source's critical bug — `go()`/every mutation handler re-renders by reading
// `document.getElementById('mainContent')`, a selector that doesn't exist
// anywhere in `purview-portal.js`'s real DOM (`.pp-content`), so every one of
// the 6 internal tab clicks below silently did nothing in the original app —
// is structurally impossible here: this is a normal React component driven by
// local `useState` (`subTab`), so switching tabs and dispatching actions both
// just re-render via React's own reconciliation, never manual DOM lookup.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { PurviewAction } from "@/lib/labs/simulators/purview/reducer";
import type { PurviewDataSource, PurviewGlossaryTerm, PurviewScanJob, PurviewState } from "@/lib/labs/simulators/purview/types";

import { DataTable, EmptyState, Field, Flyout, Modal, NativeSelect, StatusPill, SubTabBar, statusTone } from "./purview-ui";
import styles from "./purview-console.module.css";

// ===== Local types =====

type SubTab = "sources" | "scans" | "classifications" | "trainable" | "glossary" | "lineage";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "sources", label: "Data sources" },
  { key: "scans", label: "Scans" },
  { key: "classifications", label: "Classifications" },
  { key: "trainable", label: "Trainable classifiers" },
  { key: "glossary", label: "Business glossary" },
  { key: "lineage", label: "Lineage" },
];

// ===== Trainable classifiers (static reference content) =====
// Ported from source's `TRAINABLE_CLASSIFIERS` — pre-trained + custom examples,
// each with accuracy and a training-samples note. Source's exact 7 entries are
// kept verbatim (5 pre-trained, 2 custom) rather than trimmed to "4-5", since
// the source list is already a good, realistic size.
type TrainableClassifier = { name: string; type: string; accuracy: string; samples: string };

const TRAINABLE_CLASSIFIERS: TrainableClassifier[] = [
  { name: "HR-related content", type: "Pre-trained", accuracy: "94%", samples: "Built-in by Microsoft" },
  { name: "Customer complaints", type: "Pre-trained", accuracy: "91%", samples: "Built-in" },
  { name: "IP / Trade secrets", type: "Pre-trained", accuracy: "89%", samples: "Built-in" },
  { name: "Source code", type: "Pre-trained", accuracy: "96%", samples: "Built-in" },
  { name: "Resumes / CVs", type: "Pre-trained", accuracy: "93%", samples: "Built-in" },
  { name: "Custom_M&A_documents", type: "Custom", accuracy: "88%", samples: "247 positive + 184 negative samples by Legal" },
  { name: "Custom_Patent_drafts", type: "Custom", accuracy: "85%", samples: "128 positive + 95 negative by R&D" },
];

// ===== Lineage (one example flow) =====
// Ported from source's `LINEAGE` — sql-crm/sql-finance -> ADF pipeline ->
// Delta Lake -> Snowflake -> Power BI dataset -> Power BI report, plus a
// column-level lineage table for the target. Source's `LINEAGE_TARGETS` map
// (3 selectable targets) is kept as a cosmetic dropdown; only the first
// target's node/edge graph is rendered in full since that's the flow source
// treats as "the" example.
type LineageNode = { id: string; name: string; kind: string };
type LineageEdge = { from: string; to: string };
type LineageColumn = { col: string; origin: string; transformation: string };

const LINEAGE_TARGETS = ["powerbi.dataset.customer_360", "delta.silver.fact_payment", "snowflake.MART.dim_employee"];

const LINEAGE_NODES: LineageNode[] = [
  { id: "src1", name: "sql-crm-prod.dbo.Customer", kind: "Azure SQL table" },
  { id: "src2", name: "sql-finance.dbo.Invoice", kind: "Azure SQL table" },
  { id: "src3", name: "sql-finance.dbo.Payment", kind: "Azure SQL table" },
  { id: "df1", name: "adf.pipeline.customer_360_etl", kind: "Data Factory pipeline" },
  { id: "lake", name: "datalake.silver.fact_customer_360", kind: "Delta Lake table" },
  { id: "sf", name: "snowflake.MART.dim_customer", kind: "Snowflake view" },
  { id: "pbi", name: "powerbi.dataset.customer_360", kind: "Power BI dataset" },
  { id: "rep", name: "powerbi.report.executive_dashboard", kind: "Power BI report" },
];

const LINEAGE_EDGES: LineageEdge[] = [
  { from: "src1", to: "df1" },
  { from: "src2", to: "df1" },
  { from: "src3", to: "df1" },
  { from: "df1", to: "lake" },
  { from: "lake", to: "sf" },
  { from: "sf", to: "pbi" },
  { from: "pbi", to: "rep" },
];

const LINEAGE_COLUMNS: LineageColumn[] = [
  { col: "CustomerName", origin: "sql-crm-prod.dbo.Customer.CustomerName", transformation: "Direct copy + UPPER()" },
  { col: "TotalRevenue", origin: "sql-finance.dbo.Payment.Amount", transformation: "SUM(Amount) GROUP BY CustomerId, FY" },
  {
    col: "CustomerHealth",
    origin: "derived",
    transformation: 'CASE WHEN NRR > 100 AND DSO < 60 THEN "Healthy" WHEN NRR > 85 THEN "At Risk" ELSE "Churn risk" END',
  },
  { col: "EmailDomain", origin: "sql-crm-prod.dbo.Customer.Email", transformation: "SUBSTRING(Email, INSTR(Email,'@')+1)" },
];

// Builds columns left-to-right by BFS depth from root nodes (in-degree 0),
// matching source's `renderLineageDiagram()` layout algorithm.
function lineageColumnsByDepth(nodes: LineageNode[], edges: LineageEdge[]): LineageNode[][] {
  const depth = new Map<string, number>();
  const inDeg = new Map<string, number>();
  nodes.forEach((n) => {
    depth.set(n.id, 0);
    inDeg.set(n.id, 0);
  });
  edges.forEach((e) => inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1));

  let changed = true;
  let safety = 0;
  while (changed && safety++ < 50) {
    changed = false;
    edges.forEach((e) => {
      const fromDepth = depth.get(e.from);
      const toDepth = depth.get(e.to);
      if (fromDepth === undefined || toDepth === undefined) return;
      if (toDepth < fromDepth + 1) {
        depth.set(e.to, fromDepth + 1);
        changed = true;
      }
    });
  }

  const maxDepth = Math.max(...Array.from(depth.values()), 0);
  const columns: LineageNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  nodes.forEach((n) => {
    columns[depth.get(n.id) ?? 0].push(n);
  });
  return columns;
}

// ===== Glossary term form state =====

type TermFormState = { name: string; definition: string; steward: string };

function freshTermForm(): TermFormState {
  return { name: "", definition: "", steward: "" };
}

export function DataMapPage({ state, dispatch }: { state: PurviewState; dispatch: React.Dispatch<PurviewAction> }) {
  const [subTab, setSubTab] = useState<SubTab>("sources");

  const [classCategoryFilter, setClassCategoryFilter] = useState<string>("all");

  const [detailTermId, setDetailTermId] = useState<string | null>(null);
  const [termForm, setTermForm] = useState<TermFormState>(freshTermForm());

  const [addTermOpen, setAddTermOpen] = useState(false);
  const [newTermForm, setNewTermForm] = useState<TermFormState>(freshTermForm());

  const [lineageTarget, setLineageTarget] = useState<string>(LINEAGE_TARGETS[0]);

  const sourceNameById = useMemo(() => {
    const map = new Map<string, string>();
    state.dataSources.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [state.dataSources]);

  const classificationCategories = useMemo(() => {
    const set = new Set<string>();
    state.classificationTypes.forEach((c) => set.add(c.category));
    return Array.from(set).sort();
  }, [state.classificationTypes]);

  const filteredClassifications = useMemo(() => {
    if (classCategoryFilter === "all") return state.classificationTypes;
    return state.classificationTypes.filter((c) => c.category === classCategoryFilter);
  }, [state.classificationTypes, classCategoryFilter]);

  const detailTerm = detailTermId ? state.glossaryTerms.find((t) => t.id === detailTermId) ?? null : null;

  const lineageColumns = useMemo(() => lineageColumnsByDepth(LINEAGE_NODES, LINEAGE_EDGES), []);

  // ===== Sources tab =====

  function handleScanNow(source: PurviewDataSource) {
    dispatch({ type: "TRIGGER_SCAN", sourceId: source.id });
    toast.success(`Scan triggered for "${source.name}".`);
  }

  // ===== Glossary tab =====

  function openTermDetail(term: PurviewGlossaryTerm) {
    setTermForm({ name: term.name, definition: term.definition, steward: term.steward });
    setDetailTermId(term.id);
  }

  function closeTermDetail() {
    setDetailTermId(null);
  }

  function handleSaveTerm() {
    if (!detailTerm) return;
    if (!termForm.name.trim() || !termForm.definition.trim()) {
      toast.warning("Term name and definition are required.");
      return;
    }
    dispatch({
      type: "UPDATE_GLOSSARY_TERM",
      id: detailTerm.id,
      patch: { name: termForm.name.trim(), definition: termForm.definition.trim(), steward: termForm.steward.trim() },
    });
    toast.success(`Term "${termForm.name.trim()}" updated.`);
    setDetailTermId(null);
  }

  function openAddTermModal() {
    setNewTermForm(freshTermForm());
    setAddTermOpen(true);
  }

  function handleAddTerm() {
    if (!newTermForm.name.trim() || !newTermForm.definition.trim()) {
      toast.warning("Term name and definition are required.");
      return;
    }
    const term: PurviewGlossaryTerm = {
      id: `term-${crypto.randomUUID()}`,
      name: newTermForm.name.trim(),
      definition: newTermForm.definition.trim(),
      steward: newTermForm.steward.trim() || "Data Council",
      status: "Draft",
      linkedAssets: 0,
    };
    dispatch({ type: "ADD_GLOSSARY_TERM", term });
    toast.success(`Term "${term.name}" added.`);
    setAddTermOpen(false);
  }

  function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max).trimEnd()}…`;
  }

  return (
    <div>
      <div className={styles.pageH1}>Data Map</div>
      <div className={styles.pageSub}>Data sources · scans · classifications · glossary · lineage — the data governance pillar.</div>

      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={(k) => setSubTab(k as SubTab)} />

      {/* ===== Sources tab ===== */}
      {subTab === "sources" ? (
        <DataTable<PurviewDataSource>
          columns={[
            { key: "name", header: "Name", render: (s) => <span className={styles.rowLink}>{s.name}</span> },
            { key: "kind", header: "Type", render: (s) => s.kind },
            { key: "assets", header: "Assets", render: (s) => s.assets.toLocaleString() },
            { key: "classifiedAssets", header: "Classified", render: (s) => s.classifiedAssets.toLocaleString() },
            { key: "sensitiveTypes", header: "Sensitive types", render: (s) => s.sensitiveTypes },
            { key: "lastScan", header: "Last scan", render: (s) => new Date(s.lastScan).toLocaleString() },
            { key: "status", header: "Status", render: (s) => <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill> },
            {
              key: "actions",
              header: "Actions",
              render: (s) => (
                <button
                  type="button"
                  className={styles.tbBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScanNow(s);
                  }}
                >
                  Scan now
                </button>
              ),
            },
          ]}
          rows={state.dataSources}
          getRowKey={(s) => s.id}
          emptyMessage="No data sources registered."
        />
      ) : null}

      {/* ===== Scans tab ===== */}
      {subTab === "scans" ? (
        <DataTable<PurviewScanJob>
          columns={[
            { key: "name", header: "Scan name", render: (j) => <span className={styles.rowLink}>{j.name}</span> },
            { key: "source", header: "Source", render: (j) => sourceNameById.get(j.sourceId) ?? j.sourceId },
            { key: "schedule", header: "Schedule", render: (j) => j.schedule },
            { key: "lastRun", header: "Last run", render: (j) => new Date(j.lastRun).toLocaleString() },
            { key: "duration", header: "Duration", render: (j) => j.duration },
            { key: "status", header: "Status", render: (j) => <StatusPill tone={statusTone(j.status)}>{j.status}</StatusPill> },
          ]}
          rows={state.scanJobs}
          getRowKey={(j) => j.id}
          emptyMessage="No scans configured."
        />
      ) : null}

      {/* ===== Classifications tab ===== */}
      {subTab === "classifications" ? (
        <>
          <p className={`${styles.muted} ${styles.small} ${styles.mb12}`}>
            Microsoft ships 200+ built-in classifications; this catalog seeds a representative slice plus custom regex-defined types.
          </p>
          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterChip} ${classCategoryFilter === "all" ? styles.filterChipActive : ""}`}
              onClick={() => setClassCategoryFilter("all")}
            >
              All categories
            </button>
            {classificationCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.filterChip} ${classCategoryFilter === cat ? styles.filterChipActive : ""}`}
                onClick={() => setClassCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <DataTable
            columns={[
              { key: "name", header: "Classification", render: (c) => c.name },
              { key: "category", header: "Category", render: (c) => c.category },
              {
                key: "builtIn",
                header: "Source",
                render: (c) => (c.builtIn ? <StatusPill tone="info">Built-in</StatusPill> : <StatusPill tone="purple">Custom</StatusPill>),
              },
              {
                key: "pattern",
                header: "Pattern",
                render: (c) => (c.pattern ? <code className={styles.json} style={{ padding: "2px 6px", display: "inline-block" }}>{c.pattern}</code> : "—"),
              },
            ]}
            rows={filteredClassifications}
            getRowKey={(c) => c.id}
            emptyMessage="No classifications in this category."
          />
        </>
      ) : null}

      {/* ===== Trainable classifiers tab ===== */}
      {subTab === "trainable" ? (
        <>
          <p className={`${styles.muted} ${styles.small} ${styles.mb12}`}>
            Trainable classifiers learn document patterns from samples — they find sensitive content even without a regex match.
          </p>
          <DataTable<TrainableClassifier>
            columns={[
              { key: "name", header: "Classifier name", render: (c) => <strong>{c.name}</strong> },
              { key: "type", header: "Type", render: (c) => c.type },
              { key: "accuracy", header: "Accuracy", render: (c) => c.accuracy },
              { key: "samples", header: "Training samples", render: (c) => <span className={styles.small}>{c.samples}</span> },
            ]}
            rows={TRAINABLE_CLASSIFIERS}
            getRowKey={(c) => c.name}
            emptyMessage="No trainable classifiers."
          />
          <div className={`${styles.card} ${styles.mt12}`}>
            <div className={styles.cardTitle}>Training tips</div>
            <div className={styles.small}>
              50+ positive samples minimum, ideally 200+. Match with a similar number of negative samples. Use diverse content (different
              authors, formats, lengths) and re-test accuracy after every retraining round. Confidence threshold: matches below the
              configured threshold (default ~70%) are not counted for DLP/auto-labeling triggers — raise it to reduce false positives,
              lower it to catch more borderline matches.
            </div>
          </div>
        </>
      ) : null}

      {/* ===== Glossary tab ===== */}
      {subTab === "glossary" ? (
        <>
          <p className={`${styles.muted} ${styles.small} ${styles.mb12}`}>
            The business glossary connects technical assets to plain-English terms. Each term has a Steward (owner) and a Status
            (Draft / Approved).
          </p>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={openAddTermModal}>
              <span className={styles.tbBtnIco}>+</span> Add term
            </button>
          </div>
          <DataTable<PurviewGlossaryTerm>
            columns={[
              { key: "name", header: "Term", render: (t) => <span className={styles.rowLink}>{t.name}</span> },
              { key: "definition", header: "Definition", render: (t) => <span className={styles.small}>{truncate(t.definition, 90)}</span> },
              { key: "steward", header: "Steward", render: (t) => t.steward },
              { key: "status", header: "Status", render: (t) => <StatusPill tone={statusTone(t.status)}>{t.status}</StatusPill> },
              { key: "linkedAssets", header: "Linked assets", render: (t) => t.linkedAssets },
            ]}
            rows={state.glossaryTerms}
            getRowKey={(t) => t.id}
            onRowClick={openTermDetail}
            emptyMessage="No glossary terms yet."
          />
        </>
      ) : null}

      {/* ===== Lineage tab ===== */}
      {subTab === "lineage" ? (
        <>
          <p className={`${styles.muted} ${styles.small} ${styles.mb12}`}>
            Lineage traces data from source through transformations to consumers. Column-level lineage shows individual field-to-field
            mappings.
          </p>
          <Field label="Target asset">
            <NativeSelect value={lineageTarget} onChange={setLineageTarget} options={LINEAGE_TARGETS.map((t) => ({ value: t, label: t }))} />
          </Field>

          <div className={styles.h3}>
            Lineage graph — target: <code>{lineageTarget}</code>
          </div>
          {lineageTarget === LINEAGE_TARGETS[0] ? (
            <div className={styles.tableWrap} style={{ padding: 14, overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                {lineageColumns.map((col, colIdx) => (
                  <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220 }}>
                    {col.map((node) => (
                      <div
                        key={node.id}
                        className={styles.card}
                        style={{ margin: 0, padding: "8px 10px", borderLeft: "4px solid var(--itbd-blue, #00ADDA)" }}
                      >
                        <div className={`${styles.small} ${styles.muted}`}>{node.kind}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-all" }}>{node.name}</div>
                      </div>
                    ))}
                    {colIdx < lineageColumns.length - 1 ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#5c2d91" }}>
                        &rarr;
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState message="No lineage graph recorded for this target in this simulation — try the customer_360 example." />
          )}

          <div className={`${styles.h3} ${styles.mt12}`}>
            Column-level lineage — top fields in <code>{lineageTarget}</code>
          </div>
          {lineageTarget === LINEAGE_TARGETS[0] ? (
            <DataTable<LineageColumn>
              columns={[
                { key: "col", header: "Output column", render: (c) => <strong>{c.col}</strong> },
                { key: "origin", header: "Origin", render: (c) => <code className={styles.small}>{c.origin}</code> },
                { key: "transformation", header: "Transformation", render: (c) => <code className={styles.small}>{c.transformation}</code> },
              ]}
              rows={LINEAGE_COLUMNS}
              getRowKey={(c) => c.col}
              emptyMessage="No column lineage recorded."
            />
          ) : (
            <EmptyState message="No column-level lineage recorded for this target in this simulation." />
          )}

          <div className={`${styles.card} ${styles.mt12}`}>
            <div className={styles.cardTitle}>Impact analysis</div>
            <div className={styles.small}>
              Click any node in a real Purview tenant to see &ldquo;what breaks if this changes&rdquo; and &ldquo;what was the source of
              this data&rdquo;. Required for GDPR Subject Access Request flows — trace customer PII to every downstream consumer.
            </div>
          </div>
        </>
      ) : null}

      {/* ===== Glossary term detail flyout (view + edit) ===== */}
      {detailTerm ? (
        <Flyout
          title={detailTerm.name}
          subtitle={<StatusPill tone={statusTone(detailTerm.status)}>{detailTerm.status}</StatusPill>}
          onClose={closeTermDetail}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={closeTermDetail}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={handleSaveTerm}>
                Save changes
              </button>
            </>
          }
        >
          <div className={styles.inspector}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Linked assets</div>
              <div className={styles.fieldValue}>{detailTerm.linkedAssets}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Status</div>
              <div className={styles.fieldValue}>{detailTerm.status}</div>
            </div>
          </div>

          <Field label="Term name">
            <input className={styles.input} value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Steward">
            <input
              className={styles.input}
              value={termForm.steward}
              onChange={(e) => setTermForm((f) => ({ ...f, steward: e.target.value }))}
              placeholder="e.g. Data Council"
            />
          </Field>
          <Field label="Definition">
            <textarea
              className={styles.textarea}
              value={termForm.definition}
              onChange={(e) => setTermForm((f) => ({ ...f, definition: e.target.value }))}
            />
          </Field>
        </Flyout>
      ) : null}

      {/* ===== Add glossary term modal ===== */}
      {addTermOpen ? (
        <Modal
          title="Add glossary term"
          onClose={() => setAddTermOpen(false)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setAddTermOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={handleAddTerm}>
                Add term
              </button>
            </>
          }
        >
          <Field label="Term name *">
            <input
              className={styles.input}
              value={newTermForm.name}
              onChange={(e) => setNewTermForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Churn"
            />
          </Field>
          <Field label="Steward" help="Department or person accountable for this definition.">
            <input
              className={styles.input}
              value={newTermForm.steward}
              onChange={(e) => setNewTermForm((f) => ({ ...f, steward: e.target.value }))}
              placeholder="e.g. Data Council"
            />
          </Field>
          <Field label="Definition *">
            <textarea
              className={styles.textarea}
              value={newTermForm.definition}
              onChange={(e) => setNewTermForm((f) => ({ ...f, definition: e.target.value }))}
              placeholder="Plain-English definition of this business term."
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
