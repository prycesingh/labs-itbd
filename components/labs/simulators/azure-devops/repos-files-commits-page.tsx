"use client";

// Repos: Files (tree + content) and Commits (+ diff) pages for the Azure
// DevOps simulator. Ported from itbd-lab/simulators/azure-devops/js/
// ado-repos.js `renderFiles()`/`renderTree()`/`renderFileContent()`/
// `fakeFileContent()`/`editFile()`/`_commitFile()` and `renderCommits()`/
// `openCommit()`. Branches/Pull Requests/Tags/Pushes are other agents' scope
// (ado-shell.tsx already reserves separate "repos-branches" /
// "repos-pull-requests" / "repos-tags" / "repos-pushes" pages for them).
//
// Two fidelity notes carried over from the porting brief:
//
// 1. File edits: source keeps edited content in an in-memory `FILE_OVERRIDES`
//    dict that is lost on reload (a real persistence gap — `_commitFile()`
//    never touches `ADOData.save()`). This port fixes that by dispatching the
//    real `SET_FILE_OVERRIDE` reducer action instead, so edited file content
//    is genuine persisted `AdoState` (`repo.fileOverrides[path]`), not local
//    component state.
//
// 2. Commit diffs: source's `openCommit()` is 100% fake/hardcoded — the same
//    12-line pattern and the same fake filename `src/services/AuthService.js`
//    regardless of which commit id was clicked. This sub-phase's real-engine
//    investment went into Pipelines, not per-commit diffing, so this port
//    keeps that same static pattern verbatim but labels it explicitly as an
//    illustrative example rather than implying it's computed per commit.

import { useMemo, useState } from "react";

import type { AdoCommit, AdoFileNode, AdoRepo, AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { DataTable, EmptyState, InitialsAvatar, Modal, NativeSelect } from "./ado-ui";
import styles from "./ado-console.module.css";

// ===== Shared: repo selection =====

function useSelectedRepo(state: AdoState): [AdoRepo | null, string, (id: string) => void] {
  const repos = state.repos;
  const [repoId, setRepoId] = useState<string>(() => repos[0]?.id ?? "");
  const repo = repos.find((r) => r.id === repoId) ?? repos[0] ?? null;
  return [repo, repo?.id ?? repoId, setRepoId];
}

function RepoSwitcher({ repos, repo, onChange }: { repos: AdoRepo[]; repo: AdoRepo; onChange: (id: string) => void }) {
  return (
    <div className={styles.repoSwitcher}>
      <label>Repo</label>
      <NativeSelect value={repo.id} onChange={onChange} options={repos.map((r) => ({ value: r.id, label: r.name }))} />
      <span className={styles.repoMeta}>
        Default branch: <code className={styles.codeInline}>{repo.defaultBranch}</code> &middot; {repo.size}
      </span>
    </div>
  );
}

// ===== fakeFileContent — ported verbatim (per-extension branching) from =====
// ado-repos.js `fakeFileContent(path, repoName)`. The `.yml`/`.yaml` branch
// there calls `ADOData.yamlFor('pl-webapp-build')`, which returns source's
// default webapp build pipeline YAML (ado-data.js `YAML_WEBAPP`) — inlined
// here verbatim since that constant isn't exported from seedData.ts.
const YAML_WEBAPP_BUILD = `trigger:
  branches:
    include: [ main, develop ]

pool:
  vmImage: ubuntu-latest

variables:
  - group: Common-Secrets
  - name: buildConfiguration
    value: Release

stages:
  - stage: Build
    jobs:
      - job: Compile
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.x' }
          - script: npm ci && npm run build

  - stage: Test
    dependsOn: Build
    jobs:
      - job: UnitTests
        steps:
          - script: npm test -- --ci

  - stage: Package
    dependsOn: Test
    jobs:
      - job: Pack
        steps:
          - task: PublishPipelineArtifact@1
            inputs: { targetPath: 'dist', artifact: 'webapp' }

  - stage: Deploy_Dev
    dependsOn: Package
    jobs:
      - deployment: Dev
        environment: dev
        strategy:
          runOnce:
            deploy:
              steps:
                - script: echo "Deploy to Dev"

  - stage: Deploy_Staging
    dependsOn: Deploy_Dev
    jobs:
      - deployment: Staging
        environment: staging

  - stage: Deploy_Prod
    dependsOn: Deploy_Staging
    jobs:
      - deployment: Prod
        environment: prod
`;

function fakeFileContent(path: string, repoName: string): string {
  const p = path.toLowerCase();

  if (p.indexOf("readme") !== -1) {
    return (
      `# ${repoName}\n\n` +
      `Welcome to the **${repoName}** repository.\n\n` +
      `## Getting started\n\n` +
      `1. Clone the repository\n` +
      `2. Install dependencies\n` +
      `3. Run the application\n\n` +
      "```bash\n" +
      `git clone https://dev.azure.com/cloudlab-training/${repoName}\n` +
      `cd ${repoName}\nnpm install\nnpm start\n` +
      "```\n\n" +
      `## Branches\n\n* \`main\`     - production-ready code\n* \`develop\`  - integration branch\n* \`feature/* - feature branches\n\n` +
      `## Contributing\n\nPlease follow the contribution guidelines in CONTRIBUTING.md and ensure all PRs:\n\n` +
      `* pass the build pipeline\n* have at least 2 reviewer approvals\n* include unit tests for new code\n* update documentation where appropriate\n`
    );
  }
  if (p.indexOf(".tf") !== -1) {
    return (
      `terraform {\n  required_version = ">= 1.4"\n  required_providers {\n    azurerm = {\n      source  = "hashicorp/azurerm"\n      version = "~> 3.0"\n    }\n  }\n}\n\n` +
      `provider "azurerm" {\n  features {}\n}\n\n` +
      `resource "azurerm_resource_group" "rg" {\n  name     = var.rg_name\n  location = var.location\n  tags     = var.tags\n}\n\n` +
      `resource "azurerm_kubernetes_cluster" "aks" {\n  name                = "\${var.prefix}-aks"\n  location            = azurerm_resource_group.rg.location\n  resource_group_name = azurerm_resource_group.rg.name\n  dns_prefix          = "\${var.prefix}-dns"\n\n` +
      `  default_node_pool {\n    name       = "default"\n    node_count = 3\n    vm_size    = "Standard_D2s_v5"\n  }\n\n` +
      `  identity {\n    type = "SystemAssigned"\n  }\n\n  tags = var.tags\n}\n`
    );
  }
  if (p.indexOf(".yml") !== -1 || p.indexOf(".yaml") !== -1) {
    return YAML_WEBAPP_BUILD;
  }
  if (p.indexOf(".json") !== -1) {
    return (
      `{\n  "name": "${repoName}",\n  "version": "2.4.0",\n  "private": true,\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "test": "vitest run",\n    "lint": "eslint ."\n  },\n  "dependencies": {\n    "react": "^18.3.0",\n    "react-dom": "^18.3.0",\n    "@cloudlab/ui-components": "^1.2.3",\n    "@cloudlab/auth-client": "^0.9.7"\n  },\n  "devDependencies": {\n    "vite": "^5.2.0",\n    "vitest": "^1.5.0",\n    "eslint": "^8.57.0"\n  }\n}\n`
    );
  }
  if (p.indexOf(".kt") !== -1) {
    return (
      `package in.cloudlab.app\n\nimport android.os.Bundle\nimport androidx.appcompat.app.AppCompatActivity\nimport androidx.lifecycle.lifecycleScope\nimport kotlinx.coroutines.launch\n\n` +
      `class MainActivity : AppCompatActivity() {\n\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContentView(R.layout.activity_main)\n\n        lifecycleScope.launch {\n            val user = AuthClient.currentUser()\n            updateUi(user)\n        }\n    }\n\n    private fun updateUi(user: User?) {\n        findViewById<TextView>(R.id.welcome).text =\n            user?.let { "Welcome, \${it.displayName}" } ?: "Please sign in"\n    }\n}\n`
    );
  }
  if (p.indexOf(".swift") !== -1) {
    return (
      `import SwiftUI\n\nstruct LoginView: View {\n    @State private var email: String = ""\n    @State private var password: String = ""\n    @StateObject private var auth = AuthClient.shared\n\n` +
      `    var body: some View {\n        VStack(spacing: 16) {\n            Text("CloudLab").font(.largeTitle).bold()\n            TextField("Email", text: $email)\n                .textFieldStyle(.roundedBorder)\n            SecureField("Password", text: $password)\n                .textFieldStyle(.roundedBorder)\n            Button("Sign in") {\n                Task { await auth.signIn(email: email, password: password) }\n            }\n            .buttonStyle(.borderedProminent)\n        }\n        .padding()\n    }\n}\n`
    );
  }
  if (p.indexOf(".cs") !== -1) {
    return (
      `using Microsoft.AspNetCore.Mvc;\nusing CloudLab.Api.Services;\n\nnamespace CloudLab.Api.Controllers;\n\n` +
      `[ApiController]\n[Route("api/[controller]")]\npublic class OrdersController : ControllerBase\n{\n    private readonly IOrderService _orders;\n    public OrdersController(IOrderService orders) => _orders = orders;\n\n    [HttpGet]\n    public async Task<IActionResult> List([FromQuery] int page = 1)\n        => Ok(await _orders.ListAsync(page));\n\n    [HttpGet("{id:guid}")]\n    public async Task<IActionResult> Get(Guid id)\n    {\n        var order = await _orders.GetByIdAsync(id);\n        return order is null ? NotFound() : Ok(order);\n    }\n\n    [HttpPost]\n    public async Task<IActionResult> Create([FromBody] CreateOrderDto dto)\n        => CreatedAtAction(nameof(Get), new { id = (await _orders.CreateAsync(dto)).Id }, dto);\n}\n`
    );
  }
  if (p.indexOf(".jsx") !== -1 || p.indexOf(".tsx") !== -1) {
    return (
      `import React, { useState, useEffect } from "react";\nimport { signInWithMicrosoft } from "../auth";\n\n` +
      `export default function Login() {\n    const [loading, setLoading] = useState(false);\n    const [error, setError] = useState(null);\n\n    async function handleSignIn() {\n        setLoading(true);\n        setError(null);\n        try {\n            const result = await signInWithMicrosoft();\n            window.location.href = result.redirectTo || "/";\n        } catch (err) {\n            console.error(err);\n            setError("Sign-in failed. Please try again.");\n        } finally {\n            setLoading(false);\n        }\n    }\n\n    return (\n        <div className="login">\n            <h1>Welcome to CloudLab</h1>\n            <button onClick={handleSignIn} disabled={loading}>\n                {loading ? "Signing in..." : "Sign in with Microsoft"}\n            </button>\n            {error && <div className="error">{error}</div>}\n        </div>\n    );\n}\n`
    );
  }
  if (p.indexOf(".xml") !== -1) {
    return (
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">CloudLab</string>\n    <string name="login_title">Welcome to CloudLab</string>\n    <string name="login_email">Email</string>\n    <string name="login_password">Password</string>\n    <string name="login_button">Sign in</string>\n    <string name="login_error">Sign-in failed. Please try again.</string>\n</resources>\n`
    );
  }
  if (p.indexOf("dockerfile") !== -1) {
    return (
      `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build\nWORKDIR /src\nCOPY *.csproj ./\nRUN dotnet restore\nCOPY . .\nRUN dotnet publish -c Release -o /app\n\n` +
      `FROM mcr.microsoft.com/dotnet/aspnet:8.0\nWORKDIR /app\nCOPY --from=build /app .\nENTRYPOINT ["dotnet", "CloudLab.Api.dll"]\n`
    );
  }
  return (
    `// ${path}\n// Sample file in repository ${repoName}\n// Replace with the real source when needed.\n\n` +
    `function sampleFunction() {\n    console.log("hello from ${repoName}");\n    return 42;\n}\n\nmodule.exports = sampleFunction;\n`
  );
}

// ===== File tree =====

function FolderNode({
  node,
  path,
  activeFile,
  onSelectFile,
}: {
  node: AdoFileNode;
  path: string;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const fullPath = path ? `${path}${node.name}` : node.name;

  if (node.type === "folder") {
    return (
      <li className={styles.treeFolder} onClick={() => setOpen((o) => !o)}>
        <span className={styles.treeIcon}>{open ? "\u{1F4C2}" : "\u{1F4C1}"}</span>
        {node.name}
        {open && node.children && node.children.length > 0 ? (
          <FileTreeList nodes={node.children} path={`${fullPath}/`} activeFile={activeFile} onSelectFile={onSelectFile} />
        ) : null}
      </li>
    );
  }

  const active = fullPath === activeFile;
  return (
    <li
      className={`${styles.treeFile} ${active ? styles.treeFileActive : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelectFile(fullPath);
      }}
    >
      <span className={styles.treeIcon}>&#128196;</span>
      {node.name}
    </li>
  );
}

function FileTreeList({
  nodes,
  path,
  activeFile,
  onSelectFile,
}: {
  nodes: AdoFileNode[];
  path: string;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  return (
    <ul className={styles.treeList}>
      {nodes.map((n) => (
        <FolderNode key={`${path}${n.name}`} node={n} path={path} activeFile={activeFile} onSelectFile={onSelectFile} />
      ))}
    </ul>
  );
}

// ===== File viewer + editor =====

function FileViewer({
  repo,
  path,
  onEdit,
}: {
  repo: AdoRepo;
  path: string;
  onEdit: () => void;
}) {
  const content = repo.fileOverrides[path] ?? fakeFileContent(path, repo.name);
  const lines = content.split("\n");

  return (
    <>
      <div className={styles.fileHeader}>
        <div>
          <strong>{path}</strong> &middot; {lines.length} lines
          {repo.fileOverrides[path] !== undefined ? <span className={styles.badge}>Edited</span> : null}
        </div>
        <div className={styles.fileActions}>
          <button type="button" className={styles.btnSubtle} onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
      <div className={styles.codeBlock}>
        {lines.map((line, i) => (
          <div className={styles.codeLine} key={i}>
            <span className={styles.ln}>{i + 1}</span>
            <span className={styles.lc}>{line}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function EditFileModal({
  repo,
  path,
  onClose,
  dispatch,
}: {
  repo: AdoRepo;
  path: string;
  onClose: () => void;
  dispatch: React.Dispatch<AdoAction>;
}) {
  const initial = repo.fileOverrides[path] ?? fakeFileContent(path, repo.name);
  const [draft, setDraft] = useState(initial);
  const [commitMessage, setCommitMessage] = useState(`Update ${path}`);

  function handleCommit() {
    dispatch({ type: "SET_FILE_OVERRIDE", repoId: repo.id, path, content: draft });
    onClose();
  }

  return (
    <Modal
      title={`Edit ${path}`}
      onClose={onClose}
      width="900px"
      footer={
        <>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.btn} onClick={handleCommit}>
            Commit
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 8, color: "#605e5c", fontSize: 12 }}>
        Branch: <code className={styles.codeInline}>{repo.defaultBranch}</code> &middot; Repo:{" "}
        <code className={styles.codeInline}>{repo.name}</code>
      </div>
      <textarea
        rows={22}
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        style={{
          width: "100%",
          fontFamily: "Consolas, Menlo, monospace",
          fontSize: 12,
          background: "#1e1e1e",
          color: "#d4d4d4",
          border: "1px solid #3c3c3c",
          padding: 10,
          borderRadius: 4,
          resize: "vertical",
        }}
      />
      <label style={{ display: "block", marginTop: 10 }}>
        Commit message
        <br />
        <input
          className={styles.input}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
    </Modal>
  );
}

// ===== ReposFilesPage =====

export function ReposFilesPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [repo, repoId, setRepoId] = useSelectedRepo(state);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  function handleRepoChange(id: string) {
    setRepoId(id);
    setActiveFile(null);
    setEditing(false);
  }

  if (!repo) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Repos</div>
        <EmptyState message="No repositories in this project." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Files</div>
      <div className={styles.pageSub}>
        {repo.name} &middot; branch <code className={styles.codeInline}>{repo.defaultBranch}</code>
      </div>

      <RepoSwitcher repos={state.repos} repo={repo} onChange={handleRepoChange} />

      <div className={styles.repoGrid}>
        <div className={styles.fileTree}>
          <div className={styles.treeH}>{repo.name}</div>
          <FileTreeList nodes={repo.files} path="" activeFile={activeFile} onSelectFile={setActiveFile} />
        </div>
        <div className={styles.fileViewer}>
          {activeFile ? (
            <FileViewer repo={repo} path={activeFile} onEdit={() => setEditing(true)} />
          ) : (
            <EmptyState message="Select a file from the tree to view its contents." />
          )}
        </div>
      </div>

      {editing && activeFile ? (
        <EditFileModal repo={repo} path={activeFile} onClose={() => setEditing(false)} dispatch={dispatch} />
      ) : null}
    </div>
  );
}

// ===== ReposCommitsPage =====

// Static illustrative diff pattern — ported verbatim from ado-repos.js
// `openCommit()`. Source generates the SAME 12-line pattern (lines 4-5
// removed, 6-7 added, rest unchanged) against the SAME fake filename
// (`src/services/AuthService.js`) no matter which commit was clicked; this is
// NOT a real per-commit diff computation, and the UI below labels it as such.
const ILLUSTRATIVE_DIFF_FILE = "src/services/AuthService.js";

type DiffLineKind = "context" | "add" | "del";
type DiffLine = { kind: DiffLineKind; oldNo: number | null; newNo: number | null; text: string };

function buildIllustrativeDiff(): DiffLine[] {
  const rows: DiffLine[] = [];
  for (let i = 1; i <= 12; i++) {
    if (i === 4 || i === 5) {
      rows.push({ kind: "del", oldNo: i, newNo: null, text: `- old.code.path.removed(${i})` });
    } else if (i === 6 || i === 7) {
      rows.push({ kind: "add", oldNo: null, newNo: i, text: `+ refactored.implementation.add(${i})` });
    } else {
      rows.push({ kind: "context", oldNo: i, newNo: i, text: `  unchanged code line ${i}` });
    }
  }
  return rows;
}

function CommitDiffModal({ repo, commit, onClose }: { repo: AdoRepo; commit: AdoCommit; onClose: () => void }) {
  const diffRows = useMemo(() => buildIllustrativeDiff(), []);

  return (
    <Modal
      title={`Commit ${commit.short}`}
      onClose={onClose}
      width="760px"
      footer={
        <button type="button" className={styles.btnOutline} onClick={onClose}>
          Close
        </button>
      }
    >
      <div className={styles.commitMeta}>
        <div>
          <strong>{commit.message}</strong>
        </div>
        <div>
          by {commit.author} on {commit.date} &middot; <code className={styles.codeInline}>{commit.id.substring(0, 12)}</code>
        </div>
        <div>
          <span className={styles.diffAdd}>+{commit.additions}</span> <span className={styles.diffDel}>-{commit.deletions}</span> across{" "}
          {commit.files} files in {repo.name}
        </div>
      </div>

      <div className={styles.h3} style={{ marginTop: 14 }}>
        Files changed
      </div>
      <div style={{ fontSize: 12, color: "#605e5c", marginBottom: 8 }}>
        Illustrative example diff — a fixed reference pattern shown for any commit, not a real per-commit computation.
      </div>
      <div className={styles.diffFile}>
        <div className={styles.diffFileH}>{ILLUSTRATIVE_DIFF_FILE}</div>
        {diffRows.map((row, i) => (
          <div
            key={i}
            className={`${styles.diffRow} ${row.kind === "add" ? styles.diffRowAdd : row.kind === "del" ? styles.diffRowDel : ""}`}
          >
            <span className={styles.lnOld}>{row.oldNo ?? ""}</span>
            <span className={styles.lnNew}>{row.newNo ?? ""}</span>
            <span className={styles.diffLine}>{row.text}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function ReposCommitsPage({ state }: { state: AdoState }) {
  const [repo, repoId, setRepoId] = useSelectedRepo(state);
  const [openCommitId, setOpenCommitId] = useState<string | null>(null);

  function handleRepoChange(id: string) {
    setRepoId(id);
    setOpenCommitId(null);
  }

  if (!repo) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>Repos</div>
        <EmptyState message="No repositories in this project." />
      </div>
    );
  }

  const openCommit = repo.commits.find((c) => c.id === openCommitId) ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Commits</div>
      <div className={styles.pageSub}>
        {repo.name} &middot; {repo.commits.length} commits
      </div>

      <RepoSwitcher repos={state.repos} repo={repo} onChange={handleRepoChange} />

      <DataTable<AdoCommit>
        columns={[
          { key: "hash", header: "Commit", render: (c) => <code className={styles.hash}>{c.short}</code> },
          { key: "message", header: "Message", render: (c) => c.message },
          {
            key: "author",
            header: "Author",
            render: (c) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <InitialsAvatar name={c.author} /> {c.author}
              </span>
            ),
          },
          { key: "date", header: "Date", render: (c) => c.date },
          { key: "branch", header: "Branch", render: (c) => <code className={styles.branchTag}>{c.branch}</code> },
          { key: "files", header: "Files", render: (c) => `${c.files} files` },
          {
            key: "changes",
            header: "Changes",
            render: (c) => (
              <>
                <span className={styles.diffAdd}>+{c.additions}</span> <span className={styles.diffDel}>-{c.deletions}</span>
              </>
            ),
          },
        ]}
        rows={repo.commits}
        getRowKey={(c) => c.id}
        onRowClick={(c) => setOpenCommitId(c.id)}
        emptyMessage="No commits in this repository."
      />

      {openCommit ? <CommitDiffModal repo={repo} commit={openCommit} onClose={() => setOpenCommitId(null)} /> : null}
    </div>
  );
}
