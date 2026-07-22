"use client";

import { useMemo, useState } from "react";

import type { AvdApplicationGroup, AvdState, AvdUser } from "@/lib/labs/simulators/avd/types";

import styles from "./avd-console.module.css";
import { Checkbox, DataTable, EmptyState, PropPair, SectionHeader } from "./avd-ui";

// A user (real person or group pseudo-entry) is considered "assigned" to an
// application group if either their UPN or their display name appears in
// that group's `assignments` list. The source simulator's own assignment
// arrays are a mix of real UPNs (for direct assignment) and group display
// names (e.g. "Finance-Team") for group-based assignment, so checking both
// fields is what actually reproduces its behavior — a plain UPN-only match
// would silently miss every group-based assignment.
function groupsForUser(user: AvdUser, applicationGroups: AvdApplicationGroup[]): AvdApplicationGroup[] {
  return applicationGroups.filter((g) => g.assignments.includes(user.upn) || g.assignments.includes(user.displayName));
}

function workspacesForGroups(groupIds: string[], state: AvdState): string[] {
  return state.workspaces.filter((w) => w.applicationGroups.some((id) => groupIds.includes(id))).map((w) => w.name);
}

export function UsersPage({ state }: { state: AvdState }) {
  const [showGroups, setShowGroups] = useState(false);
  const [selectedUpn, setSelectedUpn] = useState<string | null>(null);

  const realUserCount = useMemo(() => state.users.filter((u) => u.role === "AVD User").length, [state.users]);
  const groupCount = useMemo(() => state.users.filter((u) => u.role === "Group").length, [state.users]);

  const visibleUsers = useMemo(
    () => (showGroups ? state.users : state.users.filter((u) => u.role === "AVD User")),
    [state.users, showGroups],
  );

  const selectedUser = useMemo(
    () => (selectedUpn ? state.users.find((u) => u.upn === selectedUpn) ?? null : null),
    [selectedUpn, state.users],
  );

  const selectedUserGroups = useMemo(
    () => (selectedUser ? groupsForUser(selectedUser, state.applicationGroups) : []),
    [selectedUser, state.applicationGroups],
  );

  const selectedUserWorkspaces = useMemo(
    () => workspacesForGroups(selectedUserGroups.map((g) => g.id), state),
    [selectedUserGroups, state],
  );

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Users</h1>
      <p className={styles.help} style={{ marginBottom: 20 }}>
        Cross-pool view of every user and group, and which application groups (and workspaces) grant them access.
      </p>

      <div className={styles.sectionCard}>
        <h3>Overview</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          <div className={styles.card} style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 6 }}>Real users</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{realUserCount}</div>
          </div>
          <div className={styles.card} style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 6 }}>Groups</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{groupCount}</div>
          </div>
          <div className={styles.card} style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 6 }}>Application groups</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{state.applicationGroups.length}</div>
          </div>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <SectionHeader title="All users" sub="Click a row to see which application groups (and workspaces) grant that user access." />
        <Checkbox label="Show groups" checked={showGroups} onChange={setShowGroups} help="Groups are pseudo-users referenced by app group assignments, not real people." />

        {visibleUsers.length === 0 ? (
          <EmptyState message="No users to show." />
        ) : (
          <DataTable columns={["Display name", "UPN / Group", "Type", "Department", "Application groups"]}>
            {visibleUsers.map((u) => {
              const assigned = groupsForUser(u, state.applicationGroups);
              return (
                <tr
                  key={u.upn}
                  onClick={() => setSelectedUpn(u.upn)}
                  style={{ cursor: "pointer", background: selectedUpn === u.upn ? "#f3f9fd" : undefined }}
                >
                  <td>{u.displayName}</td>
                  <td className={styles.help} style={{ fontFamily: "Consolas, monospace" }}>
                    {u.upn}
                  </td>
                  <td>{u.role}</td>
                  <td>{u.department || "—"}</td>
                  <td>{assigned.length === 0 ? "—" : assigned.map((g) => g.name).join(", ")}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>

      {selectedUser ? (
        <div className={styles.sectionCard}>
          <SectionHeader title={`Access details — ${selectedUser.displayName}`} />
          <PropPair label="UPN / Group" value={selectedUser.upn} />
          <PropPair label="Type" value={selectedUser.role} />
          <PropPair label="Department" value={selectedUser.department || "—"} />
          <PropPair
            label="Workspaces"
            value={selectedUserWorkspaces.length === 0 ? "—" : selectedUserWorkspaces.join(", ")}
          />

          <h3 style={{ marginTop: 16 }}>Application group assignments</h3>
          {selectedUserGroups.length === 0 ? (
            <EmptyState message="Not assigned to any application group." />
          ) : (
            <DataTable columns={["Application group", "Type", "Host pool", "Workspace"]}>
              {selectedUserGroups.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.type}</td>
                  <td>{g.hostPool}</td>
                  <td>{g.workspace ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      ) : null}
    </div>
  );
}
