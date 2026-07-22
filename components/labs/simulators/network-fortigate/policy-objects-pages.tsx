"use client";

// Policy & Objects pages for the FortiGate WebUI simulator: Firewall Policy
// (the flagship page — the central FortiGate concept, top-to-bottom
// order-sensitive rule evaluation) plus the five supporting object types a
// policy references: Addresses (+ Address Groups), Services (+ Service
// Groups), Schedules, Virtual IPs (VIPs / DNAT), and IP Pools.
//
// Ported from itbd-lab/simulators/network/js/fortigate-ui.js:
//   PAGES['ipv4-policy'] (894-930) + securityProfileIcons() (932-946) +
//     policyModal() (948-1069)
//   PAGES['addresses'] (1074-1100) + addrModal() (1102-1148)
//   PAGES['addr-groups'] (1153-1160)
//   PAGES['services'] (1162-1178)
//   PAGES['svc-groups'] (1180-1186)
//   PAGES['schedules'] (1188-1194)
//   PAGES['vips'] (1196-1210)
//   PAGES['ip-pools'] (1212-1218)
//
// Source's Address Groups / Services / Service Groups / Schedules / VIPs /
// IP Pools pages (`toolbar('Create New', null)`) render a "+ Create New"
// button with NO wired handler at all — clicking it does nothing. Source's
// own row markup for those six object types also has no Edit/Delete actions
// (only the flagship Firewall Policy and Addresses pages got real
// row-actions + a modal in source). Every object type below gets full,
// genuinely-wired CRUD (Create/Edit/Delete) against the reducer's real
// ADD_*/UPDATE_*/DELETE_* actions — an intentional improvement over source's
// half-wired object pages, matching the brief's requirement that every page
// here have full CRUD. No native prompt()/alert()/confirm() anywhere — all
// confirmations go through `toast` (sonner), matching house convention.
//
// Firewall Policies table renders `state.policies` in raw array order with
// no client-side sort — FortiGate policies are evaluated top-to-bottom, so
// the DataTable's row order IS the real evaluation order, and the only way
// to change it is the REORDER_POLICY action via the up/down row buttons.

import { useState } from "react";
import { toast } from "sonner";

import type {
  FortiAddress,
  FortiAddressGroup,
  FortiGateState,
  FortiIpPool,
  FortiPolicy,
  FortiSchedule,
  FortiService,
  FortiServiceGroup,
  FortiVip,
} from "@/lib/labs/simulators/network-fortigate/types";
import type { FortiAction } from "@/lib/labs/simulators/network-fortigate/reducer";
import {
  Checkbox,
  DataTable,
  type DataTableColumn,
  Field,
  Flyout,
  Modal,
  NativeSelect,
  StatusPill,
  TabBar,
  Toggle,
} from "./fortigate-ui";
import styles from "./fortigate-console.module.css";

type Dispatch = React.Dispatch<FortiAction>;
type PageProps = { state: FortiGateState; dispatch: Dispatch };

// ===================================================================
// Shared helpers
// ===================================================================

// Security-profile compact indicator row — ported visual idea from source's
// securityProfileIcons() (fortigate-ui.js:932-946): one small badge per
// profile slot, lit up (`spOn`) when a profile name is assigned.
const SP_ICONS: { key: keyof Pick<FortiPolicy, "av" | "web" | "dns" | "app" | "ips" | "file" | "ssl">; label: string }[] = [
  { key: "av", label: "AV" },
  { key: "web", label: "WF" },
  { key: "dns", label: "DN" },
  { key: "app", label: "AC" },
  { key: "ips", label: "IP" },
  { key: "file", label: "FF" },
  { key: "ssl", label: "SS" },
];

function SecurityProfileIcons({ policy }: { policy: FortiPolicy }) {
  return (
    <div className={styles.spIcons}>
      {SP_ICONS.map((icon) => {
        const value = policy[icon.key];
        const on = Boolean(value);
        return (
          <span
            key={icon.key}
            className={`${styles.sp} ${on ? styles.spOn : ""}`}
            title={on ? `${icon.label} = ${value}` : `${icon.label} (off)`}
          >
            {icon.label}
          </span>
        );
      })}
    </div>
  );
}

function ConfirmDeleteModal({
  title,
  itemLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  itemLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Delete
          </button>
        </>
      }
    >
      <p>
        Are you sure you want to delete <b>{itemLabel}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

// ===================================================================
// 1. Firewall Policies — THE FLAGSHIP PAGE
// ===================================================================

const IFACE_EXTRA = ["VPN-to-HQ", "VPN-to-Branch", "ssl.root"];

type PolicyFormState = {
  name: string;
  from: string;
  to: string;
  src: string;
  dst: string;
  schedule: string;
  service: string;
  action: "accept" | "deny";
  nat: boolean;
  inspection: "flow" | "proxy";
  logTraffic: "all" | "utm";
  logViolation: boolean;
  av: string;
  web: string;
  dns: string;
  app: string;
  ips: string;
  file: string;
  ssl: string;
  status: string;
  comments: string;
};

function blankPolicyForm(): PolicyFormState {
  return {
    name: "",
    from: "port2",
    to: "port1",
    src: "all",
    dst: "all",
    schedule: "always",
    service: "ALL",
    action: "accept",
    nat: true,
    inspection: "flow",
    logTraffic: "all",
    logViolation: true,
    av: "",
    web: "",
    dns: "",
    app: "",
    ips: "",
    file: "",
    ssl: "",
    status: "enable",
    comments: "",
  };
}

function policyToForm(p: FortiPolicy): PolicyFormState {
  return {
    name: p.name,
    from: p.from,
    to: p.to,
    src: p.src,
    dst: p.dst,
    schedule: p.schedule,
    service: p.service,
    action: p.action,
    nat: p.nat,
    inspection: p.inspection,
    logTraffic: p.logTraffic,
    logViolation: Boolean(p.logViolation),
    av: p.av,
    web: p.web,
    dns: p.dns,
    app: p.app,
    ips: p.ips,
    file: p.file,
    ssl: p.ssl,
    status: p.status,
    comments: p.comments,
  };
}

function PolicyFormFields({
  form,
  setForm,
  state,
}: {
  form: PolicyFormState;
  setForm: (updater: (prev: PolicyFormState) => PolicyFormState) => void;
  state: FortiGateState;
}) {
  const ifOpts = ["any", ...state.interfaces.map((i) => i.name), ...IFACE_EXTRA].map((n) => ({ value: n, label: n }));
  const addrOpts = [
    ...state.addresses.map((a) => a.name),
    ...state.addressGroups.map((g) => g.name),
    ...state.vips.map((v) => v.name),
  ].map((n) => ({ value: n, label: n }));
  const svcOpts = [...state.services.map((s) => s.name), ...state.serviceGroups.map((g) => g.name)].map((n) => ({
    value: n,
    label: n,
  }));
  const schOpts = state.schedules.map((s) => ({ value: s.name, label: s.name }));

  const spOpts = (list: { name: string }[]) => [
    { value: "", label: "no-profile" },
    ...list.map((x) => ({ value: x.name, label: x.name })),
  ];

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Policy</legend>
        <Field label="Name" required>
          <input
            className={styles.input}
            type="text"
            value={form.name}
            placeholder="e.g. Allow-Internal-Internet"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </Field>
        <Field label="Incoming interface" required>
          <NativeSelect value={form.from} onChange={(v) => setForm((prev) => ({ ...prev, from: v }))} options={ifOpts} />
        </Field>
        <Field label="Outgoing interface" required>
          <NativeSelect value={form.to} onChange={(v) => setForm((prev) => ({ ...prev, to: v }))} options={ifOpts} />
        </Field>
        <Field label="Source" required>
          <NativeSelect value={form.src} onChange={(v) => setForm((prev) => ({ ...prev, src: v }))} options={addrOpts} />
        </Field>
        <Field label="Destination" required>
          <NativeSelect value={form.dst} onChange={(v) => setForm((prev) => ({ ...prev, dst: v }))} options={addrOpts} />
        </Field>
        <Field label="Schedule">
          <NativeSelect value={form.schedule} onChange={(v) => setForm((prev) => ({ ...prev, schedule: v }))} options={schOpts} />
        </Field>
        <Field label="Service">
          <NativeSelect value={form.service} onChange={(v) => setForm((prev) => ({ ...prev, service: v }))} options={svcOpts} />
        </Field>
        <Field label="Action">
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="po_action"
                checked={form.action === "accept"}
                onChange={() => setForm((prev) => ({ ...prev, action: "accept" }))}
              />
              ACCEPT
            </label>
            <label>
              <input
                type="radio"
                name="po_action"
                checked={form.action === "deny"}
                onChange={() => setForm((prev) => ({ ...prev, action: "deny" }))}
              />
              DENY
            </label>
          </div>
        </Field>
        <Field label="Inspection Mode">
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="po_insp"
                checked={form.inspection === "flow"}
                onChange={() => setForm((prev) => ({ ...prev, inspection: "flow" }))}
              />
              Flow-based
            </label>
            <label>
              <input
                type="radio"
                name="po_insp"
                checked={form.inspection === "proxy"}
                onChange={() => setForm((prev) => ({ ...prev, inspection: "proxy" }))}
              />
              Proxy-based
            </label>
          </div>
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Firewall / Network Options</legend>
        <Field label="NAT">
          <Toggle checked={form.nat} onChange={(v) => setForm((prev) => ({ ...prev, nat: v }))} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Security Profiles</legend>
        <Field label="AntiVirus">
          <NativeSelect value={form.av} onChange={(v) => setForm((prev) => ({ ...prev, av: v }))} options={spOpts(state.avProfiles)} />
        </Field>
        <Field label="Web Filter">
          <NativeSelect value={form.web} onChange={(v) => setForm((prev) => ({ ...prev, web: v }))} options={spOpts(state.webFilterProfiles)} />
        </Field>
        <Field label="DNS Filter">
          <NativeSelect value={form.dns} onChange={(v) => setForm((prev) => ({ ...prev, dns: v }))} options={spOpts(state.dnsFilterProfiles)} />
        </Field>
        <Field label="Application Control">
          <NativeSelect value={form.app} onChange={(v) => setForm((prev) => ({ ...prev, app: v }))} options={spOpts(state.appControlProfiles)} />
        </Field>
        <Field label="File Filter">
          <NativeSelect value={form.file} onChange={(v) => setForm((prev) => ({ ...prev, file: v }))} options={spOpts(state.fileFilterProfiles)} />
        </Field>
        <Field label="IPS">
          <NativeSelect value={form.ips} onChange={(v) => setForm((prev) => ({ ...prev, ips: v }))} options={spOpts(state.ipsProfiles)} />
        </Field>
        <Field label="SSL Inspection">
          <NativeSelect value={form.ssl} onChange={(v) => setForm((prev) => ({ ...prev, ssl: v }))} options={spOpts(state.sslProfiles)} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Logging Options</legend>
        <Field label="Log Allowed Traffic">
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="po_log"
                checked={form.logTraffic === "utm"}
                onChange={() => setForm((prev) => ({ ...prev, logTraffic: "utm" }))}
              />
              Security Events
            </label>
            <label>
              <input
                type="radio"
                name="po_log"
                checked={form.logTraffic === "all"}
                onChange={() => setForm((prev) => ({ ...prev, logTraffic: "all" }))}
              />
              All Sessions
            </label>
          </div>
        </Field>
        <Field label="Log Violation Traffic">
          <Toggle checked={form.logViolation} onChange={(v) => setForm((prev) => ({ ...prev, logViolation: v }))} />
        </Field>
        <Field label="Comments">
          <textarea
            className={styles.textarea}
            value={form.comments}
            onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value }))}
          />
        </Field>
        <Field label="Enable this policy">
          <Toggle checked={form.status !== "disable"} onChange={(v) => setForm((prev) => ({ ...prev, status: v ? "enable" : "disable" }))} />
        </Field>
      </fieldset>
    </>
  );
}

function NewPolicyModal({ state, dispatch, onClose }: { state: FortiGateState; dispatch: Dispatch; onClose: () => void }) {
  const [form, setForm] = useState<PolicyFormState>(blankPolicyForm);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const policy: Omit<FortiPolicy, "id"> = {
      name,
      from: form.from,
      to: form.to,
      src: form.src,
      dst: form.dst,
      schedule: form.schedule,
      service: form.service,
      action: form.action,
      nat: form.nat,
      inspection: form.inspection,
      logTraffic: form.logTraffic,
      logViolation: form.logViolation,
      av: form.av,
      web: form.web,
      dns: form.dns,
      app: form.app,
      ips: form.ips,
      file: form.file,
      ssl: form.ssl,
      bytes: "0 B",
      sessions: 0,
      status: form.status,
      comments: form.comments.trim(),
    };
    dispatch({ type: "ADD_POLICY", policy });
    toast.success("Policy created");
    onClose();
  }

  return (
    <Modal
      title="New Policy"
      onClose={onClose}
      width="880px"
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <PolicyFormFields form={form} setForm={setForm} state={state} />
    </Modal>
  );
}

function PolicyDetailFlyout({
  policy,
  state,
  dispatch,
  onClose,
}: {
  policy: FortiPolicy;
  state: FortiGateState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PolicyFormState>(() => policyToForm(policy));

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({
      type: "UPDATE_POLICY",
      id: policy.id,
      patch: {
        name,
        from: form.from,
        to: form.to,
        src: form.src,
        dst: form.dst,
        schedule: form.schedule,
        service: form.service,
        action: form.action,
        nat: form.nat,
        inspection: form.inspection,
        logTraffic: form.logTraffic,
        logViolation: form.logViolation,
        av: form.av,
        web: form.web,
        dns: form.dns,
        app: form.app,
        ips: form.ips,
        file: form.file,
        ssl: form.ssl,
        status: form.status,
        comments: form.comments.trim(),
      },
    });
    toast.success("Policy saved");
    onClose();
  }

  return (
    <Flyout
      title={`Edit Policy — ${policy.name} (ID ${policy.id})`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <PolicyFormFields form={form} setForm={setForm} state={state} />
    </Flyout>
  );
}

export function FirewallPoliciesPage({ state, dispatch }: PageProps) {
  const [selected, setSelected] = useState<FortiPolicy | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FortiPolicy | null>(null);

  const columns: DataTableColumn<FortiPolicy>[] = [
    { key: "id", header: "ID", render: (p) => p.id, width: "44px" },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <>
          <b>{p.name}</b>
          {p.comments ? <div className={styles.small}>{p.comments}</div> : null}
        </>
      ),
    },
    {
      key: "fromTo",
      header: "From → To",
      render: (p) => (
        <span className={styles.mono}>
          {p.from} → {p.to}
        </span>
      ),
    },
    { key: "src", header: "Source", render: (p) => p.src },
    { key: "dst", header: "Destination", render: (p) => p.dst },
    { key: "service", header: "Service", render: (p) => p.service },
    {
      key: "action",
      header: "Action",
      render: (p) => <StatusPill tone={p.action === "accept" ? "up" : "down"}>{p.action.toUpperCase()}</StatusPill>,
    },
    {
      key: "nat",
      header: "NAT",
      render: (p) => (p.nat ? <StatusPill tone="up">enabled</StatusPill> : <StatusPill tone="muted">disabled</StatusPill>),
    },
    { key: "profiles", header: "Security Profiles", render: (p) => <SecurityProfileIcons policy={p} /> },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Toggle checked={p.status !== "disable"} onChange={() => dispatch({ type: "TOGGLE_POLICY_STATUS", id: p.id })} />
        </span>
      ),
    },
    { key: "sessions", header: "Sessions", render: (p) => p.sessions.toLocaleString() },
    { key: "bytes", header: "Bytes", render: (p) => p.bytes },
    {
      key: "reorder",
      header: "Order",
      render: (p) => {
        const idx = state.policies.findIndex((x) => x.id === p.id);
        const isFirst = idx <= 0;
        const isLast = idx === state.policies.length - 1;
        return (
          <div className={styles.rowActions} style={{ visibility: "visible" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              disabled={isFirst}
              title="Move up"
              onClick={() => dispatch({ type: "REORDER_POLICY", id: p.id, direction: "up" })}
            >
              &#9650;
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              disabled={isLast}
              title="Move down"
              onClick={() => dispatch({ type: "REORDER_POLICY", id: p.id, direction: "down" })}
            >
              &#9660;
            </button>
          </div>
        );
      },
    },
    {
      key: "rowActions",
      header: "",
      render: (p) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={() => setPendingDelete(p)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>IPv4 Policy</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew(true)}>
          + Create new policy
        </button>
        <div className={styles.small}>
          {state.policies.length} polic{state.policies.length === 1 ? "y" : "ies"} &mdash; row order is the real
          top-to-bottom evaluation order.
        </div>
      </div>

      {/* No client-side sort: rows render in state.policies array order, which
          IS FortiGate's real top-to-bottom evaluation order. REORDER_POLICY
          (the up/down buttons above) is the only supported way to change it. */}
      <DataTable
        columns={columns}
        rows={state.policies}
        getRowKey={(p) => String(p.id)}
        onRowClick={(p) => setSelected(p)}
        emptyMessage="No firewall policies configured."
      />

      {showNew ? <NewPolicyModal state={state} dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}

      {selected ? (
        <PolicyDetailFlyout
          policy={selected}
          state={state}
          dispatch={dispatch}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete Policy"
          itemLabel={`${pendingDelete.name} (ID ${pendingDelete.id})`}
          onConfirm={() => {
            dispatch({ type: "DELETE_POLICY", id: pendingDelete.id });
            toast.success("Policy deleted");
            if (selected?.id === pendingDelete.id) setSelected(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 2. Addresses (+ Address Groups)
// ===================================================================

const ADDRESS_TYPE_OPTIONS = [
  { value: "subnet", label: "Subnet" },
  { value: "fqdn", label: "FQDN" },
];

function AddressFormModal({
  state,
  dispatch,
  editing,
  onClose,
}: {
  state: FortiGateState;
  dispatch: Dispatch;
  editing: FortiAddress | null;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiAddress>(
    () => editing ?? { name: "", type: "subnet", value: "", iface: "any", color: 0, comment: "" },
  );

  const ifOpts = ["any", ...state.interfaces.map((i) => i.name)].map((n) => ({ value: n, label: n }));

  function handleSave() {
    const name = form.name.trim();
    const value = form.value.trim();
    if (!name || !value) {
      toast.error("Name and value are required");
      return;
    }
    const address: FortiAddress = { ...form, name, value };
    if (isNew) {
      dispatch({ type: "ADD_ADDRESS", address });
      toast.success("Address created");
    } else {
      dispatch({ type: "UPDATE_ADDRESS", name: editing.name, patch: address });
      toast.success("Address updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Address" : `Edit Address — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Type" required>
        <NativeSelect
          value={form.type}
          onChange={(v) => setForm((p) => ({ ...p, type: v as FortiAddress["type"] }))}
          options={ADDRESS_TYPE_OPTIONS}
        />
      </Field>
      <Field label="Subnet / FQDN" required help="e.g. 10.1.0.0/24 or *.office.com">
        <input className={styles.input} type="text" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} />
      </Field>
      <Field label="Interface">
        <NativeSelect value={form.iface} onChange={(v) => setForm((p) => ({ ...p, iface: v }))} options={ifOpts} />
      </Field>
      <Field label="Comments">
        <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
      </Field>
    </Modal>
  );
}

function AddressGroupFormModal({
  editing,
  dispatch,
  onClose,
}: {
  editing: FortiAddressGroup | null;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiAddressGroup>(() => editing ?? { name: "", members: "", comment: "" });

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const group: FortiAddressGroup = { ...form, name };
    if (isNew) {
      dispatch({ type: "ADD_ADDRESS_GROUP", group });
      toast.success("Address group created");
    } else {
      dispatch({ type: "UPDATE_ADDRESS_GROUP", name: editing.name, patch: group });
      toast.success("Address group updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Address Group" : `Edit Address Group — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Members" help="Comma-separated address/group names">
        <input className={styles.input} type="text" value={form.members} onChange={(e) => setForm((p) => ({ ...p, members: e.target.value }))} />
      </Field>
      <Field label="Comments">
        <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function AddressesPage({ state, dispatch }: PageProps) {
  const [tab, setTab] = useState<"addresses" | "groups">("addresses");
  const [editingAddress, setEditingAddress] = useState<FortiAddress | null | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<FortiAddressGroup | null | undefined>(undefined);
  const [pendingDeleteAddr, setPendingDeleteAddr] = useState<FortiAddress | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<FortiAddressGroup | null>(null);

  const addressColumns: DataTableColumn<FortiAddress>[] = [
    {
      key: "name",
      header: "Name",
      render: (a) => (
        <>
          <span className={`${styles.colorDot} ${styles[`cdot${a.color}` as keyof typeof styles] ?? ""}`} />
          <b>{a.name}</b>
        </>
      ),
    },
    { key: "type", header: "Type", render: (a) => a.type },
    { key: "value", header: "Details", render: (a) => <span className={styles.mono}>{a.value}</span> },
    { key: "iface", header: "Interface", render: (a) => a.iface },
    { key: "comment", header: "Comments", render: (a) => a.comment },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditingAddress(a)}>
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={() => setPendingDeleteAddr(a)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const groupColumns: DataTableColumn<FortiAddressGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "members", header: "Members", render: (g) => g.members },
    { key: "comment", header: "Comments", render: (g) => g.comment },
    {
      key: "actions",
      header: "",
      render: (g) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditingGroup(g)}>
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={() => setPendingDeleteGroup(g)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Addresses</h2>
      <TabBar
        tabs={[
          { key: "addresses", label: "Addresses" },
          { key: "groups", label: "Address Groups" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === "addresses" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditingAddress(null)}>
              + Add address
            </button>
          </div>
          <DataTable columns={addressColumns} rows={state.addresses} getRowKey={(a) => a.name} emptyMessage="No addresses configured." />
        </>
      ) : (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditingGroup(null)}>
              + Add address group
            </button>
          </div>
          <DataTable columns={groupColumns} rows={state.addressGroups} getRowKey={(g) => g.name} emptyMessage="No address groups configured." />
        </>
      )}

      {editingAddress !== undefined ? (
        <AddressFormModal state={state} dispatch={dispatch} editing={editingAddress} onClose={() => setEditingAddress(undefined)} />
      ) : null}
      {editingGroup !== undefined ? (
        <AddressGroupFormModal dispatch={dispatch} editing={editingGroup} onClose={() => setEditingGroup(undefined)} />
      ) : null}

      {pendingDeleteAddr ? (
        <ConfirmDeleteModal
          title="Delete Address"
          itemLabel={pendingDeleteAddr.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_ADDRESS", name: pendingDeleteAddr.name });
            toast.success("Address deleted");
          }}
          onClose={() => setPendingDeleteAddr(null)}
        />
      ) : null}
      {pendingDeleteGroup ? (
        <ConfirmDeleteModal
          title="Delete Address Group"
          itemLabel={pendingDeleteGroup.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_ADDRESS_GROUP", name: pendingDeleteGroup.name });
            toast.success("Address group deleted");
          }}
          onClose={() => setPendingDeleteGroup(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 3. Services (+ Service Groups)
// ===================================================================

function ServiceFormModal({ editing, dispatch, onClose }: { editing: FortiService | null; dispatch: Dispatch; onClose: () => void }) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiService>(() => editing ?? { name: "", protocol: "TCP", port: "", category: "General" });

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const service: FortiService = { ...form, name };
    if (isNew) {
      dispatch({ type: "ADD_SERVICE", service });
      toast.success("Service created");
    } else {
      dispatch({ type: "UPDATE_SERVICE", name: editing.name, patch: service });
      toast.success("Service updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Service" : `Edit Service — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Protocol" required help="e.g. TCP, UDP, ICMP, IP/TCP/UDP/SCTP">
        <input className={styles.input} type="text" value={form.protocol} onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value }))} />
      </Field>
      <Field label="Port" required help="e.g. 443, 1-65535, any">
        <input className={styles.input} type="text" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))} />
      </Field>
      <Field label="Category">
        <input className={styles.input} type="text" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
      </Field>
    </Modal>
  );
}

function ServiceGroupFormModal({
  editing,
  dispatch,
  onClose,
}: {
  editing: FortiServiceGroup | null;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiServiceGroup>(() => editing ?? { name: "", members: "", comment: "" });

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const group: FortiServiceGroup = { ...form, name };
    if (isNew) {
      dispatch({ type: "ADD_SERVICE_GROUP", group });
      toast.success("Service group created");
    } else {
      dispatch({ type: "UPDATE_SERVICE_GROUP", name: editing.name, patch: group });
      toast.success("Service group updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Service Group" : `Edit Service Group — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Members" help="Comma-separated service names">
        <input className={styles.input} type="text" value={form.members} onChange={(e) => setForm((p) => ({ ...p, members: e.target.value }))} />
      </Field>
      <Field label="Comments">
        <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function ServicesPage({ state, dispatch }: PageProps) {
  const [tab, setTab] = useState<"services" | "groups">("services");
  const [editingService, setEditingService] = useState<FortiService | null | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<FortiServiceGroup | null | undefined>(undefined);
  const [pendingDeleteSvc, setPendingDeleteSvc] = useState<FortiService | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<FortiServiceGroup | null>(null);

  const serviceColumns: DataTableColumn<FortiService>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "protocol", header: "Protocol", render: (s) => s.protocol },
    { key: "port", header: "Port", render: (s) => <span className={styles.mono}>{s.port}</span> },
    { key: "category", header: "Category", render: (s) => s.category },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditingService(s)}>
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={() => setPendingDeleteSvc(s)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const groupColumns: DataTableColumn<FortiServiceGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "members", header: "Members", render: (g) => g.members },
    { key: "comment", header: "Comments", render: (g) => g.comment },
    {
      key: "actions",
      header: "",
      render: (g) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditingGroup(g)}>
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={() => setPendingDeleteGroup(g)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Services</h2>
      <TabBar
        tabs={[
          { key: "services", label: "Services" },
          { key: "groups", label: "Service Groups" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === "services" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditingService(null)}>
              + Add service
            </button>
          </div>
          <DataTable columns={serviceColumns} rows={state.services} getRowKey={(s) => s.name} emptyMessage="No services configured." />
        </>
      ) : (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditingGroup(null)}>
              + Add service group
            </button>
          </div>
          <DataTable columns={groupColumns} rows={state.serviceGroups} getRowKey={(g) => g.name} emptyMessage="No service groups configured." />
        </>
      )}

      {editingService !== undefined ? (
        <ServiceFormModal editing={editingService} dispatch={dispatch} onClose={() => setEditingService(undefined)} />
      ) : null}
      {editingGroup !== undefined ? (
        <ServiceGroupFormModal editing={editingGroup} dispatch={dispatch} onClose={() => setEditingGroup(undefined)} />
      ) : null}

      {pendingDeleteSvc ? (
        <ConfirmDeleteModal
          title="Delete Service"
          itemLabel={pendingDeleteSvc.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_SERVICE", name: pendingDeleteSvc.name });
            toast.success("Service deleted");
          }}
          onClose={() => setPendingDeleteSvc(null)}
        />
      ) : null}
      {pendingDeleteGroup ? (
        <ConfirmDeleteModal
          title="Delete Service Group"
          itemLabel={pendingDeleteGroup.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_SERVICE_GROUP", name: pendingDeleteGroup.name });
            toast.success("Service group deleted");
          }}
          onClose={() => setPendingDeleteGroup(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 4. Schedules
// ===================================================================

const SCHEDULE_TYPE_OPTIONS = [
  { value: "Recurring", label: "Recurring" },
  { value: "One-time", label: "One-time" },
];

function ScheduleFormModal({ editing, dispatch, onClose }: { editing: FortiSchedule | null; dispatch: Dispatch; onClose: () => void }) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiSchedule>(() => editing ?? { name: "", type: "Recurring", days: "", start: "", end: "" });

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const schedule: FortiSchedule = { ...form, name };
    if (isNew) {
      dispatch({ type: "ADD_SCHEDULE", schedule });
      toast.success("Schedule created");
    } else {
      dispatch({ type: "UPDATE_SCHEDULE", name: editing.name, patch: schedule });
      toast.success("Schedule updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Schedule" : `Edit Schedule — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Type" required>
        <NativeSelect value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v as FortiSchedule["type"] }))} options={SCHEDULE_TYPE_OPTIONS} />
      </Field>
      {form.type === "Recurring" ? (
        <Field label="Days" help="e.g. Mon Tue Wed Thu Fri, or 'all'">
          <input className={styles.input} type="text" value={form.days ?? ""} onChange={(e) => setForm((p) => ({ ...p, days: e.target.value }))} />
        </Field>
      ) : null}
      <Field label="Start" required help={form.type === "One-time" ? "e.g. 2026-05-18 22:00" : "e.g. 09:00"}>
        <input className={styles.input} type="text" value={form.start} onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))} />
      </Field>
      <Field label="End" required help={form.type === "One-time" ? "e.g. 2026-05-19 02:00" : "e.g. 17:00"}>
        <input className={styles.input} type="text" value={form.end} onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function SchedulesPage({ state, dispatch }: PageProps) {
  const [editing, setEditing] = useState<FortiSchedule | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<FortiSchedule | null>(null);

  const columns: DataTableColumn<FortiSchedule>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "type", header: "Type", render: (s) => s.type },
    { key: "days", header: "Days", render: (s) => s.days ?? "-" },
    { key: "start", header: "Start", render: (s) => s.start },
    { key: "end", header: "End", render: (s) => s.end },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditing(s)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(s)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Schedules</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing(null)}>
          + Create new schedule
        </button>
      </div>
      <DataTable columns={columns} rows={state.schedules} getRowKey={(s) => s.name} emptyMessage="No schedules configured." />

      {editing !== undefined ? <ScheduleFormModal editing={editing} dispatch={dispatch} onClose={() => setEditing(undefined)} /> : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete Schedule"
          itemLabel={pendingDelete.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_SCHEDULE", name: pendingDelete.name });
            toast.success("Schedule deleted");
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 5. Virtual IPs (VIPs / DNAT)
// ===================================================================

function VipFormModal({
  state,
  editing,
  dispatch,
  onClose,
}: {
  state: FortiGateState;
  editing: FortiVip | null;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiVip>(
    () =>
      editing ?? {
        name: "",
        extIf: "port1",
        extIp: "",
        mappedIp: "",
        extPort: "",
        mappedPort: "",
        protocol: "TCP",
        portForward: true,
        comment: "",
      },
  );

  const ifOpts = state.interfaces.map((i) => ({ value: i.name, label: i.name }));

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const vip: FortiVip = { ...form, name };
    if (isNew) {
      dispatch({ type: "ADD_VIP", vip });
      toast.success("Virtual IP created");
    } else {
      dispatch({ type: "UPDATE_VIP", name: editing.name, patch: vip });
      toast.success("Virtual IP updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Virtual IP" : `Edit Virtual IP — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="External Interface" required>
        <NativeSelect value={form.extIf} onChange={(v) => setForm((p) => ({ ...p, extIf: v }))} options={ifOpts} />
      </Field>
      <Field label="External IP" required>
        <input className={styles.input} type="text" value={form.extIp} onChange={(e) => setForm((p) => ({ ...p, extIp: e.target.value }))} />
      </Field>
      <Field label="Mapped IP" required>
        <input className={styles.input} type="text" value={form.mappedIp} onChange={(e) => setForm((p) => ({ ...p, mappedIp: e.target.value }))} />
      </Field>
      <Field label="Protocol">
        <input className={styles.input} type="text" value={form.protocol} onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value }))} />
      </Field>
      <Field label="External Port">
        <input className={styles.input} type="text" value={form.extPort} onChange={(e) => setForm((p) => ({ ...p, extPort: e.target.value }))} />
      </Field>
      <Field label="Mapped Port">
        <input className={styles.input} type="text" value={form.mappedPort} onChange={(e) => setForm((p) => ({ ...p, mappedPort: e.target.value }))} />
      </Field>
      <Field label="Port Forwarding">
        <Toggle checked={form.portForward} onChange={(v) => setForm((p) => ({ ...p, portForward: v }))} />
      </Field>
      <Field label="Comments">
        <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function VipsPage({ state, dispatch }: PageProps) {
  const [editing, setEditing] = useState<FortiVip | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<FortiVip | null>(null);

  const columns: DataTableColumn<FortiVip>[] = [
    { key: "name", header: "Name", render: (v) => <b>{v.name}</b> },
    { key: "extIf", header: "External Interface", render: (v) => v.extIf },
    {
      key: "ext",
      header: "External IP:Port",
      render: (v) => (
        <span className={styles.mono}>
          {v.extIp}:{v.extPort}
        </span>
      ),
    },
    {
      key: "mapped",
      header: "Mapped IP:Port",
      render: (v) => (
        <span className={styles.mono}>
          {v.mappedIp}:{v.mappedPort}
        </span>
      ),
    },
    { key: "protocol", header: "Protocol", render: (v) => v.protocol },
    {
      key: "portForward",
      header: "Port Forward",
      render: (v) => (v.portForward ? <StatusPill tone="up">enabled</StatusPill> : <StatusPill tone="muted">disabled</StatusPill>),
    },
    { key: "comment", header: "Comments", render: (v) => v.comment },
    {
      key: "actions",
      header: "",
      render: (v) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditing(v)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(v)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Virtual IPs</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing(null)}>
          + Create new VIP
        </button>
      </div>
      <DataTable columns={columns} rows={state.vips} getRowKey={(v) => v.name} emptyMessage="No virtual IPs configured." />

      {editing !== undefined ? <VipFormModal state={state} editing={editing} dispatch={dispatch} onClose={() => setEditing(undefined)} /> : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete Virtual IP"
          itemLabel={pendingDelete.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_VIP", name: pendingDelete.name });
            toast.success("Virtual IP deleted");
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 6. IP Pools
// ===================================================================

function IpPoolFormModal({ editing, dispatch, onClose }: { editing: FortiIpPool | null; dispatch: Dispatch; onClose: () => void }) {
  const isNew = editing === null;
  const [form, setForm] = useState<FortiIpPool>(() => editing ?? { name: "", type: "overload", extIp: "", arpReply: true, comment: "" });

  function handleSave() {
    const name = form.name.trim();
    const extIp = form.extIp.trim();
    if (!name || !extIp) {
      toast.error("Name and external IP range are required");
      return;
    }
    const pool: FortiIpPool = { ...form, name, extIp };
    if (isNew) {
      dispatch({ type: "ADD_IP_POOL", pool });
      toast.success("IP pool created");
    } else {
      dispatch({ type: "UPDATE_IP_POOL", name: editing.name, patch: pool });
      toast.success("IP pool updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New IP Pool" : `Edit IP Pool — ${editing.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            OK
          </button>
        </>
      }
    >
      <Field label="Name" required>
        <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Type" help="e.g. overload, one-to-one, fixed-port-range">
        <input className={styles.input} type="text" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
      </Field>
      <Field label="External IP Range" required help="e.g. 203.0.113.20-203.0.113.25">
        <input className={styles.input} type="text" value={form.extIp} onChange={(e) => setForm((p) => ({ ...p, extIp: e.target.value }))} />
      </Field>
      <Field label="ARP Reply">
        <Checkbox label="Enable" checked={form.arpReply} onChange={(v) => setForm((p) => ({ ...p, arpReply: v }))} />
      </Field>
      <Field label="Comments">
        <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function IpPoolsPage({ state, dispatch }: PageProps) {
  const [editing, setEditing] = useState<FortiIpPool | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<FortiIpPool | null>(null);

  const columns: DataTableColumn<FortiIpPool>[] = [
    { key: "name", header: "Name", render: (p) => <b>{p.name}</b> },
    { key: "type", header: "Type", render: (p) => p.type },
    { key: "extIp", header: "External IP Range", render: (p) => <span className={styles.mono}>{p.extIp}</span> },
    { key: "arpReply", header: "ARP Reply", render: (p) => (p.arpReply ? "Yes" : "No") },
    { key: "comment", header: "Comments", render: (p) => p.comment },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditing(p)}>
            Edit
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>IP Pools</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing(null)}>
          + Create new IP pool
        </button>
      </div>
      <DataTable columns={columns} rows={state.ipPools} getRowKey={(p) => p.name} emptyMessage="No IP pools configured." />

      {editing !== undefined ? <IpPoolFormModal editing={editing} dispatch={dispatch} onClose={() => setEditing(undefined)} /> : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete IP Pool"
          itemLabel={pendingDelete.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_IP_POOL", name: pendingDelete.name });
            toast.success("IP pool deleted");
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
