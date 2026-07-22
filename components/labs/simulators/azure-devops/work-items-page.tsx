"use client";

// Work items list + New Work Item wizard + detail modal — ported from
// itbd-lab/simulators/azure-devops/js/ado-boards.js renderWorkItems()/
// renderFilterBar()/renderTable()/exportCsv()/openNewWizard()/renderNewWizard()/
// saveNewWi()/openDetail()/addComment()/advanceState().
//
// Filter bar (type/state/assignee dropdowns + live search) is real
// client-side `.filter()` over `state.workItems`, matching source's
// `filterItems()`. CSV export uses the shared `exportCsv` Blob helper against
// the currently filtered set, matching source's genuinely-functional
// `exportCsv()`. The New Work Item wizard is a single-step form (no
// multi-step stepper in source — `renderNewWizard()` renders one form with a
// type-tab switcher at the top that conditionally reveals Bug/Story-Feature-
// Epic/Task-only fields) dispatching `ADD_WORK_ITEM` with a fresh sequential
// id. Source has no separate Flyout pattern for this suite (see ado-ui.tsx
// header comment) — the detail view uses the shared `Modal` primitive,
// matching source's single-centered-modal `openDetail()`. Comment-adding and
// state-advancement dispatch `ADD_WORK_ITEM_COMMENT` / `ADVANCE_WORK_ITEM_STATE`
// against the real reducer FSM (Task: To Do -> In Progress -> Done; others:
// New -> Active -> Resolved -> Closed).

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AdoState, AdoWorkItem, AdoWorkItemType } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { DataTable, type DataTableColumn, EmptyState, exportCsv, Field, InitialsAvatar, Modal, NativeSelect, StatusPill, type StatusTone } from "./ado-ui";
import styles from "./ado-console.module.css";

const CURRENT_USER = "Alex Johnson";

const WORK_ITEM_TYPES: AdoWorkItemType[] = ["Epic", "Feature", "User Story", "Bug", "Task"];
const STANDARD_STATES = ["New", "Active", "Resolved", "Closed"] as const;
const TASK_STATES = ["To Do", "In Progress", "Done"] as const;
const ALL_STATES = [...STANDARD_STATES, ...TASK_STATES];
const SEVERITIES = ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"];
const ACTIVITIES = ["Development", "Testing", "Documentation", "Deployment", "Design"];
const PRIORITIES = [1, 2, 3, 4];

function statesForType(type: AdoWorkItemType): readonly string[] {
  return type === "Task" ? TASK_STATES : STANDARD_STATES;
}

function nextStateFor(type: AdoWorkItemType, current: string): string | null {
  const states = statesForType(type);
  const idx = states.indexOf(current as (typeof states)[number]);
  if (idx === -1 || idx === states.length - 1) return null;
  return states[idx + 1];
}

function stateTone(state: string): StatusTone {
  if (state === "Active" || state === "In Progress") return "active";
  if (state === "Closed" || state === "Done") return "done";
  if (state === "Resolved") return "resolved";
  if (state === "New" || state === "To Do") return "new";
  return "default";
}

function iterationName(state: AdoState, iterationId: string): string {
  return state.iterations.find((i) => i.id === iterationId)?.name ?? "-";
}

// ===================== Filter bar =====================

type WiFilter = { type: string; state: string; assignee: string; search: string };

const INITIAL_FILTER: WiFilter = { type: "all", state: "all", assignee: "all", search: "" };

function FilterBar({
  filter,
  onChange,
  people,
}: {
  filter: WiFilter;
  onChange: (patch: Partial<WiFilter>) => void;
  people: string[];
}) {
  return (
    <div className={styles.filterBar}>
      <label className={styles.filter}>
        Type
        <NativeSelect
          value={filter.type}
          onChange={(v) => onChange({ type: v })}
          options={[{ value: "all", label: "all" }, ...WORK_ITEM_TYPES.map((t) => ({ value: t, label: t }))]}
        />
      </label>
      <label className={styles.filter}>
        State
        <NativeSelect
          value={filter.state}
          onChange={(v) => onChange({ state: v })}
          options={[{ value: "all", label: "all" }, ...ALL_STATES.map((s) => ({ value: s, label: s }))]}
        />
      </label>
      <label className={styles.filter}>
        Assigned
        <NativeSelect
          value={filter.assignee}
          onChange={(v) => onChange({ assignee: v })}
          options={[{ value: "all", label: "all" }, ...people.map((p) => ({ value: p, label: p }))]}
        />
      </label>
    </div>
  );
}

// ===================== New Work Item wizard =====================

type NewWiDraft = {
  type: AdoWorkItemType;
  title: string;
  description: string;
  assignedTo: string;
  state: string;
  reason: string;
  priority: number;
  severity: string;
  storyPoints: string;
  iteration: string;
  area: string;
  tags: string;
  activity: string;
  reproSteps: string;
};

function initialDraft(): NewWiDraft {
  return {
    type: "User Story",
    title: "",
    description: "",
    assignedTo: "Unassigned",
    state: "New",
    reason: "New",
    priority: 2,
    severity: "3 - Medium",
    storyPoints: "",
    iteration: "iter-124",
    area: "WebApp/Frontend",
    tags: "",
    activity: "Development",
    reproSteps: "",
  };
}

function NewWorkItemModal({
  state,
  onClose,
  dispatch,
}: {
  state: AdoState;
  onClose: () => void;
  dispatch: React.Dispatch<AdoAction>;
}) {
  const [draft, setDraft] = useState<NewWiDraft>(initialDraft);

  function patch(p: Partial<NewWiDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  function setType(type: AdoWorkItemType) {
    // Reset state to the first state of the new type's flow, matching
    // source's setNewType() (which just re-renders with the new type — the
    // state select itself is re-populated with the type-appropriate options).
    setDraft((prev) => ({ ...prev, type, state: statesForType(type)[0] }));
  }

  function save() {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const nextId = state.workItems.length ? Math.max(...state.workItems.map((w) => w.id)) + 1 : 1;
    const today = new Date().toISOString().substring(0, 10);
    const item: AdoWorkItem = {
      id: nextId,
      type: draft.type,
      title: draft.title.trim(),
      state: draft.state,
      reason: draft.reason,
      assignedTo: draft.assignedTo,
      createdBy: CURRENT_USER,
      createdDate: today,
      changedDate: today,
      iteration: draft.iteration,
      area: draft.area,
      tags: draft.tags
        ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      priority: Number(draft.priority) || 2,
      description: draft.description,
      comments: [],
      history: [{ when: today, actor: CURRENT_USER, change: "Created" }],
      attachments: [],
      links: [],
    };
    if (draft.type === "Bug") {
      item.severity = draft.severity;
      item.reproSteps = draft.reproSteps;
    }
    if (draft.type === "Task") item.activity = draft.activity;
    if ((draft.type === "User Story" || draft.type === "Feature" || draft.type === "Epic") && draft.storyPoints) {
      item.storyPoints = Number(draft.storyPoints) || undefined;
    }

    dispatch({ type: "ADD_WORK_ITEM", item });
    toast.success(`${draft.type} #${nextId} created`);
    onClose();
  }

  const people = state.team.map((t) => t.name);
  const showBugFields = draft.type === "Bug";
  const showStoryPoints = draft.type === "User Story" || draft.type === "Feature" || draft.type === "Epic";
  const showActivity = draft.type === "Task";

  return (
    <Modal
      title={`New ${draft.type}`}
      onClose={onClose}
      width="700px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={save}>
            Save &amp; close
          </button>
        </>
      }
    >
      <div className={styles.tabs}>
        {WORK_ITEM_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${draft.type === t ? styles.tabActive : ""}`}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <Field label="Title">
        <input className={styles.input} value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Work item title" />
      </Field>
      <Field label="Description">
        <textarea className={styles.input} rows={4} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
      </Field>
      <Field label="Assigned to">
        <NativeSelect
          value={draft.assignedTo}
          onChange={(v) => patch({ assignedTo: v })}
          options={["Unassigned", ...people].map((p) => ({ value: p, label: p }))}
        />
      </Field>
      <Field label="State">
        <NativeSelect value={draft.state} onChange={(v) => patch({ state: v })} options={statesForType(draft.type).map((s) => ({ value: s, label: s }))} />
      </Field>
      <Field label="Reason">
        <input className={styles.input} value={draft.reason} onChange={(e) => patch({ reason: e.target.value })} />
      </Field>
      <Field label="Priority">
        <NativeSelect value={String(draft.priority)} onChange={(v) => patch({ priority: Number(v) })} options={PRIORITIES.map((p) => ({ value: String(p), label: String(p) }))} />
      </Field>

      {showBugFields ? (
        <>
          <Field label="Severity">
            <NativeSelect value={draft.severity} onChange={(v) => patch({ severity: v })} options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Repro steps">
            <textarea className={styles.input} rows={5} value={draft.reproSteps} onChange={(e) => patch({ reproSteps: e.target.value })} />
          </Field>
        </>
      ) : null}

      {showStoryPoints ? (
        <Field label="Story points">
          <input
            className={styles.input}
            type="number"
            min={0}
            value={draft.storyPoints}
            onChange={(e) => patch({ storyPoints: e.target.value })}
          />
        </Field>
      ) : null}

      {showActivity ? (
        <Field label="Activity">
          <NativeSelect value={draft.activity} onChange={(v) => patch({ activity: v })} options={ACTIVITIES.map((a) => ({ value: a, label: a }))} />
        </Field>
      ) : null}

      <Field label="Iteration">
        <NativeSelect
          value={draft.iteration}
          onChange={(v) => patch({ iteration: v })}
          options={state.iterations.map((i) => ({ value: i.id, label: i.name }))}
        />
      </Field>
      <Field label="Area">
        <NativeSelect value={draft.area} onChange={(v) => patch({ area: v })} options={state.areas.map((a) => ({ value: a.path, label: a.path }))} />
      </Field>
      <Field label="Tags">
        <input className={styles.input} value={draft.tags} onChange={(e) => patch({ tags: e.target.value })} placeholder="comma separated" />
      </Field>
    </Modal>
  );
}

// ===================== Detail modal =====================

function WorkItemDetailModal({
  item,
  state,
  dispatch,
  onClose,
}: {
  item: AdoWorkItem;
  state: AdoState;
  dispatch: React.Dispatch<AdoAction>;
  onClose: () => void;
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const next = nextStateFor(item.type, item.state);

  function addComment() {
    const text = commentDraft.trim();
    if (!text) return;
    dispatch({ type: "ADD_WORK_ITEM_COMMENT", id: item.id, author: CURRENT_USER, text });
    toast.success("Comment added");
    setCommentDraft("");
  }

  function advance() {
    if (!next) return;
    dispatch({ type: "ADVANCE_WORK_ITEM_STATE", id: item.id });
    toast.success(`State -> ${next}`);
  }

  return (
    <Modal
      title={`${item.type} ${item.id} · ${item.title}`}
      onClose={onClose}
      width="900px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btnPrimary} onClick={advance} disabled={!next}>
            {next ? `Move to ${next}` : "Final state"}
          </button>
        </>
      }
    >
      <div className={styles.wiGrid}>
        <div>
          <div className={styles.wiField}>
            <label>Description</label>
            <div className={styles.wiText}>{item.description || <i>No description</i>}</div>
          </div>

          {item.reproSteps ? (
            <div className={styles.wiField}>
              <label>Repro steps</label>
              <pre className={styles.wiPre}>{item.reproSteps}</pre>
            </div>
          ) : null}

          <div className={styles.wiField}>
            <label>Discussion ({item.comments.length})</label>
            {item.comments.map((c) => (
              <div key={c.id} className={styles.wiComment}>
                <div style={{ fontSize: 12.5, color: "#605e5c", marginBottom: 4 }}>
                  <InitialsAvatar name={c.author} /> <strong>{c.author}</strong> &middot; {c.when}
                </div>
                <div style={{ color: "#1f1f1f" }}>{c.text}</div>
              </div>
            ))}
            <textarea
              className={styles.input}
              rows={2}
              placeholder="Add a comment"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <button type="button" className={styles.btnPrimary} onClick={addComment}>
                Comment
              </button>
            </div>
          </div>

          <div className={styles.wiField}>
            <label>History</label>
            <table className={`${styles.table} ${styles.tableSmall}`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {item.history.map((h, i) => (
                  <tr key={`${h.when}-${i}`}>
                    <td>{h.when}</td>
                    <td>{h.actor}</td>
                    <td>{h.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className={styles.wiField}>
            <label>State</label>
            <div>
              <StatusPill tone={stateTone(item.state)}>{item.state}</StatusPill>
            </div>
          </div>
          <div className={styles.wiField}>
            <label>Assigned to</label>
            <div>
              <InitialsAvatar name={item.assignedTo} /> {item.assignedTo}
            </div>
          </div>
          <div className={styles.wiField}>
            <label>Created</label>
            <div>
              {item.createdDate} by {item.createdBy}
            </div>
          </div>
          <div className={styles.wiField}>
            <label>Iteration</label>
            <div>{iterationName(state, item.iteration)}</div>
          </div>
          <div className={styles.wiField}>
            <label>Area</label>
            <div>{item.area}</div>
          </div>
          <div className={styles.wiField}>
            <label>Priority</label>
            <div>{item.priority}</div>
          </div>
          {item.severity ? (
            <div className={styles.wiField}>
              <label>Severity</label>
              <div>{item.severity}</div>
            </div>
          ) : null}
          {item.storyPoints ? (
            <div className={styles.wiField}>
              <label>Story points</label>
              <div>{item.storyPoints}</div>
            </div>
          ) : null}
          {item.activity ? (
            <div className={styles.wiField}>
              <label>Activity</label>
              <div>{item.activity}</div>
            </div>
          ) : null}
          <div className={styles.wiField}>
            <label>Tags</label>
            <div>
              {item.tags.map((t) => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ===================== Page =====================

export function WorkItemsPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [filter, setFilter] = useState<WiFilter>(INITIAL_FILTER);
  const [showNewWizard, setShowNewWizard] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const people = useMemo(() => state.team.map((t) => t.name), [state.team]);

  const filtered = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    return state.workItems.filter((w) => {
      if (filter.type !== "all" && w.type !== filter.type) return false;
      if (filter.state !== "all" && w.state !== filter.state) return false;
      if (filter.assignee !== "all" && w.assignedTo !== filter.assignee) return false;
      if (q && !w.title.toLowerCase().includes(q) && !String(w.id).includes(q)) return false;
      return true;
    });
  }, [state.workItems, filter]);

  const selected = selectedId != null ? (state.workItems.find((w) => w.id === selectedId) ?? null) : null;

  function handleExport() {
    exportCsv(
      "workitems.csv",
      ["ID", "Title", "Type", "State", "AssignedTo", "Iteration", "Tags"],
      filtered.map((w) => [w.id, w.title, w.type, w.state, w.assignedTo, iterationName(state, w.iteration), w.tags.join(",")]),
    );
    toast.success(`Exported ${filtered.length} work items`);
  }

  const columns: DataTableColumn<AdoWorkItem>[] = [
    { key: "id", header: "ID", render: (w) => w.id },
    { key: "type", header: "Type", render: (w) => w.type },
    {
      key: "title",
      header: "Title",
      render: (w) => (
        <button
          type="button"
          className={styles.btnLink}
          style={{ padding: 0, textAlign: "left" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(w.id);
          }}
        >
          {w.title}
        </button>
      ),
    },
    { key: "state", header: "State", render: (w) => <StatusPill tone={stateTone(w.state)}>{w.state}</StatusPill> },
    {
      key: "assignedTo",
      header: "Assigned To",
      render: (w) => (
        <>
          <InitialsAvatar name={w.assignedTo} /> {w.assignedTo}
        </>
      ),
    },
    { key: "priority", header: "Priority", render: (w) => w.priority },
    { key: "iteration", header: "Iteration", render: (w) => iterationName(state, w.iteration) },
    {
      key: "tags",
      header: "Tags",
      render: (w) => (
        <>
          {w.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Work items</div>
      <div className={styles.pageSub}>All work items across the project.</div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowNewWizard(true)}>
          + New Work Item
        </button>
        <button type="button" className={styles.btnSubtle} onClick={handleExport}>
          Export to CSV
        </button>
        <span className={styles.tbSpacer} />
        <input
          className={styles.input}
          style={{ maxWidth: 260 }}
          placeholder="Search work items"
          value={filter.search}
          onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
        />
      </div>

      <FilterBar filter={filter} onChange={(patch) => setFilter((prev) => ({ ...prev, ...patch }))} people={people} />

      {filtered.length === 0 ? (
        <EmptyState message="No work items match the current filters." />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(w) => String(w.id)} onRowClick={(w) => setSelectedId(w.id)} />
      )}

      {showNewWizard ? <NewWorkItemModal state={state} dispatch={dispatch} onClose={() => setShowNewWizard(false)} /> : null}
      {selected ? <WorkItemDetailModal item={selected} state={state} dispatch={dispatch} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
