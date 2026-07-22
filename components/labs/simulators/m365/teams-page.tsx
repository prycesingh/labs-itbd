"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365MeetingPolicy, M365State, M365Team, M365TeamsPolicy } from "@/lib/labs/simulators/m365/types";
import { FormGroup, Modal, Pill } from "./m365-ui";
import styles from "./m365-console.module.css";

type SubTab = "teams" | "teams-policies" | "meeting-policies" | "users" | "org-settings";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "teams", label: "Teams" },
  { id: "teams-policies", label: "Teams policies" },
  { id: "meeting-policies", label: "Meeting policies" },
  { id: "users", label: "Users" },
  { id: "org-settings", label: "Org-wide settings" },
];

const CLOUD_STORAGE_OPTIONS = ["OneDrive", "SharePoint", "GoogleDrive", "Dropbox", "Box", "Egnyte"];

function BoolPill({ on }: { on: boolean }) {
  return <Pill tone={on ? "ok" : "muted"}>{on ? "On" : "Off"}</Pill>;
}

type TeamForm = {
  name: string;
  description: string;
  privacy: M365Team["privacy"];
  classification: string;
  owners: string[];
  channels: string;
  members: number;
};

function teamToForm(t: M365Team | null): TeamForm {
  return {
    name: t?.name ?? "",
    description: t?.description ?? "",
    privacy: t?.privacy ?? "Private",
    classification: t?.classification ?? "Internal",
    owners: t?.owners ?? [],
    channels: (t?.channels ?? ["General"]).join(", "),
    members: t?.members ?? 1,
  };
}

type TeamsPolicyForm = {
  name: string;
  allowMeetingChat: boolean;
  allowPrivateChannels: boolean;
  allowGuestAccess: boolean;
  allowExternalAccess: boolean;
};

function policyToForm(p: M365TeamsPolicy | null): TeamsPolicyForm {
  return {
    name: p?.name ?? "",
    allowMeetingChat: p?.allowMeetingChat ?? true,
    allowPrivateChannels: p?.allowPrivateChannels ?? true,
    allowGuestAccess: p?.allowGuestAccess ?? false,
    allowExternalAccess: p?.allowExternalAccess ?? false,
  };
}

type MeetingPolicyForm = {
  name: string;
  allowAnonymousJoin: boolean;
  allowCloudRecording: boolean;
  allowTranscription: boolean;
  whoCanPresent: M365MeetingPolicy["whoCanPresent"];
  autoAdmittedUsers: M365MeetingPolicy["autoAdmittedUsers"];
};

function meetingPolicyToForm(p: M365MeetingPolicy | null): MeetingPolicyForm {
  return {
    name: p?.name ?? "",
    allowAnonymousJoin: p?.allowAnonymousJoin ?? true,
    allowCloudRecording: p?.allowCloudRecording ?? true,
    allowTranscription: p?.allowTranscription ?? false,
    whoCanPresent: p?.whoCanPresent ?? "Everyone",
    autoAdmittedUsers: p?.autoAdmittedUsers ?? "EveryoneInCompany",
  };
}

export function TeamsPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [subtab, setSubtab] = useState<SubTab>("teams");

  const [teamModal, setTeamModal] = useState<{ team: M365Team | null; form: TeamForm } | null>(null);
  const [policyModal, setPolicyModal] = useState<{ policy: M365TeamsPolicy | null; form: TeamsPolicyForm } | null>(null);
  const [meetingModal, setMeetingModal] = useState<{ policy: M365MeetingPolicy | null; form: MeetingPolicyForm } | null>(null);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [assignPolicyName, setAssignPolicyName] = useState(state.teamsPolicies[0]?.name ?? "");
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [userPolicyMap, setUserPolicyMap] = useState<Record<string, string>>({});

  function saveTeam() {
    if (!teamModal) return;
    const { team, form } = teamModal;
    if (!form.name.trim()) {
      toast.warning("Team name is required.");
      return;
    }
    const channels = form.channels
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (team) {
      dispatch({
        type: "UPDATE_TEAM",
        id: team.id,
        patch: {
          name: form.name.trim(),
          description: form.description,
          privacy: form.privacy,
          classification: form.classification,
          owners: form.owners,
          channels,
          members: form.members,
        },
      });
    } else {
      dispatch({
        type: "ADD_TEAM",
        team: {
          id: `t-${Date.now()}`,
          name: form.name.trim(),
          description: form.description,
          privacy: form.privacy,
          classification: form.classification,
          owners: form.owners,
          channels,
          members: form.members,
          archived: false,
        },
      });
    }
    toast.success("Team saved.");
    setTeamModal(null);
  }

  function toggleArchive(team: M365Team) {
    dispatch({ type: "UPDATE_TEAM", id: team.id, patch: { archived: !team.archived } });
    toast.success(`Team ${team.archived ? "unarchived" : "archived"}.`);
  }

  function deleteTeam(team: M365Team) {
    if (!confirm(`Delete "${team.name}"? Channels and chats will be lost.`)) return;
    dispatch({ type: "DELETE_TEAM", id: team.id });
    toast.success("Team deleted.");
  }

  function saveTeamsPolicy() {
    if (!policyModal) return;
    const { form } = policyModal;
    if (!form.name.trim()) {
      toast.warning("Policy name is required.");
      return;
    }
    dispatch({
      type: "ADD_TEAMS_POLICY",
      policy: {
        name: form.name.trim(),
        type: "Custom",
        allowMeetingChat: form.allowMeetingChat,
        allowPrivateChannels: form.allowPrivateChannels,
        allowGuestAccess: form.allowGuestAccess,
        allowExternalAccess: form.allowExternalAccess,
      },
    });
    toast.success("Teams policy saved.");
    setPolicyModal(null);
  }

  function deleteTeamsPolicy(name: string) {
    if (!confirm(`Delete Teams policy "${name}"?`)) return;
    dispatch({ type: "DELETE_TEAMS_POLICY", name });
    toast.success("Teams policy deleted.");
  }

  function saveMeetingPolicy() {
    if (!meetingModal) return;
    const { form } = meetingModal;
    if (!form.name.trim()) {
      toast.warning("Policy name is required.");
      return;
    }
    dispatch({
      type: "ADD_MEETING_POLICY",
      policy: {
        name: form.name.trim(),
        type: "Custom",
        allowAnonymousJoin: form.allowAnonymousJoin,
        allowCloudRecording: form.allowCloudRecording,
        allowTranscription: form.allowTranscription,
        whoCanPresent: form.whoCanPresent,
        autoAdmittedUsers: form.autoAdmittedUsers,
      },
    });
    toast.success("Meeting policy saved.");
    setMeetingModal(null);
  }

  function deleteMeetingPolicy(name: string) {
    if (!confirm(`Delete meeting policy "${name}"?`)) return;
    dispatch({ type: "DELETE_MEETING_POLICY", name });
    toast.success("Meeting policy deleted.");
  }

  function toggleAssignSelected(username: string, on: boolean) {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(username);
      else next.delete(username);
      return next;
    });
  }

  function assignPolicy() {
    const usernames = Array.from(assignSelected);
    if (usernames.length === 0) {
      toast.warning("Select at least one user.");
      return;
    }
    dispatch({ type: "ASSIGN_TEAMS_POLICY", usernames, policyName: assignPolicyName });
    setUserPolicyMap((prev) => {
      const next = { ...prev };
      usernames.forEach((u) => {
        next[u] = assignPolicyName;
      });
      return next;
    });
    toast.success(`Assigned "${assignPolicyName}" to ${usernames.length} user(s).`);
    setManageUsersOpen(false);
    setAssignSelected(new Set());
  }

  function updateOrgSettings(patch: Partial<M365State["teamsOrgSettings"]>, message: string) {
    dispatch({ type: "UPDATE_TEAMS_ORG_SETTINGS", patch });
    toast.success(message);
  }

  function toggleCloudStorage(provider: string, on: boolean) {
    const providers = on
      ? Array.from(new Set([...state.teamsOrgSettings.cloudStorageProviders, provider]))
      : state.teamsOrgSettings.cloudStorageProviders.filter((p) => p !== provider);
    updateOrgSettings({ cloudStorageProviders: providers }, "Cloud storage providers updated.");
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Microsoft Teams admin center</h1>
      <p className={styles.pageSub}>Manage teams, policies, users, and org-wide settings.</p>

      <div className={styles.subtabs}>
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.subtab} ${subtab === t.id ? styles.subtabActive : ""}`}
            onClick={() => setSubtab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "teams" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setTeamModal({ team: null, form: teamToForm(null) })}>
              + Add
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Privacy</th>
                  <th>Owners</th>
                  <th>Members</th>
                  <th>Channels</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.teams.length ? (
                  state.teams.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                      </td>
                      <td>{t.privacy}</td>
                      <td>{t.owners.length}</td>
                      <td>{t.members}</td>
                      <td>{t.channels.length}</td>
                      <td>{t.archived ? <Pill tone="warn">Archived</Pill> : <Pill tone="ok">Active</Pill>}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={styles.btnSubtle} onClick={() => setTeamModal({ team: t, form: teamToForm(t) })}>
                          Edit
                        </button>{" "}
                        <button type="button" className={styles.btnSubtle} onClick={() => toggleArchive(t)}>
                          {t.archived ? "Unarchive" : "Archive"}
                        </button>{" "}
                        <button type="button" className={styles.btnSubtle} onClick={() => deleteTeam(t)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className={styles.center}>
                      No teams yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {subtab === "teams-policies" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setPolicyModal({ policy: null, form: policyToForm(null) })}>
              + Add
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Meeting chat</th>
                  <th>Private channels</th>
                  <th>Guest access</th>
                  <th>External access</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.teamsPolicies.map((p) => {
                  const guarded = p.name.startsWith("Global");
                  return (
                    <tr key={p.name}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <Pill tone={p.type === "Default" ? "info" : "muted"}>{p.type}</Pill>
                      </td>
                      <td>
                        <BoolPill on={p.allowMeetingChat} />
                      </td>
                      <td>
                        <BoolPill on={p.allowPrivateChannels} />
                      </td>
                      <td>
                        <BoolPill on={p.allowGuestAccess} />
                      </td>
                      <td>
                        <BoolPill on={p.allowExternalAccess} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={styles.btnSubtle} onClick={() => setPolicyModal({ policy: p, form: policyToForm(p) })}>
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className={styles.btnSubtle}
                          disabled={guarded}
                          title={guarded ? "The default org-wide policy cannot be deleted." : undefined}
                          onClick={() => deleteTeamsPolicy(p.name)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {subtab === "meeting-policies" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setMeetingModal({ policy: null, form: meetingPolicyToForm(null) })}>
              + Add
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Anon join</th>
                  <th>Cloud recording</th>
                  <th>Transcription</th>
                  <th>Who can present</th>
                  <th>Auto-admit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.teamsMeetingPolicies.map((p) => {
                  const guarded = p.name === "Global";
                  return (
                    <tr key={p.name}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <Pill tone={p.type === "Default" ? "info" : "muted"}>{p.type}</Pill>
                      </td>
                      <td>
                        <BoolPill on={p.allowAnonymousJoin} />
                      </td>
                      <td>
                        <BoolPill on={p.allowCloudRecording} />
                      </td>
                      <td>
                        <BoolPill on={p.allowTranscription} />
                      </td>
                      <td>{p.whoCanPresent}</td>
                      <td>{p.autoAdmittedUsers}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={styles.btnSubtle} onClick={() => setMeetingModal({ policy: p, form: meetingPolicyToForm(p) })}>
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className={styles.btnSubtle}
                          disabled={guarded}
                          title={guarded ? "The default meeting policy cannot be deleted." : undefined}
                          onClick={() => deleteMeetingPolicy(p.name)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {subtab === "users" ? (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.tbBtn} onClick={() => setManageUsersOpen(true)}>
              Manage users
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>User principal name</th>
                  <th>Teams policy</th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName}</td>
                    <td>{u.upn}</td>
                    <td>{userPolicyMap[u.username] ?? "Global (Org-wide default)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {subtab === "org-settings" ? (
        <div className={styles.card}>
          <div className={styles.h3}>Email integration</div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="ow-email"
              checked={state.teamsOrgSettings.emailIntegration}
              onChange={(e) => updateOrgSettings({ emailIntegration: e.target.checked }, "Org-wide settings saved.")}
            />
            <label htmlFor="ow-email">Allow users to send emails to a channel address</label>
          </div>

          <div className={styles.h3}>Apps</div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="ow-apps"
              checked={state.teamsOrgSettings.allowAppsInTeams}
              onChange={(e) => updateOrgSettings({ allowAppsInTeams: e.target.checked }, "Org-wide settings saved.")}
            />
            <label htmlFor="ow-apps">Allow third-party apps</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="ow-extapps"
              checked={state.teamsOrgSettings.allowExternalApps}
              onChange={(e) => updateOrgSettings({ allowExternalApps: e.target.checked }, "Org-wide settings saved.")}
            />
            <label htmlFor="ow-extapps">Allow external apps (not in Microsoft store)</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="ow-sideload"
              checked={state.teamsOrgSettings.allowSideloading}
              onChange={(e) => updateOrgSettings({ allowSideloading: e.target.checked }, "Org-wide settings saved.")}
            />
            <label htmlFor="ow-sideload">Allow side-loading of custom apps</label>
          </div>

          <div className={styles.h3}>Tagging</div>
          <FormGroup label="Tags can be managed by">
            <input
              className={styles.input}
              value={state.teamsOrgSettings.tagsManagedBy}
              onChange={(e) => updateOrgSettings({ tagsManagedBy: e.target.value }, "Org-wide settings saved.")}
            />
          </FormGroup>

          <div className={styles.h3}>Cloud storage</div>
          {CLOUD_STORAGE_OPTIONS.map((provider) => (
            <div className={styles.checkboxRow} key={provider}>
              <input
                type="checkbox"
                id={`ow-cs-${provider}`}
                checked={state.teamsOrgSettings.cloudStorageProviders.includes(provider)}
                onChange={(e) => toggleCloudStorage(provider, e.target.checked)}
              />
              <label htmlFor={`ow-cs-${provider}`}>{provider}</label>
            </div>
          ))}
        </div>
      ) : null}

      {teamModal ? (
        <Modal
          title={teamModal.team ? "Edit team" : "Add a team"}
          onClose={() => setTeamModal(null)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setTeamModal(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={saveTeam}>
                Save
              </button>
            </>
          }
        >
          <FormGroup label="Team name *">
            <input
              className={styles.input}
              value={teamModal.form.name}
              onChange={(e) => setTeamModal({ ...teamModal, form: { ...teamModal.form, name: e.target.value } })}
            />
          </FormGroup>
          <FormGroup label="Description">
            <textarea
              className={styles.textarea}
              rows={2}
              value={teamModal.form.description}
              onChange={(e) => setTeamModal({ ...teamModal, form: { ...teamModal.form, description: e.target.value } })}
            />
          </FormGroup>
          <div className={styles.formRow}>
            <FormGroup label="Privacy">
              <div className={styles.radioRow}>
                {(["Public", "Private", "Org-wide"] as const).map((p) => (
                  <label key={p} className={styles.radioRow}>
                    <input
                      type="radio"
                      name="team-privacy"
                      checked={teamModal.form.privacy === p}
                      onChange={() => setTeamModal({ ...teamModal, form: { ...teamModal.form, privacy: p } })}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="Classification">
              <input
                className={styles.input}
                value={teamModal.form.classification}
                onChange={(e) => setTeamModal({ ...teamModal, form: { ...teamModal.form, classification: e.target.value } })}
              />
            </FormGroup>
          </div>
          <FormGroup label="Owners">
            <div className={styles.tableWrap} style={{ maxHeight: 180, overflowY: "auto" }}>
              {state.users.map((u) => {
                const on = teamModal.form.owners.includes(u.username);
                return (
                  <div className={styles.checkboxRow} key={u.id} style={{ padding: "4px 10px" }}>
                    <input
                      type="checkbox"
                      id={`owner-${u.id}`}
                      checked={on}
                      onChange={(e) => {
                        const owners = e.target.checked
                          ? [...teamModal.form.owners, u.username]
                          : teamModal.form.owners.filter((o) => o !== u.username);
                        setTeamModal({ ...teamModal, form: { ...teamModal.form, owners } });
                      }}
                    />
                    <label htmlFor={`owner-${u.id}`}>{u.displayName}</label>
                  </div>
                );
              })}
            </div>
          </FormGroup>
          <FormGroup label="Channels (comma-separated)" help="e.g. General, Projects, Announcements">
            <input
              className={styles.input}
              value={teamModal.form.channels}
              onChange={(e) => setTeamModal({ ...teamModal, form: { ...teamModal.form, channels: e.target.value } })}
            />
          </FormGroup>
          <FormGroup label="Member count">
            <input
              type="number"
              min={1}
              className={styles.input}
              value={teamModal.form.members}
              onChange={(e) => setTeamModal({ ...teamModal, form: { ...teamModal.form, members: parseInt(e.target.value, 10) || 1 } })}
            />
          </FormGroup>
        </Modal>
      ) : null}

      {policyModal ? (
        <Modal
          title={policyModal.policy ? "Edit Teams policy" : "Add Teams policy"}
          onClose={() => setPolicyModal(null)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPolicyModal(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={saveTeamsPolicy}>
                Save
              </button>
            </>
          }
        >
          <FormGroup label="Name *">
            <input
              className={styles.input}
              readOnly={policyModal.policy?.type === "Default"}
              value={policyModal.form.name}
              onChange={(e) => setPolicyModal({ ...policyModal, form: { ...policyModal.form, name: e.target.value } })}
            />
          </FormGroup>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="tp-chat"
              checked={policyModal.form.allowMeetingChat}
              onChange={(e) => setPolicyModal({ ...policyModal, form: { ...policyModal.form, allowMeetingChat: e.target.checked } })}
            />
            <label htmlFor="tp-chat">Allow meeting chat</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="tp-priv"
              checked={policyModal.form.allowPrivateChannels}
              onChange={(e) => setPolicyModal({ ...policyModal, form: { ...policyModal.form, allowPrivateChannels: e.target.checked } })}
            />
            <label htmlFor="tp-priv">Allow private channels</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="tp-guest"
              checked={policyModal.form.allowGuestAccess}
              onChange={(e) => setPolicyModal({ ...policyModal, form: { ...policyModal.form, allowGuestAccess: e.target.checked } })}
            />
            <label htmlFor="tp-guest">Allow guest access</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="tp-ext"
              checked={policyModal.form.allowExternalAccess}
              onChange={(e) => setPolicyModal({ ...policyModal, form: { ...policyModal.form, allowExternalAccess: e.target.checked } })}
            />
            <label htmlFor="tp-ext">Allow external (federation) access</label>
          </div>
        </Modal>
      ) : null}

      {meetingModal ? (
        <Modal
          title={meetingModal.policy ? "Edit meeting policy" : "Add meeting policy"}
          onClose={() => setMeetingModal(null)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setMeetingModal(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={saveMeetingPolicy}>
                Save
              </button>
            </>
          }
        >
          <FormGroup label="Name *">
            <input
              className={styles.input}
              readOnly={meetingModal.policy?.type === "Default"}
              value={meetingModal.form.name}
              onChange={(e) => setMeetingModal({ ...meetingModal, form: { ...meetingModal.form, name: e.target.value } })}
            />
          </FormGroup>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="mp-anon"
              checked={meetingModal.form.allowAnonymousJoin}
              onChange={(e) => setMeetingModal({ ...meetingModal, form: { ...meetingModal.form, allowAnonymousJoin: e.target.checked } })}
            />
            <label htmlFor="mp-anon">Allow anonymous users to join meetings</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="mp-rec"
              checked={meetingModal.form.allowCloudRecording}
              onChange={(e) => setMeetingModal({ ...meetingModal, form: { ...meetingModal.form, allowCloudRecording: e.target.checked } })}
            />
            <label htmlFor="mp-rec">Allow cloud recording</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="mp-tx"
              checked={meetingModal.form.allowTranscription}
              onChange={(e) => setMeetingModal({ ...meetingModal, form: { ...meetingModal.form, allowTranscription: e.target.checked } })}
            />
            <label htmlFor="mp-tx">Allow transcription</label>
          </div>
          <FormGroup label="Who can present">
            <select
              className={styles.select}
              value={meetingModal.form.whoCanPresent}
              onChange={(e) =>
                setMeetingModal({ ...meetingModal, form: { ...meetingModal.form, whoCanPresent: e.target.value as M365MeetingPolicy["whoCanPresent"] } })
              }
            >
              <option value="Everyone">Everyone</option>
              <option value="OrganizerOnly">OrganizerOnly</option>
              <option value="PeopleInMyOrg">PeopleInMyOrg</option>
            </select>
          </FormGroup>
          <FormGroup label="Who can bypass the lobby (auto-admit)">
            <select
              className={styles.select}
              value={meetingModal.form.autoAdmittedUsers}
              onChange={(e) =>
                setMeetingModal({
                  ...meetingModal,
                  form: { ...meetingModal.form, autoAdmittedUsers: e.target.value as M365MeetingPolicy["autoAdmittedUsers"] },
                })
              }
            >
              <option value="EveryoneInCompany">EveryoneInCompany</option>
              <option value="OrganizerOnly">OrganizerOnly</option>
              <option value="Everyone">Everyone</option>
            </select>
          </FormGroup>
        </Modal>
      ) : null}

      {manageUsersOpen ? (
        <Modal
          title="Assign Teams policy to users"
          onClose={() => setManageUsersOpen(false)}
          footer={
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setManageUsersOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={assignPolicy}>
                Assign policy
              </button>
            </>
          }
        >
          <FormGroup label="Policy" help="Overrides the org-wide default for the selected users.">
            <select className={styles.select} value={assignPolicyName} onChange={(e) => setAssignPolicyName(e.target.value)}>
              {state.teamsPolicies.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormGroup>
          <FormGroup label={`Users (${assignSelected.size} selected)`}>
            <div className={styles.tableWrap} style={{ maxHeight: 240, overflowY: "auto" }}>
              {state.users.map((u) => (
                <div className={styles.checkboxRow} key={u.id} style={{ padding: "4px 10px" }}>
                  <input
                    type="checkbox"
                    id={`assign-${u.id}`}
                    checked={assignSelected.has(u.username)}
                    onChange={(e) => toggleAssignSelected(u.username, e.target.checked)}
                  />
                  <label htmlFor={`assign-${u.id}`} style={{ flex: 1 }}>
                    {u.displayName}
                  </label>
                  <span className={styles.muted}>{u.upn}</span>
                </div>
              ))}
            </div>
          </FormGroup>
        </Modal>
      ) : null}
    </div>
  );
}
