"use client";

// Policies pages for the Palo Alto PAN-OS WebUI simulator: Security (the
// rulebase — THE FLAGSHIP PAGE and the core of any PAN-OS config), NAT,
// Decryption (SSL inspection), and Authentication.
//
// Ported from itbd-lab/simulators/network/js/paloalto-ui.js:
//   PAGES['pol-security'] (809-856) + securityRuleModal() (885-1056)
//   PAGES['pol-nat'] (1061-1090) + natRuleModal() (1092-1182)
//   PAGES['pol-decryption'] (1187-1208) + decryptRuleModal() (1210-1262)
//   PAGES['pol-auth'] (1267-1274) — source's Authentication page is a
//     READ-ONLY list (no create/edit/delete handler anywhere, no
//     `U._auth` object registered — only Security/NAT/Decryption get
//     `U._policy`/`U._nat`/`U._dec`). Per the brief's requirement that
//     every policy type here get full genuinely-wired CRUD + reorder +
//     toggle (matching the FortiGate port's `FirewallPoliciesPage`
//     convention), Authentication gets the same real CRUD treatment as an
//     intentional improvement over source's half-wired page.
//
// All four tables render their policy list in RAW ARRAY ORDER — PAN-OS
// rulebases are strictly top-to-bottom, order-sensitive rule evaluation, so
// the DataTable row order IS the real evaluation order. The only supported
// way to change it is the REORDER_*_POLICY action via the up/down row
// buttons — no client-side sort is ever applied, matching the FortiGate
// port's `FirewallPoliciesPage` pattern exactly.
//
// No native prompt()/alert()/confirm() anywhere — all confirmations go
// through `toast` (sonner), matching house convention.

import { useState } from "react";
import { toast } from "sonner";

import type {
  PaloAuthPolicy,
  PaloDecryptionPolicy,
  PaloNatPolicy,
  PaloSecurityPolicy,
  PaloState,
} from "@/lib/labs/simulators/network-paloalto/types";
import { URL_CATEGORIES } from "@/lib/labs/simulators/network-paloalto/seedData";
import type { PaloAction } from "@/lib/labs/simulators/network-paloalto/reducer";
import { DataTable, type DataTableColumn, Field, Flyout, Modal, NativeSelect, StatusPill, Toggle } from "./paloalto-ui";
import styles from "./paloalto-console.module.css";

type Dispatch = React.Dispatch<PaloAction>;
type PageProps = { state: PaloState; dispatch: Dispatch };

// ===================================================================
// Shared helpers
// ===================================================================

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

// Generic reorder-buttons cell — shared shape across all four rulebases:
// disabled at the array boundary, dispatches the given REORDER action.
function ReorderCell({
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={`${styles.btn} ${styles.btnSm}`} disabled={isFirst} title="Move up" onClick={onUp}>
        &#9650;
      </button>
      <button type="button" className={`${styles.btn} ${styles.btnSm}`} disabled={isLast} title="Move down" onClick={onDown}>
        &#9660;
      </button>
    </div>
  );
}

const ZONE_ANY = "any";

function zoneOptions(state: PaloState): { value: string; label: string }[] {
  return [ZONE_ANY, ...state.zones.map((z) => z.name)].map((z) => ({ value: z, label: z }));
}

function addrOptions(state: PaloState): { value: string; label: string }[] {
  return [ZONE_ANY, ...state.addresses.map((a) => a.name), ...state.addressGroups.map((g) => g.name)].map((a) => ({
    value: a,
    label: a,
  }));
}

function urlCatOptions(): { value: string; label: string }[] {
  return [ZONE_ANY, ...URL_CATEGORIES].map((c) => ({ value: c, label: c }));
}

// ===================================================================
// 1. Security Policies — THE FLAGSHIP PAGE
// ===================================================================

type SecurityFormState = {
  name: string;
  description: string;
  tag: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  users: string;
  app: string;
  service: string;
  urlCat: string;
  action: "allow" | "deny";
  logStart: boolean;
  logEnd: boolean;
  profileGroup: string;
  disabled: boolean;
};

function blankSecurityForm(): SecurityFormState {
  return {
    name: "",
    description: "",
    tag: "",
    srcZone: "trust",
    dstZone: "untrust",
    srcAddr: "any",
    dstAddr: "any",
    users: "any",
    app: "any",
    service: "application-default",
    urlCat: "any",
    action: "allow",
    logStart: false,
    logEnd: true,
    profileGroup: "",
    disabled: false,
  };
}

function securityToForm(p: PaloSecurityPolicy): SecurityFormState {
  return {
    name: p.name,
    description: p.description,
    tag: p.tag,
    srcZone: p.srcZone,
    dstZone: p.dstZone,
    srcAddr: p.srcAddr,
    dstAddr: p.dstAddr,
    users: p.users,
    app: p.app,
    service: p.service,
    urlCat: p.urlCat,
    action: p.action,
    logStart: p.logStart,
    logEnd: p.logEnd,
    profileGroup: p.profileGroup,
    disabled: p.disabled,
  };
}

function SecurityFormFields({
  form,
  setForm,
  state,
}: {
  form: SecurityFormState;
  setForm: (updater: (prev: SecurityFormState) => SecurityFormState) => void;
  state: PaloState;
}) {
  const svcOpts = ["any", "application-default", ...state.services.map((s) => s.name), ...state.serviceGroups.map((g) => g.name)].map(
    (s) => ({ value: s, label: s }),
  );
  const profileGroupOpts = [{ value: "", label: "(none)" }, ...state.profileGroups.map((g) => ({ value: g.name, label: g.name }))];

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>General</legend>
        <Field label="Name" required>
          <input
            className={styles.input}
            type="text"
            value={form.name}
            placeholder="rule-name"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </Field>
        <Field label="Tags" help="Comma-separated tag names">
          <input className={styles.input} type="text" value={form.tag} onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value }))} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Source</legend>
        <Field label="Source Zone" required>
          <NativeSelect value={form.srcZone} onChange={(v) => setForm((prev) => ({ ...prev, srcZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Source Address" required>
          <NativeSelect value={form.srcAddr} onChange={(v) => setForm((prev) => ({ ...prev, srcAddr: v }))} options={addrOptions(state)} />
        </Field>
        <Field label="Source User" help="any | corp\group | known-user">
          <input className={styles.input} type="text" value={form.users} onChange={(e) => setForm((prev) => ({ ...prev, users: e.target.value }))} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Destination</legend>
        <Field label="Destination Zone" required>
          <NativeSelect value={form.dstZone} onChange={(v) => setForm((prev) => ({ ...prev, dstZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Destination Address" required>
          <NativeSelect value={form.dstAddr} onChange={(v) => setForm((prev) => ({ ...prev, dstAddr: v }))} options={addrOptions(state)} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Application / Service / URL Category</legend>
        <Field label="Applications" help="any | web-browsing, ssl">
          <input className={styles.input} type="text" value={form.app} onChange={(e) => setForm((prev) => ({ ...prev, app: e.target.value }))} />
        </Field>
        <Field label="Service" required>
          <NativeSelect value={form.service} onChange={(v) => setForm((prev) => ({ ...prev, service: v }))} options={svcOpts} />
        </Field>
        <Field label="URL Category">
          <NativeSelect value={form.urlCat} onChange={(v) => setForm((prev) => ({ ...prev, urlCat: v }))} options={urlCatOptions()} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Actions</legend>
        <Field label="Action">
          <div className={styles.radioRow}>
            <label>
              <input type="radio" name="sr_action" checked={form.action === "allow"} onChange={() => setForm((prev) => ({ ...prev, action: "allow" }))} />
              Allow
            </label>
            <label>
              <input type="radio" name="sr_action" checked={form.action === "deny"} onChange={() => setForm((prev) => ({ ...prev, action: "deny" }))} />
              Deny
            </label>
          </div>
        </Field>
        <Field label="Profile Group">
          <NativeSelect value={form.profileGroup} onChange={(v) => setForm((prev) => ({ ...prev, profileGroup: v }))} options={profileGroupOpts} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Log Setting</legend>
        <Field label="Log At Session Start">
          <Toggle checked={form.logStart} onChange={(v) => setForm((prev) => ({ ...prev, logStart: v }))} />
        </Field>
        <Field label="Log At Session End">
          <Toggle checked={form.logEnd} onChange={(v) => setForm((prev) => ({ ...prev, logEnd: v }))} />
        </Field>
        <Field label="Disable rule">
          <Toggle checked={form.disabled} onChange={(v) => setForm((prev) => ({ ...prev, disabled: v }))} />
        </Field>
      </fieldset>
    </>
  );
}

function NewSecurityPolicyModal({ state, dispatch, onClose }: { state: PaloState; dispatch: Dispatch; onClose: () => void }) {
  const [form, setForm] = useState<SecurityFormState>(blankSecurityForm);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const policy: Omit<PaloSecurityPolicy, "id"> = {
      name,
      srcZone: form.srcZone,
      dstZone: form.dstZone,
      srcAddr: form.srcAddr,
      dstAddr: form.dstAddr,
      users: form.users.trim() || "any",
      app: form.app.trim() || "any",
      service: form.service,
      urlCat: form.urlCat,
      action: form.action,
      logStart: form.logStart,
      logEnd: form.logEnd,
      profileGroup: form.profileGroup,
      tag: form.tag.trim(),
      description: form.description.trim(),
      hitCount: 0,
      disabled: form.disabled,
    };
    dispatch({ type: "ADD_SECURITY_POLICY", policy });
    toast.success("Security rule created");
    onClose();
  }

  return (
    <Modal
      title="New Security Rule"
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
      <SecurityFormFields form={form} setForm={setForm} state={state} />
    </Modal>
  );
}

function SecurityPolicyDetailFlyout({
  policy,
  state,
  dispatch,
  onClose,
}: {
  policy: PaloSecurityPolicy;
  state: PaloState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SecurityFormState>(() => securityToForm(policy));

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({
      type: "UPDATE_SECURITY_POLICY",
      id: policy.id,
      patch: {
        name,
        srcZone: form.srcZone,
        dstZone: form.dstZone,
        srcAddr: form.srcAddr,
        dstAddr: form.dstAddr,
        users: form.users.trim() || "any",
        app: form.app.trim() || "any",
        service: form.service,
        urlCat: form.urlCat,
        action: form.action,
        logStart: form.logStart,
        logEnd: form.logEnd,
        profileGroup: form.profileGroup,
        tag: form.tag.trim(),
        description: form.description.trim(),
        disabled: form.disabled,
      },
    });
    toast.success("Security rule saved");
    onClose();
  }

  return (
    <Flyout
      title={`Edit Security Rule — ${policy.name} (ID ${policy.id})`}
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
      <SecurityFormFields form={form} setForm={setForm} state={state} />
    </Flyout>
  );
}

export function SecurityPoliciesPage({ state, dispatch }: PageProps) {
  const [selected, setSelected] = useState<PaloSecurityPolicy | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaloSecurityPolicy | null>(null);

  const columns: DataTableColumn<PaloSecurityPolicy>[] = [
    { key: "id", header: "#", render: (p) => p.id, width: "40px" },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <>
          <b>{p.name}</b>
          {p.description ? <div className={styles.small}>{p.description}</div> : null}
        </>
      ),
    },
    {
      key: "zones",
      header: "Zone",
      render: (p) => (
        <span className={styles.mono}>
          {p.srcZone} &rarr; {p.dstZone}
        </span>
      ),
    },
    { key: "srcAddr", header: "Source", render: (p) => p.srcAddr },
    { key: "dstAddr", header: "Destination", render: (p) => p.dstAddr },
    { key: "users", header: "User", render: (p) => p.users },
    { key: "app", header: "Application", render: (p) => p.app },
    { key: "service", header: "Service", render: (p) => p.service },
    { key: "urlCat", header: "URL Category", render: (p) => p.urlCat },
    {
      key: "action",
      header: "Action",
      render: (p) => <StatusPill tone={p.action === "allow" ? "up" : "down"}>{p.action}</StatusPill>,
    },
    {
      key: "log",
      header: "Log",
      render: (p) => (
        <span className={styles.small} title="Log at session start / end">
          {p.logStart ? "S" : "-"}/{p.logEnd ? "E" : "-"}
        </span>
      ),
    },
    {
      key: "profileGroup",
      header: "Profile",
      render: (p) => (p.profileGroup ? <StatusPill tone="info">{p.profileGroup}</StatusPill> : <span className={styles.small}>none</span>),
    },
    { key: "tag", header: "Tags", render: (p) => (p.tag ? p.tag : <span className={styles.small}>-</span>) },
    { key: "hitCount", header: "Hit Count", render: (p) => p.hitCount.toLocaleString() },
    {
      key: "enabled",
      header: "Enabled",
      render: (p) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Toggle checked={!p.disabled} onChange={() => dispatch({ type: "TOGGLE_SECURITY_POLICY", id: p.id })} />
        </span>
      ),
    },
    {
      key: "reorder",
      header: "Order",
      render: (p) => {
        const idx = state.securityPolicies.findIndex((x) => x.id === p.id);
        return (
          <ReorderCell
            isFirst={idx <= 0}
            isLast={idx === state.securityPolicies.length - 1}
            onUp={() => dispatch({ type: "REORDER_SECURITY_POLICY", id: p.id, direction: "up" })}
            onDown={() => dispatch({ type: "REORDER_SECURITY_POLICY", id: p.id, direction: "down" })}
          />
        );
      },
    },
    {
      key: "rowActions",
      header: "",
      render: (p) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Policies &mdash; Security</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew(true)}>
          + Create new rule
        </button>
        <div className={styles.small}>
          {state.securityPolicies.length} rule{state.securityPolicies.length === 1 ? "" : "s"} &mdash; row order is the real top-to-bottom
          evaluation order.
        </div>
      </div>

      {/* No client-side sort: rows render in state.securityPolicies array order,
          which IS PAN-OS's real top-to-bottom rulebase evaluation order.
          REORDER_SECURITY_POLICY (the up/down buttons above) is the only
          supported way to change it. */}
      <DataTable
        columns={columns}
        rows={state.securityPolicies}
        getRowKey={(p) => String(p.id)}
        onRowClick={(p) => setSelected(p)}
        emptyMessage="No security rules configured."
      />

      {showNew ? <NewSecurityPolicyModal state={state} dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}

      {selected ? (
        <SecurityPolicyDetailFlyout policy={selected} state={state} dispatch={dispatch} onClose={() => setSelected(null)} />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete Security Rule"
          itemLabel={`${pendingDelete.name} (ID ${pendingDelete.id})`}
          onConfirm={() => {
            dispatch({ type: "DELETE_SECURITY_POLICY", id: pendingDelete.id });
            toast.success("Security rule deleted");
            if (selected?.id === pendingDelete.id) setSelected(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 2. NAT Policies
// ===================================================================

type NatFormState = {
  name: string;
  description: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  service: string;
  natType: "source" | "destination";
  sourceTranslation: string;
  interfaceAddr: string;
  translatedAddr: string;
  destTranslation: string;
  destPort: string;
  disabled: boolean;
};

function blankNatForm(): NatFormState {
  return {
    name: "",
    description: "",
    srcZone: "trust",
    dstZone: "untrust",
    srcAddr: "any",
    dstAddr: "any",
    service: "any",
    natType: "source",
    sourceTranslation: "dynamic-ip-and-port",
    interfaceAddr: "ethernet1/1",
    translatedAddr: "",
    destTranslation: "",
    destPort: "",
    disabled: false,
  };
}

function natToForm(p: PaloNatPolicy): NatFormState {
  return {
    name: p.name,
    description: p.description,
    srcZone: p.srcZone,
    dstZone: p.dstZone,
    srcAddr: p.srcAddr,
    dstAddr: p.dstAddr,
    service: p.service,
    natType: p.natType,
    sourceTranslation: p.sourceTranslation,
    interfaceAddr: p.interfaceAddr,
    translatedAddr: p.translatedAddr,
    destTranslation: p.destTranslation ?? "",
    destPort: p.destPort ?? "",
    disabled: p.disabled,
  };
}

const SOURCE_TRANSLATION_OPTIONS = [
  { value: "none", label: "none" },
  { value: "dynamic-ip-and-port", label: "dynamic-ip-and-port" },
  { value: "dynamic-ip", label: "dynamic-ip" },
  { value: "static-ip", label: "static-ip" },
];

function NatFormFields({
  form,
  setForm,
  state,
}: {
  form: NatFormState;
  setForm: (updater: (prev: NatFormState) => NatFormState) => void;
  state: PaloState;
}) {
  const svcOpts = ["any", ...state.services.map((s) => s.name)].map((s) => ({ value: s, label: s }));
  const ifOpts = state.interfaces.map((i) => ({ value: i.name, label: i.name }));

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>General</legend>
        <Field label="Name" required>
          <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>
        <Field label="Description">
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </Field>
        <Field label="NAT Type">
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="nat_type"
                checked={form.natType === "source"}
                onChange={() => setForm((prev) => ({ ...prev, natType: "source" }))}
              />
              Source NAT
            </label>
            <label>
              <input
                type="radio"
                name="nat_type"
                checked={form.natType === "destination"}
                onChange={() => setForm((prev) => ({ ...prev, natType: "destination" }))}
              />
              Destination NAT
            </label>
          </div>
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Original Packet</legend>
        <Field label="Source Zone" required>
          <NativeSelect value={form.srcZone} onChange={(v) => setForm((prev) => ({ ...prev, srcZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Destination Zone" required>
          <NativeSelect value={form.dstZone} onChange={(v) => setForm((prev) => ({ ...prev, dstZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Service">
          <NativeSelect value={form.service} onChange={(v) => setForm((prev) => ({ ...prev, service: v }))} options={svcOpts} />
        </Field>
        <Field label="Source Address">
          <NativeSelect value={form.srcAddr} onChange={(v) => setForm((prev) => ({ ...prev, srcAddr: v }))} options={addrOptions(state)} />
        </Field>
        <Field label="Destination Address" help="e.g. 203.0.113.10 or any">
          <input className={styles.input} type="text" value={form.dstAddr} onChange={(e) => setForm((prev) => ({ ...prev, dstAddr: e.target.value }))} />
        </Field>
      </fieldset>

      {form.natType === "source" ? (
        <fieldset className={styles.fieldset}>
          <legend>Source Address Translation</legend>
          <Field label="Translation Type">
            <NativeSelect
              value={form.sourceTranslation}
              onChange={(v) => setForm((prev) => ({ ...prev, sourceTranslation: v }))}
              options={SOURCE_TRANSLATION_OPTIONS}
            />
          </Field>
          <Field label="Interface">
            <NativeSelect value={form.interfaceAddr} onChange={(v) => setForm((prev) => ({ ...prev, interfaceAddr: v }))} options={ifOpts} />
          </Field>
          <Field label="Translated Address" help="Used when translation type is static-ip (or as fallback address)">
            <input
              className={styles.input}
              type="text"
              value={form.translatedAddr}
              onChange={(e) => setForm((prev) => ({ ...prev, translatedAddr: e.target.value }))}
            />
          </Field>
        </fieldset>
      ) : (
        <fieldset className={styles.fieldset}>
          <legend>Destination Address Translation</legend>
          <Field label="Translated Address" required>
            <input
              className={styles.input}
              type="text"
              value={form.translatedAddr}
              onChange={(e) => setForm((prev) => ({ ...prev, translatedAddr: e.target.value }))}
            />
          </Field>
          <Field label="Translated Port">
            <input className={styles.input} type="text" value={form.destPort} onChange={(e) => setForm((prev) => ({ ...prev, destPort: e.target.value }))} />
          </Field>
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Options</legend>
        <Field label="Disable rule">
          <Toggle checked={form.disabled} onChange={(v) => setForm((prev) => ({ ...prev, disabled: v }))} />
        </Field>
      </fieldset>
    </>
  );
}

function NewNatPolicyModal({ state, dispatch, onClose }: { state: PaloState; dispatch: Dispatch; onClose: () => void }) {
  const [form, setForm] = useState<NatFormState>(blankNatForm);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const policy: Omit<PaloNatPolicy, "id"> = {
      name,
      srcZone: form.srcZone,
      dstZone: form.dstZone,
      srcAddr: form.srcAddr,
      dstAddr: form.dstAddr.trim() || "any",
      service: form.service,
      type: "ipv4",
      natType: form.natType,
      sourceTranslation: form.natType === "source" ? form.sourceTranslation : "none",
      interfaceAddr: form.natType === "source" ? form.interfaceAddr : "",
      translatedAddr: form.translatedAddr.trim(),
      destTranslation: form.natType === "destination" ? "static-ip" : "",
      destPort: form.natType === "destination" ? form.destPort.trim() : "",
      description: form.description.trim(),
      disabled: form.disabled,
    };
    dispatch({ type: "ADD_NAT_POLICY", policy });
    toast.success("NAT rule created");
    onClose();
  }

  return (
    <Modal
      title="New NAT Rule"
      onClose={onClose}
      width="820px"
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
      <NatFormFields form={form} setForm={setForm} state={state} />
    </Modal>
  );
}

function NatPolicyDetailFlyout({
  policy,
  state,
  dispatch,
  onClose,
}: {
  policy: PaloNatPolicy;
  state: PaloState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [form, setForm] = useState<NatFormState>(() => natToForm(policy));

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({
      type: "UPDATE_NAT_POLICY",
      id: policy.id,
      patch: {
        name,
        srcZone: form.srcZone,
        dstZone: form.dstZone,
        srcAddr: form.srcAddr,
        dstAddr: form.dstAddr.trim() || "any",
        service: form.service,
        natType: form.natType,
        sourceTranslation: form.natType === "source" ? form.sourceTranslation : "none",
        interfaceAddr: form.natType === "source" ? form.interfaceAddr : "",
        translatedAddr: form.translatedAddr.trim(),
        destTranslation: form.natType === "destination" ? "static-ip" : "",
        destPort: form.natType === "destination" ? form.destPort.trim() : "",
        description: form.description.trim(),
        disabled: form.disabled,
      },
    });
    toast.success("NAT rule saved");
    onClose();
  }

  return (
    <Flyout
      title={`Edit NAT Rule — ${policy.name} (ID ${policy.id})`}
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
      <NatFormFields form={form} setForm={setForm} state={state} />
    </Flyout>
  );
}

export function NatPoliciesPage({ state, dispatch }: PageProps) {
  const [selected, setSelected] = useState<PaloNatPolicy | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaloNatPolicy | null>(null);

  const columns: DataTableColumn<PaloNatPolicy>[] = [
    { key: "id", header: "#", render: (p) => p.id, width: "40px" },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <>
          <b>{p.name}</b>
          {p.description ? <div className={styles.small}>{p.description}</div> : null}
        </>
      ),
    },
    { key: "natType", header: "NAT Type", render: (p) => p.natType },
    {
      key: "zones",
      header: "Zone",
      render: (p) => (
        <span className={styles.mono}>
          {p.srcZone} &rarr; {p.dstZone}
        </span>
      ),
    },
    { key: "srcAddr", header: "Source Addr", render: (p) => p.srcAddr },
    { key: "dstAddr", header: "Dest Addr", render: (p) => p.dstAddr },
    { key: "service", header: "Service", render: (p) => p.service },
    {
      key: "sourceTranslation",
      header: "Source Translation",
      render: (p) =>
        p.natType === "source" ? (
          <span className={styles.small}>
            {p.sourceTranslation}
            {p.interfaceAddr ? ` (${p.interfaceAddr})` : ""}
            {p.translatedAddr ? ` → ${p.translatedAddr}` : ""}
          </span>
        ) : (
          <span className={styles.small}>-</span>
        ),
    },
    {
      key: "destTranslation",
      header: "Dest Translation",
      render: (p) =>
        p.natType === "destination" ? (
          <span className={styles.small}>
            {p.translatedAddr}
            {p.destPort ? `:${p.destPort}` : ""}
          </span>
        ) : (
          <span className={styles.small}>-</span>
        ),
    },
    {
      key: "enabled",
      header: "Enabled",
      render: (p) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Toggle checked={!p.disabled} onChange={() => dispatch({ type: "TOGGLE_NAT_POLICY", id: p.id })} />
        </span>
      ),
    },
    {
      key: "reorder",
      header: "Order",
      render: (p) => {
        const idx = state.natPolicies.findIndex((x) => x.id === p.id);
        return (
          <ReorderCell
            isFirst={idx <= 0}
            isLast={idx === state.natPolicies.length - 1}
            onUp={() => dispatch({ type: "REORDER_NAT_POLICY", id: p.id, direction: "up" })}
            onDown={() => dispatch({ type: "REORDER_NAT_POLICY", id: p.id, direction: "down" })}
          />
        );
      },
    },
    {
      key: "rowActions",
      header: "",
      render: (p) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Policies &mdash; NAT</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew(true)}>
          + Create new rule
        </button>
        <div className={styles.small}>
          {state.natPolicies.length} rule{state.natPolicies.length === 1 ? "" : "s"} &mdash; row order is the real top-to-bottom evaluation
          order.
        </div>
      </div>

      {/* No client-side sort: rows render in state.natPolicies array order,
          which IS PAN-OS's real top-to-bottom NAT rulebase evaluation order. */}
      <DataTable
        columns={columns}
        rows={state.natPolicies}
        getRowKey={(p) => String(p.id)}
        onRowClick={(p) => setSelected(p)}
        emptyMessage="No NAT rules configured."
      />

      {showNew ? <NewNatPolicyModal state={state} dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}

      {selected ? <NatPolicyDetailFlyout policy={selected} state={state} dispatch={dispatch} onClose={() => setSelected(null)} /> : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete NAT Rule"
          itemLabel={`${pendingDelete.name} (ID ${pendingDelete.id})`}
          onConfirm={() => {
            dispatch({ type: "DELETE_NAT_POLICY", id: pendingDelete.id });
            toast.success("NAT rule deleted");
            if (selected?.id === pendingDelete.id) setSelected(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 3. Decryption Policies
// ===================================================================

type DecryptionFormState = {
  name: string;
  description: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  service: string;
  urlCat: string;
  action: "decrypt" | "no-decrypt";
  type: string;
  profile: string;
};

function blankDecryptionForm(): DecryptionFormState {
  return {
    name: "",
    description: "",
    srcZone: "trust",
    dstZone: "untrust",
    srcAddr: "any",
    dstAddr: "any",
    service: "service-https",
    urlCat: "any",
    action: "decrypt",
    type: "ssl-forward-proxy",
    profile: "",
  };
}

function decryptionToForm(p: PaloDecryptionPolicy): DecryptionFormState {
  return {
    name: p.name,
    description: p.description,
    srcZone: p.srcZone,
    dstZone: p.dstZone,
    srcAddr: p.srcAddr,
    dstAddr: p.dstAddr,
    service: p.service,
    urlCat: p.urlCat,
    action: p.action,
    type: p.type,
    profile: p.profile,
  };
}

const DECRYPTION_TYPE_OPTIONS = [
  { value: "ssl-forward-proxy", label: "SSL Forward Proxy" },
  { value: "ssl-inbound-inspection", label: "SSL Inbound Inspection" },
  { value: "ssh-proxy", label: "SSH Proxy" },
];

function DecryptionFormFields({
  form,
  setForm,
  state,
}: {
  form: DecryptionFormState;
  setForm: (updater: (prev: DecryptionFormState) => DecryptionFormState) => void;
  state: PaloState;
}) {
  const svcOpts = ["any", ...state.services.map((s) => s.name)].map((s) => ({ value: s, label: s }));

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>General</legend>
        <Field label="Name" required>
          <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>
        <Field label="Description">
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Source / Destination</legend>
        <Field label="Source Zone">
          <NativeSelect value={form.srcZone} onChange={(v) => setForm((prev) => ({ ...prev, srcZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Source Address">
          <NativeSelect value={form.srcAddr} onChange={(v) => setForm((prev) => ({ ...prev, srcAddr: v }))} options={addrOptions(state)} />
        </Field>
        <Field label="Destination Zone">
          <NativeSelect value={form.dstZone} onChange={(v) => setForm((prev) => ({ ...prev, dstZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Destination Address">
          <NativeSelect value={form.dstAddr} onChange={(v) => setForm((prev) => ({ ...prev, dstAddr: v }))} options={addrOptions(state)} />
        </Field>
        <Field label="Service">
          <NativeSelect value={form.service} onChange={(v) => setForm((prev) => ({ ...prev, service: v }))} options={svcOpts} />
        </Field>
        <Field label="URL Category">
          <NativeSelect value={form.urlCat} onChange={(v) => setForm((prev) => ({ ...prev, urlCat: v }))} options={urlCatOptions()} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Options</legend>
        <Field label="Action">
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="dr_action"
                checked={form.action === "decrypt"}
                onChange={() => setForm((prev) => ({ ...prev, action: "decrypt" }))}
              />
              Decrypt
            </label>
            <label>
              <input
                type="radio"
                name="dr_action"
                checked={form.action === "no-decrypt"}
                onChange={() => setForm((prev) => ({ ...prev, action: "no-decrypt" }))}
              />
              No-Decrypt
            </label>
          </div>
        </Field>
        <Field label="Type">
          <NativeSelect value={form.type} onChange={(v) => setForm((prev) => ({ ...prev, type: v }))} options={DECRYPTION_TYPE_OPTIONS} />
        </Field>
        <Field label="Decryption Profile">
          <NativeSelect
            value={form.profile}
            onChange={(v) => setForm((prev) => ({ ...prev, profile: v }))}
            options={[
              { value: "", label: "None" },
              { value: "default-decrypt", label: "default-decrypt" },
            ]}
          />
        </Field>
      </fieldset>
    </>
  );
}

function NewDecryptionPolicyModal({ state, dispatch, onClose }: { state: PaloState; dispatch: Dispatch; onClose: () => void }) {
  const [form, setForm] = useState<DecryptionFormState>(blankDecryptionForm);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const policy: Omit<PaloDecryptionPolicy, "id"> = {
      name,
      srcZone: form.srcZone,
      dstZone: form.dstZone,
      srcAddr: form.srcAddr,
      dstAddr: form.dstAddr,
      service: form.service,
      urlCat: form.urlCat.trim() || "any",
      action: form.action,
      type: form.type,
      profile: form.profile,
      description: form.description.trim(),
    };
    dispatch({ type: "ADD_DECRYPTION_POLICY", policy });
    toast.success("Decryption rule created");
    onClose();
  }

  return (
    <Modal
      title="New Decryption Rule"
      onClose={onClose}
      width="780px"
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
      <DecryptionFormFields form={form} setForm={setForm} state={state} />
    </Modal>
  );
}

function DecryptionPolicyDetailFlyout({
  policy,
  state,
  dispatch,
  onClose,
}: {
  policy: PaloDecryptionPolicy;
  state: PaloState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DecryptionFormState>(() => decryptionToForm(policy));

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({
      type: "UPDATE_DECRYPTION_POLICY",
      id: policy.id,
      patch: {
        name,
        srcZone: form.srcZone,
        dstZone: form.dstZone,
        srcAddr: form.srcAddr,
        dstAddr: form.dstAddr,
        service: form.service,
        urlCat: form.urlCat.trim() || "any",
        action: form.action,
        type: form.type,
        profile: form.profile,
        description: form.description.trim(),
      },
    });
    toast.success("Decryption rule saved");
    onClose();
  }

  return (
    <Flyout
      title={`Edit Decryption Rule — ${policy.name} (ID ${policy.id})`}
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
      <DecryptionFormFields form={form} setForm={setForm} state={state} />
    </Flyout>
  );
}

export function DecryptionPoliciesPage({ state, dispatch }: PageProps) {
  const [selected, setSelected] = useState<PaloDecryptionPolicy | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaloDecryptionPolicy | null>(null);

  const columns: DataTableColumn<PaloDecryptionPolicy>[] = [
    { key: "id", header: "#", render: (p) => p.id, width: "40px" },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <>
          <b>{p.name}</b>
          {p.description ? <div className={styles.small}>{p.description}</div> : null}
        </>
      ),
    },
    {
      key: "zones",
      header: "Zone",
      render: (p) => (
        <span className={styles.mono}>
          {p.srcZone} &rarr; {p.dstZone}
        </span>
      ),
    },
    { key: "srcAddr", header: "Source", render: (p) => p.srcAddr },
    { key: "dstAddr", header: "Destination", render: (p) => p.dstAddr },
    { key: "service", header: "Service", render: (p) => p.service },
    { key: "urlCat", header: "URL Category", render: (p) => p.urlCat },
    {
      key: "action",
      header: "Action",
      render: (p) => <StatusPill tone={p.action === "decrypt" ? "up" : "warn"}>{p.action}</StatusPill>,
    },
    { key: "type", header: "Type", render: (p) => p.type },
    { key: "profile", header: "Profile", render: (p) => (p.profile ? p.profile : <span className={styles.small}>none</span>) },
    {
      key: "toggle",
      header: "Decrypt",
      render: (p) => (
        // TOGGLE_DECRYPTION_POLICY flips action between decrypt/no-decrypt
        // (PaloDecryptionPolicy has no `disabled` field) — verified against
        // reducer.ts's actual implementation.
        <span onClick={(e) => e.stopPropagation()}>
          <Toggle checked={p.action === "decrypt"} onChange={() => dispatch({ type: "TOGGLE_DECRYPTION_POLICY", id: p.id })} />
        </span>
      ),
    },
    {
      key: "reorder",
      header: "Order",
      render: (p) => {
        const idx = state.decryptionPolicies.findIndex((x) => x.id === p.id);
        return (
          <ReorderCell
            isFirst={idx <= 0}
            isLast={idx === state.decryptionPolicies.length - 1}
            onUp={() => dispatch({ type: "REORDER_DECRYPTION_POLICY", id: p.id, direction: "up" })}
            onDown={() => dispatch({ type: "REORDER_DECRYPTION_POLICY", id: p.id, direction: "down" })}
          />
        );
      },
    },
    {
      key: "rowActions",
      header: "",
      render: (p) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Policies &mdash; Decryption</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew(true)}>
          + Create new rule
        </button>
        <div className={styles.small}>
          {state.decryptionPolicies.length} rule{state.decryptionPolicies.length === 1 ? "" : "s"} &mdash; row order is the real
          top-to-bottom evaluation order.
        </div>
      </div>

      {/* No client-side sort: rows render in state.decryptionPolicies array
          order, which IS PAN-OS's real top-to-bottom SSL decryption rulebase
          evaluation order. */}
      <DataTable
        columns={columns}
        rows={state.decryptionPolicies}
        getRowKey={(p) => String(p.id)}
        onRowClick={(p) => setSelected(p)}
        emptyMessage="No decryption rules configured."
      />

      {showNew ? <NewDecryptionPolicyModal state={state} dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}

      {selected ? (
        <DecryptionPolicyDetailFlyout policy={selected} state={state} dispatch={dispatch} onClose={() => setSelected(null)} />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete Decryption Rule"
          itemLabel={`${pendingDelete.name} (ID ${pendingDelete.id})`}
          onConfirm={() => {
            dispatch({ type: "DELETE_DECRYPTION_POLICY", id: pendingDelete.id });
            toast.success("Decryption rule deleted");
            if (selected?.id === pendingDelete.id) setSelected(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

// ===================================================================
// 4. Authentication Policies
// ===================================================================
//
// Source's Authentication page (PAGES['pol-auth']) is READ-ONLY — no create/
// edit/delete handler anywhere in source. Per the brief's requirement that
// every policy type here get full genuinely-wired CRUD + reorder + toggle,
// matching the FortiGate port's `FirewallPoliciesPage` convention, this page
// gets the same real CRUD treatment as an intentional improvement over
// source's half-wired page.

type AuthFormState = {
  name: string;
  description: string;
  srcZone: string;
  dstZone: string;
  srcAddr: string;
  dstAddr: string;
  service: string;
  urlCat: string;
  authProfile: string;
  timeout: number;
};

function blankAuthForm(): AuthFormState {
  return {
    name: "",
    description: "",
    srcZone: "trust",
    dstZone: "untrust",
    srcAddr: "any",
    dstAddr: "any",
    service: "any",
    urlCat: "any",
    authProfile: "",
    timeout: 60,
  };
}

function authToForm(p: PaloAuthPolicy): AuthFormState {
  return {
    name: p.name,
    description: p.description,
    srcZone: p.srcZone,
    dstZone: p.dstZone,
    srcAddr: p.srcAddr,
    dstAddr: p.dstAddr,
    service: p.service,
    urlCat: p.urlCat,
    authProfile: p.authProfile,
    timeout: p.timeout,
  };
}

function AuthFormFields({
  form,
  setForm,
  state,
}: {
  form: AuthFormState;
  setForm: (updater: (prev: AuthFormState) => AuthFormState) => void;
  state: PaloState;
}) {
  const svcOpts = ["any", ...state.services.map((s) => s.name)].map((s) => ({ value: s, label: s }));
  const authProfileOpts = [{ value: "", label: "(none)" }, ...state.authProfiles.map((a) => ({ value: a.name, label: a.name }))];

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>General</legend>
        <Field label="Name" required>
          <input className={styles.input} type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>
        <Field label="Description">
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Source / Destination</legend>
        <Field label="Source Zone">
          <NativeSelect value={form.srcZone} onChange={(v) => setForm((prev) => ({ ...prev, srcZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Source Address">
          <NativeSelect value={form.srcAddr} onChange={(v) => setForm((prev) => ({ ...prev, srcAddr: v }))} options={addrOptions(state)} />
        </Field>
        <Field label="Destination Zone">
          <NativeSelect value={form.dstZone} onChange={(v) => setForm((prev) => ({ ...prev, dstZone: v }))} options={zoneOptions(state)} />
        </Field>
        <Field label="Destination Address">
          <NativeSelect value={form.dstAddr} onChange={(v) => setForm((prev) => ({ ...prev, dstAddr: v }))} options={addrOptions(state)} />
        </Field>
        <Field label="Service">
          <NativeSelect value={form.service} onChange={(v) => setForm((prev) => ({ ...prev, service: v }))} options={svcOpts} />
        </Field>
        <Field label="URL Category">
          <NativeSelect value={form.urlCat} onChange={(v) => setForm((prev) => ({ ...prev, urlCat: v }))} options={urlCatOptions()} />
        </Field>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Authentication Enforcement</legend>
        <Field label="Authentication Profile">
          <NativeSelect value={form.authProfile} onChange={(v) => setForm((prev) => ({ ...prev, authProfile: v }))} options={authProfileOpts} />
        </Field>
        <Field label="Timeout (minutes)" help="Captive-portal auth timeout; 0 = disabled">
          <input
            className={styles.input}
            type="number"
            min={0}
            value={form.timeout}
            onChange={(e) => setForm((prev) => ({ ...prev, timeout: Math.max(0, Number(e.target.value) || 0) }))}
          />
        </Field>
      </fieldset>
    </>
  );
}

function NewAuthPolicyModal({ state, dispatch, onClose }: { state: PaloState; dispatch: Dispatch; onClose: () => void }) {
  const [form, setForm] = useState<AuthFormState>(blankAuthForm);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const policy: Omit<PaloAuthPolicy, "id"> = {
      name,
      srcZone: form.srcZone,
      dstZone: form.dstZone,
      srcAddr: form.srcAddr,
      dstAddr: form.dstAddr,
      service: form.service,
      urlCat: form.urlCat.trim() || "any",
      authProfile: form.authProfile,
      timeout: form.timeout,
      description: form.description.trim(),
    };
    dispatch({ type: "ADD_AUTH_POLICY", policy });
    toast.success("Authentication rule created");
    onClose();
  }

  return (
    <Modal
      title="New Authentication Rule"
      onClose={onClose}
      width="780px"
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
      <AuthFormFields form={form} setForm={setForm} state={state} />
    </Modal>
  );
}

function AuthPolicyDetailFlyout({
  policy,
  state,
  dispatch,
  onClose,
}: {
  policy: PaloAuthPolicy;
  state: PaloState;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AuthFormState>(() => authToForm(policy));

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    dispatch({
      type: "UPDATE_AUTH_POLICY",
      id: policy.id,
      patch: {
        name,
        srcZone: form.srcZone,
        dstZone: form.dstZone,
        srcAddr: form.srcAddr,
        dstAddr: form.dstAddr,
        service: form.service,
        urlCat: form.urlCat.trim() || "any",
        authProfile: form.authProfile,
        timeout: form.timeout,
        description: form.description.trim(),
      },
    });
    toast.success("Authentication rule saved");
    onClose();
  }

  return (
    <Flyout
      title={`Edit Authentication Rule — ${policy.name} (ID ${policy.id})`}
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
      <AuthFormFields form={form} setForm={setForm} state={state} />
    </Flyout>
  );
}

export function AuthPoliciesPage({ state, dispatch }: PageProps) {
  const [selected, setSelected] = useState<PaloAuthPolicy | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaloAuthPolicy | null>(null);

  const columns: DataTableColumn<PaloAuthPolicy>[] = [
    { key: "id", header: "#", render: (p) => p.id, width: "40px" },
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <>
          <b>{p.name}</b>
          {p.description ? <div className={styles.small}>{p.description}</div> : null}
        </>
      ),
    },
    {
      key: "zones",
      header: "Zone",
      render: (p) => (
        <span className={styles.mono}>
          {p.srcZone} &rarr; {p.dstZone}
        </span>
      ),
    },
    { key: "srcAddr", header: "Source", render: (p) => p.srcAddr },
    { key: "dstAddr", header: "Destination", render: (p) => p.dstAddr },
    { key: "service", header: "Service", render: (p) => p.service },
    { key: "urlCat", header: "URL Category", render: (p) => p.urlCat },
    { key: "authProfile", header: "Auth Profile", render: (p) => (p.authProfile ? p.authProfile : <span className={styles.small}>none</span>) },
    { key: "timeout", header: "Timeout", render: (p) => `${p.timeout} min` },
    {
      key: "toggle",
      header: "Enforced",
      render: (p) => (
        // TOGGLE_AUTH_POLICY flips timeout between 0 and 60 (PaloAuthPolicy has
        // no `disabled` field) — verified against reducer.ts's actual
        // implementation. timeout === 0 reads as "not enforced".
        <span onClick={(e) => e.stopPropagation()}>
          <Toggle checked={p.timeout !== 0} onChange={() => dispatch({ type: "TOGGLE_AUTH_POLICY", id: p.id })} />
        </span>
      ),
    },
    {
      key: "reorder",
      header: "Order",
      render: (p) => {
        const idx = state.authPolicies.findIndex((x) => x.id === p.id);
        return (
          <ReorderCell
            isFirst={idx <= 0}
            isLast={idx === state.authPolicies.length - 1}
            onUp={() => dispatch({ type: "REORDER_AUTH_POLICY", id: p.id, direction: "up" })}
            onDown={() => dispatch({ type: "REORDER_AUTH_POLICY", id: p.id, direction: "down" })}
          />
        );
      },
    },
    {
      key: "rowActions",
      header: "",
      render: (p) => (
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setPendingDelete(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Policies &mdash; Authentication</h2>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew(true)}>
          + Create new rule
        </button>
        <div className={styles.small}>
          {state.authPolicies.length} rule{state.authPolicies.length === 1 ? "" : "s"} &mdash; row order is the real top-to-bottom
          evaluation order.
        </div>
      </div>

      {/* No client-side sort: rows render in state.authPolicies array order,
          which IS PAN-OS's real top-to-bottom authentication rulebase
          evaluation order. */}
      <DataTable
        columns={columns}
        rows={state.authPolicies}
        getRowKey={(p) => String(p.id)}
        onRowClick={(p) => setSelected(p)}
        emptyMessage="No authentication rules configured."
      />

      {showNew ? <NewAuthPolicyModal state={state} dispatch={dispatch} onClose={() => setShowNew(false)} /> : null}

      {selected ? <AuthPolicyDetailFlyout policy={selected} state={state} dispatch={dispatch} onClose={() => setSelected(null)} /> : null}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete Authentication Rule"
          itemLabel={`${pendingDelete.name} (ID ${pendingDelete.id})`}
          onConfirm={() => {
            dispatch({ type: "DELETE_AUTH_POLICY", id: pendingDelete.id });
            toast.success("Authentication rule deleted");
            if (selected?.id === pendingDelete.id) setSelected(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
