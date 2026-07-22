"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { AddsDialog, CheckboxRow, FormRow, HelpText } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

type FsmoRoleKey = "schemaMaster" | "domainNamingMaster" | "pdcEmulator" | "ridMaster" | "infrastructureMaster";

type RoleMeta = {
  key: FsmoRoleKey;
  label: string;
  scope: string;
  description: string;
  cmdName: string;
};

const ROLES: RoleMeta[] = [
  {
    key: "schemaMaster",
    label: "Schema Master",
    scope: "Forest-wide",
    description: "Controls all updates and modifications to the Active Directory schema.",
    cmdName: "schema master",
  },
  {
    key: "domainNamingMaster",
    label: "Domain Naming Master",
    scope: "Forest-wide",
    description: "Controls the addition and removal of domains in the forest.",
    cmdName: "naming master",
  },
  {
    key: "pdcEmulator",
    label: "PDC Emulator",
    scope: "Domain-wide",
    description: "Time source, password change processing, account lockout authoritative source, and primary GPO target.",
    cmdName: "pdc",
  },
  {
    key: "ridMaster",
    label: "RID Master",
    scope: "Domain-wide",
    description: "Allocates RID pools to all DCs in the domain so each can create unique SIDs.",
    cmdName: "rid master",
  },
  {
    key: "infrastructureMaster",
    label: "Infrastructure Master",
    scope: "Domain-wide",
    description: "Updates cross-domain object references; should not be on a GC unless all DCs are GCs.",
    cmdName: "infrastructure master",
  },
];

function cn(fqdn: string): string {
  return fqdn.split(".")[0] ?? fqdn;
}

const INITIAL_TRANSCRIPT = ["C:\\Windows\\system32> Welcome to the FSMO role console.", "C:\\Windows\\system32> Use the buttons above to transfer or seize roles."];

type Dialog = { kind: "transfer"; role: RoleMeta } | { kind: "seize"; role: RoleMeta };

export function FsmoConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [transcript, setTranscript] = useState<string[]>(INITIAL_TRANSCRIPT);

  function appendConsole(lines: string[]) {
    setTranscript((prev) => [...prev, ...lines].slice(-200));
  }

  function runNetdomQuery() {
    appendConsole([
      "",
      "C:\\Windows\\system32> netdom query fsmo",
      `Schema master               ${state.domain.schemaMaster}`,
      `Domain naming master        ${state.domain.domainNamingMaster}`,
      `PDC                         ${state.domain.pdcEmulator}`,
      `RID pool manager            ${state.domain.ridMaster}`,
      `Infrastructure master       ${state.domain.infrastructureMaster}`,
      "The command completed successfully.",
      "",
    ]);
  }

  function showNtdsutilHelp() {
    appendConsole([
      "",
      "C:\\Windows\\system32> ntdsutil",
      "ntdsutil: roles",
      "fsmo maintenance: connections",
      "server connections: connect to server <target-dc>",
      "server connections: quit",
      "fsmo maintenance: transfer <role>     -- safely move the role",
      "fsmo maintenance: seize <role>        -- force role takeover (emergency only)",
      "fsmo maintenance: quit",
      "ntdsutil: quit",
      "Use the per-row Transfer/Seize buttons above for a guided workflow.",
      "",
    ]);
  }

  function performTransfer(role: RoleMeta, from: string, to: string) {
    dispatch({ type: "TRANSFER_FSMO_ROLE", role: role.key, targetDc: cn(to) });
    appendConsole([
      "",
      `C:\\> ntdsutil roles connections "connect to server ${cn(to).toLowerCase()}" quit "transfer ${role.cmdName}" quit quit`,
      `Server connections: Binding to ${cn(to).toLowerCase()}...`,
      `Server connections: Connected to ${cn(to).toLowerCase()} using credentials of locally logged on user.`,
      `fsmo maintenance: Transfer ${role.cmdName}`,
      "",
      `Server "${cn(to).toLowerCase()}" knows about 5 roles`,
      `Schema             - CN=NTDS Settings,CN=${role.key === "schemaMaster" ? cn(to) : cn(state.domain.schemaMaster)},CN=Servers,CN=Default-First-Site-Name,CN=Sites,CN=Configuration,DC=${state.domain.netbios.toLowerCase()}`,
      "fsmo maintenance: quit",
      "ntdsutil: quit",
      "",
    ]);
    toast.success(`${role.label} role transferred from ${cn(from)} to ${cn(to)} successfully.`);
  }

  function performSeize(role: RoleMeta, from: string, to: string) {
    dispatch({ type: "SEIZE_FSMO_ROLE", role: role.key, targetDc: cn(to) });
    appendConsole([
      "",
      `C:\\> ntdsutil roles connections "connect to server ${cn(to).toLowerCase()}" quit "seize ${role.cmdName}" quit quit`,
      `Server connections: Binding to ${cn(to).toLowerCase()}...`,
      `Server connections: Connected to ${cn(to).toLowerCase()} using credentials of locally logged on user.`,
      `fsmo maintenance: Seize ${role.cmdName}`,
      `Attempting safe transfer of ${role.cmdName} FSMO before seizure.`,
      "ldap_modify_sW error 0x34(52 (Unavailable).",
      "Ldap extended error message is 000020AF: SvcErr: DSID-031A1276, problem 5002 (UNAVAILABLE)",
      "FSMO transfer failed; proceeding with seizure.",
      "",
      `Server "${cn(to).toLowerCase()}" knows about 5 roles`,
      "fsmo maintenance: quit",
      "ntdsutil: quit",
      "",
      `*** Role ${role.label} has been SEIZED. Verify with: netdom query fsmo ***`,
      "",
    ]);
    toast.success(`Seized ${role.label} from ${cn(from)} to ${cn(to)}. Verify with netdom query fsmo.`);
  }

  return (
    <>
      <ContentHeading>FSMO Role Management - {state.domain.fqdn}</ContentHeading>
      <ContentBody>
        <div style={{ marginBottom: 10, display: "flex", gap: 6 }}>
          <button type="button" className={styles.btn} onClick={runNetdomQuery}>
            Run: netdom query fsmo
          </button>
          <button type="button" className={styles.btn} onClick={showNtdsutilHelp}>
            Open ntdsutil prompt
          </button>
          <button type="button" className={styles.btn} onClick={() => setTranscript(["C:\\Windows\\system32>"])}>
            Clear console
          </button>
        </div>

        <div style={{ border: "1px solid #d4d4d4", background: "#fff", marginBottom: 12 }}>
          <ItemListTable columns={["Role", "Scope", "Description", "Current holder", "Actions"]}>
            {ROLES.map((role) => {
              const holder = state.domain[role.key];
              return (
                <tr key={role.key}>
                  <td>
                    <b>{role.label}</b>
                  </td>
                  <td>{role.scope}</td>
                  <td title={role.description}>{role.description}</td>
                  <td>{holder}</td>
                  <td>
                    <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "transfer", role })}>
                      Transfer...
                    </button>{" "}
                    <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "seize", role })}>
                      Seize...
                    </button>
                  </td>
                </tr>
              );
            })}
          </ItemListTable>
        </div>

        <div className={styles.contentHeading} style={{ border: "1px solid #d4d4d4", borderBottom: 0 }}>
          Console output (ntdsutil / netdom)
        </div>
        <div className={styles.terminal}>{transcript.join("\n")}</div>

        <HelpText>
          <b>Tips:</b>
          <br />
          - <b>Transfer</b> a role only when both source and destination DCs are online and reachable. This is the safe, normal procedure.
          <br />
          - <b>Seize</b> a role only as a last resort when the original holder is permanently offline. The previous holder must NEVER be brought back online
          without metadata cleanup.
          <br />
          - Use <code>netdom query fsmo</code> to confirm role holders. Use <code>repadmin /showrepl</code> to verify the new holder is replicating.
        </HelpText>
      </ContentBody>

      {dialog?.kind === "transfer" ? (
        <TransferDialog
          role={dialog.role}
          state={state}
          onClose={() => setDialog(null)}
          onConfirm={(to) => performTransfer(dialog.role, state.domain[dialog.role.key], to)}
        />
      ) : null}
      {dialog?.kind === "seize" ? (
        <SeizeDialog
          role={dialog.role}
          state={state}
          onClose={() => setDialog(null)}
          onConfirm={(to) => performSeize(dialog.role, state.domain[dialog.role.key], to)}
        />
      ) : null}
    </>
  );
}

function TransferDialog({
  role,
  state,
  onClose,
  onConfirm,
}: {
  role: RoleMeta;
  state: AddsState;
  onClose: () => void;
  onConfirm: (targetFqdn: string) => void;
}) {
  const currentHolder = state.domain[role.key];
  const candidates = state.domainControllers.filter((dc) => `${dc.name}.${state.domain.fqdn}` !== currentHolder);
  const [target, setTarget] = useState(candidates[0] ? `${candidates[0].name}.${state.domain.fqdn}` : "");

  return (
    <AddsDialog
      title={`Transfer FSMO Role - ${role.label}`}
      onClose={onClose}
      buttons={[
        {
          label: "Transfer",
          primary: true,
          onClick: () => {
            if (!target) {
              alert("Select a domain controller to transfer to.");
              return false;
            }
            onConfirm(target);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p style={{ marginBottom: 10 }}>
        Transfer the <b>{role.label}</b> role.
      </p>
      <FormRow label="Current holder">
        <input type="text" value={currentHolder} readOnly style={{ background: "#eee" }} />
      </FormRow>
      <FormRow label="Transfer to">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {candidates.map((dc) => {
            const fqdn = `${dc.name}.${state.domain.fqdn}`;
            return (
              <option key={dc.name} value={fqdn}>
                {fqdn} ({dc.ip})
              </option>
            );
          })}
        </select>
      </FormRow>
      <HelpText>A transfer is the safe, supported operation. Both DCs must be online.</HelpText>
    </AddsDialog>
  );
}

function SeizeDialog({
  role,
  state,
  onClose,
  onConfirm,
}: {
  role: RoleMeta;
  state: AddsState;
  onClose: () => void;
  onConfirm: (targetFqdn: string) => void;
}) {
  const currentHolder = state.domain[role.key];
  const candidates = state.domainControllers.filter((dc) => `${dc.name}.${state.domain.fqdn}` !== currentHolder);
  const [target, setTarget] = useState(candidates[0] ? `${candidates[0].name}.${state.domain.fqdn}` : "");
  const [confirmText, setConfirmText] = useState("");
  const [ack, setAck] = useState(false);

  const canSeize = confirmText.trim().toLowerCase() === role.label.toLowerCase() && ack && !!target;

  return (
    <AddsDialog title={`Seize FSMO Role - ${role.label}`} onClose={onClose} buttons={[{ label: "Cancel" }]}>
      <div style={{ background: "#fde7e7", border: "1px solid #c42b1c", padding: 8, marginBottom: 10, color: "#8a1f15" }}>
        <b>WARNING:</b> Seizing an FSMO role is a destructive operation. Only do this if the current holder is permanently offline and you cannot recover
        it. The previous holder must NEVER be brought back online without metadata cleanup.
      </div>
      <FormRow label="Role">
        <input type="text" value={role.label} readOnly style={{ background: "#eee" }} />
      </FormRow>
      <FormRow label="Current holder">
        <input type="text" value={currentHolder} readOnly style={{ background: "#eee" }} />
      </FormRow>
      <FormRow label="Seize to">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {candidates.map((dc) => {
            const fqdn = `${dc.name}.${state.domain.fqdn}`;
            return (
              <option key={dc.name} value={fqdn}>
                {fqdn}
              </option>
            );
          })}
        </select>
      </FormRow>
      <FormRow label={`Type "${role.label}" to confirm`}>
        <input type="text" placeholder={role.label} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </FormRow>
      <CheckboxRow
        id="fsmoSeizeAck"
        label="I understand this is a destructive operation only used when the original role holder is permanently unavailable"
        checked={ack}
        onChange={setAck}
      />
      <HelpText>The Seize button stays disabled until the role name is typed exactly and the acknowledgment is checked.</HelpText>
      <div style={{ textAlign: "right", marginTop: 12 }}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!canSeize}
          onClick={() => {
            if (!canSeize) return;
            onConfirm(target);
            onClose();
          }}
        >
          Seize
        </button>
      </div>
    </AddsDialog>
  );
}
