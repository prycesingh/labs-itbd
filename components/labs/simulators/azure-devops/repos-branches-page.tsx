"use client";

// Repos → Branches / Tags / Pushes for the Azure DevOps simulator. Ported
// from itbd-lab/simulators/azure-devops/js/ado-repos.js `renderBranches()` /
// `newBranch()` / `compareBranch()` / `deleteBranch()` /
// `openBranchPolicies()` / `_getBranchPolicies()` / `_saveBranchPolicies()`
// (Branches), `renderTags()` / `newTag()` (Tags), and `renderPushes()`
// (Pushes).
//
// Three real behavior fixes vs. source, per the porting brief:
//   1. `compareBranch()` used `Math.random()` for both ahead/behind fallback
//      counts and for fabricating each preview commit's hash — replaced here
//      with `seededCommitHash()`, a deterministic hash keyed off
//      repo/branch/index so the same compare view renders identically every
//      time it's opened (illustrative only, not derived from real branch
//      content).
//   2. `newBranch()` / `deleteBranch()` used native `prompt()`/`confirm()` —
//      replaced with real `Modal` dialogs dispatching the already-built
//      `ADD_REPO_BRANCH` / `DELETE_REPO_BRANCH` reducer actions.
//   3. `_getBranchPolicies()` kept policies in a module-level in-memory
//      object (`BRANCH_POLICIES`, lost on reload) — replaced with the real
//      persisted `UPDATE_BRANCH_POLICIES` action, reading/writing
//      `branch.policies` (always populated per the seed fix in
//      seedData.ts's `defaultBranchPolicies()`).

import { useMemo, useState } from "react";

import type { AdoBranch, AdoBranchPolicies, AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { Checkbox, DataTable, EmptyState, Field, InitialsAvatar, Modal, NativeSelect, type DataTableColumn } from "./ado-ui";
import styles from "./ado-console.module.css";

// ===== Deterministic compare-preview hash =====
// NOT Math.random() — a small hand-rolled deterministic string hash (same
// shape as seedData.ts's `randHash`) keyed off repo id + branch name + index,
// so re-opening the Compare modal for the same branch always renders the
// same illustrative commit list within a session.
function seededCommitHash(repoId: string, branch: string, index: number): string {
  const chars = "abcdef0123456789";
  const seedStr = `${repoId}:${branch}:${index}`;
  let n = index * 17 + seedStr.length * 13;
  let out = "";
  for (let i = 0; i < 7; i++) {
    n = (n * 31 + i * 7 + seedStr.charCodeAt(i % seedStr.length)) >>> 0;
    out += chars[n % 16];
  }
  return out;
}

// ===== Repo selector =====
// Shared by all three pages below. Matches source's `repoSwitcher()` —
// a single <select> over `state.repos`, defaulting to the first repo.
function useRepoSelection(state: AdoState) {
  const [repoId, setRepoId] = useState<string>(state.repos[0]?.id ?? "");
  const repo = state.repos.find((r) => r.id === repoId) ?? state.repos[0];
  return { repo, repoId: repo?.id ?? "", setRepoId };
}

function RepoSwitcher({
  repos,
  repoId,
  onChange,
  meta,
}: {
  repos: AdoState["repos"];
  repoId: string;
  onChange: (id: string) => void;
  meta?: string;
}) {
  return (
    <div className={styles.repoSwitcher}>
      <NativeSelect
        value={repoId}
        onChange={onChange}
        options={repos.map((r) => ({ value: r.id, label: r.name }))}
      />
      {meta ? <span className={styles.repoMeta}>{meta}</span> : null}
    </div>
  );
}

function defaultPolicies(isDefault: boolean): AdoBranchPolicies {
  // Local fallback only for the (never-expected-in-practice) case a branch
  // was seeded without `policies` — freshAdoState() always populates it, but
  // this keeps the policies modal safe against a future seed regression.
  return {
    requireReviewers: isDefault,
    minReviewers: isDefault ? 2 : 1,
    resetVotesOnPush: isDefault,
    allowSelfApprove: !isDefault,
    checkComments: isDefault,
    buildValidation: isDefault,
    linkedWorkItems: isDefault,
    limitMergeTypes: isDefault,
    squashOnly: false,
  };
}

// ===== 1. Branches =====
export function ReposBranchesPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const { repo, repoId, setRepoId } = useRepoSelection(state);

  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchSource, setNewBranchSource] = useState<string>(repo?.defaultBranch ?? "main");

  const [deleteTarget, setDeleteTarget] = useState<AdoBranch | null>(null);
  const [compareTarget, setCompareTarget] = useState<AdoBranch | null>(null);
  const [policiesTarget, setPoliciesTarget] = useState<AdoBranch | null>(null);
  const [policiesDraft, setPoliciesDraft] = useState<AdoBranchPolicies | null>(null);

  const [error, setError] = useState<string | null>(null);

  const compareCommits = useMemo(() => {
    if (!compareTarget || !repo) return [];
    const count = Math.min(compareTarget.ahead, 5);
    return Array.from({ length: count }, (_, i) => ({
      hash: seededCommitHash(repo.id, compareTarget.name, i),
      author: compareTarget.author,
      when: `${i + 1}h ago`,
      message: `Commit ${i + 1} on ${compareTarget.name}`,
    }));
  }, [compareTarget, repo]);

  if (!repo) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Branches</div>
        <EmptyState message="No repositories available." />
      </div>
    );
  }

  function openNewBranch() {
    setNewBranchName("feature/");
    setNewBranchSource(repo!.defaultBranch);
    setError(null);
    setNewBranchOpen(true);
  }

  function submitNewBranch() {
    const name = newBranchName.trim();
    if (!name) {
      setError("Branch name is required.");
      return;
    }
    if (repo!.branches.some((b) => b.name === name)) {
      setError("Branch already exists.");
      return;
    }
    const branch: AdoBranch = {
      name,
      isDefault: false,
      ahead: 0,
      behind: 0,
      lastCommit: "just now",
      when: "just now",
      author: "You",
      policies: defaultPolicies(false),
    };
    dispatch({ type: "ADD_REPO_BRANCH", repoId: repo!.id, branch });
    setNewBranchOpen(false);
  }

  function confirmDeleteBranch() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_REPO_BRANCH", repoId: repo!.id, branchName: deleteTarget.name });
    setDeleteTarget(null);
  }

  function openPolicies(branch: AdoBranch) {
    setPoliciesTarget(branch);
    setPoliciesDraft(branch.policies ?? defaultPolicies(branch.isDefault));
  }

  function savePolicies() {
    if (!policiesTarget || !policiesDraft) return;
    dispatch({
      type: "UPDATE_BRANCH_POLICIES",
      repoId: repo!.id,
      branchName: policiesTarget.name,
      patch: policiesDraft,
    });
    setPoliciesTarget(null);
    setPoliciesDraft(null);
  }

  const columns: DataTableColumn<AdoBranch>[] = [
    {
      key: "name",
      header: "Branch",
      render: (b) => (
        <>
          <code className={styles.branchTag}>{b.name}</code>
          {b.isDefault ? <span className={styles.badge}>Default</span> : null}
        </>
      ),
    },
    { key: "lastCommit", header: "Last commit", render: (b) => b.lastCommit },
    { key: "author", header: "Author", render: (b) => <><InitialsAvatar name={b.author} /> {b.author}</> },
    { key: "when", header: "When", render: (b) => b.when },
    {
      key: "aheadBehind",
      header: "Ahead/Behind",
      render: (b) => (
        <>
          <span style={{ color: "#0e660e" }}>{b.ahead} ahead</span> / <span style={{ color: "#a4262c" }}>{b.behind} behind</span>
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (b) => (
        <>
          <button type="button" className={styles.btnLink} onClick={() => setCompareTarget(b)}>
            Compare
          </button>{" "}
          <button type="button" className={styles.btnLink} onClick={() => openPolicies(b)}>
            Branch policies
          </button>{" "}
          {!b.isDefault ? (
            <button type="button" className={`${styles.btnLink} ${styles.btnDanger}`} onClick={() => setDeleteTarget(b)}>
              Delete
            </button>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Branches</div>
      <div className={styles.pageSub}>{repo.name} · {repo.branches.length} branches</div>

      <RepoSwitcher repos={state.repos} repoId={repoId} onChange={setRepoId} />

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={openNewBranch}>
          + New branch
        </button>
      </div>

      <DataTable<AdoBranch> columns={columns} rows={repo.branches} getRowKey={(b) => b.name} emptyMessage="No branches yet." />

      {newBranchOpen ? (
        <Modal
          title="New branch"
          onClose={() => setNewBranchOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setNewBranchOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={submitNewBranch}>
                Create
              </button>
            </>
          }
        >
          <Field label="Branch name">
            <input
              className={styles.input}
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="feature/payment-flow"
              autoFocus
            />
          </Field>
          <Field label="Branch from">
            <NativeSelect
              value={newBranchSource}
              onChange={setNewBranchSource}
              options={repo.branches.map((b) => ({ value: b.name, label: b.name }))}
            />
          </Field>
          {error ? <div style={{ color: "#a4262c", fontSize: 13 }}>{error}</div> : null}
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          title="Delete branch"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className={styles.btnDanger} onClick={confirmDeleteBranch}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete branch <code className={styles.branchTag}>{deleteTarget.name}</code>? Open pull requests targeting this branch
            will be affected.
          </p>
        </Modal>
      ) : null}

      {compareTarget && repo ? (
        <Modal
          title={`Compare ${compareTarget.name} → ${repo.defaultBranch}`}
          onClose={() => setCompareTarget(null)}
          width="700px"
          footer={
            <button type="button" className={styles.btnOutline} onClick={() => setCompareTarget(null)}>
              Close
            </button>
          }
        >
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <b>{compareTarget.ahead}</b> commits ahead, <b>{compareTarget.behind}</b> commits behind {repo.defaultBranch}.
          </div>
          <DataTable
            columns={[
              { key: "hash", header: "Commit", render: (c: (typeof compareCommits)[number]) => <code className={styles.hash}>{c.hash}</code> },
              { key: "author", header: "Author", render: (c: (typeof compareCommits)[number]) => c.author },
              { key: "when", header: "Date", render: (c: (typeof compareCommits)[number]) => c.when },
              { key: "message", header: "Message", render: (c: (typeof compareCommits)[number]) => c.message },
            ]}
            rows={compareCommits}
            getRowKey={(c) => c.hash}
            emptyMessage="No commits ahead."
          />
        </Modal>
      ) : null}

      {policiesTarget && policiesDraft ? (
        <Modal
          title={`Branch policies — ${policiesTarget.name}`}
          onClose={() => {
            setPoliciesTarget(null);
            setPoliciesDraft(null);
          }}
          width="640px"
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setPoliciesTarget(null);
                  setPoliciesDraft(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={savePolicies}>
                Save
              </button>
            </>
          }
        >
          <div className={styles.h3}>Require a minimum number of reviewers</div>
          <Checkbox
            label="Require approvers"
            checked={policiesDraft.requireReviewers}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, requireReviewers: v })}
          />
          <Field label="Minimum reviewers">
            <input
              className={styles.input}
              type="number"
              min={0}
              max={10}
              value={policiesDraft.minReviewers}
              onChange={(e) => setPoliciesDraft({ ...policiesDraft, minReviewers: Number(e.target.value) || 0 })}
              style={{ width: 80 }}
            />
          </Field>
          <Checkbox
            label="Reset all code reviewer votes when there are new changes"
            checked={policiesDraft.resetVotesOnPush}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, resetVotesOnPush: v })}
          />
          <Checkbox
            label="Allow requestors to approve their own changes"
            checked={policiesDraft.allowSelfApprove}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, allowSelfApprove: v })}
          />

          <div className={styles.h3}>Check for comment resolution</div>
          <Checkbox
            label="Block merge if any PR comments are unresolved"
            checked={policiesDraft.checkComments}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, checkComments: v })}
          />

          <div className={styles.h3}>Build validation</div>
          <Checkbox
            label="Build pipeline must succeed"
            checked={policiesDraft.buildValidation}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, buildValidation: v })}
          />

          <div className={styles.h3}>Work item linking</div>
          <Checkbox
            label="Require linked work items"
            checked={policiesDraft.linkedWorkItems}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, linkedWorkItems: v })}
          />

          <div className={styles.h3}>Merge strategy</div>
          <Checkbox
            label="Limit merge types"
            checked={policiesDraft.limitMergeTypes}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, limitMergeTypes: v })}
          />
          <Checkbox
            label="Squash merge only (linear history)"
            checked={policiesDraft.squashOnly}
            onChange={(v) => setPoliciesDraft({ ...policiesDraft, squashOnly: v })}
          />
        </Modal>
      ) : null}
    </div>
  );
}

// ===== 2. Tags =====
export function ReposTagsPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const { repo, repoId, setRepoId } = useRepoSelection(state);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("v1.0.0");
  const [commit, setCommit] = useState("HEAD");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!repo) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Tags</div>
        <EmptyState message="No repositories available." />
      </div>
    );
  }

  function openNewTag() {
    setName("v1.0.0");
    setCommit("HEAD");
    setMessage(`Release v1.0.0`);
    setError(null);
    setOpen(true);
  }

  function submitNewTag() {
    const tagName = name.trim();
    if (!tagName) {
      setError("Tag name is required.");
      return;
    }
    if (repo!.tags.some((t) => t.name === tagName)) {
      setError("Tag already exists.");
      return;
    }
    let resolvedCommit = commit.trim() || "HEAD";
    if (resolvedCommit === "HEAD") {
      resolvedCommit = repo!.commits[0]?.short ?? seededCommitHash(repo!.id, "HEAD", 0).substring(0, 7);
    }
    dispatch({
      type: "ADD_TAG",
      repoId: repo!.id,
      tag: { name: tagName, commit: resolvedCommit, date: new Date().toISOString().slice(0, 10), message: message.trim() },
    });
    setOpen(false);
  }

  const columns: DataTableColumn<AdoState["repos"][number]["tags"][number]>[] = [
    { key: "name", header: "Tag", render: (t) => <code className={styles.hash}>{t.name}</code> },
    { key: "commit", header: "Commit", render: (t) => <code className={styles.hash}>{t.commit}</code> },
    { key: "date", header: "Date", render: (t) => t.date },
    { key: "message", header: "Message", render: (t) => t.message },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Tags</div>
      <div className={styles.pageSub}>{repo.name} · {repo.tags.length} release tags</div>

      <RepoSwitcher repos={state.repos} repoId={repoId} onChange={setRepoId} />

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={openNewTag}>
          + New tag
        </button>
      </div>

      <DataTable columns={columns} rows={repo.tags} getRowKey={(t) => t.name} emptyMessage="No tags yet." />

      {open ? (
        <Modal
          title="New tag"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={submitNewTag}>
                Create
              </button>
            </>
          }
        >
          <Field label="Tag name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="v1.2.0" autoFocus />
          </Field>
          <Field label="Tagged commit" help='Commit short hash, or "HEAD" for the latest commit.'>
            <input className={styles.input} value={commit} onChange={(e) => setCommit(e.target.value)} placeholder="HEAD" />
          </Field>
          <Field label="Message">
            <input className={styles.input} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Release ${name}`} />
          </Field>
          {error ? <div style={{ color: "#a4262c", fontSize: 13 }}>{error}</div> : null}
        </Modal>
      ) : null}
    </div>
  );
}

// ===== 3. Pushes =====
export function ReposPushesPage({ state }: { state: AdoState }) {
  const { repo, repoId, setRepoId } = useRepoSelection(state);

  if (!repo) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Pushes</div>
        <EmptyState message="No repositories available." />
      </div>
    );
  }

  const columns: DataTableColumn<AdoState["repos"][number]["pushes"][number]>[] = [
    { key: "who", header: "Author", render: (p) => <><InitialsAvatar name={p.who} /> {p.who}</> },
    { key: "branch", header: "Branch", render: (p) => <code className={styles.branchTag}>{p.branch}</code> },
    { key: "commits", header: "Commits", render: (p) => `${p.commits} commits` },
    { key: "when", header: "When", render: (p) => p.when },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Pushes</div>
      <div className={styles.pageSub}>{repo.name} · recent pushes</div>

      <RepoSwitcher repos={state.repos} repoId={repoId} onChange={setRepoId} />

      <DataTable columns={columns} rows={repo.pushes} getRowKey={(p) => p.id} emptyMessage="No pushes yet." />
    </div>
  );
}
