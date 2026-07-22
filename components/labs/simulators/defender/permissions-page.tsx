"use client";

// Permissions & roles — ported from defender-permissions.js. Full RBAC CRUD:
// role list (6 seeded roles: 4 built-in Entra + 2 Defender-custom), role
// detail flyout (Permissions/Members/Settings tabs via TabBar), Add-member
// modal with search + JIT toggle, 5-step "Create custom role" wizard,
// clone/delete role, CSV export. State lives in DefenderState/defenderReducer;
// only view/selection/wizard/modal state is local (useState), matching the
// source's ensureState() (persisted) vs. detailTab/wiz/addMemberCtx
// (transient UI) split.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { DefenderAction } from "@/lib/labs/simulators/defender/reducer";
import type { DefenderRole, DefenderRoleAssignment, DefenderState, DefenderWorkloadId } from "@/lib/labs/simulators/defender/types";
import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatRow,
  StatusPill,
  SubTabBar,
  TabBar,
  WizStep,
  exportCsv,
} from "./defender-ui";
import styles from "./defender-console.module.css";

const SCOPE_OPTIONS = ["Tenant", "All devices", "India devices group", "EU devices group", "Production servers", "Workstations only"];

const WIZ_STEPS = ["1. Name", "2. Workloads", "3. Permissions", "4. Scope", "5. Review"];

type WizardDraft = {
  name: string;
  desc: string;
  workloads: DefenderWorkloadId[];
  actions: string[];
  scope: string;
  jit: boolean;
};

function emptyDraft(): WizardDraft {
  return { name: "", desc: "", workloads: ["xdr", "endpoints"], actions: [], scope: "All devices", jit: true };
}

export function PermissionsPage({ state, dispatch }: { state: DefenderState; dispatch: React.Dispatch<DefenderAction> }) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<string>("permissions");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStep, setWizStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft());

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberJit, setAddMemberJit] = useState(false);

  const selectedRole = state.roles.find((r) => r.id === selectedRoleId) ?? null;

  function openDetail(roleId: string) {
    setSelectedRoleId(roleId);
    setDetailTab("permissions");
  }
  function closeDetail() {
    setSelectedRoleId(null);
  }

  function memberCount(roleId: string): number {
    return state.roleAssignments.filter((a) => a.roleId === roleId).length;
  }

  // ----- Create custom role wizard -----
  function openWizard() {
    setDraft(emptyDraft());
    setWizStep(0);
    setWizardOpen(true);
  }

  function toggleWizWorkload(id: DefenderWorkloadId) {
    setDraft((d) => {
      const workloads = d.workloads.includes(id) ? d.workloads.filter((w) => w !== id) : [...d.workloads, id];
      const allowed = new Set<string>();
      workloads.forEach((w) => (state.actionLibrary[w] || []).forEach((a) => allowed.add(a)));
      return { ...d, workloads, actions: d.actions.filter((a) => allowed.has(a)) };
    });
  }

  function toggleWizAction(action: string) {
    setDraft((d) => ({ ...d, actions: d.actions.includes(action) ? d.actions.filter((a) => a !== action) : [...d.actions, action] }));
  }

  function wizNext() {
    if (wizStep === 0 && !draft.name.trim()) {
      toast.error("Enter a role name.");
      return;
    }
    if (wizStep === 1 && draft.workloads.length === 0) {
      toast.error("Select at least one workload.");
      return;
    }
    if (wizStep === 2 && draft.actions.length === 0) {
      toast.error("Grant at least one permission.");
      return;
    }
    setWizStep((s) => Math.min(s + 1, WIZ_STEPS.length - 1));
  }

  function finishWizard() {
    const role: DefenderRole = {
      id: "role-" + crypto.randomUUID(),
      name: draft.name.trim(),
      type: "Defender custom",
      desc: draft.desc.trim() || "Custom role",
      workloads: draft.workloads.slice(),
      actions: draft.actions.slice(),
      scope: draft.scope,
      jit: draft.jit,
      builtIn: false,
    };
    dispatch({ type: "ADD_ROLE", role });
    toast.success(`Custom role created: ${role.name}`);
    setWizardOpen(false);
  }

  // ----- Add member modal -----
  function openAddMember() {
    setAddMemberSearch("");
    setAddMemberJit(false);
    setAddMemberOpen(true);
  }

  function addMember(userId: string) {
    if (!selectedRole) return;
    const assignment: DefenderRoleAssignment = {
      roleId: selectedRole.id,
      userId,
      assignedOn: new Date().toISOString().slice(0, 10),
      assignedBy: "admin@itbd.net",
      jit: addMemberJit,
      expiresOn: null,
    };
    dispatch({ type: "ADD_ROLE_ASSIGNMENT", assignment });
    toast.success("Member added");
    setAddMemberOpen(false);
  }

  function removeMember(roleId: string, userId: string) {
    if (!confirm("Remove this member from the role?")) return;
    dispatch({ type: "DELETE_ROLE_ASSIGNMENT", roleId, userId });
    toast.success("Member removed");
  }

  // ----- Settings tab actions -----
  function editRole(roleId: string, patch: Partial<DefenderRole>) {
    dispatch({ type: "UPDATE_ROLE", id: roleId, patch });
  }

  function cloneRole(role: DefenderRole) {
    const clone: DefenderRole = {
      ...role,
      id: "role-" + crypto.randomUUID(),
      name: role.name + " - Copy",
      builtIn: false,
      workloads: role.workloads.slice(),
      actions: role.actions.slice(),
    };
    dispatch({ type: "ADD_ROLE", role: clone });
    toast.success(`Role cloned: ${clone.name}`);
  }

  function confirmDeleteRole(role: DefenderRole) {
    if (role.builtIn) {
      toast.error("Built-in Entra roles cannot be deleted.");
      return;
    }
    const assigned = memberCount(role.id);
    const msg = `Delete custom role "${role.name}"?${assigned > 0 ? ` This will remove ${assigned} assigned member${assigned === 1 ? "" : "s"}.` : ""}`;
    if (!confirm(msg)) return;
    // Cascade removal of assignments is handled inside the reducer's DELETE_ROLE
    // case (additive change alongside the existing roles filter), so a single
    // dispatch here is sufficient — see reducer.ts DELETE_ROLE.
    dispatch({ type: "DELETE_ROLE", id: role.id });
    toast.success("Role deleted");
    closeDetail();
  }

  function handleExportCsv() {
    const headers = ["role", "type", "scope", "jit", "members"];
    const rows = state.roles.map((r) => [r.name, r.type, r.scope, r.jit ? "Yes" : "No", memberCount(r.id)]);
    exportCsv("defender-roles.csv", headers, rows);
    toast.success("Roles exported");
  }

  const totalAssignments = state.roleAssignments.length;
  const customRoleCount = state.roles.filter((r) => !r.builtIn).length;
  const jitAssignmentCount = state.roleAssignments.filter((a) => a.jit).length;

  return (
    <div>
      <div className={styles.breadcrumb}>
        <a>Home</a> <span>/</span> Permissions &amp; roles
      </div>
      <div className={styles.pageH1}>Permissions &amp; roles</div>
      <div className={styles.pageSub}>
        Microsoft Entra global roles and Defender-specific custom roles. Click a role to view permissions + members.
      </div>

      <StatRow
        stats={[
          { label: "Total roles", value: state.roles.length },
          { label: "Custom roles", value: customRoleCount },
          { label: "Total assignments", value: totalAssignments },
          { label: "JIT-eligible", value: jitAssignmentCount },
        ]}
      />

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={openWizard}>
          + Create custom role
        </button>
        <button type="button" className={styles.btn} onClick={handleExportCsv}>
          Export CSV
        </button>
      </div>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Role",
            render: (r: DefenderRole) => (
              <span>
                <b>{r.name}</b>
                {r.jit ? (
                  <span style={{ marginLeft: 4 }}>
                    <StatusPill tone="warn">JIT / PIM eligible</StatusPill>
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (r: DefenderRole) => <StatusPill tone={r.type === "Entra" ? "info" : "muted"}>{r.type}</StatusPill>,
          },
          { key: "workloads", header: "Workloads", render: (r: DefenderRole) => r.workloads.length },
          { key: "members", header: "Members", render: (r: DefenderRole) => memberCount(r.id) },
          { key: "scope", header: "Scope", render: (r: DefenderRole) => r.scope },
          { key: "desc", header: "Description", render: (r: DefenderRole) => r.desc },
        ]}
        rows={state.roles}
        getRowKey={(r) => r.id}
        onRowClick={(r) => openDetail(r.id)}
        emptyMessage="No roles."
      />

      <div className={styles.card} style={{ marginTop: 18 }}>
        <b>Built-in roles</b> come from Microsoft Entra and cannot be edited or deleted — you can only assign members.{" "}
        <b>Defender custom roles</b> can be edited, scoped to a device group, and toggled JIT (just-in-time activation via
        Privileged Identity Management).
      </div>

      {selectedRole ? (
        <RoleDetailFlyout
          role={selectedRole}
          state={state}
          detailTab={detailTab}
          onTabChange={setDetailTab}
          onClose={closeDetail}
          onAddMember={openAddMember}
          onRemoveMember={removeMember}
          onEditRole={editRole}
          onCloneRole={cloneRole}
          onDeleteRole={confirmDeleteRole}
        />
      ) : null}

      {addMemberOpen && selectedRole ? (
        <AddMemberModal
          role={selectedRole}
          state={state}
          search={addMemberSearch}
          onSearchChange={setAddMemberSearch}
          jit={addMemberJit}
          onJitChange={setAddMemberJit}
          onAdd={addMember}
          onClose={() => setAddMemberOpen(false)}
        />
      ) : null}

      {wizardOpen ? (
        <CreateRoleWizard
          state={state}
          draft={draft}
          setDraft={setDraft}
          step={wizStep}
          onToggleWorkload={toggleWizWorkload}
          onToggleAction={toggleWizAction}
          onBack={() => setWizStep((s) => Math.max(0, s - 1))}
          onNext={wizNext}
          onFinish={finishWizard}
          onClose={() => setWizardOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ===== Role detail flyout =====

function RoleDetailFlyout({
  role,
  state,
  detailTab,
  onTabChange,
  onClose,
  onAddMember,
  onRemoveMember,
  onEditRole,
  onCloneRole,
  onDeleteRole,
}: {
  role: DefenderRole;
  state: DefenderState;
  detailTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  onAddMember: () => void;
  onRemoveMember: (roleId: string, userId: string) => void;
  onEditRole: (roleId: string, patch: Partial<DefenderRole>) => void;
  onCloneRole: (role: DefenderRole) => void;
  onDeleteRole: (role: DefenderRole) => void;
}) {
  const members = useMemo(() => state.roleAssignments.filter((a) => a.roleId === role.id), [state.roleAssignments, role.id]);

  return (
    <Flyout
      title={role.name}
      subtitle={
        <span>
          {role.type} &middot; Scope: {role.scope} &middot; {members.length} member{members.length === 1 ? "" : "s"}
          {role.builtIn ? " · Built-in (read-only permissions)" : " · Custom role"}
        </span>
      }
      onClose={onClose}
      tabs={
        <TabBar
          tabs={[
            { key: "permissions", label: "Permissions" },
            { key: "members", label: `Members (${members.length})` },
            { key: "settings", label: "Settings" },
          ]}
          active={detailTab}
          onChange={onTabChange}
        />
      }
    >
      {detailTab === "members" ? (
        <MembersTab role={role} state={state} members={members} onAddMember={onAddMember} onRemoveMember={onRemoveMember} />
      ) : detailTab === "settings" ? (
        <SettingsTab role={role} onEditRole={onEditRole} onCloneRole={onCloneRole} onDeleteRole={onDeleteRole} />
      ) : (
        <PermissionsTab role={role} state={state} />
      )}
    </Flyout>
  );
}

function PermissionsTab({ role, state }: { role: DefenderRole; state: DefenderState }) {
  return (
    <div>
      <div className={styles.formGroup}>
        <b>Scope:</b> {role.scope}
      </div>
      {state.workloads.map((w) => {
        const inRole = role.workloads.includes(w.id);
        const actions = state.actionLibrary[w.id] || [];
        return (
          <div key={w.id}>
            <div className={styles.h3}>
              {w.label}
              {!inRole ? (
                <span style={{ marginLeft: 6 }}>
                  <StatusPill tone="muted">Workload not in role</StatusPill>
                </span>
              ) : null}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  {actions.map((a) => {
                    const granted = inRole && role.actions.includes(a);
                    return (
                      <tr key={a}>
                        <td style={{ width: 60, textAlign: "center" }}>{granted ? "✓" : "—"}</td>
                        <td>{a}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MembersTab({
  role,
  state,
  members,
  onAddMember,
  onRemoveMember,
}: {
  role: DefenderRole;
  state: DefenderState;
  members: DefenderRoleAssignment[];
  onAddMember: () => void;
  onRemoveMember: (roleId: string, userId: string) => void;
}) {
  if (members.length === 0) {
    return (
      <div>
        <EmptyState message="No members assigned to this role yet." />
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btnPrimary} onClick={onAddMember}>
            + Add member
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <button type="button" className={styles.btnPrimary} onClick={onAddMember}>
          + Add member
        </button>
      </div>
      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (a: DefenderRoleAssignment) => {
              const u = state.permUsers.find((u) => u.id === a.userId);
              if (!u) return null;
              return (
                <span>
                  <b>{u.name}</b>
                  <br />
                  <span style={{ fontSize: 11, color: "#605e5c" }}>{u.upn}</span>
                </span>
              );
            },
          },
          {
            key: "department",
            header: "Department",
            render: (a: DefenderRoleAssignment) => state.permUsers.find((u) => u.id === a.userId)?.department ?? "—",
          },
          {
            key: "assigned",
            header: "Assigned",
            render: (a: DefenderRoleAssignment) => (
              <span>
                {a.assignedOn}
                <br />
                <span style={{ fontSize: 11, color: "#605e5c" }}>by {a.assignedBy}</span>
              </span>
            ),
          },
          {
            key: "activation",
            header: "Activation",
            render: (a: DefenderRoleAssignment) => (a.jit ? <StatusPill tone="warn">JIT eligible</StatusPill> : <StatusPill tone="ok">Permanent</StatusPill>),
          },
          { key: "expires", header: "Expires", render: (a: DefenderRoleAssignment) => a.expiresOn ?? "—" },
          {
            key: "actions",
            header: "",
            render: (a: DefenderRoleAssignment) => (
              <button
                type="button"
                className={styles.btnSubtle}
                style={{ color: "#a4262c" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMember(role.id, a.userId);
                }}
              >
                Remove
              </button>
            ),
          },
        ]}
        rows={members}
        getRowKey={(a) => `${a.roleId}-${a.userId}`}
        emptyMessage="No members assigned to this role yet."
      />
    </div>
  );
}

function SettingsTab({
  role,
  onEditRole,
  onCloneRole,
  onDeleteRole,
}: {
  role: DefenderRole;
  onEditRole: (roleId: string, patch: Partial<DefenderRole>) => void;
  onCloneRole: (role: DefenderRole) => void;
  onDeleteRole: (role: DefenderRole) => void;
}) {
  if (role.builtIn) {
    return (
      <div className={styles.card}>
        This is a built-in Entra role — its name, scope, and permissions are managed by Microsoft Entra. You can only
        assign members.
      </div>
    );
  }

  return (
    <div>
      <Field label="Name">
        <input className={styles.input} type="text" value={role.name} onChange={(e) => onEditRole(role.id, { name: e.target.value })} />
      </Field>
      <Field label="Description">
        <textarea
          className={styles.textarea}
          rows={2}
          value={role.desc}
          onChange={(e) => onEditRole(role.id, { desc: e.target.value })}
        />
      </Field>
      <Field label="Scope (device group)">
        <NativeSelect
          value={role.scope}
          onChange={(value) => onEditRole(role.id, { scope: value })}
          options={SCOPE_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
      </Field>
      <Checkbox
        label="JIT / PIM eligible (member must activate the role each time)"
        checked={role.jit}
        onChange={(checked) => onEditRole(role.id, { jit: checked })}
      />
      <div className={styles.formGroup} style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button type="button" className={styles.btn} onClick={() => onCloneRole(role)}>
          Clone role
        </button>
        <button type="button" className={styles.btn} style={{ color: "#a4262c", borderColor: "#a4262c" }} onClick={() => onDeleteRole(role)}>
          Delete role
        </button>
      </div>
    </div>
  );
}

// ===== Add member modal =====

function AddMemberModal({
  role,
  state,
  search,
  onSearchChange,
  jit,
  onJitChange,
  onAdd,
  onClose,
}: {
  role: DefenderRole;
  state: DefenderState;
  search: string;
  onSearchChange: (v: string) => void;
  jit: boolean;
  onJitChange: (v: boolean) => void;
  onAdd: (userId: string) => void;
  onClose: () => void;
}) {
  const existing = useMemo(
    () => new Set(state.roleAssignments.filter((a) => a.roleId === role.id).map((a) => a.userId)),
    [state.roleAssignments, role.id],
  );

  const matching = useMemo(() => {
    const q = search.toLowerCase();
    return state.permUsers.filter((u) => {
      if (existing.has(u.id)) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.upn.toLowerCase().includes(q) || u.department.toLowerCase().includes(q);
    });
  }, [state.permUsers, existing, search]);

  return (
    <Modal title={`Add member to ${role.name}`} width="640px" onClose={onClose}>
      <div className={styles.formGroup}>
        <input
          className={styles.input}
          type="text"
          placeholder="Search by name, UPN, or department"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Checkbox
        label="Assign as JIT / PIM eligible (member activates the role on demand via Privileged Identity Management)"
        checked={jit}
        onChange={onJitChange}
      />
      <DataTable
        columns={[
          {
            key: "user",
            header: "User",
            render: (u) => (
              <span>
                <b>{u.name}</b>
                <br />
                <span style={{ fontSize: 11, color: "#605e5c" }}>{u.upn}</span>
              </span>
            ),
          },
          { key: "department", header: "Department", render: (u) => u.department },
          {
            key: "action",
            header: "",
            render: (u) => (
              <button type="button" className={styles.btnSubtle} onClick={() => onAdd(u.id)}>
                + Add
              </button>
            ),
          },
        ]}
        rows={matching}
        getRowKey={(u) => u.id}
        onRowClick={(u) => onAdd(u.id)}
        emptyMessage="No matching users."
      />
    </Modal>
  );
}

// ===== Create custom role wizard =====

function CreateRoleWizard({
  state,
  draft,
  setDraft,
  step,
  onToggleWorkload,
  onToggleAction,
  onBack,
  onNext,
  onFinish,
  onClose,
}: {
  state: DefenderState;
  draft: WizardDraft;
  setDraft: React.Dispatch<React.SetStateAction<WizardDraft>>;
  step: number;
  onToggleWorkload: (id: DefenderWorkloadId) => void;
  onToggleAction: (action: string) => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const isLastStep = step === WIZ_STEPS.length - 1;

  return (
    <Modal
      title="Create custom role"
      width="720px"
      onClose={onClose}
      steps={WIZ_STEPS.map((label, i) => (
        <WizStep key={label} label={label} active={i === step} done={i < step} />
      ))}
      footer={
        <>
          {step > 0 ? (
            <button type="button" className={styles.btn} onClick={onBack}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          {isLastStep ? (
            <button type="button" className={styles.btnPrimary} onClick={onFinish}>
              Create role
            </button>
          ) : (
            <button type="button" className={styles.btnPrimary} onClick={onNext}>
              Next →
            </button>
          )}
        </>
      }
    >
      {step === 0 ? (
        <div>
          <div className={styles.h3}>Name and describe the role</div>
          <Field label="Role name *">
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. SOC Tier 1.5 Analyst"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={styles.textarea}
              rows={3}
              value={draft.desc}
              onChange={(e) => setDraft((d) => ({ ...d, desc: e.target.value }))}
            />
          </Field>
          <div className={styles.card}>Custom roles supplement Entra roles. Members get the union of all assigned roles&rsquo; permissions.</div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <div className={styles.h3}>Which Defender workloads should this role cover?</div>
          <p>You&rsquo;ll choose individual permissions per workload in the next step.</p>
          {state.workloads.map((w) => (
            <Checkbox key={w.id} label={w.label} checked={draft.workloads.includes(w.id)} onChange={() => onToggleWorkload(w.id)} />
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <div className={styles.h3}>Select permissions</div>
          {draft.workloads.map((wId) => {
            const w = state.workloads.find((x) => x.id === wId);
            if (!w) return null;
            const actions = state.actionLibrary[wId] || [];
            return (
              <div key={wId}>
                <div className={styles.h3}>{w.label}</div>
                {actions.map((a) => (
                  <Checkbox key={a} label={a} checked={draft.actions.includes(a)} onChange={() => onToggleAction(a)} />
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className={styles.h3}>Scope and activation</div>
          <Field label="Device group / scope">
            <NativeSelect value={draft.scope} onChange={(value) => setDraft((d) => ({ ...d, scope: value }))} options={SCOPE_OPTIONS.map((o) => ({ value: o, label: o }))} />
          </Field>
          <Checkbox
            label="JIT / PIM eligible — members must activate the role each time (approval optional, max 8h)"
            checked={draft.jit}
            onChange={(checked) => setDraft((d) => ({ ...d, jit: checked }))}
          />
          <div className={styles.card}>
            Recommended: <b>JIT enabled</b> for any role with destructive actions (Isolate, Stop and quarantine, Release
            from quarantine).
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div>
          <div className={styles.h3}>Review</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td style={{ width: 160, color: "#605e5c" }}>Name</td>
                  <td>
                    <b>{draft.name}</b>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Description</td>
                  <td>{draft.desc || "(none)"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Workloads</td>
                  <td>{draft.workloads.map((w) => state.workloads.find((x) => x.id === w)?.label ?? w).join(", ")}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Permissions</td>
                  <td>{draft.actions.length} selected</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>Scope</td>
                  <td>{draft.scope}</td>
                </tr>
                <tr>
                  <td style={{ color: "#605e5c" }}>JIT / PIM eligible</td>
                  <td>{draft.jit ? "Yes — members activate via PIM" : "No — permanent assignment"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.card}>
            Clicking <b>Create role</b> adds this to Defender custom roles. Assign members from the role&rsquo;s detail
            view.
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
