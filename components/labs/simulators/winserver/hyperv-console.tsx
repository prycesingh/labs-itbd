"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type { WinServerState, WsVhd, WsVm, WsVmCheckpoint, WsVmDisk } from "@/lib/labs/simulators/winserver/types";
import { ActionItem, ActionsGroup, ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, SplitVert, type WsTreeNode, VSettingsLayout } from "./ws-mmc";
import { CheckboxRow, EmptyPane, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { WsContextMenu, type WsContextMenuItem } from "./ws-context-menu";
import styles from "./winserver-console.module.css";

type Dialog =
  | { kind: "new-vm" }
  | { kind: "vm-settings"; id: string }
  | { kind: "move-vm"; id: string }
  | { kind: "switch-manager" };

function statusFor(state: WsVm["state"]): string {
  if (state === "Running") return "Operating normally";
  if (state === "Paused") return "Paused";
  if (state === "Saved") return "Saved state";
  return "-";
}

export function HyperVConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("host");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ host: true });
  const [selectedVmId, setSelectedVmId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const host = state.hyperv.host;
  const selectedVm = selectedVmId ? state.hyperv.vms.find((v) => v.id === selectedVmId) ?? null : null;

  const tree: WsTreeNode = { id: "host", icon: "HV", label: host.name };

  function setVmState(vm: WsVm, next: WsVm["state"]) {
    dispatch({ type: "SET_VM_STATE", id: vm.id, state: next, status: statusFor(next) });
    toast.success(`${vm.name}: ${next}`);
  }

  function checkpointVm(vm: WsVm) {
    const name = prompt("Checkpoint name:", `${vm.name} - ${new Date().toLocaleString()}`);
    if (!name) return;
    dispatch({ type: "ADD_VM_CHECKPOINT", id: vm.id, name });
    toast.success(`Checkpoint "${name}" created.`);
  }

  function deleteCheckpoint(vm: WsVm, cp: WsVmCheckpoint) {
    if (!confirm(`Delete checkpoint "${cp.name}"?`)) return;
    dispatch({ type: "DELETE_VM_CHECKPOINT", id: vm.id, checkpointId: cp.id });
    toast.success(`Deleted checkpoint "${cp.name}"`);
  }

  function renameVm(vm: WsVm) {
    const name = prompt("New name:", vm.name);
    if (!name || name === vm.name) return;
    if (state.hyperv.vms.some((v) => v.name === name)) {
      toast.error("A virtual machine with that name already exists.");
      return;
    }
    dispatch({ type: "UPDATE_VM", id: vm.id, patch: { name } });
    toast.success(`Renamed to "${name}"`);
  }

  function deleteVm(vm: WsVm) {
    if (!confirm(`Delete virtual machine "${vm.name}"? This deletes its configuration (not its virtual hard disks).`)) return;
    dispatch({ type: "DELETE_VM", id: vm.id });
    if (selectedVmId === vm.id) setSelectedVmId(null);
    toast.success(`Deleted "${vm.name}"`);
  }

  function showVmContextMenu(e: React.MouseEvent, vm: WsVm) {
    const items: WsContextMenuItem[] = [
      { key: "connect", label: "Connect...", onClick: () => toast.info(`Connecting to ${vm.name}...`) },
      { key: "settings", label: "Settings...", onClick: () => setDialog({ kind: "vm-settings", id: vm.id }) },
      "-",
    ];
    if (vm.state !== "Running") items.push({ key: "start", label: "Start", onClick: () => setVmState(vm, "Running") });
    if (vm.state === "Running") items.push({ key: "pause", label: "Pause", onClick: () => setVmState(vm, "Paused") });
    if (vm.state === "Paused") items.push({ key: "resume", label: "Resume", onClick: () => setVmState(vm, "Running") });
    if (vm.state === "Running") items.push({ key: "save", label: "Save", onClick: () => setVmState(vm, "Saved") });
    if (vm.state === "Running") {
      items.push({ key: "shutdown", label: "Shut Down...", onClick: () => confirm(`Shut down "${vm.name}"?`) && setVmState(vm, "Off") });
      items.push({ key: "turnoff", label: "Turn Off...", onClick: () => confirm(`Turn off "${vm.name}"? Unsaved data will be lost.`) && setVmState(vm, "Off") });
      items.push({ key: "reset", label: "Reset...", onClick: () => confirm(`Reset "${vm.name}"?`) && setVmState(vm, "Running") });
    }
    items.push("-");
    items.push({ key: "checkpoint", label: "Checkpoint", onClick: () => checkpointVm(vm) });
    items.push({ key: "move", label: "Move...", onClick: () => setDialog({ kind: "move-vm", id: vm.id }) });
    items.push({ key: "export", label: "Export...", onClick: () => toast.info(`Exporting ${vm.name}...`) });
    items.push({ key: "rename", label: "Rename...", onClick: () => renameVm(vm) });
    items.push("-");
    items.push({ key: "delete", label: "Delete...", onClick: () => deleteVm(vm) });
    WsContextMenu.show(e.clientX, e.clientY, items);
  }

  function showCheckpointContextMenu(e: React.MouseEvent, vm: WsVm, cp: WsVmCheckpoint) {
    WsContextMenu.show(e.clientX, e.clientY, [
      { key: "apply", label: "Apply...", onClick: () => toast.info(`Applied checkpoint "${cp.name}" (simulated).`) },
      { key: "delete", label: "Delete Checkpoint...", onClick: () => deleteCheckpoint(vm, cp) },
    ]);
  }

  return (
    <MmcLayout
      tree={<MmcTreeNode node={tree} selected={selectedNode} expanded={expanded} onSelect={setSelectedNode} onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))} />}
      content={
        <>
          <ContentHeading>Virtual Machines</ContentHeading>
          <SplitVert
            top={
              <ContentBody>
                {state.hyperv.vms.length === 0 ? (
                  <EmptyPane>No virtual machines. Use New &gt; Virtual Machine in the Actions pane to create one.</EmptyPane>
                ) : (
                  <ItemListTable columns={["Name", "State", "CPU Usage", "Assigned Memory", "Uptime", "Status"]}>
                    {state.hyperv.vms.map((vm) => (
                      <tr
                        key={vm.id}
                        className={selectedVmId === vm.id ? styles.itemListRowSelected : ""}
                        onClick={() => setSelectedVmId(vm.id)}
                        onDoubleClick={() => setDialog({ kind: "vm-settings", id: vm.id })}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedVmId(vm.id);
                          showVmContextMenu(e, vm);
                        }}
                      >
                        <td>{vm.name}</td>
                        <td>{vm.state}</td>
                        <td>{vm.cpuUsage}</td>
                        <td>{vm.memoryAssigned} MB</td>
                        <td>{vm.uptime}</td>
                        <td>{vm.status}</td>
                      </tr>
                    ))}
                  </ItemListTable>
                )}
              </ContentBody>
            }
            bottom={
              <ContentBody>
                <ContentHeading>Checkpoints</ContentHeading>
                {!selectedVm ? (
                  <EmptyPane>Select a virtual machine to view checkpoints.</EmptyPane>
                ) : selectedVm.checkpoints.length === 0 ? (
                  <EmptyPane>The selected virtual machine has no checkpoints.</EmptyPane>
                ) : (
                  <div style={{ padding: 8, fontSize: 12 }}>
                    <b>{selectedVm.name}</b>
                    {selectedVm.checkpoints.map((cp, idx) => (
                      <div
                        key={cp.id}
                        style={{ paddingLeft: 16 + idx * 14, margin: "4px 0", cursor: "pointer" }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          showCheckpointContextMenu(e, selectedVm, cp);
                        }}
                      >
                        {"└ "}
                        <span style={{ color: "#1d6dad" }}>{cp.name}</span>{" "}
                        <span style={{ color: "#888" }}>({new Date(cp.created).toLocaleString()})</span>
                      </div>
                    ))}
                    <div style={{ paddingLeft: 16 + selectedVm.checkpoints.length * 14, margin: "4px 0", fontWeight: 600 }}>{"└ Now"}</div>
                  </div>
                )}
              </ContentBody>
            }
          />
        </>
      }
      actions={
        <>
          <ActionsGroup title={host.name}>
            <ActionItem label="New Virtual Machine..." onClick={() => setDialog({ kind: "new-vm" })} />
            <ActionItem label="Virtual Switch Manager..." onClick={() => setDialog({ kind: "switch-manager" })} />
            <ActionItem label="Hyper-V Settings..." onClick={() => toast.info("Hyper-V Settings not modeled in this lab.")} />
            <ActionItem label="Refresh" onClick={() => toast.success("Refreshed.")} />
          </ActionsGroup>
          <ActionsGroup title="Selected Virtual Machine">
            <ActionItem label="Connect..." disabled={!selectedVm} onClick={() => selectedVm && toast.info(`Connecting to ${selectedVm.name}...`)} />
            <ActionItem label="Settings..." disabled={!selectedVm} onClick={() => selectedVm && setDialog({ kind: "vm-settings", id: selectedVm.id })} />
            <ActionItem label="Start" disabled={!selectedVm || selectedVm.state === "Running"} onClick={() => selectedVm && setVmState(selectedVm, "Running")} />
            <ActionItem
              label="Turn Off..."
              disabled={!selectedVm || selectedVm.state !== "Running"}
              onClick={() => selectedVm && confirm(`Turn off "${selectedVm.name}"? Unsaved data will be lost.`) && setVmState(selectedVm, "Off")}
            />
            <ActionItem
              label="Shut Down..."
              disabled={!selectedVm || selectedVm.state !== "Running"}
              onClick={() => selectedVm && confirm(`Shut down "${selectedVm.name}"?`) && setVmState(selectedVm, "Off")}
            />
            <ActionItem label="Save" disabled={!selectedVm || selectedVm.state !== "Running"} onClick={() => selectedVm && setVmState(selectedVm, "Saved")} />
            <ActionItem label="Pause" disabled={!selectedVm || selectedVm.state !== "Running"} onClick={() => selectedVm && setVmState(selectedVm, "Paused")} />
            <ActionItem label="Resume" disabled={!selectedVm || selectedVm.state !== "Paused"} onClick={() => selectedVm && setVmState(selectedVm, "Running")} />
            <ActionItem
              label="Reset..."
              disabled={!selectedVm || selectedVm.state !== "Running"}
              onClick={() => selectedVm && confirm(`Reset "${selectedVm.name}"?`) && setVmState(selectedVm, "Running")}
            />
            <ActionItem label="Checkpoint" disabled={!selectedVm} onClick={() => selectedVm && checkpointVm(selectedVm)} />
            <ActionItem label="Move..." disabled={!selectedVm} onClick={() => selectedVm && setDialog({ kind: "move-vm", id: selectedVm.id })} />
            <ActionItem label="Export..." disabled={!selectedVm} onClick={() => selectedVm && toast.info(`Exporting ${selectedVm.name}...`)} />
            <ActionItem label="Rename..." disabled={!selectedVm} onClick={() => selectedVm && renameVm(selectedVm)} />
            <ActionItem label="Delete..." disabled={!selectedVm} onClick={() => selectedVm && deleteVm(selectedVm)} />
          </ActionsGroup>
        </>
      }
      dialogs={<HyperVDialogs dialog={dialog} state={state} dispatch={dispatch} onClose={() => setDialog(null)} />}
    />
  );
}

function HyperVDialogs({
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
  if (dialog.kind === "new-vm") return <NewVmWizard state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "vm-settings") return <VmSettingsDialog id={dialog.id} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "move-vm") return <MoveVmDialog id={dialog.id} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "switch-manager") return <SwitchManagerDialog state={state} dispatch={dispatch} onClose={onClose} />;
  return null;
}

function NewVmWizard({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("New Virtual Machine");
  const [location, setLocation] = useState(state.hyperv.host.defaultVmFolder);
  const [generation, setGeneration] = useState<1 | 2>(2);
  const [startupMemory, setStartupMemory] = useState(2048);
  const [dynamicMemory, setDynamicMemory] = useState(true);
  const [switchName, setSwitchName] = useState(state.hyperv.switches[0]?.name ?? "");
  const [diskChoice, setDiskChoice] = useState<"new" | "existing" | "later">("new");
  const [newDiskSizeGB, setNewDiskSizeGB] = useState(60);
  const [existingVhdPath, setExistingVhdPath] = useState(state.hyperv.vhds[0]?.path ?? "");
  const [installChoice, setInstallChoice] = useState<"later" | "iso" | "network">("later");
  const [isoPath, setIsoPath] = useState(state.hyperv.isoLibrary[0] ?? "");

  const steps = ["Before You Begin", "Name and Location", "Generation", "Assign Memory", "Networking", "Connect VHD", "Installation Options", "Summary"];

  function finish() {
    if (state.hyperv.vms.some((v) => v.name === name)) {
      alert("A virtual machine with that name already exists.");
      return false;
    }
    const disks: WsVmDisk[] = [];
    if (diskChoice === "new") {
      disks.push({ ctrl: "SCSI 0", lun: 0, path: `${state.hyperv.host.defaultVhdFolder}\\${name}.vhdx`, sizeGB: newDiskSizeGB });
    } else if (diskChoice === "existing" && existingVhdPath) {
      const vhd: WsVhd | undefined = state.hyperv.vhds.find((v) => v.path === existingVhdPath);
      disks.push({ ctrl: "SCSI 0", lun: 0, path: existingVhdPath, sizeGB: vhd?.sizeGB ?? 0 });
    }
    const vm: WsVm = {
      id: `vm-${Date.now()}`,
      name,
      os: installChoice === "iso" ? isoPath : "Unknown",
      generation,
      state: "Off",
      cpuUsage: "0%",
      memoryAssigned: startupMemory,
      memoryStartup: startupMemory,
      memoryDynamic: dynamicMemory,
      memoryMin: dynamicMemory ? Math.min(512, startupMemory) : startupMemory,
      memoryMax: dynamicMemory ? Math.max(startupMemory, 4096) : startupMemory,
      memoryWeight: "Medium",
      vCpus: 2,
      uptime: "-",
      status: "-",
      secureBoot: generation === 2,
      tpmEnabled: false,
      integrationServices: "Not detected",
      checkpoints: [],
      checkpointType: "Standard",
      disks,
      network: { switch: switchName, vlan: 0, macSpoofing: false, macAddress: "00-15-5D-00-00-00" },
      dvd: { path: installChoice === "iso" ? isoPath : "" },
      replication: { enabled: false },
      autoStart: "Nothing",
      autoStop: "Save state",
      smartPaging: `${state.hyperv.host.defaultVmFolder}\\SmartPaging`,
      notes: "",
    };
    dispatch({ type: "ADD_VM", vm });
    toast.success(`Virtual machine "${name}" created.`);
    return true;
  }

  return (
    <WsDialogComponent
      title="New Virtual Machine Wizard"
      width="560px"
      onClose={onClose}
      buttons={[
        ...(step > 1 ? [{ label: "< Previous", onClick: () => { setStep(step - 1); return false; } }] : []),
        ...(step < 8
          ? [
              {
                label: "Next >",
                primary: true,
                onClick: () => {
                  if (step === 2 && !name.trim()) {
                    alert("Specify a name for the virtual machine.");
                    return false;
                  }
                  setStep(step + 1);
                  return false;
                },
              },
            ]
          : [{ label: "Finish", primary: true, onClick: finish }]),
        { label: "Cancel" },
      ]}
    >
      <div className={styles.wizSteps}>
        {steps.map((s, i) => (
          <span key={s} className={i + 1 === step ? styles.wizStepActive : i + 1 < step ? styles.wizStepDone : styles.wizStep}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <div style={{ padding: 14 }}>
        {step === 1 ? (
          <>
            <p>This wizard helps you create a virtual machine. You will configure the memory, networking, and storage for the new virtual machine.</p>
            <HelpText>Before proceeding, decide on a name, a generation, an amount of memory, and networking for the new virtual machine.</HelpText>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <FormRow label="Name">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </FormRow>
            <FormRow label="Location">
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
            </FormRow>
          </>
        ) : null}
        {step === 3 ? (
          <FormSection title="Generation">
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" checked={generation === 1} onChange={() => setGeneration(1)} /> Generation 1
            </label>
            <label style={{ display: "block" }}>
              <input type="radio" checked={generation === 2} onChange={() => setGeneration(2)} /> Generation 2
            </label>
            <HelpText>Generation 2 virtual machines support UEFI firmware, Secure Boot, and larger boot volumes.</HelpText>
          </FormSection>
        ) : null}
        {step === 4 ? (
          <>
            <FormRow label="Startup memory (MB)">
              <input type="number" value={startupMemory} onChange={(e) => setStartupMemory(Number(e.target.value))} />
            </FormRow>
            <CheckboxRow id="nvDynMem" label="Use Dynamic Memory for this virtual machine" checked={dynamicMemory} onChange={setDynamicMemory} />
          </>
        ) : null}
        {step === 5 ? (
          <FormRow label="Connection">
            <select value={switchName} onChange={(e) => setSwitchName(e.target.value)}>
              <option value="">Not Connected</option>
              {state.hyperv.switches.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        {step === 6 ? (
          <FormSection title="Connect Virtual Hard Disk">
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" checked={diskChoice === "new"} onChange={() => setDiskChoice("new")} /> Create a virtual hard disk
            </label>
            {diskChoice === "new" ? (
              <FormRow label="Size (GB)">
                <input type="number" value={newDiskSizeGB} onChange={(e) => setNewDiskSizeGB(Number(e.target.value))} />
              </FormRow>
            ) : null}
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" checked={diskChoice === "existing"} onChange={() => setDiskChoice("existing")} /> Use an existing virtual hard disk
            </label>
            {diskChoice === "existing" ? (
              <FormRow label="VHD">
                <select value={existingVhdPath} onChange={(e) => setExistingVhdPath(e.target.value)}>
                  {state.hyperv.vhds.map((v) => (
                    <option key={v.path} value={v.path}>
                      {v.path} ({v.sizeGB} GB)
                    </option>
                  ))}
                </select>
              </FormRow>
            ) : null}
            <label style={{ display: "block" }}>
              <input type="radio" checked={diskChoice === "later"} onChange={() => setDiskChoice("later")} /> Attach a virtual hard disk later
            </label>
          </FormSection>
        ) : null}
        {step === 7 ? (
          <FormSection title="Installation Options">
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" checked={installChoice === "later"} onChange={() => setInstallChoice("later")} /> Install an operating system later
            </label>
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" checked={installChoice === "iso"} onChange={() => setInstallChoice("iso")} /> Install an operating system from a bootable image file
            </label>
            {installChoice === "iso" ? (
              <FormRow label="Image file">
                <select value={isoPath} onChange={(e) => setIsoPath(e.target.value)}>
                  {state.hyperv.isoLibrary.map((iso) => (
                    <option key={iso} value={iso}>
                      {iso}
                    </option>
                  ))}
                </select>
              </FormRow>
            ) : null}
            <label style={{ display: "block" }}>
              <input type="radio" checked={installChoice === "network"} onChange={() => setInstallChoice("network")} /> Install an operating system from a network-based installation server
            </label>
          </FormSection>
        ) : null}
        {step === 8 ? (
          <>
            <p>You have successfully completed the New Virtual Machine Wizard. You are about to create the following virtual machine:</p>
            <table className={styles.dashTable}>
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{name}</td>
                </tr>
                <tr>
                  <th>Generation</th>
                  <td>{generation}</td>
                </tr>
                <tr>
                  <th>Memory</th>
                  <td>
                    {startupMemory} MB{dynamicMemory ? " (Dynamic)" : ""}
                  </td>
                </tr>
                <tr>
                  <th>Network</th>
                  <td>{switchName || "Not Connected"}</td>
                </tr>
                <tr>
                  <th>Hard Disk</th>
                  <td>
                    {diskChoice === "new" ? `New VHD, ${newDiskSizeGB} GB` : diskChoice === "existing" ? existingVhdPath : "None"}
                  </td>
                </tr>
                <tr>
                  <th>Install</th>
                  <td>{installChoice === "iso" ? isoPath : installChoice === "network" ? "Network install" : "None"}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </WsDialogComponent>
  );
}

function VmSettingsDialog({ id, state, dispatch, onClose }: { id: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const vm = state.hyperv.vms.find((v) => v.id === id);
  const [activeItem, setActiveItem] = useState("memory");
  const [patch, setPatch] = useState<Partial<WsVm>>({});
  if (!vm) return null;
  const merged: WsVm = { ...vm, ...patch };

  function set<K extends keyof WsVm>(key: K, value: WsVm[K]) {
    setPatch((p) => ({ ...p, [key]: value }));
  }

  function setReplication<K extends keyof WsVm["replication"]>(key: K, value: WsVm["replication"][K]) {
    setPatch((p) => ({ ...p, replication: { ...merged.replication, ...p.replication, [key]: value } }));
  }

  function commit() {
    dispatch({ type: "UPDATE_VM", id: merged.id, patch });
  }

  const groups = [
    {
      title: "Hardware",
      items: [
        { key: "add-hardware", label: "Add Hardware" },
        { key: "firmware", label: "Firmware" },
        { key: "security", label: "Security" },
        { key: "memory", label: "Memory" },
        { key: "processor", label: "Processor" },
        { key: "scsi", label: "SCSI Controller" },
        { key: "network", label: "Network Adapter" },
      ],
    },
    {
      title: "Management",
      items: [
        { key: "name", label: "Name" },
        { key: "integration", label: "Integration Services" },
        { key: "checkpoints", label: "Checkpoints" },
        { key: "smart-paging", label: "Smart Paging File Location" },
        { key: "auto-start", label: "Automatic Start Action" },
        { key: "auto-stop", label: "Automatic Stop Action" },
        { key: "replication", label: "Replication" },
      ],
    },
  ];

  function renderBody() {
    if (activeItem === "add-hardware") return <HelpText>Select a device to add to this virtual machine, then click Add. Not modeled further in this lab.</HelpText>;
    if (activeItem === "firmware")
      return (
        <FormSection title="Boot order">
          <HelpText>{merged.generation === 2 ? "Hard Drive, DVD Drive, Network Adapter" : "IDE, DVD Drive, Legacy Network Adapter"}</HelpText>
        </FormSection>
      );
    if (activeItem === "security")
      return (
        <FormSection title="Security">
          <CheckboxRow id="vsSecureBoot" label="Enable Secure Boot" checked={merged.secureBoot} onChange={(v) => set("secureBoot", v)} />
          <CheckboxRow id="vsTpm" label="Enable Trusted Platform Module" checked={merged.tpmEnabled} onChange={(v) => set("tpmEnabled", v)} />
        </FormSection>
      );
    if (activeItem === "memory")
      return (
        <>
          <FormRow label="RAM (MB)">
            <input type="number" value={merged.memoryAssigned} onChange={(e) => set("memoryAssigned", Number(e.target.value))} />
          </FormRow>
          <CheckboxRow id="vsDynMem" label="Enable Dynamic Memory" checked={merged.memoryDynamic} onChange={(v) => set("memoryDynamic", v)} />
          {merged.memoryDynamic ? (
            <>
              <FormRow label="Minimum RAM (MB)">
                <input type="number" value={merged.memoryMin} onChange={(e) => set("memoryMin", Number(e.target.value))} />
              </FormRow>
              <FormRow label="Maximum RAM (MB)">
                <input type="number" value={merged.memoryMax} onChange={(e) => set("memoryMax", Number(e.target.value))} />
              </FormRow>
            </>
          ) : null}
          <FormRow label="Memory weight">
            <select value={merged.memoryWeight} onChange={(e) => set("memoryWeight", e.target.value as WsVm["memoryWeight"])}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </FormRow>
        </>
      );
    if (activeItem === "processor")
      return (
        <FormRow label="Number of virtual processors">
          <input type="number" min={1} max={64} value={merged.vCpus} onChange={(e) => set("vCpus", Number(e.target.value))} />
        </FormRow>
      );
    if (activeItem === "scsi")
      return merged.disks.length ? (
        <ItemListTable columns={["Controller", "LUN", "Path", "Size (GB)"]}>
          {merged.disks.map((d, i) => (
            <tr key={i}>
              <td>{d.ctrl}</td>
              <td>{d.lun}</td>
              <td>{d.path}</td>
              <td>{d.sizeGB}</td>
            </tr>
          ))}
        </ItemListTable>
      ) : (
        <EmptyPane>No hard disks attached.</EmptyPane>
      );
    if (activeItem === "network")
      return (
        <>
          <FormRow label="Virtual switch">
            <select value={merged.network.switch} onChange={(e) => set("network", { ...merged.network, switch: e.target.value })}>
              <option value="">Not Connected</option>
              {state.hyperv.switches.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="VLAN ID">
            <input type="number" value={merged.network.vlan} onChange={(e) => set("network", { ...merged.network, vlan: Number(e.target.value) })} />
          </FormRow>
          <CheckboxRow
            id="vsMacSpoof"
            label="Enable MAC address spoofing"
            checked={merged.network.macSpoofing}
            onChange={(v) => set("network", { ...merged.network, macSpoofing: v })}
          />
        </>
      );
    if (activeItem === "name")
      return (
        <>
          <FormRow label="Name">
            <input type="text" value={merged.name} onChange={(e) => set("name", e.target.value)} />
          </FormRow>
          <FormRow label="Notes">
            <textarea value={merged.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormRow>
        </>
      );
    if (activeItem === "integration") return <HelpText>Integration services status: {merged.integrationServices}</HelpText>;
    if (activeItem === "checkpoints")
      return (
        <FormSection title="Checkpoint type">
          <label style={{ display: "block", marginBottom: 6 }}>
            <input type="radio" checked={merged.checkpointType === "Production"} onChange={() => set("checkpointType", "Production")} /> Production checkpoints
          </label>
          <label style={{ display: "block" }}>
            <input type="radio" checked={merged.checkpointType === "Standard"} onChange={() => set("checkpointType", "Standard")} /> Standard checkpoints
          </label>
        </FormSection>
      );
    if (activeItem === "smart-paging")
      return (
        <FormRow label="Smart Paging File location">
          <input type="text" value={merged.smartPaging} onChange={(e) => set("smartPaging", e.target.value)} />
        </FormRow>
      );
    if (activeItem === "auto-start")
      return (
        <FormRow label="Automatic start action">
          <select value={merged.autoStart} onChange={(e) => set("autoStart", e.target.value)}>
            <option>Nothing</option>
            <option>Start if it was running when the service stopped</option>
            <option>Always start automatically</option>
          </select>
        </FormRow>
      );
    if (activeItem === "auto-stop")
      return (
        <FormRow label="Automatic stop action">
          <select value={merged.autoStop} onChange={(e) => set("autoStop", e.target.value)}>
            <option>Save state</option>
            <option>Turn off</option>
            <option>Shut down</option>
          </select>
        </FormRow>
      );
    if (activeItem === "replication")
      return (
        <>
          <CheckboxRow id="vsRepl" label="Enable replication for this virtual machine" checked={merged.replication.enabled} onChange={(v) => setReplication("enabled", v)} />
          {merged.replication.enabled ? (
            <>
              <FormRow label="Replica server">
                <input type="text" value={merged.replication.replicaServer ?? ""} onChange={(e) => setReplication("replicaServer", e.target.value)} />
              </FormRow>
              <FormRow label="Frequency (seconds)">
                <input type="number" value={merged.replication.frequencySec ?? 300} onChange={(e) => setReplication("frequencySec", Number(e.target.value))} />
              </FormRow>
            </>
          ) : null}
        </>
      );
    return null;
  }

  return (
    <WsDialogComponent
      title={`Settings for ${vm.name} on ${state.hyperv.host.name}`}
      width="640px"
      onClose={onClose}
      buttons={[
        { label: "OK", primary: true, onClick: () => { commit(); toast.success("Settings saved."); return true; } },
        { label: "Cancel" },
        { label: "Apply", onClick: () => { commit(); toast.success("Settings applied."); return false; } },
      ]}
    >
      <VSettingsLayout groups={groups} activeItem={activeItem} onSelect={setActiveItem}>
        {renderBody()}
      </VSettingsLayout>
    </WsDialogComponent>
  );
}

function MoveVmDialog({ id, state, dispatch, onClose }: { id: string; state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const vm = state.hyperv.vms.find((v) => v.id === id);
  const [destination, setDestination] = useState("");
  const [moveType, setMoveType] = useState<"data" | "storage">("data");
  if (!vm) return null;

  return (
    <WsDialogComponent
      title="Move Virtual Machine"
      onClose={onClose}
      buttons={[
        {
          label: "Move",
          primary: true,
          onClick: () => {
            if (!destination.trim()) {
              alert("Specify a destination host.");
              return false;
            }
            const note =
              moveType === "data"
                ? `Moved the virtual machine's data to ${destination}`
                : `Moved only the virtual machine's storage to ${destination}`;
            dispatch({ type: "MOVE_VM", id: vm.id, note });
            toast.success(`Move started for "${vm.name}"`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <p>
        Move <b>{vm.name}</b> to a new location.
      </p>
      <FormRow label="Destination host">
        <input type="text" placeholder="e.g. FS-FILE-02" value={destination} onChange={(e) => setDestination(e.target.value)} />
      </FormRow>
      <FormSection title="Move options">
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={moveType === "data"} onChange={() => setMoveType("data")} /> Move the virtual machine&apos;s data
        </label>
        <label style={{ display: "block" }}>
          <input type="radio" checked={moveType === "storage"} onChange={() => setMoveType("storage")} /> Move only the virtual machine&apos;s storage
        </label>
      </FormSection>
      {vm.lastMoved && vm.lastMoved.length ? <HelpText>Previous moves: {vm.lastMoved.join("; ")}</HelpText> : null}
    </WsDialogComponent>
  );
}

function SwitchManagerDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (a: WinServerAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"External" | "Internal" | "Private">("Internal");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <WsDialogComponent title="Virtual Switch Manager" width="560px" onClose={onClose} buttons={[{ label: "Close" }]}>
      <FormSection title="Virtual Switches">
        {state.hyperv.switches.length ? (
          <ItemListTable columns={["Name", "Type", "VLAN"]}>
            {state.hyperv.switches.map((s) => (
              <tr key={s.name} className={selected === s.name ? styles.itemListRowSelected : ""} onClick={() => setSelected(s.name)}>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td>{s.vlanId || "-"}</td>
              </tr>
            ))}
          </ItemListTable>
        ) : (
          <EmptyPane>No virtual switches configured.</EmptyPane>
        )}
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              if (!selected) {
                alert("Select a switch to remove.");
                return;
              }
              dispatch({ type: "DELETE_SWITCH", name: selected });
              toast.success(`Deleted switch "${selected}"`);
              setSelected(null);
            }}
          >
            Remove
          </button>
        </div>
      </FormSection>
      <FormSection title="Create Virtual Switch">
        <FormRow label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={type === "External"} onChange={() => setType("External")} /> External
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          <input type="radio" checked={type === "Internal"} onChange={() => setType("Internal")} /> Internal
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <input type="radio" checked={type === "Private"} onChange={() => setType("Private")} /> Private
        </label>
        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              if (!name.trim()) {
                alert("Specify a name for the virtual switch.");
                return;
              }
              if (state.hyperv.switches.some((s) => s.name === name)) {
                alert("A virtual switch with that name already exists.");
                return;
              }
              dispatch({ type: "ADD_SWITCH", sw: { name: name.trim(), type, vlanId: 0 } });
              toast.success(`Created virtual switch "${name}"`);
              setName("");
            }}
          >
            Create Virtual Switch
          </button>
        </div>
      </FormSection>
    </WsDialogComponent>
  );
}
