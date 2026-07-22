"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsComputer, AddsGroup, AddsState, AddsUser } from "@/lib/labs/simulators/adds/types";
import { AddsContextMenu, type ContextMenuItem } from "./adds-context-menu";
import { AddsDialog, CheckboxRow, EmptyPane, FormRow, FormSection, HelpText } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable, ListBox, MmcLayout, MmcTreeNode, TabbedPanel, type TreeNode } from "./mmc-console";
import styles from "./adds-console.module.css";

type Dialog =
  | { kind: "new-user"; ou: string }
  | { kind: "new-group"; ou: string }
  | { kind: "new-computer"; ou: string }
  | { kind: "new-ou" }
  | { kind: "reset-password"; sam: string }
  | { kind: "move-user"; sam: string }
  | { kind: "move-computer"; name: string }
  | { kind: "add-to-group"; sam: string }
  | { kind: "add-member"; groupName: string }
  | { kind: "user-properties"; sam: string }
  | { kind: "group-properties"; name: string }
  | { kind: "computer-properties"; name: string }
  | { kind: "find" };

function containerOf(nodeId: string): string {
  if (nodeId.startsWith("builtin:")) return nodeId.slice(8);
  if (nodeId.startsWith("ou:")) return nodeId.slice(3);
  return "";
}

export function AducConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("domain");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ domain: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const domainTree: TreeNode = {
    id: "domain",
    icon: "AD",
    label: state.domain.fqdn,
    children: [
      { id: "builtin:Builtin", icon: "B", label: "Builtin" },
      { id: "builtin:Computers", icon: "C", label: "Computers" },
      { id: "builtin:Domain Controllers", icon: "O", label: "Domain Controllers" },
      { id: "builtin:ForeignSecurityPrincipals", icon: "F", label: "ForeignSecurityPrincipals" },
      { id: "builtin:Managed Service Accounts", icon: "M", label: "Managed Service Accounts" },
      { id: "builtin:Users", icon: "U", label: "Users" },
      ...state.ous
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((ou) => ({ id: `ou:${ou.name}`, icon: "O", label: ou.name })),
    ],
  };

  const treeRoot: TreeNode = { id: "root", icon: "", label: "", children: [{ id: "saved-queries", icon: "SQ", label: "Saved Queries" }, domainTree] };

  function headingFor(node: string): string {
    if (node === "saved-queries") return "Saved Queries";
    if (node === "domain") return state.domain.fqdn;
    if (node.startsWith("builtin:")) return node.slice(8);
    if (node.startsWith("ou:")) return node.slice(3);
    return "";
  }

  function usersIn(container: string): AddsUser[] {
    return state.users.filter((u) => u.ouPath === container);
  }
  function groupsIn(container: string): AddsGroup[] {
    return state.groups.filter((g) => g.ouPath === container);
  }
  function computersIn(container: string): AddsComputer[] {
    return state.computers.filter((c) => c.ouPath === container);
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const canCreate = nodeId === "domain" || nodeId.startsWith("ou:") || nodeId.startsWith("builtin:");
    const isOu = nodeId.startsWith("ou:");
    const container = containerOf(nodeId) || "Users";
    const items: ContextMenuItem[] = [];
    if (canCreate) {
      items.push({
        key: "new",
        label: "New",
        children: [
          { key: "new-user", label: "User", onClick: () => setDialog({ kind: "new-user", ou: container }) },
          { key: "new-group", label: "Group", onClick: () => setDialog({ kind: "new-group", ou: container }) },
          { key: "new-computer", label: "Computer", onClick: () => setDialog({ kind: "new-computer", ou: container }) },
          { key: "new-ou", label: "Organizational Unit", onClick: () => setDialog({ kind: "new-ou" }) },
        ],
      });
      items.push("-");
    }
    items.push({ key: "find", label: "Find...", onClick: () => setDialog({ kind: "find" }) });
    if (isOu) {
      items.push("-");
      items.push({
        key: "delete-ou",
        label: "Delete",
        onClick: () => {
          const name = containerOf(nodeId);
          const before = state.ous.length;
          dispatch({ type: "DELETE_OU", name });
          setTimeout(() => {
            toast.success(`Deleted OU ${name}`);
          }, 0);
          if (before === state.ous.length) toast.error("Cannot delete OU — it still contains objects.");
          setSelectedNode("domain");
        },
      });
      items.push({
        key: "rename-ou",
        label: "Rename",
        onClick: () => {
          const oldName = containerOf(nodeId);
          const newName = prompt("Rename OU:", oldName);
          if (!newName || newName === oldName) return;
          if (state.ous.some((o) => o.name === newName)) {
            toast.error("Another OU with that name already exists.");
            return;
          }
          dispatch({ type: "RENAME_OU", oldName, newName });
          setSelectedNode(`ou:${newName}`);
          toast.success(`Renamed OU "${oldName}" to "${newName}"`);
        },
      });
    }
    AddsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showUserContextMenu(e: React.MouseEvent, sam: string) {
    const u = state.users.find((x) => x.sAMAccountName === sam);
    if (!u) return;
    AddsContextMenu.show(e.clientX, e.clientY, [
      { key: "rpwd", label: "Reset Password...", onClick: () => setDialog({ kind: "reset-password", sam }) },
      {
        key: "tgl",
        label: u.enabled ? "Disable Account" : "Enable Account",
        onClick: () => {
          dispatch({ type: "SET_USER_ENABLED", sam, enabled: !u.enabled });
          toast.success(`Account ${u.enabled ? "disabled" : "enabled"}`);
        },
      },
      { key: "mv", label: "Move...", onClick: () => setDialog({ kind: "move-user", sam }) },
      "-",
      {
        key: "del",
        label: "Delete",
        onClick: () => {
          if (confirm(`Are you sure you want to delete user "${sam}"?`)) {
            dispatch({ type: "DELETE_USER", sam });
            toast.success(`Deleted ${sam}`);
          }
        },
      },
      { key: "add", label: "Add to a group...", onClick: () => setDialog({ kind: "add-to-group", sam }) },
      "-",
      { key: "pr", label: "Properties", onClick: () => setDialog({ kind: "user-properties", sam }) },
    ]);
  }

  function showGroupContextMenu(e: React.MouseEvent, gname: string) {
    const g = state.groups.find((x) => x.name === gname);
    if (!g) return;
    AddsContextMenu.show(e.clientX, e.clientY, [
      { key: "pr", label: "Properties", onClick: () => setDialog({ kind: "group-properties", name: gname }) },
      {
        key: "del",
        label: "Delete",
        onClick: () => {
          if (g.builtin) {
            toast.error("Built-in groups cannot be deleted.");
            return;
          }
          if (confirm(`Delete group "${gname}"?`)) {
            dispatch({ type: "DELETE_GROUP", name: gname });
            toast.success(`Deleted ${gname}`);
          }
        },
      },
    ]);
  }

  function showComputerContextMenu(e: React.MouseEvent, cname: string) {
    AddsContextMenu.show(e.clientX, e.clientY, [
      { key: "pr", label: "Properties", onClick: () => setDialog({ kind: "computer-properties", name: cname }) },
      { key: "mv", label: "Move...", onClick: () => setDialog({ kind: "move-computer", name: cname }) },
      {
        key: "del",
        label: "Delete",
        onClick: () => {
          if (confirm(`Delete computer "${cname}" from the directory?`)) {
            dispatch({ type: "DELETE_COMPUTER", name: cname });
            toast.success(`Deleted ${cname}`);
          }
        },
      },
    ]);
  }

  function showEmptyAreaContextMenu(e: React.MouseEvent) {
    const container = containerOf(selectedNode);
    if (!container) return;
    AddsContextMenu.show(e.clientX, e.clientY, [
      {
        key: "new",
        label: "New",
        children: [
          { key: "eu", label: "User", onClick: () => setDialog({ kind: "new-user", ou: container }) },
          { key: "eg", label: "Group", onClick: () => setDialog({ kind: "new-group", ou: container }) },
          { key: "ec", label: "Computer", onClick: () => setDialog({ kind: "new-computer", ou: container }) },
          { key: "eo", label: "Organizational Unit", onClick: () => setDialog({ kind: "new-ou" }) },
        ],
      },
    ]);
  }

  const container = containerOf(selectedNode);
  const isContainerNode = selectedNode.startsWith("builtin:") || selectedNode.startsWith("ou:");

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={treeRoot}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
          onContextMenu={showTreeContextMenu}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          {selectedNode === "saved-queries" ? (
            <EmptyPane>
              There are no items to show in this view.
              <br />
              <br />
              Right-click <b>Saved Queries</b> to create a new query.
            </EmptyPane>
          ) : selectedNode === "domain" ? (
            <EmptyPane>Select a container or organizational unit from the tree to view its contents.</EmptyPane>
          ) : isContainerNode ? (
            (() => {
              const users = usersIn(container);
              const groups = groupsIn(container);
              const computers = computersIn(container);
              const total = users.length + groups.length + computers.length;
              if (total === 0) {
                return (
                  <ContentBody onContextMenu={showEmptyAreaContextMenu}>
                    <EmptyPane>
                      There are no items to show in this view.
                      <br />
                      <br />
                      Right-click in the empty area to create a new object.
                    </EmptyPane>
                  </ContentBody>
                );
              }
              return (
                <ContentBody onContextMenu={(e) => showEmptyAreaContextMenu(e)}>
                  <ItemListTable columns={["Name", "Type", "Description"]}>
                    {users.map((u) => (
                      <tr
                        key={u.sAMAccountName}
                        className={selectedRow === u.sAMAccountName ? styles.itemListRowSelected : ""}
                        onClick={() => setSelectedRow(u.sAMAccountName)}
                        onDoubleClick={() => setDialog({ kind: "user-properties", sam: u.sAMAccountName })}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedRow(u.sAMAccountName);
                          showUserContextMenu(e, u.sAMAccountName);
                        }}
                      >
                        <td>
                          <span className={styles.itmIcon}>U</span>
                          {u.displayName || u.sAMAccountName}
                        </td>
                        <td>{u.enabled ? "User" : "User (Disabled)"}</td>
                        <td>{u.description}</td>
                      </tr>
                    ))}
                    {groups.map((g) => (
                      <tr
                        key={g.name}
                        className={selectedRow === g.name ? styles.itemListRowSelected : ""}
                        onClick={() => setSelectedRow(g.name)}
                        onDoubleClick={() => setDialog({ kind: "group-properties", name: g.name })}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedRow(g.name);
                          showGroupContextMenu(e, g.name);
                        }}
                      >
                        <td>
                          <span className={styles.itmIcon}>G</span>
                          {g.name}
                        </td>
                        <td>{g.category === "Security" ? `Security Group - ${g.scope}` : `Distribution Group - ${g.scope}`}</td>
                        <td>{g.description}</td>
                      </tr>
                    ))}
                    {computers.map((c) => (
                      <tr
                        key={c.name}
                        className={selectedRow === c.name ? styles.itemListRowSelected : ""}
                        onClick={() => setSelectedRow(c.name)}
                        onDoubleClick={() => setDialog({ kind: "computer-properties", name: c.name })}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedRow(c.name);
                          showComputerContextMenu(e, c.name);
                        }}
                      >
                        <td>
                          <span className={styles.itmIcon}>C</span>
                          {c.name}
                        </td>
                        <td>Computer</td>
                        <td>{c.description}</td>
                      </tr>
                    ))}
                  </ItemListTable>
                </ContentBody>
              );
            })()
          ) : null}
        </>
      }
      dialogs={
        <AducDialogs
          dialog={dialog}
          state={state}
          dispatch={dispatch}
          onClose={() => setDialog(null)}
          onSwitchDialog={setDialog}
        />
      }
    />
  );
}

function AducDialogs({
  dialog,
  state,
  dispatch,
  onClose,
  onSwitchDialog,
}: {
  dialog: Dialog | null;
  state: AddsState;
  dispatch: (action: AddsAction) => void;
  onClose: () => void;
  onSwitchDialog: (d: Dialog | null) => void;
}) {
  if (!dialog) return null;

  if (dialog.kind === "new-user") return <NewUserWizard ou={dialog.ou} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "new-group") return <NewGroupDialog ou={dialog.ou} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "new-computer") return <NewComputerDialog ou={dialog.ou} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "new-ou") return <NewOuDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "reset-password") return <ResetPasswordDialog sam={dialog.sam} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "move-user") return <MoveUserDialog sam={dialog.sam} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "move-computer") return <MoveComputerDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-to-group") return <AddToGroupDialog sam={dialog.sam} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-member") return <AddMemberDialog groupName={dialog.groupName} state={state} dispatch={dispatch} onClose={onClose} onBack={() => onSwitchDialog({ kind: "group-properties", name: dialog.groupName })} />;
  if (dialog.kind === "user-properties") return <UserPropertiesDialog sam={dialog.sam} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "group-properties") return <GroupPropertiesDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} onAddMember={() => onSwitchDialog({ kind: "add-member", groupName: dialog.name })} />;
  if (dialog.kind === "computer-properties") return <ComputerPropertiesDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "find") return <FindDialog state={state} onClose={onClose} />;
  return null;
}

function NewUserWizard({ ou, state, dispatch, onClose }: { ou: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initials, setInitials] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [upnPrefix, setUpnPrefix] = useState("");
  const [sam, setSam] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [cantChange, setCantChange] = useState(false);
  const [neverExpires, setNeverExpires] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  function autoFillFrom(first: string, last: string) {
    if (!autoFilled) {
      const suggested = (first.charAt(0) + last).toLowerCase();
      if (!displayName) setDisplayName(`${first} ${last}`.trim());
      if (!upnPrefix) setUpnPrefix(suggested);
      if (!sam) setSam(suggested);
    }
  }

  const steps = ["1. Identity", "2. Password", "3. Confirm"];

  return (
    <AddsDialog
      title="New Object - User"
      width="560px"
      onClose={onClose}
      buttons={[
        { label: "< Back", onClick: () => { if (step > 1) setStep(step - 1); return false; } },
        ...(step < 3
          ? [
              {
                label: "Next >",
                primary: true,
                onClick: () => {
                  if (step === 1) {
                    if (!firstName && !lastName) { alert("You must specify a first or last name."); return false; }
                    if (!displayName) { alert("Full name is required."); return false; }
                    if (!upnPrefix) { alert("User logon name is required."); return false; }
                    if (!sam) { alert("Pre-Windows 2000 logon name is required."); return false; }
                    if (state.users.some((u) => u.sAMAccountName === sam)) { alert("A user with that name already exists."); return false; }
                  }
                  setStep(step + 1);
                  return false;
                },
              },
            ]
          : [
              {
                label: "Finish",
                primary: true,
                onClick: () => {
                  if (!password) { alert("Password cannot be blank."); return false; }
                  if (password !== confirmPwd) { alert("Passwords do not match."); return false; }
                  if (cantChange && mustChange) { alert('"User cannot change password" and "User must change password at next logon" cannot both be selected.'); return false; }
                  const user: AddsUser = {
                    sAMAccountName: sam,
                    upn: `${upnPrefix}@${state.domain.fqdn}`,
                    name: sam,
                    givenName: firstName,
                    surname: lastName,
                    initials,
                    displayName,
                    email: "",
                    department: "",
                    title: "",
                    manager: "",
                    office: "",
                    phone: "",
                    mobile: "",
                    streetAddress: "",
                    city: "",
                    state: "",
                    zip: "",
                    country: "",
                    description: "",
                    memberOf: ["Domain Users"],
                    enabled: !disabled,
                    locked: false,
                    mustChangePassword: mustChange,
                    cantChangePassword: cantChange,
                    neverExpires,
                    passwordLastSet: new Date().toISOString(),
                    lastLogon: "",
                    created: new Date().toISOString(),
                    ouPath: ou || "Users",
                    logonHours: "All",
                    logonTo: "All computers",
                    profilePath: "",
                    loginScript: "",
                    homeDir: "",
                    homeDrive: "",
                  };
                  if (state.users.some((u) => u.sAMAccountName === sam)) { alert("A user with this sAMAccountName already exists."); return false; }
                  dispatch({ type: "ADD_USER", user });
                  toast.success(`User ${sam} created.`);
                  return true;
                },
              },
            ]),
        { label: "Cancel" },
      ]}
    >
      <div className={styles.wizSteps}>
        {steps.map((s, i) => (
          <span key={s} className={i + 1 === step ? styles.wizStepActive : i + 1 < step ? styles.wizStepDone : styles.wizStep}>
            {s}
          </span>
        ))}
      </div>
      {step === 1 ? (
        <div style={{ padding: 14 }}>
          <p style={{ marginBottom: 8 }}>
            Create in: <b>{state.domain.fqdn}/{ou || "Users"}</b>
          </p>
          <FormRow label="First name">
            <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); autoFillFrom(e.target.value, lastName); }} />
          </FormRow>
          <FormRow label="Initials">
            <input type="text" style={{ maxWidth: 80 }} value={initials} onChange={(e) => setInitials(e.target.value)} />
          </FormRow>
          <FormRow label="Last name">
            <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); autoFillFrom(firstName, e.target.value); }} />
          </FormRow>
          <FormRow label="Full name">
            <input type="text" value={displayName} onChange={(e) => { setDisplayName(e.target.value); setAutoFilled(true); }} />
          </FormRow>
          <FormRow label="User logon name">
            <input type="text" style={{ flex: 1 }} value={upnPrefix} onChange={(e) => setUpnPrefix(e.target.value)} />
            <select style={{ flex: "0 0 200px", marginLeft: 4 }}>
              <option>@{state.domain.fqdn}</option>
            </select>
          </FormRow>
          <FormRow label="User logon name (pre-Windows 2000)">
            <input type="text" value={`${state.domain.netbios}\\`} readOnly style={{ flex: "0 0 80px", background: "#eee" }} />
            <input type="text" style={{ flex: 1 }} value={sam} onChange={(e) => setSam(e.target.value)} />
          </FormRow>
        </div>
      ) : null}
      {step === 2 ? (
        <div style={{ padding: 14 }}>
          <FormRow label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormRow>
          <FormRow label="Confirm password">
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </FormRow>
          <CheckboxRow id="nuMustChange" label="User must change password at next logon" checked={mustChange} onChange={setMustChange} />
          <CheckboxRow id="nuCantChange" label="User cannot change password" checked={cantChange} onChange={setCantChange} />
          <CheckboxRow id="nuNeverExp" label="Password never expires" checked={neverExpires} onChange={setNeverExpires} />
          <CheckboxRow id="nuDisabled" label="Account is disabled" checked={disabled} onChange={setDisabled} />
          <HelpText>Note: in this simulator no actual password hash is stored; this records that the password was set.</HelpText>
        </div>
      ) : null}
      {step === 3 ? (
        <div style={{ padding: 14 }}>
          <p>When you click Finish, the following object will be created:</p>
          <table className={styles.dashTable} style={{ marginTop: 8 }}>
            <tbody>
              <tr><th>Full name</th><td>{displayName}</td></tr>
              <tr><th>User logon name</th><td>{upnPrefix}@{state.domain.fqdn}</td></tr>
              <tr><th>Pre-Windows 2000 name</th><td>{state.domain.netbios}\{sam}</td></tr>
              <tr><th>Container</th><td>{state.domain.fqdn}/{ou || "Users"}</td></tr>
              <tr><th>Must change at next logon</th><td>{mustChange ? "Yes" : "No"}</td></tr>
              <tr><th>Account disabled</th><td>{disabled ? "Yes" : "No"}</td></tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </AddsDialog>
  );
}

function NewGroupDialog({ ou, dispatch, onClose }: { ou: string; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<AddsGroup["scope"]>("Global");
  const [category, setCategory] = useState<AddsGroup["category"]>("Security");

  return (
    <AddsDialog
      title="New Object - Group"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!name.trim()) { alert("Group name is required."); return false; }
            dispatch({ type: "ADD_GROUP", group: { name: name.trim(), scope, category, description: "", members: [], builtin: false, ouPath: ou || "Users" } });
            toast.success(`Group ${name} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Group name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Pre-Windows 2000 name">
        <input type="text" value={name} readOnly style={{ background: "#eee" }} />
      </FormRow>
      <FormSection title="Group scope">
        <div className={styles.checkboxRow}>
          {(["Domain local", "Global", "Universal"] as const).map((s) => (
            <label key={s} style={{ marginRight: 12 }}>
              <input type="radio" checked={scope === s} onChange={() => setScope(s)} /> {s}
            </label>
          ))}
        </div>
      </FormSection>
      <FormSection title="Group type">
        <div className={styles.checkboxRow}>
          {(["Security", "Distribution"] as const).map((c) => (
            <label key={c} style={{ marginRight: 12 }}>
              <input type="radio" checked={category === c} onChange={() => setCategory(c)} /> {c}
            </label>
          ))}
        </div>
      </FormSection>
    </AddsDialog>
  );
}

function NewComputerDialog({ ou, dispatch, onClose }: { ou: string; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <AddsDialog
      title="New Object - Computer"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const upper = name.trim().toUpperCase();
            if (!upper) { alert("Computer name is required."); return false; }
            dispatch({ type: "ADD_COMPUTER", name: upper, description, ouPath: ou || "Computers" });
            toast.success(`Computer ${upper} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Computer name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <HelpText>
        The default group when this computer joins the domain is <b>Domain Computers</b>.
      </HelpText>
    </AddsDialog>
  );
}

function NewOuDialog({ dispatch, onClose }: { dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <AddsDialog
      title="New Object - Organizational Unit"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!name.trim()) { alert("Name is required."); return false; }
            dispatch({ type: "ADD_OU", ou: { name: name.trim(), parent: null, description } });
            toast.success(`OU ${name} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <CheckboxRow id="protect" label="Protect container from accidental deletion" checked onChange={() => {}} />
    </AddsDialog>
  );
}

function ResetPasswordDialog({ sam, dispatch, onClose }: { sam: string; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [unlock, setUnlock] = useState(false);

  return (
    <AddsDialog
      title="Reset Password"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!p1) { alert("Password cannot be blank."); return false; }
            if (p1 !== p2) { alert("Passwords do not match."); return false; }
            dispatch({ type: "RESET_USER_PASSWORD", sam, mustChange, unlock });
            toast.success(`Password reset for ${sam}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Reset password for user: <b>{sam}</b>
      </p>
      <FormRow label="New password">
        <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} />
      </FormRow>
      <FormRow label="Confirm password">
        <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} />
      </FormRow>
      <CheckboxRow id="mustChange" label="User must change password at next logon" checked={mustChange} onChange={setMustChange} />
      <CheckboxRow id="unlock" label="Unlock the user's account" checked={unlock} onChange={setUnlock} />
    </AddsDialog>
  );
}

function MoveUserDialog({ sam, state, dispatch, onClose }: { sam: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const all = ["Users", "Computers", ...state.ous.map((o) => o.name)];

  return (
    <AddsDialog
      title="Move"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!selected[0]) { alert("Select a destination."); return false; }
            dispatch({ type: "MOVE_USER", sam, newOu: selected[0] });
            toast.success(`Moved ${sam}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Move <b>{sam}</b> to:
      </p>
      <ListBox items={all.map((n) => ({ key: n, label: `${state.domain.fqdn}/${n}` }))} selected={selected} onSelect={setSelected} />
    </AddsDialog>
  );
}

function MoveComputerDialog({ name, state, dispatch, onClose }: { name: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const all = ["Computers", "Domain Controllers", ...state.ous.map((o) => o.name)];

  return (
    <AddsDialog
      title="Move"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!selected[0]) { alert("Select a destination."); return false; }
            dispatch({ type: "MOVE_COMPUTER", name, newOu: selected[0] });
            toast.success(`Moved ${name}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Move <b>{name}</b> to:
      </p>
      <ListBox items={all.map((n) => ({ key: n, label: `${state.domain.fqdn}/${n}` }))} selected={selected} onSelect={setSelected} />
    </AddsDialog>
  );
}

function AddToGroupDialog({ sam, state, dispatch, onClose }: { sam: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <AddsDialog
      title="Select Groups"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!selected.length) { alert("Select at least one group."); return false; }
            selected.forEach((groupName) => dispatch({ type: "ADD_GROUP_MEMBER", groupName, sam }));
            toast.success(`Added to ${selected.length} group(s)`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Add <b>{sam}</b> to groups (Ctrl+click for multiple):
      </p>
      <ListBox items={state.groups.map((g) => ({ key: g.name, label: g.name }))} selected={selected} onSelect={setSelected} multi height={220} />
    </AddsDialog>
  );
}

function AddMemberDialog({ groupName, state, dispatch, onClose, onBack }: { groupName: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void; onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");

  return (
    <AddsDialog
      title="Select Users, Contacts, Computers, Service Accounts, or Groups"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            const extra = text.split(";").map((s) => s.trim()).filter(Boolean);
            const all = Array.from(new Set([...selected, ...extra]));
            if (!all.length) { alert("No members selected."); return false; }
            all.forEach((sam) => dispatch({ type: "ADD_GROUP_MEMBER", groupName, sam }));
            toast.success(`Added ${all.length} member(s)`);
            onBack();
            return false;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Enter the object names">
        <input type="text" placeholder="Type names; semicolon separated" value={text} onChange={(e) => setText(e.target.value)} />
      </FormRow>
      <HelpText>Or pick from list:</HelpText>
      <ListBox items={state.users.map((u) => ({ key: u.sAMAccountName, label: u.sAMAccountName }))} selected={selected} onSelect={setSelected} multi height={200} />
    </AddsDialog>
  );
}

function UserPropertiesDialog({ sam, state, dispatch, onClose }: { sam: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const u = state.users.find((x) => x.sAMAccountName === sam);
  const [activeTab, setActiveTab] = useState("General");
  const [patch, setPatch] = useState<Partial<AddsUser>>({});
  if (!u) return null;
  const merged = { ...u, ...patch };

  function set<K extends keyof AddsUser>(key: K, value: AddsUser[K]) {
    setPatch((p) => ({ ...p, [key]: value }));
  }

  const tabs = ["General", "Address", "Account", "Profile", "Telephones", "Organization", "Member Of", "Dial-in", "Sessions", "Remote control"];

  function commit() {
    dispatch({ type: "UPDATE_USER", sam, patch });
  }

  return (
    <AddsDialog
      title={`${u.displayName} Properties`}
      width="560px"
      onClose={onClose}
      buttons={[
        { label: "OK", primary: true, onClick: () => { commit(); toast.success(`Saved ${sam}`); return true; } },
        { label: "Cancel" },
        { label: "Apply", onClick: () => { commit(); toast.success("Applied changes"); return false; } },
      ]}
    >
      <TabbedPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderTab={(tab) => {
          if (tab === "General")
            return (
              <>
                <FormRow label="First name"><input type="text" value={merged.givenName} onChange={(e) => set("givenName", e.target.value)} /></FormRow>
                <FormRow label="Initials"><input type="text" style={{ maxWidth: 80 }} value={merged.initials} onChange={(e) => set("initials", e.target.value)} /></FormRow>
                <FormRow label="Last name"><input type="text" value={merged.surname} onChange={(e) => set("surname", e.target.value)} /></FormRow>
                <FormRow label="Display name"><input type="text" value={merged.displayName} onChange={(e) => set("displayName", e.target.value)} /></FormRow>
                <FormRow label="Description"><input type="text" value={merged.description} onChange={(e) => set("description", e.target.value)} /></FormRow>
                <FormRow label="Office"><input type="text" value={merged.office} onChange={(e) => set("office", e.target.value)} /></FormRow>
                <FormRow label="Telephone"><input type="text" value={merged.phone} onChange={(e) => set("phone", e.target.value)} /></FormRow>
                <FormRow label="E-mail"><input type="email" value={merged.email} onChange={(e) => set("email", e.target.value)} /></FormRow>
              </>
            );
          if (tab === "Address")
            return (
              <>
                <FormRow label="Street"><input type="text" value={merged.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} /></FormRow>
                <FormRow label="City"><input type="text" value={merged.city} onChange={(e) => set("city", e.target.value)} /></FormRow>
                <FormRow label="State/province"><input type="text" value={merged.state} onChange={(e) => set("state", e.target.value)} /></FormRow>
                <FormRow label="Zip/Postal code"><input type="text" value={merged.zip} onChange={(e) => set("zip", e.target.value)} /></FormRow>
                <FormRow label="Country/region"><input type="text" value={merged.country} onChange={(e) => set("country", e.target.value)} /></FormRow>
              </>
            );
          if (tab === "Account")
            return (
              <>
                <FormRow label="User logon name">
                  <input type="text" style={{ flex: 1 }} value={merged.upn.split("@")[0]} onChange={(e) => set("upn", `${e.target.value}@${state.domain.fqdn}`)} />
                  <input type="text" readOnly value={`@${state.domain.fqdn}`} style={{ flex: "0 0 200px", marginLeft: 4, background: "#eee" }} />
                </FormRow>
                <FormRow label="Pre-Windows 2000 name">
                  <input type="text" readOnly value={`${state.domain.netbios}\\`} style={{ flex: "0 0 80px", background: "#eee" }} />
                  <input type="text" readOnly value={merged.sAMAccountName} style={{ flex: 1 }} />
                </FormRow>
                <FormSection title="Account options">
                  <CheckboxRow id="up_mustChange" label="User must change password at next logon" checked={merged.mustChangePassword} onChange={(v) => set("mustChangePassword", v)} />
                  <CheckboxRow id="up_cantChange" label="User cannot change password" checked={merged.cantChangePassword} onChange={(v) => set("cantChangePassword", v)} />
                  <CheckboxRow id="up_neverExp" label="Password never expires" checked={merged.neverExpires} onChange={(v) => set("neverExpires", v)} />
                  <CheckboxRow id="up_disabled" label="Account is disabled" checked={!merged.enabled} onChange={(v) => set("enabled", !v)} />
                </FormSection>
                <HelpText>
                  Password last set: {merged.passwordLastSet || "-"}
                  <br />
                  Last logon: {merged.lastLogon || "-"}
                </HelpText>
              </>
            );
          if (tab === "Profile")
            return (
              <>
                <FormRow label="Profile path"><input type="text" value={merged.profilePath} onChange={(e) => set("profilePath", e.target.value)} /></FormRow>
                <FormRow label="Logon script"><input type="text" value={merged.loginScript} onChange={(e) => set("loginScript", e.target.value)} /></FormRow>
                <FormSection title="Home folder">
                  <FormRow label="Local path"><input type="text" value={merged.homeDir} onChange={(e) => set("homeDir", e.target.value)} /></FormRow>
                </FormSection>
              </>
            );
          if (tab === "Telephones")
            return (
              <FormRow label="Mobile">
                <input type="text" value={merged.mobile} onChange={(e) => set("mobile", e.target.value)} />
              </FormRow>
            );
          if (tab === "Organization")
            return (
              <>
                <FormRow label="Title"><input type="text" value={merged.title} onChange={(e) => set("title", e.target.value)} /></FormRow>
                <FormRow label="Department"><input type="text" value={merged.department} onChange={(e) => set("department", e.target.value)} /></FormRow>
                <FormRow label="Manager"><input type="text" value={merged.manager} onChange={(e) => set("manager", e.target.value)} /></FormRow>
              </>
            );
          if (tab === "Member Of")
            return (
              <ItemListTable columns={["Name", "Active Directory Domain Services Folder"]}>
                {merged.memberOf.map((m) => {
                  const g = state.groups.find((x) => x.name === m);
                  return (
                    <tr key={m}>
                      <td>{m}</td>
                      <td>{g ? `${state.domain.fqdn}/${g.ouPath}` : "-"}</td>
                    </tr>
                  );
                })}
              </ItemListTable>
            );
          return <EmptyPane>Not configured in this lab.</EmptyPane>;
        }}
      />
    </AddsDialog>
  );
}

function GroupPropertiesDialog({
  name,
  state,
  dispatch,
  onClose,
  onAddMember,
}: {
  name: string;
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onClose: () => void;
  onAddMember: () => void;
}) {
  const g = state.groups.find((x) => x.name === name);
  const [activeTab, setActiveTab] = useState("General");
  const [description, setDescription] = useState(g?.description ?? "");
  const [scope, setScope] = useState<AddsGroup["scope"]>(g?.scope ?? "Global");
  const [category, setCategory] = useState<AddsGroup["category"]>(g?.category ?? "Security");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  if (!g) return null;

  const tabs = ["General", "Members", "Member Of", "Managed By"];

  return (
    <AddsDialog
      title={`${g.name} Properties`}
      width="540px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "UPDATE_GROUP", name, patch: { description, scope, category } });
            toast.success("Group updated");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <TabbedPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderTab={(tab) => {
          if (tab === "General")
            return (
              <>
                <FormRow label="Group name (pre-Windows 2000)"><input type="text" value={g.name} readOnly style={{ background: "#eee" }} /></FormRow>
                <FormRow label="Description"><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} /></FormRow>
                <FormSection title="Group scope">
                  {(["Domain local", "Global", "Universal"] as const).map((s) => (
                    <label key={s} style={{ marginRight: 12 }}>
                      <input type="radio" checked={scope === s} onChange={() => setScope(s)} /> {s}
                    </label>
                  ))}
                </FormSection>
                <FormSection title="Group type">
                  {(["Security", "Distribution"] as const).map((c) => (
                    <label key={c} style={{ marginRight: 12 }}>
                      <input type="radio" checked={category === c} onChange={() => setCategory(c)} /> {c}
                    </label>
                  ))}
                </FormSection>
              </>
            );
          if (tab === "Members")
            return (
              <>
                <ItemListTable columns={["Name", "Active Directory Domain Services Folder"]}>
                  {g.members.length ? (
                    g.members.map((m) => {
                      const u = state.users.find((x) => x.sAMAccountName === m);
                      return (
                        <tr key={m} className={selectedMember === m ? styles.itemListRowSelected : ""} onClick={() => setSelectedMember(m)}>
                          <td>{u ? u.displayName : m}</td>
                          <td>{u ? `${state.domain.fqdn}/${u.ouPath}` : "-"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                        (no members)
                      </td>
                    </tr>
                  )}
                </ItemListTable>
                <div style={{ marginTop: 8 }}>
                  <button type="button" className={styles.btn} onClick={onAddMember}>
                    Add...
                  </button>{" "}
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      if (!selectedMember) { alert("Select a member first."); return; }
                      dispatch({ type: "REMOVE_GROUP_MEMBER", groupName: name, sam: selectedMember });
                      setSelectedMember(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </>
            );
          if (tab === "Member Of") return <EmptyPane>This group is not a member of any other groups in this lab.</EmptyPane>;
          return (
            <>
              <FormRow label="Name">
                <input type="text" />
              </FormRow>
              <CheckboxRow id="mbmu" label="Manager can update membership list" checked={false} onChange={() => {}} />
            </>
          );
        }}
      />
    </AddsDialog>
  );
}

function ComputerPropertiesDialog({ name, state, dispatch, onClose }: { name: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const c = state.computers.find((x) => x.name === name);
  const [description, setDescription] = useState(c?.description ?? "");
  if (!c) return null;

  return (
    <AddsDialog
      title={`${c.name} Properties`}
      width="480px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "UPDATE_COMPUTER", name, patch: { description } });
            toast.success(`Saved ${c.name}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Computer name"><input type="text" value={c.name} readOnly style={{ background: "#eee" }} /></FormRow>
      <FormRow label="DNS name"><input type="text" value={c.dnsName} readOnly style={{ background: "#eee" }} /></FormRow>
      <FormRow label="Description"><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} /></FormRow>
      <FormSection title="Operating System">
        <FormRow label="Name"><input type="text" value={c.os} readOnly style={{ background: "#eee" }} /></FormRow>
        <FormRow label="Version"><input type="text" value={c.osVersion} readOnly style={{ background: "#eee" }} /></FormRow>
      </FormSection>
      <HelpText>Last logon: {c.lastLogon || "-"}</HelpText>
    </AddsDialog>
  );
}

function FindDialog({ state, onClose }: { state: AddsState; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ kind: string; name: string; ouPath: string; description: string }[]>([]);

  function search() {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([]);
      return;
    }
    const out: { kind: string; name: string; ouPath: string; description: string }[] = [];
    state.users.forEach((u) => {
      if (u.displayName.toLowerCase().includes(q) || u.sAMAccountName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) {
        out.push({ kind: "User", name: u.displayName || u.sAMAccountName, ouPath: u.ouPath, description: u.description });
      }
    });
    state.groups.forEach((g) => {
      if (g.name.toLowerCase().includes(q)) out.push({ kind: "Group", name: g.name, ouPath: g.ouPath, description: g.description });
    });
    state.computers.forEach((c) => {
      if (c.name.toLowerCase().includes(q)) out.push({ kind: "Computer", name: c.name, ouPath: c.ouPath, description: c.description });
    });
    setResults(out);
  }

  return (
    <AddsDialog title="Find Users, Contacts, and Groups" width="600px" onClose={onClose} buttons={[{ label: "Close" }]}>
      <FormRow label="In">
        <input type="text" value={state.domain.fqdn} readOnly style={{ background: "#eee" }} />
      </FormRow>
      <FormRow label="Name">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
      </FormRow>
      <div style={{ textAlign: "right", marginBottom: 8 }}>
        <button type="button" className={styles.btn} onClick={search}>
          Find Now
        </button>{" "}
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            setQuery("");
            setResults([]);
          }}
        >
          Clear
        </button>
      </div>
      <ItemListTable columns={["Name", "Type", "Description", "In folder"]}>
        {results.length ? (
          results.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{r.kind}</td>
              <td>{r.description}</td>
              <td>{state.domain.fqdn}/{r.ouPath}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} style={{ textAlign: "center", color: "#888", padding: 12 }}>
              0 items found.
            </td>
          </tr>
        )}
      </ItemListTable>
    </AddsDialog>
  );
}
