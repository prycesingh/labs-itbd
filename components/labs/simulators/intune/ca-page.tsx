"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import type { IntuneCaPolicy, IntuneState } from "@/lib/labs/simulators/intune/types";
import { FormGroup, Modal, Pill, WizStep } from "./intune-ui";
import styles from "./intune-console.module.css";

const WIZ_STEPS = ["1 Name", "2 Users", "3 Cloud apps", "4 Conditions", "5 Access controls", "6 Enable policy"];

const PLATFORM_OPTIONS = ["Any", "Android", "iOS", "Windows", "macOS", "Linux"];
const LOCATION_OPTIONS = ["Any", "Selected locations", "All trusted locations"];
const CLIENT_APP_OPTIONS = ["Browser, Mobile and desktop", "Exchange ActiveSync, Other clients", "Mobile and desktop"];

type UsersMode = "All users" | "Select users and groups";
type AppsMode = "All cloud apps" | "Select apps";
type GrantMode = "Block access" | "Grant access";

type WizardDraft = {
  name: string;
  usersMode: UsersMode;
  includeGroups: string[];
  excludeGroups: string[];
  appsMode: AppsMode;
  includeApps: string;
  excludeApps: string;
  platforms: string;
  locations: string;
  clientApps: string;
  grantMode: GrantMode;
  requireMfa: boolean;
  requireCompliant: boolean;
  requireHybrid: boolean;
  requireAppProtection: boolean;
  state: IntuneCaPolicy["state"];
};

function emptyDraft(): WizardDraft {
  return {
    name: "",
    usersMode: "All users",
    includeGroups: [],
    excludeGroups: [],
    appsMode: "All cloud apps",
    includeApps: "",
    excludeApps: "",
    platforms: "Any",
    locations: "Any",
    clientApps: "Browser, Mobile and desktop",
    grantMode: "Grant access",
    requireMfa: true,
    requireCompliant: false,
    requireHybrid: false,
    requireAppProtection: false,
    state: "Report-only",
  };
}

function usersSummary(users: IntuneCaPolicy["users"]): string {
  if (users.includeAll) {
    return users.exclude.length ? `All users (${users.exclude.length} excluded)` : "All users";
  }
  return `${users.exclude.length} excluded`;
}

function appsSummary(apps: IntuneCaPolicy["apps"]): string {
  if (apps.includeAll) return "All cloud apps";
  return apps.include?.length ? apps.include.join(", ") : "No apps selected";
}

function statePill(state: IntuneCaPolicy["state"]) {
  if (state === "On") return <Pill tone="ok">On</Pill>;
  if (state === "Report-only") return <Pill tone="info">Report-only</Pill>;
  return <Pill tone="muted">Off</Pill>;
}

function nextState(state: IntuneCaPolicy["state"]): IntuneCaPolicy["state"] {
  const order = { On: "Off", Off: "Report-only", "Report-only": "On" } as const;
  return order[state];
}

export function CaPage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStep, setWizStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft());

  const selected = state.conditionalAccess.find((p) => p.id === selectedId) ?? null;

  function openWizard() {
    setDraft(emptyDraft());
    setWizStep(0);
    setWizardOpen(true);
  }

  function toggleIncludeGroup(name: string) {
    setDraft((d) => ({
      ...d,
      includeGroups: d.includeGroups.includes(name) ? d.includeGroups.filter((g) => g !== name) : [...d.includeGroups, name],
    }));
  }

  function toggleExcludeGroup(name: string) {
    setDraft((d) => ({
      ...d,
      excludeGroups: d.excludeGroups.includes(name) ? d.excludeGroups.filter((g) => g !== name) : [...d.excludeGroups, name],
    }));
  }

  function finishWizard() {
    if (!draft.name.trim()) {
      toast.error("Policy name is required.");
      setWizStep(0);
      return;
    }
    const policy: IntuneCaPolicy = {
      id: `ca-${crypto.randomUUID().slice(0, 8)}`,
      name: draft.name.trim(),
      state: draft.state,
      modified: new Date().toISOString().slice(0, 10),
      users: {
        includeAll: draft.usersMode === "All users",
        exclude: draft.excludeGroups,
      },
      apps: {
        includeAll: draft.appsMode === "All cloud apps",
        include:
          draft.appsMode === "Select apps"
            ? draft.includeApps
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean)
            : undefined,
        exclude: draft.excludeApps
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      },
      conditions: {
        platforms: draft.platforms,
        locations: draft.locations,
        clientApps: draft.clientApps,
      },
      grant:
        draft.grantMode === "Block access"
          ? { block: true, requireMfa: false, requireCompliant: false, requireHybrid: false, requireAppProtection: false }
          : {
              block: false,
              requireMfa: draft.requireMfa,
              requireCompliant: draft.requireCompliant,
              requireHybrid: draft.requireHybrid,
              requireAppProtection: draft.requireAppProtection,
            },
    };
    dispatch({ type: "ADD_CA_POLICY", policy });
    toast.success(`Conditional Access policy "${policy.name}" created (${policy.state}).`);
    setWizardOpen(false);
  }

  if (selected) {
    return <PolicyDetail policy={selected} dispatch={dispatch} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Conditional Access | Policies</h1>
      <p className={styles.pageSub}>Use Conditional Access policies to enforce smart access decisions for users, apps, and devices.</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={openWizard}>
          + New policy
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={() => toast.info("Refresh isn't wired up in this simulator.")}>
          Refresh
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Policy name</th>
              <th>State</th>
              <th>Users</th>
              <th>Apps</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {state.conditionalAccess.length ? (
              state.conditionalAccess.map((p) => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                  <td className={styles.rowLink}>{p.name}</td>
                  <td>{statePill(p.state)}</td>
                  <td>{usersSummary(p.users)}</td>
                  <td>{appsSummary(p.apps)}</td>
                  <td>{p.modified}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className={styles.center}>
                  No Conditional Access policies.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {wizardOpen ? (
        <Modal
          title="New Conditional Access policy"
          width="820px"
          onClose={() => setWizardOpen(false)}
          steps={WIZ_STEPS.map((label, i) => (
            <WizStep key={label} label={label} active={i === wizStep} done={i < wizStep} />
          ))}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setWizardOpen(false)}>
                Cancel
              </button>
              {wizStep > 0 ? (
                <button type="button" className={styles.btnOutline} onClick={() => setWizStep((s) => s - 1)}>
                  Previous
                </button>
              ) : null}
              {wizStep < WIZ_STEPS.length - 1 ? (
                <button type="button" className={styles.btn} onClick={() => setWizStep((s) => s + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={finishWizard}>
                  Create
                </button>
              )}
            </>
          }
        >
          {wizStep === 0 ? (
            <div>
              <FormGroup label="Name *" help="Give the policy a meaningful, identifiable name.">
                <input
                  className={styles.input}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g., CA004 - Require MFA for admins"
                />
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 1 ? (
            <div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.usersMode === "All users"} onChange={() => setDraft((d) => ({ ...d, usersMode: "All users" }))} /> All users
                </label>
              </div>
              <div className={styles.radioRow}>
                <label>
                  <input
                    type="radio"
                    checked={draft.usersMode === "Select users and groups"}
                    onChange={() => setDraft((d) => ({ ...d, usersMode: "Select users and groups" }))}
                  />{" "}
                  Select users and groups
                </label>
              </div>

              {draft.usersMode === "Select users and groups" ? (
                <FormGroup label="Include groups">
                  {state.groups.map((g) => (
                    <label key={g.id} className={styles.checkboxRow}>
                      <input type="checkbox" checked={draft.includeGroups.includes(g.name)} onChange={() => toggleIncludeGroup(g.name)} />
                      {g.name}
                    </label>
                  ))}
                </FormGroup>
              ) : null}

              <FormGroup label="Exclude" help="Always exclude break-glass / emergency access accounts.">
                {state.groups.map((g) => (
                  <label key={g.id} className={styles.checkboxRow}>
                    <input type="checkbox" checked={draft.excludeGroups.includes(g.name)} onChange={() => toggleExcludeGroup(g.name)} />
                    {g.name}
                  </label>
                ))}
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={draft.excludeGroups.includes("BreakGlass accounts")}
                    onChange={() => toggleExcludeGroup("BreakGlass accounts")}
                  />
                  BreakGlass accounts
                </label>
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 2 ? (
            <div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.appsMode === "All cloud apps"} onChange={() => setDraft((d) => ({ ...d, appsMode: "All cloud apps" }))} /> All cloud
                  apps
                </label>
              </div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.appsMode === "Select apps"} onChange={() => setDraft((d) => ({ ...d, appsMode: "Select apps" }))} /> Select apps
                </label>
              </div>

              {draft.appsMode === "Select apps" ? (
                <FormGroup label="Apps" help="Comma-separated list, e.g. Office 365, Microsoft Intune Enrollment">
                  <input
                    className={styles.input}
                    value={draft.includeApps}
                    onChange={(e) => setDraft((d) => ({ ...d, includeApps: e.target.value }))}
                    placeholder="Office 365, Microsoft Intune Enrollment"
                  />
                </FormGroup>
              ) : (
                <p className={styles.muted}>Targeting all cloud apps is the broadest scope. Test thoroughly in Report-only first.</p>
              )}

              <FormGroup label="Exclude apps" help="Comma-separated list, optional.">
                <input className={styles.input} value={draft.excludeApps} onChange={(e) => setDraft((d) => ({ ...d, excludeApps: e.target.value }))} />
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 3 ? (
            <div>
              <FormGroup label="Platforms">
                <select className={styles.select} value={draft.platforms} onChange={(e) => setDraft((d) => ({ ...d, platforms: e.target.value }))}>
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Locations">
                <select className={styles.select} value={draft.locations} onChange={(e) => setDraft((d) => ({ ...d, locations: e.target.value }))}>
                  {LOCATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Client apps">
                <select className={styles.select} value={draft.clientApps} onChange={(e) => setDraft((d) => ({ ...d, clientApps: e.target.value }))}>
                  {CLIENT_APP_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 4 ? (
            <div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.grantMode === "Block access"} onChange={() => setDraft((d) => ({ ...d, grantMode: "Block access" }))} /> Block access
                </label>
              </div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.grantMode === "Grant access"} onChange={() => setDraft((d) => ({ ...d, grantMode: "Grant access" }))} /> Grant access
                </label>
              </div>

              {draft.grantMode === "Grant access" ? (
                <FormGroup label="Require the following controls">
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={draft.requireMfa} onChange={(e) => setDraft((d) => ({ ...d, requireMfa: e.target.checked }))} />
                    Require multifactor authentication
                  </label>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={draft.requireCompliant} onChange={(e) => setDraft((d) => ({ ...d, requireCompliant: e.target.checked }))} />
                    Require device to be marked as compliant
                  </label>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={draft.requireHybrid} onChange={(e) => setDraft((d) => ({ ...d, requireHybrid: e.target.checked }))} />
                    Require Microsoft Entra hybrid joined device
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={draft.requireAppProtection}
                      onChange={(e) => setDraft((d) => ({ ...d, requireAppProtection: e.target.checked }))}
                    />
                    Require app protection policy
                  </label>
                </FormGroup>
              ) : (
                <p className={styles.muted}>Access will be blocked for all users and apps in scope.</p>
              )}

              <FormGroup label="Session" help="Decorative in this simulator — not persisted.">
                <label className={styles.checkboxRow}>
                  <input type="checkbox" disabled />
                  Use app enforced restrictions
                </label>
                <label className={styles.checkboxRow}>
                  <input type="checkbox" disabled />
                  Require terms of use
                </label>
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 5 ? (
            <div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.state === "Report-only"} onChange={() => setDraft((d) => ({ ...d, state: "Report-only" }))} /> Report-only
                </label>
              </div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.state === "On"} onChange={() => setDraft((d) => ({ ...d, state: "On" }))} /> On
                </label>
              </div>
              <div className={styles.radioRow}>
                <label>
                  <input type="radio" checked={draft.state === "Off"} onChange={() => setDraft((d) => ({ ...d, state: "Off" }))} /> Off
                </label>
              </div>
              <p className={styles.muted}>Tip: always exclude break-glass accounts from CA policies to avoid lockout.</p>

              <div className={styles.reviewGrid}>
                <div className="lbl">Name</div>
                <div>{draft.name || "(not set)"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Users</div>
                <div>{draft.usersMode === "All users" ? "All users" : `${draft.includeGroups.length} group(s) selected`}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Excluded</div>
                <div>{draft.excludeGroups.length ? draft.excludeGroups.join(", ") : "None"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Cloud apps</div>
                <div>{draft.appsMode === "All cloud apps" ? "All cloud apps" : draft.includeApps || "(none selected)"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Grant</div>
                <div>{draft.grantMode}</div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function PolicyDetail({
  policy,
  dispatch,
  onBack,
}: {
  policy: IntuneCaPolicy;
  dispatch: (action: IntuneAction) => void;
  onBack: () => void;
}) {
  function toggleState() {
    dispatch({ type: "CYCLE_CA_STATE", id: policy.id });
    toast.success(`Policy is now ${nextState(policy.state)}.`);
  }

  function remove() {
    if (!confirm(`Delete CA policy "${policy.name}"?`)) return;
    dispatch({ type: "DELETE_CA_POLICY", id: policy.id });
    toast.success("Policy deleted.");
    onBack();
  }

  const toggleLabel =
    policy.state === "On" ? "Disable policy" : policy.state === "Off" ? "Set to Report-only" : "Enable policy";

  return (
    <div>
      <button type="button" className={styles.btnSubtle} onClick={onBack}>
        &lt; Back to Conditional Access
      </button>
      <h1 className={styles.pageH1}>{policy.name}</h1>
      <p className={styles.pageSub}>Conditional Access policy &middot; {statePill(policy.state)}</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={toggleState}>
          {toggleLabel}
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={remove}>
          Delete
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Assignments</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Users</div>
          <div>{policy.users.includeAll ? "All users" : "Selected groups"}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Excluded users</div>
          <div>{policy.users.exclude.length ? policy.users.exclude.join(", ") : "—"}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Cloud apps</div>
          <div>{policy.apps.includeAll ? "All cloud apps" : policy.apps.include?.join(", ") || "—"}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Excluded apps</div>
          <div>{policy.apps.exclude.length ? policy.apps.exclude.join(", ") : "—"}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Conditions</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Platforms</div>
          <div>{policy.conditions.platforms}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Locations</div>
          <div>{policy.conditions.locations}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Client apps</div>
          <div>{policy.conditions.clientApps}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Access controls</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Action</div>
          <div>{policy.grant.block ? "Block access" : "Grant access"}</div>
        </div>
        {!policy.grant.block ? (
          <>
            <div className={styles.reviewGrid}>
              <div className="lbl">Require MFA</div>
              <div>
                <Pill tone={policy.grant.requireMfa ? "ok" : "muted"}>{policy.grant.requireMfa ? "Required" : "Not required"}</Pill>
              </div>
            </div>
            <div className={styles.reviewGrid}>
              <div className="lbl">Require compliant device</div>
              <div>
                <Pill tone={policy.grant.requireCompliant ? "ok" : "muted"}>{policy.grant.requireCompliant ? "Required" : "Not required"}</Pill>
              </div>
            </div>
            <div className={styles.reviewGrid}>
              <div className="lbl">Require Entra hybrid joined device</div>
              <div>
                <Pill tone={policy.grant.requireHybrid ? "ok" : "muted"}>{policy.grant.requireHybrid ? "Required" : "Not required"}</Pill>
              </div>
            </div>
            <div className={styles.reviewGrid}>
              <div className="lbl">Require app protection policy</div>
              <div>
                <Pill tone={policy.grant.requireAppProtection ? "ok" : "muted"}>{policy.grant.requireAppProtection ? "Required" : "Not required"}</Pill>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Essentials</div>
        <div className={styles.reviewGrid}>
          <div className="lbl">State</div>
          <div>{statePill(policy.state)}</div>
        </div>
        <div className={styles.reviewGrid}>
          <div className="lbl">Modified</div>
          <div>{policy.modified}</div>
        </div>
      </div>
    </div>
  );
}
