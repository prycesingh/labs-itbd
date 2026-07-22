"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  AvdHostPool,
  AvdHostPoolType,
  AvdSessionHost,
  AvdState,
} from "@/lib/labs/simulators/avd/types";
import type { AvdAction } from "@/lib/labs/simulators/avd/reducer";
import styles from "./avd-console.module.css";
import {
  Callout,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  NativeSelect,
  PropPair,
  RadioInline,
  SectionHeader,
  StatusBadge,
  TabBar,
  WizardFooter,
} from "./avd-ui";

// ─── Wizard tabs (exact 5 tabs from source avd-hostpool.js TABS) ─────────
const TABS = [
  { id: "basics", label: "Basics" },
  { id: "vms", label: "Virtual Machines" },
  { id: "workspace", label: "Workspace" },
  { id: "tags", label: "Tags" },
  { id: "review", label: "Review + create" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ─── Detail blade sections (exact ~16 sections from source SECTIONS) ─────
const SECTIONS: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: "",
    items: [
      { id: "overview", label: "Overview" },
      { id: "activity", label: "Activity log" },
      { id: "iam", label: "Access control (IAM)" },
      { id: "tags", label: "Tags" },
    ],
  },
  {
    group: "Settings",
    items: [
      { id: "properties", label: "Properties" },
      { id: "session-hosts", label: "Session hosts" },
      { id: "assignments", label: "Assignments" },
      { id: "app-groups", label: "Application groups" },
      { id: "scaling-plans", label: "Scaling plans" },
      { id: "rdp-properties", label: "RDP properties" },
      { id: "licensing", label: "Licensing" },
      { id: "diag-settings", label: "Diagnostic settings" },
      { id: "props-info", label: "Properties (info)" },
      { id: "locks", label: "Locks" },
      { id: "export-template", label: "Export template" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "run-script", label: "Run a script" },
      { id: "gethelp", label: "Get-help diagnostics" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { id: "insights", label: "Insights" },
      { id: "metrics", label: "Metrics" },
      { id: "logs", label: "Logs" },
    ],
  },
  {
    group: "Cost",
    items: [{ id: "cost", label: "Cost analysis" }],
  },
];

// ─── Wizard local state shape (mirrors freshState() in source) ──────────
type WizardTag = { key: string; value: string };

type WizardState = {
  resourceGroup: string;
  hostPoolName: string;
  region: string;
  validationEnvironment: boolean;
  preferredAppGroupType: "Desktop" | "RemoteApp";
  hostPoolType: AvdHostPoolType;
  loadBalancing: "Breadth-first" | "Depth-first";
  maxSessionLimit: number;
  assignmentType: "Automatic" | "Direct";
  azureStackHci: "No" | "Yes";
  addVms: "No" | "Yes";
  vmResourceGroup: string;
  vmNamePrefix: string;
  vmLocation: string;
  availabilityOptions: string;
  securityType: string;
  image: string;
  vmSize: string;
  numberOfVms: number;
  osDiskType: string;
  bootDiagnostics: string;
  virtualNetwork: string;
  subnet: string;
  nsg: "None" | "Basic" | "Advanced";
  publicIp: "None" | "Auto-generated";
  domainJoin: "Microsoft Entra ID" | "Active Directory Domain Services";
  adDomain: string;
  adOu: string;
  adUser: string;
  adPassword: string;
  registerWorkspace: "No" | "Yes";
  workspaceTarget: string;
  tags: WizardTag[];
};

function freshWizardState(state: AvdState): WizardState {
  return {
    resourceGroup: state.resourceGroups[0]?.name ?? "rg-avd-prod",
    hostPoolName: "",
    region: state.regions[0] ?? "East US",
    validationEnvironment: false,
    preferredAppGroupType: "Desktop",
    hostPoolType: "Pooled",
    loadBalancing: "Breadth-first",
    maxSessionLimit: 10,
    assignmentType: "Automatic",
    azureStackHci: "No",
    addVms: "No",
    vmResourceGroup: state.resourceGroups[0]?.name ?? "rg-avd-prod",
    vmNamePrefix: "avd-vm-prod",
    vmLocation: state.regions[0] ?? "East US",
    availabilityOptions: "Availability zone",
    securityType: "Trusted launch virtual machines",
    image: state.images[0]?.id ?? "",
    vmSize: state.vmSizes[0]?.name ?? "",
    numberOfVms: 2,
    osDiskType: "Premium SSD",
    bootDiagnostics: "Enable with managed storage account",
    virtualNetwork: "vnet-avd",
    subnet: "avd-sessionhosts",
    nsg: "Basic",
    publicIp: "None",
    domainJoin: "Microsoft Entra ID",
    adDomain: "",
    adOu: "",
    adUser: "",
    adPassword: "",
    registerWorkspace: "No",
    workspaceTarget: "",
    tags: [],
  };
}

function validateWizard(state: WizardState): string[] {
  const errs: string[] = [];
  if (!state.hostPoolName) errs.push("Host pool name is required.");
  else if (!/^[a-zA-Z0-9-]{3,64}$/.test(state.hostPoolName)) {
    errs.push("Host pool name must be 3-64 alphanumeric or hyphen characters.");
  }
  if (!state.resourceGroup) errs.push("Resource group is required.");
  if (state.addVms === "Yes" && !state.vmNamePrefix) errs.push("VM name prefix is required when adding VMs.");
  if (state.addVms === "Yes" && state.domainJoin === "Active Directory Domain Services" && !state.adDomain) {
    errs.push("AD domain is required.");
  }
  if (state.registerWorkspace === "Yes" && !state.workspaceTarget) {
    errs.push("Pick a workspace or set Register workspace to No.");
  }
  return errs;
}

// ─── RDP property categories (exact from source secRdpProperties) ───────
const RDP_CATEGORIES: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: "Connection information",
    items: [
      { key: "enablerdsaadauth", label: "Use Entra ID authentication (enablerdsaadauth)" },
      { key: "targetisaadjoined", label: "Target is Entra-joined (targetisaadjoined)" },
    ],
  },
  {
    title: "Device redirection",
    items: [
      { key: "redirectprinters", label: "Redirect printers (redirectprinters)" },
      { key: "redirectsmartcards", label: "Redirect smart cards (redirectsmartcards)" },
      { key: "redirectcomports", label: "Redirect COM ports (redirectcomports)" },
      { key: "drivestoredirect", label: "Redirect drives (drivestoredirect:s:*)" },
      { key: "usbdevicestoredirect", label: "Redirect USB devices (usbdevicestoredirect:s:*)" },
    ],
  },
  {
    title: "Display settings",
    items: [
      { key: "use multimon", label: "Use all my monitors (use multimon:i:1)" },
      { key: "videoplaybackmode", label: "Video playback mode (videoplaybackmode:i:1)" },
    ],
  },
  {
    title: "Local devices and resources",
    items: [
      { key: "redirectclipboard", label: "Redirect clipboard (redirectclipboard)" },
      { key: "audiocapturemode", label: "Audio capture / mic (audiocapturemode:i:1)" },
      { key: "audiomode", label: "Audio playback mode (audiomode:i:0)" },
    ],
  },
  {
    title: "Session behavior",
    items: [
      { key: "autoreconnection enabled", label: "Auto-reconnect (autoreconnection enabled:i:1)" },
      { key: "singlemoninwindowedmode", label: "Single monitor in windowed mode" },
    ],
  },
];

function toggleRdpKey(rdp: string, key: string, enabled: boolean): string {
  if (enabled) {
    if (rdp.indexOf(key) === -1) return rdp + (rdp ? ";\n" : "") + key + ":i:1";
    return rdp;
  }
  return rdp
    .split(/;\s*/)
    .filter((line) => line.indexOf(key) === -1)
    .join(";\n");
}

export function HostPoolsPage({ state, dispatch }: { state: AvdState; dispatch: React.Dispatch<AvdAction> }) {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState("overview");

  const [wizard, setWizard] = useState<WizardState>(() => freshWizardState(state));
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  function setWiz<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setWizard((w) => ({ ...w, [key]: value }));
  }

  function openCreate() {
    setWizard(freshWizardState(state));
    setActiveTab("basics");
    setView("create");
  }

  function openDetail(id: string, sec = "overview") {
    setSelectedId(id);
    setSection(sec);
    setView("detail");
  }

  const validationErrors = useMemo(() => validateWizard(wizard), [wizard]);

  function commitWizard() {
    const errs = validateWizard(wizard);
    if (errs.length > 0) {
      setActiveTab("review");
      return;
    }
    const id = "hp-" + crypto.randomUUID();
    const pool: AvdHostPool = {
      id,
      name: wizard.hostPoolName,
      resourceGroup: wizard.resourceGroup,
      region: wizard.region,
      type: wizard.hostPoolType,
      loadBalancing: wizard.hostPoolType === "Pooled" ? wizard.loadBalancing : "",
      assignmentType: wizard.hostPoolType === "Personal" ? wizard.assignmentType : "",
      maxSessionLimit: wizard.hostPoolType === "Pooled" ? wizard.maxSessionLimit : 1,
      validationEnvironment: wizard.validationEnvironment,
      startVmOnConnect: false,
      preferredAppGroupType: wizard.preferredAppGroupType,
      agentVersion: "1.0.8431.2200",
      customRdpProperty: state.defaultCustomRdp,
      description: "",
      scalingPlans: [],
      azureStackHci: wizard.azureStackHci === "Yes",
      tags: wizard.tags.filter((t) => t.key).reduce<Record<string, string>>((acc, t) => {
        acc[t.key] = t.value;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_HOST_POOL", pool });

    // If "Yes", auto-generate session-host stubs (mirrors source _commit)
    if (wizard.addVms === "Yes") {
      const image = state.images.find((i) => i.id === wizard.image);
      for (let i = 1; i <= wizard.numberOfVms; i++) {
        const host: AvdSessionHost = {
          id: "sh-" + crypto.randomUUID(),
          name: `${wizard.vmNamePrefix}-${String(i).padStart(2, "0")}.cloudlab.in`,
          hostPool: pool.name,
          status: "Available",
          sessions: 0,
          disconnectedSessions: 0,
          allowNewSessions: true,
          agentVersion: pool.agentVersion,
          os: image?.os ?? "Windows 11 multi-session",
          lastHeartbeat: new Date().toISOString(),
          drainMode: false,
          vmSize: wizard.vmSize,
        };
        dispatch({ type: "ADD_SESSION_HOST", host });
      }
    }

    // Optionally register a desktop app group + workspace link
    if (wizard.registerWorkspace === "Yes" && wizard.workspaceTarget) {
      const agId = "ag-" + crypto.randomUUID();
      dispatch({
        type: "ADD_APP_GROUP",
        group: {
          id: agId,
          name: "DAG-" + pool.name,
          type: "Desktop",
          hostPool: pool.name,
          resourceGroup: pool.resourceGroup,
          region: pool.region,
          description: "Auto-created desktop app group.",
          workspace: wizard.workspaceTarget,
          applications: [],
          assignments: [],
          tags: {},
        },
      });
    }

    toast.success(`Host pool "${pool.name}" created`);
    setView("detail");
    setSelectedId(id);
    setSection("overview");
  }

  if (view === "create") {
    return (
      <CreateWizard
        state={state}
        wizard={wizard}
        activeTab={activeTab}
        activeIndex={activeIndex}
        validationErrors={validationErrors}
        setWiz={setWiz}
        setWizard={setWizard}
        setActiveTab={setActiveTab}
        onCancel={() => setView("list")}
        onCommit={commitWizard}
      />
    );
  }

  if (view === "detail" && selectedId) {
    const pool = state.hostPools.find((p) => p.id === selectedId);
    if (!pool) {
      setView("list");
      return null;
    }
    return (
      <DetailBlade
        state={state}
        pool={pool}
        section={section}
        dispatch={dispatch}
        onNavigate={(id, sec) => openDetail(id, sec)}
        onBack={() => setView("list")}
      />
    );
  }

  return <ListView state={state} onCreate={openCreate} onOpen={(id) => openDetail(id, "overview")} />;
}

// ─────────────────────────────────────────────────────────────────────────
// LIST VIEW
// ─────────────────────────────────────────────────────────────────────────
function ListView({
  state,
  onCreate,
  onOpen,
}: {
  state: AvdState;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={styles.listBody}>
      <div className={styles.listHeader}>
        <div>
          <h1>Host pools</h1>
          <div className="sub">Azure Virtual Desktop &gt; Host pools</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button type="button" className={styles.btn} onClick={onCreate}>
          + Create host pool
        </button>
        <button type="button" className={styles.btnOutline}>
          Refresh
        </button>
        <button type="button" className={styles.btnOutline}>
          Export to CSV
        </button>
        <button type="button" className={styles.btnOutline}>
          Assign tags
        </button>
      </div>

      {state.hostPools.length === 0 ? (
        <EmptyState message='No host pools yet. Click "+ Create host pool" to deploy one.' />
      ) : (
        <DataTable
          columns={["Name", "Host pool type", "Location", "Resource group", "Session hosts", "Max session limit", "Load balancing"]}
        >
          {state.hostPools.map((hp) => {
            const hostCount = state.sessionHosts.filter((h) => h.hostPool === hp.name).length;
            return (
              <tr key={hp.id}>
                <td>
                  <button type="button" className={styles.link} onClick={() => onOpen(hp.id)}>
                    {hp.name}
                  </button>
                </td>
                <td>
                  <StatusBadge status={hp.type} />
                </td>
                <td>{hp.region}</td>
                <td>{hp.resourceGroup}</td>
                <td>{hostCount}</td>
                <td>{hp.maxSessionLimit}</td>
                <td>{hp.type === "Pooled" ? hp.loadBalancing || "—" : hp.assignmentType || "—"}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: "#605e5c" }}>
        Showing {state.hostPools.length} of {state.hostPools.length}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CREATE WIZARD
// ─────────────────────────────────────────────────────────────────────────
function CreateWizard({
  state,
  wizard,
  activeTab,
  activeIndex,
  validationErrors,
  setWiz,
  setWizard,
  setActiveTab,
  onCancel,
  onCommit,
}: {
  state: AvdState;
  wizard: WizardState;
  activeTab: TabId;
  activeIndex: number;
  validationErrors: string[];
  setWiz: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
  setActiveTab: (id: TabId) => void;
  onCancel: () => void;
  onCommit: () => void;
}) {
  return (
    <div className={styles.wizard}>
      <TabBar
        tabs={TABS.map((t, i) => ({ id: t.id, label: t.label, done: i < activeIndex }))}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      <div className={styles.wizBody}>
        {activeTab === "basics" && <TabBasics state={state} wizard={wizard} setWiz={setWiz} />}
        {activeTab === "vms" && <TabVms state={state} wizard={wizard} setWiz={setWiz} />}
        {activeTab === "workspace" && <TabWorkspace state={state} wizard={wizard} setWiz={setWiz} />}
        {activeTab === "tags" && <TabTags wizard={wizard} setWizard={setWizard} />}
        {activeTab === "review" && <TabReview wizard={wizard} errors={validationErrors} />}
      </div>

      <WizardFooter
        onCancel={onCancel}
        onBack={activeIndex > 0 ? () => setActiveTab(TABS[activeIndex - 1].id) : undefined}
        onNext={activeIndex < TABS.length - 1 ? () => setActiveTab(TABS[activeIndex + 1].id) : onCommit}
        nextLabel={activeIndex < TABS.length - 1 ? `Next: ${TABS[activeIndex + 1].label} >` : "Create"}
      />
    </div>
  );
}

function TabBasics({
  state,
  wizard,
  setWiz,
}: {
  state: AvdState;
  wizard: WizardState;
  setWiz: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  return (
    <>
      <SectionHeader
        title="Project details"
        sub="Select the subscription, resource group and a unique name for this host pool."
      />
      <Field label="Subscription" required>
        <NativeSelect value={state.subscription.name} onChange={() => {}}>
          <option>{state.subscription.name}</option>
        </NativeSelect>
      </Field>
      <Field label="Resource group" required>
        <NativeSelect value={wizard.resourceGroup} onChange={(v) => setWiz("resourceGroup", v)}>
          {state.resourceGroups.map((rg) => (
            <option key={rg.name} value={rg.name}>
              {rg.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <SectionHeader title="Host pool" />
      <Field label="Host pool name" required>
        <input
          value={wizard.hostPoolName}
          onChange={(e) => setWiz("hostPoolName", e.target.value)}
          placeholder="e.g., hp-prod-pooled"
          className={styles.input}
        />
      </Field>
      <Field label="Location" required>
        <NativeSelect value={wizard.region} onChange={(v) => setWiz("region", v)}>
          {state.regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </NativeSelect>
      </Field>
      <Checkbox
        label="Validation environment"
        checked={wizard.validationEnvironment}
        onChange={(v) => setWiz("validationEnvironment", v)}
        help="Receive AVD agent updates earlier than production pools."
      />
      <Field label="Preferred app group type">
        <RadioInline
          name="hp-preferredAppGroupType"
          value={wizard.preferredAppGroupType}
          onChange={(v) => setWiz("preferredAppGroupType", v as WizardState["preferredAppGroupType"])}
          choices={["Desktop", "RemoteApp"]}
        />
      </Field>
      <Field label="Host pool type">
        <RadioInline
          name="hp-hostPoolType"
          value={wizard.hostPoolType}
          onChange={(v) => setWiz("hostPoolType", v as AvdHostPoolType)}
          choices={["Pooled", "Personal"]}
        />
      </Field>

      {wizard.hostPoolType === "Pooled" ? (
        <>
          <Field label="Load balancing algorithm">
            <NativeSelect
              value={wizard.loadBalancing}
              onChange={(v) => setWiz("loadBalancing", v as WizardState["loadBalancing"])}
            >
              <option>Breadth-first</option>
              <option>Depth-first</option>
            </NativeSelect>
          </Field>
          <Field label="Max session limit">
            <input
              type="number"
              min={1}
              max={999999}
              value={wizard.maxSessionLimit}
              onChange={(e) => setWiz("maxSessionLimit", parseInt(e.target.value, 10) || 1)}
              className={styles.input}
              style={{ width: 120 }}
            />
          </Field>
        </>
      ) : (
        <Field label="Assignment type">
          <NativeSelect
            value={wizard.assignmentType}
            onChange={(v) => setWiz("assignmentType", v as WizardState["assignmentType"])}
          >
            <option>Automatic</option>
            <option>Direct</option>
          </NativeSelect>
        </Field>
      )}

      <SectionHeader title="Azure Stack HCI" />
      <Field label="Deploy to Azure Stack HCI?">
        <RadioInline
          name="hp-azureStackHci"
          value={wizard.azureStackHci}
          onChange={(v) => setWiz("azureStackHci", v as "No" | "Yes")}
          choices={["No", "Yes"]}
        />
      </Field>
    </>
  );
}

function TabVms({
  state,
  wizard,
  setWiz,
}: {
  state: AvdState;
  wizard: WizardState;
  setWiz: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  if (wizard.addVms === "No") {
    return (
      <>
        <SectionHeader title="Virtual machines" sub="Add session host VMs now, or skip and register them later." />
        <Field label="Add virtual machines">
          <RadioInline
            name="hp-addVms"
            value={wizard.addVms}
            onChange={(v) => setWiz("addVms", v as "No" | "Yes")}
            choices={["No", "Yes"]}
          />
        </Field>
        <Callout tone="info">
          Skipping this step is fine — you can register session hosts after the host pool is created.
        </Callout>
      </>
    );
  }

  return (
    <>
      <SectionHeader title="Virtual machines" sub="Add session host VMs now." />
      <Field label="Add virtual machines">
        <RadioInline
          name="hp-addVms"
          value={wizard.addVms}
          onChange={(v) => setWiz("addVms", v as "No" | "Yes")}
          choices={["No", "Yes"]}
        />
      </Field>

      <div className={styles.miniForm}>
        <h4>VM configuration</h4>
        <Field label="Resource group" required>
          <NativeSelect value={wizard.vmResourceGroup} onChange={(v) => setWiz("vmResourceGroup", v)}>
            {state.resourceGroups.map((rg) => (
              <option key={rg.name} value={rg.name}>
                {rg.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Name prefix" required>
          <input
            value={wizard.vmNamePrefix}
            onChange={(e) => setWiz("vmNamePrefix", e.target.value)}
            placeholder="avd-vm-prod"
            className={styles.input}
          />
        </Field>
        <Field label="Virtual machine location" required>
          <NativeSelect value={wizard.vmLocation} onChange={(v) => setWiz("vmLocation", v)}>
            {state.regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Availability options">
          <NativeSelect value={wizard.availabilityOptions} onChange={(v) => setWiz("availabilityOptions", v)}>
            <option>No infrastructure redundancy required</option>
            <option>Availability zone</option>
            <option>Virtual machine scale set</option>
          </NativeSelect>
        </Field>
        <Field label="Security type">
          <NativeSelect value={wizard.securityType} onChange={(v) => setWiz("securityType", v)}>
            <option>Trusted launch virtual machines</option>
            <option>Standard</option>
            <option>Confidential virtual machines</option>
          </NativeSelect>
        </Field>
        <Field label="Image" required>
          <NativeSelect value={wizard.image} onChange={(v) => setWiz("image", v)}>
            {state.images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Virtual machine size" required>
          <NativeSelect value={wizard.vmSize} onChange={(v) => setWiz("vmSize", v)}>
            {state.vmSizes.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} — {s.vcpus} vcpu, {s.ram} GiB (${s.cost.toFixed(2)}/mo)
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Number of VMs" required>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={1}
              max={400}
              value={wizard.numberOfVms}
              onChange={(e) => setWiz("numberOfVms", parseInt(e.target.value, 10))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 32, fontWeight: 600 }}>{wizard.numberOfVms}</span>
          </div>
        </Field>
        <Field label="OS disk type">
          <NativeSelect value={wizard.osDiskType} onChange={(v) => setWiz("osDiskType", v)}>
            <option>Premium SSD</option>
            <option>Standard SSD</option>
            <option>Standard HDD</option>
          </NativeSelect>
        </Field>
        <Field label="Boot diagnostics">
          <NativeSelect value={wizard.bootDiagnostics} onChange={(v) => setWiz("bootDiagnostics", v)}>
            <option>Enable with managed storage account</option>
            <option>Enable with custom storage account</option>
            <option>Disable</option>
          </NativeSelect>
        </Field>

        <SectionHeader title="Network and security" />
        <Field label="Virtual network" required>
          <input
            value={wizard.virtualNetwork}
            onChange={(e) => setWiz("virtualNetwork", e.target.value)}
            placeholder="vnet-avd"
            className={styles.input}
          />
        </Field>
        <Field label="Subnet" required>
          <input
            value={wizard.subnet}
            onChange={(e) => setWiz("subnet", e.target.value)}
            placeholder="avd-sessionhosts"
            className={styles.input}
          />
        </Field>
        <Field label="Network security group">
          <RadioInline
            name="hp-nsg"
            value={wizard.nsg}
            onChange={(v) => setWiz("nsg", v as WizardState["nsg"])}
            choices={["None", "Basic", "Advanced"]}
          />
        </Field>
        <Field label="Public IP">
          <RadioInline
            name="hp-publicIp"
            value={wizard.publicIp}
            onChange={(v) => setWiz("publicIp", v as WizardState["publicIp"])}
            choices={["None", "Auto-generated"]}
          />
        </Field>

        <SectionHeader title="Domain to join" />
        <Field label="Identity">
          <RadioInline
            name="hp-domainJoin"
            value={wizard.domainJoin}
            onChange={(v) => setWiz("domainJoin", v as WizardState["domainJoin"])}
            choices={["Microsoft Entra ID", "Active Directory Domain Services"]}
          />
        </Field>
        {wizard.domainJoin === "Active Directory Domain Services" ? (
          <>
            <Field label="Domain to join" required>
              <input
                value={wizard.adDomain}
                onChange={(e) => setWiz("adDomain", e.target.value)}
                placeholder="contoso.local"
                className={styles.input}
              />
            </Field>
            <Field label="OU">
              <input
                value={wizard.adOu}
                onChange={(e) => setWiz("adOu", e.target.value)}
                placeholder="OU=AVD,DC=contoso,DC=local"
                className={styles.input}
              />
            </Field>
            <Field label="AD username" required>
              <input
                value={wizard.adUser}
                onChange={(e) => setWiz("adUser", e.target.value)}
                placeholder="domain-join@contoso.local"
                className={styles.input}
              />
            </Field>
            <Field label="AD password" required>
              <input
                type="password"
                value={wizard.adPassword}
                onChange={(e) => setWiz("adPassword", e.target.value)}
                className={styles.input}
              />
            </Field>
          </>
        ) : (
          <Callout tone="info">
            VMs will be joined to Microsoft Entra ID. Ensure the deploying account has the &quot;Cloud Device
            Administrator&quot; role.
          </Callout>
        )}
      </div>
    </>
  );
}

function TabWorkspace({
  state,
  wizard,
  setWiz,
}: {
  state: AvdState;
  wizard: WizardState;
  setWiz: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  return (
    <>
      <SectionHeader
        title="Register desktop app group"
        sub="A desktop application group will be auto-created. You can register it with an existing workspace now."
      />
      <Field label="Register desktop app group?">
        <RadioInline
          name="hp-registerWorkspace"
          value={wizard.registerWorkspace}
          onChange={(v) => setWiz("registerWorkspace", v as "No" | "Yes")}
          choices={["No", "Yes"]}
        />
      </Field>
      {wizard.registerWorkspace === "Yes" ? (
        <Field label="Workspace" required>
          <NativeSelect value={wizard.workspaceTarget} onChange={(v) => setWiz("workspaceTarget", v)}>
            <option value="">— select a workspace —</option>
            {state.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.friendlyName ? `(${w.friendlyName})` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <Callout tone="info">You can register an application group with a workspace later.</Callout>
      )}
    </>
  );
}

function TabTags({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <>
      <SectionHeader title="Tags" sub="Tags help you organise resources for billing and ownership." />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {wizard.tags.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "#605e5c" }}>
                No tags added.
              </td>
            </tr>
          ) : (
            wizard.tags.map((t, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={t.key}
                    onChange={(e) => {
                      const tags = [...wizard.tags];
                      tags[i] = { ...tags[i], key: e.target.value };
                      setWizard((w) => ({ ...w, tags }));
                    }}
                    placeholder="Name"
                    className={styles.input}
                  />
                </td>
                <td>
                  <input
                    value={t.value}
                    onChange={(e) => {
                      const tags = [...wizard.tags];
                      tags[i] = { ...tags[i], value: e.target.value };
                      setWizard((w) => ({ ...w, tags }));
                    }}
                    placeholder="Value"
                    className={styles.input}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => setWizard((w) => ({ ...w, tags: w.tags.filter((_, idx) => idx !== i) }))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button
        type="button"
        className={styles.link}
        style={{ marginTop: 8 }}
        onClick={() => setWizard((w) => ({ ...w, tags: [...w.tags, { key: "", value: "" }] }))}
      >
        + Add tag
      </button>
    </>
  );
}

function TabReview({ wizard, errors }: { wizard: WizardState; errors: string[] }) {
  const rows: [string, string | number][] = [
    ["Resource group", wizard.resourceGroup],
    ["Host pool name", wizard.hostPoolName || "— not set —"],
    ["Location", wizard.region],
    ["Host pool type", wizard.hostPoolType],
    ["Load balancing / assignment", wizard.hostPoolType === "Pooled" ? wizard.loadBalancing : wizard.assignmentType],
    ["Max session limit", wizard.hostPoolType === "Pooled" ? wizard.maxSessionLimit : 1],
    ["Validation environment", wizard.validationEnvironment ? "Yes" : "No"],
    ["Preferred app group type", wizard.preferredAppGroupType],
    ["Add VMs", wizard.addVms],
    ["Register workspace", wizard.registerWorkspace],
  ];
  return (
    <>
      {errors.length === 0 ? (
        <Callout tone="info">✓ Validation passed</Callout>
      ) : (
        <Callout tone="warn">
          <b>Validation failed:</b>
          <ul style={{ marginTop: 6, paddingLeft: 20 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Callout>
      )}
      <div className={styles.sectionCard}>
        <h3>Summary</h3>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
            <span style={{ color: "#605e5c", fontWeight: 600 }}>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DETAIL BLADE
// ─────────────────────────────────────────────────────────────────────────
function DetailBlade({
  state,
  pool,
  section,
  dispatch,
  onNavigate,
  onBack,
}: {
  state: AvdState;
  pool: AvdHostPool;
  section: string;
  dispatch: React.Dispatch<AvdAction>;
  onNavigate: (id: string, section: string) => void;
  onBack: () => void;
}) {
  function handleDelete() {
    if (!confirm(`Delete host pool "${pool.name}"? This will also remove its session hosts.`)) return;
    dispatch({ type: "DELETE_HOST_POOL", id: pool.id });
    toast("Host pool deleted");
    onBack();
  }

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon}>HP</div>
        <div style={{ flex: 1 }}>
          <h1>{pool.name}</h1>
          <p className={styles.bladeSub}>Host pool · {pool.type}</p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={styles.actBtn} onClick={() => onNavigate(pool.id, "overview")}>
            ↻ Refresh
          </button>
          <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={handleDelete}>
            🗑 Delete
          </button>
        </div>
      </div>

      <div className={styles.bladeFrame}>
        <aside className={styles.bladeNav}>
          {SECTIONS.map((grp) => (
            <div key={grp.group || "root"}>
              {grp.group ? <div className={styles.bladeHeading}>{grp.group}</div> : null}
              {grp.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(pool.id, item.id)}
                  className={`${styles.bladeItem} ${section === item.id ? styles.bladeItemActive : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main className={styles.bladeMain}>
          <BladeSection state={state} pool={pool} section={section} dispatch={dispatch} onNavigate={onNavigate} />
        </main>
      </div>
    </div>
  );
}

function BladeSection({
  state,
  pool,
  section,
  dispatch,
  onNavigate,
}: {
  state: AvdState;
  pool: AvdHostPool;
  section: string;
  dispatch: React.Dispatch<AvdAction>;
  onNavigate: (id: string, section: string) => void;
}) {
  switch (section) {
    case "overview":
      return <SecOverview state={state} pool={pool} onNavigate={onNavigate} />;
    case "activity":
      return <SecActivity state={state} pool={pool} />;
    case "iam":
      return <SecIam />;
    case "tags":
      return <SecTags pool={pool} dispatch={dispatch} />;
    case "properties":
      return <SecProperties pool={pool} dispatch={dispatch} />;
    case "session-hosts":
      return <SecSessionHosts state={state} pool={pool} dispatch={dispatch} />;
    case "assignments":
      return <SecAssignments state={state} pool={pool} />;
    case "app-groups":
      return <SecAppGroups state={state} pool={pool} />;
    case "scaling-plans":
      return <SecScalingPlans state={state} pool={pool} />;
    case "rdp-properties":
      return <SecRdpProperties pool={pool} dispatch={dispatch} />;
    case "licensing":
      return <SecLicensing />;
    case "diag-settings":
      return (
        <SecPlaceholder
          title="Diagnostic settings"
          desc="Send AVD diagnostic data to a Log Analytics workspace, Event Hub or storage account."
        />
      );
    case "props-info":
      return <SecPropsInfo state={state} pool={pool} />;
    case "locks":
      return <SecLocks />;
    case "export-template":
      return <SecExportTemplate state={state} pool={pool} />;
    case "run-script":
      return <SecRunScript state={state} pool={pool} />;
    case "gethelp":
      return (
        <SecPlaceholder
          title="Get-help diagnostics"
          desc="Generate a diagnostic report for this host pool to share with Microsoft support."
        />
      );
    case "insights":
      return <SecInsights pool={pool} />;
    case "metrics":
      return <SecMetrics />;
    case "logs":
      return (
        <SecPlaceholder
          title="Logs"
          desc="Query Log Analytics for session-host events, agent registration and user connections."
        />
      );
    case "cost":
      return <SecCost state={state} pool={pool} />;
    default:
      return <SecOverview state={state} pool={pool} onNavigate={onNavigate} />;
  }
}

function SecOverview({
  state,
  pool,
  onNavigate,
}: {
  state: AvdState;
  pool: AvdHostPool;
  onNavigate: (id: string, section: string) => void;
}) {
  const hosts = state.sessionHosts.filter((h) => h.hostPool === pool.name);
  const available = hosts.filter((h) => h.status === "Available").length;
  const ags = state.applicationGroups.filter((ag) => ag.hostPool === pool.name);
  const totalSessions = hosts.reduce((a, h) => a + (h.sessions || 0), 0);

  return (
    <div>
      <div className={styles.sectionCard}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <PropPair label="Resource group" value={pool.resourceGroup} />
          <PropPair label="Location" value={pool.region} />
          <PropPair label="Subscription" value={state.subscription.name} />
          <PropPair label="Subscription ID" value={state.subscription.id} />
          <PropPair label="Host pool type" value={pool.type} />
          <PropPair
            label={pool.type === "Pooled" ? "Load balancer" : "Assignment type"}
            value={pool.type === "Pooled" ? pool.loadBalancing : pool.assignmentType}
          />
          <PropPair label="Max session limit" value={pool.maxSessionLimit} />
          <PropPair label="Validation environment" value={pool.validationEnvironment ? "Yes" : "No"} />
          <PropPair label="Preferred app group type" value={pool.preferredAppGroupType} />
          <PropPair label="AVD agent version" value={pool.agentVersion} />
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3>Session hosts</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <MiniStat label="Registered" value={hosts.length} />
          <MiniStat label="Available" value={available} />
          <MiniStat label="Active sessions" value={totalSessions} />
          <MiniStat label="Application groups" value={ags.length} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" className={styles.link} onClick={() => onNavigate(pool.id, "session-hosts")}>
            Open session hosts &gt;
          </button>{" "}
          &nbsp;
          <button type="button" className={styles.link} onClick={() => onNavigate(pool.id, "insights")}>
            View Insights &gt;
          </button>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3>Description</h3>
        <p>{pool.description || "No description."}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: "10px 14px", background: "#faf9f8" }}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function SecActivity({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const logs = state.activityLog.filter((l) => l.resource === pool.name).slice(0, 30);
  return (
    <div className={styles.sectionCard}>
      <h3>Activity log</h3>
      <DataTable columns={["Time", "Operation", "Caller", "Status"]}>
        {logs.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ textAlign: "center", color: "#605e5c" }}>
              No activity yet for this host pool.
            </td>
          </tr>
        ) : (
          logs.map((l, i) => (
            <tr key={i}>
              <td>{new Date(l.time).toLocaleString()}</td>
              <td>{l.operation}</td>
              <td>admin@cloudlab.onmicrosoft.com</td>
              <td>
                <StatusBadge status={l.status} />
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </div>
  );
}

function SecIam() {
  return (
    <div className={styles.sectionCard}>
      <h3>Access control (IAM)</h3>
      <div className={styles.subTabs}>
        <div className={`${styles.subTab} ${styles.subTabActive}`}>Check access</div>
        <div className={styles.subTab}>Role assignments</div>
        <div className={styles.subTab}>Roles</div>
      </div>
      <div className={styles.sectionCard} style={{ background: "#faf9f8", marginTop: 16 }}>
        <b>Built-in roles available for AVD host pools:</b>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Desktop Virtualization Host Pool Contributor — Manage host pool resources.</li>
          <li>Desktop Virtualization Host Pool Reader — Read host pool details.</li>
          <li>Desktop Virtualization Session Host Operator — Manage session hosts.</li>
          <li>Desktop Virtualization User — End-user access to a desktop or RemoteApp.</li>
        </ul>
      </div>
    </div>
  );
}

function SecTags({ pool, dispatch }: { pool: AvdHostPool; dispatch: React.Dispatch<AvdAction> }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const tags = pool.tags || {};
  const keys = Object.keys(tags);

  function addTag() {
    if (!key) return;
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { tags: { ...tags, [key]: value } } });
    setKey("");
    setValue("");
  }

  function delTag(k: string) {
    const next = { ...tags };
    delete next[k];
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { tags: next } });
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Tags</h3>
      <DataTable columns={["Name", "Value", ""]}>
        {keys.length === 0 ? (
          <tr>
            <td colSpan={3} style={{ textAlign: "center", color: "#605e5c" }}>
              No tags. Add a tag below.
            </td>
          </tr>
        ) : (
          keys.map((k) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{tags[k]}</td>
              <td>
                <button type="button" className={styles.link} onClick={() => delTag(k)}>
                  Remove
                </button>
              </td>
            </tr>
          ))
        )}
      </DataTable>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Name" className={styles.input} />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={styles.input} />
        <button type="button" className={styles.btn} onClick={addTag}>
          Add tag
        </button>
      </div>
    </div>
  );
}

function SecProperties({ pool, dispatch }: { pool: AvdHostPool; dispatch: React.Dispatch<AvdAction> }) {
  const isPooled = pool.type === "Pooled";
  const [rdp, setRdp] = useState(pool.customRdpProperty || "");
  const [agentVersion, setAgentVersion] = useState(pool.agentVersion);

  function update<K extends keyof AvdHostPool>(key: K, value: AvdHostPool[K]) {
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { [key]: value } as Partial<AvdHostPool> });
  }

  function save() {
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { customRdpProperty: rdp, agentVersion } });
    toast.success("Host pool saved");
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Properties</h3>
      <Field label="Host pool type">
        <NativeSelect value={pool.type} onChange={() => {}}>
          <option>{pool.type}</option>
        </NativeSelect>
      </Field>
      <p className={styles.help} style={{ marginBottom: 12 }}>
        Host pool type cannot be changed after creation.
      </p>

      {isPooled ? (
        <>
          <Field label="Load-balancing algorithm">
            <NativeSelect value={pool.loadBalancing} onChange={(v) => update("loadBalancing", v as AvdHostPool["loadBalancing"])}>
              <option>Breadth-first</option>
              <option>Depth-first</option>
            </NativeSelect>
          </Field>
          <Field label="Max session limit">
            <input
              type="number"
              min={1}
              max={999999}
              value={pool.maxSessionLimit}
              onChange={(e) => update("maxSessionLimit", parseInt(e.target.value, 10) || 1)}
              className={styles.input}
              style={{ width: 120 }}
            />
          </Field>
        </>
      ) : (
        <Field label="Assignment type">
          <NativeSelect value={pool.assignmentType} onChange={(v) => update("assignmentType", v as AvdHostPool["assignmentType"])}>
            <option>Automatic</option>
            <option>Direct</option>
          </NativeSelect>
        </Field>
      )}

      <Checkbox
        label="Start VM on connect"
        checked={pool.startVmOnConnect}
        onChange={(v) => update("startVmOnConnect", v)}
        help="Power on hosts only when a user connects; reduces idle cost."
      />
      <Checkbox
        label="Validation environment"
        checked={pool.validationEnvironment}
        onChange={(v) => update("validationEnvironment", v)}
        help="Receive AVD agent updates earlier for testing."
      />

      <Field label="AVD agent version">
        <input
          value={agentVersion}
          onChange={(e) => setAgentVersion(e.target.value)}
          className={styles.input}
          style={{ width: 240 }}
        />
      </Field>

      <Field label="Custom RDP properties" help="Examples: audiocapturemode:i:1; videoplaybackmode:i:1; redirectprinters:i:1">
        <textarea
          rows={8}
          value={rdp}
          onChange={(e) => setRdp(e.target.value)}
          className={styles.textarea}
          style={{ width: "100%", fontSize: 12 }}
        />
      </Field>

      <button type="button" className={styles.btn} onClick={save}>
        Save
      </button>
    </div>
  );
}

function SecSessionHosts({
  state,
  pool,
  dispatch,
}: {
  state: AvdState;
  pool: AvdHostPool;
  dispatch: React.Dispatch<AvdAction>;
}) {
  const hosts = state.sessionHosts.filter((h) => h.hostPool === pool.name);
  const [showAdd, setShowAdd] = useState(false);
  const [namePrefix, setNamePrefix] = useState("avd-vm-prod");
  const [count, setCount] = useState(1);

  function toggleAllow(id: string, checked: boolean) {
    dispatch({ type: "UPDATE_SESSION_HOST", id, patch: { allowNewSessions: checked } });
    toast.success("Session host updated");
  }

  function drainAll() {
    hosts.forEach((h) => {
      dispatch({ type: "DRAIN_SESSION_HOST", id: h.id, drain: true });
    });
    toast(`All session hosts in ${pool.name} are now draining`);
  }

  function addHosts() {
    const existing = hosts.length;
    for (let i = 1; i <= count; i++) {
      const host: AvdSessionHost = {
        id: "sh-" + crypto.randomUUID(),
        name: `${namePrefix}-${String(existing + i).padStart(2, "0")}.cloudlab.in`,
        hostPool: pool.name,
        status: "Available",
        sessions: 0,
        disconnectedSessions: 0,
        allowNewSessions: true,
        agentVersion: pool.agentVersion,
        os: "Windows 11 multi-session",
        lastHeartbeat: new Date().toISOString(),
        drainMode: false,
        vmSize: state.vmSizes[0]?.name ?? "",
      };
      dispatch({ type: "ADD_SESSION_HOST", host });
    }
    toast.success(`${count} session host(s) added to ${pool.name}`);
    setShowAdd(false);
    setCount(1);
  }

  function removeHost(id: string) {
    if (!confirm("Remove this session host from the pool?")) return;
    dispatch({ type: "REMOVE_SESSION_HOST", id });
    toast("Session host removed");
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Session hosts</h3>
      <DataTable columns={["Host", "Status", "Sessions", "Allow new", "Agent", "OS", "Last heartbeat", ""]}>
        {hosts.length === 0 ? (
          <tr>
            <td colSpan={8} style={{ textAlign: "center", color: "#605e5c" }}>
              No session hosts registered to this pool.
            </td>
          </tr>
        ) : (
          hosts.map((h) => (
            <tr key={h.id}>
              <td>{h.name}</td>
              <td>
                <StatusBadge status={h.status} />
              </td>
              <td>
                {h.sessions || 0} active / {h.disconnectedSessions || 0} disc
              </td>
              <td>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={h.allowNewSessions}
                    onChange={(e) => toggleAllow(h.id, e.target.checked)}
                  />
                  Allow
                </label>
              </td>
              <td>{h.agentVersion}</td>
              <td>{h.os}</td>
              <td>{new Date(h.lastHeartbeat).toLocaleString()}</td>
              <td>
                <button type="button" className={styles.link} onClick={() => removeHost(h.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))
        )}
      </DataTable>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button type="button" className={styles.btn} onClick={() => setShowAdd((v) => !v)}>
          + Add session host
        </button>
        <button type="button" className={styles.btnOutline} onClick={drainAll}>
          Drain all
        </button>
      </div>

      {showAdd ? (
        <div className={styles.miniForm}>
          <h4>Add session hosts</h4>
          <Field label="Name prefix">
            <input value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} className={styles.input} />
          </Field>
          <Field label="Number of hosts">
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              className={styles.input}
              style={{ width: 100 }}
            />
          </Field>
          <button type="button" className={styles.btn} onClick={addHosts}>
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SecAssignments({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const ags = state.applicationGroups.filter((ag) => ag.hostPool === pool.name);
  return (
    <div className={styles.sectionCard}>
      <h3>Assignments</h3>
      <p>Users and groups assigned to application groups tied to this host pool.</p>
      <DataTable columns={["Application group", "Count", "Members"]}>
        {ags.length === 0 ? (
          <tr>
            <td colSpan={3} style={{ textAlign: "center", color: "#605e5c" }}>
              No application groups tied to this pool.
            </td>
          </tr>
        ) : (
          ags.map((ag) => (
            <tr key={ag.id}>
              <td>
                {ag.name} <span className={styles.badge}>{ag.type}</span>
              </td>
              <td>{(ag.assignments || []).length} assigned</td>
              <td>
                {(ag.assignments || []).map((u) => (
                  <span key={u} className={styles.badge} style={{ marginRight: 4 }}>
                    {u}
                  </span>
                ))}
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </div>
  );
}

function SecAppGroups({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const ags = state.applicationGroups.filter((ag) => ag.hostPool === pool.name);
  return (
    <div className={styles.sectionCard}>
      <h3>Application groups</h3>
      <DataTable columns={["Name", "Type", "Apps", "Workspace"]}>
        {ags.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ textAlign: "center", color: "#605e5c" }}>
              No application groups tied to this pool.
            </td>
          </tr>
        ) : (
          ags.map((ag) => (
            <tr key={ag.id}>
              <td>{ag.name}</td>
              <td>{ag.type}</td>
              <td>{(ag.applications || []).length}</td>
              <td>{ag.workspace || "—"}</td>
            </tr>
          ))
        )}
      </DataTable>
    </div>
  );
}

function SecScalingPlans({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const plans = state.scalingPlans.filter((p) => (p.hostPoolAssignments || []).includes(pool.name));
  return (
    <div className={styles.sectionCard}>
      <h3>Scaling plans</h3>
      <DataTable columns={["Name", "Time zone", "Schedules", "State"]}>
        {plans.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ textAlign: "center", color: "#605e5c" }}>
              No scaling plans applied.
            </td>
          </tr>
        ) : (
          plans.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.timeZone}</td>
              <td>{(p.schedules || []).length}</td>
              <td>
                <StatusBadge status={p.enabled ? "Active" : "Inactive"} />
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </div>
  );
}

function SecRdpProperties({ pool, dispatch }: { pool: AvdHostPool; dispatch: React.Dispatch<AvdAction> }) {
  const rdp = pool.customRdpProperty || "";

  function onToggle(key: string, enabled: boolean) {
    const next = toggleRdpKey(rdp, key, enabled);
    dispatch({ type: "UPDATE_HOST_POOL", id: pool.id, patch: { customRdpProperty: next } });
  }

  return (
    <div className={styles.sectionCard}>
      <h3>RDP properties</h3>
      <p>Toggle commonly-used redirection and display flags. Changes update the host pool&apos;s custom RDP property string.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {RDP_CATEGORIES.map((cat) => (
          <div key={cat.title} className={styles.miniForm}>
            <h4>{cat.title}</h4>
            {cat.items.map((it) => {
              const enabled = rdp.indexOf(it.key) !== -1;
              return (
                <label key={it.key} className={styles.checkboxRow} style={{ display: "block", marginBottom: 6 }}>
                  <input type="checkbox" checked={enabled} onChange={(e) => onToggle(it.key, e.target.checked)} /> {it.label}
                </label>
              );
            })}
          </div>
        ))}
      </div>
      <h4 style={{ marginTop: 18 }}>Current custom RDP property</h4>
      <textarea readOnly rows={8} value={rdp} className={styles.textarea} style={{ width: "100%", fontSize: 12, background: "#faf9f8" }} />
    </div>
  );
}

function SecLicensing() {
  return (
    <div className={styles.sectionCard}>
      <h3>Licensing</h3>
      <p>Choose the licensing model for users connecting to this host pool.</p>
      <DataTable columns={["Model", "Includes", "Cost"]}>
        <tr>
          <td>Microsoft 365 / Windows enterprise license</td>
          <td>Most M365 E3/E5, Windows 10/11 E3/E5</td>
          <td>Included</td>
        </tr>
        <tr>
          <td>Per-user access pricing</td>
          <td>External users without an eligible Microsoft license</td>
          <td>$5.50/user/mo</td>
        </tr>
        <tr>
          <td>RDS CAL (Server SKUs only)</td>
          <td>For Windows Server-based session hosts</td>
          <td>Per device/user</td>
        </tr>
      </DataTable>
    </div>
  );
}

function SecPropsInfo({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <PropPair label="Name" value={pool.name} />
        <PropPair
          label="Resource ID"
          value={`/subscriptions/${state.subscription.id}/resourceGroups/${pool.resourceGroup}/providers/Microsoft.DesktopVirtualization/hostPools/${pool.name}`}
        />
        <PropPair label="Resource group" value={pool.resourceGroup} />
        <PropPair label="Location" value={pool.region} />
        <PropPair label="Subscription" value={state.subscription.name} />
        <PropPair label="Subscription ID" value={state.subscription.id} />
        <PropPair label="Provisioning state" value="Succeeded" />
        <PropPair label="Created on" value={pool.createdAt ? new Date(pool.createdAt).toLocaleString() : "—"} />
      </div>
    </div>
  );
}

function SecLocks() {
  return (
    <div className={styles.sectionCard}>
      <h3>Locks</h3>
      <p>Locks prevent accidental deletion or modification.</p>
      <button type="button" className={styles.btn}>
        + Add
      </button>
      <table className={styles.table} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Lock name</th>
            <th>Type</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3} style={{ textAlign: "center", color: "#605e5c" }}>
              No locks defined.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SecExportTemplate({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const template = {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    resources: [
      {
        type: "Microsoft.DesktopVirtualization/hostPools",
        apiVersion: "2023-09-05",
        name: pool.name,
        location: pool.region,
        properties: {
          hostPoolType: pool.type,
          loadBalancerType: pool.loadBalancing || undefined,
          personalDesktopAssignmentType: pool.assignmentType || undefined,
          maxSessionLimit: pool.maxSessionLimit,
          validationEnvironment: pool.validationEnvironment,
          startVMOnConnect: pool.startVmOnConnect,
          preferredAppGroupType: pool.preferredAppGroupType,
          customRdpProperty: pool.customRdpProperty,
        },
        tags: pool.tags,
      },
    ],
  };
  return (
    <div className={styles.sectionCard}>
      <h3>Export template</h3>
      <p>ARM template representing this host pool&apos;s current configuration in {state.resourceGroups.find((r) => r.name === pool.resourceGroup)?.name ?? pool.resourceGroup}.</p>
      <pre className={styles.textarea} style={{ display: "block", padding: 12, maxHeight: 400, overflow: "auto", fontSize: 12 }}>
        {JSON.stringify(template, null, 2)}
      </pre>
    </div>
  );
}

function SecRunScript({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const hostCount = state.sessionHosts.filter((h) => h.hostPool === pool.name).length;
  return (
    <div className={styles.sectionCard}>
      <h3>Run a script</h3>
      <p>Execute a PowerShell or Bash script on all session hosts in this pool, using Azure Run Command.</p>
      <Field label="Script language">
        <NativeSelect value="PowerShell" onChange={() => {}}>
          <option>PowerShell</option>
          <option>Bash</option>
        </NativeSelect>
      </Field>
      <Field label="Script">
        <textarea
          rows={8}
          readOnly
          defaultValue={'Get-Service -Name "RDAgentBootLoader" | Format-List Status, StartType'}
          className={styles.textarea}
          style={{ width: "100%", fontSize: 12 }}
        />
      </Field>
      <label className={styles.checkboxRow} style={{ marginBottom: 12 }}>
        <input type="checkbox" /> Run on hosts that are in drain mode
      </label>
      <div>
        <button type="button" className={styles.btn} onClick={() => toast(`Script queued to ${hostCount} session hosts`)}>
          Run
        </button>
      </div>
    </div>
  );
}

function SecInsights({ pool }: { pool: AvdHostPool }) {
  const bars = useMemo(() => Array.from({ length: 24 }, () => 20 + Math.random() * 70), []);
  return (
    <div className={styles.sectionCard}>
      <h3>Insights — {pool.name}</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, marginBottom: 16 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: "#0078d4", borderRadius: "2px 2px 0 0" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MiniStatText label="Connect time (p50)" value="9.4s" />
        <MiniStatText label="Latency (p95)" value="52ms" />
        <MiniStatText label="Failed connections" value="3" />
        <MiniStatText label="Top app launched" value="Outlook" />
      </div>
    </div>
  );
}

function MiniStatText({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #edebe9", borderRadius: 2, padding: "10px 14px", background: "#faf9f8" }}>
      <div style={{ fontSize: 12, color: "#605e5c" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function SecMetrics() {
  const bars = useMemo(() => Array.from({ length: 24 }, () => 15 + Math.random() * 65), []);
  return (
    <div className={styles.sectionCard}>
      <h3>Metrics</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <NativeSelect value="Active sessions" onChange={() => {}}>
          <option>Active sessions</option>
          <option>Available hosts</option>
          <option>Connection success rate</option>
          <option>Round-trip latency</option>
        </NativeSelect>
        <NativeSelect value="Avg" onChange={() => {}}>
          <option>Avg</option>
          <option>Max</option>
          <option>Min</option>
        </NativeSelect>
        <NativeSelect value="Last 24 hours" onChange={() => {}}>
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
        </NativeSelect>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: "#0078d4", borderRadius: "2px 2px 0 0" }} />
        ))}
      </div>
    </div>
  );
}

function SecCost({ state, pool }: { state: AvdState; pool: AvdHostPool }) {
  const hosts = state.sessionHosts.filter((h) => h.hostPool === pool.name);
  const rows = hosts.map((h) => {
    const size = state.vmSizes.find((s) => s.name === h.vmSize);
    return { host: h.name, size: h.vmSize, cost: size?.cost ?? 0 };
  });
  const total = rows.reduce((a, r) => a + r.cost, 0);
  return (
    <div className={styles.sectionCard}>
      <h3>Cost analysis</h3>
      <p>Estimated monthly compute cost for session hosts in this pool, based on VM size list pricing.</p>
      <DataTable columns={["Session host", "VM size", "Est. monthly cost"]}>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={3} style={{ textAlign: "center", color: "#605e5c" }}>
              No session hosts to estimate cost for.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.host}>
              <td>{r.host}</td>
              <td>{r.size || "—"}</td>
              <td>${r.cost.toFixed(2)}</td>
            </tr>
          ))
        )}
      </DataTable>
      <div style={{ marginTop: 12, fontWeight: 600 }}>Total estimated monthly cost: ${total.toFixed(2)}</div>
    </div>
  );
}

function SecPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.sectionCard}>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}
