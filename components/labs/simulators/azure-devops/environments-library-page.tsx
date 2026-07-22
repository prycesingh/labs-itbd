"use client";

// Environments & Library page for the Azure DevOps simulator. Ported from
// itbd-lab/simulators/azure-devops/js/ado-pipelines-depth.js (the richer,
// previously-nav-unreachable reference module covering
// Environments/Checks/Library/Secure-files/Service-Connections/Agent-Pools/
// Deployment-Groups) merged with the CREATE-flow UX patterns from
// ado-pipelines.js (renderEnvironments/openEnv/renderLibrary/
// renderServiceConnections) — but backed by the richer seeded data model
// (AdoState.environments/variableGroups/secureFiles/serviceConnections/
// taskGroups/deploymentGroups from seedData.ts) and driven by real reducer
// actions instead of source's native `prompt()` calls.
//
// Per this sub-phase's scope decision this page is now reachable from the
// main nav as "environments-library" (see ado-shell.tsx) exposing 5
// sub-views via SubTabBar: Environments, Library (variable groups + secure
// files), Service connections, Task groups, Deployment groups. Agent pools
// and the per-environment Checks blade from source are out of scope here —
// AdoState has no `agentPools`/`checks` shape, so nothing is fabricated for
// them; only the shapes the foundation agent actually seeded are rendered.
//
// Architect-tip callouts (Key Vault-linked variable groups, workload
// identity federation for service connections) are ported faithfully from
// source's inline-styled `<div style="background:#deecf9...">` /
// `<div style="background:#fff4ce...">` boxes onto the shared `.sprintBanner`
// callout class (the one banner/callout style already present in the CSS
// module) — no new inline styles, no new CSS classes.

import { useState } from "react";

import type { AdoState } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import type {
  AdoDeployment,
  AdoDeploymentGroup,
  AdoEnvironment,
  AdoSecureFile,
  AdoServiceConnection,
  AdoTaskGroup,
  AdoVariable,
  AdoVariableGroup,
} from "@/lib/labs/simulators/azure-devops/types";
import { toast } from "sonner";

import {
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Modal,
  StatusPill,
  SubTabBar,
  statusTone,
  type DataTableColumn,
} from "./ado-ui";
import styles from "./ado-console.module.css";

type LibrarySection = "environments" | "library" | "connections" | "task-groups" | "deployment-groups";

const SUB_TABS: { key: LibrarySection; label: string }[] = [
  { key: "environments", label: "Environments" },
  { key: "library", label: "Library" },
  { key: "connections", label: "Service connections" },
  { key: "task-groups", label: "Task groups" },
  { key: "deployment-groups", label: "Deployment groups" },
];

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
}

// ===== Environments =====

function EnvironmentsSection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [selected, setSelected] = useState<AdoEnvironment | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceCount, setResourceCount] = useState("1");

  function resetForm() {
    setName("");
    setDescription("");
    setResourceCount("1");
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Environment name is required.");
      return;
    }
    const environment: AdoEnvironment = {
      id: genId("env"),
      name: trimmed.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      description: description.trim(),
      resourceCount: Math.max(0, Number.parseInt(resourceCount, 10) || 0),
      deployments: [],
    };
    dispatch({ type: "ADD_ENVIRONMENT", environment });
    toast.success(`Environment ${environment.name} created`);
    setCreating(false);
    resetForm();
  }

  const columns: DataTableColumn<AdoEnvironment>[] = [
    { key: "name", header: "Environment", render: (e) => <strong>{e.name}</strong> },
    { key: "description", header: "Description", render: (e) => e.description },
    { key: "resources", header: "Resources", render: (e) => e.resourceCount },
    {
      key: "deployments",
      header: "Deployment history",
      render: (e) =>
        e.deployments.length === 0
          ? "No deployments yet"
          : `${e.deployments.length} deployment${e.deployments.length === 1 ? "" : "s"} · last ${statusLabel(e.deployments[0])}`,
    },
  ];

  return (
    <div>
      <div className={styles.toolbar}>
        <strong>{state.environments.length} environments</strong>
        <div className={styles.tbSpacer} />
        <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
          + New environment
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={state.environments}
        getRowKey={(e) => e.id}
        onRowClick={(e) => setSelected(e)}
        emptyMessage="No environments yet."
      />

      {selected ? (
        <Modal title={`Environment: ${selected.name}`} width="640px" onClose={() => setSelected(null)}>
          <div className={styles.row}>
            <div className={styles.lbl}>Description</div>
            <div>{selected.description || "—"}</div>
          </div>
          <div className={styles.row}>
            <div className={styles.lbl}>Resources</div>
            <div>{selected.resourceCount}</div>
          </div>
          <div className={styles.h3}>Deployment history</div>
          {selected.deployments.length === 0 ? (
            <EmptyState message="No deployments recorded for this environment yet." />
          ) : (
            <DataTable<AdoDeployment>
              columns={[
                { key: "when", header: "When", render: (d) => new Date(d.when).toLocaleString() },
                { key: "status", header: "Status", render: (d) => <StatusPill tone={statusTone(d.status)}>{d.status}</StatusPill> },
                { key: "by", header: "By", render: (d) => d.by },
              ]}
              rows={selected.deployments}
              getRowKey={(d) => `${d.when}-${d.by}`}
            />
          )}
        </Modal>
      ) : null}

      {creating ? (
        <Modal
          title="New environment"
          onClose={() => {
            setCreating(false);
            resetForm();
          }}
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
                Create
              </button>
            </>
          }
        >
          <Field label="Name" help='Lowercase, e.g. "uat"'>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="uat" />
          </Field>
          <Field label="Description">
            <input className={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this environment" />
          </Field>
          <Field label="Resource count">
            <input
              className={styles.input}
              type="number"
              min={0}
              value={resourceCount}
              onChange={(e) => setResourceCount(e.target.value)}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

function statusLabel(d: AdoDeployment): string {
  return `${d.status} (${d.by})`;
}

// ===== Library: variable groups + secure files =====

function VariableGroupsSection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [selected, setSelected] = useState<AdoVariableGroup | null>(null);
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [linkedKeyVault, setLinkedKeyVault] = useState("");
  const [varsText, setVarsText] = useState("");

  function resetForm() {
    setName("");
    setLinkedKeyVault("");
    setVarsText("");
  }

  function parseVariables(text: string): AdoVariable[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const secret = line.startsWith("*");
        const clean = secret ? line.slice(1).trim() : line;
        const [k, ...rest] = clean.split("=");
        return { k: (k ?? "").trim(), v: rest.join("=").trim(), secret };
      })
      .filter((v) => v.k.length > 0);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Variable group name is required.");
      return;
    }
    const group: AdoVariableGroup = {
      id: genId("vg"),
      name: trimmed,
      linkedKeyVault: linkedKeyVault.trim() || null,
      variables: parseVariables(varsText),
    };
    dispatch({ type: "ADD_VARIABLE_GROUP", group });
    toast.success(`Variable group ${group.name} created`);
    setCreating(false);
    resetForm();
  }

  const columns: DataTableColumn<AdoVariableGroup>[] = [
    { key: "name", header: "Name", render: (g) => <strong>{g.name}</strong> },
    { key: "kv", header: "Linked Key Vault", render: (g) => (g.linkedKeyVault ? <StatusPill tone="done">{g.linkedKeyVault}</StatusPill> : "—") },
    { key: "count", header: "Variables", render: (g) => g.variables.length },
  ];

  return (
    <div>
      <div className={styles.h3}>Variable groups</div>
      <div className={styles.toolbar}>
        <strong>{state.variableGroups.length} variable groups</strong>
        <div className={styles.tbSpacer} />
        <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
          + New variable group
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={state.variableGroups}
        getRowKey={(g) => g.id}
        onRowClick={(g) => {
          setSelected(g);
          setRevealSecrets(false);
        }}
        emptyMessage="No variable groups yet."
      />

      <div className={styles.sprintBanner}>
        <strong>Secret hygiene:</strong> Prefer <strong>Key Vault-linked variable groups</strong> over Pipeline secrets. Key Vault
        gives audit trail, RBAC, rotation, and a single source of truth. Mark variable groups as{" "}
        <strong>&quot;link secrets from an Azure Key Vault&quot;</strong> when creating.
      </div>

      {selected ? (
        <Modal title={`Variable group: ${selected.name}`} width="640px" onClose={() => setSelected(null)}>
          <div className={styles.row}>
            <div className={styles.lbl}>Linked Key Vault</div>
            <div>{selected.linkedKeyVault ?? "Not linked"}</div>
          </div>
          <Checkbox label="Reveal secret values" checked={revealSecrets} onChange={setRevealSecrets} />
          <DataTable<AdoVariable>
            columns={[
              { key: "k", header: "Name", render: (v) => v.k },
              { key: "v", header: "Value", render: (v) => <span className={styles.codeInline}>{v.secret && !revealSecrets ? "********" : v.v}</span> },
              { key: "secret", header: "Type", render: (v) => (v.secret ? <span className={styles.tag}>Secret</span> : "") },
            ]}
            rows={selected.variables}
            getRowKey={(v) => v.k}
            emptyMessage="No variables in this group."
          />
        </Modal>
      ) : null}

      {creating ? (
        <Modal
          title="New variable group"
          onClose={() => {
            setCreating(false);
            resetForm();
          }}
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
                Create
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-secrets" />
          </Field>
          <Field label="Linked Key Vault" help="Leave blank to keep variables inline (no Key Vault link).">
            <input className={styles.input} value={linkedKeyVault} onChange={(e) => setLinkedKeyVault(e.target.value)} placeholder="kv-ado-prod" />
          </Field>
          <Field label="Variables" help='One per line, "KEY=value". Prefix a line with * to mark it secret, e.g. "*DB_PASS=hunter2".'>
            <textarea
              className={styles.input}
              rows={5}
              value={varsText}
              onChange={(e) => setVarsText(e.target.value)}
              placeholder={"LOG_LEVEL=warning\n*SQL_CONN_STRING=..."}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

function SecureFilesSection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [size, setSize] = useState("");

  function resetForm() {
    setName("");
    setSize("");
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("File name is required.");
      return;
    }
    const file: AdoSecureFile = {
      id: genId("sf"),
      name: trimmed,
      uploaded: new Date().toISOString().substring(0, 10),
      size: size.trim() || "0 KB",
    };
    dispatch({ type: "ADD_SECURE_FILE", file });
    toast.success(`Secure file ${file.name} uploaded`);
    setCreating(false);
    resetForm();
  }

  const columns: DataTableColumn<AdoSecureFile>[] = [
    { key: "name", header: "File", render: (f) => <strong>{f.name}</strong> },
    { key: "uploaded", header: "Uploaded", render: (f) => f.uploaded },
    { key: "size", header: "Size", render: (f) => f.size },
  ];

  return (
    <div>
      <div className={styles.h3}>Secure files</div>
      <p className={styles.pageSub}>
        Certificates, signing keys, SSH keys, mobile provisioning profiles — files too large or sensitive for variables.
      </p>
      <div className={styles.toolbar}>
        <strong>{state.secureFiles.length} secure files</strong>
        <div className={styles.tbSpacer} />
        <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
          + Upload
        </button>
      </div>

      <DataTable columns={columns} rows={state.secureFiles} getRowKey={(f) => f.id} emptyMessage="No secure files yet." />

      {creating ? (
        <Modal
          title="Upload secure file"
          onClose={() => {
            setCreating(false);
            resetForm();
          }}
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
                Upload
              </button>
            </>
          }
        >
          <Field label="File name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-jumpbox-ssh.pem" />
          </Field>
          <Field label="Size" help='e.g. "3.2 KB" — there is no real file upload in this simulator.'>
            <input className={styles.input} value={size} onChange={(e) => setSize(e.target.value)} placeholder="3.2 KB" />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

function LibrarySection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  return (
    <div>
      <VariableGroupsSection state={state} dispatch={dispatch} />
      <SecureFilesSection state={state} dispatch={dispatch} />
    </div>
  );
}

// ===== Service connections =====

function ServiceConnectionsSection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [scope, setScope] = useState("");
  const [verified, setVerified] = useState(true);

  function resetForm() {
    setName("");
    setType("");
    setScope("");
    setVerified(true);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Connection name is required.");
      return;
    }
    const connection: AdoServiceConnection = {
      id: genId("sc"),
      name: trimmed,
      type: type.trim() || "Generic",
      scope: scope.trim(),
      verified,
    };
    dispatch({ type: "ADD_SERVICE_CONNECTION", connection });
    toast.success(`Service connection ${connection.name} created`);
    setCreating(false);
    resetForm();
  }

  const columns: DataTableColumn<AdoServiceConnection>[] = [
    { key: "name", header: "Name", render: (c) => <strong>{c.name}</strong> },
    { key: "type", header: "Type", render: (c) => c.type },
    { key: "scope", header: "Scope", render: (c) => <span className={styles.tableSmall}>{c.scope}</span> },
    { key: "verified", header: "Verified", render: (c) => <StatusPill tone={c.verified ? "done" : "active"}>{c.verified ? "Verified" : "Pending"}</StatusPill> },
  ];

  return (
    <div>
      <p className={styles.pageSub}>
        Service connections are how pipelines authenticate to external systems. Prefer <strong>workload identity federation</strong> over secrets.
      </p>
      <div className={styles.toolbar}>
        <strong>{state.serviceConnections.length} service connections</strong>
        <div className={styles.tbSpacer} />
        <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
          + New service connection
        </button>
      </div>

      <DataTable columns={columns} rows={state.serviceConnections} getRowKey={(c) => c.id} emptyMessage="No service connections yet." />

      <div className={styles.sprintBanner}>
        <strong>Migrate to Workload Identity Federation:</strong> No client secret to rotate, no expiry, audit clear. For Azure RM,
        in connection setup pick &quot;Workload identity federation (automatic)&quot;. The Service Principal trusts the ADO project
        identity. Best architecture for 2026+.
      </div>

      {creating ? (
        <Modal
          title="New service connection"
          onClose={() => {
            setCreating(false);
            resetForm();
          }}
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
                Create
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="azure-prod-east" />
          </Field>
          <Field label="Type">
            <input className={styles.input} value={type} onChange={(e) => setType(e.target.value)} placeholder="Azure Resource Manager" />
          </Field>
          <Field label="Scope">
            <input className={styles.input} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="sub: prod-east (workload identity federation)" />
          </Field>
          <Checkbox label="Verified" checked={verified} onChange={setVerified} />
        </Modal>
      ) : null}
    </div>
  );
}

// ===== Task groups =====

function TaskGroupsSection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [selected, setSelected] = useState<AdoTaskGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stepsText, setStepsText] = useState("");

  function resetForm() {
    setName("");
    setDescription("");
    setStepsText("");
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Task group name is required.");
      return;
    }
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const group: AdoTaskGroup = {
      id: genId("tg"),
      name: trimmed,
      description: description.trim(),
      steps,
    };
    dispatch({ type: "ADD_TASK_GROUP", group });
    toast.success(`Task group ${group.name} created`);
    setCreating(false);
    resetForm();
  }

  const columns: DataTableColumn<AdoTaskGroup>[] = [
    { key: "name", header: "Name", render: (g) => <strong>{g.name}</strong> },
    { key: "description", header: "Description", render: (g) => g.description },
    { key: "steps", header: "Steps", render: (g) => `${g.steps.length} step${g.steps.length === 1 ? "" : "s"}` },
  ];

  return (
    <div>
      <p className={styles.pageSub}>Reusable groups of tasks shared across pipelines.</p>
      <div className={styles.toolbar}>
        <strong>{state.taskGroups.length} task groups</strong>
        <div className={styles.tbSpacer} />
        <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
          + New task group
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={state.taskGroups}
        getRowKey={(g) => g.id}
        onRowClick={(g) => setSelected(g)}
        emptyMessage="No task groups yet."
      />

      {selected ? (
        <Modal title={`Task group: ${selected.name}`} width="560px" onClose={() => setSelected(null)}>
          <div className={styles.row}>
            <div className={styles.lbl}>Description</div>
            <div>{selected.description || "—"}</div>
          </div>
          <div className={styles.h3}>Steps</div>
          {selected.steps.length === 0 ? (
            <EmptyState message="No steps defined." />
          ) : (
            <ol>
              {selected.steps.map((step, idx) => (
                <li key={`${idx}-${step}`} className={styles.wiText} style={{ marginBottom: 6 }}>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </Modal>
      ) : null}

      {creating ? (
        <Modal
          title="New task group"
          onClose={() => {
            setCreating(false);
            resetForm();
          }}
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
                Create
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard build + publish" />
          </Field>
          <Field label="Description">
            <input className={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Restore, build, test, publish." />
          </Field>
          <Field label="Steps" help="One step per line, in order.">
            <textarea
              className={styles.input}
              rows={4}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={"Restore dependencies\nBuild\nRun unit tests\nPublish pipeline artifact"}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

// ===== Deployment groups =====

function DeploymentGroupsSection({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [targets, setTargets] = useState("1");
  const [tagsText, setTagsText] = useState("");

  function resetForm() {
    setName("");
    setTargets("1");
    setTagsText("");
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Deployment group name is required.");
      return;
    }
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const group: AdoDeploymentGroup = {
      id: genId("dg"),
      name: trimmed,
      targets: Math.max(0, Number.parseInt(targets, 10) || 0),
      tags,
    };
    dispatch({ type: "ADD_DEPLOYMENT_GROUP", group });
    toast.success(`Deployment group ${group.name} created`);
    setCreating(false);
    resetForm();
  }

  const columns: DataTableColumn<AdoDeploymentGroup>[] = [
    { key: "name", header: "Group", render: (g) => <strong>{g.name}</strong> },
    { key: "targets", header: "Targets", render: (g) => g.targets },
    {
      key: "tags",
      header: "Tags",
      render: (g) => (
        <>
          {g.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </>
      ),
    },
  ];

  return (
    <div>
      <p className={styles.pageSub}>
        Classic VM deployment groups — used when modern Environments are not a fit (e.g., on-prem Windows server fleet without
        containerization).
      </p>
      <div className={styles.toolbar}>
        <strong>{state.deploymentGroups.length} deployment groups</strong>
        <div className={styles.tbSpacer} />
        <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
          + New deployment group
        </button>
      </div>

      <DataTable columns={columns} rows={state.deploymentGroups} getRowKey={(g) => g.id} emptyMessage="No deployment groups yet." />

      {creating ? (
        <Modal
          title="New deployment group"
          onClose={() => {
            setCreating(false);
            resetForm();
          }}
          footer={
            <>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setCreating(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleCreate}>
                Create
              </button>
            </>
          }
        >
          <Field label="Name">
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="web-prod-iis-pool" />
          </Field>
          <Field label="Targets" help="Number of registered machines.">
            <input className={styles.input} type="number" min={0} value={targets} onChange={(e) => setTargets(e.target.value)} />
          </Field>
          <Field label="Tags" help="Comma-separated, e.g. iis, prod, east">
            <input className={styles.input} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="iis, prod, east" />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

// ===== Page root =====

export function EnvironmentsLibraryPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const [section, setSection] = useState<LibrarySection>("environments");

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>Environments &amp; Library</div>
      <div className={styles.pageSub}>
        Environments, Library variable groups, Service connections, Task groups, Deployment groups — the production scaffolding.
      </div>

      <SubTabBar tabs={SUB_TABS} active={section} onChange={(key) => setSection(key as LibrarySection)} />

      {section === "environments" ? <EnvironmentsSection state={state} dispatch={dispatch} /> : null}
      {section === "library" ? <LibrarySection state={state} dispatch={dispatch} /> : null}
      {section === "connections" ? <ServiceConnectionsSection state={state} dispatch={dispatch} /> : null}
      {section === "task-groups" ? <TaskGroupsSection state={state} dispatch={dispatch} /> : null}
      {section === "deployment-groups" ? <DeploymentGroupsSection state={state} dispatch={dispatch} /> : null}
    </div>
  );
}
