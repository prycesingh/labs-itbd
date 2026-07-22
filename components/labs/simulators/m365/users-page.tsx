"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365State, M365User } from "@/lib/labs/simulators/m365/types";
import { Avatar, exportCsv, Flyout, FormGroup, Modal, Pill, WizStep } from "./m365-ui";
import styles from "./m365-console.module.css";

type Filter = "all" | "licensed" | "unlicensed" | "mfa-on" | "mfa-off" | "blocked";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All users" },
  { id: "licensed", label: "Licensed users" },
  { id: "unlicensed", label: "Unlicensed users" },
  { id: "mfa-on", label: "MFA enabled" },
  { id: "mfa-off", label: "MFA disabled" },
  { id: "blocked", label: "Sign-in blocked" },
];

function skuShortName(state: M365State, sku: string): string {
  return state.licenses.find((l) => l.sku === sku)?.name ?? sku;
}

function availableSeats(state: M365State, sku: string, excludeUserId?: string): number {
  const license = state.licenses.find((l) => l.sku === sku);
  if (!license) return 0;
  const assigned = state.users.filter((u) => u.id !== excludeUserId && u.licenses.includes(sku)).length;
  return license.purchased - assigned;
}

type WizardData = {
  firstName: string;
  lastName: string;
  username: string;
  autoPassword: boolean;
  password: string;
  licenses: string[];
  jobTitle: string;
  department: string;
  officeLocation: string;
  usageLocation: string;
};

const WIZARD_STEPS = ["basics", "licenses", "settings", "review"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

function initialWizardData(): WizardData {
  return {
    firstName: "",
    lastName: "",
    username: "",
    autoPassword: true,
    password: Math.random().toString(36).slice(2, 10) + "!1",
    licenses: [],
    jobTitle: "",
    department: "",
    officeLocation: "",
    usageLocation: "IN",
  };
}

export function UsersPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("basics");
  const [wizard, setWizard] = useState<WizardData>(initialWizardData);
  const [licenseModal, setLicenseModal] = useState<{ assign: boolean; skus: Set<string> } | null>(null);
  const [roleModal, setRoleModal] = useState<{ assign: boolean; roles: Set<string> } | null>(null);

  const users = useMemo(() => {
    let list = state.users.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.upn.toLowerCase().includes(q) ||
          u.jobTitle.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q),
      );
    }
    switch (filter) {
      case "licensed":
        list = list.filter((u) => u.licenses.length > 0);
        break;
      case "unlicensed":
        list = list.filter((u) => u.licenses.length === 0);
        break;
      case "mfa-on":
        list = list.filter((u) => u.mfaEnabled);
        break;
      case "mfa-off":
        list = list.filter((u) => !u.mfaEnabled);
        break;
      case "blocked":
        list = list.filter((u) => !u.accountEnabled);
        break;
    }
    return list;
  }, [state.users, search, filter]);

  const selectedIds = Array.from(selected);
  const openUser = openUserId ? state.users.find((u) => u.id === openUserId) ?? null : null;

  function toggleSelect(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(on: boolean) {
    setSelected(on ? new Set(users.map((u) => u.id)) : new Set());
  }

  function bulkMfa(enabled: boolean) {
    if (!selectedIds.length) return toast.error("Select at least one user.");
    dispatch({ type: "SET_USER_MFA", ids: selectedIds, enabled });
    toast.success(enabled ? "MFA enabled for selected users." : "MFA disabled for selected users.");
  }

  function bulkDelete() {
    if (!selectedIds.length) return toast.error("Select at least one user.");
    if (!confirm(`Delete ${selectedIds.length} user(s)? They can be restored from Deleted users.`)) return;
    selectedIds.forEach((id) => dispatch({ type: "DELETE_USER", id }));
    setSelected(new Set());
    toast.success("User(s) deleted.");
  }

  function bulkResetPassword() {
    if (!selectedIds.length) return toast.error("Select at least one user.");
    dispatch({ type: "RESET_USER_PASSWORD", ids: selectedIds });
    toast.success("Password reset for selected users.");
  }

  function openBulkLicenses() {
    if (!selectedIds.length) return toast.error("Select at least one user.");
    setLicenseModal({ assign: true, skus: new Set() });
  }

  function openBulkRoles() {
    if (!selectedIds.length) return toast.error("Select at least one user.");
    setRoleModal({ assign: true, roles: new Set() });
  }

  function submitBulkLicenses() {
    if (!licenseModal || !licenseModal.skus.size) return toast.error("Select at least one license.");
    dispatch({ type: "ASSIGN_LICENSES", ids: selectedIds, skus: Array.from(licenseModal.skus), assign: licenseModal.assign });
    toast.success(licenseModal.assign ? "Licenses assigned." : "Licenses removed.");
    setLicenseModal(null);
  }

  function submitBulkRoles() {
    if (!roleModal || !roleModal.roles.size) return toast.error("Select at least one role.");
    dispatch({ type: "ASSIGN_ROLES", ids: selectedIds, roles: Array.from(roleModal.roles), assign: roleModal.assign });
    toast.success(roleModal.assign ? "Roles assigned." : "Roles removed.");
    setRoleModal(null);
  }

  function handleExport() {
    exportCsv(
      "users.csv",
      ["Display name", "Username", "Licenses", "Status", "MFA"],
      users.map((u) => [u.displayName, u.upn, u.licenses.length, u.accountEnabled ? "Sign-in allowed" : "Sign-in blocked", u.mfaEnabled ? "Enabled" : "Disabled"]),
    );
    toast.success("Users exported.");
  }

  function openWizard() {
    setWizard(initialWizardData());
    setWizardStep("basics");
    setShowWizard(true);
  }

  function finishWizard() {
    const displayName = `${wizard.firstName} ${wizard.lastName}`.trim();
    const username = wizard.username || `${wizard.firstName}.${wizard.lastName}`.toLowerCase();
    const newUser: M365User = {
      id: crypto.randomUUID(),
      displayName,
      firstName: wizard.firstName,
      lastName: wizard.lastName,
      username,
      domain: state.tenant.domain,
      upn: `${username}@${state.tenant.domain}`,
      jobTitle: wizard.jobTitle,
      department: wizard.department,
      officeLocation: wizard.officeLocation,
      manager: null,
      accountEnabled: true,
      mfaEnabled: false,
      licenses: wizard.licenses,
      roles: ["User"],
      createdDate: new Date().toISOString(),
      lastSignIn: "",
      signInBlocked: false,
      mobile: "",
      businessPhone: "",
      streetAddress: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      usageLocation: wizard.usageLocation,
      aboutMe: "",
    };
    dispatch({ type: "ADD_USER", user: newUser });
    toast.success(`${displayName} was added.`);
    setShowWizard(false);
  }

  function goWizardNext() {
    if (wizardStep === "basics" && (!wizard.firstName || !wizard.lastName || !wizard.username)) {
      toast.error("First name, last name and username are required.");
      return;
    }
    const idx = WIZARD_STEPS.indexOf(wizardStep);
    if (wizardStep === "review") {
      finishWizard();
      return;
    }
    setWizardStep(WIZARD_STEPS[idx + 1]);
  }

  function goWizardBack() {
    const idx = WIZARD_STEPS.indexOf(wizardStep);
    if (idx > 0) setWizardStep(WIZARD_STEPS[idx - 1]);
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Active users</h1>
      <p className={styles.pageSub}>Manage your organization&apos;s user accounts.</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={openWizard}>
          + Add a user
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => bulkMfa(true)}>
          Enable MFA
        </button>
        <button type="button" className={styles.tbBtn} onClick={() => bulkMfa(false)}>
          Disable MFA
        </button>
        <span className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={bulkDelete}>
          Delete
        </button>
        <button type="button" className={styles.tbBtn} onClick={bulkResetPassword}>
          Reset password
        </button>
        <button type="button" className={styles.tbBtn} onClick={openBulkLicenses}>
          Manage licenses
        </button>
        <button type="button" className={styles.tbBtn} onClick={openBulkRoles}>
          Manage roles
        </button>
        <span className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export
        </button>
        <span className={styles.spacer} />
        <input className={styles.input} style={{ maxWidth: 240 }} placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.filterChip} ${filter === f.id ? styles.filterChipActive : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {users.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.cbCol}>
                  <input type="checkbox" checked={selected.size > 0 && selected.size === users.length} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </th>
                <th>Display name</th>
                <th>Username</th>
                <th>Licenses</th>
                <th>Status</th>
                <th>MFA</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} onClick={() => setOpenUserId(u.id)}>
                  <td className={styles.cbCol} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(u.id)} onChange={(e) => toggleSelect(u.id, e.target.checked)} />
                  </td>
                  <td>
                    <Avatar name={u.displayName} />
                    <span className={styles.rowLink}>{u.displayName}</span>
                  </td>
                  <td>{u.upn}</td>
                  <td>{u.licenses.length ? u.licenses.length : <span className={styles.muted}>Unlicensed</span>}</td>
                  <td>
                    <Pill tone={u.accountEnabled ? "ok" : "err"}>{u.accountEnabled ? "Sign-in allowed" : "Sign-in blocked"}</Pill>
                  </td>
                  <td>
                    <Pill tone={u.mfaEnabled ? "ok" : "muted"}>{u.mfaEnabled ? "Enabled" : "Disabled"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>No users match your filter.</div>
      )}

      {showWizard ? (
        <Modal
          title="Add a user"
          onClose={() => setShowWizard(false)}
          steps={
            <>
              <WizStep label="Basics" active={wizardStep === "basics"} done={WIZARD_STEPS.indexOf(wizardStep) > 0} />
              <WizStep label="Product licenses" active={wizardStep === "licenses"} done={WIZARD_STEPS.indexOf(wizardStep) > 1} />
              <WizStep label="Optional settings" active={wizardStep === "settings"} done={WIZARD_STEPS.indexOf(wizardStep) > 2} />
              <WizStep label="Review" active={wizardStep === "review"} done={false} />
            </>
          }
          footer={
            <>
              {wizardStep !== "basics" ? (
                <button type="button" className={styles.btnOutline} onClick={goWizardBack}>
                  Back
                </button>
              ) : null}
              <button type="button" className={styles.btn} onClick={goWizardNext}>
                {wizardStep === "review" ? "Finish adding" : "Next"}
              </button>
            </>
          }
        >
          {wizardStep === "basics" ? (
            <>
              <FormGroup label="First name *">
                <input className={styles.input} value={wizard.firstName} onChange={(e) => setWizard({ ...wizard, firstName: e.target.value })} />
              </FormGroup>
              <FormGroup label="Last name *">
                <input className={styles.input} value={wizard.lastName} onChange={(e) => setWizard({ ...wizard, lastName: e.target.value })} />
              </FormGroup>
              <FormGroup label="Username *" help={`@${state.tenant.domain}`}>
                <input className={styles.input} value={wizard.username} onChange={(e) => setWizard({ ...wizard, username: e.target.value })} />
              </FormGroup>
              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={wizard.autoPassword}
                  onChange={(e) => setWizard({ ...wizard, autoPassword: e.target.checked, password: e.target.checked ? Math.random().toString(36).slice(2, 10) + "!1" : wizard.password })}
                />
                Automatically create a password
              </div>
              <input className={styles.input} value={wizard.password} readOnly={wizard.autoPassword} onChange={(e) => setWizard({ ...wizard, password: e.target.value })} />
            </>
          ) : null}

          {wizardStep === "licenses" ? (
            <>
              {state.licenses.map((l) => {
                const available = availableSeats(state, l.sku);
                const checked = wizard.licenses.includes(l.sku);
                const disabled = available <= 0 && !checked;
                return (
                  <label key={l.sku} className={styles.checkboxRow} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) =>
                        setWizard({
                          ...wizard,
                          licenses: e.target.checked ? [...wizard.licenses, l.sku] : wizard.licenses.filter((s) => s !== l.sku),
                        })
                      }
                    />
                    {l.name} ({available} available)
                  </label>
                );
              })}
            </>
          ) : null}

          {wizardStep === "settings" ? (
            <>
              <FormGroup label="Job title">
                <input className={styles.input} value={wizard.jobTitle} onChange={(e) => setWizard({ ...wizard, jobTitle: e.target.value })} />
              </FormGroup>
              <FormGroup label="Department">
                <input className={styles.input} value={wizard.department} onChange={(e) => setWizard({ ...wizard, department: e.target.value })} />
              </FormGroup>
              <FormGroup label="Office">
                <input className={styles.input} value={wizard.officeLocation} onChange={(e) => setWizard({ ...wizard, officeLocation: e.target.value })} />
              </FormGroup>
              <FormGroup label="Usage location">
                <input className={styles.input} value={wizard.usageLocation} onChange={(e) => setWizard({ ...wizard, usageLocation: e.target.value })} />
              </FormGroup>
            </>
          ) : null}

          {wizardStep === "review" ? (
            <>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Display name</div>
                <div>{`${wizard.firstName} ${wizard.lastName}`.trim()}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>User principal name</div>
                <div>{`${wizard.username || `${wizard.firstName}.${wizard.lastName}`.toLowerCase()}@${state.tenant.domain}`}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Job title</div>
                <div>{wizard.jobTitle || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Department</div>
                <div>{wizard.department || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Office</div>
                <div>{wizard.officeLocation || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Licenses</div>
                <div>{wizard.licenses.length ? wizard.licenses.map((s) => skuShortName(state, s)).join(", ") : "None"}</div>
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}

      {licenseModal ? (
        <Modal title="Manage product licenses" onClose={() => setLicenseModal(null)} footer={<button type="button" className={styles.btn} onClick={submitBulkLicenses}>Save</button>}>
          <div className={styles.radioRow}>
            <label>
              <input type="radio" checked={licenseModal.assign} onChange={() => setLicenseModal({ ...licenseModal, assign: true })} /> Assign
            </label>
            <label>
              <input type="radio" checked={!licenseModal.assign} onChange={() => setLicenseModal({ ...licenseModal, assign: false })} /> Unassign
            </label>
          </div>
          {state.licenses.map((l) => (
            <label key={l.sku} className={styles.checkboxRow} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}>
              <input
                type="checkbox"
                checked={licenseModal.skus.has(l.sku)}
                onChange={(e) => {
                  const skus = new Set(licenseModal.skus);
                  if (e.target.checked) skus.add(l.sku);
                  else skus.delete(l.sku);
                  setLicenseModal({ ...licenseModal, skus });
                }}
              />
              {l.name}
            </label>
          ))}
        </Modal>
      ) : null}

      {roleModal ? (
        <Modal title="Manage roles" onClose={() => setRoleModal(null)} footer={<button type="button" className={styles.btn} onClick={submitBulkRoles}>Save</button>}>
          <div className={styles.radioRow}>
            <label>
              <input type="radio" checked={roleModal.assign} onChange={() => setRoleModal({ ...roleModal, assign: true })} /> Assign
            </label>
            <label>
              <input type="radio" checked={!roleModal.assign} onChange={() => setRoleModal({ ...roleModal, assign: false })} /> Unassign
            </label>
          </div>
          {state.roles.map((r) => (
            <label key={r} className={styles.checkboxRow} style={{ padding: "6px 0" }}>
              <input
                type="checkbox"
                checked={roleModal.roles.has(r)}
                onChange={(e) => {
                  const roles = new Set(roleModal.roles);
                  if (e.target.checked) roles.add(r);
                  else roles.delete(r);
                  setRoleModal({ ...roleModal, roles });
                }}
              />
              {r}
            </label>
          ))}
        </Modal>
      ) : null}

      {openUser ? (
        <UserFlyout state={state} dispatch={dispatch} user={openUser} onClose={() => setOpenUserId(null)} />
      ) : null}
    </div>
  );
}

type FlyoutTab = "account" | "licenses" | "roles" | "mfa";

function UserFlyout({ state, dispatch, user, onClose }: { state: M365State; dispatch: (action: M365Action) => void; user: M365User; onClose: () => void }) {
  const [tab, setTab] = useState<FlyoutTab>("account");
  const [form, setForm] = useState({
    displayName: user.displayName,
    jobTitle: user.jobTitle,
    department: user.department,
    officeLocation: user.officeLocation,
  });

  function saveAccount() {
    dispatch({ type: "UPDATE_USER", id: user.id, patch: form });
    toast.success("User details saved.");
  }

  function resetPassword() {
    dispatch({ type: "RESET_USER_PASSWORD", ids: [user.id] });
    toast.success("Password reset.");
  }

  function deleteUser() {
    if (!confirm(`Delete ${user.displayName}?`)) return;
    dispatch({ type: "DELETE_USER", id: user.id });
    toast.success("User deleted.");
    onClose();
  }

  function toggleLicense(sku: string, on: boolean) {
    dispatch({ type: "ASSIGN_LICENSES", ids: [user.id], skus: [sku], assign: on });
    toast.success(on ? "License assigned." : "License removed.");
  }

  function toggleRole(role: string, on: boolean) {
    dispatch({ type: "ASSIGN_ROLES", ids: [user.id], roles: [role], assign: on });
    toast.success(on ? "Role assigned." : "Role removed.");
  }

  function toggleMfa(on: boolean) {
    dispatch({ type: "SET_USER_MFA", ids: [user.id], enabled: on });
    toast.success(on ? "MFA enabled." : "MFA disabled.");
  }

  return (
    <Flyout
      title={user.displayName}
      onClose={onClose}
      tabs={
        <>
          <button type="button" className={`${styles.tab} ${tab === "account" ? styles.tabActive : ""}`} onClick={() => setTab("account")}>
            Account
          </button>
          <button type="button" className={`${styles.tab} ${tab === "licenses" ? styles.tabActive : ""}`} onClick={() => setTab("licenses")}>
            Licenses and apps
          </button>
          <button type="button" className={`${styles.tab} ${tab === "roles" ? styles.tabActive : ""}`} onClick={() => setTab("roles")}>
            Roles
          </button>
          <button type="button" className={`${styles.tab} ${tab === "mfa" ? styles.tabActive : ""}`} onClick={() => setTab("mfa")}>
            MFA
          </button>
        </>
      }
    >
      {tab === "account" ? (
        <>
          <FormGroup label="Display name">
            <input className={styles.input} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </FormGroup>
          <FormGroup label="Job title">
            <input className={styles.input} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </FormGroup>
          <FormGroup label="Department">
            <input className={styles.input} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </FormGroup>
          <FormGroup label="Office">
            <input className={styles.input} value={form.officeLocation} onChange={(e) => setForm({ ...form, officeLocation: e.target.value })} />
          </FormGroup>
          <button type="button" className={styles.btn} onClick={saveAccount}>
            Save
          </button>
          <span style={{ display: "inline-block", width: 8 }} />
          <button type="button" className={styles.btnOutline} onClick={resetPassword}>
            Reset password
          </button>
          <span style={{ display: "inline-block", width: 8 }} />
          <button type="button" className={styles.btnDanger} onClick={deleteUser}>
            Delete user
          </button>
        </>
      ) : null}

      {tab === "licenses" ? (
        <>
          {state.licenses.map((l) => {
            const has = user.licenses.includes(l.sku);
            const available = availableSeats(state, l.sku, user.id);
            const disabled = available <= 0 && !has;
            return (
              <label key={l.sku} className={styles.checkboxRow} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}>
                <input type="checkbox" checked={has} disabled={disabled} onChange={(e) => toggleLicense(l.sku, e.target.checked)} />
                {l.name} ({available} available)
              </label>
            );
          })}
        </>
      ) : null}

      {tab === "roles" ? (
        <>
          {state.roles.map((r) => (
            <label key={r} className={styles.checkboxRow} style={{ padding: "6px 0" }}>
              <input type="checkbox" checked={user.roles.includes(r)} onChange={(e) => toggleRole(r, e.target.checked)} />
              {r}
            </label>
          ))}
        </>
      ) : null}

      {tab === "mfa" ? (
        <div className={styles.checkboxRow}>
          <input type="checkbox" checked={user.mfaEnabled} onChange={(e) => toggleMfa(e.target.checked)} />
          Require multi-factor authentication
        </div>
      ) : null}
    </Flyout>
  );
}

export function DeletedUsersPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  function restore(id: string, displayName: string) {
    dispatch({ type: "RESTORE_USER", id });
    toast.success(`${displayName} was restored.`);
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Deleted users</h1>
      <p className={styles.pageSub}>Restore a user within 30 days of deletion.</p>

      {state.deletedUsers.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Display name</th>
                <th>Deleted date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.deletedUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Avatar name={u.displayName} />
                    {u.displayName}
                  </td>
                  <td>{u.deletedOn ? new Date(u.deletedOn).toLocaleString() : "-"}</td>
                  <td>
                    <button type="button" className={styles.btnSubtle} onClick={() => restore(u.id, u.displayName)}>
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>No deleted users.</div>
      )}
    </div>
  );
}
