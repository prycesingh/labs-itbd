"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365SensitivityLabel, M365SharepointSite, M365SharingLevel, M365State } from "@/lib/labs/simulators/m365/types";
import { exportCsv, Flyout, FormGroup, Modal, Pill, UsageBar, WizStep } from "./m365-ui";
import styles from "./m365-console.module.css";

const SENSITIVITY_LABELS: M365SensitivityLabel[] = ["General", "Confidential", "Highly Confidential", "Public"];
const SHARING_LEVELS: M365SharingLevel[] = ["Anyone", "NewAndExistingGuests", "ExistingGuests", "OnlyPeopleInYourOrg", "Disabled"];

function sharingLabel(level: M365SharingLevel): string {
  switch (level) {
    case "Anyone":
      return "Anyone";
    case "NewAndExistingGuests":
      return "New + existing guests";
    case "ExistingGuests":
      return "Existing guests";
    case "OnlyPeopleInYourOrg":
      return "Only your org";
    case "Disabled":
      return "Disabled";
  }
}

function sharingTone(level: M365SharingLevel): "ok" | "warn" | "err" | "info" | "muted" {
  switch (level) {
    case "Anyone":
      return "info";
    case "NewAndExistingGuests":
      return "info";
    case "ExistingGuests":
      return "muted";
    case "OnlyPeopleInYourOrg":
      return "muted";
    case "Disabled":
      return "err";
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type SitesSub = "active" | "deleted";
type FlyTab = "general" | "membership" | "storage" | "sharing" | "advanced";
type WizardStepId = "template" | "details" | "members" | "review";
const WIZARD_STEPS: WizardStepId[] = ["template", "details", "members", "review"];

type WizardData = {
  template: M365SharepointSite["template"];
  name: string;
  urlSlug: string;
  owner: string;
  sensitivity: M365SensitivityLabel;
  members: string[];
};

function initialWizardData(state: M365State): WizardData {
  return {
    template: "Team site",
    name: "",
    urlSlug: "",
    owner: state.users[0]?.username ?? "",
    sensitivity: "General",
    members: [],
  };
}

export function SharepointPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [tab, setTab] = useState<"sites" | "settings">("sites");
  const [sitesSub, setSitesSub] = useState<SitesSub>("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openSiteId, setOpenSiteId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStepId>("template");
  const [wizard, setWizard] = useState<WizardData>(() => initialWizardData(state));
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkSharingModal, setBulkSharingModal] = useState<M365SharingLevel | null>(null);

  const sites = state.sharepointSites;
  const openSite = openSiteId ? sites.find((s) => s.id === openSiteId) ?? null : null;
  const selectedIds = Array.from(selected);

  function toggleSelect(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(on: boolean) {
    setSelected(on ? new Set(sites.map((s) => s.id)) : new Set());
  }

  function handleExport() {
    exportCsv(
      "sharepoint-sites.csv",
      ["Site name", "URL", "Template", "Owner", "Members", "Storage used", "Storage quota", "Sharing"],
      sites.map((s) => [s.name, s.url, s.template, s.owner, s.members, `${s.storageGB.toFixed(1)} GB`, `${s.quotaGB} GB`, sharingLabel(s.sharing)]),
    );
    toast.success("Sites exported.");
  }

  function applyBulkSharing() {
    if (!bulkSharingModal) return;
    selectedIds.forEach((id) => dispatch({ type: "UPDATE_SHAREPOINT_SITE", id, patch: { sharing: bulkSharingModal } }));
    toast.success(`Sharing set to "${sharingLabel(bulkSharingModal)}" on ${selectedIds.length} site(s).`);
    setBulkSharingModal(null);
    setBulkMenuOpen(false);
  }

  function applyBulkQuota() {
    if (!selectedIds.length) return toast.error("Select at least one site.");
    selectedIds.forEach((id) => {
      const site = sites.find((s) => s.id === id);
      if (site) dispatch({ type: "UPDATE_SHAREPOINT_SITE", id, patch: { quotaGB: site.quotaGB + 100 } });
    });
    toast.success(`Added 100 GB quota to ${selectedIds.length} site(s).`);
    setBulkMenuOpen(false);
  }

  function openBulkSharingModal() {
    if (!selectedIds.length) return toast.error("Select at least one site.");
    setBulkSharingModal(state.sharepointSettings.defaultSharing);
    setBulkMenuOpen(false);
  }

  function openWizard() {
    setWizard(initialWizardData(state));
    setWizardStep("template");
    setShowWizard(true);
  }

  function goWizardNext() {
    if (wizardStep === "details" && !wizard.name.trim()) {
      toast.error("Site name is required.");
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

  function finishWizard() {
    const slug = wizard.urlSlug || slugify(wizard.name);
    const newSite: M365SharepointSite = {
      id: crypto.randomUUID(),
      name: wizard.name,
      url: `https://cloudlab.sharepoint.com/sites/${slug}`,
      template: wizard.template,
      owner: wizard.owner,
      members: wizard.members.length,
      storageGB: 0,
      quotaGB: state.sharepointSettings.defaultStorageGB,
      lastActivity: new Date().toISOString().slice(0, 10),
      sensitivity: wizard.sensitivity,
      sharing: state.sharepointSettings.defaultSharing,
    };
    dispatch({ type: "ADD_SHAREPOINT_SITE", site: newSite });
    toast.success(`${newSite.name} provisioned.`);
    setShowWizard(false);
  }

  return (
    <div>
      <h1 className={styles.pageH1}>SharePoint admin center</h1>
      <p className={styles.pageSub}>Manage sites, sharing, and storage.</p>

      <div className={styles.subtabs}>
        <button type="button" className={`${styles.subtab} ${tab === "sites" ? styles.subtabActive : ""}`} onClick={() => setTab("sites")}>
          Sites
        </button>
        <button type="button" className={`${styles.subtab} ${tab === "settings" ? styles.subtabActive : ""}`} onClick={() => setTab("settings")}>
          Settings
        </button>
      </div>

      {tab === "sites" ? (
        <>
          <div className={styles.subtabs}>
            <button type="button" className={`${styles.subtab} ${sitesSub === "active" ? styles.subtabActive : ""}`} onClick={() => setSitesSub("active")}>
              Active sites
            </button>
            <button type="button" className={`${styles.subtab} ${sitesSub === "deleted" ? styles.subtabActive : ""}`} onClick={() => setSitesSub("deleted")}>
              Deleted sites
            </button>
          </div>

          {sitesSub === "active" ? (
            <>
              <div className={styles.toolbar}>
                <button type="button" className={styles.tbBtn} onClick={openWizard}>
                  + Create site
                </button>
                <button type="button" className={styles.tbBtn} onClick={handleExport}>
                  Export
                </button>
                <div style={{ position: "relative" }}>
                  <button type="button" className={styles.tbBtn} onClick={() => setBulkMenuOpen((v) => !v)}>
                    Bulk edit
                  </button>
                  {bulkMenuOpen ? (
                    <div className={styles.card} style={{ position: "absolute", top: "100%", left: 0, zIndex: 20, minWidth: 240, padding: 4 }}>
                      <button type="button" className={styles.tbBtn} style={{ width: "100%", justifyContent: "flex-start" }} onClick={openBulkSharingModal}>
                        Change sharing for selected
                      </button>
                      <button type="button" className={styles.tbBtn} style={{ width: "100%", justifyContent: "flex-start" }} onClick={applyBulkQuota}>
                        +100GB quota for selected
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {sites.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.cbCol}>
                          <input type="checkbox" checked={selected.size > 0 && selected.size === sites.length} onChange={(e) => toggleSelectAll(e.target.checked)} />
                        </th>
                        <th>Name</th>
                        <th>Template</th>
                        <th>Owner</th>
                        <th>Members</th>
                        <th>Storage</th>
                        <th>Sharing</th>
                        <th>Last activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map((s) => (
                        <tr key={s.id} onClick={() => setOpenSiteId(s.id)}>
                          <td className={styles.cbCol} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(s.id)} onChange={(e) => toggleSelect(s.id, e.target.checked)} />
                          </td>
                          <td>
                            <span className={styles.rowLink}>{s.name}</span>
                          </td>
                          <td>{s.template}</td>
                          <td>{s.owner}</td>
                          <td>{s.members}</td>
                          <td>
                            <UsageBar used={Number(s.storageGB.toFixed(1))} total={s.quotaGB} />
                          </td>
                          <td>
                            <Pill tone={sharingTone(s.sharing)}>{sharingLabel(s.sharing)}</Pill>
                          </td>
                          <td>{s.lastActivity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>No sites yet. Create one to get started.</div>
              )}
            </>
          ) : (
            <>
              {state.deletedSites.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Deleted on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.deletedSites.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.deletedOn ? new Date(s.deletedOn).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>No deleted sites in the last 93 days.</div>
              )}
            </>
          )}
        </>
      ) : (
        <SettingsForm state={state} dispatch={dispatch} />
      )}

      {showWizard ? (
        <Modal
          title="Create a site"
          onClose={() => setShowWizard(false)}
          steps={
            <>
              <WizStep label="Choose a template" active={wizardStep === "template"} done={WIZARD_STEPS.indexOf(wizardStep) > 0} />
              <WizStep label="Details" active={wizardStep === "details"} done={WIZARD_STEPS.indexOf(wizardStep) > 1} />
              <WizStep label="Members" active={wizardStep === "members"} done={WIZARD_STEPS.indexOf(wizardStep) > 2} />
              <WizStep label="Review" active={wizardStep === "review"} done={false} />
            </>
          }
          footer={
            <>
              {wizardStep !== "template" ? (
                <button type="button" className={styles.btnOutline} onClick={goWizardBack}>
                  Back
                </button>
              ) : null}
              <button type="button" className={styles.btn} onClick={goWizardNext}>
                {wizardStep === "review" ? "Create site" : "Next"}
              </button>
            </>
          }
        >
          {wizardStep === "template" ? (
            <div className={styles.radioRow} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              {(["Team site", "Communication site"] as const).map((t) => (
                <label key={t} className={styles.card} style={{ display: "flex", gap: 10, cursor: "pointer", borderColor: wizard.template === t ? "var(--itbd-blue, #00ADDA)" : undefined }}>
                  <input type="radio" checked={wizard.template === t} onChange={() => setWizard({ ...wizard, template: t })} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{t}</div>
                    <div className={styles.formHelp}>
                      {t === "Team site" ? "Collaborate with members of a team. Connected to a Microsoft 365 Group." : "Broadcast information across a large audience. Read-mostly."}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {wizardStep === "details" ? (
            <>
              <FormGroup label="Site name *">
                <input className={styles.input} value={wizard.name} onChange={(e) => setWizard({ ...wizard, name: e.target.value })} />
              </FormGroup>
              <FormGroup label="URL">
                <input className={styles.input} readOnly value={`https://cloudlab.sharepoint.com/sites/${wizard.urlSlug || slugify(wizard.name)}`} />
              </FormGroup>
              <FormGroup label="Owner">
                <select className={styles.select} value={wizard.owner} onChange={(e) => setWizard({ ...wizard, owner: e.target.value })}>
                  {state.users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Sensitivity">
                <select className={styles.select} value={wizard.sensitivity} onChange={(e) => setWizard({ ...wizard, sensitivity: e.target.value as M365SensitivityLabel })}>
                  {SENSITIVITY_LABELS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormGroup>
            </>
          ) : null}

          {wizardStep === "members" ? (
            <>
              <div className={styles.formHelp} style={{ marginBottom: 8 }}>
                Add members to the site.
              </div>
              {state.users.map((u) => {
                const checked = wizard.members.includes(u.username);
                return (
                  <label key={u.id} className={styles.checkboxRow} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setWizard({
                          ...wizard,
                          members: e.target.checked ? [...wizard.members, u.username] : wizard.members.filter((m) => m !== u.username),
                        })
                      }
                    />
                    {u.displayName} <span className={styles.formHelp}>({u.upn})</span>
                  </label>
                );
              })}
            </>
          ) : null}

          {wizardStep === "review" ? (
            <>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Template</div>
                <div>{wizard.template}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Name</div>
                <div>{wizard.name || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>URL</div>
                <div>{`https://cloudlab.sharepoint.com/sites/${wizard.urlSlug || slugify(wizard.name)}`}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Owner</div>
                <div>{wizard.owner}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Sensitivity</div>
                <div>{wizard.sensitivity}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Members</div>
                <div>{wizard.members.length ? wizard.members.join(", ") : "-"}</div>
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}

      {bulkSharingModal ? (
        <Modal
          title="Change sharing for selected"
          onClose={() => setBulkSharingModal(null)}
          footer={
            <button type="button" className={styles.btn} onClick={applyBulkSharing}>
              Apply
            </button>
          }
        >
          <FormGroup label="External sharing" help={`Applies to ${selectedIds.length} selected site(s).`}>
            <select className={styles.select} value={bulkSharingModal} onChange={(e) => setBulkSharingModal(e.target.value as M365SharingLevel)}>
              {SHARING_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {sharingLabel(level)}
                </option>
              ))}
            </select>
          </FormGroup>
        </Modal>
      ) : null}

      {openSite ? <SiteFlyout state={state} dispatch={dispatch} site={openSite} onClose={() => setOpenSiteId(null)} /> : null}
    </div>
  );
}

function SiteFlyout({ state, dispatch, site, onClose }: { state: M365State; dispatch: (action: M365Action) => void; site: M365SharepointSite; onClose: () => void }) {
  const [tab, setTab] = useState<FlyTab>("general");
  const [form, setForm] = useState({
    name: site.name,
    sensitivity: site.sensitivity,
    members: site.members,
    quotaGB: site.quotaGB,
    sharing: site.sharing,
  });

  function save() {
    dispatch({ type: "UPDATE_SHAREPOINT_SITE", id: site.id, patch: form });
    toast.success("Site updated.");
  }

  function deleteSite() {
    if (!confirm(`Delete "${site.name}"? It will be moved to deleted sites for 93 days.`)) return;
    dispatch({ type: "DELETE_SHAREPOINT_SITE", id: site.id });
    toast.success("Site deleted.");
    onClose();
  }

  return (
    <Flyout
      title={site.name}
      onClose={onClose}
      tabs={
        <>
          <button type="button" className={`${styles.tab} ${tab === "general" ? styles.tabActive : ""}`} onClick={() => setTab("general")}>
            General
          </button>
          <button type="button" className={`${styles.tab} ${tab === "membership" ? styles.tabActive : ""}`} onClick={() => setTab("membership")}>
            Membership
          </button>
          <button type="button" className={`${styles.tab} ${tab === "storage" ? styles.tabActive : ""}`} onClick={() => setTab("storage")}>
            Storage
          </button>
          <button type="button" className={`${styles.tab} ${tab === "sharing" ? styles.tabActive : ""}`} onClick={() => setTab("sharing")}>
            Sharing
          </button>
          <button type="button" className={`${styles.tab} ${tab === "advanced" ? styles.tabActive : ""}`} onClick={() => setTab("advanced")}>
            Advanced
          </button>
        </>
      }
      footer={
        <>
          <button type="button" className={styles.btnDanger} onClick={deleteSite}>
            Delete site
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.btn} onClick={save}>
            Save
          </button>
        </>
      }
    >
      {tab === "general" ? (
        <>
          <FormGroup label="Site name">
            <input className={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormGroup>
          <FormGroup label="URL">
            <input className={styles.input} readOnly value={site.url} />
          </FormGroup>
          <FormGroup label="Template">
            <input className={styles.input} readOnly value={site.template} />
          </FormGroup>
          <FormGroup label="Sensitivity label">
            <select className={styles.select} value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value as M365SensitivityLabel })}>
              {SENSITIVITY_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </FormGroup>
        </>
      ) : null}

      {tab === "membership" ? (
        <>
          <FormGroup label="Owner">
            <input className={styles.input} readOnly value={site.owner} />
          </FormGroup>
          <FormGroup label="Members (count)">
            <input
              type="number"
              className={styles.input}
              value={form.members}
              onChange={(e) => setForm({ ...form, members: Number(e.target.value) })}
            />
          </FormGroup>
          <div className={styles.formHelp}>In real SharePoint you would search the directory and add specific users to Owners, Members and Visitors groups.</div>
        </>
      ) : null}

      {tab === "storage" ? (
        <>
          <FormGroup label="Storage used">
            <UsageBar used={Number(site.storageGB.toFixed(1))} total={form.quotaGB} />
          </FormGroup>
          <FormGroup label="Quota (GB)">
            <input
              type="number"
              className={styles.input}
              value={form.quotaGB}
              onChange={(e) => setForm({ ...form, quotaGB: Number(e.target.value) })}
            />
          </FormGroup>
          <div className={styles.formHelp}>Storage limits help prevent unbounded growth. Default for new sites is set in Settings.</div>
        </>
      ) : null}

      {tab === "sharing" ? (
        <>
          <FormGroup label="External sharing">
            <select className={styles.select} value={form.sharing} onChange={(e) => setForm({ ...form, sharing: e.target.value as M365SharingLevel })}>
              {SHARING_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {sharingLabel(level)}
                </option>
              ))}
            </select>
          </FormGroup>
          <div className={styles.formHelp}>Tenant-level setting in Settings overrides per-site if more restrictive.</div>
        </>
      ) : null}

      {tab === "advanced" ? (
        <>
          <FormGroup label="Hub association">
            <input className={styles.input} readOnly value="Not associated with a hub" />
          </FormGroup>
          <FormGroup label="Information barrier segments">
            <input className={styles.input} readOnly value="None" />
          </FormGroup>
          <FormGroup label="Content type hub">
            <input className={styles.input} readOnly value="Default" />
          </FormGroup>
        </>
      ) : null}
    </Flyout>
  );
}

function SettingsForm({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const s = state.sharepointSettings;

  function patch(p: Partial<M365State["sharepointSettings"]>, message: string) {
    dispatch({ type: "UPDATE_SHAREPOINT_SETTINGS", patch: p });
    toast.success(message);
  }

  return (
    <div>
      <div className={styles.h2}>External sharing</div>
      <div className={styles.card}>
        <FormGroup label="Tenant-level sharing">
          <select
            className={styles.select}
            value={s.defaultSharing}
            onChange={(e) => patch({ defaultSharing: e.target.value as M365SharingLevel }, "Default sharing updated.")}
          >
            {SHARING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {sharingLabel(level)}
              </option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="Guest link expiry (days)">
          <input
            type="number"
            className={styles.input}
            value={s.guestLinkExpiry}
            onChange={(e) => patch({ guestLinkExpiry: Number(e.target.value) }, "Guest link expiry updated.")}
          />
        </FormGroup>
        <FormGroup label="Require sign-in after (days)">
          <input
            type="number"
            className={styles.input}
            value={s.requireSignInAfter}
            onChange={(e) => patch({ requireSignInAfter: Number(e.target.value) }, "Sign-in requirement updated.")}
          />
        </FormGroup>
      </div>

      <div className={styles.h2}>Storage limits</div>
      <div className={styles.card}>
        <FormGroup label="Default site storage (GB)">
          <input
            type="number"
            className={styles.input}
            value={s.defaultStorageGB}
            onChange={(e) => patch({ defaultStorageGB: Number(e.target.value) }, "Default storage updated.")}
          />
        </FormGroup>
      </div>

      <div className={styles.h2}>Site creation</div>
      <div className={styles.card}>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={s.siteCreationEnabled} onChange={(e) => patch({ siteCreationEnabled: e.target.checked }, "Site creation setting updated.")} />
          Allow users to create new sites
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={s.allowAnonymousFiles} onChange={(e) => patch({ allowAnonymousFiles: e.target.checked }, "Anonymous file links setting updated.")} />
          Allow anonymous links to files
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={s.allowAnonymousFolders} onChange={(e) => patch({ allowAnonymousFolders: e.target.checked }, "Anonymous folder links setting updated.")} />
          Allow anonymous links to folders
        </label>
      </div>
    </div>
  );
}
