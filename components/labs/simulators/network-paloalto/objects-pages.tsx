"use client";

// Objects pages for the Palo Alto PAN-OS WebUI simulator: Addresses (+
// Address Groups), Services (+ Service Groups), Applications (+ Application
// Groups + Application Filters), and Tags.
//
// Ported from itbd-lab/simulators/network/js/paloalto-ui.js:
//   PAGES['obj-addr'] (1330-1347) + addrModal() (1349-1387)
//   PAGES['obj-addrgrp'] (1390-1407) + addrGrpModal() (1408-1446)
//   PAGES['obj-services'] (1449-1467) + svcModal() (1468-1502)
//   PAGES['obj-svcgrp'] (1505-1511) — source renders this read-only (no
//     Edit/Delete row actions, no modal) even though state has a real
//     serviceGroups list; this port gives it full CRUD via ADD_SERVICE_GROUP/
//     UPDATE_SERVICE_GROUP/DELETE_SERVICE_GROUP (all present in the reducer),
//     matching the FortiGate-suite convention of upgrading half-wired source
//     object pages to genuinely-wired CRUD.
//   PAGES['obj-apps'] (1514-1533) + appModal() (1534-1570)
//   PAGES['obj-tags'] (1573-1588) + tagModal() (1589-1609)
//   makeCRUD() (1956-1968) — generic index-splice delete + confirm().
//
// Source's nav (paloalto-ui.js:65-66) lists "Application Groups" and
// "Application Filters" as separate rail items, but PAGES never defines
// handlers for 'obj-appgrp'/'obj-appfilters' anywhere in the file (confirmed
// via full-file grep — the only other references are the nav label and a
// field-name mapping table at lines 3060-3061) — i.e. even source treats
// these as unbuilt/read-only stubs. The reducer (reducer.ts) likewise has no
// ADD_/UPDATE_/DELETE_ actions for applications, application groups, or
// application filters — matching the real PAN-OS product, where App-ID
// content (including any groups/filters built from it) ships from Palo Alto
// Networks' threat-content updates, not hand-authored by an admin the way
// addresses/services/tags are. Applications, Application Groups, and
// Application Filters are therefore rendered here as real, read-only views
// over `state.applications` / `state.applicationGroups` /
// `state.applicationFilters` — no invented actions, no fabricated CRUD.
//
// No native prompt()/alert()/confirm() anywhere — all confirmations go
// through `toast` (sonner) plus an in-page ConfirmDeleteModal, matching the
// FortiGate-suite convention (policy-objects-pages.tsx).

import { useState } from "react";
import { toast } from "sonner";

import type {
  PaloAddress,
  PaloAddressGroup,
  PaloApplication,
  PaloApplicationFilter,
  PaloApplicationGroup,
  PaloService,
  PaloServiceGroup,
  PaloState,
  PaloTag,
} from "@/lib/labs/simulators/network-paloalto/types";
import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import {
  DataTable,
  type DataTableColumn,
  Field,
  Modal,
  NativeSelect,
  TabBar,
} from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type Dispatch = React.Dispatch<PaloAction>;
type PageProps = { state: PaloState; dispatch: Dispatch };

// ===================================================================
// Shared helpers
// ===================================================================

// Tag badge row — ported visual idea from source's tagsBadges() helper
// (paloalto-ui.js:370-379): renders each comma-separated tag name as a pill
// colored by the matching entry in `state.tags` (falls back to blue, same
// as source, when a tag name isn't found in the tag list).
const TAG_COLOR_CLASS: Record<string, string> = {
  orange: styles.tagColOrange,
  green: styles.tagColGreen,
  blue: styles.tagColBlue,
  red: styles.tagColRed,
  "red-dark": styles.tagColRedDark,
};

function TagBadges({ value, tags }: { value: string; tags: PaloTag[] }) {
  const names = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (names.length === 0) return null;
  return (
    <>
      {names.map((name) => {
        const match = tags.find((t) => t.name === name);
        const colorClass = TAG_COLOR_CLASS[match?.color ?? "blue"] ?? styles.tagColBlue;
        return (
          <span key={name} className={`${styles.tag} ${colorClass}`}>
            {name}
          </span>
        );
      })}
    </>
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
// 1. Addresses (+ Address Groups)
// ===================================================================

const ADDRESS_TYPE_OPTIONS = [
  { value: "IP Netmask", label: "IP Netmask" },
  { value: "IP Range", label: "IP Range" },
  { value: "Static", label: "Static (member list)" },
  { value: "FQDN", label: "FQDN" },
];

const ADDRESS_GROUP_TYPE_OPTIONS = [
  { value: "Static", label: "Static" },
  { value: "Dynamic", label: "Dynamic" },
];

function AddressFormModal({
  editing,
  dispatch,
  onClose,
}: {
  editing: PaloAddress | null;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<PaloAddress>(
    () => editing ?? { name: "", type: "IP Netmask", value: "", members: "", tags: "", description: "" },
  );

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (form.type !== "Static" && !form.value.trim()) {
      toast.error("Value is required for this address type");
      return;
    }
    if (form.type === "Static" && !(form.members ?? "").trim()) {
      toast.error("Members are required for a Static address");
      return;
    }
    const address: PaloAddress = { ...form, name, value: form.value.trim(), description: form.description.trim() };
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
      <Field label="Description">
        <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </Field>
      <Field label="Type" required>
        <NativeSelect
          value={form.type}
          onChange={(v) => setForm((p) => ({ ...p, type: v as PaloAddress["type"] }))}
          options={ADDRESS_TYPE_OPTIONS}
        />
      </Field>
      {form.type === "Static" ? (
        <Field label="Members" required help="Comma-separated address object names">
          <input
            className={styles.input}
            type="text"
            value={form.members ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, members: e.target.value }))}
          />
        </Field>
      ) : (
        <Field label="Value" required help="e.g. 10.1.0.0/24, 10.1.0.20-10.1.0.40, or *.office.com">
          <input className={styles.input} type="text" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} />
        </Field>
      )}
      <Field label="Tags" help="Comma-separated tag names">
        <input className={styles.input} type="text" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
      </Field>
    </Modal>
  );
}

function AddressGroupFormModal({
  editing,
  dispatch,
  onClose,
}: {
  editing: PaloAddressGroup | null;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<PaloAddressGroup>(
    () => editing ?? { name: "", type: "Static", members: "", filter: "", tags: "", description: "" },
  );

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (form.type === "Static" && !form.members.trim()) {
      toast.error("Members are required for a Static group");
      return;
    }
    if (form.type === "Dynamic" && !form.filter.trim()) {
      toast.error("Match filter is required for a Dynamic group");
      return;
    }
    const group: PaloAddressGroup = { ...form, name, description: form.description.trim() };
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
      <Field label="Description">
        <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </Field>
      <Field label="Type" required>
        <NativeSelect
          value={form.type}
          onChange={(v) => setForm((p) => ({ ...p, type: v as PaloAddressGroup["type"] }))}
          options={ADDRESS_GROUP_TYPE_OPTIONS}
        />
      </Field>
      {form.type === "Static" ? (
        <Field label="Members" required help="Comma-separated address/group names">
          <input className={styles.input} type="text" value={form.members} onChange={(e) => setForm((p) => ({ ...p, members: e.target.value }))} />
        </Field>
      ) : (
        <Field label="Match Filter" required help="e.g. 'tag-1' and 'tag-2'">
          <input className={styles.input} type="text" value={form.filter} onChange={(e) => setForm((p) => ({ ...p, filter: e.target.value }))} />
        </Field>
      )}
      <Field label="Tags" help="Comma-separated tag names">
        <input className={styles.input} type="text" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function AddressesPage({ state, dispatch }: PageProps) {
  const [tab, setTab] = useState<"addresses" | "groups">("addresses");
  const [editingAddress, setEditingAddress] = useState<PaloAddress | null | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<PaloAddressGroup | null | undefined>(undefined);
  const [pendingDeleteAddr, setPendingDeleteAddr] = useState<PaloAddress | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<PaloAddressGroup | null>(null);

  const addressColumns: DataTableColumn<PaloAddress>[] = [
    { key: "name", header: "Name", render: (a) => <b>{a.name}</b> },
    { key: "type", header: "Type", render: (a) => a.type },
    { key: "value", header: "Value", render: (a) => <span className={styles.mono}>{a.value || "—"}</span> },
    { key: "members", header: "Members", render: (a) => (a.type === "Static" ? a.members ?? "" : "") },
    { key: "tags", header: "Tags", render: (a) => <TagBadges value={a.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (a) => a.description },
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

  const groupColumns: DataTableColumn<PaloAddressGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "type", header: "Type", render: (g) => g.type },
    { key: "members", header: "Members / Filter", render: (g) => g.members || g.filter },
    { key: "tags", header: "Tags", render: (g) => <TagBadges value={g.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (g) => g.description },
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
      <h2>Objects &mdash; Addresses</h2>
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
        <AddressFormModal editing={editingAddress} dispatch={dispatch} onClose={() => setEditingAddress(undefined)} />
      ) : null}
      {editingGroup !== undefined ? (
        <AddressGroupFormModal editing={editingGroup} dispatch={dispatch} onClose={() => setEditingGroup(undefined)} />
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
// 2. Services (+ Service Groups)
// ===================================================================

const SERVICE_PROTOCOL_OPTIONS = [
  { value: "TCP", label: "TCP" },
  { value: "UDP", label: "UDP" },
];

function ServiceFormModal({ editing, dispatch, onClose }: { editing: PaloService | null; dispatch: Dispatch; onClose: () => void }) {
  const isNew = editing === null;
  const [form, setForm] = useState<PaloService>(
    () => editing ?? { name: "", protocol: "TCP", dstPort: "", srcPort: "any", tags: "", description: "" },
  );

  function handleSave() {
    const name = form.name.trim();
    const dstPort = form.dstPort.trim();
    if (!name || !dstPort) {
      toast.error("Name and destination port are required");
      return;
    }
    const service: PaloService = { ...form, name, dstPort, srcPort: form.srcPort.trim() || "any", description: form.description.trim() };
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
      <Field label="Description">
        <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </Field>
      <Field label="Protocol" required>
        <NativeSelect
          value={form.protocol}
          onChange={(v) => setForm((p) => ({ ...p, protocol: v as PaloService["protocol"] }))}
          options={SERVICE_PROTOCOL_OPTIONS}
        />
      </Field>
      <Field label="Destination Port" required help="e.g. 80, 443, 1024-65535">
        <input className={styles.input} type="text" value={form.dstPort} onChange={(e) => setForm((p) => ({ ...p, dstPort: e.target.value }))} />
      </Field>
      <Field label="Source Port" help="any">
        <input className={styles.input} type="text" value={form.srcPort} onChange={(e) => setForm((p) => ({ ...p, srcPort: e.target.value }))} />
      </Field>
      <Field label="Tags" help="Comma-separated tag names">
        <input className={styles.input} type="text" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
      </Field>
    </Modal>
  );
}

function ServiceGroupFormModal({
  editing,
  dispatch,
  onClose,
}: {
  editing: PaloServiceGroup | null;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const isNew = editing === null;
  const [form, setForm] = useState<PaloServiceGroup>(() => editing ?? { name: "", members: "", tags: "", description: "" });

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const group: PaloServiceGroup = { ...form, name, description: form.description.trim() };
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
      <Field label="Description">
        <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </Field>
      <Field label="Tags" help="Comma-separated tag names">
        <input className={styles.input} type="text" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function ServicesPage({ state, dispatch }: PageProps) {
  const [tab, setTab] = useState<"services" | "groups">("services");
  const [editingService, setEditingService] = useState<PaloService | null | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<PaloServiceGroup | null | undefined>(undefined);
  const [pendingDeleteService, setPendingDeleteService] = useState<PaloService | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<PaloServiceGroup | null>(null);

  const serviceColumns: DataTableColumn<PaloService>[] = [
    { key: "name", header: "Name", render: (s) => <b>{s.name}</b> },
    { key: "protocol", header: "Protocol", render: (s) => s.protocol },
    { key: "dstPort", header: "Destination Port", render: (s) => <span className={styles.mono}>{s.dstPort}</span> },
    { key: "srcPort", header: "Source Port", render: (s) => <span className={styles.mono}>{s.srcPort}</span> },
    { key: "tags", header: "Tags", render: (s) => <TagBadges value={s.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (s) => s.description },
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
            onClick={() => setPendingDeleteService(s)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const groupColumns: DataTableColumn<PaloServiceGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "members", header: "Members", render: (g) => g.members },
    { key: "tags", header: "Tags", render: (g) => <TagBadges value={g.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (g) => g.description },
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
      <h2>Objects &mdash; Services</h2>
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

      {pendingDeleteService ? (
        <ConfirmDeleteModal
          title="Delete Service"
          itemLabel={pendingDeleteService.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_SERVICE", name: pendingDeleteService.name });
            toast.success("Service deleted");
          }}
          onClose={() => setPendingDeleteService(null)}
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
// 3. Applications (+ Application Groups + Application Filters) — READ-ONLY
//
// No ADD_/UPDATE_/DELETE_ actions exist in the reducer for applications,
// application groups, or application filters (App-ID content is vendor-
// managed threat content in real PAN-OS, not admin-authored) and source
// itself never wires CRUD for application groups/filters either (see file
// header) — so all three views here render real seeded state with no row
// actions and no modals.
// ===================================================================

const RISK_CLASS: Record<number, string> = {
  1: styles.risk1,
  2: styles.risk2,
  3: styles.risk3,
  4: styles.risk4,
  5: styles.risk5,
};

function RiskBadge({ risk }: { risk: number }) {
  return <span className={`${styles.risk} ${RISK_CLASS[risk] ?? ""}`}>{risk}</span>;
}

export function ApplicationsPage({ state }: { state: PaloState }) {
  const [tab, setTab] = useState<"apps" | "groups" | "filters">("apps");

  const appColumns: DataTableColumn<PaloApplication>[] = [
    { key: "name", header: "Name", render: (a) => <b>{a.name}</b> },
    { key: "category", header: "Category / Sub", render: (a) => `${a.category} / ${a.subcategory}` },
    { key: "technology", header: "Technology", render: (a) => a.technology },
    { key: "risk", header: "Risk", render: (a) => <RiskBadge risk={a.risk} /> },
    { key: "ports", header: "Ports", render: (a) => <span className={styles.mono}>{a.ports}</span> },
    { key: "tags", header: "Tags", render: (a) => <TagBadges value={a.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (a) => a.description },
  ];

  const groupColumns: DataTableColumn<PaloApplicationGroup>[] = [
    { key: "name", header: "Name", render: (g) => <b>{g.name}</b> },
    { key: "members", header: "Members", render: (g) => g.members },
    { key: "tags", header: "Tags", render: (g) => <TagBadges value={g.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (g) => g.description },
  ];

  const filterColumns: DataTableColumn<PaloApplicationFilter>[] = [
    { key: "name", header: "Name", render: (f) => <b>{f.name}</b> },
    { key: "category", header: "Category", render: (f) => f.category },
    { key: "subcategory", header: "Subcategory", render: (f) => f.subcategory },
    { key: "risk", header: "Risk", render: (f) => <span className={styles.mono}>{f.risk}</span> },
    { key: "tags", header: "Tags", render: (f) => <TagBadges value={f.tags} tags={state.tags} /> },
    { key: "description", header: "Description", render: (f) => f.description },
  ];

  return (
    <div>
      <h2>Objects &mdash; Applications</h2>
      <div className={styles.hint} style={{ marginBottom: 8 }}>
        Application, Application Group, and Application Filter objects are App-ID content — shipped and updated by
        Palo Alto Networks threat-content updates, not hand-authored here. These views are read-only.
      </div>
      <TabBar
        tabs={[
          { key: "apps", label: "Applications" },
          { key: "groups", label: "Application Groups" },
          { key: "filters", label: "Application Filters" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {tab === "apps" ? (
        <DataTable columns={appColumns} rows={state.applications} getRowKey={(a) => a.name} emptyMessage="No applications available." />
      ) : tab === "groups" ? (
        <DataTable columns={groupColumns} rows={state.applicationGroups} getRowKey={(g) => g.name} emptyMessage="No application groups available." />
      ) : (
        <DataTable columns={filterColumns} rows={state.applicationFilters} getRowKey={(f) => f.name} emptyMessage="No application filters available." />
      )}
    </div>
  );
}

// ===================================================================
// 4. Tags
// ===================================================================

const TAG_COLOR_OPTIONS = [
  { value: "orange", label: "orange" },
  { value: "green", label: "green" },
  { value: "blue", label: "blue" },
  { value: "red", label: "red" },
  { value: "red-dark", label: "red-dark" },
];

function TagFormModal({ editing, dispatch, onClose }: { editing: PaloTag | null; dispatch: Dispatch; onClose: () => void }) {
  const isNew = editing === null;
  const [form, setForm] = useState<PaloTag>(() => editing ?? { name: "", color: "blue", comment: "" });

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const tag: PaloTag = { ...form, name, comment: form.comment.trim() };
    if (isNew) {
      dispatch({ type: "ADD_TAG", tag });
      toast.success("Tag created");
    } else {
      dispatch({ type: "UPDATE_TAG", name: editing.name, patch: tag });
      toast.success("Tag updated");
    }
    onClose();
  }

  return (
    <Modal
      title={isNew ? "New Tag" : `Edit Tag — ${editing.name}`}
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
      <Field label="Color">
        <NativeSelect value={form.color} onChange={(v) => setForm((p) => ({ ...p, color: v }))} options={TAG_COLOR_OPTIONS} />
      </Field>
      <Field label="Comments">
        <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} />
      </Field>
    </Modal>
  );
}

export function TagsPage({ state, dispatch }: PageProps) {
  const [editingTag, setEditingTag] = useState<PaloTag | null | undefined>(undefined);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<PaloTag | null>(null);

  const columns: DataTableColumn<PaloTag>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => {
        const colorClass = TAG_COLOR_CLASS[t.color] ?? styles.tagColBlue;
        return <span className={`${styles.tag} ${colorClass}`}>{t.name}</span>;
      },
    },
    {
      key: "color",
      header: "Color",
      render: (t) => (
        <>
          <span className={styles.colorDot} style={{ background: "currentColor" }} />
          <span className={`${styles.tag} ${TAG_COLOR_CLASS[t.color] ?? styles.tagColBlue}`}>{t.color}</span>
        </>
      ),
    },
    { key: "comment", header: "Comments", render: (t) => t.comment },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <div className={styles.rowActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditingTag(t)}>
            Edit
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            onClick={() => setPendingDeleteTag(t)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Objects &mdash; Tags</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditingTag(null)}>
          + Add tag
        </button>
      </div>
      <DataTable columns={columns} rows={state.tags} getRowKey={(t) => t.name} emptyMessage="No tags configured." />

      {editingTag !== undefined ? <TagFormModal editing={editingTag} dispatch={dispatch} onClose={() => setEditingTag(undefined)} /> : null}

      {pendingDeleteTag ? (
        <ConfirmDeleteModal
          title="Delete Tag"
          itemLabel={pendingDeleteTag.name}
          onConfirm={() => {
            dispatch({ type: "DELETE_TAG", name: pendingDeleteTag.name });
            toast.success("Tag deleted");
          }}
          onClose={() => setPendingDeleteTag(null)}
        />
      ) : null}
    </div>
  );
}
