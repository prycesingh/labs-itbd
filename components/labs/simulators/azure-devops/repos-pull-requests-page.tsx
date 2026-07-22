"use client";

// Pull requests list + New Pull Request form + PR detail — ported from
// itbd-lab/simulators/azure-devops/js/ado-repos.js renderPRs()/setPrTab()/
// voteBadge()/openPR()/renderPRDetail()/diffRowsForPR()/votePR()/completePR()/
// openNewPR()/renderNewPR()/saveNewPR().
//
// Repo selector + status tabs (Active/Completed/Abandoned with live counts)
// mirror source's prTab switcher. The PR list table matches source's
// ID/Title/Branch/Author/Vote/Reviewers/Created column set (this port adds a
// Status column since one table now spans all three tabs' worth of rows when
// "All" is selected, which source's per-tab table never needed).
//
// New pull request is a straight port of renderNewPR()/saveNewPR(): source/
// target branch selects (from the repo's own branches), title, description,
// a linked-work-items field (ported here as a searchable checkbox list against
// state.workItems rather than source's freeform "1014, 1019" comma-separated
// text input, per this port's brief — same resulting `workItems: number[]`
// shape), reviewer checkboxes against state.team, and the auto-complete
// toggle. Dispatches ADD_PULL_REQUEST with vote "Waiting", status "Active",
// empty threads, and the same two "Waiting" seed checks source's
// saveNewPR() stamps on every new PR.
//
// PR detail is a Modal with the same four-tab set as source's prDetailTab
// ('overview' | 'files' | 'updates' | 'commits'): Overview shows description +
// reviewers-with-vote + linked work items + checks (source's whole "pr-overview"
// block); Files shows source's diffRowsForPR() output — IMPORTANT: that
// function is 100% fake/hardcoded in source (same fixed 10-line pattern
// regardless of the PR's actual branch/content), so it's ported here verbatim
// as clearly-labeled illustrative reference content, not a real diff engine —
// plus the PR's comment threads (add-thread dispatches ADD_PR_THREAD); Updates
// is source's simple activity list (created/reviewers-added/completed/
// abandoned lines, no real event log); Commits is source's commit-count table
// (falls back to a synthesized row when the repo's commit list runs out,
// matching source's `repo.commits[i] || {...}` fallback). Vote buttons
// (Approve/Wait/Reject) dispatch VOTE_ON_PR; Complete dispatches COMPLETE_PR
// behind a confirm (source's completePR() has no confirm dialog, but the
// porting brief calls for one here) — matches source's "status flip only, no
// real merge-conflict/file-content logic" simulation exactly.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AdoPullRequest, AdoPrVote, AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import {
  Checkbox,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  InitialsAvatar,
  Modal,
  NativeSelect,
  StatusPill,
  type StatusTone,
  SubTabBar,
  TabBar,
} from "./ado-ui";
import styles from "./ado-console.module.css";

const CURRENT_USER = "Alex Johnson";

type PrStatusFilter = "All" | AdoPullRequest["status"];
const STATUS_TABS: PrStatusFilter[] = ["All", "Active", "Completed", "Abandoned"];

function voteTone(vote: AdoPrVote): StatusTone {
  if (vote === "Approved" || vote === "Approved with suggestions") return "done";
  if (vote === "Rejected") return "rejected";
  return "active";
}

function statusTone(status: AdoPullRequest["status"]): StatusTone {
  if (status === "Completed") return "resolved";
  if (status === "Abandoned") return "rejected";
  return "active";
}

function checkTone(status: AdoPullRequest["checks"][number]["status"]): StatusTone {
  if (status === "Succeeded" || status === "Approved") return "done";
  if (status === "Waiting") return "active";
  return "rejected";
}

// ===================== Illustrative static diff =====================
// Ported verbatim from source's diffRowsForPR() — a fixed 10-line pattern
// (line 3 removed, lines 4 and 7 added, everything else unchanged) that
// source renders identically for every PR regardless of its actual source/
// target branches or file contents. This sub-phase's real-engine investment
// went into Pipelines, not PR diffing, so this stays as clearly-labeled
// illustrative reference content rather than a computed diff.
type DiffRow = { kind: "add" | "del" | "context"; oldLine: number | null; newLine: number | null; text: string };

function illustrativeDiffRows(): DiffRow[] {
  const rows: DiffRow[] = [];
  for (let i = 1; i <= 10; i++) {
    if (i === 3) rows.push({ kind: "del", oldLine: i, newLine: null, text: "- if (oldAuthFlow) { /* legacy */ }" });
    else if (i === 4) rows.push({ kind: "add", oldLine: null, newLine: i, text: "+ if (await authClient.isAuthenticated()) { /* OIDC */ }" });
    else if (i === 7) rows.push({ kind: "add", oldLine: null, newLine: i, text: "+ refresh: { token: token.refreshToken, expiresIn: 3600 }" });
    else rows.push({ kind: "context", oldLine: i, newLine: i, text: `  // unchanged line ${i}` });
  }
  return rows;
}

// ===================== New pull request modal =====================

type NewPrDraft = {
  source: string;
  target: string;
  title: string;
  description: string;
  reviewers: string[];
  workItems: number[];
  autoComplete: boolean;
};

function NewPullRequestModal({
  state,
  repo,
  onClose,
  dispatch,
}: {
  state: AdoState;
  repo: AdoState["repos"][number];
  onClose: () => void;
  dispatch: React.Dispatch<AdoAction>;
}) {
  const branchNames = repo.branches.map((b) => b.name);
  const [draft, setDraft] = useState<NewPrDraft>(() => ({
    source: branchNames.find((b) => b !== repo.defaultBranch) ?? branchNames[0] ?? "",
    target: repo.defaultBranch,
    title: "",
    description: "",
    reviewers: [],
    workItems: [],
    autoComplete: false,
  }));
  const [workItemSearch, setWorkItemSearch] = useState("");

  function patch(p: Partial<NewPrDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  function toggleReviewer(name: string) {
    setDraft((prev) => ({
      ...prev,
      reviewers: prev.reviewers.includes(name) ? prev.reviewers.filter((r) => r !== name) : [...prev.reviewers, name],
    }));
  }

  function toggleWorkItem(id: number) {
    setDraft((prev) => ({
      ...prev,
      workItems: prev.workItems.includes(id) ? prev.workItems.filter((w) => w !== id) : [...prev.workItems, id],
    }));
  }

  const filteredWorkItems = useMemo(() => {
    const q = workItemSearch.trim().toLowerCase();
    if (!q) return state.workItems;
    return state.workItems.filter((w) => String(w.id).includes(q) || w.title.toLowerCase().includes(q));
  }, [state.workItems, workItemSearch]);

  function save() {
    if (!draft.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const allPrIds = state.repos.flatMap((r) => r.pullRequests.map((p) => p.id));
    const nextId = (allPrIds.length ? Math.max(...allPrIds) : 100) + 1;
    const pr: AdoPullRequest = {
      id: nextId,
      title: draft.title.trim(),
      source: draft.source,
      target: draft.target,
      author: CURRENT_USER,
      status: "Active",
      vote: "Waiting",
      reviewers: draft.reviewers.slice(),
      created: new Date().toISOString().substring(0, 10),
      description: draft.description,
      workItems: draft.workItems.slice(),
      commits: 1,
      threads: [],
      checks: [
        { name: "Build pipeline #pending", status: "Waiting" },
        { name: "Required reviewers", status: "Waiting" },
      ],
      autoComplete: draft.autoComplete,
    };
    dispatch({ type: "ADD_PULL_REQUEST", repoId: repo.id, pr });
    toast.success(`PR #${nextId} created`);
    onClose();
  }

  return (
    <Modal
      title="New pull request"
      onClose={onClose}
      width="640px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={save}>
            Create
          </button>
        </>
      }
    >
      <Field label="Source branch">
        <NativeSelect value={draft.source} onChange={(v) => patch({ source: v })} options={branchNames.map((b) => ({ value: b, label: b }))} />
      </Field>
      <Field label="Target branch">
        <NativeSelect value={draft.target} onChange={(v) => patch({ target: v })} options={branchNames.map((b) => ({ value: b, label: b }))} />
      </Field>
      <Field label="Title">
        <input className={styles.input} value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Pull request title" />
      </Field>
      <Field label="Description">
        <textarea className={styles.input} rows={4} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
      </Field>
      <Field label="Linked work items" help={draft.workItems.length ? `${draft.workItems.length} selected` : undefined}>
        <input
          className={styles.input}
          placeholder="Search work items by ID or title"
          value={workItemSearch}
          onChange={(e) => setWorkItemSearch(e.target.value)}
        />
        <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 6, border: "1px solid #e1dfdd", borderRadius: 2, padding: "4px 8px" }}>
          {filteredWorkItems.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#605e5c", padding: "6px 0" }}>No matching work items.</div>
          ) : (
            filteredWorkItems.map((w) => (
              <Checkbox key={w.id} label={`#${w.id} ${w.title}`} checked={draft.workItems.includes(w.id)} onChange={() => toggleWorkItem(w.id)} />
            ))
          )}
        </div>
      </Field>
      <Field label="Reviewers">
        <div className={styles.checklist}>
          {state.team.map((member) => (
            <Checkbox key={member.id} label={member.name} checked={draft.reviewers.includes(member.name)} onChange={() => toggleReviewer(member.name)} />
          ))}
        </div>
      </Field>
      <Field label="Auto-complete">
        <Checkbox
          label="Set auto-complete (merges when all policies are met)"
          checked={draft.autoComplete}
          onChange={(checked) => patch({ autoComplete: checked })}
        />
      </Field>
    </Modal>
  );
}

// ===================== PR detail modal =====================

type PrDetailTab = "overview" | "files" | "updates" | "commits";
const PR_DETAIL_TABS: { key: PrDetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "files", label: "Files" },
  { key: "updates", label: "Updates" },
  { key: "commits", label: "Commits" },
];

function PrDetailModal({
  pr,
  repo,
  onClose,
  dispatch,
}: {
  pr: AdoPullRequest;
  repo: AdoState["repos"][number];
  onClose: () => void;
  dispatch: React.Dispatch<AdoAction>;
}) {
  const [tab, setTab] = useState<PrDetailTab>("overview");
  const [threadDraft, setThreadDraft] = useState("");
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  function vote(v: AdoPrVote) {
    dispatch({ type: "VOTE_ON_PR", repoId: repo.id, prId: pr.id, vote: v });
    toast.success(`Vote -> ${v}`);
  }

  function addThread() {
    const text = threadDraft.trim();
    if (!text) return;
    dispatch({ type: "ADD_PR_THREAD", repoId: repo.id, prId: pr.id, author: CURRENT_USER, text });
    toast.success("Comment added");
    setThreadDraft("");
  }

  function complete() {
    dispatch({ type: "COMPLETE_PR", repoId: repo.id, prId: pr.id });
    toast.success(`PR #${pr.id} completed and merged`);
    setConfirmingComplete(false);
    onClose();
  }

  const diffRows = useMemo(() => illustrativeDiffRows(), []);

  return (
    <Modal
      title={`PR #${pr.id} · ${pr.title}`}
      onClose={onClose}
      width="820px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Close
          </button>
          {pr.status === "Active" ? (
            <>
              <button type="button" className={styles.btnPrimary} onClick={() => vote("Approved")}>
                Approve
              </button>
              <button type="button" className={styles.btnOutline} onClick={() => vote("Waiting")}>
                Wait
              </button>
              <button type="button" className={styles.btnDanger} onClick={() => vote("Rejected")}>
                Reject
              </button>
              <button type="button" className={styles.btnPrimary} onClick={() => setConfirmingComplete(true)}>
                Complete
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div className={styles.prH}>
        <div>
          <code className={styles.branchTag}>{pr.source}</code> &rarr; <code className={styles.branchTag}>{pr.target}</code>
        </div>
        <div>
          {pr.author} &middot; {pr.created} &middot; <StatusPill tone={voteTone(pr.vote)}>{pr.vote}</StatusPill>
        </div>
      </div>

      <TabBar tabs={PR_DETAIL_TABS} active={tab} onChange={(k) => setTab(k as PrDetailTab)} />

      {tab === "overview" ? (
        <div>
          <div className={styles.prDesc}>{pr.description || <i>No description provided.</i>}</div>

          <div className={styles.h3}>Reviewers</div>
          {pr.reviewers.length === 0 ? (
            <EmptyState message="No reviewers assigned." />
          ) : (
            <table className={`${styles.table} ${styles.tableSmall}`}>
              <tbody>
                {pr.reviewers.map((r) => (
                  <tr key={r}>
                    <td>
                      <InitialsAvatar name={r} /> {r}
                    </td>
                    <td>
                      <StatusPill tone={voteTone(pr.vote)}>{pr.vote}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.h3}>Linked work items</div>
          <div>
            {pr.workItems.length === 0 ? (
              <i>None</i>
            ) : (
              pr.workItems.map((w) => (
                <span key={w} className={styles.tag}>
                  #{w}
                </span>
              ))
            )}
          </div>

          <div className={styles.h3}>Checks</div>
          {pr.checks.length === 0 ? (
            <EmptyState message="No checks configured." />
          ) : (
            <table className={`${styles.table} ${styles.tableSmall}`}>
              <tbody>
                {pr.checks.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>
                      <StatusPill tone={checkTone(c.status)}>{c.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === "files" ? (
        <div>
          <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 8 }}>
            Illustrative example diff — fixed reference content shown for any pull request, not a computed diff of this PR&rsquo;s actual changes.
          </div>
          <div className={styles.diffFile}>
            <div className={styles.diffFileH}>src/auth/AuthService.js</div>
            {diffRows.map((row, i) => (
              <div
                key={i}
                className={`${styles.diffRow} ${row.kind === "add" ? styles.diffRowAdd : row.kind === "del" ? styles.diffRowDel : ""}`}
              >
                <span className={styles.lnOld}>{row.oldLine ?? ""}</span>
                <span className={styles.lnNew}>{row.newLine ?? ""}</span>
                <span className={styles.diffLine}>{row.text}</span>
              </div>
            ))}
          </div>

          <div className={styles.h3}>Threads</div>
          {pr.threads.length === 0 ? (
            <EmptyState message="No comments yet." />
          ) : (
            pr.threads.map((t) => (
              <div key={t.id} className={styles.wiComment}>
                <div className={styles.cmH}>
                  <InitialsAvatar name={t.author} /> <strong>{t.author}</strong> &middot; {t.when}
                </div>
                <div className={styles.cmB}>{t.text}</div>
              </div>
            ))
          )}
          <textarea
            className={styles.input}
            rows={2}
            placeholder="Add a comment"
            value={threadDraft}
            onChange={(e) => setThreadDraft(e.target.value)}
          />
          <div style={{ marginTop: 8 }}>
            <button type="button" className={styles.btnPrimary} onClick={addThread}>
              Comment
            </button>
          </div>
        </div>
      ) : null}

      {tab === "updates" ? (
        <div>
          <div className={styles.h3}>Activity</div>
          <ul className={styles.prActivity}>
            <li>
              {pr.created} &middot; <strong>{pr.author}</strong> created the pull request
            </li>
            {pr.reviewers.map((r) => (
              <li key={r}>
                {pr.created} &middot; {r} was added as reviewer
              </li>
            ))}
            {pr.status === "Completed" ? <li>{pr.created} &middot; PR completed and merged into {pr.target}</li> : null}
            {pr.status === "Abandoned" ? <li>{pr.created} &middot; PR was abandoned</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === "commits" ? (
        <div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Commit</th>
                <th>Message</th>
                <th>Author</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: pr.commits }, (_, i) => {
                const c = repo.commits[i] ?? { short: `abc${i}`, message: `commit ${i + 1}`, author: pr.author };
                return (
                  <tr key={i}>
                    <td>
                      <code className={styles.hash}>{c.short}</code>
                    </td>
                    <td>{c.message}</td>
                    <td>{c.author}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {confirmingComplete ? (
        <Modal
          title="Complete pull request"
          onClose={() => setConfirmingComplete(false)}
          width="440px"
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={() => setConfirmingComplete(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={complete}>
                Complete merge
              </button>
            </>
          }
        >
          <p>
            Complete PR #{pr.id} and merge <code className={styles.branchTag}>{pr.source}</code> into{" "}
            <code className={styles.branchTag}>{pr.target}</code>? This flips the PR to Completed and its vote to Approved (a status-flip
            simulation — no file contents are changed).
          </p>
        </Modal>
      ) : null}
    </Modal>
  );
}

// ===================== Page =====================

export function ReposPullRequestsPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [repoId, setRepoId] = useState<string>(() => state.repos[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<PrStatusFilter>("All");
  const [showNewPr, setShowNewPr] = useState(false);
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null);

  const repo = state.repos.find((r) => r.id === repoId) ?? state.repos[0];

  const filteredPrs = useMemo(() => {
    if (!repo) return [];
    if (statusFilter === "All") return repo.pullRequests;
    return repo.pullRequests.filter((p) => p.status === statusFilter);
  }, [repo, statusFilter]);

  const selectedPr = repo && selectedPrId != null ? (repo.pullRequests.find((p) => p.id === selectedPrId) ?? null) : null;

  if (!repo) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Pull requests</div>
        <EmptyState message="No repositories available." />
      </div>
    );
  }

  const statusCounts: Record<PrStatusFilter, number> = {
    All: repo.pullRequests.length,
    Active: repo.pullRequests.filter((p) => p.status === "Active").length,
    Completed: repo.pullRequests.filter((p) => p.status === "Completed").length,
    Abandoned: repo.pullRequests.filter((p) => p.status === "Abandoned").length,
  };

  const columns: DataTableColumn<AdoPullRequest>[] = [
    { key: "id", header: "ID", render: (p) => `#${p.id}` },
    {
      key: "title",
      header: "Title",
      render: (p) => (
        <button
          type="button"
          className={styles.btnLink}
          style={{ padding: 0, textAlign: "left" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPrId(p.id);
          }}
        >
          {p.title}
        </button>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (p) => (
        <>
          <code className={styles.branchTag}>{p.source}</code> &rarr; <code className={styles.branchTag}>{p.target}</code>
        </>
      ),
    },
    {
      key: "author",
      header: "Author",
      render: (p) => (
        <>
          <InitialsAvatar name={p.author} /> {p.author}
        </>
      ),
    },
    { key: "status", header: "Status", render: (p) => <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill> },
    { key: "vote", header: "Vote", render: (p) => <StatusPill tone={voteTone(p.vote)}>{p.vote}</StatusPill> },
    {
      key: "reviewers",
      header: "Reviewers",
      render: (p) => (
        <>
          {p.reviewers.map((r) => (
            <InitialsAvatar key={r} name={r} />
          ))}
        </>
      ),
    },
    { key: "created", header: "Created", render: (p) => p.created },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Pull requests</div>
      <div className={styles.pageSub}>
        {repo.name} &middot; {repo.pullRequests.length} PRs total
      </div>

      <div className={styles.repoSwitcher}>
        <NativeSelect
          value={repo.id}
          onChange={(v) => {
            setRepoId(v);
            setStatusFilter("All");
          }}
          options={state.repos.map((r) => ({ value: r.id, label: r.name }))}
        />
        <span className={styles.repoMeta}>
          Default branch <code className={styles.branchTag}>{repo.defaultBranch}</code>
        </span>
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowNewPr(true)}>
          + New pull request
        </button>
      </div>

      <SubTabBar
        tabs={STATUS_TABS.map((t) => ({ key: t, label: `${t} (${statusCounts[t]})` }))}
        active={statusFilter}
        onChange={(k) => setStatusFilter(k as PrStatusFilter)}
      />

      {filteredPrs.length === 0 ? (
        <EmptyState message={`No ${statusFilter === "All" ? "" : statusFilter.toLowerCase() + " "}pull requests.`} />
      ) : (
        <DataTable columns={columns} rows={filteredPrs} getRowKey={(p) => String(p.id)} onRowClick={(p) => setSelectedPrId(p.id)} />
      )}

      {showNewPr ? <NewPullRequestModal state={state} repo={repo} dispatch={dispatch} onClose={() => setShowNewPr(false)} /> : null}
      {selectedPr ? <PrDetailModal pr={selectedPr} repo={repo} dispatch={dispatch} onClose={() => setSelectedPrId(null)} /> : null}
    </div>
  );
}
