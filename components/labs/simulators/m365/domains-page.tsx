"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365Domain, M365State } from "@/lib/labs/simulators/m365/types";
import { exportCsv, Modal, Pill, StatRow, WizStep } from "./m365-ui";
import styles from "./m365-console.module.css";

type PurposeKey = keyof M365Domain["purpose"];

const PURPOSE_OPTIONS: { key: PurposeKey; label: string }[] = [
  { key: "email", label: "Exchange Online (email)" },
  { key: "sharepoint", label: "SharePoint" },
  { key: "teams", label: "Microsoft Teams" },
  { key: "defenderId", label: "Defender for Identity" },
  { key: "intuneMdm", label: "Intune MDM (mobile device management)" },
];

function statusTone(status: M365Domain["status"]): "ok" | "warn" | "err" {
  if (status === "Healthy") return "ok";
  if (status === "Pending verification") return "warn";
  return "err";
}

function isCustomDomain(name: string): boolean {
  return !name.endsWith(".onmicrosoft.com");
}

function genVerificationTxt(): string {
  return `MS=ms${Math.floor(10000000 + Math.random() * 89999999)}`;
}

type DnsRow = { type: string; host: string; value: string; ttl?: string };
type DnsSection = { section: string; rows: DnsRow[] };

function dnsRecords(domain: M365Domain): DnsSection[] {
  return [
    {
      section: "Ownership verification",
      rows: [{ type: "TXT", host: "@", value: domain.verificationTxt, ttl: "3600" }],
    },
    {
      section: "Exchange Online",
      rows: [
        { type: "MX", host: "@", value: `${domain.name.replace(/\./g, "-")}.mail.protection.outlook.com`, ttl: "3600" },
        { type: "TXT", host: "@", value: "v=spf1 include:spf.protection.outlook.com -all", ttl: "3600" },
        { type: "CNAME", host: "autodiscover", value: "autodiscover.outlook.com", ttl: "3600" },
        { type: "CNAME", host: "selector1._domainkey", value: `selector1-${domain.name.replace(/\./g, "-")}._domainkey.cloudlab.onmicrosoft.com`, ttl: "3600" },
        { type: "CNAME", host: "selector2._domainkey", value: `selector2-${domain.name.replace(/\./g, "-")}._domainkey.cloudlab.onmicrosoft.com`, ttl: "3600" },
        { type: "TXT", host: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain.name}`, ttl: "3600" },
      ],
    },
    {
      section: "Microsoft Teams",
      rows: [
        { type: "CNAME", host: "sip", value: "sipdir.online.lync.com", ttl: "3600" },
        { type: "CNAME", host: "lyncdiscover", value: "webdir.online.lync.com", ttl: "3600" },
        { type: "SRV", host: "_sip._tls", value: "100 1 443 sipdir.online.lync.com", ttl: "3600" },
        { type: "SRV", host: "_sipfederationtls._tcp", value: "100 1 5061 sipfed.online.lync.com", ttl: "3600" },
      ],
    },
    {
      section: "Intune MDM",
      rows: [
        { type: "CNAME", host: "enrollment", value: "enrollment.manage.microsoft.com", ttl: "3600" },
        { type: "CNAME", host: "enterpriseregistration", value: "enterpriseregistration.windows.net", ttl: "3600" },
      ],
    },
  ];
}

function copyValue(value: string) {
  navigator.clipboard.writeText(value);
  toast.success("Copied to clipboard.");
}

function DnsTable({ domain }: { domain: M365Domain }) {
  return (
    <>
      {dnsRecords(domain).map((section) => (
        <div key={section.section}>
          <div className={styles.h3}>{section.section}</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Host name</th>
                  <th>Value</th>
                  <th>TTL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.type}</td>
                    <td>{row.host}</td>
                    <td className={styles.nowrap}>{row.value}</td>
                    <td>{row.ttl ?? "3600"}</td>
                    <td>
                      <button type="button" className={styles.btnSubtle} onClick={() => copyValue(row.value)}>
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

function DnsManagementModal({
  dnsManagement,
  onClose,
  onSave,
}: {
  dnsManagement: M365Domain["dnsManagement"];
  onClose: () => void;
  onSave: (value: M365Domain["dnsManagement"]) => void;
}) {
  const [value, setValue] = useState<M365Domain["dnsManagement"]>(dnsManagement);
  return (
    <Modal
      title="Change DNS management"
      onClose={onClose}
      footer={
        <button type="button" className={styles.btn} onClick={() => onSave(value)}>
          Save
        </button>
      }
    >
      <div className={styles.radioRow}>
        <label>
          <input type="radio" checked={value === "Managed by Microsoft"} onChange={() => setValue("Managed by Microsoft")} /> Managed by Microsoft
        </label>
        <label>
          <input type="radio" checked={value === "Unmanaged"} onChange={() => setValue("Unmanaged")} /> I&apos;ll manage DNS records myself
        </label>
      </div>
    </Modal>
  );
}

function DomainDetail({
  state,
  dispatch,
  domain,
  onBack,
}: {
  state: M365State;
  dispatch: (action: M365Action) => void;
  domain: M365Domain;
  onBack: () => void;
}) {
  const [showDnsModal, setShowDnsModal] = useState(false);
  void state;

  function togglePurpose(key: PurposeKey, on: boolean) {
    dispatch({ type: "SET_DOMAIN_PURPOSE", name: domain.name, purpose: { [key]: on } });
    toast.success("Domain purpose updated.");
  }

  function saveDnsManagement(value: M365Domain["dnsManagement"]) {
    dispatch({ type: "SET_DOMAIN_DNS_MANAGEMENT", name: domain.name, dnsManagement: value });
    toast.success("DNS management setting saved.");
    setShowDnsModal(false);
  }

  return (
    <div>
      <button type="button" className={styles.btnOutline} onClick={onBack}>
        ← Back to domains
      </button>
      <h1 className={styles.pageH1}>{domain.name}</h1>
      <p className={styles.pageSub}>
        <Pill tone={statusTone(domain.status)}>{domain.status}</Pill>{" "}
        {domain.isDefault ? <Pill tone="info">Default domain</Pill> : null}
      </p>

      <div className={styles.h2}>Domain purpose</div>
      <div className={styles.card}>
        {PURPOSE_OPTIONS.map((opt) => (
          <label key={opt.key} className={styles.checkboxRow} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}>
            <input type="checkbox" checked={domain.purpose[opt.key]} onChange={(e) => togglePurpose(opt.key, e.target.checked)} />
            {opt.label}
          </label>
        ))}
      </div>

      <div className={styles.h2}>DNS records</div>
      <button type="button" className={styles.tbBtn} onClick={() => setShowDnsModal(true)}>
        Change DNS management
      </button>
      <p className={styles.muted}>Currently: {domain.dnsManagement}</p>
      <DnsTable domain={domain} />

      {showDnsModal ? (
        <DnsManagementModal dnsManagement={domain.dnsManagement} onClose={() => setShowDnsModal(false)} onSave={saveDnsManagement} />
      ) : null}
    </div>
  );
}

type WizardData = {
  name: string;
  token: string;
  verifyResult: "pending" | "passed" | "failed";
  dnsManagement: M365Domain["dnsManagement"];
  purpose: M365Domain["purpose"];
};

const WIZARD_STEPS = ["name", "verify", "dns", "services", "confirm"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

function initialWizardData(): WizardData {
  return {
    name: "",
    token: "",
    verifyResult: "pending",
    dnsManagement: "Managed by Microsoft",
    purpose: { email: true, sharepoint: false, teams: false, defenderId: false, intuneMdm: false },
  };
}

function validDomainName(name: string): boolean {
  return name.includes(".") && !name.includes(" ") && name.trim().length > 3;
}

export function DomainsPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<M365Domain | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("name");
  const [wizard, setWizard] = useState<WizardData>(initialWizardData);
  const [checkingAll, setCheckingAll] = useState(false);

  const selectedDomain = selectedName ? state.domains.find((d) => d.name === selectedName) ?? null : null;
  if (selectedDomain) {
    return <DomainDetail state={state} dispatch={dispatch} domain={selectedDomain} onBack={() => setSelectedName(null)} />;
  }

  const totalDomains = state.domains.length;
  const customDomains = state.domains.filter((d) => isCustomDomain(d.name)).length;
  const healthyDomains = state.domains.filter((d) => d.status === "Healthy").length;
  const pendingDomains = state.domains.filter((d) => d.status === "Pending verification").length;

  function openWizard() {
    setWizard(initialWizardData());
    setWizardStep("name");
    setShowWizard(true);
  }

  function goWizardNext() {
    if (wizardStep === "name") {
      if (!validDomainName(wizard.name)) {
        toast.error("Enter a valid domain name (must contain a dot, no spaces).");
        return;
      }
      if (state.domains.some((d) => d.name.toLowerCase() === wizard.name.toLowerCase())) {
        toast.error("This domain has already been added.");
        return;
      }
      setWizard({ ...wizard, token: genVerificationTxt() });
      setWizardStep("verify");
      return;
    }
    if (wizardStep === "verify") {
      if (wizard.verifyResult !== "passed") {
        toast.error("Verify domain ownership before continuing.");
        return;
      }
      setWizardStep("dns");
      return;
    }
    if (wizardStep === "dns") {
      setWizardStep("services");
      return;
    }
    if (wizardStep === "services") {
      setWizardStep("confirm");
      return;
    }
    finishWizard();
  }

  function goWizardBack() {
    const idx = WIZARD_STEPS.indexOf(wizardStep);
    if (idx > 0) setWizardStep(WIZARD_STEPS[idx - 1]);
  }

  function finishWizard() {
    const newDomain: M365Domain = {
      name: wizard.name,
      type: "Authoritative",
      isDefault: false,
      status: "Healthy",
      verified: true,
      purpose: wizard.purpose,
      dnsManagement: wizard.dnsManagement,
      registrar: "Unknown",
      addedOn: new Date().toISOString().slice(0, 10),
      verificationTxt: wizard.token,
    };
    dispatch({ type: "ADD_DOMAIN", domain: newDomain });
    toast.success(`${wizard.name} was added.`);
    setShowWizard(false);
  }

  function setDefault(name: string) {
    dispatch({ type: "SET_DEFAULT_DOMAIN", name });
    toast.success(`${name} is now the default domain.`);
  }

  function checkHealth(name: string) {
    toast.info(`Checking health for ${name}…`);
    setTimeout(() => {
      dispatch({ type: "CHECK_DOMAIN_HEALTH", name });
      toast.success(`${name} passed health checks.`);
    }, 800);
  }

  function checkHealthForAll() {
    if (!state.domains.length) return;
    setCheckingAll(true);
    toast.info("Checking health for all domains…");
    setTimeout(() => {
      state.domains.forEach((d) => dispatch({ type: "CHECK_DOMAIN_HEALTH", name: d.name }));
      toast.success("All domains passed health checks.");
      setCheckingAll(false);
    }, 800);
  }

  function handleExport() {
    exportCsv(
      "domains.csv",
      ["Domain name", "Status", "Default", "DNS management", "Added on"],
      state.domains.map((d) => [d.name, d.status, d.isDefault ? "Yes" : "No", d.dnsManagement, d.addedOn]),
    );
    toast.success("Domains exported.");
  }

  function removeDisabledReason(d: M365Domain): string | null {
    if (d.isDefault) return "Cannot remove the default domain. Set another domain as default first.";
    if (d.name.endsWith(".onmicrosoft.com")) return "The initial .onmicrosoft.com domain cannot be removed.";
    return null;
  }

  function confirmRemove() {
    if (!removeTarget) return;
    dispatch({ type: "REMOVE_DOMAIN", name: removeTarget.name });
    toast.success(`${removeTarget.name} was removed.`);
    setRemoveTarget(null);
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Domains</h1>
      <p className={styles.pageSub}>Add and manage the domains your organization uses for email, SharePoint, Teams, and more.</p>

      <StatRow
        stats={[
          { label: "Total domains", value: totalDomains },
          { label: "Custom domains", value: customDomains },
          { label: "Healthy", value: healthyDomains },
          { label: "Pending verification", value: pendingDomains },
        ]}
      />

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={openWizard}>
          + Add domain
        </button>
        <button type="button" className={styles.tbBtn} disabled={checkingAll} onClick={checkHealthForAll}>
          Check health for all
        </button>
        <span className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export
        </button>
      </div>

      {state.domains.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Domain name</th>
                <th>Status</th>
                <th>Default</th>
                <th>DNS management</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.domains.map((d) => {
                const disabledReason = removeDisabledReason(d);
                return (
                  <tr key={d.name}>
                    <td>
                      <span className={styles.rowLink} onClick={() => setSelectedName(d.name)}>
                        {d.name}
                      </span>
                    </td>
                    <td>
                      <Pill tone={statusTone(d.status)}>{d.status}</Pill>
                    </td>
                    <td>{d.isDefault ? <Pill tone="info">Default</Pill> : <span className={styles.muted}>-</span>}</td>
                    <td>{d.dnsManagement}</td>
                    <td className={styles.right}>
                      <button type="button" className={styles.btnSubtle} onClick={() => setSelectedName(d.name)}>
                        View
                      </button>
                      <button type="button" className={styles.btnSubtle} disabled={d.isDefault} onClick={() => setDefault(d.name)}>
                        Set default
                      </button>
                      <button type="button" className={styles.btnSubtle} onClick={() => checkHealth(d.name)}>
                        Check health
                      </button>
                      <button
                        type="button"
                        className={styles.btnSubtle}
                        disabled={!!disabledReason}
                        title={disabledReason ?? "Remove this domain"}
                        onClick={() => setRemoveTarget(d)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>No domains yet.</div>
      )}

      <div className={styles.h2}>About domains</div>
      <div className={styles.card}>
        <p>
          A domain identifies your organization and is used in email addresses, SharePoint site URLs, and other services. Every tenant starts
          with a free <code>.onmicrosoft.com</code> domain, which cannot be removed. Add a custom domain to use your own company name — you&apos;ll
          need to verify ownership with a DNS record and then point the required DNS records at Microsoft 365 for the services you want to use.
        </p>
      </div>

      {showWizard ? (
        <Modal
          title="Add a domain"
          onClose={() => setShowWizard(false)}
          steps={
            <>
              <WizStep label="Domain name" active={wizardStep === "name"} done={WIZARD_STEPS.indexOf(wizardStep) > 0} />
              <WizStep label="Verify ownership" active={wizardStep === "verify"} done={WIZARD_STEPS.indexOf(wizardStep) > 1} />
              <WizStep label="DNS management" active={wizardStep === "dns"} done={WIZARD_STEPS.indexOf(wizardStep) > 2} />
              <WizStep label="Connect services" active={wizardStep === "services"} done={WIZARD_STEPS.indexOf(wizardStep) > 3} />
              <WizStep label="Confirm" active={wizardStep === "confirm"} done={false} />
            </>
          }
          footer={
            <>
              {wizardStep !== "name" ? (
                <button type="button" className={styles.btnOutline} onClick={goWizardBack}>
                  Back
                </button>
              ) : null}
              <button type="button" className={styles.btn} onClick={goWizardNext}>
                {wizardStep === "confirm" ? "Finish adding" : "Next"}
              </button>
            </>
          }
        >
          {wizardStep === "name" ? (
            <>
              <label className={styles.formLabel}>Domain name *</label>
              <input
                className={styles.input}
                placeholder="contoso.com"
                value={wizard.name}
                onChange={(e) => setWizard({ ...wizard, name: e.target.value })}
              />
              <div className={styles.formHelp}>Enter the domain name exactly as registered with your domain registrar.</div>
            </>
          ) : null}

          {wizardStep === "verify" ? (
            <>
              <p>Add the following TXT record at your domain registrar to prove that you own this domain:</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Host name</th>
                      <th>Value</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>TXT</td>
                      <td>@</td>
                      <td className={styles.nowrap}>{wizard.token}</td>
                      <td>
                        <button type="button" className={styles.btnSubtle} onClick={() => copyValue(wizard.token)}>
                          Copy
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className={styles.muted}>DNS changes can take time to propagate. In this simulator, use the buttons below to simulate the outcome.</p>
              <button
                type="button"
                className={styles.tbBtn}
                onClick={() => {
                  setWizard({ ...wizard, verifyResult: "passed" });
                  toast.success("Verification passed.");
                }}
              >
                Simulate verification passed
              </button>
              <button
                type="button"
                className={styles.tbBtn}
                onClick={() => {
                  setWizard({ ...wizard, verifyResult: "failed" });
                  toast.error("Verification failed.");
                }}
              >
                Simulate verification failed
              </button>
              {wizard.verifyResult === "passed" ? <p className={styles.muted}>Ownership verified. You can continue.</p> : null}
              {wizard.verifyResult === "failed" ? <p className={styles.muted}>Verification failed. Check the TXT record and try again.</p> : null}
            </>
          ) : null}

          {wizardStep === "dns" ? (
            <div className={styles.radioRow}>
              <label>
                <input
                  type="radio"
                  checked={wizard.dnsManagement === "Managed by Microsoft"}
                  onChange={() => setWizard({ ...wizard, dnsManagement: "Managed by Microsoft" })}
                />{" "}
                Managed by Microsoft
              </label>
              <label>
                <input
                  type="radio"
                  checked={wizard.dnsManagement === "Unmanaged"}
                  onChange={() => setWizard({ ...wizard, dnsManagement: "Unmanaged" })}
                />{" "}
                I&apos;ll manage DNS records myself
              </label>
            </div>
          ) : null}

          {wizardStep === "services" ? (
            <>
              {PURPOSE_OPTIONS.map((opt) => (
                <label key={opt.key} className={styles.checkboxRow} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2f1" }}>
                  <input
                    type="checkbox"
                    checked={wizard.purpose[opt.key]}
                    onChange={(e) => setWizard({ ...wizard, purpose: { ...wizard.purpose, [opt.key]: e.target.checked } })}
                  />
                  {opt.label}
                </label>
              ))}
            </>
          ) : null}

          {wizardStep === "confirm" ? (
            <>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Domain name</div>
                <div>{wizard.name}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Ownership</div>
                <div>Verified</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>DNS management</div>
                <div>{wizard.dnsManagement}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Connected services</div>
                <div>{PURPOSE_OPTIONS.filter((o) => wizard.purpose[o.key]).map((o) => o.label).join(", ") || "None"}</div>
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}

      {removeTarget ? (
        <Modal
          title={`Remove ${removeTarget.name}`}
          onClose={() => setRemoveTarget(null)}
          footer={
            <button type="button" className={styles.btnDanger} onClick={confirmRemove}>
              Remove domain
            </button>
          }
        >
          <p>
            Before removing this domain, make sure no users, groups, or aliases still reference it — in a real tenant you must reassign
            them to another domain first. In this simulator, removing the domain is a simple confirmation.
          </p>
          <p className={styles.muted}>This action cannot be undone.</p>
        </Modal>
      ) : null}
    </div>
  );
}
