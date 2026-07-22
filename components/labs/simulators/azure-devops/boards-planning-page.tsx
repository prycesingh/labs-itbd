"use client";

// Boards — Backlog / Queries / Delivery Plans. Ported from
// itbd-lab/simulators/azure-devops/js/ado-boards.js renderBacklog() /
// buildHierarchy() / renderQueries() / runQuery() / renderPlans() (source's
// Work Items list and Sprints/Kanban sub-tab live in sibling page files, out
// of scope here).
//
// Like OverviewPage, none of these three pages scope `state.workItems` by
// `state.currentProject` — source's Boards module reads
// `ADOData.workItemsForProject()` which (per the seed data in this port) is
// just the full work item list, so all three read `state.workItems` directly,
// matching the established no-project-filter convention already documented in
// overview-page.tsx.

import { useMemo, useState } from "react";

import type { AdoState, AdoWorkItem } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { DataTable, EmptyState, InitialsAvatar, Modal, StatusPill, statusTone } from "./ado-ui";
import styles from "./ado-console.module.css";

// ===================================================================
// BACKLOG
// ===================================================================

// Capacity constant, ported verbatim from source's `renderBacklog()`
// (`var totalPts = 0, capacity = 60;`) — a hardcoded 60 SP capacity, not
// derived from team size or iteration length.
const BACKLOG_CAPACITY_SP = 60;

type HierarchyNode = AdoWorkItem & { children: HierarchyNode[] };

// Ported faithfully from source's `buildHierarchy(items)`: group Epic ->
// Feature -> User Story (and any other type) via `w.parent` links. Items
// with no parent are treated as roots ONLY if they're an Epic; every other
// parent-less item is orphan-attached under the first root epic found (or
// becomes a root itself if there are no epics at all) — source does this
// with a second full pass over `items`, which this mirrors exactly rather
// than folding into the first pass.
function buildHierarchy(items: AdoWorkItem[]): HierarchyNode[] {
  const byId = new Map<number, HierarchyNode>();
  items.forEach((w) => {
    byId.set(w.id, { ...w, children: [] });
  });

  const roots: HierarchyNode[] = [];

  items.forEach((w) => {
    const node = byId.get(w.id);
    if (!node) return;
    if (w.parent && byId.has(w.parent)) {
      byId.get(w.parent)!.children.push(node);
    } else if (w.type === "Epic") {
      roots.push(node);
    }
  });

  // Orphan-attachment fallback: any parent-less non-Epic gets attached under
  // the first root epic for visibility, or becomes its own root if no epic
  // exists yet — ported verbatim from source's second forEach pass.
  items.forEach((w) => {
    if (!w.parent && w.type !== "Epic") {
      const node = byId.get(w.id);
      if (!node) return;
      if (roots.length) {
        roots[0].children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
}

function BacklogRow({ item, depth }: { item: HierarchyNode; depth: number }) {
  const pad = 12 + depth * 18;
  return (
    <tr>
      <td>{item.priority}</td>
      <td>
        #{item.id} <span>{item.type}</span>
      </td>
      <td style={{ paddingLeft: pad }}>{item.title}</td>
      <td>
        <StatusPill tone={statusTone(item.state)}>{item.state}</StatusPill>
      </td>
      <td>{item.storyPoints ?? "-"}</td>
      <td>
        <InitialsAvatar name={item.assignedTo} /> {item.assignedTo}
      </td>
    </tr>
  );
}

export function BoardsBacklogPage({ state }: { state: AdoState }) {
  const hierarchy = useMemo(() => buildHierarchy(state.workItems), [state.workItems]);

  // Total story points across the WHOLE backlog (not per-iteration) — ported
  // verbatim from source: `items.forEach(w => { if (w.storyPoints) totalPts
  // += w.storyPoints; })` runs over `ADOData.workItemsForProject()` with no
  // iteration filter.
  const totalPoints = useMemo(() => state.workItems.reduce((sum, w) => sum + (w.storyPoints ?? 0), 0), [state.workItems]);
  const pct = Math.min(100, Math.round((totalPoints / BACKLOG_CAPACITY_SP) * 100));

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Backlog</div>
      <div className={styles.pageSub}>Hierarchical view of Epics &gt; Features &gt; User Stories &gt; Tasks.</div>

      <div className={`${styles.card} ${styles.capacityBar}`}>
        <div>
          <strong>Capacity</strong> {totalPoints} / {BACKLOG_CAPACITY_SP} SP ({pct}%)
        </div>
        <div className={`${styles.progress} ${styles.progressWide}`}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {hierarchy.length === 0 ? (
        <EmptyState message="No backlog items found." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.backlogTable}`}>
            <thead>
              <tr>
                <th>Order</th>
                <th>ID</th>
                <th>Title</th>
                <th>State</th>
                <th>SP</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {hierarchy.map((epic) => (
                <BacklogEpicRows key={epic.id} epic={epic} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BacklogEpicRows({ epic }: { epic: HierarchyNode }) {
  return (
    <>
      <BacklogRow item={epic} depth={0} />
      {epic.children.map((feature) => (
        <BacklogFeatureRows key={feature.id} feature={feature} />
      ))}
    </>
  );
}

function BacklogFeatureRows({ feature }: { feature: HierarchyNode }) {
  return (
    <>
      <BacklogRow item={feature} depth={1} />
      {feature.children.map((story) => (
        <BacklogRow key={story.id} item={story} depth={2} />
      ))}
    </>
  );
}

// ===================================================================
// QUERIES
// ===================================================================

const QUERY_TYPES = ["Epic", "Feature", "User Story", "Bug", "Task"] as const;
const QUERY_STATES = ["New", "Active", "Resolved", "Closed", "To Do", "In Progress", "Done"] as const;

// The hardcoded "current user" @Me resolves to, ported from source's
// `runQuery()`: `if (query.assignee === '@Me') return w.assignedTo === 'Alex
// Johnson';`. In this port's seed data Alex Johnson is `state.team[0]`, so we
// resolve the alias off the team roster rather than re-hardcoding the literal
// name a second time.
const ME_OPTION = "@Me";

type QueryFilters = { type: string; state: string; assignee: string };

const DEFAULT_QUERY: QueryFilters = { type: "any", state: "any", assignee: "any" };

function runQuery(items: AdoWorkItem[], query: QueryFilters, currentUserName: string): AdoWorkItem[] {
  return items.filter((w) => {
    if (query.type !== "any" && w.type !== query.type) return false;
    if (query.state !== "any" && w.state !== query.state) return false;
    if (query.assignee === "any") return true;
    if (query.assignee === ME_OPTION) return w.assignedTo === currentUserName;
    return w.assignedTo === query.assignee;
  });
}

export function BoardsQueriesPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [query, setQuery] = useState<QueryFilters>(DEFAULT_QUERY);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const currentUserName = state.team[0]?.name ?? "Alex Johnson";

  const results = useMemo(() => runQuery(state.workItems, query, currentUserName), [state.workItems, query, currentUserName]);

  const peopleOptions = ["any", ME_OPTION, ...state.team.map((t) => t.name)];

  function setFilter(key: keyof QueryFilters, value: string) {
    setQuery((prev) => ({ ...prev, [key]: value }));
  }

  function loadSavedQuery(id: string) {
    const saved = state.savedQueries.find((q) => q.id === id);
    if (!saved) return;
    setQuery({
      type: saved.type[0] ?? "any",
      state: saved.state[0] ?? "any",
      assignee: saved.assignedTo || "any",
    });
  }

  function handleSaveQuery() {
    const name = saveName.trim();
    if (!name) return;
    dispatch({
      type: "ADD_SAVED_QUERY",
      query: {
        id: "q-" + crypto.randomUUID(),
        name,
        type: query.type === "any" ? [] : [query.type],
        state: query.state === "any" ? [] : [query.state],
        assignedTo: query.assignee === "any" ? "" : query.assignee,
      },
    });
    setSaveModalOpen(false);
    setSaveName("");
  }

  function handleDeleteSavedQuery(id: string) {
    dispatch({ type: "DELETE_SAVED_QUERY", id });
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Queries</div>
      <div className={styles.pageSub}>Build and save work item queries.</div>

      <div className={styles.card}>
        <div className={styles.cardH}>Query editor</div>
        <div className={styles.queryRow}>
          <span className="lbl">Type IN</span>
          <select value={query.type} onChange={(e) => setFilter("type", e.target.value)}>
            <option value="any">any</option>
            {QUERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="lbl">AND State IN</span>
          <select value={query.state} onChange={(e) => setFilter("state", e.target.value)}>
            <option value="any">any</option>
            {QUERY_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="lbl">AND Assigned To =</span>
          <select value={query.assignee} onChange={(e) => setFilter("assignee", e.target.value)}>
            {peopleOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button type="button" className={styles.btnPrimary} onClick={() => setQuery((prev) => ({ ...prev }))}>
            Run query
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => setSaveModalOpen(true)}>
            Save query
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardH}>Saved queries</div>
        {state.savedQueries.length === 0 ? (
          <EmptyState message="No saved queries yet." />
        ) : (
          <div className={styles.savedList}>
            {state.savedQueries.map((q) => (
              <div key={q.id} className={styles.savedQ} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <a onClick={() => loadSavedQuery(q.id)}>{q.name}</a>
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSavedQuery(q.id);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DataTable<AdoWorkItem>
        columns={[
          { key: "id", header: "ID", render: (w) => `#${w.id}` },
          { key: "title", header: "Title", render: (w) => w.title },
          { key: "type", header: "Type", render: (w) => w.type },
          { key: "state", header: "State", render: (w) => <StatusPill tone={statusTone(w.state)}>{w.state}</StatusPill> },
          {
            key: "assignedTo",
            header: "Assigned To",
            render: (w) => (
              <>
                <InitialsAvatar name={w.assignedTo} /> {w.assignedTo}
              </>
            ),
          },
        ]}
        rows={results}
        getRowKey={(w) => String(w.id)}
        emptyMessage="No work items match the current query."
      />

      {saveModalOpen ? (
        <Modal
          title="Save query"
          onClose={() => setSaveModalOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setSaveModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleSaveQuery}>
                Save
              </button>
            </>
          }
        >
          <div className={styles.formRow}>
            <label>Name</label>
            <div>
              <input
                className={styles.input}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. My Active Bugs"
                autoFocus
              />
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// ===================================================================
// DELIVERY PLANS
// ===================================================================

export function BoardsDeliveryPlansPage({ state }: { state: AdoState }) {
  // Excludes the synthetic "Backlog" iteration, matching source's
  // `renderPlans()`: `iters = ADOData.state.iterations.filter(i => i.id !==
  // 'iter-bk')`.
  const iterations = useMemo(() => state.iterations.filter((i) => i.id !== "iter-bk"), [state.iterations]);

  // Rows = Feature-type work items, matching source's `renderPlans()`:
  // `features = ... .filter(w => w.type === 'Feature' || w.type === 'Epic')`.
  const features = useMemo(
    () => state.workItems.filter((w) => w.type === "Feature" || w.type === "Epic"),
    [state.workItems],
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Delivery Plans</div>
      <div className={styles.pageSub}>Timeline of features across iterations (Gantt-style).</div>

      {features.length === 0 ? (
        <EmptyState message="No features or epics to plan." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.planTable}`}>
            <thead>
              <tr>
                <th className={styles.planTeam}>Feature</th>
                {iterations.map((it) => (
                  <th key={it.id}>{it.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.id}>
                  <td className={styles.planTeam}>{f.title}</td>
                  {iterations.map((it) => (
                    <td key={it.id}>
                      {/* Simple single-cell placement — ported faithfully from source's
                          `here = f.iteration === it.id`, NOT a true multi-iteration
                          spanning bar. */}
                      {f.iteration === it.id ? <div className={styles.planBar}>{f.title}</div> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
