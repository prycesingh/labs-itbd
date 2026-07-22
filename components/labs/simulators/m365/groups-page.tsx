"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365Group, M365GroupType, M365State } from "@/lib/labs/simulators/m365/types";
import { exportCsv, Flyout, FormGroup, Modal, Pill, WizStep } from "./m365-ui";
import styles from "./m365-console.module.css";

const GROUP_TYPE_TABS: { key: M365GroupType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Microsoft 365", label: "Microsoft 365" },
  { key: "Distribution", label: "Distribution" },
  { key: "Mail-enabled security", label: "Mail-enabled security" },
  { key: "Security", label: "Security" },
];

const GROUP_TYPE_OPTIONS: { type: M365GroupType; blurb: string }[] = [
  { type: "Microsoft 365", blurb: "Collaboration across apps. Includes shared mailbox, calendar, SharePoint site." },
  { type: "Distribution", blurb: "Send email to all members at once. Cannot be used as a security principal." },
  { type: "Mail-enabled security", blurb: "Distribute mail and grant access permissions in one group." },
  { type: "Security", blurb: "Grant access to resources, including roles in Microsoft 365." },
];

const ADD_GROUP_STEPS = ["Choose type", "Basics", "Owners", "Members", "Review"];
const GROUP_TABS = ["General", "Members", "Owners", "Settings"] as const;
type GroupTab = (typeof GROUP_TABS)[number];

type WizardDraft = {
  type: M365GroupType;
  name: string;
  description: string;
  email: string;
  privacy: "Public" | "Private";
  owners: string[];
  members: string[];
};

function emptyDraft(): WizardDraft {
  return { type: "Microsoft 365", name: "", description: "", email: "", privacy: "Private", owners: [], members: [] };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function GroupsPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [tab, setTab] = useState<M365GroupType | "all">("all");
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStep, setWizStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTab, setFlyTab] = useState<GroupTab>("General");

  const filtered = useMemo(() => {
    return state.groups.filter((g) => {
      if (tab !== "all" && g.type !== tab) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.email.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [state.groups, tab, search]);

  const selected = state.groups.find((g) => g.id === selectedId) ?? null;

  function openWizard() {
    setDraft(emptyDraft());
    setWizStep(0);
    setWizardOpen(true);
  }

  function finishWizard() {
    if (!draft.name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    const needsMail = draft.type !== "Security";
    const email = needsMail ? draft.email || `${slugify(draft.name)}@${state.tenant.domain}` : "";
    const group: M365Group = {
      id: `g-${crypto.randomUUID().slice(0, 8)}`,
      name: draft.name.trim(),
      email,
      type: draft.type,
      privacy: draft.privacy,
      source: "Cloud",
      membership: "Assigned",
      description: draft.description,
      owners: draft.owners,
      members: Array.from(new Set([...draft.owners, ...draft.members])),
    };
    dispatch({ type: "ADD_GROUP", group });
    toast.success(`Group "${group.name}" created.`);
    setWizardOpen(false);
  }

  function toggleInList(list: string[], username: string): string[] {
    return list.includes(username) ? list.filter((u) => u !== username) : [...list, username];
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Active teams &amp; groups</h1>
      <p className={styles.pageSub}>Manage Microsoft 365 groups, distribution lists, mail-enabled security and security groups.</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={openWizard}>
          + Add a group
        </button>
        <div className={styles.tbSep} />
        <button
          type="button"
          className={styles.tbBtn}
          onClick={() =>
            exportCsv(
              "groups.csv",
              ["Name", "Email", "Type", "Source", "Membership", "Members"],
              filtered.map((g) => [g.name, g.email, g.type, g.source, g.membership, g.members.length]),
            )
          }
        >
          Export
        </button>
        <div className={styles.spacer} />
        <input className={styles.input} style={{ maxWidth: 240 }} placeholder="Search groups" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className={styles.tabs}>
        {GROUP_TYPE_TABS.map((t) => (
          <button key={t.key} type="button" className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Type</th>
              <th>Source</th>
              <th>Membership</th>
              <th>Members</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => {
                    setSelectedId(g.id);
                    setFlyTab("General");
                  }}
                >
                  <td className={styles.rowLink}>{g.name}</td>
                  <td>{g.email || "-"}</td>
                  <td>{g.type}</td>
                  <td>{g.source}</td>
                  <td>{g.membership}</td>
                  <td>{g.members.length}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className={styles.center}>
                  No groups match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {wizardOpen ? (
        <Modal
          title="Add a group"
          width="820px"
          onClose={() => setWizardOpen(false)}
          steps={ADD_GROUP_STEPS.map((label, i) => (
            <WizStep key={label} label={label} active={i === wizStep} done={i < wizStep} />
          ))}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setWizardOpen(false)}>
                Cancel
              </button>
              {wizStep > 0 ? (
                <button type="button" className={styles.btnOutline} onClick={() => setWizStep((s) => s - 1)}>
                  Back
                </button>
              ) : null}
              {wizStep < ADD_GROUP_STEPS.length - 1 ? (
                <button type="button" className={styles.btn} onClick={() => setWizStep((s) => s + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={finishWizard}>
                  Finish
                </button>
              )}
            </>
          }
        >
          {wizStep === 0 ? (
            <div>
              <p className={styles.muted}>Choose a group type. This cannot be changed after creation.</p>
              {GROUP_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.type}
                  className={styles.radioRow}
                  style={{ border: `1px solid ${draft.type === opt.type ? "#2564cf" : "#edebe9"}`, padding: 12, borderRadius: 4, cursor: "pointer" }}
                >
                  <input type="radio" name="grp_type" checked={draft.type === opt.type} onChange={() => setDraft((d) => ({ ...d, type: opt.type }))} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.type}</div>
                    <div className={styles.muted} style={{ fontSize: 12 }}>
                      {opt.blurb}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {wizStep === 1 ? (
            <div>
              <FormGroup label="Name *">
                <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              </FormGroup>
              <FormGroup label="Description">
                <textarea className={styles.textarea} rows={3} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
              </FormGroup>
              {draft.type !== "Security" ? (
                <FormGroup label="Group email" help={`Defaults to a slug of the name @${state.tenant.domain} if left blank.`}>
                  <input
                    className={styles.input}
                    placeholder={`${slugify(draft.name) || "group-name"}@${state.tenant.domain}`}
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  />
                </FormGroup>
              ) : null}
              <FormGroup label="Privacy">
                <label className={styles.radioRow}>
                  <input type="radio" name="grp_privacy" checked={draft.privacy === "Private"} onChange={() => setDraft((d) => ({ ...d, privacy: "Private" }))} />
                  Private — only members can see group content
                </label>
                <label className={styles.radioRow}>
                  <input type="radio" name="grp_privacy" checked={draft.privacy === "Public"} onChange={() => setDraft((d) => ({ ...d, privacy: "Public" }))} />
                  Public — anyone in the organization can see group content
                </label>
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 2 ? (
            <div>
              <p className={styles.muted}>Assign one or more owners to manage this group.</p>
              {state.users.map((u) => (
                <label key={u.username} className={styles.checkboxRow}>
                  <input type="checkbox" checked={draft.owners.includes(u.username)} onChange={() => setDraft((d) => ({ ...d, owners: toggleInList(d.owners, u.username) }))} />
                  {u.displayName} ({u.username})
                </label>
              ))}
            </div>
          ) : null}

          {wizStep === 3 ? (
            <div>
              <p className={styles.muted}>Add members to this group. Owners are automatically included.</p>
              {state.users.map((u) => {
                const isOwner = draft.owners.includes(u.username);
                const checked = isOwner || draft.members.includes(u.username);
                return (
                  <label key={u.username} className={styles.checkboxRow}>
                    <input type="checkbox" checked={checked} disabled={isOwner} onChange={() => setDraft((d) => ({ ...d, members: toggleInList(d.members, u.username) }))} />
                    {u.displayName} ({u.username}) {isOwner ? <span className={styles.muted}>— owner</span> : null}
                  </label>
                );
              })}
            </div>
          ) : null}

          {wizStep === 4 ? (
            <div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Name</div>
                <div>{draft.name || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Type</div>
                <div>{draft.type}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Description</div>
                <div>{draft.description || "-"}</div>
              </div>
              {draft.type !== "Security" ? (
                <div className={styles.reviewGrid}>
                  <div className="lbl">Email</div>
                  <div>{draft.email || `${slugify(draft.name) || "group-name"}@${state.tenant.domain}`}</div>
                </div>
              ) : null}
              <div className={styles.reviewGrid}>
                <div className="lbl">Privacy</div>
                <div>{draft.privacy}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Owners</div>
                <div>{draft.owners.length ? draft.owners.join(", ") : "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Members</div>
                <div>{Array.from(new Set([...draft.owners, ...draft.members])).length}</div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {selected ? (
        <GroupFlyout
          group={selected}
          state={state}
          dispatch={dispatch}
          activeTab={flyTab}
          onTabChange={setFlyTab}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function GroupFlyout({
  group,
  state,
  dispatch,
  activeTab,
  onTabChange,
  onClose,
}: {
  group: M365Group;
  state: M365State;
  dispatch: (action: M365Action) => void;
  activeTab: GroupTab;
  onTabChange: (tab: GroupTab) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [email, setEmail] = useState(group.email);
  const [privacy, setPrivacy] = useState(group.privacy);
  const [owners, setOwners] = useState<string[]>(group.owners);
  const [members, setMembers] = useState<string[]>(group.members);
  const [allowExternalSenders, setAllowExternalSenders] = useState(!!group.allowExternalSenders);
  const [autoSubscribe, setAutoSubscribe] = useState(!!group.autoSubscribe);
  const [hideFromGAL, setHideFromGAL] = useState(!!group.hideFromGAL);

  function toggle(list: string[], setList: (v: string[]) => void, username: string) {
    setList(list.includes(username) ? list.filter((u) => u !== username) : [...list, username]);
  }

  function saveGeneral() {
    dispatch({ type: "UPDATE_GROUP", id: group.id, patch: { name, description, email, privacy } });
    toast.success("Group updated.");
  }

  function saveMembers() {
    dispatch({ type: "UPDATE_GROUP", id: group.id, patch: { members: Array.from(new Set([...owners, ...members])) } });
    toast.success("Members updated.");
  }

  function saveOwners() {
    dispatch({ type: "UPDATE_GROUP", id: group.id, patch: { owners } });
    toast.success("Owners updated.");
  }

  function saveSettings() {
    dispatch({ type: "UPDATE_GROUP", id: group.id, patch: { allowExternalSenders, autoSubscribe, hideFromGAL } });
    toast.success("Settings updated.");
  }

  function handleDelete() {
    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    dispatch({ type: "DELETE_GROUP", id: group.id });
    toast.success(`Group "${group.name}" deleted.`);
    onClose();
  }

  return (
    <Flyout
      title={group.name}
      onClose={onClose}
      tabs={GROUP_TABS.map((t) => (
        <button key={t} type="button" className={`${styles.tab} ${activeTab === t ? styles.tabActive : ""}`} onClick={() => onTabChange(t)}>
          {t}
        </button>
      ))}
      footer={
        <>
          <button type="button" className={styles.btnDanger} onClick={handleDelete}>
            Delete group
          </button>
          <div className={styles.spacer} />
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              if (activeTab === "General") saveGeneral();
              else if (activeTab === "Members") saveMembers();
              else if (activeTab === "Owners") saveOwners();
              else saveSettings();
            }}
          >
            Save
          </button>
        </>
      }
    >
      {activeTab === "General" ? (
        <div>
          <FormGroup label="Name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </FormGroup>
          <FormGroup label="Description">
            <textarea className={styles.textarea} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormGroup>
          {group.type !== "Security" ? (
            <FormGroup label="Email">
              <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormGroup>
          ) : null}
          <FormGroup label="Type">
            <Pill tone="info">{group.type}</Pill>
          </FormGroup>
          <FormGroup label="Source">
            <Pill tone="muted">{group.source}</Pill>
          </FormGroup>
          <FormGroup label="Privacy">
            <select className={styles.select} value={privacy} onChange={(e) => setPrivacy(e.target.value as "Public" | "Private")}>
              <option value="Private">Private</option>
              <option value="Public">Public</option>
            </select>
          </FormGroup>
        </div>
      ) : null}

      {activeTab === "Members" ? (
        <div>
          {state.users.map((u) => {
            const isOwner = owners.includes(u.username);
            const checked = isOwner || members.includes(u.username);
            return (
              <label key={u.username} className={styles.checkboxRow}>
                <input type="checkbox" checked={checked} disabled={isOwner} onChange={() => toggle(members, setMembers, u.username)} />
                {u.displayName} ({u.username}) {isOwner ? <span className={styles.muted}>— owner</span> : null}
              </label>
            );
          })}
        </div>
      ) : null}

      {activeTab === "Owners" ? (
        <div>
          {state.users.map((u) => (
            <label key={u.username} className={styles.checkboxRow}>
              <input type="checkbox" checked={owners.includes(u.username)} onChange={() => toggle(owners, setOwners, u.username)} />
              {u.displayName} ({u.username})
            </label>
          ))}
        </div>
      ) : null}

      {activeTab === "Settings" ? (
        <div>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={allowExternalSenders} onChange={(e) => setAllowExternalSenders(e.target.checked)} />
            Allow people outside the organization to email this group
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={autoSubscribe} onChange={(e) => setAutoSubscribe(e.target.checked)} />
            Automatically subscribe new members to conversations
          </label>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={hideFromGAL} onChange={(e) => setHideFromGAL(e.target.checked)} />
            Hide from address lists
          </label>
          {group.type === "Microsoft 365" ? (
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked disabled />
              SharePoint site created
            </label>
          ) : null}
        </div>
      ) : null}
    </Flyout>
  );
}

const MAILBOX_WIZ_STEPS = ["Identity", "Members", "Review"];

type MailboxDraft = {
  displayName: string;
  alias: string;
  members: string[];
};

function emptyMailboxDraft(): MailboxDraft {
  return { displayName: "", alias: "", members: [] };
}

export function SharedMailboxesPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizStep, setWizStep] = useState(0);
  const [draft, setDraft] = useState<MailboxDraft>(emptyMailboxDraft());

  function openWizard() {
    setDraft(emptyMailboxDraft());
    setWizStep(0);
    setWizardOpen(true);
  }

  function finishWizard() {
    if (!draft.displayName.trim() || !draft.alias.trim()) {
      toast.error("Display name and alias are required.");
      return;
    }
    dispatch({
      type: "ADD_SHARED_MAILBOX",
      mailbox: {
        id: `sm-${crypto.randomUUID().slice(0, 8)}`,
        alias: draft.alias.trim(),
        email: `${slugify(draft.alias)}@${state.tenant.domain}`,
        displayName: draft.displayName.trim(),
        members: draft.members,
        quotaGB: 50,
        usedGB: 0,
      },
    });
    toast.success(`Shared mailbox "${draft.displayName}" created.`);
    setWizardOpen(false);
  }

  function toggleMember(username: string) {
    setDraft((d) => (d.members.includes(username) ? { ...d, members: d.members.filter((u) => u !== username) } : { ...d, members: [...d.members, username] }));
  }

  return (
    <div>
      <h1 className={styles.pageH1}>Shared mailboxes</h1>
      <p className={styles.pageSub}>Let a group of people monitor and send email from a common address.</p>

      <div style={{ marginBottom: 12, padding: "10px 12px", background: "#deecf9", borderLeft: "3px solid #2564cf", fontSize: 12 }}>
        A shared mailbox doesn&apos;t require a license and includes up to 50 GB of storage for free. Members access it via Outlook using &quot;Send As&quot; or &quot;Send on
        Behalf&quot; permission.
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={openWizard}>
          + Add a shared mailbox
        </button>
        <div className={styles.tbSep} />
        <button
          type="button"
          className={styles.tbBtn}
          onClick={() =>
            exportCsv(
              "shared-mailboxes.csv",
              ["Display name", "Email", "Members", "Used GB", "Quota GB"],
              state.sharedMailboxes.map((m) => [m.displayName, m.email, m.members.length, m.usedGB, m.quotaGB]),
            )
          }
        >
          Export
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Display name</th>
              <th>Email</th>
              <th>Members</th>
              <th>Storage</th>
            </tr>
          </thead>
          <tbody>
            {state.sharedMailboxes.length ? (
              state.sharedMailboxes.map((m) => (
                <tr key={m.id}>
                  <td className={styles.rowLink}>{m.displayName}</td>
                  <td>{m.email}</td>
                  <td>{m.members.length}</td>
                  <td className={styles.licUsageCell}>
                    <UsageBarGB usedGB={m.usedGB} quotaGB={m.quotaGB} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className={styles.center}>
                  No shared mailboxes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {wizardOpen ? (
        <Modal
          title="Add a shared mailbox"
          onClose={() => setWizardOpen(false)}
          steps={MAILBOX_WIZ_STEPS.map((label, i) => (
            <WizStep key={label} label={label} active={i === wizStep} done={i < wizStep} />
          ))}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setWizardOpen(false)}>
                Cancel
              </button>
              {wizStep > 0 ? (
                <button type="button" className={styles.btnOutline} onClick={() => setWizStep((s) => s - 1)}>
                  Back
                </button>
              ) : null}
              {wizStep < MAILBOX_WIZ_STEPS.length - 1 ? (
                <button type="button" className={styles.btn} onClick={() => setWizStep((s) => s + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={finishWizard}>
                  Finish
                </button>
              )}
            </>
          }
        >
          {wizStep === 0 ? (
            <div>
              <FormGroup label="Display name *">
                <input
                  className={styles.input}
                  value={draft.displayName}
                  onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value, alias: d.alias || slugify(e.target.value) }))}
                />
              </FormGroup>
              <FormGroup label="Alias *">
                <input className={styles.input} value={draft.alias} onChange={(e) => setDraft((d) => ({ ...d, alias: slugify(e.target.value) }))} />
              </FormGroup>
              <FormGroup label="Email">
                <input className={styles.input} disabled value={`${draft.alias || "alias"}@${state.tenant.domain}`} />
              </FormGroup>
            </div>
          ) : null}

          {wizStep === 1 ? (
            <div>
              <p className={styles.muted}>Choose members who can send mail from this mailbox and view its contents.</p>
              {state.users.map((u) => (
                <label key={u.username} className={styles.checkboxRow}>
                  <input type="checkbox" checked={draft.members.includes(u.username)} onChange={() => toggleMember(u.username)} />
                  {u.displayName} ({u.username})
                </label>
              ))}
            </div>
          ) : null}

          {wizStep === 2 ? (
            <div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Display name</div>
                <div>{draft.displayName || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Alias</div>
                <div>{draft.alias || "-"}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Email</div>
                <div>{`${draft.alias || "alias"}@${state.tenant.domain}`}</div>
              </div>
              <div className={styles.reviewGrid}>
                <div className="lbl">Members</div>
                <div>{draft.members.length}</div>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function UsageBarGB({ usedGB, quotaGB }: { usedGB: number; quotaGB: number }) {
  const pct = quotaGB > 0 ? Math.min(100, (usedGB / quotaGB) * 100) : 0;
  const level = pct >= 90 ? styles.barHigh : pct >= 70 ? styles.barMed : "";
  return (
    <div>
      <div className={`${styles.bar} ${level}`}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.licUsageNums}>
        {usedGB} GB / {quotaGB} GB
      </div>
    </div>
  );
}
