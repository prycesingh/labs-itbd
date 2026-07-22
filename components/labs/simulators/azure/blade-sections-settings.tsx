"use client";

import { DISK_TYPES, VM_SIZES } from "@/lib/labs/simulators/azure/vmData";
import type { VmResource } from "@/lib/labs/simulators/azure/types";
import styles from "./azure-portal.module.css";
import { PropPair } from "./wizard-fields";

export function SecNetworking({ vm }: { vm: VmResource }) {
  const ports = vm.inboundPorts;
  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Network interface: {vm.name}-nic</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Private IP" value={vm.privateIp} />
          <PropPair label="Public IP" value={vm.publicIpAddress} />
          <PropPair label="Virtual network" value={vm.virtualNetwork} />
          <PropPair label="Subnet" value={vm.subnet} />
          <PropPair label="NSG" value={`${vm.name}-nsg (${vm.nicNsg})`} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Inbound port rules</h3>
        {ports.length === 0 ? (
          <p>No inbound rules defined.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Port</th>
                <th>Protocol</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p, i) => (
                <tr key={p}>
                  <td>{100 + i * 10}</td>
                  <td>{p.match(/\d+/)?.[0]}</td>
                  <td>TCP</td>
                  <td>Allow</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function SecConnect({ vm }: { vm: VmResource }) {
  const isLinux = vm.os === "Linux";
  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Connect via {isLinux ? "SSH" : "RDP"}</h3>
        {isLinux ? (
          <>
            <p>Use the following command from a terminal:</p>
            <div
              style={{
                background: "#1e1e1e",
                color: "#d4d4d4",
                padding: 12,
                borderRadius: 2,
                fontFamily: "Consolas, monospace",
                fontSize: 13,
              }}
            >
              ssh -i ~/.ssh/{vm.name}_key.pem {vm.username}@{vm.publicIpAddress ?? "PUBLIC_IP"}
            </div>
          </>
        ) : (
          <p>
            IP address: {vm.publicIpAddress ?? "—"} · Port: 3389
          </p>
        )}
      </div>
      <div className={styles.sectionCard}>
        <h3>Need a deeper integration?</h3>
        <p>Use Azure Bastion to connect securely without exposing public IPs.</p>
      </div>
    </>
  );
}

export function SecDisks({ vm }: { vm: VmResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Disks</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>LUN</th>
            <th>Name</th>
            <th>Storage type</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>OS disk</td>
            <td>{vm.name}_OsDisk</td>
            <td>{DISK_TYPES.find((d) => d.id === vm.osDiskType)?.label ?? "Premium SSD"}</td>
            <td>127 GiB</td>
          </tr>
          {vm.dataDisks.map((d, i) => (
            <tr key={i}>
              <td>{i + 2}</td>
              <td>{d.name}</td>
              <td>{d.type}</td>
              <td>{d.sizeGiB} GiB</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecSize({ vm, onResize }: { vm: VmResource; onResize: (size: string) => void }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Change size — current: {vm.size}</h3>
      <p>Click a size to resize the VM. The VM will be deallocated and restarted.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>VM Size</th>
            <th>Family</th>
            <th>vCPUs</th>
            <th>RAM</th>
            <th>Cost/mo</th>
          </tr>
        </thead>
        <tbody>
          {VM_SIZES.map((s) => (
            <tr
              key={s.name}
              onClick={() => onResize(s.name)}
              style={{ cursor: "pointer", background: s.name === vm.size ? "#deecf9" : undefined }}
            >
              <td>{s.name}</td>
              <td>{s.family}</td>
              <td>{s.vcpus}</td>
              <td>{s.ram} GiB</td>
              <td>${s.cost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecIdentity({ vm }: { vm: VmResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>System assigned managed identity</h3>
      <p>Restricted to one per resource and tied to the lifecycle of this resource.</p>
      <p style={{ fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Object (principal) ID:</span> {vm.id}
      </p>
      <p>This managed identity has no role assignments.</p>
    </div>
  );
}
