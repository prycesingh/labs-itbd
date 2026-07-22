"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsPrintDriver, WsPrinter, WsPrintForm, WsPrintPort } from "@/lib/labs/simulators/winserver/types";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, TabbedPanel, type WsTreeNode } from "./ws-mmc";
import { CheckboxRow, EmptyPane, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import styles from "./winserver-console.module.css";

type Dialog =
  | { kind: "queue"; name: string }
  | { kind: "sharing"; name: string }
  | { kind: "deploy-gpo"; name: string }
  | { kind: "printer-properties"; name: string }
  | { kind: "add-driver" }
  | { kind: "add-form" }
  | { kind: "add-port" }
  | { kind: "add-printer-wizard" };

function printerPill(status: WsPrinter["status"]): string {
  if (status === "Ready" || status === "Printing") return styles.pillGreen;
  if (status === "Offline") return styles.pillRed;
  return styles.pillAmber;
}

function printersByFilter(printers: WsPrinter[], filter: "all" | "not-ready" | "with-jobs"): WsPrinter[] {
  if (filter === "not-ready") return printers.filter((p) => p.status !== "Ready");
  if (filter === "with-jobs") return printers.filter((p) => p.jobsCount > 0);
  return printers;
}

const COLOR_DRIVER_HINTS = ["color", "bizhub c", "phaser", "versalink", "imageclass"];

function inferColor(driverName: string): boolean {
  const lower = driverName.toLowerCase();
  return COLOR_DRIVER_HINTS.some((hint) => lower.includes(hint));
}

export function PrintserverConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("printers");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ filters: true, servers: true, server: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const ps = state.printserver;
  const serverName = state.server.name;

  const tree: WsTreeNode = {
    id: "root",
    icon: "",
    label: "",
    children: [
      {
        id: "filters",
        icon: "CF",
        label: "Custom Filters",
        children: [
          { id: "f-all", icon: "AP", label: `All Printers (${ps.printers.length})` },
          { id: "f-not-ready", icon: "NR", label: "Printers Not Ready" },
          { id: "f-with-jobs", icon: "WJ", label: "Printers With Jobs" },
        ],
      },
      {
        id: "servers",
        icon: "PS",
        label: "Print Servers",
        children: [
          {
            id: "server",
            icon: "S",
            label: `${serverName} (local)`,
            children: [
              { id: "drivers", icon: "DR", label: "Drivers" },
              { id: "forms", icon: "FM", label: "Forms" },
              { id: "ports", icon: "PT", label: "Ports" },
              { id: "printers", icon: "PR", label: "Printers" },
            ],
          },
        ],
      },
    ],
  };

  function headingFor(node: string): string {
    if (node === "f-all") return `All Printers (${ps.printers.length})`;
    if (node === "f-not-ready") return "Printers Not Ready";
    if (node === "f-with-jobs") return "Printers With Jobs";
    if (node === "server") return `${serverName} (local)`;
    if (node === "drivers") return `Drivers (${ps.drivers.length})`;
    if (node === "forms") return `Forms (${ps.forms.length})`;
    if (node === "ports") return `Ports (${ps.ports.length})`;
    if (node === "printers") return `Printers (${ps.printers.length})`;
    return "";
  }

  function togglePause(p: WsPrinter) {
    const next = p.status === "Paused" ? "Ready" : "Paused";
    dispatch({ type: "UPDATE_PRINTER", name: p.name, patch: { status: next } });
    toast.success(`${p.name}: ${next}`);
  }

  function cancelAllDocuments(p: WsPrinter) {
    if (!confirm(`Cancel all documents queued on "${p.name}"?`)) return;
    dispatch({ type: "UPDATE_PRINTER", name: p.name, patch: { jobs: [], jobsCount: 0 } });
    toast.success(`All documents cancelled on ${p.name}`);
  }

  function toggleOffline(p: WsPrinter) {
    const next = p.status === "Offline" ? "Ready" : "Offline";
    dispatch({ type: "UPDATE_PRINTER", name: p.name, patch: { status: next } });
    toast.success(next === "Offline" ? `${p.name} set to work offline` : `${p.name} back online`);
  }

  function deletePrinter(p: WsPrinter) {
    if (!confirm(`Delete printer "${p.name}"?`)) return;
    dispatch({ type: "DELETE_PRINTER", name: p.name });
    toast.success(`Deleted ${p.name}`);
  }

  function showPrinterContextMenu(e: React.MouseEvent, p: WsPrinter) {
    const items: WsContextMenuItem[] = [
      { key: "queue", label: "Open Print Queue...", onClick: () => setDialog({ kind: "queue", name: p.name }) },
      { key: "pause", label: p.status === "Paused" ? "Resume Printing" : "Pause Printing", onClick: () => togglePause(p) },
      { key: "cancel-all", label: "Cancel All Documents", onClick: () => cancelAllDocuments(p) },
      "-",
      { key: "sharing", label: "Sharing...", onClick: () => setDialog({ kind: "sharing", name: p.name }) },
      { key: "set-default", label: "Set as Default Printer", onClick: () => toast.success(`${p.name} set as default printer.`) },
      { key: "offline", label: p.status === "Offline" ? "Use Printer Online" : "Use Printer Offline", onClick: () => toggleOffline(p) },
      "-",
      { key: "deploy-gpo", label: "Deploy with Group Policy...", onClick: () => setDialog({ kind: "deploy-gpo", name: p.name }) },
      { key: "delete", label: "Delete", onClick: () => deletePrinter(p) },
      { key: "properties", label: "Properties", onClick: () => setDialog({ kind: "printer-properties", name: p.name }) },
    ];
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const items: WsContextMenuItem[] = [];
    if (nodeId === "printers" || nodeId === "f-all") {
      items.push({ key: "add-printer", label: "Add Printer...", onClick: () => setDialog({ kind: "add-printer-wizard" }) });
    } else if (nodeId === "drivers") {
      items.push({ key: "add-driver", label: "Add Driver...", onClick: () => setDialog({ kind: "add-driver" }) });
    } else if (nodeId === "forms") {
      items.push({ key: "add-form", label: "Create New Form...", onClick: () => setDialog({ kind: "add-form" }) });
    } else if (nodeId === "ports") {
      items.push({ key: "add-port", label: "Add Port...", onClick: () => setDialog({ kind: "add-port" }) });
    }
    if (items.length) WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function renderPrinterTable(filter: "all" | "not-ready" | "with-jobs") {
    const list = printersByFilter(ps.printers, filter);
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "add-printer-wizard" })}>
            Add Printer...
          </button>
        </div>
        {list.length === 0 ? (
          <EmptyPane>No printers match this filter.</EmptyPane>
        ) : (
          <ItemListTable columns={["Name", "Status", "Jobs", "Driver", "Location"]}>
            {list.map((p) => (
              <tr
                key={p.name}
                className={selectedRow === p.name ? styles.itemListRowSelected : ""}
                onClick={() => setSelectedRow(p.name)}
                onDoubleClick={() => setDialog({ kind: "printer-properties", name: p.name })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedRow(p.name);
                  showPrinterContextMenu(e, p);
                }}
              >
                <td>{p.name}</td>
                <td>
                  <span className={`${styles.pill} ${printerPill(p.status)}`}>{p.status}</span>
                </td>
                <td>{p.jobsCount}</td>
                <td>{p.driver}</td>
                <td>{p.location}</td>
              </tr>
            ))}
          </ItemListTable>
        )}
      </ContentBody>
    );
  }

  function renderDrivers() {
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "add-driver" })}>
            Add Driver...
          </button>
        </div>
        <ItemListTable columns={["Provider", "Driver Name", "Environment"]}>
          {ps.drivers.map((d) => (
            <tr key={d.name}>
              <td>{d.provider}</td>
              <td>{d.name}</td>
              <td>{d.environment}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderForms() {
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "add-form" })}>
            Create New Form...
          </button>
        </div>
        <ItemListTable columns={["Form Name", "Width", "Height", "Type"]}>
          {ps.forms.map((f) => (
            <tr key={f.name}>
              <td>{f.name}</td>
              <td>{f.widthMm} mm</td>
              <td>{f.heightMm} mm</td>
              <td>
                <span className={`${styles.pill} ${f.builtIn ? "" : styles.pillGreen}`}>{f.builtIn ? "Built-in" : "Custom"}</span>
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  function renderPorts() {
    return (
      <ContentBody>
        <div style={{ marginBottom: 8 }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: "add-port" })}>
            Add Port...
          </button>
        </div>
        <ItemListTable columns={["Port", "Description", "Type"]}>
          {ps.ports.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.description}</td>
              <td>{p.type}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    );
  }

  let content: React.ReactNode;
  if (selectedNode === "f-all") content = renderPrinterTable("all");
  else if (selectedNode === "f-not-ready") content = renderPrinterTable("not-ready");
  else if (selectedNode === "f-with-jobs") content = renderPrinterTable("with-jobs");
  else if (selectedNode === "printers") content = renderPrinterTable("all");
  else if (selectedNode === "drivers") content = renderDrivers();
  else if (selectedNode === "forms") content = renderForms();
  else if (selectedNode === "ports") content = renderPorts();
  else if (selectedNode === "server" || selectedNode === "servers" || selectedNode === "filters" || selectedNode === "root")
    content = (
      <ContentBody>
        <EmptyPane>Select Drivers, Forms, Ports, or Printers from the tree to manage this print server.</EmptyPane>
      </ContentBody>
    );
  else content = <EmptyPane>Select an object in the tree.</EmptyPane>;

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={tree}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((ex) => ({ ...ex, [id]: !ex[id] }))}
          onContextMenu={showTreeContextMenu}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          {content}
        </>
      }
      dialogs={<PrintserverDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} />}
    />
  );
}

function PrintserverDialogs({
  dialog,
  state,
  dispatch,
  onClose,
}: {
  dialog: Dialog | null;
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  onClose: () => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === "queue") return <PrintQueueDialog name={dialog.name} state={state} onClose={onClose} />;
  if (dialog.kind === "sharing") return <SharingDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "deploy-gpo") return <DeployGpoDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "printer-properties") return <PrinterPropertiesDialog name={dialog.name} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-driver") return <AddDriverDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-form") return <AddFormDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-port") return <AddPortDialog dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "add-printer-wizard") return <AddPrinterWizard state={state} dispatch={dispatch} onClose={onClose} />;
  return null;
}

function PrintQueueDialog({ name, state, onClose }: { name: string; state: WinServerState; onClose: () => void }) {
  const printer = state.printserver.printers.find((p) => p.name === name);
  if (!printer) return null;

  return (
    <WsDialogComponent title={`${name} - Print Queue`} width="680px" onClose={onClose} buttons={[{ label: "Close", primary: true }]}>
      <p style={{ marginBottom: 8 }}>{printer.jobs.length} document(s) in queue.</p>
      <ItemListTable columns={["Document", "Pages", "Size", "Status", "Owner", "Submitted"]}>
        {printer.jobs.length ? (
          printer.jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.document}</td>
              <td>{j.pages}</td>
              <td>{j.sizeKB} KB</td>
              <td>{j.status}</td>
              <td>{j.owner}</td>
              <td>{new Date(j.submitted).toLocaleString()}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} style={{ textAlign: "center", color: "#888", padding: 12 }}>
              No documents in this queue.
            </td>
          </tr>
        )}
      </ItemListTable>
    </WsDialogComponent>
  );
}

function SharingDialog({ name, state, dispatch, onClose }: { name: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const printer = state.printserver.printers.find((p) => p.name === name);
  const [shareName, setShareName] = useState(printer?.shareName ?? "");
  if (!printer) return null;

  return (
    <WsDialogComponent
      title={`${name} Sharing`}
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "UPDATE_PRINTER", name, patch: { shareName } });
            toast.success(`Sharing updated for ${name}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Share name">
        <input type="text" value={shareName} onChange={(e) => setShareName(e.target.value)} />
      </FormRow>
      <CheckboxRow id="shList" label="List in the directory" checked onChange={() => {}} />
      <CheckboxRow id="shRender" label="Render print jobs on client computers" checked onChange={() => {}} />
    </WsDialogComponent>
  );
}

function DeployGpoDialog({ name, state, dispatch, onClose }: { name: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const printer = state.printserver.printers.find((p) => p.name === name);
  const [gpoName, setGpoName] = useState(printer?.deployedGpo ?? "");
  if (!printer) return null;

  return (
    <WsDialogComponent
      title="Deploy with Group Policy"
      onClose={onClose}
      buttons={[
        {
          label: "Add",
          primary: true,
          onClick: () => {
            if (!gpoName.trim()) {
              alert("GPO name is required.");
              return false;
            }
            dispatch({ type: "UPDATE_PRINTER", name, patch: { deployedGpo: gpoName.trim() } });
            toast.success(`${name} deployed via ${gpoName.trim()}`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Deploy <b>{name}</b> using Group Policy:
      </p>
      <FormRow label="GPO name">
        <input type="text" value={gpoName} onChange={(e) => setGpoName(e.target.value)} />
      </FormRow>
      <CheckboxRow id="gpoComputer" label="The printers using Group Policy Objects (per machine)" checked onChange={() => {}} />
      <HelpText>Deploys this printer connection to computers in scope of the selected GPO.</HelpText>
    </WsDialogComponent>
  );
}

function PrinterPropertiesDialog({ name, state, dispatch, onClose }: { name: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const printer = state.printserver.printers.find((p) => p.name === name);
  const [activeTab, setActiveTab] = useState("General");
  const [patch, setPatch] = useState<Partial<WsPrinter>>({});
  const [priority, setPriority] = useState(1);
  const [spool, setSpool] = useState(true);
  if (!printer) return null;
  const merged = { ...printer, ...patch };

  function set<K extends keyof WsPrinter>(key: K, value: WsPrinter[K]) {
    setPatch((p) => ({ ...p, [key]: value }));
  }

  function commit() {
    dispatch({ type: "UPDATE_PRINTER", name, patch });
  }

  const tabs = ["General", "Sharing", "Ports", "Advanced", "Security"];

  return (
    <WsDialogComponent
      title={`${name} Properties`}
      width="620px"
      onClose={onClose}
      buttons={[
        { label: "OK", primary: true, onClick: () => { commit(); toast.success(`Saved ${name}`); return true; } },
        { label: "Cancel" },
        { label: "Apply", onClick: () => { commit(); toast.success("Applied changes"); return false; } },
      ]}
    >
      <TabbedPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        renderTab={(tab) => {
          if (tab === "General")
            return (
              <>
                <FormRow label="Name">
                  <input type="text" value={merged.name} onChange={(e) => set("name", e.target.value)} />
                </FormRow>
                <FormRow label="Location">
                  <input type="text" value={merged.location} onChange={(e) => set("location", e.target.value)} />
                </FormRow>
                <FormRow label="Comment">
                  <input type="text" value={merged.comments} onChange={(e) => set("comments", e.target.value)} />
                </FormRow>
                <FormRow label="Model">
                  <input type="text" value={merged.driver} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Color">
                  <span>{merged.color ? "Yes" : "No"}</span>
                </FormRow>
              </>
            );
          if (tab === "Sharing")
            return (
              <>
                <CheckboxRow id="ppShared" label="Share this printer" checked={!!merged.shareName} onChange={(v) => set("shareName", v ? merged.shareName || merged.name : "")} />
                <FormRow label="Share name">
                  <input type="text" value={merged.shareName} onChange={(e) => set("shareName", e.target.value)} />
                </FormRow>
                <CheckboxRow id="ppListDir" label="List in the directory" checked onChange={() => {}} />
                <CheckboxRow id="ppRender" label="Render print jobs on client computers" checked onChange={() => {}} />
              </>
            );
          if (tab === "Ports")
            return (
              <ItemListTable columns={["Port", "Description", "Printer"]}>
                {state.printserver.ports.map((port: WsPrintPort) => (
                  <tr key={port.name}>
                    <td>
                      <input type="radio" checked={merged.port === port.name} onChange={() => set("port", port.name)} /> {port.name}
                    </td>
                    <td>{port.description}</td>
                    <td>{merged.port === port.name ? merged.name : ""}</td>
                  </tr>
                ))}
              </ItemListTable>
            );
          if (tab === "Advanced")
            return (
              <>
                <FormSection title="Availability">
                  <label style={{ display: "block", marginBottom: 6 }}>
                    <input type="radio" checked readOnly /> Always available
                  </label>
                  <HelpText>Restricting availability to a schedule is decorative in this lab.</HelpText>
                </FormSection>
                <FormRow label="Priority">
                  <input type="number" min={1} max={99} value={priority} onChange={(e) => setPriority(Number(e.target.value) || 1)} />
                </FormRow>
                <FormRow label="Driver">
                  <span>{merged.driver}</span>
                </FormRow>
                <CheckboxRow id="ppSpool" label="Spool print documents so program finishes printing faster" checked={spool} onChange={setSpool} />
                <CheckboxRow id="ppKeep" label="Keep printed documents" checked={false} onChange={() => {}} />
              </>
            );
          if (tab === "Security")
            return (
              <ItemListTable columns={["Group or user", "Permissions"]}>
                <tr>
                  <td>Everyone</td>
                  <td>Print</td>
                </tr>
                <tr>
                  <td>CORP\Print Operators</td>
                  <td>Print, Manage this printer, Manage documents</td>
                </tr>
                <tr>
                  <td>CORP\Administrators</td>
                  <td>Print, Manage this printer, Manage documents</td>
                </tr>
                <tr>
                  <td>CREATOR OWNER</td>
                  <td>Manage documents</td>
                </tr>
              </ItemListTable>
            );
          return null;
        }}
      />
    </WsDialogComponent>
  );
}

function AddDriverDialog({ dispatch, onClose }: { dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("Windows x64");
  const [infPath, setInfPath] = useState("");

  return (
    <WsDialogComponent
      title="Add Printer Driver"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!provider.trim() || !name.trim()) {
              alert("Provider and driver name are required.");
              return false;
            }
            const driver: WsPrintDriver = { provider: provider.trim(), name: name.trim(), environment, infPath: infPath.trim() };
            dispatch({ type: "ADD_PRINT_DRIVER", driver });
            toast.success(`Driver ${driver.name} added.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Provider">
        <input type="text" value={provider} onChange={(e) => setProvider(e.target.value)} />
      </FormRow>
      <FormRow label="Driver name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Environment">
        <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          <option>Windows x64</option>
          <option>Windows x86</option>
          <option>Windows ARM64</option>
        </select>
      </FormRow>
      <FormRow label="INF path">
        <input type="text" value={infPath} onChange={(e) => setInfPath(e.target.value)} placeholder="C:\Windows\System32\DriverStore\driver.inf" />
      </FormRow>
    </WsDialogComponent>
  );
}

function AddFormDialog({ dispatch, onClose }: { dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [widthMm, setWidthMm] = useState(215.9);
  const [heightMm, setHeightMm] = useState(279.4);

  return (
    <WsDialogComponent
      title="Create New Form"
      onClose={onClose}
      buttons={[
        {
          label: "Save Form",
          primary: true,
          onClick: () => {
            if (!name.trim()) {
              alert("Form name is required.");
              return false;
            }
            const form: WsPrintForm = { name: name.trim(), widthMm, heightMm, builtIn: false };
            dispatch({ type: "ADD_PRINT_FORM", form });
            toast.success(`Form ${form.name} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Form name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Width (mm)">
        <input type="number" min={1} step="0.1" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value) || 0)} />
      </FormRow>
      <FormRow label="Height (mm)">
        <input type="number" min={1} step="0.1" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value) || 0)} />
      </FormRow>
    </WsDialogComponent>
  );
}

function AddPortDialog({ dispatch, onClose }: { dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [type, setType] = useState<WsPrintPort["type"]>("TCP/IP");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("Standard TCP/IP Port");

  return (
    <WsDialogComponent
      title="Printer Ports"
      onClose={onClose}
      buttons={[
        {
          label: "Add Port",
          primary: true,
          onClick: () => {
            if (!name.trim()) {
              alert("Port name is required.");
              return false;
            }
            const port: WsPrintPort = { name: name.trim(), description: description.trim(), type };
            dispatch({ type: "ADD_PRINT_PORT", port });
            toast.success(`Port ${port.name} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormSection title="Port type">
        {(["Local", "WSD", "TCP/IP", "LPR"] as const).map((t) => (
          <label key={t} style={{ marginRight: 12 }}>
            <input
              type="radio"
              checked={type === t}
              onChange={() => {
                setType(t);
                setDescription(t === "Local" ? "Local Port" : t === "WSD" ? "WSD Port" : t === "LPR" ? "LPR Port" : "Standard TCP/IP Port");
              }}
            />{" "}
            {t}
          </label>
        ))}
      </FormSection>
      <FormRow label="Port name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
    </WsDialogComponent>
  );
}

const ADD_PRINTER_STEPS = ["Installation Method", "Add Port", "Printer Driver", "Printer Name", "Printer Sharing", "Summary"] as const;

function AddPrinterWizard({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<"tcp" | "existing" | "wsd" | "usb">("tcp");
  const [address, setAddress] = useState("10.10.0.70");
  const [portName, setPortName] = useState("10.10.0.70");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [driverName, setDriverName] = useState(state.printserver.drivers[0]?.name ?? "");
  const [printerName, setPrinterName] = useState("New Printer");
  const [setDefault, setSetDefault] = useState(false);
  const [share, setShare] = useState(true);
  const [shareName, setShareName] = useState("NEW-PRINTER");
  const [location, setLocation] = useState("");
  const [comment, setComment] = useState("");

  function detect() {
    setDetecting(true);
    setDetected(false);
    setPortName(address);
    setTimeout(() => {
      setDetecting(false);
      setDetected(true);
    }, 2000);
  }

  function finish() {
    if (!state.printserver.ports.some((p) => p.name === portName)) {
      dispatch({ type: "ADD_PRINT_PORT", port: { name: portName, description: "Standard TCP/IP Port", type: "TCP/IP" } });
    }
    const printer: WsPrinter = {
      name: printerName.trim(),
      status: "Ready",
      jobsCount: 0,
      driver: driverName,
      port: portName,
      shareName: share ? shareName.trim() : "",
      location: location.trim(),
      comments: comment.trim(),
      color: inferColor(driverName),
      jobs: [],
    };
    if (state.printserver.printers.some((p) => p.name === printer.name)) {
      alert("A printer with this name already exists.");
      return false;
    }
    dispatch({ type: "ADD_PRINTER", printer });
    toast.success(`Printer ${printer.name} installed.`);
    return true;
  }

  const isLastStep = step === ADD_PRINTER_STEPS.length - 1;

  return (
    <WsDialogComponent
      title="Network Printer Installation Wizard"
      width="700px"
      onClose={onClose}
      buttons={[
        ...(step > 0 ? [{ label: "< Back", onClick: () => { setStep(step - 1); return false; } }] : []),
        isLastStep
          ? { label: "Finish", primary: true, onClick: finish }
          : {
              label: "Next >",
              primary: true,
              onClick: () => {
                if (step === 1) {
                  if (!portName.trim()) {
                    alert("Port name is required.");
                    return false;
                  }
                  if (!detected) {
                    alert("Wait for port detection to complete before continuing.");
                    return false;
                  }
                }
                if (step === 2 && !driverName) {
                  alert("Select a driver.");
                  return false;
                }
                if (step === 3 && !printerName.trim()) {
                  alert("Printer name is required.");
                  return false;
                }
                setStep(step + 1);
                return false;
              },
            },
        { label: "Cancel" },
      ]}
    >
      <div className={styles.wizSteps}>
        {ADD_PRINTER_STEPS.map((s, i) => (
          <span key={s} className={i === step ? styles.wizStepActive : i < step ? styles.wizStepDone : styles.wizStep}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div style={{ padding: 14 }}>
        {step === 0 ? (
          <>
            <p style={{ marginBottom: 8 }}>Choose a printer installation method:</p>
            <FormSection title="">
              <label style={{ display: "block", marginBottom: 6 }}>
                <input type="radio" checked={method === "tcp"} onChange={() => setMethod("tcp")} /> Add a TCP/IP or Web Services printer by IP address or hostname
              </label>
              <label style={{ display: "block", marginBottom: 6 }}>
                <input type="radio" checked={method === "existing"} onChange={() => setMethod("existing")} /> Add a new printer using an existing port
              </label>
              <label style={{ display: "block", marginBottom: 6 }}>
                <input type="radio" checked={method === "wsd"} onChange={() => setMethod("wsd")} /> Search the network for Web Services (WSD) printers
              </label>
              <label style={{ display: "block" }}>
                <input type="radio" checked={method === "usb"} onChange={() => setMethod("usb")} /> Add a Bluetooth, wireless, or USB printer
              </label>
            </FormSection>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <FormRow label="Host name or IP">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setDetected(false);
                }}
              />
            </FormRow>
            <FormRow label="Port name">
              <input type="text" value={portName} onChange={(e) => setPortName(e.target.value)} />
            </FormRow>
            <div style={{ marginTop: 8 }}>
              <button type="button" className={styles.btn} onClick={detect} disabled={detecting}>
                Detect
              </button>
            </div>
            {detecting ? (
              <div style={{ padding: 8, background: "#fafafa", border: "1px solid #d4d4d4", marginTop: 8 }}>Detecting printer...</div>
            ) : detected ? (
              <div style={{ padding: 8, background: "#fafafa", border: "1px solid #d4d4d4", marginTop: 8 }}>
                Detecting printer... <span style={{ color: "#348534" }}>OK</span>
              </div>
            ) : (
              <HelpText>Click Detect to probe the address before continuing.</HelpText>
            )}
          </>
        ) : null}
        {step === 2 ? (
          <>
            <FormRow label="Manufacturer driver">
              <select value={driverName} onChange={(e) => setDriverName(e.target.value)}>
                {state.printserver.drivers.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.provider})
                  </option>
                ))}
              </select>
            </FormRow>
            <HelpText>If your driver is not listed, click Have Disk to install from media.</HelpText>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <FormRow label="Printer name">
              <input type="text" value={printerName} onChange={(e) => setPrinterName(e.target.value)} />
            </FormRow>
            <CheckboxRow id="apDefault" label="Set as the default printer" checked={setDefault} onChange={setSetDefault} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <FormSection title="">
              <label style={{ display: "block", marginBottom: 6 }}>
                <input type="radio" checked={share} onChange={() => setShare(true)} /> Share this printer so that others on your network can find and use it
              </label>
              <label style={{ display: "block" }}>
                <input type="radio" checked={!share} onChange={() => setShare(false)} /> Do not share this printer
              </label>
            </FormSection>
            {share ? (
              <>
                <FormRow label="Share name">
                  <input type="text" value={shareName} onChange={(e) => setShareName(e.target.value)} />
                </FormRow>
                <FormRow label="Location">
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                </FormRow>
                <FormRow label="Comment">
                  <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
                </FormRow>
              </>
            ) : null}
          </>
        ) : null}
        {step === 5 ? (
          <FormSection title="Summary">
            <div>
              <b>Name:</b> {printerName}
            </div>
            <div>
              <b>Driver:</b> {driverName}
            </div>
            <div>
              <b>Port:</b> {portName}
            </div>
            <div>
              <b>Share:</b> {share ? `Yes (${shareName})` : "No"}
            </div>
            <div>
              <b>Set as default:</b> {setDefault ? "Yes" : "No"}
            </div>
          </FormSection>
        ) : null}
      </div>
    </WsDialogComponent>
  );
}
