"use client";

import { EXTENSION_CATALOG, RUN_COMMANDS } from "@/lib/labs/simulators/azure/vmData";
import type { VmExtension, VmResource } from "@/lib/labs/simulators/azure/types";
import styles from "./azure-portal.module.css";
import { Callout } from "./wizard-fields";

export function SecExtensions({
  vm,
  onAdd,
  onToggle,
  onDelete,
}: {
  vm: VmResource;
  onAdd: (extension: VmExtension) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <div className={styles.sectionCard}>
      <h3>Extensions + applications</h3>
      <p>Extensions provide post-deployment configuration and automation tasks on VMs.</p>
      <div style={{ marginBottom: 12 }}>
        <select
          className={styles.select}
          style={{ width: "auto" }}
          onChange={(e) => {
            const picked = EXTENSION_CATALOG.find((c) => c.name === e.target.value);
            if (!picked) return;
            onAdd({ ...picked, autoUpgrade: true, state: "Provisioning succeeded" });
            e.target.value = "";
          }}
          defaultValue=""
        >
          <option value="" disabled>
            + Add extension...
          </option>
          {EXTENSION_CATALOG.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.publisher}) v{c.version}
            </option>
          ))}
        </select>
      </div>
      {vm.extensions.length === 0 ? (
        <p>No extensions installed.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Publisher</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vm.extensions.map((e, i) => (
              <tr key={i}>
                <td>{e.name}</td>
                <td>{e.publisher}</td>
                <td>
                  <span className={`${styles.badge} ${e.state === "Provisioning succeeded" ? styles.badgeRunning : styles.badgeOutline}`}>
                    {e.state}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={styles.link} onClick={() => onToggle(i)}>
                      {e.state === "Provisioning succeeded" ? "Disable" : "Enable"}
                    </button>
                    <button type="button" className={styles.link} onClick={() => onDelete(i)}>
                      Uninstall
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SecBootDiag({ vm, onToggle }: { vm: VmResource; onToggle: (enabled: boolean) => void }) {
  const diag = vm.bootDiag;
  return (
    <div className={styles.sectionCard}>
      <h3>Boot diagnostics</h3>
      <p>Capture screenshot and serial console output to diagnose boot failures.</p>
      <label className={styles.checkboxRow} style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={diag.enabled} onChange={(e) => onToggle(e.target.checked)} />
        Enabled
      </label>
      <p>Storage: {diag.storage} (Microsoft-managed)</p>
      <p>Latest screenshot: {diag.screenshot}</p>
      <p>Serial log: {diag.serialLog}</p>
    </div>
  );
}

export function SecAutoShutdown({ vm }: { vm: VmResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Auto-shutdown</h3>
      <p>
        Status:{" "}
        <span className={`${styles.badge} ${vm.enableAutoShutdown ? styles.badgeRunning : styles.badgeStopped}`}>
          {vm.enableAutoShutdown ? "On" : "Off"}
        </span>
      </p>
      <p>Time: {vm.autoShutdownTime || "—"} · Time zone: UTC</p>
    </div>
  );
}

export function SecBackup({ vm }: { vm: VmResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Backup</h3>
      {vm.enableBackup ? (
        <>
          <p>Recovery Services vault: rsv-default</p>
          <p>Backup policy: DailyPolicy — daily at 2:00 AM, 30-day retention.</p>
        </>
      ) : (
        <p>Backup is not configured.</p>
      )}
    </div>
  );
}

export function SecUpdates() {
  return (
    <div className={styles.sectionCard}>
      <h3>Updates</h3>
      <p>Patch orchestration: Image default</p>
      <p>Pending updates: 0</p>
      <p>Last assessment: Today, 03:00 AM</p>
    </div>
  );
}

export function SecRunCommand({ vm }: { vm: VmResource }) {
  const cmds = RUN_COMMANDS.filter((c) => c.os === vm.os);
  return (
    <div className={styles.sectionCard}>
      <h3>Run command</h3>
      <p>Execute administrative scripts on the VM without using RDP/SSH.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Command</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {cmds.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecResetPassword() {
  return (
    <div className={styles.sectionCard}>
      <h3>Reset password</h3>
      <p>Reset the local administrator password or SSH public key without rebooting.</p>
      <Callout tone="info">
        Complexity: 12-72 chars, must include 3 of: uppercase, lowercase, digit, special.
      </Callout>
    </div>
  );
}

export function SecPolicies({ vm }: { vm: VmResource }) {
  const nonCompliant = vm.policyCompliance.filter((p) => p.compliance === "Non-compliant").length;
  return (
    <div className={styles.sectionCard}>
      <h3>Policies — assigned to this VM</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13 }}>
        <span>Total: {vm.policyCompliance.length}</span>
        <span style={{ color: "#0078d4" }}>Compliant: {vm.policyCompliance.length - nonCompliant}</span>
        <span style={{ color: "#a4262c" }}>Non-compliant: {nonCompliant}</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Policy</th>
            <th>Category</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {vm.policyCompliance.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.category}</td>
              <td>
                <span style={{ color: p.compliance === "Compliant" ? "#0e700e" : "#a4262c", fontWeight: 600 }}>
                  {p.compliance}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
