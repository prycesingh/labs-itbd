"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { IntuneAction } from "@/lib/labs/simulators/intune/reducer";
import { bitlockerKeyFor } from "@/lib/labs/simulators/intune/reducer";
import type { IntuneCompliance, IntuneDevice, IntunePlatform, IntuneState } from "@/lib/labs/simulators/intune/types";
import { evaluateDeviceCompliance } from "@/lib/labs/simulators/intune/compliance";
import { BladeActionButton, BladeLayout, Pill, exportCsv } from "./intune-ui";
import styles from "./intune-console.module.css";

const PLATFORM_FILTERS: ("All" | IntunePlatform)[] = ["All", "Windows", "iOS", "iPadOS", "macOS", "Android", "Linux"];
const COMPLIANCE_FILTERS: ("All" | IntuneCompliance)[] = ["All", "Compliant", "Not compliant", "In grace period", "Not evaluated"];

const DEVICE_SECTIONS = ["Overview", "Properties", "Hardware", "Discovered apps", "Device compliance", "Recovery keys", "Managed apps"];

function compliancePillTone(c: IntuneCompliance): "ok" | "warn" | "err" | "muted" {
  if (c === "Compliant") return "ok";
  if (c === "Not compliant") return "err";
  if (c === "In grace period") return "warn";
  return "muted";
}

function userLabel(state: IntuneState, userId: string): string {
  const u = state.users.find((x) => x.id === userId);
  return u ? `${u.name} (${u.upn})` : userId;
}

export function DevicesPage({ state, dispatch }: { state: IntuneState; dispatch: (action: IntuneAction) => void }) {
  const [platformFilter, setPlatformFilter] = useState<"All" | IntunePlatform>("All");
  const [complianceFilter, setComplianceFilter] = useState<"All" | IntuneCompliance>("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(DEVICE_SECTIONS[0]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.devices.filter((d) => {
      if (platformFilter !== "All" && d.platform !== platformFilter) return false;
      if (complianceFilter !== "All" && d.compliance !== complianceFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !d.serial.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.devices, platformFilter, complianceFilter, search]);

  const selectedDevice = selectedDeviceId ? state.devices.find((d) => d.id === selectedDeviceId) : undefined;

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === filtered.length ? [] : filtered.map((d) => d.id)));
  }

  function handleRefresh() {
    setSearch((s) => s);
    toast.success("Device list refreshed");
  }

  function handleExport() {
    exportCsv(
      "devices.csv",
      ["Name", "Platform", "OS", "Compliance", "Ownership", "Last check-in"],
      filtered.map((d) => [d.name, d.platform, `${d.os} ${d.osVersion}`, d.compliance, d.ownership, new Date(d.lastCheckIn).toLocaleString()]),
    );
    toast.info("Device export started — file ready in Reports");
  }

  function handleBulkSync() {
    if (!selected.length) {
      toast.error("Select at least one device to sync");
      return;
    }
    selected.forEach((id) => dispatch({ type: "SYNC_DEVICE", id }));
    toast.success(`Sync requested for ${selected.length} device${selected.length === 1 ? "" : "s"}`);
  }

  function openDevice(id: string) {
    setSelectedDeviceId(id);
    setActiveSection(DEVICE_SECTIONS[0]);
  }

  function backToList() {
    setSelectedDeviceId(null);
  }

  if (selectedDevice) {
    return (
      <DeviceBlade
        state={state}
        device={selectedDevice}
        dispatch={dispatch}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBack={backToList}
      />
    );
  }

  return (
    <div>
      <h1 className={styles.pageH1}>All devices</h1>
      <p className={styles.pageSub}>{filtered.length} of {state.devices.length} devices</p>

      <div className={styles.toolbar}>
        <button type="button" className={styles.tbBtn} onClick={handleRefresh}>
          Refresh
        </button>
        <button type="button" className={styles.tbBtn} onClick={handleExport}>
          Export CSV
        </button>
        <div className={styles.tbSep} />
        <button type="button" className={styles.tbBtn} onClick={handleBulkSync}>
          Sync selected ({selected.length})
        </button>
      </div>

      <div className={styles.filterRow}>
        {PLATFORM_FILTERS.map((p) => (
          <div
            key={p}
            className={`${styles.filterChip} ${platformFilter === p ? styles.filterChipActive : ""}`}
            onClick={() => setPlatformFilter(p)}
          >
            {p}
          </div>
        ))}
      </div>
      <div className={styles.filterRow}>
        {COMPLIANCE_FILTERS.map((c) => (
          <div
            key={c}
            className={`${styles.filterChip} ${complianceFilter === c ? styles.filterChipActive : ""}`}
            onClick={() => setComplianceFilter(c)}
          >
            {c}
          </div>
        ))}
        <input
          className={styles.input}
          style={{ maxWidth: 240, marginLeft: "auto" }}
          placeholder="Search by name or serial"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cbCol}>
                <input type="checkbox" checked={selected.length > 0 && selected.length === filtered.length} onChange={toggleSelectAll} />
              </th>
              <th>Name</th>
              <th>Platform</th>
              <th>OS</th>
              <th>Compliance</th>
              <th>Ownership</th>
              <th>Last check-in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((d) => (
                <tr key={d.id}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggleSelected(d.id)} />
                  </td>
                  <td className={styles.rowLink} onClick={() => openDevice(d.id)}>
                    {d.name}
                  </td>
                  <td onClick={() => openDevice(d.id)}>{d.platform}</td>
                  <td onClick={() => openDevice(d.id)}>
                    {d.os} {d.osVersion}
                  </td>
                  <td onClick={() => openDevice(d.id)}>
                    <Pill tone={compliancePillTone(d.compliance)}>{d.compliance}</Pill>
                  </td>
                  <td onClick={() => openDevice(d.id)}>{d.ownership}</td>
                  <td onClick={() => openDevice(d.id)}>{new Date(d.lastCheckIn).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className={styles.center}>
                  No devices match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeviceBlade({
  state,
  device,
  dispatch,
  activeSection,
  onSectionChange,
  onBack,
}: {
  state: IntuneState;
  device: IntuneDevice;
  dispatch: (action: IntuneAction) => void;
  activeSection: string;
  onSectionChange: (s: string) => void;
  onBack: () => void;
}) {
  function confirmAnd(message: string, run: () => void) {
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    run();
  }

  function handleSync() {
    dispatch({ type: "SYNC_DEVICE", id: device.id });
    toast.success(`${device.name} sync requested`);
  }
  function handleRestart() {
    confirmAnd(`Restart "${device.name}"?`, () => toast.success(`Restart command sent to ${device.name}`));
  }
  function handleRemoteLock() {
    confirmAnd(`Remote lock "${device.name}"?`, () => toast.success(`Remote lock issued for ${device.name}`));
  }
  function handleResetPasscode() {
    const msg =
      device.platform === "iOS" || device.platform === "Android"
        ? `Reset passcode on "${device.name}"?`
        : `Reset passcode only supported on iOS / Android. Proceed anyway?`;
    confirmAnd(msg, () => toast.success(`Passcode reset command sent to ${device.name}`));
  }
  function handleQuickScan() {
    dispatch({ type: "SCAN_DEVICE", id: device.id, scanType: "Quick" });
    toast.success(`Quick scan started on ${device.name} (~2 min)`);
  }
  function handleFullScan() {
    dispatch({ type: "SCAN_DEVICE", id: device.id, scanType: "Full" });
    toast.success(`Full scan started on ${device.name} (~60-90 min)`);
  }
  function handleFreshStart() {
    confirmAnd(`Fresh start "${device.name}"? Removes installed apps but preserves user data + Azure AD join + Intune enrollment.`, () =>
      toast.success(`Fresh start initiated for ${device.name}`),
    );
  }
  function handleAutopilotReset() {
    confirmAnd(`Autopilot reset "${device.name}"? Removes ALL data, apps, and policies. Device re-enrolls via Autopilot on next boot.`, () =>
      toast.success("Autopilot reset initiated. User will see OOBE on next boot."),
    );
  }
  function handleWipe() {
    confirmAnd(`Wipe "${device.name}"? This factory-resets the device and cannot be undone.`, () => {
      dispatch({ type: "WIPE_DEVICE", id: device.id });
      toast.success(`Wipe initiated for ${device.name}`);
    });
  }
  function handleRetire() {
    confirmAnd(`Retire "${device.name}"? This removes corporate data and unenrolls.`, () => {
      dispatch({ type: "RETIRE_DEVICE", id: device.id });
      toast.success(`Retire initiated for ${device.name}`);
      onBack();
    });
  }
  function handleRename() {
    if (typeof window === "undefined") return;
    const nn = window.prompt("New device name:", device.name);
    if (nn && nn.trim()) {
      dispatch({ type: "RENAME_DEVICE", id: device.id, name: nn.trim() });
      toast.success("Device renamed");
    }
  }
  function handleLocate() {
    dispatch({ type: "LOCATE_DEVICE", id: device.id });
    toast.info(`Location request sent to ${device.name} (see Hardware tab)`);
  }
  function handleBitlockerRotate() {
    confirmAnd(`Rotate the BitLocker recovery key for "${device.name}"?`, () => {
      dispatch({ type: "ROTATE_BITLOCKER", id: device.id });
      toast.success("BitLocker recovery key rotated");
    });
  }
  function handleDiagnostics() {
    confirmAnd(`Collect diagnostics from "${device.name}"?`, () =>
      toast.success("Diagnostics collection requested. Logs available in 5-10 min."),
    );
  }
  function handleDelete() {
    confirmAnd(`Delete "${device.name}" from Intune? This cannot be undone.`, () => {
      dispatch({ type: "DELETE_DEVICE", id: device.id });
      toast.success(`${device.name} deleted`);
      onBack();
    });
  }

  const toolbar = (
    <>
      <BladeActionButton label="Sync" onClick={handleSync} />
      <BladeActionButton label="Restart" onClick={handleRestart} />
      <BladeActionButton label="Remote lock" onClick={handleRemoteLock} />
      <BladeActionButton label="Reset passcode" onClick={handleResetPasscode} />
      <BladeActionButton label="Quick scan" onClick={handleQuickScan} />
      <BladeActionButton label="Full scan" onClick={handleFullScan} />
      <BladeActionButton label="Fresh start" onClick={handleFreshStart} />
      <BladeActionButton label="Autopilot reset" onClick={handleAutopilotReset} />
      <BladeActionButton label="Wipe" onClick={handleWipe} danger />
      <BladeActionButton label="Retire" onClick={handleRetire} danger />
      <BladeActionButton label="Rename" onClick={handleRename} />
      <BladeActionButton label="Locate device" onClick={handleLocate} />
      <BladeActionButton label="BitLocker key rotate" onClick={handleBitlockerRotate} />
      <BladeActionButton label="Collect diagnostics" onClick={handleDiagnostics} />
      <BladeActionButton label="Delete" onClick={handleDelete} danger />
    </>
  );

  return (
    <div>
      <button type="button" className={styles.btnSubtle} onClick={onBack}>
        &larr; Back to all devices
      </button>
      <BladeLayout title={device.name} toolbar={toolbar} sections={DEVICE_SECTIONS} activeSection={activeSection} onSectionChange={onSectionChange}>
        {activeSection === "Overview" ? <OverviewSection state={state} device={device} /> : null}
        {activeSection === "Properties" ? <PropertiesSection device={device} /> : null}
        {activeSection === "Hardware" ? <HardwareSection device={device} /> : null}
        {activeSection === "Discovered apps" ? <DiscoveredAppsSection /> : null}
        {activeSection === "Device compliance" ? <ComplianceSection state={state} device={device} /> : null}
        {activeSection === "Recovery keys" ? <RecoverySection device={device} /> : null}
        {activeSection === "Managed apps" ? <ManagedAppsSection state={state} /> : null}
      </BladeLayout>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.reviewGrid}>
      <div className="lbl">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function OverviewSection({ state, device }: { state: IntuneState; device: IntuneDevice }) {
  return (
    <div>
      <PropRow label="Device name" value={device.name} />
      <PropRow label="Compliance" value={<Pill tone={compliancePillTone(device.compliance)}>{device.compliance}</Pill>} />
      <PropRow label="Last check-in" value={new Date(device.lastCheckIn).toLocaleString()} />
      <PropRow label="Primary user" value={userLabel(state, device.primaryUser)} />
      <PropRow label="Ownership" value={device.ownership} />
      <PropRow label="Management" value={device.managedBy} />
      <PropRow label="Join type" value={device.joinType} />
      <PropRow label="Enrolled" value={new Date(device.enrollmentDate).toLocaleDateString()} />
      {device.scanResult ? (
        <PropRow
          label={`Last ${device.scanResult.type.toLowerCase()} scan`}
          value={`${device.scanResult.result} — ${new Date(device.scanResult.started).toLocaleString()}`}
        />
      ) : null}
      {device.locate ? (
        <PropRow label="Last known location" value={`${device.locate.lat.toFixed(4)}, ${device.locate.lng.toFixed(4)} — ${new Date(device.locate.when).toLocaleString()}`} />
      ) : null}
    </div>
  );
}

function PropertiesSection({ device }: { device: IntuneDevice }) {
  const rows: [string, string][] = [
    ["Device name", device.name],
    ["Platform", device.platform],
    ["OS", device.os],
    ["OS version", device.osVersion],
    ["Manufacturer", device.manufacturer],
    ["Model", device.model],
    ["Serial number", device.serial],
    ["Ownership", device.ownership],
    ["Join type", device.joinType],
    ["Managed by", device.managedBy],
    ["Compliance", device.compliance],
    ["Encryption", device.encryption],
    ["Last check-in", new Date(device.lastCheckIn).toLocaleString()],
    ["Enrollment date", new Date(device.enrollmentDate).toLocaleDateString()],
  ];
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className={styles.muted}>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HardwareSection({ device }: { device: IntuneDevice }) {
  const rows: [string, string][] = [
    ["RAM", device.ram],
    ["Storage", device.storage],
    ["CPU", device.cpu],
    ["IMEI", device.imei || "—"],
    ["Wi-Fi MAC", device.wifi],
  ];
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className={styles.muted}>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiscoveredAppsSection() {
  return <div className={styles.emptyState}>No discovered app inventory is available for this device.</div>;
}

function ComplianceSection({ state, device }: { state: IntuneState; device: IntuneDevice }) {
  const results = useMemo(() => evaluateDeviceCompliance(device, state.compliancePolicies), [device, state.compliancePolicies]);

  if (!results.length) {
    return <div className={styles.emptyState}>No compliance policies apply to this device's platform.</div>;
  }

  return (
    <div>
      {results.map((r) => (
        <div key={r.policyId} className={styles.card}>
          <div className={styles.cardTitle}>
            {r.policyName} <Pill tone={r.compliant ? "ok" : "err"}>{r.compliant ? "Compliant" : "Not compliant"}</Pill>
          </div>
          {!r.compliant ? (
            <ul>
              {r.failedSettings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : (
            <div className={styles.muted}>All policy settings satisfied.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecoverySection({ device }: { device: IntuneDevice }) {
  if (device.platform !== "Windows") {
    return <div className={styles.emptyState}>BitLocker recovery keys are only available for Windows devices.</div>;
  }
  const key = bitlockerKeyFor(device.id);

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(key).catch(() => {});
    }
    toast.success("Recovery key copied to clipboard");
  }

  return (
    <div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>BitLocker recovery key</label>
        <div className={styles.codeBlock}>{key}</div>
        <button type="button" className={styles.btnOutline} style={{ marginTop: 8 }} onClick={handleCopy}>
          Copy
        </button>
      </div>
      {device.bitlockerRotatedAt ? <div className={styles.muted}>Last rotated: {new Date(device.bitlockerRotatedAt).toLocaleString()}</div> : null}
    </div>
  );
}

function ManagedAppsSection({ state }: { state: IntuneState }) {
  const assignedApps = state.apps.filter((a) => a.assignments.length > 0);

  if (!assignedApps.length) {
    return <div className={styles.emptyState}>No apps are assigned to any group.</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>App</th>
            <th>Platform</th>
            <th>Version</th>
            <th>Assignment</th>
          </tr>
        </thead>
        <tbody>
          {assignedApps.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.platform}</td>
              <td>{a.version}</td>
              <td>
                <Pill tone="info">Potentially applicable</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
