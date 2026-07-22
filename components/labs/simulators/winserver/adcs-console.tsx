"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsCert, WsCertTemplate } from "@/lib/labs/simulators/winserver/types";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import { CheckboxRow, EmptyPane, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, TabbedPanel, type WsTreeNode } from "./ws-mmc";
import styles from "./winserver-console.module.css";

const REVOKE_REASONS = [
  "Unspecified",
  "Key Compromise",
  "CA Compromise",
  "Affiliation Changed",
  "Superseded",
  "Cessation of Operation",
  "Certificate Hold",
  "Remove from CRL",
];

const AUDIT_EVENTS = [
  "Start and stop CA service",
  "Back up and restore CA database",
  "Issue and manage certificate requests",
  "Revoke certificates and publish CRLs",
  "Change CA configuration",
  "Change CA security settings",
  "Store and retrieve archived keys",
];

type Dialog =
  | { kind: "revoke-cert"; reqId: number }
  | { kind: "cert-detail"; reqId: number }
  | { kind: "template-properties"; name: string }
  | { kind: "ca-properties" }
  | { kind: "ca-renew" }
  | { kind: "ca-backup" };

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

export function AdcsConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("caRoot");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true, ca: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const { adcs } = state;

  const issued = adcs.certs.filter((c) => c.status === "Issued");
  const revoked = adcs.certs.filter((c) => c.status === "Revoked");
  const pending = adcs.certs.filter((c) => c.status === "Pending");
  const failed = adcs.certs.filter((c) => c.status === "Failed");

  const treeRoot: WsTreeNode = {
    id: "root",
    icon: "CA",
    label: "Certification Authority (Local)",
    children: [
      {
        id: "ca",
        icon: "RC",
        label: adcs.caName,
        children: [
          { id: "revoked", icon: "RV", label: "Revoked Certificates" },
          { id: "issued", icon: "IS", label: "Issued Certificates" },
          { id: "pending", icon: "PD", label: "Pending Requests" },
          { id: "failed", icon: "FR", label: "Failed Requests" },
          { id: "templates", icon: "TM", label: "Certificate Templates" },
          { id: "agents", icon: "EA", label: "Enrollment Agents" },
        ],
      },
    ],
  };

  function headingFor(node: string): string {
    if (node === "root") return "Certification Authority (Local)";
    if (node === "ca") return adcs.caName;
    if (node === "revoked") return `Revoked Certificates (${revoked.length})`;
    if (node === "issued") return `Issued Certificates (${issued.length})`;
    if (node === "pending") return `Pending Requests (${pending.length})`;
    if (node === "failed") return `Failed Requests (${failed.length})`;
    if (node === "templates") return `Certificate Templates (${adcs.templates.length})`;
    if (node === "agents") return `Enrollment Agents (${adcs.enrollmentAgents.length})`;
    return "";
  }

  function showCaContextMenu(e: React.MouseEvent) {
    const items: WsContextMenuItem[] = [
      {
        key: "svc",
        label: adcs.serviceStatus === "Running" ? "All Tasks > Stop Service" : "All Tasks > Start Service",
        onClick: () => {
          toast.info(adcs.serviceStatus === "Running" ? "CertSvc stopped. New requests will queue until restart." : "CertSvc started.");
        },
      },
      { key: "renew", label: "All Tasks > Renew CA Certificate...", onClick: () => setDialog({ kind: "ca-renew" }) },
      { key: "backup", label: "All Tasks > Back up CA...", onClick: () => setDialog({ kind: "ca-backup" }) },
      "-",
      { key: "props", label: "Properties", onClick: () => setDialog({ kind: "ca-properties" }) },
    ];
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showIssuedContextMenu(e: React.MouseEvent, cert: WsCert) {
    WsContextMenu.show(e.clientX, e.clientY, [
      { key: "view", label: "View Details", onClick: () => setDialog({ kind: "cert-detail", reqId: cert.reqId }) },
      { key: "revoke", label: "All Tasks > Revoke Certificate...", onClick: () => setDialog({ kind: "revoke-cert", reqId: cert.reqId }) },
    ]);
  }

  function showTemplateContextMenu(e: React.MouseEvent, template: WsCertTemplate) {
    WsContextMenu.show(e.clientX, e.clientY, [
      { key: "dup", label: "Duplicate Template", onClick: () => toast.success(`Duplicated as "Copy of ${template.name}".`) },
      { key: "reenroll", label: "All Tasks > Reenroll All Certificate Holders", onClick: () => toast.success("Reenroll signaled to Active Directory.") },
      "-",
      { key: "props", label: "Properties", onClick: () => setDialog({ kind: "template-properties", name: template.name }) },
    ]);
  }

  function approve(reqId: number) {
    dispatch({ type: "ISSUE_CERT", reqId });
    toast.success(`Certificate issued for request ${reqId}.`);
  }

  function deny(reqId: number) {
    dispatch({ type: "DENY_CERT", reqId });
    toast.info(`Request ${reqId} denied.`);
  }

  function renderIssued() {
    if (!issued.length) return <EmptyPane>No issued certificates.</EmptyPane>;
    return (
      <ItemListTable columns={["Request ID", "Requester Name", "Certificate Hash", "Certificate Template", "Issued Common Name", "Serial Number"]}>
        {issued.map((c) => (
          <tr key={c.reqId} onContextMenu={(e) => { e.preventDefault(); showIssuedContextMenu(e, c); }}>
            <td>{c.reqId}</td>
            <td>{c.requester}</td>
            <td style={{ fontFamily: "monospace", fontSize: 11 }}>{truncate(c.certHash, 20)}</td>
            <td>{c.template}</td>
            <td>{c.cn}</td>
            <td style={{ fontFamily: "monospace", fontSize: 11 }}>{truncate(c.serial, 14)}</td>
          </tr>
        ))}
      </ItemListTable>
    );
  }

  function renderPending() {
    if (!pending.length) return <EmptyPane>No pending requests.</EmptyPane>;
    return (
      <ItemListTable columns={["Request ID", "Requester Name", "Certificate Template", "Common Name", "Submitted", "Action"]}>
        {pending.map((c) => (
          <tr key={c.reqId}>
            <td>{c.reqId}</td>
            <td>{c.requester}</td>
            <td>{c.template}</td>
            <td>{c.cn}</td>
            <td>{c.effective}</td>
            <td>
              <button type="button" className={styles.btnPrimary} onClick={() => approve(c.reqId)}>
                Approve
              </button>{" "}
              <button type="button" className={styles.btn} onClick={() => deny(c.reqId)}>
                Deny
              </button>
            </td>
          </tr>
        ))}
      </ItemListTable>
    );
  }

  function renderFailed() {
    if (!failed.length) return <EmptyPane>No failed requests.</EmptyPane>;
    return (
      <ItemListTable columns={["Request ID", "Requester Name", "Certificate Template", "Common Name"]}>
        {failed.map((c) => (
          <tr key={c.reqId}>
            <td>{c.reqId}</td>
            <td>{c.requester}</td>
            <td>{c.template}</td>
            <td>{c.cn}</td>
          </tr>
        ))}
      </ItemListTable>
    );
  }

  function renderRevoked() {
    return (
      <>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => { dispatch({ type: "PUBLISH_CRL", kind: "Base" }); toast.success("Base CRL published to LDAP + HTTP CDPs."); }}>
            Publish (Base CRL)
          </button>{" "}
          <button type="button" className={styles.btn} onClick={() => { dispatch({ type: "PUBLISH_CRL", kind: "Delta" }); toast.success("Delta CRL published."); }}>
            Publish (Delta CRL)
          </button>
        </div>
        <p style={{ marginBottom: 8, fontSize: 11, color: "#555" }}>
          Last base CRL publish: {new Date(adcs.crl.lastBasePublish).toLocaleString()} &nbsp;|&nbsp; Last delta CRL publish: {new Date(adcs.crl.lastDeltaPublish).toLocaleString()}
        </p>
        {!revoked.length ? (
          <EmptyPane>No revoked certificates.</EmptyPane>
        ) : (
          <ItemListTable columns={["Request ID", "Requester Name", "Certificate Template", "Common Name", "Revocation Reason", "Serial Number"]}>
            {revoked.map((c) => (
              <tr key={c.reqId}>
                <td>{c.reqId}</td>
                <td>{c.requester}</td>
                <td>{c.template}</td>
                <td>{c.cn}</td>
                <td>
                  <span className={styles.pillRed}>{c.revokeReason}</span>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{truncate(c.serial, 14)}</td>
              </tr>
            ))}
          </ItemListTable>
        )}
      </>
    );
  }

  function renderTemplates() {
    return (
      <ItemListTable columns={["Name", "Schema Version", "Validity", "Renewal Period", "Publish to AD", "Manager Approval", "Min Key Size"]}>
        {adcs.templates.map((t) => (
          <tr
            key={t.name}
            onClick={() => setDialog({ kind: "template-properties", name: t.name })}
            onContextMenu={(e) => { e.preventDefault(); showTemplateContextMenu(e, t); }}
          >
            <td>{t.name}</td>
            <td>v{t.schemaVersion}</td>
            <td>{t.validityDays} days</td>
            <td>{t.renewalDays} days</td>
            <td>
              <span className={t.publishToAd ? styles.pillGreen : styles.pill}>{t.publishToAd ? "Yes" : "No"}</span>
            </td>
            <td>
              <span className={t.managerApproval ? styles.pillAmber : styles.pill}>{t.managerApproval ? "Yes" : "No"}</span>
            </td>
            <td>{t.minKeySize}</td>
          </tr>
        ))}
      </ItemListTable>
    );
  }

  function renderAgents() {
    if (!adcs.enrollmentAgents.length) return <EmptyPane>No enrollment agents are configured.</EmptyPane>;
    return (
      <ItemListTable columns={["Agent", "Allowed Templates", "For Clients"]}>
        {adcs.enrollmentAgents.map((a) => (
          <tr key={a}>
            <td>{a}</td>
            <td>All templates</td>
            <td>All clients</td>
          </tr>
        ))}
      </ItemListTable>
    );
  }

  function renderCaSummary() {
    return (
      <>
        <p style={{ marginBottom: 8 }}>
          Certification Authority service is <b>{adcs.serviceStatus}</b>. {issued.length} certificates issued, {revoked.length} revoked, {pending.length} pending.
        </p>
        <table className={styles.dashTable}>
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>CA name</th>
              <td>{adcs.caName}</td>
            </tr>
            <tr>
              <th>CA FQDN</th>
              <td>{adcs.caFqdn}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>
                <span className={adcs.serviceStatus === "Running" ? styles.pillGreen : styles.pillRed}>{adcs.serviceStatus}</span>
              </td>
            </tr>
            <tr>
              <th>CRL publish interval</th>
              <td>{adcs.crl.intervalHours} hours</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "ca-properties" })}>
            Properties
          </button>{" "}
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "ca-backup" })}>
            Back up CA...
          </button>{" "}
          <button type="button" className={styles.btn} onClick={showCaContextMenu}>
            All Tasks...
          </button>
        </div>
      </>
    );
  }

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={treeRoot}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((ex) => ({ ...ex, [id]: !ex[id] }))}
          onContextMenu={(e, id) => {
            if (id === "ca") showCaContextMenu(e);
          }}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          <ContentBody>
            {selectedNode === "ca" || selectedNode === "root" ? renderCaSummary() : null}
            {selectedNode === "issued" ? renderIssued() : null}
            {selectedNode === "pending" ? renderPending() : null}
            {selectedNode === "failed" ? renderFailed() : null}
            {selectedNode === "revoked" ? renderRevoked() : null}
            {selectedNode === "templates" ? renderTemplates() : null}
            {selectedNode === "agents" ? renderAgents() : null}
          </ContentBody>
        </>
      }
      dialogs={<AdcsDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} />}
    />
  );
}

function AdcsDialogs({
  dialog,
  state,
  dispatch,
  onClose,
}: {
  dialog: Dialog | null;
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  onClose: () => void;
}) {
  if (!dialog) return null;

  if (dialog.kind === "revoke-cert") return <RevokeCertDialog reqId={dialog.reqId} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "cert-detail") return <CertDetailDialog reqId={dialog.reqId} state={state} onClose={onClose} />;
  if (dialog.kind === "template-properties") return <TemplatePropertiesDialog name={dialog.name} state={state} onClose={onClose} />;
  if (dialog.kind === "ca-properties") return <CaPropertiesDialog state={state} onClose={onClose} />;
  if (dialog.kind === "ca-renew") return <CaRenewDialog onClose={onClose} />;
  if (dialog.kind === "ca-backup") return <CaBackupDialog onClose={onClose} />;
  return null;
}

function RevokeCertDialog({
  reqId,
  state,
  dispatch,
  onClose,
}: {
  reqId: number;
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  onClose: () => void;
}) {
  const cert = state.adcs.certs.find((c) => c.reqId === reqId);
  const [reason, setReason] = useState(REVOKE_REASONS[0]);
  if (!cert) return null;

  return (
    <WsDialogComponent
      title="Certificate Revocation"
      onClose={onClose}
      buttons={[
        {
          label: "Yes",
          primary: true,
          onClick: () => {
            dispatch({ type: "REVOKE_CERT", reqId, reason });
            toast.success("Certificate revoked. CRL will publish at next interval.");
            return true;
          },
        },
        { label: "No" },
      ]}
    >
      <p style={{ marginBottom: 10 }}>
        Revoke certificate for <b>{cert.cn}</b> (Serial {truncate(cert.serial, 14)})?
      </p>
      <FormRow label="Reason code">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REVOKE_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FormRow>
    </WsDialogComponent>
  );
}

function CertDetailDialog({ reqId, state, onClose }: { reqId: number; state: WinServerState; onClose: () => void }) {
  const cert = state.adcs.certs.find((c) => c.reqId === reqId);
  if (!cert) return null;

  return (
    <WsDialogComponent title={`Certificate - ${cert.cn}`} width="600px" onClose={onClose} buttons={[{ label: "Close", primary: true }]}>
      <table className={styles.dashTable}>
        <tbody>
          <tr>
            <th>Request ID</th>
            <td>{cert.reqId}</td>
          </tr>
          <tr>
            <th>Requester</th>
            <td>{cert.requester}</td>
          </tr>
          <tr>
            <th>Template</th>
            <td>{cert.template}</td>
          </tr>
          <tr>
            <th>Subject (CN)</th>
            <td>{cert.cn}</td>
          </tr>
          <tr>
            <th>Distinguished Name</th>
            <td>{cert.dn}</td>
          </tr>
          <tr>
            <th>Email</th>
            <td>{cert.email}</td>
          </tr>
          <tr>
            <th>Serial Number</th>
            <td style={{ fontFamily: "monospace", fontSize: 11 }}>{cert.serial}</td>
          </tr>
          <tr>
            <th>Hash</th>
            <td style={{ fontFamily: "monospace", fontSize: 11 }}>{cert.certHash}</td>
          </tr>
          <tr>
            <th>Effective Date</th>
            <td>{cert.effective}</td>
          </tr>
          <tr>
            <th>Expiration</th>
            <td>{cert.expiration}</td>
          </tr>
          {cert.revokeReason ? (
            <tr>
              <th>Revocation Reason</th>
              <td>{cert.revokeReason}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </WsDialogComponent>
  );
}

function TemplatePropertiesDialog({ name, state, onClose }: { name: string; state: WinServerState; onClose: () => void }) {
  const template = state.adcs.templates.find((t) => t.name === name);
  const tabs = ["General", "Compatibility", "Request Handling", "Cryptography", "Subject Name", "Issuance Requirements"];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [purpose, setPurpose] = useState("Signature and encryption");
  const [subjectMode, setSubjectMode] = useState<"supply" | "ad">(template?.name === "User" || template?.name.includes("Smartcard") ? "ad" : "supply");
  const [managerApproval, setManagerApproval] = useState(template?.managerApproval ?? false);
  if (!template) return null;

  return (
    <WsDialogComponent title={`${template.name} Properties`} width="720px" onClose={onClose} buttons={[{ label: "OK", primary: true, onClick: () => { toast.success("Template saved."); return true; } }, { label: "Cancel" }]}>
      <TabbedPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderTab={(tab) => {
          if (tab === "General") {
            return (
              <>
                <FormRow label="Template display name">
                  <input type="text" defaultValue={template.name} disabled />
                </FormRow>
                <FormRow label="Validity period">
                  <input type="text" defaultValue={`${template.validityDays} days`} disabled />
                </FormRow>
                <FormRow label="Renewal period">
                  <input type="text" defaultValue={`${template.renewalDays} days`} disabled />
                </FormRow>
                <CheckboxRow id="tpl-publish" label="Publish certificate in Active Directory" checked={template.publishToAd} onChange={() => undefined} />
              </>
            );
          }
          if (tab === "Compatibility") {
            return (
              <>
                <FormRow label="Schema version">
                  <input type="text" defaultValue={`v${template.schemaVersion}`} disabled />
                </FormRow>
                <HelpText>Higher schema versions require newer CA/client OS support. Changing compatibility can invalidate cryptography or extension settings above the client OS baseline.</HelpText>
              </>
            );
          }
          if (tab === "Request Handling") {
            return (
              <>
                <FormRow label="Minimum key size">
                  <input type="text" defaultValue={String(template.minKeySize)} disabled />
                </FormRow>
                <FormRow label="Purpose">
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <option>Encryption</option>
                    <option>Signature</option>
                    <option>Signature and encryption</option>
                  </select>
                </FormRow>
              </>
            );
          }
          if (tab === "Cryptography") {
            return (
              <>
                <FormRow label="Minimum key size">
                  <input type="text" defaultValue={String(template.minKeySize)} disabled />
                </FormRow>
                <FormRow label="Provider category">
                  <input type="text" defaultValue="Key Storage Provider" disabled />
                </FormRow>
              </>
            );
          }
          if (tab === "Subject Name") {
            return (
              <FormSection title="">
                <label style={{ display: "block", marginBottom: 6 }}>
                  <input type="radio" checked={subjectMode === "supply"} onChange={() => setSubjectMode("supply")} /> Supply in the request
                </label>
                <label style={{ display: "block" }}>
                  <input type="radio" checked={subjectMode === "ad"} onChange={() => setSubjectMode("ad")} /> Build from Active Directory information
                </label>
              </FormSection>
            );
          }
          return <CheckboxRow id="tpl-approval" label="CA certificate manager approval" checked={managerApproval} onChange={setManagerApproval} />;
        }}
      />
    </WsDialogComponent>
  );
}

function CaPropertiesDialog({ state, onClose }: { state: WinServerState; onClose: () => void }) {
  const { adcs } = state;
  const tabs = ["General", "Extensions", "Storage", "Auditing", "Security"];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [aia, setAia] = useState("http://pki.corp.cloudlab.local/CertEnroll/<ServerDNSName>_<CaName><CertificateName>.crt");
  const [cdp, setCdp] = useState("http://pki.corp.cloudlab.local/CertEnroll/<CaName><CRLNameSuffix><DeltaCRLAllowed>.crl");
  const [audit, setAudit] = useState<Record<string, boolean>>(() => Object.fromEntries(AUDIT_EVENTS.map((e, i) => [e, i !== 0 ? true : false])));

  return (
    <WsDialogComponent
      title={`${adcs.caName} Properties`}
      width="720px"
      onClose={onClose}
      buttons={[{ label: "OK", primary: true, onClick: () => { toast.success("CA properties saved."); return true; } }, { label: "Cancel" }]}
    >
      <TabbedPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderTab={(tab) => {
          if (tab === "General") {
            return (
              <>
                <FormRow label="CA name">
                  <input type="text" defaultValue={adcs.caName} disabled />
                </FormRow>
                <FormRow label="CA FQDN">
                  <input type="text" defaultValue={adcs.caFqdn} disabled />
                </FormRow>
                <FormRow label="Status">
                  <input type="text" defaultValue={adcs.serviceStatus} disabled />
                </FormRow>
              </>
            );
          }
          if (tab === "Extensions") {
            return (
              <>
                <FormRow label="AIA URLs">
                  <textarea value={aia} onChange={(e) => setAia(e.target.value)} style={{ fontFamily: "monospace", fontSize: 11 }} />
                </FormRow>
                <FormRow label="CDP URLs">
                  <textarea value={cdp} onChange={(e) => setCdp(e.target.value)} style={{ fontFamily: "monospace", fontSize: 11 }} />
                </FormRow>
              </>
            );
          }
          if (tab === "Storage") {
            return (
              <>
                <FormRow label="Certificate database">
                  <input type="text" defaultValue="C:\Windows\System32\CertLog" disabled />
                </FormRow>
                <FormRow label="Certificate database log">
                  <input type="text" defaultValue="C:\Windows\System32\CertLog" disabled />
                </FormRow>
              </>
            );
          }
          if (tab === "Auditing") {
            return (
              <>
                <HelpText>Events to audit:</HelpText>
                {AUDIT_EVENTS.map((label) => (
                  <CheckboxRow
                    key={label}
                    id={`audit-${label}`}
                    label={label}
                    checked={!!audit[label]}
                    onChange={(v) => setAudit((a) => ({ ...a, [label]: v }))}
                  />
                ))}
              </>
            );
          }
          return (
            <ItemListTable columns={["Group or user name", "Permissions"]}>
              <tr>
                <td>CORP\Domain Admins</td>
                <td>Read, Issue and Manage Certificates, Manage CA, Request Certificates</td>
              </tr>
              <tr>
                <td>CORP\Enterprise Admins</td>
                <td>Read, Manage CA</td>
              </tr>
              <tr>
                <td>CORP\Authenticated Users</td>
                <td>Read, Request Certificates</td>
              </tr>
            </ItemListTable>
          );
        }}
      />
    </WsDialogComponent>
  );
}

function CaRenewDialog({ onClose }: { onClose: () => void }) {
  const [newKey, setNewKey] = useState<"new" | "reuse">("new");

  return (
    <WsDialogComponent
      title="Renew CA Certificate"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            toast.success(`CA certificate renewed${newKey === "new" ? " with a new key pair" : " (existing key reused)"}. Republish the chain to Active Directory.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormSection title="">
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={newKey === "new"} onChange={() => setNewKey("new")} /> Generate new key pair
        </label>
        <label style={{ display: "block" }}>
          <input type="radio" checked={newKey === "reuse"} onChange={() => setNewKey("reuse")} /> Reuse existing key pair
        </label>
      </FormSection>
      <HelpText>A new key pair is recommended roughly every 5 years; reusing the existing key avoids disrupting the certificate chain.</HelpText>
    </WsDialogComponent>
  );
}

function CaBackupDialog({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState(`C:\\CABackup\\${new Date().toISOString().slice(0, 10)}`);
  const [password, setPassword] = useState("");

  return (
    <WsDialogComponent
      title="Back up CA"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!path.trim()) {
              alert("Backup path is required.");
              return false;
            }
            if (!password.trim()) {
              alert("Encryption password is required for the private key.");
              return false;
            }
            toast.success(`CA backed up to ${path} (private key encrypted).`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Backup to path">
        <input type="text" value={path} onChange={(e) => setPath(e.target.value)} />
      </FormRow>
      <FormRow label="Encryption password">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormRow>
      <HelpText>Backs up the CA database, private key, and certificate. Store the password separately from the backup.</HelpText>
    </WsDialogComponent>
  );
}
