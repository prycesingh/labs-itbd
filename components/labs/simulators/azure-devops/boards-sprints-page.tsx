"use client";

// Sprints (Kanban) page for the Azure DevOps simulator. Ported from
// itbd-lab/simulators/azure-devops/js/ado-boards.js `renderSprints()` and its
// four `sprintView` bodies (kanban / backlog / capacity / analytics) — this
// file covers ONLY the "boards-sprints" page (Taskboard/Backlog/Capacity/
// Analytics sub-tabs for the active sprint). Work Items list, project-wide
// Backlog hierarchy, Queries, and Delivery Plans are other pages/agents'
// scope (source's `renderWorkItems`/`renderBacklog`/`renderQueries`/
// `renderPlans`), not duplicated here.
//
// Scope is fixed to the CURRENT sprint (source lets the user flip between
// iter-123/iter-124/iter-125 via top-level tabs inside Sprints; that
// iteration switcher is out of scope for this single-file port — we render
// whichever iteration has `state: "current"` in state.iterations, matching
// the brief).
//
// Taskboard drag-and-drop is REAL: native HTML5 draggable/onDragStart/
// onDragOver/onDrop (no DnD library), tracking the dragged work item id in
// local useState, dispatching MOVE_WORK_ITEM_TO_STATE on drop — exactly
// source's onDragStart/onDragOver/onDrop trio, just as React event props
// instead of inline `ondragstart="..."` attribute strings.
//
// Column → state mapping is ported verbatim from source's `onDrop(ev, colId)`
// ternary (ado-boards.js lines ~553-556): colId 'New' → Task:'To Do' /
// other:'New', 'Active' → Task:'In Progress' / other:'Active',
// 'CodeReview' → 'Resolved' (both Task and non-Task — source has no
// Task-specific code-review state), 'Done' → Task:'Done' / other:'Closed'.
//
// Analytics' three charts are ALL decorative in source (this sub-phase's
// real-engine investment went into Pipelines, not Sprint analytics) — ported
// as-is in depth, with the ONLY change being that source's `Math.random()`
// calls are replaced by small deterministic seeded functions so the numbers
// are stable across re-renders within a session:
//   - Burndown: ideal is a real linear decay from item count to 0; "actual"
//     keeps source's `ideal + Math.sin(d) * 1.5` decorative wobble shape
//     (already deterministic given `d`, so it needed no change) — ported
//     verbatim from `renderBurndown()`.
//   - Velocity: source's hardcoded `planned`/`completed` arrays for 6
//     sprints, ported verbatim as a bar chart — no seeding needed, nothing
//     random in source here.
//   - Cycle-time scatter: source's per-render `Math.random()` cycle-days
//     generator is replaced with `seededCycleDays(id, type)`, a tiny
//     deterministic hash-based generator keyed on the item's own id so the
//     same item always plots at the same (SP, days) point across renders —
//     still illustrative/non-derived-from-real-dates, just stable now.

import { useState } from "react";
import { toast } from "sonner";

import type { AdoState, AdoWorkItem, AdoWorkItemType } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";

import { DataTable, InitialsAvatar, StatusPill, SubTabBar, statusTone } from "./ado-ui";
import styles from "./ado-console.module.css";

type SprintSubTab = "kanban" | "backlog" | "capacity" | "analytics";

const SUB_TABS: { key: SprintSubTab; label: string }[] = [
  { key: "kanban", label: "Taskboard" },
  { key: "backlog", label: "Backlog" },
  { key: "capacity", label: "Capacity" },
  { key: "analytics", label: "Analytics" },
];

// ===== Taskboard columns =====
// Ported verbatim from source's `COLUMNS` (ado-boards.js line ~339-344) —
// column id, display label, and the set of real work-item `state` values
// that land a card in that column.
type KanbanColumnId = "New" | "Active" | "CodeReview" | "Done";

const COLUMNS: { id: KanbanColumnId; label: string; match: string[] }[] = [
  { id: "New", label: "To Do", match: ["New", "To Do"] },
  { id: "Active", label: "In Progress", match: ["Active", "In Progress"] },
  { id: "CodeReview", label: "Code Review", match: ["Resolved"] },
  { id: "Done", label: "Done", match: ["Done", "Closed"] },
];

// Ported verbatim from source's `onDrop()` ternary — maps a dropped-on
// column id back to the real per-type state value.
function columnToState(colId: KanbanColumnId, type: AdoWorkItemType): string {
  if (colId === "New") return type === "Task" ? "To Do" : "New";
  if (colId === "Active") return type === "Task" ? "In Progress" : "Active";
  if (colId === "CodeReview") return "Resolved";
  return type === "Task" ? "Done" : "Closed";
}

// Ported verbatim from source's `wiIcon(type)` color table.
function typeColor(type: AdoWorkItemType): string {
  if (type === "Bug") return "#cc293d";
  if (type === "Epic") return "#ff7b00";
  if (type === "Feature") return "#773b93";
  if (type === "User Story") return "#009ccc";
  return "#f2cb1d"; // Task
}

function typeGlyph(type: AdoWorkItemType): string {
  if (type === "Bug") return "●";
  if (type === "Task") return "✓";
  if (type === "Epic") return "♔";
  if (type === "Feature") return "★";
  return "□"; // User Story
}

function TypeBadge({ type }: { type: AdoWorkItemType }) {
  return (
    <span className={styles.wiIco} style={{ color: typeColor(type) }}>
      {typeGlyph(type)} {type}
    </span>
  );
}

// ===== Deterministic seeding (no Math.random anywhere in this file) =====
// Small string hash → [0,1) generator, same shape as the seeded generators
// already used elsewhere in this simulator's lib layer (e.g. seedData.ts
// `randHash`) — deterministic given the same key, so repeated renders of the
// same work item always produce the same decorative value.
function seededUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Fold to a positive 32-bit value, then to [0,1).
  return ((h >>> 0) % 100000) / 100000;
}

// Replaces source's `w.type === 'Task' ? 1 + Math.floor(Math.random()*3) : ...`
// per-render randomness with a deterministic value seeded by the item's own
// id (and type, for salt) — same ranges as source, per type.
function seededCycleDays(id: number, type: AdoWorkItemType): number {
  const u = seededUnit(`cycle-${id}-${type}`);
  if (type === "Task") return 1 + Math.floor(u * 3);
  if (type === "Bug") return 2 + Math.floor(u * 5);
  return 3 + Math.floor(u * 8);
}

const CAPACITY_HOURS_PER_SPRINT = 60; // 6 hrs/day × 10 working days — ported verbatim from source.

export function BoardsSprintsPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [subTab, setSubTab] = useState<SprintSubTab>("kanban");
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const iteration = state.iterations.find((i) => i.state === "current") ?? state.iterations[0];
  const items = state.workItems.filter((w) => w.iteration === iteration?.id);

  if (!iteration) {
    return <div className={styles.empty}>No sprint iteration is configured.</div>;
  }

  // ===== Sprint banner (real aggregation, ported from renderSprintBanner) =====
  let totalPts = 0;
  let donePts = 0;
  for (const w of items) {
    if (w.storyPoints) totalPts += w.storyPoints;
    if ((w.state === "Closed" || w.state === "Done") && w.storyPoints) donePts += w.storyPoints;
  }
  const pct = totalPts ? Math.round((donePts / totalPts) * 100) : 0;

  function handleDrop(colId: KanbanColumnId) {
    if (draggedId == null) return;
    const item = items.find((w) => w.id === draggedId);
    setDraggedId(null);
    if (!item) return;
    const nextState = columnToState(colId, item.type);
    if (nextState === item.state) return;
    dispatch({ type: "MOVE_WORK_ITEM_TO_STATE", id: item.id, state: nextState });
    toast.success(`#${item.id} → ${nextState}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Sprints</div>
      <div className={styles.pageSub}>Sprint board for {iteration.name} with drag-and-drop columns.</div>

      <div className={styles.sprintBanner}>
        <div>
          <strong>{iteration.name}</strong> · {iteration.start ? `${iteration.start} → ${iteration.end}` : "Backlog"}
        </div>
        <div>
          {items.length} work items · {donePts} / {totalPts} SP ({pct}%)
        </div>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={(k) => setSubTab(k as SprintSubTab)} />

      {subTab === "kanban" && <TaskboardTab items={items} draggedId={draggedId} setDraggedId={setDraggedId} onDrop={handleDrop} />}
      {subTab === "backlog" && <BacklogTab items={items} />}
      {subTab === "capacity" && <CapacityTab team={state.team} items={items} iterationName={iteration.name} />}
      {subTab === "analytics" && <AnalyticsTab items={items} />}
    </div>
  );
}

// ===== Taskboard =====

function TaskboardTab({
  items,
  draggedId,
  setDraggedId,
  onDrop,
}: {
  items: AdoWorkItem[];
  draggedId: number | null;
  setDraggedId: (id: number | null) => void;
  onDrop: (colId: KanbanColumnId) => void;
}) {
  return (
    <div className={styles.kanban}>
      {COLUMNS.map((col) => {
        const matched = items.filter((w) => col.match.indexOf(w.state) !== -1);
        return (
          <div
            key={col.id}
            className={styles.kanbanCol}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(col.id);
            }}
          >
            <div className={styles.kbH}>
              <span>{col.label}</span>
              <span className={styles.kbCount}>{matched.length}</span>
            </div>
            <div className={styles.kbBody}>
              {matched.length === 0 ? (
                <div className={styles.kbEmpty}>No items</div>
              ) : (
                matched.map((w) => (
                  <div
                    key={w.id}
                    className={styles.cardMini}
                    draggable
                    onDragStart={() => setDraggedId(w.id)}
                    onDragEnd={() => setDraggedId(null)}
                    style={draggedId === w.id ? { opacity: 0.5 } : undefined}
                  >
                    <div className={styles.cmId}>
                      <TypeBadge type={w.type} /> #{w.id}
                    </div>
                    <div className={styles.cmTitle}>{w.title}</div>
                    <div className={styles.cmMeta}>
                      <InitialsAvatar name={w.assignedTo} />
                      <span style={{ marginLeft: 4 }}>{w.assignedTo}</span>
                      {w.priority ? <span style={{ marginLeft: "auto", fontSize: 11, color: "#605e5c" }}>P{w.priority}</span> : null}
                      {w.storyPoints ? <span className={styles.cmSp} style={{ marginLeft: 6 }}>{w.storyPoints}</span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Backlog (flat table for this sprint) =====

function BacklogTab({ items }: { items: AdoWorkItem[] }) {
  return (
    <DataTable<AdoWorkItem>
      columns={[
        { key: "id", header: "ID", render: (w) => `#${w.id}` },
        { key: "title", header: "Title", render: (w) => w.title },
        { key: "type", header: "Type", render: (w) => <TypeBadge type={w.type} /> },
        { key: "state", header: "State", render: (w) => <StatusPill tone={statusTone(w.state)}>{w.state}</StatusPill> },
        { key: "sp", header: "SP / Remaining", render: (w) => w.remainingWork ?? w.storyPoints ?? "-" },
        {
          key: "assignee",
          header: "Assignee",
          render: (w) => (
            <>
              <InitialsAvatar name={w.assignedTo} /> {w.assignedTo}
            </>
          ),
        },
        { key: "priority", header: "Priority", render: (w) => w.priority ?? "-" },
      ]}
      rows={items}
      getRowKey={(w) => String(w.id)}
      emptyMessage="No work items in this sprint."
    />
  );
}

// ===== Capacity (real per-person aggregation, ported from renderSprintCapacity) =====

function CapacityTab({ team, items, iterationName }: { team: AdoState["team"]; items: AdoWorkItem[]; iterationName: string }) {
  const rows = team.map((p) => {
    const assigned = items.filter((w) => w.assignedTo === p.name);
    const hrs = assigned.reduce((s, w) => s + (w.remainingWork || w.storyPoints || 0), 0);
    const capacityPct = Math.round((hrs / CAPACITY_HOURS_PER_SPRINT) * 100);
    return { name: p.name, role: p.role, hrs, pct: capacityPct, count: assigned.length };
  });

  const totalHrs = rows.reduce((s, r) => s + r.hrs, 0);
  const totalCap = rows.length * CAPACITY_HOURS_PER_SPRINT;
  const teamPct = totalCap ? Math.round((totalHrs / totalCap) * 100) : 0;

  function barColor(p: number): string {
    if (p > 100) return "#a4262c";
    if (p > 85) return "#d83b01";
    if (p > 60) return "#107c10";
    return "#605e5c";
  }
  function statusLabel(p: number): string {
    if (p > 100) return "Overcommitted";
    if (p > 85) return "Near capacity";
    if (p > 60) return "On track";
    return "Under-allocated";
  }

  return (
    <>
      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Team capacity</strong> &mdash; {iterationName}
          </div>
          <div>
            {totalHrs} / {totalCap} h ({teamPct}%)
          </div>
        </div>
        <div className={`${styles.progress} ${styles.progressWide}`} style={{ marginTop: 8 }}>
          <div className={styles.progressFill} style={{ width: `${Math.min(100, teamPct)}%`, background: teamPct > 100 ? "#a4262c" : "#107c10" }} />
        </div>
      </div>

      <DataTable<(typeof rows)[number]>
        columns={[
          {
            key: "name",
            header: "Team member",
            render: (r) => (
              <>
                <InitialsAvatar name={r.name} /> <b>{r.name}</b>
                <div style={{ fontSize: 11, color: "#605e5c" }}>{r.role || "Engineer"}</div>
              </>
            ),
          },
          { key: "hrs", header: "Assigned", render: (r) => `${r.hrs} h` },
          { key: "capacity", header: "Capacity", render: () => `${CAPACITY_HOURS_PER_SPRINT} h` },
          {
            key: "utilisation",
            header: "Utilisation",
            render: (r) => (
              <div>
                <div className={styles.progress} style={{ width: 150 }}>
                  <div className={styles.progressFill} style={{ width: `${Math.min(100, r.pct)}%`, background: barColor(r.pct) }} />
                </div>
                <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>{r.pct}%</div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <span style={{ color: barColor(r.pct), fontWeight: 600 }}>{statusLabel(r.pct)}</span>,
          },
          { key: "count", header: "Items", render: (r) => r.count },
        ]}
        rows={rows}
        getRowKey={(r) => r.name}
        emptyMessage="No team members."
      />

      <div style={{ background: "#deecf9", padding: "10px 14px", borderLeft: "3px solid #0078d4", marginTop: 14, fontSize: 12 }}>
        <b>Capacity calc:</b> 6 hours/day &times; 10 working days/sprint = {CAPACITY_HOURS_PER_SPRINT} hours per person. Subtract days off /
        company meetings / on-call rotation. <b>Tip:</b> If someone is 100%+, redistribute items in Sprint Planning before kickoff.
      </div>
    </>
  );
}

// ===== Analytics (Burndown / Velocity / Cycle-time — decorative, ported as-is) =====

function AnalyticsTab({ items }: { items: AdoWorkItem[] }) {
  return (
    <>
      <div className={styles.h2}>Burndown</div>
      <Burndown itemCount={items.length} />

      <div className={styles.h2} style={{ marginTop: 18 }}>
        Velocity (last 6 sprints)
      </div>
      <Velocity />

      <div className={styles.h2} style={{ marginTop: 18 }}>
        Cycle time scatter
      </div>
      <CycleScatter items={items} />
    </>
  );
}

// Ported verbatim from source's `renderBurndown(itemCount)` — ideal is a real
// linear decay; "actual" is `ideal + Math.sin(d) * 1.5`, a decorative wobble
// that was already deterministic given `d` (no Math.random involved), so it
// is kept as-is per the brief.
function Burndown({ itemCount }: { itemCount: number }) {
  const days = 10;
  const ideal: number[] = [];
  const actual: number[] = [];
  for (let d = 0; d <= days; d++) {
    ideal.push(Math.round(itemCount - (itemCount * d) / days));
    actual.push(Math.round(itemCount - itemCount * Math.min(1, d / days) + Math.sin(d) * 1.5));
  }
  const maxV = itemCount || 10;

  return (
    <div className={styles.fakeChart}>
      <div className={styles.barRow}>
        {ideal.map((v, i) => {
          const ih = Math.max(2, (v / maxV) * 110);
          const ah = Math.max(2, (actual[i] / maxV) * 110);
          return (
            <div key={i} className={`${styles.barCol} ${styles.barColHasIdeal}`}>
              <div className={styles.barIdeal} style={{ height: `${ih}px` }} />
              <div className={styles.barActual} style={{ height: `${ah}px` }} />
              <div className={styles.barLabel}>D{i}</div>
            </div>
          );
        })}
      </div>
      <div className={styles.chartLegend}>
        <span className={styles.lgIdeal} /> Ideal &nbsp; <span className={styles.lgActual} /> Actual
      </div>
    </div>
  );
}

// Ported verbatim from source's `renderVelocity()` — fully hardcoded static
// arrays (source calls this "Mock 6 sprints of completed story points");
// nothing random here, so nothing needed seeding.
const VELOCITY_SPRINTS = ["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Sprint 5", "Sprint 6 (cur)"];
const VELOCITY_PLANNED = [42, 50, 48, 55, 60, 62];
const VELOCITY_COMPLETED = [38, 46, 50, 51, 56, 38];

function Velocity() {
  const max = Math.max(...VELOCITY_PLANNED);
  const avg = Math.round(VELOCITY_COMPLETED.slice(0, 5).reduce((s, x) => s + x, 0) / 5);

  return (
    <div className={styles.fakeChart}>
      <div style={{ whiteSpace: "nowrap", overflowX: "auto" }}>
        <div className={styles.barRow} style={{ borderBottom: "none", display: "inline-flex" }}>
          {VELOCITY_SPRINTS.map((s, i) => {
            const planned = VELOCITY_PLANNED[i];
            const completed = VELOCITY_COMPLETED[i];
            const pH = (planned / max) * 130;
            const cH = (completed / max) * 130;
            const color = completed >= planned ? "#107c10" : completed >= planned * 0.85 ? "#d83b01" : "#a4262c";
            return (
              <div key={s} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: "0 10px", width: 80 }}>
                <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 140 }}>
                  <div style={{ width: 20, background: "#c8c6c4", height: pH }} title={`Planned: ${planned}`} />
                  <div style={{ width: 20, background: color, height: cH }} title={`Completed: ${completed}`} />
                </div>
                <div style={{ fontSize: 11, color: "#605e5c", marginTop: 6 }}>{s}</div>
                <div style={{ fontSize: 11, color, fontWeight: 600 }}>
                  {completed} / {planned}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "#605e5c" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#c8c6c4", verticalAlign: "middle" }} /> Planned
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#107c10", verticalAlign: "middle" }} /> Completed
        </span>
      </div>
      <div style={{ background: "#deecf9", padding: "10px 14px", borderLeft: "3px solid #0078d4", marginTop: 14, fontSize: 12 }}>
        <b>Average velocity (last 5 sprints): {avg} SP.</b> Use this to set capacity for next sprint &plusmn; 10%. Current sprint is tracking
        below average &mdash; investigate if interrupts / unplanned work caused it.
      </div>
    </div>
  );
}

// Ported from source's `renderCycleScatter(items)` — same SVG scatter shape
// and (SP, cycle-days) plot logic, but `Math.random()` is replaced with
// `seededCycleDays(id, type)` so the same 12 items always render at the same
// coordinates across re-renders within a session.
function CycleScatter({ items }: { items: AdoWorkItem[] }) {
  const data = items.slice(0, 12).map((w) => ({
    id: w.id,
    type: w.type,
    days: seededCycleDays(w.id, w.type),
    sp: w.storyPoints || 1,
  }));

  const w = 600;
  const h = 200;
  const maxDays = data.length ? Math.max(...data.map((d) => d.days)) : 10;
  const maxSp = data.length ? Math.max(...data.map((d) => d.sp)) : 10;

  function dotColor(type: AdoWorkItemType): string {
    if (type === "Task") return "#107c10";
    if (type === "Bug") return "#a4262c";
    return "#0078d4";
  }

  return (
    <div className={styles.fakeChart}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="200">
        <line x1={30} y1={h - 20} x2={w - 10} y2={h - 20} stroke="#a19f9d" />
        <line x1={30} y1={10} x2={30} y2={h - 20} stroke="#a19f9d" />
        {data.map((d) => {
          const x = (d.sp / maxSp) * (w - 40) + 30;
          const y = h - 20 - (d.days / maxDays) * (h - 30);
          return (
            <circle key={d.id} cx={x} cy={y} r={6} fill={dotColor(d.type)} opacity={0.7}>
              <title>
                #{d.id} {d.type} · {d.sp} SP / {d.days} days
              </title>
            </circle>
          );
        })}
        <text x={w / 2} y={h - 4} textAnchor="middle" fontSize={11} fill="#605e5c">
          Story points →
        </text>
        <text x={10} y={h / 2} textAnchor="middle" fontSize={11} fill="#605e5c" transform={`rotate(-90 10 ${h / 2})`}>
          Cycle time (days) →
        </text>
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12, color: "#605e5c" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#107c10", borderRadius: "50%", verticalAlign: "middle" }} />{" "}
          Task
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#a4262c", borderRadius: "50%", verticalAlign: "middle" }} />{" "}
          Bug
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#0078d4", borderRadius: "50%", verticalAlign: "middle" }} />{" "}
          Story / Feature
        </span>
      </div>
    </div>
  );
}
