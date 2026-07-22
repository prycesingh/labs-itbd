"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import type { IntuneGroup, IntuneState, IntuneUser } from "@/lib/labs/simulators/intune/types";
import { Avatar, Flyout, FormGroup, Modal, Pill, exportCsv } from "./intune-ui";
import styles from "./intune-console.module.css";

const LICENSE_SKUS = ["Microsoft 365 E3", "Microsoft 365 E5", "Intune Plan 1", "Entra ID P1", "Entra ID P2", "Power BI Pro"];

const SIGN_IN_LOGS = [
  { app: "Microsoft 365", location: "IN/Mumbai", time: "2026-07-09 09:18", status: "Success" },
  { app: "Outlook", location: "IN/Mumbai", time: "2026-07-09 09:14", status: "Success" },
  { app: "Azure Portal", location: "US/New York", time: "2026-07-08 14:42", status: "Success (MFA)" },
  { app: "Teams", location: "IN/Mumbai", time: "2026-07-08 09:08", status: "Success" },
  { app: "SharePoint", location: "IN/Mumbai", time: "2026-07-07 18:42", status: "Failure (50158)" },
];

function compliancePillTone(c: string): "ok" | "warn" | "err" | "muted" {
  if (c === "Compliant") return "ok";
  if (c === "Not compliant") return "err";
  if (c === "In grace period") return "warn";
  return "muted";
}

function groupMembershipFor(state: IntuneState, user: IntuneUser): IntuneGroup[] {
  const dept = user.department.toLowerCase();
  return state.groups.filter((g) => g.name.toLowerCase().includes(dept) || g.description.toLowerCase().includes(dept));
}

export function UsersPage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? state.users.find((u) => u.id === selectedUserId) : undefined;

  function handleExport() {
    exportCsv(
      "intune-users.csv",
      ["Display name", "UPN", "Department", "Devices", "Licenses"],
      state.users.map((u) => [u.name, u.upn, u.department, state.devices.filter((d) => d.primaryUser === u.id).length, u.licenses.length]),
    );
    toast.info("User export started — file ready in Reports");
  }

  function handleBulkLicense() {
    toast.info("Bulk license assignment: upload CSV (UPN,SKU), validate, apply in batches of 250");
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Users</h1>
      <p className={styles.pageSub}>{state.users.length} users. Click any row for devices, licenses, group membership, and sign-in logs.</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export CSV
        </button>
        <button type="button" className={styles.tbBtn} onClick={handleBulkLicense}>
          Bulk license assignment
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Display name</th>
              <th>User principal name</th>
              <th>Department</th>
              <th>Devices</th>
              <th>Licenses</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => {
              const deviceCount = state.devices.filter((d) => d.primaryUser === u.id).length;
              return (
                <tr key={u.id} onClick={() => setSelectedUserId(u.id)}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={u.name} />
                      <b>{u.name}</b>
                    </span>
                  </td>
                  <td>
                    <code>{u.upn}</code>
                  </td>
                  <td>{u.department}</td>
                  <td>{deviceCount}</td>
                  <td>{u.licenses.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedUser ? <UserFlyout state={state} user={selectedUser} dispatch={dispatch} onClose={() => setSelectedUserId(null)} /> : null}
    </div>
  );
}

function UserFlyout({ state, user, dispatch, onClose }: { state: IntuneState; user: IntuneUser; dispatch: (action: IntuneAction) => void; onClose: () => void }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const devices = state.devices.filter((d) => d.primaryUser === user.id);
  const groups = groupMembershipFor(state, user);

  function reqConfirm(message: string, successMessage: string) {
    if (!confirm(message)) return;
    toast.success(successMessage);
  }

  function handleExportUser() {
    exportCsv(
      `intune-user-${user.upn}.csv`,
      ["Display name", "UPN", "Department", "Devices", "Licenses"],
      [[user.name, user.upn, user.department, devices.length, user.licenses.length]],
    );
  }

  return (
    <Flyout
      title={user.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={() => reqConfirm(`Reset MFA registration for ${user.upn}? User will be prompted to re-register at next sign-in.`, `MFA reset queued for ${user.upn}`)}>
            Reset MFA
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => reqConfirm(`Revoke all active sessions for ${user.upn}? User will be signed out of all apps immediately.`, `All sessions revoked for ${user.upn}`)}>
            Revoke sessions
          </button>
          <button type="button" className={styles.btnOutline} onClick={() => reqConfirm(`Reset password for ${user.upn}? A temporary password will be sent to the manager.`, `Password reset queued for ${user.upn}. Temporary password sent to manager.`)}>
            Reset password
          </button>
          <button type="button" className={styles.btnOutline} onClick={handleExportUser}>
            Export user
          </button>
        </>
      }
    >
      <p className={styles.pageSub}>
        <code>{user.upn}</code> &middot; {user.department} &middot; {devices.length} device{devices.length === 1 ? "" : "s"} &middot; {user.licenses.length} license{user.licenses.length === 1 ? "" : "s"}
      </p>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Devices ({devices.length})</div>
        {devices.length === 0 ? (
          <div className={styles.emptyState}>No devices enrolled for this user.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>OS</th>
                  <th>Compliance</th>
                  <th>Last check-in</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <b>{d.name}</b>
                    </td>
                    <td>
                      {d.os} {d.osVersion}
                    </td>
                    <td>
                      <Pill tone={compliancePillTone(d.compliance)}>{d.compliance}</Pill>
                    </td>
                    <td>{new Date(d.lastCheckIn).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Licenses</div>
        {user.licenses.length === 0 ? (
          <div className={styles.emptyState}>No licenses assigned.</div>
        ) : (
          <ul style={{ margin: "6px 0 0 18px", fontSize: 13, lineHeight: 1.8 }}>
            {user.licenses.map((l) => (
              <li key={l}>
                {l}{" "}
                <button type="button" className={styles.btnSubtle} onClick={() => dispatch({ type: "REMOVE_LICENSE", userId: user.id, license: l })}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 8 }}>
          <button type="button" className={styles.btnSubtle} onClick={() => setAssignOpen(true)}>
            + Assign license
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Group membership</div>
        {groups.length === 0 ? (
          <div className={styles.emptyState}>Not in any group.</div>
        ) : (
          <ul style={{ margin: "6px 0 0 18px", fontSize: 13, lineHeight: 1.8 }}>
            {groups.map((g) => (
              <li key={g.id}>
                {g.name} ({g.type})
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Recent sign-ins</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>App</th>
                <th>Location</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SIGN_IN_LOGS.map((l, i) => (
                <tr key={i}>
                  <td>{l.app}</td>
                  <td>{l.location}</td>
                  <td>{l.time}</td>
                  <td>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assignOpen ? <AssignLicenseModal user={user} dispatch={dispatch} onClose={() => setAssignOpen(false)} /> : null}
    </Flyout>
  );
}

function AssignLicenseModal({ user, dispatch, onClose }: { user: IntuneUser; dispatch: (action: IntuneAction) => void; onClose: () => void }) {
  const available = LICENSE_SKUS.filter((sku) => !user.licenses.includes(sku));
  const [sku, setSku] = useState(available[0] ?? "");

  function handleAssign() {
    if (!sku) return;
    dispatch({ type: "ASSIGN_LICENSE", userId: user.id, license: sku });
    toast.success(`License "${sku}" assigned to ${user.upn}`);
    onClose();
  }

  return (
    <Modal
      title="Assign license"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} disabled={!sku} onClick={handleAssign}>
            Assign
          </button>
        </>
      }
    >
      {available.length === 0 ? (
        <div className={styles.emptyState}>All available license SKUs are already assigned to this user.</div>
      ) : (
        <FormGroup label="License SKU">
          <select className={styles.select} value={sku} onChange={(e) => setSku(e.target.value)}>
            {available.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormGroup>
      )}
    </Modal>
  );
}

export function GroupsPage({ state }: { state: IntuneState }) {
  return (
    <div>
      <h1 className={styles.pageH1}>Groups</h1>
      <p className={styles.pageSub}>{state.groups.length} groups</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Members</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {state.groups.map((g) => (
              <tr key={g.id}>
                <td>
                  <b>{g.name}</b>
                </td>
                <td>
                  <Pill tone={g.type === "Dynamic" ? "info" : "muted"}>{g.type}</Pill>
                </td>
                <td>{g.members}</td>
                <td>{g.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
