"use client";

// Security nav-group pages for the Cisco IOS WebUI simulator. Ported from
// itbd-lab/simulators/network/js/cisco-ui.js:
//   - P['sec-acl']                  (lines 845-862)  -> AclsPage (list)
//   - CU._editAcl/_addAce/_delAce   (lines 2945-2998) -> AclsPage (rule flyout)
//   - CU._addAcl/_saveNewAcl        (lines 2922-2944) -> AclsPage (create ACL)
//   - P['rt-nat']                   (lines 772-796)   -> NatPage (config + static entries)
//   - P['rt-nat-trans']             (lines 798-809)   -> NatPage (live translations table)
//   - CU._addNatStatic/_delNatStatic (lines 3021-3038) -> NatPage (static-entry CRUD)
//   - P['sec-aaa']                  (lines 948-974)   -> AaaPage (read-only)
//   - Local users (no direct source page; router-user-accounts CRUD a real
//     Additional Tasks > Router Access page needs) -> LocalUsersPage
//   - P['sec-pki']                  (lines 976-987)   -> CertificatesPage (read-only)
//   - P['sec-ips']                  (lines 932-946)   -> IpsPage (read-only summary)
//
// Reducer coverage: ACL/ACL-rule CRUD, NAT static-entry CRUD + config patch,
// and local-user CRUD all have real actions (ADD_ACL/UPDATE_ACL/DELETE_ACL,
// ADD_ACL_RULE/UPDATE_ACL_RULE/DELETE_ACL_RULE, ADD_NAT_STATIC_ENTRY/
// DELETE_NAT_STATIC_ENTRY/UPDATE_NAT_CONFIG, ADD_LOCAL_USER/DELETE_LOCAL_USER)
// — see reducer.ts. AAA, certificates, and IPS have NO mutation call-site in
// source (source's own "Update Signatures Now" button on sec-ips is a
// decorative toast-only no-op, cisco-ui.js:944) and no reducer action exists
// for them, so per the porting brief they're rendered as real read-only views
// over real seeded state rather than inventing new actions.
//
// All confirmations use `sonner` toasts; deletes are confirmed via a Modal
// (never window.confirm/prompt/alert), matching the
// management-monitoring-pages.tsx / vpn-services-pages.tsx convention
// already established in this suite.

import { useState } from "react";
import { toast } from "sonner";

import type { CiscoAction } from "@/lib/labs/simulators/network-cisco/reducer";
import type {
  CiscoAcl,
  CiscoAclRule,
  CiscoLocalUser,
  CiscoNatStaticEntry,
  CiscoState,
} from "@/lib/labs/simulators/network-cisco/types";
import { DataTable, type DataTableColumn, Field, Flyout, Modal, StatusPill, statusTone } from "./cisco-ui";
import styles from "./cisco-console.module.css";

type CiscoPageProps = { state: CiscoState; dispatch: React.Dispatch<CiscoAction> };

// ===================================================================
// 1. Access Control Lists — source P['sec-acl'] (list) + CU._editAcl/_addAce/
//    _delAce (rule detail, opened as a Modal in source; this port uses the
//    Flyout convention for per-item detail, matching every other ported
//    suite) + CU._addAcl/_saveNewAcl (create ACL).
// ===================================================================

const ACL_TYPE_OPTIONS: CiscoAcl["type"][] = ["extended", "standard"];
const ACL_RULE_ACTION_OPTIONS: CiscoAclRule["action"][] = ["permit", "deny"];
const ACL_RULE_PROTO_OPTIONS = ["ip", "tcp", "udp", "icmp", ""];

function nextAclRuleSeq(acl: CiscoAcl): number {
  const lastSeq = acl.rules.length ? acl.rules[acl.rules.length - 1]!.seq : 0;
  return lastSeq + 10;
}

function emptyAclRuleDraft(seq: number): CiscoAclRule {
  return { seq, action: "permit", proto: "ip", src: "any", srcWc: "", dst: "any", dstWc: "", op: "", port: "", log: false, hits: 0 };
}

function AclRuleForm({ draft, onChange }: { draft: CiscoAclRule; onChange: (patch: Partial<CiscoAclRule>) => void }) {
  return (
    <div className={styles.form}>
      <Field label="Action">
        <select className={styles.select} value={draft.action} onChange={(e) => onChange({ action: e.target.value as CiscoAclRule["action"] })}>
          {ACL_RULE_ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Protocol">
        <select className={styles.select} value={draft.proto} onChange={(e) => onChange({ proto: e.target.value })}>
          {ACL_RULE_PROTO_OPTIONS.map((p) => (
            <option key={p || "(none)"} value={p}>
              {p || "(none)"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Source" help="e.g. 10.10.0.0 or any">
        <input className={styles.input} value={draft.src} onChange={(e) => onChange({ src: e.target.value })} placeholder="any" />
      </Field>
      <Field label="Source wildcard" help="e.g. 0.0.0.255">
        <input className={styles.input} value={draft.srcWc} onChange={(e) => onChange({ srcWc: e.target.value })} placeholder="0.0.0.255" />
      </Field>
      <Field label="Destination" help="e.g. any or host 10.10.0.5">
        <input className={styles.input} value={draft.dst} onChange={(e) => onChange({ dst: e.target.value })} placeholder="any" />
      </Field>
      <Field label="Destination wildcard">
        <input className={styles.input} value={draft.dstWc} onChange={(e) => onChange({ dstWc: e.target.value })} placeholder="0.0.0.255" />
      </Field>
      <Field label="Operator" help="e.g. eq">
        <input className={styles.input} value={draft.op} onChange={(e) => onChange({ op: e.target.value })} placeholder="eq" />
      </Field>
      <Field label="Port" help="e.g. 443">
        <input className={styles.input} value={draft.port} onChange={(e) => onChange({ port: e.target.value })} placeholder="443" />
      </Field>
      <Field label="Remark" help="Optional comment for this rule">
        <input className={styles.input} value={draft.remark ?? ""} onChange={(e) => onChange({ remark: e.target.value || undefined })} />
      </Field>
      <Field label="Log matches">
        <label className={styles.checkrow} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={draft.log} onChange={(e) => onChange({ log: e.target.checked })} />
          <span>log</span>
        </label>
      </Field>
    </div>
  );
}

function AddAclRuleModal({ acl, onClose, dispatch }: { acl: CiscoAcl; onClose: () => void; dispatch: React.Dispatch<CiscoAction> }) {
  const [draft, setDraft] = useState<CiscoAclRule>(() => emptyAclRuleDraft(nextAclRuleSeq(acl)));

  function handleSubmit() {
    if (!draft.src.trim()) {
      toast.error("Enter a source");
      return;
    }
    dispatch({ type: "ADD_ACL_RULE", aclNumber: acl.number, rule: draft });
    toast.success(`Rule added to ACL ${acl.name || acl.number}`);
    onClose();
  }

  return (
    <Modal
      title={`Add rule – ACL ${acl.name || acl.number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Add rule
          </button>
        </>
      }
    >
      <AclRuleForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function EditAclRuleModal({
  acl,
  rule,
  onClose,
  dispatch,
}: {
  acl: CiscoAcl;
  rule: CiscoAclRule;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [draft, setDraft] = useState<CiscoAclRule>(rule);

  function handleSubmit() {
    if (!draft.src.trim()) {
      toast.error("Enter a source");
      return;
    }
    dispatch({ type: "UPDATE_ACL_RULE", aclNumber: acl.number, seq: rule.seq, patch: draft });
    toast.success(`Rule ${rule.seq} updated`);
    onClose();
  }

  return (
    <Modal
      title={`Edit rule ${rule.seq} – ACL ${acl.name || acl.number}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Save changes
          </button>
        </>
      }
    >
      <AclRuleForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function DeleteAclRuleModal({
  acl,
  rule,
  onClose,
  dispatch,
}: {
  acl: CiscoAcl;
  rule: CiscoAclRule;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_ACL_RULE", aclNumber: acl.number, seq: rule.seq });
    toast.success(`Rule ${rule.seq} removed`);
    onClose();
  }

  return (
    <Modal
      title="Remove rule"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Remove
          </button>
        </>
      }
    >
      <p>
        Remove rule <b>{rule.seq}</b> ({rule.action} {rule.proto || "ip"}) from ACL <b>{acl.name || acl.number}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

function emptyAclDraft(): { nameOrNumber: string; type: CiscoAcl["type"] } {
  return { nameOrNumber: "", type: "extended" };
}

function AddAclModal({
  existingNumbers,
  onClose,
  dispatch,
}: {
  existingNumbers: number[];
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [draft, setDraft] = useState(emptyAclDraft());

  function handleSubmit() {
    const raw = draft.nameOrNumber.trim();
    if (!raw) {
      toast.error("Enter a number or name for the new ACL");
      return;
    }
    const parsed = Number(raw);
    const isNumbered = Number.isFinite(parsed) && raw === String(parsed);
    const number = isNumbered ? parsed : Math.max(200, ...existingNumbers, 199) + 1;
    if (existingNumbers.includes(number)) {
      toast.error(`ACL ${number} already exists`);
      return;
    }
    dispatch({
      type: "ADD_ACL",
      acl: { number, name: isNumbered ? "" : raw, type: draft.type, bound: "", rules: [] },
    });
    toast.success(`ACL ${raw} created`);
    onClose();
  }

  return (
    <Modal
      title="Create ACL"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Create
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Number / Name" help="Numbered standard 1-99 · numbered extended 100-199 · or a named ACL">
          <input
            className={styles.input}
            value={draft.nameOrNumber}
            onChange={(e) => setDraft((prev) => ({ ...prev, nameOrNumber: e.target.value }))}
            placeholder="100 or MGMT-IN"
          />
        </Field>
        <Field label="Type">
          <select className={styles.select} value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value as CiscoAcl["type"] }))}>
            {ACL_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function DeleteAclModal({ acl, onClose, dispatch }: { acl: CiscoAcl; onClose: () => void; dispatch: React.Dispatch<CiscoAction> }) {
  function handleConfirm() {
    dispatch({ type: "DELETE_ACL", number: acl.number });
    toast.success(`ACL ${acl.name || acl.number} deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete ACL"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Delete
          </button>
        </>
      }
    >
      <p>
        Delete ACL <b>{acl.name || acl.number}</b> and all {acl.rules.length} rule(s)? {acl.bound ? `It is currently bound to ${acl.bound}. ` : ""}
        This cannot be undone.
      </p>
    </Modal>
  );
}

function AclRulesFlyout({
  acl,
  onClose,
  dispatch,
}: {
  acl: CiscoAcl;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [showAddRule, setShowAddRule] = useState(false);
  const [editRule, setEditRule] = useState<CiscoAclRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<CiscoAclRule | null>(null);

  const columns: DataTableColumn<CiscoAclRule>[] = [
    { key: "seq", header: "Seq", render: (r) => r.seq },
    { key: "action", header: "Action", render: (r) => <StatusPill tone={r.action === "permit" ? "up" : "down"}>{r.action}</StatusPill> },
    { key: "proto", header: "Proto", render: (r) => r.proto || "-" },
    {
      key: "src",
      header: "Source",
      render: (r) => (
        <span className={styles.mono}>
          {r.src || "-"}
          {r.srcWc ? ` ${r.srcWc}` : ""}
        </span>
      ),
    },
    {
      key: "dst",
      header: "Destination",
      render: (r) => (
        <span className={styles.mono}>
          {r.dst || "-"}
          {r.dstWc ? ` ${r.dstWc}` : ""}
        </span>
      ),
    },
    {
      key: "port",
      header: "Op / Port",
      render: (r) => (r.op && r.port ? `${r.op} ${r.port}` : "-"),
    },
    { key: "log", header: "Log", render: (r) => (r.log ? <StatusPill tone="warn">log</StatusPill> : "-") },
    { key: "hits", header: "Hits", render: (r) => r.hits.toLocaleString() },
    { key: "remark", header: "Remark", render: (r) => r.remark ?? "-" },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className={styles.flex}>
          <button type="button" className={styles.btnSm} onClick={() => setEditRule(r)}>
            Edit
          </button>
          <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteRule(r)}>
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Flyout title={`ACL ${acl.name || acl.number} — ${acl.type}`} onClose={onClose}>
        <dl className={styles.kv}>
          <dt>Type</dt>
          <dd>{acl.type}</dd>
          <dt>Bound to</dt>
          <dd>{acl.bound || <i>not bound</i>}</dd>
          <dt>Rules</dt>
          <dd>{acl.rules.length}</dd>
        </dl>
        <div className={styles.toolbar}>
          <div className={styles.toolbarSpacer} />
          <button type="button" className={styles.btn} onClick={() => setShowAddRule(true)}>
            + Add rule
          </button>
        </div>
        <DataTable columns={columns} rows={acl.rules} getRowKey={(r) => String(r.seq)} emptyMessage="No rules in this ACL." dense />
      </Flyout>
      {showAddRule ? <AddAclRuleModal acl={acl} onClose={() => setShowAddRule(false)} dispatch={dispatch} /> : null}
      {editRule ? <EditAclRuleModal acl={acl} rule={editRule} onClose={() => setEditRule(null)} dispatch={dispatch} /> : null}
      {deleteRule ? <DeleteAclRuleModal acl={acl} rule={deleteRule} onClose={() => setDeleteRule(null)} dispatch={dispatch} /> : null}
    </>
  );
}

export function AclsPage({ state, dispatch }: CiscoPageProps) {
  const [openAcl, setOpenAcl] = useState<number | null>(null);
  const [showAddAcl, setShowAddAcl] = useState(false);
  const [deleteAcl, setDeleteAcl] = useState<CiscoAcl | null>(null);

  const columns: DataTableColumn<CiscoAcl>[] = [
    { key: "number", header: "Number", render: (a) => <b>{a.number}</b> },
    { key: "name", header: "Name", render: (a) => a.name || "-" },
    { key: "type", header: "Type", render: (a) => a.type },
    { key: "bound", header: "Bound to", render: (a) => a.bound || <i>not bound</i> },
    { key: "rules", header: "Rules", render: (a) => a.rules.length },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <button
          type="button"
          className={`${styles.btnSm} ${styles.btnDanger}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteAcl(a);
          }}
        >
          Delete
        </button>
      ),
    },
  ];

  const activeAcl = openAcl != null ? state.acls.find((a) => a.number === openAcl) ?? null : null;

  return (
    <div>
      <h1 className={styles.pageH}>Access Control Lists</h1>
      <div className={styles.toolbar}>
        <span className={styles.small}>Numbered standard 1-99 · numbered extended 100-199 · named ACL via UI</span>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={styles.btn} onClick={() => setShowAddAcl(true)}>
          + Add ACL
        </button>
      </div>
      <div className={styles.card}>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.acls} getRowKey={(a) => String(a.number)} onRowClick={(a) => setOpenAcl(a.number)} emptyMessage="No ACLs configured." />
        </div>
      </div>

      {activeAcl ? <AclRulesFlyout acl={activeAcl} onClose={() => setOpenAcl(null)} dispatch={dispatch} /> : null}
      {showAddAcl ? <AddAclModal existingNumbers={state.acls.map((a) => a.number)} onClose={() => setShowAddAcl(false)} dispatch={dispatch} /> : null}
      {deleteAcl ? <DeleteAclModal acl={deleteAcl} onClose={() => setDeleteAcl(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 2. NAT — source P['rt-nat'] (config + static entries) + P['rt-nat-trans']
//    (live translations table) + CU._addNatStatic/_delNatStatic (static
//    entry CRUD, prompt()-based in source; this port uses a real Modal form).
// ===================================================================

const NAT_STATIC_TYPE_OPTIONS: CiscoNatStaticEntry["type"][] = ["static-tcp", "static"];

function emptyNatStaticDraft(): CiscoNatStaticEntry {
  return { type: "static-tcp", insideLocal: "", port: "", insideGlobal: "", globalPort: "", comment: "" };
}

function NatStaticEntryForm({
  draft,
  onChange,
}: {
  draft: CiscoNatStaticEntry;
  onChange: (patch: Partial<CiscoNatStaticEntry>) => void;
}) {
  const isTcp = draft.type === "static-tcp";
  return (
    <div className={styles.form}>
      <Field label="Type">
        <select
          className={styles.select}
          value={draft.type}
          onChange={(e) => onChange({ type: e.target.value as CiscoNatStaticEntry["type"] })}
        >
          {NAT_STATIC_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Inside local IP">
        <input className={styles.input} value={draft.insideLocal} onChange={(e) => onChange({ insideLocal: e.target.value })} placeholder="10.20.0.5" />
      </Field>
      {isTcp ? (
        <Field label="Inside local port">
          <input
            className={styles.input}
            value={String(draft.port)}
            onChange={(e) => onChange({ port: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="80"
          />
        </Field>
      ) : null}
      <Field label="Inside global IP">
        <input className={styles.input} value={draft.insideGlobal} onChange={(e) => onChange({ insideGlobal: e.target.value })} placeholder="203.0.113.10" />
      </Field>
      {isTcp ? (
        <Field label="Inside global port">
          <input
            className={styles.input}
            value={String(draft.globalPort)}
            onChange={(e) => onChange({ globalPort: e.target.value === "" ? "" : Number(e.target.value) })}
            placeholder="80"
          />
        </Field>
      ) : null}
      <Field label="Comment">
        <input className={styles.input} value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder="Public web server" />
      </Field>
    </div>
  );
}

function AddNatStaticEntryModal({ onClose, dispatch }: { onClose: () => void; dispatch: React.Dispatch<CiscoAction> }) {
  const [draft, setDraft] = useState<CiscoNatStaticEntry>(emptyNatStaticDraft());

  function handleSubmit() {
    if (!draft.insideLocal.trim() || !draft.insideGlobal.trim()) {
      toast.error("Inside local and inside global addresses are required");
      return;
    }
    dispatch({ type: "ADD_NAT_STATIC_ENTRY", entry: draft });
    toast.success("Static NAT entry added");
    onClose();
  }

  return (
    <Modal
      title="Add static NAT entry"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Add entry
          </button>
        </>
      }
    >
      <NatStaticEntryForm draft={draft} onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))} />
    </Modal>
  );
}

function DeleteNatStaticEntryModal({
  entry,
  index,
  onClose,
  dispatch,
}: {
  entry: CiscoNatStaticEntry;
  index: number;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_NAT_STATIC_ENTRY", index });
    toast.success("Static NAT entry removed");
    onClose();
  }

  return (
    <Modal
      title="Delete static NAT entry"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Delete
          </button>
        </>
      }
    >
      <p>
        Delete static NAT entry <b>{entry.insideLocal}</b> &#8594; <b>{entry.insideGlobal}</b>? This cannot be undone.
      </p>
    </Modal>
  );
}

function EditNatConfigModal({ state, onClose, dispatch }: { state: CiscoState; onClose: () => void; dispatch: React.Dispatch<CiscoAction> }) {
  const nat = state.nat;
  const [overload, setOverload] = useState(nat.overload);
  const [outsideInterface, setOutsideInterface] = useState(nat.outsideInterface);
  const [insideInterfaces, setInsideInterfaces] = useState(nat.insideInterfaces.join(", "));
  const [aclRef, setAclRef] = useState(String(nat.aclRef));

  function handleSubmit() {
    const parsedAclRef = Number(aclRef);
    if (!outsideInterface.trim()) {
      toast.error("Outside interface is required");
      return;
    }
    if (!Number.isFinite(parsedAclRef)) {
      toast.error("ACL reference must be a number");
      return;
    }
    dispatch({
      type: "UPDATE_NAT_CONFIG",
      patch: {
        overload,
        outsideInterface: outsideInterface.trim(),
        insideInterfaces: insideInterfaces
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        aclRef: parsedAclRef,
      },
    });
    toast.success("NAT configuration updated");
    onClose();
  }

  return (
    <Modal
      title="Edit NAT configuration"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Save changes
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Overload (PAT)">
          <label className={styles.checkrow} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={overload} onChange={(e) => setOverload(e.target.checked)} />
            <span>enabled</span>
          </label>
        </Field>
        <Field label="Outside interface">
          <select className={styles.select} value={outsideInterface} onChange={(e) => setOutsideInterface(e.target.value)}>
            {state.interfaces.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Inside interfaces" help="Comma-separated">
          <input className={styles.input} value={insideInterfaces} onChange={(e) => setInsideInterfaces(e.target.value)} />
        </Field>
        <Field label="ACL reference">
          <input className={styles.input} value={aclRef} onChange={(e) => setAclRef(e.target.value)} placeholder="1" />
        </Field>
      </div>
    </Modal>
  );
}

export function NatPage({ state, dispatch }: CiscoPageProps) {
  const nat = state.nat;
  const [showEditConfig, setShowEditConfig] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<{ entry: CiscoNatStaticEntry; index: number } | null>(null);

  const staticColumns: DataTableColumn<CiscoNatStaticEntry & { __index: number }>[] = [
    { key: "type", header: "Type", render: (s) => s.type },
    {
      key: "insideLocal",
      header: "Inside Local",
      render: (s) => (
        <span className={styles.mono}>
          {s.insideLocal}
          {s.port !== "" ? `:${s.port}` : ""}
        </span>
      ),
    },
    {
      key: "insideGlobal",
      header: "Inside Global",
      render: (s) => (
        <span className={styles.mono}>
          {s.insideGlobal}
          {s.globalPort !== "" ? `:${s.globalPort}` : ""}
        </span>
      ),
    },
    { key: "comment", header: "Comment", render: (s) => s.comment },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <button
          type="button"
          className={`${styles.btnSm} ${styles.btnDanger}`}
          onClick={() => setDeleteEntry({ entry: s, index: s.__index })}
        >
          Delete
        </button>
      ),
    },
  ];

  const translationColumns: DataTableColumn<CiscoState["nat"]["translations"][number]>[] = [
    { key: "proto", header: "Pro", render: (t) => t.proto },
    { key: "insideLocal", header: "Inside Local", render: (t) => <span className={styles.mono}>{t.insideLocal}</span> },
    { key: "insideGlobal", header: "Inside Global", render: (t) => <span className={styles.mono}>{t.insideGlobal}</span> },
    { key: "outsideLocal", header: "Outside Local", render: (t) => <span className={styles.mono}>{t.outsideLocal}</span> },
    { key: "outsideGlobal", header: "Outside Global", render: (t) => <span className={styles.mono}>{t.outsideGlobal}</span> },
  ];

  const staticRows = nat.staticEntries.map((s, index) => ({ ...s, __index: index }));

  return (
    <div>
      <h1 className={styles.pageH}>NAT (Source / Static)</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          PAT Overload (Source NAT)
          <button type="button" className={styles.btnSm} onClick={() => setShowEditConfig(true)}>
            Edit
          </button>
        </div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Overload</dt>
            <dd>{nat.overload ? <StatusPill tone="up">Enabled</StatusPill> : <StatusPill tone="down">Disabled</StatusPill>}</dd>
            <dt>Outside Interface</dt>
            <dd className={styles.mono}>{nat.outsideInterface}</dd>
            <dt>Inside Interfaces</dt>
            <dd className={styles.mono}>{nat.insideInterfaces.join(", ")}</dd>
            <dt>ACL Reference</dt>
            <dd>access-list {nat.aclRef}</dd>
          </dl>
          <div className={`${styles.console} ${styles.mt10}`}>
            ip nat inside source list {nat.aclRef} interface {nat.outsideInterface} overload
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          Static / Port-Forward Entries
          <button type="button" className={styles.btnSm} onClick={() => setShowAddEntry(true)}>
            + Add entry
          </button>
        </div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={staticColumns} rows={staticRows} getRowKey={(s) => String(s.__index)} emptyMessage="No static NAT entries configured." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>NAT Translations (Live)</div>
        <div className={styles.cardBody} style={{ paddingBottom: 0 }}>
          <div className={styles.small}>show ip nat translations</div>
        </div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable
            columns={translationColumns}
            rows={nat.translations}
            getRowKey={(t) => `${t.insideLocal}-${t.insideGlobal}`}
            emptyMessage="No active NAT translations."
          />
        </div>
      </div>

      {showEditConfig ? <EditNatConfigModal state={state} onClose={() => setShowEditConfig(false)} dispatch={dispatch} /> : null}
      {showAddEntry ? <AddNatStaticEntryModal onClose={() => setShowAddEntry(false)} dispatch={dispatch} /> : null}
      {deleteEntry ? (
        <DeleteNatStaticEntryModal entry={deleteEntry.entry} index={deleteEntry.index} onClose={() => setDeleteEntry(null)} dispatch={dispatch} />
      ) : null}
    </div>
  );
}

// ===================================================================
// 3. AAA — source P['sec-aaa']. Read-only: no reducer action exists for AAA
//    config edits (server/method-list mutation has no real call-site in
//    source either — sec-aaa never wired a save handler), so this renders
//    the genuine seeded state rather than inventing an action.
// ===================================================================

export function AaaPage({ state }: { state: CiscoState }) {
  const aaa = state.aaa;

  const radiusColumns: DataTableColumn<CiscoState["aaa"]["radiusServers"][number]>[] = [
    { key: "name", header: "Name", render: (s) => s.name },
    { key: "address", header: "Address", render: (s) => <span className={styles.mono}>{s.address}</span> },
    { key: "port", header: "Port", render: (s) => s.port },
    { key: "timeout", header: "Timeout", render: (s) => `${s.timeout}s` },
    { key: "status", header: "State", render: (s) => <StatusPill tone={statusTone(s.status === "reachable" ? "up" : "down")}>{s.status}</StatusPill> },
  ];

  const tacacsColumns: DataTableColumn<CiscoState["aaa"]["tacacsServers"][number]>[] = [
    { key: "name", header: "Name", render: (s) => s.name },
    { key: "address", header: "Address", render: (s) => <span className={styles.mono}>{s.address}</span> },
    { key: "port", header: "Port", render: (s) => s.port },
    { key: "timeout", header: "Timeout", render: (s) => `${s.timeout}s` },
    {
      key: "singleConn",
      header: "Single-Conn",
      render: (s) => (s.singleConn ? <StatusPill tone="up">yes</StatusPill> : <StatusPill tone="muted">no</StatusPill>),
    },
    { key: "status", header: "State", render: (s) => <StatusPill tone={statusTone(s.status === "reachable" ? "up" : "down")}>{s.status}</StatusPill> },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>AAA</h1>

      <div className={styles.card}>
        <div className={styles.cardHeader}>AAA Model</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Enabled</dt>
            <dd>
              <StatusPill tone="up">{aaa.enabled ? `aaa ${aaa.model}` : "disabled"}</StatusPill>
            </dd>
            <dt>Login</dt>
            <dd className={styles.mono}>{aaa.methods.login.join(", ")}</dd>
            <dt>Enable</dt>
            <dd className={styles.mono}>{aaa.methods.enable.join(", ")}</dd>
            <dt>Exec</dt>
            <dd className={styles.mono}>{aaa.methods.exec.join(", ")}</dd>
            <dt>Commands</dt>
            <dd className={styles.mono}>
              {Object.entries(aaa.methods.commands)
                .map(([level, methods]) => `priv ${level}: ${methods.join(", ")}`)
                .join(" · ") || "-"}
            </dd>
            <dt>Accounting</dt>
            <dd>{aaa.accounting}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>TACACS+ Servers</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={tacacsColumns} rows={aaa.tacacsServers} getRowKey={(s) => s.name} emptyMessage="No TACACS+ servers configured." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>RADIUS Servers</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={radiusColumns} rows={aaa.radiusServers} getRowKey={(s) => s.name} emptyMessage="No RADIUS servers configured." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 4. Local users — no direct source page (source only ever seeds
//    `CiscoData.state.localUsers`, no sec-* leaf renders it); real router
//    user-account CRUD an Additional Tasks > Router Access page needs, and
//    ADD_LOCAL_USER/DELETE_LOCAL_USER already exist in the reducer.
// ===================================================================

const LOCAL_USER_ENCRYPTION_OPTIONS = ["type-9", "type-8", "type-7", "type-5", "type-0"];

function emptyLocalUserDraft(): CiscoLocalUser {
  return { username: "", privilege: 1, secret: "", encryption: "type-9", comment: "" };
}

function AddLocalUserModal({
  existingUsernames,
  onClose,
  dispatch,
}: {
  existingUsernames: string[];
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  const [draft, setDraft] = useState<CiscoLocalUser>(emptyLocalUserDraft());

  function handleSubmit() {
    const username = draft.username.trim();
    if (!username) {
      toast.error("Enter a username");
      return;
    }
    if (existingUsernames.includes(username)) {
      toast.error(`User "${username}" already exists`);
      return;
    }
    if (!draft.secret.trim()) {
      toast.error("Enter a secret / password");
      return;
    }
    dispatch({ type: "ADD_LOCAL_USER", user: { ...draft, username } });
    toast.success(`User "${username}" created`);
    onClose();
  }

  return (
    <Modal
      title="Add local user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleSubmit}>
            Create user
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <Field label="Username">
          <input
            className={styles.input}
            value={draft.username}
            onChange={(e) => setDraft((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="netops"
          />
        </Field>
        <Field label="Privilege level" help="0-15">
          <input
            className={styles.input}
            type="number"
            min={0}
            max={15}
            value={draft.privilege}
            onChange={(e) => setDraft((prev) => ({ ...prev, privilege: Number(e.target.value) }))}
          />
        </Field>
        <Field label="Secret">
          <input
            className={styles.input}
            type="password"
            value={draft.secret}
            onChange={(e) => setDraft((prev) => ({ ...prev, secret: e.target.value }))}
          />
        </Field>
        <Field label="Encryption">
          <select
            className={styles.select}
            value={draft.encryption}
            onChange={(e) => setDraft((prev) => ({ ...prev, encryption: e.target.value }))}
          >
            {LOCAL_USER_ENCRYPTION_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comment">
          <input
            className={styles.input}
            value={draft.comment}
            onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))}
            placeholder="Operator"
          />
        </Field>
      </div>
    </Modal>
  );
}

function DeleteLocalUserModal({
  user,
  onClose,
  dispatch,
}: {
  user: CiscoLocalUser;
  onClose: () => void;
  dispatch: React.Dispatch<CiscoAction>;
}) {
  function handleConfirm() {
    dispatch({ type: "DELETE_LOCAL_USER", username: user.username });
    toast.success(`User "${user.username}" deleted`);
    onClose();
  }

  return (
    <Modal
      title="Delete local user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleConfirm}>
            Delete
          </button>
        </>
      }
    >
      <p>
        Delete local user <b>{user.username}</b> (privilege {user.privilege})? This cannot be undone.
      </p>
    </Modal>
  );
}

export function LocalUsersPage({ state, dispatch }: CiscoPageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CiscoLocalUser | null>(null);

  const columns: DataTableColumn<CiscoLocalUser>[] = [
    { key: "username", header: "Username", render: (u) => <b>{u.username}</b> },
    { key: "privilege", header: "Privilege", render: (u) => u.privilege },
    { key: "encryption", header: "Encryption", render: (u) => u.encryption },
    { key: "secret", header: "Secret", render: () => <span className={styles.mono}>••••••••</span> },
    { key: "comment", header: "Comment", render: (u) => u.comment },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <button type="button" className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => setDeleteTarget(u)}>
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Router User Accounts</h1>
      <div className={styles.toolbar}>
        <div className={styles.toolbarSpacer} />
        <button type="button" className={styles.btn} onClick={() => setShowAdd(true)}>
          + Add user
        </button>
      </div>
      <div className={styles.card}>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.localUsers} getRowKey={(u) => u.username} emptyMessage="No local users configured." />
        </div>
      </div>

      {showAdd ? (
        <AddLocalUserModal existingUsernames={state.localUsers.map((u) => u.username)} onClose={() => setShowAdd(false)} dispatch={dispatch} />
      ) : null}
      {deleteTarget ? <DeleteLocalUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} dispatch={dispatch} /> : null}
    </div>
  );
}

// ===================================================================
// 5. Certificates / PKI — source P['sec-pki']. Read-only: no reducer action
//    exists for certificate management, and source itself never wired a
//    save/mutate handler for trustpoints either.
// ===================================================================

export function CertificatesPage({ state }: { state: CiscoState }) {
  const columns: DataTableColumn<CiscoState["certificates"][number]>[] = [
    { key: "name", header: "Name", render: (c) => <b>{c.name}</b> },
    { key: "type", header: "Type", render: (c) => c.type },
    { key: "usage", header: "Usage", render: (c) => c.usage },
    { key: "valid", header: "Valid Range", render: (c) => c.valid },
    { key: "status", header: "Status", render: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
  ];

  return (
    <div>
      <h1 className={styles.pageH}>Public Key Infrastructure</h1>
      <div className={styles.card}>
        <div className={styles.cardHeader}>Trustpoints / Certificates</div>
        <div className={`${styles.cardBody} ${styles.cardBodyTight}`}>
          <DataTable columns={columns} rows={state.certificates} getRowKey={(c) => c.name} emptyMessage="No certificates configured." />
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// 6. IPS — source P['sec-ips']. Read-only summary: source's own "Update
//    Signatures Now" button (cisco-ui.js:944) is decorative — it only calls
//    `H.toast(...)`, never mutates `CiscoData.state.ips`. No reducer action
//    exists for IPS config, so this is a real display over real seeded state.
// ===================================================================

export function IpsPage({ state }: { state: CiscoState }) {
  const ips = state.ips;

  return (
    <div>
      <h1 className={styles.pageH}>Intrusion Prevention</h1>
      <div className={styles.card}>
        <div className={styles.cardHeader}>IPS Status</div>
        <div className={styles.cardBody}>
          <dl className={styles.kv}>
            <dt>Enabled</dt>
            <dd>{ips.enabled ? <StatusPill tone="up">Yes</StatusPill> : <StatusPill tone="down">No</StatusPill>}</dd>
            <dt>Signature Count</dt>
            <dd>{ips.signatures.toLocaleString()}</dd>
            <dt>Action</dt>
            <dd className={styles.mono}>{ips.action}</dd>
            <dt>Last Signature Update</dt>
            <dd>{ips.lastUpdate}</dd>
            <dt>Blocked (last 24h)</dt>
            <dd>{ips.blockedRecently.toLocaleString()}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
