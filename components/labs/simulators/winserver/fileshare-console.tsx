"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { WinServerAction } from "@/lib/labs/simulators/winserver/reducer";
import type {
  WinServerState,
  WsFileScreen,
  WsQuota,
  WsShare,
  WsSharePerm,
  WsStoragePool,
  WsVolume,
} from "@/lib/labs/simulators/winserver/types";
import { WsContextMenu } from "./ws-context-menu";
import { CheckboxRow, FormRow, FormSection, HelpText, WsDialogComponent } from "./ws-dialog";
import { ContentBody, ItemListTable, TabbedPanel } from "./ws-mmc";
import styles from "./winserver-console.module.css";

type FsSection = "volumes" | "disks" | "storagePools" | "shares" | "iscsi" | "quotas" | "fileScreening";

const NAV: { key: FsSection; label: string }[] = [
  { key: "volumes", label: "Volumes" },
  { key: "disks", label: "Disks" },
  { key: "storagePools", label: "Storage Pools" },
  { key: "shares", label: "Shares" },
  { key: "iscsi", label: "iSCSI" },
  { key: "quotas", label: "Quotas" },
  { key: "fileScreening", label: "File Screening" },
];

const ALL_LETTERS = ["D:", "E:", "F:", "G:", "H:", "I:", "J:", "K:", "L:", "M:", "N:", "O:", "P:", "Q:", "R:", "S:", "T:", "U:", "V:", "W:", "X:", "Y:", "Z:"];
const ALLOC_UNITS = [4, 8, 16, 32, 64];
const SHARE_PROFILES = ["SMB Share - Quick", "SMB Share - Advanced", "SMB Share - Applications", "NFS Share - Quick", "NFS Share - Advanced"];
const FILE_SCREEN_TEMPLATES: { name: string; extensions: string[] }[] = [
  { name: "Block Audio and Video", extensions: [".mp3", ".mp4", ".mov", ".avi", ".wma", ".wmv"] },
  { name: "Block Executable", extensions: [".exe", ".bat", ".cmd", ".msi", ".ps1"] },
  { name: "Block Image Files", extensions: [".jpg", ".jpeg", ".png", ".gif", ".bmp"] },
  { name: "Block Email Files", extensions: [".pst", ".ost", ".eml", ".msg"] },
];

type Dialog =
  | { kind: "new-volume" }
  | { kind: "new-storage-pool" }
  | { kind: "new-share" }
  | { kind: "share-properties"; name: string }
  | { kind: "create-quota" }
  | { kind: "create-file-screen" };

function fmtSize(gb: number): string {
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb} GB`;
}

function UsageBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillClass = clamped > 95 ? styles.usageBarFillRed : clamped > 85 ? styles.usageBarFillAmber : styles.usageBarFill;
  return (
    <div className={styles.usageBar}>
      <div className={fillClass} style={{ width: `${clamped}%` }} />
      <div className={styles.usageBarText}>{clamped}%</div>
    </div>
  );
}

function Pill({ kind, children }: { kind: "green" | "red" | "amber" | "plain"; children: React.ReactNode }) {
  const cls = kind === "green" ? styles.pillGreen : kind === "red" ? styles.pillRed : kind === "amber" ? styles.pillAmber : styles.pill;
  return <span className={cls}>{children}</span>;
}

export function FileshareConsole({ state, dispatch }: { state: WinServerState; dispatch: (action: WinServerAction) => void }) {
  const [section, setSection] = useState<FsSection>("volumes");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { fileshare } = state;

  return (
    <div className={styles.smLayout}>
      <div className={styles.smNav}>
        {NAV.map((n) => (
          <div key={n.key} className={`${styles.smNavItem} ${section === n.key ? styles.smNavItemActive : ""}`} onClick={() => setSection(n.key)}>
            {n.label}
          </div>
        ))}
      </div>
      <div className={styles.smMain}>
        {section === "volumes" ? <VolumesPane fileshare={fileshare} onNewVolume={() => setDialog({ kind: "new-volume" })} /> : null}
        {section === "disks" ? <DisksPane fileshare={fileshare} /> : null}
        {section === "storagePools" ? <StoragePoolsPane fileshare={fileshare} onNewPool={() => setDialog({ kind: "new-storage-pool" })} /> : null}
        {section === "shares" ? (
          <SharesPane
            fileshare={fileshare}
            onNewShare={() => setDialog({ kind: "new-share" })}
            onProperties={(name) => setDialog({ kind: "share-properties", name })}
            onStopSharing={(name) => {
              dispatch({ type: "DELETE_SHARE", name });
              toast.success(`Share "${name}" removed.`);
            }}
          />
        ) : null}
        {section === "iscsi" ? <IscsiPane fileshare={fileshare} /> : null}
        {section === "quotas" ? <QuotasPane fileshare={fileshare} onCreateQuota={() => setDialog({ kind: "create-quota" })} /> : null}
        {section === "fileScreening" ? <FileScreeningPane fileshare={fileshare} onCreateScreen={() => setDialog({ kind: "create-file-screen" })} /> : null}
      </div>

      {dialog?.kind === "new-volume" ? <NewVolumeWizard state={state} dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "new-storage-pool" ? <NewStoragePoolDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "new-share" ? <NewShareWizard state={state} dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "share-properties" ? (
        <SharePropertiesDialog state={state} dispatch={dispatch} shareName={dialog.name} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "create-quota" ? <CreateQuotaDialog dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "create-file-screen" ? <CreateFileScreenDialog dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function VolumesPane({ fileshare, onNewVolume }: { fileshare: WinServerState["fileshare"]; onNewVolume: () => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>VOLUMES - All volumes | {fileshare.volumes.length} total</h2>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onNewVolume}>
          New Volume...
        </button>
      </div>
      <ItemListTable columns={["Volume", "File System", "Capacity", "Free Space", "Used", "Deduplication", "Allocation Unit"]}>
        {fileshare.volumes.map((v) => {
          const usedPct = Math.round((1 - v.freeGB / v.capacityGB) * 100);
          return (
            <tr key={v.letter}>
              <td>
                {v.letter} ({v.label})
              </td>
              <td>{v.fileSystem}</td>
              <td>{fmtSize(v.capacityGB)}</td>
              <td>{fmtSize(v.freeGB)}</td>
              <td>
                <UsageBar pct={usedPct} />
              </td>
              <td>{v.dedup ? <Pill kind="green">Enabled</Pill> : <Pill kind="plain">Disabled</Pill>}</td>
              <td>{v.allocationKB} KB</td>
            </tr>
          );
        })}
      </ItemListTable>
    </div>
  );
}

function DisksPane({ fileshare }: { fileshare: WinServerState["fileshare"] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>DISKS - All disks | {fileshare.disks.length} total</h2>
      <ItemListTable columns={["Disk #", "Status", "Capacity", "Partitions", "Bus", "Model", "Partition Style"]}>
        {fileshare.disks.map((d) => (
          <tr key={d.num}>
            <td>Disk {d.num}</td>
            <td>{d.status}</td>
            <td>{fmtSize(d.capacityGB)}</td>
            <td>{d.partitions}</td>
            <td>{d.bus}</td>
            <td>{d.model}</td>
            <td>{d.mbr}</td>
          </tr>
        ))}
      </ItemListTable>
    </div>
  );
}

function StoragePoolsPane({ fileshare, onNewPool }: { fileshare: WinServerState["fileshare"]; onNewPool: () => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>STORAGE POOLS - All pools | {fileshare.storagePools.length} total</h2>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onNewPool}>
          New Storage Pool...
        </button>
      </div>
      <div className={styles.tileGrid}>
        {fileshare.storagePools.map((p) => (
          <div key={p.name} className={styles.tile}>
            <div className={styles.tileHead}>{p.name}</div>
            <div className={styles.tileDesc}>
              Status: {p.status} · Disks: {p.physicalDisks} · Capacity: {p.capacityTB} TB · Free: {p.freeTB} TB
            </div>
          </div>
        ))}
      </div>
      {fileshare.storagePools.map((p) => (
        <div key={p.name} style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 14, color: "#1d6dad", marginBottom: 6 }}>VIRTUAL DISKS in {p.name}</h3>
          <ItemListTable columns={["Name", "Resiliency", "Size", "Allocation", "Status"]}>
            {p.virtualDisks.map((vd) => (
              <tr key={vd.name}>
                <td>{vd.name}</td>
                <td>
                  <Pill kind={vd.resiliency === "Mirror" ? "green" : vd.resiliency === "Parity" ? "amber" : "plain"}>{vd.resiliency}</Pill>
                </td>
                <td>{vd.sizeTB} TB</td>
                <td>{vd.used}</td>
                <td>{vd.status}</td>
              </tr>
            ))}
          </ItemListTable>
        </div>
      ))}
    </div>
  );
}

function SharesPane({
  fileshare,
  onNewShare,
  onProperties,
  onStopSharing,
}: {
  fileshare: WinServerState["fileshare"];
  onNewShare: () => void;
  onProperties: (name: string) => void;
  onStopSharing: (name: string) => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>SHARES - All shares | {fileshare.shares.length} total</h2>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onNewShare}>
          New Share...
        </button>
      </div>
      <ItemListTable columns={["Share", "Local Path", "Protocol", "Used", "Encryption", "ABE", "Actions"]}>
        {fileshare.shares.map((s) => (
          <tr
            key={s.name}
            onContextMenu={(e) => {
              e.preventDefault();
              WsContextMenu.show(e.clientX, e.clientY, [
                { key: "props", label: "Properties", onClick: () => onProperties(s.name) },
                { key: "stop", label: "Stop Sharing...", onClick: () => confirmStopSharing(s.name, onStopSharing) },
              ]);
            }}
          >
            <td>{s.name}</td>
            <td>{s.path}</td>
            <td>{s.type}</td>
            <td>{s.sizeGB} GB</td>
            <td>{s.encrypt ? <Pill kind="green">Encrypted</Pill> : <Pill kind="plain">None</Pill>}</td>
            <td>{s.abe ? <Pill kind="green">Enabled</Pill> : <Pill kind="plain">Disabled</Pill>}</td>
            <td>
              <button type="button" className={styles.btn} onClick={() => onProperties(s.name)}>
                Properties
              </button>{" "}
              <button type="button" className={styles.btn} onClick={() => confirmStopSharing(s.name, onStopSharing)}>
                Stop Sharing
              </button>
            </td>
          </tr>
        ))}
      </ItemListTable>
    </div>
  );
}

function confirmStopSharing(name: string, onStopSharing: (name: string) => void) {
  if (window.confirm(`Stop sharing "${name}"? Existing connections will be disconnected.`)) {
    onStopSharing(name);
  }
}

function IscsiPane({ fileshare }: { fileshare: WinServerState["fileshare"] }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>iSCSI - Targets</h2>
      <ItemListTable columns={["Target Name (IQN)", "Status", "Initiators", "LUNs"]}>
        {fileshare.iscsiTargets.map((t) => (
          <tr key={t.name}>
            <td>{t.name}</td>
            <td>
              <Pill kind={t.status === "Connected" ? "green" : "plain"}>{t.status}</Pill>
            </td>
            <td>{t.initiators.length}</td>
            <td>{t.luns}</td>
          </tr>
        ))}
      </ItemListTable>
    </div>
  );
}

function QuotasPane({ fileshare, onCreateQuota }: { fileshare: WinServerState["fileshare"]; onCreateQuota: () => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>QUOTAS - Folder quotas (FSRM)</h2>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onCreateQuota}>
          Create Quota...
        </button>
      </div>
      <ItemListTable columns={["Path", "Type", "Limit", "Used", "Usage", "Notifications"]}>
        {fileshare.quotas.map((q) => {
          const pct = Math.round((q.used / q.sizeGB) * 100);
          return (
            <tr key={q.path}>
              <td>{q.path}</td>
              <td>
                <Pill kind={q.kind === "Hard" ? "red" : "amber"}>{q.kind}</Pill>
              </td>
              <td>{q.sizeGB} GB</td>
              <td>{q.used} GB</td>
              <td>
                <UsageBar pct={pct} />
              </td>
              <td>{q.notify.join("%, ")}%</td>
            </tr>
          );
        })}
      </ItemListTable>
    </div>
  );
}

function FileScreeningPane({ fileshare, onCreateScreen }: { fileshare: WinServerState["fileshare"]; onCreateScreen: () => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, color: "#1d6dad", marginBottom: 8 }}>FILE SCREENING - Active screens</h2>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className={styles.btnPrimary} onClick={onCreateScreen}>
          Create File Screen...
        </button>
      </div>
      <ItemListTable columns={["Path", "Screen", "Type", "Blocked Extensions"]}>
        {fileshare.fileScreens.map((f) => (
          <tr key={f.path + f.screen}>
            <td>{f.path}</td>
            <td>{f.screen}</td>
            <td>
              <Pill kind={f.type === "Active" ? "red" : "amber"}>{f.type}</Pill>
            </td>
            <td>{f.extensions.join(", ")}</td>
          </tr>
        ))}
      </ItemListTable>
    </div>
  );
}

// ===== New Volume Wizard (5 steps) =====

type VolumeWizardState = { disk: number; sizeGB: number; letter: string; fs: "NTFS" | "ReFS" | "FAT32"; allocKB: number; label: string; quick: boolean; format: boolean };

function NewVolumeWizard({ state, dispatch, onClose }: { state: WinServerState; dispatch: (action: WinServerAction) => void; onClose: () => void }) {
  const disks = state.fileshare.disks;
  const existingLetters = state.fileshare.volumes.map((v) => v.letter);
  const freeLetters = ALL_LETTERS.filter((l) => !existingLetters.includes(l));
  const [step, setStep] = useState(1);
  const [wz, setWz] = useState<VolumeWizardState>({
    disk: disks[0]?.num ?? 0,
    sizeGB: 100,
    letter: freeLetters[0] ?? "Z:",
    fs: "NTFS",
    allocKB: 64,
    label: "New Volume",
    quick: true,
    format: true,
  });

  const selectedDisk = disks.find((d) => d.num === wz.disk) ?? disks[0];

  function validateStep(): boolean {
    if (step === 2) {
      if (!wz.sizeGB || wz.sizeGB < 1) {
        toast.error("Volume size must be at least 1 GB");
        return false;
      }
      if (selectedDisk && wz.sizeGB > selectedDisk.capacityGB) {
        toast.error(`Volume size exceeds disk capacity (${selectedDisk.capacityGB} GB)`);
        return false;
      }
    }
    return true;
  }

  function commit() {
    if (!selectedDisk) return;
    const volume: WsVolume = {
      letter: wz.letter,
      label: wz.label,
      capacityGB: wz.sizeGB,
      freeGB: wz.format ? Math.floor(wz.sizeGB * 0.985) : wz.sizeGB,
      fileSystem: wz.format ? wz.fs : "NTFS",
      dedup: false,
      allocationKB: wz.allocKB,
    };
    dispatch({ type: "ADD_VOLUME", volume });
    toast.success(`Volume ${wz.letter} (${wz.label}, ${wz.sizeGB} GB) created on Disk ${selectedDisk.num}`);
  }

  return (
    <WsDialogComponent
      title={`New Volume Wizard - Step ${step} of 5`}
      width="640px"
      onClose={onClose}
      buttons={[
        { label: "< Back", onClick: () => { if (step > 1) setStep(step - 1); return false; } },
        step < 5
          ? { label: "Next >", primary: true, onClick: () => { if (!validateStep()) return false; setStep(step + 1); return false; } }
          : { label: "Create", primary: true, onClick: () => { commit(); return true; } },
        { label: "Cancel" },
      ]}
    >
      {step === 1 ? (
        <>
          <FormSection title="Select the server and disk">
            <HelpText>A new volume will be created on the selected disk. The disk will be brought online and initialized if needed.</HelpText>
          </FormSection>
          <ItemListTable columns={["Disk", "Model", "Capacity", "Bus", "Partition", "Status"]}>
            {disks.map((d) => (
              <tr
                key={d.num}
                className={wz.disk === d.num ? styles.itemListRowSelected : ""}
                onClick={() => setWz((w) => ({ ...w, disk: d.num, sizeGB: Math.min(w.sizeGB, d.capacityGB) }))}
              >
                <td>Disk {d.num}</td>
                <td>{d.model}</td>
                <td>{fmtSize(d.capacityGB)}</td>
                <td>{d.bus}</td>
                <td>{d.mbr}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </ItemListTable>
        </>
      ) : null}

      {step === 2 && selectedDisk ? (
        <>
          <FormSection title="Specify the size of the volume">
            <HelpText>Available capacity on Disk {selectedDisk.num}: {selectedDisk.capacityGB} GB</HelpText>
          </FormSection>
          <FormRow label="Volume size (GB)">
            <input type="number" min={1} max={selectedDisk.capacityGB} value={wz.sizeGB} onChange={(e) => setWz((w) => ({ ...w, sizeGB: Number(e.target.value) }))} />
          </FormRow>
        </>
      ) : null}

      {step === 3 ? (
        <FormRow label="Drive letter">
          <select value={wz.letter} onChange={(e) => setWz((w) => ({ ...w, letter: e.target.value }))}>
            {freeLetters.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </FormRow>
      ) : null}

      {step === 4 ? (
        <>
          <FormRow label="File system">
            <select value={wz.fs} onChange={(e) => setWz((w) => ({ ...w, fs: e.target.value as VolumeWizardState["fs"] }))}>
              <option>NTFS</option>
              <option>ReFS</option>
              <option>FAT32</option>
            </select>
          </FormRow>
          <FormRow label="Allocation unit (KB)">
            <select value={wz.allocKB} onChange={(e) => setWz((w) => ({ ...w, allocKB: Number(e.target.value) }))}>
              {ALLOC_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Volume label">
            <input type="text" maxLength={32} value={wz.label} onChange={(e) => setWz((w) => ({ ...w, label: e.target.value }))} />
          </FormRow>
          <CheckboxRow id="wzFormat" label="Format this volume" checked={wz.format} onChange={(v) => setWz((w) => ({ ...w, format: v }))} />
          <CheckboxRow id="wzQuick" label="Perform a quick format" checked={wz.quick} onChange={(v) => setWz((w) => ({ ...w, quick: v }))} />
          <HelpText>ReFS is recommended for large data volumes over 4 TB. NTFS supports BitLocker and EFS.</HelpText>
        </>
      ) : null}

      {step === 5 && selectedDisk ? (
        <>
          <FormSection title="Confirm selections">
            <HelpText>The wizard is ready to create the volume with the following settings:</HelpText>
          </FormSection>
          <table className={styles.dashTable}>
            <tbody>
              <tr>
                <th style={{ width: "38%" }}>Server</th>
                <td>{state.server.name}</td>
              </tr>
              <tr>
                <th>Disk</th>
                <td>
                  Disk {selectedDisk.num} ({selectedDisk.model})
                </td>
              </tr>
              <tr>
                <th>Volume size</th>
                <td>{wz.sizeGB} GB</td>
              </tr>
              <tr>
                <th>Drive letter</th>
                <td>{wz.letter}</td>
              </tr>
              <tr>
                <th>File system</th>
                <td>{wz.fs}</td>
              </tr>
              <tr>
                <th>Allocation unit</th>
                <td>{wz.allocKB} KB</td>
              </tr>
              <tr>
                <th>Volume label</th>
                <td>{wz.label}</td>
              </tr>
              <tr>
                <th>Format</th>
                <td>{wz.format ? (wz.quick ? "Quick format" : "Full format") : "No format (RAW)"}</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : null}
    </WsDialogComponent>
  );
}

// ===== New Storage Pool dialog =====

function NewStoragePoolDialog({ state, dispatch, onClose }: { state: WinServerState; dispatch: (action: WinServerAction) => void; onClose: () => void }) {
  const [name, setName] = useState("Storage-Pool-2");
  const [description, setDescription] = useState("");
  const [selectedDisks, setSelectedDisks] = useState<number[]>(state.fileshare.disks.map((d) => d.num));

  return (
    <WsDialogComponent
      title="New Storage Pool Wizard"
      width="640px"
      onClose={onClose}
      buttons={[
        {
          label: "Finish",
          primary: true,
          onClick: () => {
            if (!name.trim()) {
              toast.error("Storage pool name is required.");
              return false;
            }
            const capacityTB = selectedDisks.reduce((sum, num) => {
              const disk = state.fileshare.disks.find((d) => d.num === num);
              return sum + (disk ? disk.capacityGB / 1024 : 0);
            }, 0);
            const pool: WsStoragePool = {
              name: name.trim(),
              status: "OK",
              physicalDisks: selectedDisks.length,
              capacityTB: Math.round(capacityTB * 10) / 10,
              freeTB: Math.round(capacityTB * 10) / 10,
              virtualDisks: [],
            };
            dispatch({ type: "ADD_STORAGE_POOL", pool });
            toast.success(`Storage pool "${pool.name}" created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <FormSection title="Select Physical Disks">
        {state.fileshare.disks.map((d) => (
          <CheckboxRow
            key={d.num}
            id={`pool-disk-${d.num}`}
            label={`Disk ${d.num} - ${fmtSize(d.capacityGB)} (${d.model})`}
            checked={selectedDisks.includes(d.num)}
            onChange={(checked) => setSelectedDisks((cur) => (checked ? [...cur, d.num] : cur.filter((n) => n !== d.num)))}
          />
        ))}
      </FormSection>
    </WsDialogComponent>
  );
}

// ===== New Share Wizard (6 steps) =====

type ShareWizardState = {
  profile: string;
  volume: string;
  customPath: string;
  shareName: string;
  shareDescription: string;
  abe: boolean;
  caching: boolean;
  encrypt: boolean;
  ca: boolean;
};

function NewShareWizard({ state, dispatch, onClose }: { state: WinServerState; dispatch: (action: WinServerAction) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [wz, setWz] = useState<ShareWizardState>({
    profile: SHARE_PROFILES[0],
    volume: state.fileshare.volumes[0]?.letter ?? "D:",
    customPath: "",
    shareName: "NewShare",
    shareDescription: "",
    abe: false,
    caching: true,
    encrypt: false,
    ca: false,
  });

  const localPath = wz.customPath || `${wz.volume}\\Shares\\${wz.shareName}`;

  function validateStep(): boolean {
    if (step === 3 && !wz.shareName.trim()) {
      toast.error("Share name is required.");
      return false;
    }
    return true;
  }

  function commit() {
    if (state.fileshare.shares.some((s) => s.name === wz.shareName)) {
      toast.error(`A share named "${wz.shareName}" already exists.`);
      return false;
    }
    const perms: WsSharePerm[] = [
      { principal: "Everyone", access: "Read" },
      { principal: "BUILTIN\\Administrators", access: "Full Control" },
    ];
    const share: WsShare = {
      name: wz.shareName.trim(),
      path: localPath,
      type: wz.profile.startsWith("NFS") ? "NFS" : "SMB",
      remote: `\\\\${state.server.name}\\${wz.shareName.trim()}`,
      perms,
      abe: wz.abe,
      caching: wz.caching,
      encrypt: wz.encrypt,
      ca: wz.ca,
      quotaGB: 0,
      sizeGB: 0,
    };
    dispatch({ type: "ADD_SHARE", share });
    toast.success(`Share "${share.name}" created.`);
    return true;
  }

  return (
    <WsDialogComponent
      title="New Share Wizard"
      width="720px"
      onClose={onClose}
      buttons={[
        { label: "Previous", onClick: () => { if (step > 1) setStep(step - 1); return false; } },
        step < 6
          ? { label: "Next", primary: true, onClick: () => { if (!validateStep()) return false; setStep(step + 1); return false; } }
          : { label: "Create", primary: true, onClick: () => commit() },
        { label: "Cancel" },
      ]}
    >
      {step === 1 ? (
        <>
          <h3 style={{ marginBottom: 10 }}>Select the profile for this share</h3>
          <FormRow label="File share profile">
            <select value={wz.profile} onChange={(e) => setWz((w) => ({ ...w, profile: e.target.value }))}>
              {SHARE_PROFILES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormRow>
          <FormSection title="Description">
            <p>{wz.profile.startsWith("NFS") ? "Creates an NFS file share for UNIX/Linux clients." : "Creates an SMB file share. Suitable for general purpose file sharing."}</p>
          </FormSection>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h3 style={{ marginBottom: 10 }}>Select the server and path for this share</h3>
          <FormRow label="Server">
            <input type="text" value={state.server.name} disabled />
          </FormRow>
          <FormRow label="Volume">
            <select value={wz.volume} onChange={(e) => setWz((w) => ({ ...w, volume: e.target.value }))}>
              {state.fileshare.volumes.map((v) => (
                <option key={v.letter} value={v.letter}>
                  {v.letter} ({v.label})
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Custom path">
            <input type="text" placeholder="D:\Shares\New" value={wz.customPath} onChange={(e) => setWz((w) => ({ ...w, customPath: e.target.value }))} />
          </FormRow>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h3 style={{ marginBottom: 10 }}>Specify share name</h3>
          <FormRow label="Share name">
            <input type="text" value={wz.shareName} onChange={(e) => setWz((w) => ({ ...w, shareName: e.target.value }))} />
          </FormRow>
          <FormRow label="Description">
            <input type="text" value={wz.shareDescription} onChange={(e) => setWz((w) => ({ ...w, shareDescription: e.target.value }))} />
          </FormRow>
          <FormRow label="Local path">
            <span>{localPath}</span>
          </FormRow>
          <FormRow label="Remote path">
            <span>
              \\{state.server.name}\{wz.shareName}
            </span>
          </FormRow>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h3 style={{ marginBottom: 10 }}>Configure share settings</h3>
          <CheckboxRow id="swAbe" label="Enable access-based enumeration" checked={wz.abe} onChange={(v) => setWz((w) => ({ ...w, abe: v }))} />
          <CheckboxRow id="swCache" label="Allow caching of share" checked={wz.caching} onChange={(v) => setWz((w) => ({ ...w, caching: v }))} />
          <CheckboxRow id="swEnc" label="Encrypt data access" checked={wz.encrypt} onChange={(v) => setWz((w) => ({ ...w, encrypt: v }))} />
          <CheckboxRow id="swCa" label="Enable continuous availability" checked={wz.ca} onChange={(v) => setWz((w) => ({ ...w, ca: v }))} />
        </>
      ) : null}

      {step === 5 ? (
        <>
          <h3 style={{ marginBottom: 10 }}>Specify permissions to control access</h3>
          <ItemListTable columns={["Principal", "Access", "Applies to"]}>
            <tr>
              <td>Everyone</td>
              <td>Read</td>
              <td>This folder, subfolders, and files</td>
            </tr>
            <tr>
              <td>BUILTIN\Administrators</td>
              <td>Full Control</td>
              <td>This folder, subfolders, and files</td>
            </tr>
            <tr>
              <td>CREATOR OWNER</td>
              <td>Full Control</td>
              <td>Subfolders and files only</td>
            </tr>
          </ItemListTable>
          <HelpText>Default permissions are informational only in this simulator.</HelpText>
        </>
      ) : null}

      {step === 6 ? (
        <>
          <h3 style={{ marginBottom: 10 }}>Confirm selections</h3>
          <FormSection title="Share location">
            <p>Server: {state.server.name}</p>
            <p>Volume/Path: {localPath}</p>
          </FormSection>
          <FormSection title="Share properties">
            <p>Share name: {wz.shareName}</p>
            <p>Protocol: {wz.profile.startsWith("NFS") ? "NFS" : "SMB"}</p>
          </FormSection>
        </>
      ) : null}
    </WsDialogComponent>
  );
}

// ===== Share Properties dialog (tabs) =====

function SharePropertiesDialog({
  state,
  dispatch,
  shareName,
  onClose,
}: {
  state: WinServerState;
  dispatch: (action: WinServerAction) => void;
  shareName: string;
  onClose: () => void;
}) {
  const share = state.fileshare.shares.find((s) => s.name === shareName);
  const [tab, setTab] = useState("General");
  const [abe, setAbe] = useState(share?.abe ?? false);
  const [caching, setCaching] = useState(share?.caching ?? false);
  const [encrypt, setEncrypt] = useState(share?.encrypt ?? false);
  const [ca, setCa] = useState(share?.ca ?? false);

  if (!share) return null;

  return (
    <WsDialogComponent
      title={`Properties: ${share.name}`}
      width="640px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "UPDATE_SHARE", name: share.name, patch: { abe, caching, encrypt, ca } });
            toast.success("Share properties saved.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <TabbedPanel
        tabs={["General", "Permissions", "Settings"]}
        activeTab={tab}
        onTabChange={setTab}
        renderTab={(t) => {
          if (t === "General") {
            return (
              <>
                <FormRow label="Server name">
                  <span>{state.server.name}</span>
                </FormRow>
                <FormRow label="Share name">
                  <span>{share.name}</span>
                </FormRow>
                <FormRow label="Local path">
                  <span>{share.path}</span>
                </FormRow>
                <FormRow label="Remote path">
                  <span>{share.remote}</span>
                </FormRow>
                <FormRow label="Protocol">
                  <span>{share.type}</span>
                </FormRow>
              </>
            );
          }
          if (t === "Permissions") {
            return (
              <ItemListTable columns={["Principal", "Access"]}>
                {share.perms.map((p) => (
                  <tr key={p.principal}>
                    <td>{p.principal}</td>
                    <td>{p.access}</td>
                  </tr>
                ))}
              </ItemListTable>
            );
          }
          return (
            <>
              <CheckboxRow id="propAbe" label="Enable access-based enumeration" checked={abe} onChange={setAbe} />
              <CheckboxRow id="propCache" label="Allow caching of share" checked={caching} onChange={setCaching} />
              <CheckboxRow id="propEnc" label="Encrypt data access" checked={encrypt} onChange={setEncrypt} />
              <CheckboxRow id="propCa" label="Enable continuous availability" checked={ca} onChange={setCa} />
            </>
          );
        }}
      />
    </WsDialogComponent>
  );
}

// ===== Create Quota dialog =====

function CreateQuotaDialog({ dispatch, onClose }: { dispatch: (action: WinServerAction) => void; onClose: () => void }) {
  const [path, setPath] = useState("D:\\Shares\\");
  const [sizeGB, setSizeGB] = useState(100);
  const [kind, setKind] = useState<"Hard" | "Soft">("Hard");

  return (
    <WsDialogComponent
      title="Create Quota"
      onClose={onClose}
      buttons={[
        {
          label: "Create",
          primary: true,
          onClick: () => {
            if (!path.trim()) {
              toast.error("Quota path is required.");
              return false;
            }
            const quota: WsQuota = { path: path.trim(), sizeGB, kind, used: 0, notify: [85, 95, 100] };
            dispatch({ type: "ADD_QUOTA", quota });
            toast.success("Quota created.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Quota path">
        <input type="text" value={path} onChange={(e) => setPath(e.target.value)} />
      </FormRow>
      <FormRow label="Limit (GB)">
        <input type="number" min={1} value={sizeGB} onChange={(e) => setSizeGB(Number(e.target.value))} />
      </FormRow>
      <FormRow label="Quota type">
        <label style={{ marginRight: 12 }}>
          <input type="radio" name="quotaKind" checked={kind === "Hard"} onChange={() => setKind("Hard")} /> Hard
        </label>
        <label>
          <input type="radio" name="quotaKind" checked={kind === "Soft"} onChange={() => setKind("Soft")} /> Soft
        </label>
      </FormRow>
    </WsDialogComponent>
  );
}

// ===== Create File Screen dialog =====

function CreateFileScreenDialog({ dispatch, onClose }: { dispatch: (action: WinServerAction) => void; onClose: () => void }) {
  const [path, setPath] = useState("D:\\Shares\\");
  const [template, setTemplate] = useState(FILE_SCREEN_TEMPLATES[0].name);
  const [type, setType] = useState<"Active" | "Passive">("Active");

  return (
    <WsDialogComponent
      title="Create File Screen"
      onClose={onClose}
      buttons={[
        {
          label: "Create",
          primary: true,
          onClick: () => {
            if (!path.trim()) {
              toast.error("Path is required.");
              return false;
            }
            const tpl = FILE_SCREEN_TEMPLATES.find((t) => t.name === template) ?? FILE_SCREEN_TEMPLATES[0];
            const screen: WsFileScreen = { path: path.trim(), screen: tpl.name, extensions: tpl.extensions, type };
            dispatch({ type: "ADD_FILE_SCREEN", screen });
            toast.success("File screen created.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Path">
        <input type="text" value={path} onChange={(e) => setPath(e.target.value)} />
      </FormRow>
      <FormRow label="Screen template">
        <select value={template} onChange={(e) => setTemplate(e.target.value)}>
          {FILE_SCREEN_TEMPLATES.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Type">
        <label style={{ marginRight: 12 }}>
          <input type="radio" name="screenType" checked={type === "Active"} onChange={() => setType("Active")} /> Active
        </label>
        <label>
          <input type="radio" name="screenType" checked={type === "Passive"} onChange={() => setType("Passive")} /> Passive
        </label>
      </FormRow>
    </WsDialogComponent>
  );
}
