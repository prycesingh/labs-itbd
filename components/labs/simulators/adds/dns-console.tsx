"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsDnsRecord, AddsDnsRecordType, AddsDnsZone, AddsState } from "@/lib/labs/simulators/adds/types";
import { AddsContextMenu, type ContextMenuItem } from "./adds-context-menu";
import { AddsDialog, CheckboxRow, EmptyPane, FormRow, HelpText } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, TabbedPanel, type TreeNode } from "./mmc-console";
import styles from "./adds-console.module.css";

type Dialog =
  | { kind: "new-zone" }
  | { kind: "new-record"; zoneName: string; presetType?: AddsDnsRecordType }
  | { kind: "edit-record"; zoneName: string; index: number }
  | { kind: "zone-properties"; zoneName: string };

const RECORD_TYPE_CLASS: Record<AddsDnsRecordType, string> = {
  SOA: styles.rtSOA,
  NS: styles.rtNS,
  A: styles.rtA,
  AAAA: styles.rtAAAA,
  CNAME: styles.rtCNAME,
  MX: styles.rtMX,
  PTR: styles.rtPTR,
  SRV: styles.rtSRV,
  TXT: styles.rtTXT,
};

function soaRecord(state: AddsState): AddsDnsRecord {
  return {
    name: "@",
    type: "SOA",
    data: `dc01.${state.domain.fqdn}. hostmaster.${state.domain.fqdn}. (1 900 600 86400 3600)`,
    timestamp: "static",
  };
}

function nsRecord(state: AddsState): AddsDnsRecord {
  return { name: "@", type: "NS", data: `dc01.${state.domain.fqdn}.`, timestamp: "static" };
}

function reverseZoneNameFor(ip: string): string {
  const octets = ip.split(".");
  return `${octets[2]}.${octets[1]}.${octets[0]}.in-addr.arpa`;
}

export function DnsConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [selectedNode, setSelectedNode] = useState("srv:DC01");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "srv:DC01": true, fz: true, rz: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const forwardZones = state.dnsZones.filter((z) => z.direction === "Forward");
  const reverseZones = state.dnsZones.filter((z) => z.direction === "Reverse");

  const treeRoot: TreeNode = {
    id: "dnsroot",
    icon: "D",
    label: "DNS",
    children: [
      {
        id: "srv:DC01",
        icon: "S",
        label: "DC01",
        children: [
          { id: "fz", icon: "F", label: "Forward Lookup Zones", children: forwardZones.map((z) => ({ id: `zone:${z.name}`, icon: "z", label: z.name })) },
          { id: "rz", icon: "R", label: "Reverse Lookup Zones", children: reverseZones.map((z) => ({ id: `zone:${z.name}`, icon: "z", label: z.name })) },
          { id: "trust", icon: "T", label: "Trust Points" },
          { id: "cfwd", icon: "C", label: "Conditional Forwarders" },
        ],
      },
    ],
  };

  function headingFor(node: string): string {
    if (node === "dnsroot") return "DNS";
    if (node === "srv:DC01") return "DC01 - DNS Server";
    if (node === "fz") return "Forward Lookup Zones";
    if (node === "rz") return "Reverse Lookup Zones";
    if (node === "trust") return "Trust Points";
    if (node === "cfwd") return "Conditional Forwarders";
    if (node.startsWith("zone:")) return node.slice(5);
    return "";
  }

  function deleteZone(name: string) {
    if (!confirm(`Delete zone "${name}"?`)) return;
    dispatch({ type: "DELETE_ZONE", name });
    toast.success(`Deleted zone ${name}`);
    setSelectedNode("fz");
  }

  function deleteRecord(zoneName: string, index: number) {
    const zone = state.dnsZones.find((z) => z.name === zoneName);
    const record = zone?.records[index];
    if (!confirm("Delete this resource record?")) return;
    dispatch({ type: "DELETE_RECORD", zoneName, index });
    toast.success(record ? `${record.type} record deleted` : "Record deleted");
  }

  function showTreeContextMenu(e: React.MouseEvent, nodeId: string) {
    const items: ContextMenuItem[] = [];
    if (nodeId === "fz" || nodeId === "rz" || nodeId === "srv:DC01") {
      items.push({ key: "nz", label: "New Zone...", onClick: () => setDialog({ kind: "new-zone" }) });
    }
    if (nodeId === "srv:DC01") {
      items.push({ key: "np", label: "Properties", onClick: () => toast.info("Server properties are not modeled in this lab.") });
      items.push({ key: "sc", label: "Set Aging/Scavenging...", onClick: () => toast.info("Aging/Scavenging is not modeled in this lab.") });
    }
    if (nodeId === "cfwd") {
      items.push({ key: "cf", label: "New Conditional Forwarder...", onClick: () => toast.info("Conditional forwarders are not modeled in this lab.") });
    }
    if (nodeId.startsWith("zone:")) {
      const zoneName = nodeId.slice(5);
      items.push(...zoneMenuItems(zoneName));
    }
    if (items.length) AddsContextMenu.show(e.clientX, e.clientY, items);
  }

  function zoneMenuItems(zoneName: string): ContextMenuItem[] {
    return [
      { key: "na", label: "New Host (A or AAAA)...", onClick: () => setDialog({ kind: "new-record", zoneName, presetType: "A" }) },
      { key: "nc", label: "New Alias (CNAME)...", onClick: () => setDialog({ kind: "new-record", zoneName, presetType: "CNAME" }) },
      { key: "nm", label: "New Mail Exchanger (MX)...", onClick: () => setDialog({ kind: "new-record", zoneName, presetType: "MX" }) },
      { key: "nt", label: "Other New Records...", onClick: () => setDialog({ kind: "new-record", zoneName }) },
      "-",
      { key: "rl", label: "Reload", onClick: () => toast.success("Zone reloaded") },
      { key: "pr", label: "Properties", onClick: () => setDialog({ kind: "zone-properties", zoneName }) },
      "-",
      { key: "del", label: "Delete", onClick: () => deleteZone(zoneName) },
    ];
  }

  function showZoneRowContextMenu(e: React.MouseEvent, zoneName: string) {
    AddsContextMenu.show(e.clientX, e.clientY, zoneMenuItems(zoneName));
  }

  function showRecordContextMenu(e: React.MouseEvent, zoneName: string, index: number) {
    AddsContextMenu.show(e.clientX, e.clientY, [
      { key: "edit", label: "Properties", onClick: () => setDialog({ kind: "edit-record", zoneName, index }) },
      { key: "del", label: "Delete", onClick: () => deleteRecord(zoneName, index) },
    ]);
  }

  function showRecordsEmptyAreaContextMenu(e: React.MouseEvent, zoneName: string) {
    AddsContextMenu.show(e.clientX, e.clientY, [
      { key: "na", label: "New Host (A or AAAA)...", onClick: () => setDialog({ kind: "new-record", zoneName, presetType: "A" }) },
      { key: "nc", label: "New Alias (CNAME)...", onClick: () => setDialog({ kind: "new-record", zoneName, presetType: "CNAME" }) },
      { key: "nm", label: "New Mail Exchanger (MX)...", onClick: () => setDialog({ kind: "new-record", zoneName, presetType: "MX" }) },
      { key: "nt", label: "Other New Records...", onClick: () => setDialog({ kind: "new-record", zoneName }) },
    ]);
  }

  function renderServerPane() {
    const dc = state.domainControllers[0];
    return (
      <ContentBody>
        <p style={{ marginBottom: 8 }}>
          DNS Server <b>{dc?.name}</b> on {dc?.ip}
        </p>
        <table className={styles.dashTable}>
          <tbody>
            <tr><th style={{ width: "40%" }}>Server name</th><td>{dc?.name}.{state.domain.fqdn}</td></tr>
            <tr><th>IP address</th><td>{dc?.ip}</td></tr>
            <tr><th>Recursion</th><td>Enabled</td></tr>
            <tr><th>Scavenging</th><td>Enabled - 7 days</td></tr>
            <tr><th>Listening on</th><td>All IP addresses</td></tr>
            <tr><th>Forwarders</th><td>8.8.8.8, 1.1.1.1</td></tr>
            <tr><th>Forward zones</th><td>{forwardZones.length}</td></tr>
            <tr><th>Reverse zones</th><td>{reverseZones.length}</td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-zone" })}>
            New Zone...
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderZonesList(direction: "Forward" | "Reverse") {
    const zones = direction === "Forward" ? forwardZones : reverseZones;
    return (
      <ContentBody>
        <ItemListTable columns={["Name", "Type", "Status", "DNSSEC Status"]}>
          {zones.map((z) => (
            <tr
              key={z.name}
              onDoubleClick={() => setSelectedNode(`zone:${z.name}`)}
              onContextMenu={(e) => {
                e.preventDefault();
                showZoneRowContextMenu(e, z.name);
              }}
            >
              <td>
                <span className={styles.itmIcon}>z</span>
                {z.name}
              </td>
              <td>{z.adIntegrated ? "Active Directory-Integrated" : z.type}</td>
              <td>Running</td>
              <td>Not Signed</td>
            </tr>
          ))}
        </ItemListTable>
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-zone" })}>
            New Zone...
          </button>
        </div>
      </ContentBody>
    );
  }

  function renderZoneRecords(zoneName: string) {
    const zone = state.dnsZones.find((z) => z.name === zoneName);
    if (!zone) return <EmptyPane>Zone not found.</EmptyPane>;
    return (
      <ContentBody onContextMenu={(e) => showRecordsEmptyAreaContextMenu(e, zoneName)}>
        <ItemListTable columns={["Name", "Type", "Data", "Timestamp"]}>
          {zone.records.map((r, i) => (
            <tr
              key={`${r.type}-${r.name}-${i}`}
              className={selectedRow === i ? styles.itemListRowSelected : ""}
              onClick={() => setSelectedRow(i)}
              onDoubleClick={() => setDialog({ kind: "edit-record", zoneName, index: i })}
              onContextMenu={(e) => {
                e.preventDefault();
                setSelectedRow(i);
                showRecordContextMenu(e, zoneName, i);
              }}
            >
              <td>
                <span className={styles.itmIcon}>{r.type.charAt(0)}</span>
                {r.name}
              </td>
              <td className={RECORD_TYPE_CLASS[r.type]}>{r.type}</td>
              <td>{r.data}</td>
              <td>{r.timestamp || "static"}</td>
            </tr>
          ))}
        </ItemListTable>
        <div style={{ marginTop: 10 }}>
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-record", zoneName })}>
            New Record...
          </button>{" "}
          <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "zone-properties", zoneName })}>
            Zone Properties...
          </button>
        </div>
      </ContentBody>
    );
  }

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={treeRoot}
          selected={selectedNode}
          expanded={expanded}
          onSelect={setSelectedNode}
          onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
          onContextMenu={showTreeContextMenu}
        />
      }
      content={
        <>
          <ContentHeading>{headingFor(selectedNode)}</ContentHeading>
          {selectedNode === "srv:DC01" ? (
            renderServerPane()
          ) : selectedNode === "fz" ? (
            renderZonesList("Forward")
          ) : selectedNode === "rz" ? (
            renderZonesList("Reverse")
          ) : selectedNode === "trust" ? (
            <EmptyPane>No trust points are configured.</EmptyPane>
          ) : selectedNode === "cfwd" ? (
            <EmptyPane>
              No conditional forwarders configured.
              <br />
              <br />
              Right-click <b>Conditional Forwarders</b> to add a new conditional forwarder.
            </EmptyPane>
          ) : selectedNode.startsWith("zone:") ? (
            renderZoneRecords(selectedNode.slice(5))
          ) : (
            <EmptyPane>Select a node.</EmptyPane>
          )}
        </>
      }
      dialogs={
        <DnsDialogs
          dialog={dialog}
          state={state}
          dispatch={dispatch}
          onClose={() => setDialog(null)}
          onSelectZone={setSelectedNode}
        />
      }
    />
  );
}

function DnsDialogs({
  dialog,
  state,
  dispatch,
  onClose,
  onSelectZone,
}: {
  dialog: Dialog | null;
  state: AddsState;
  dispatch: (action: AddsAction) => void;
  onClose: () => void;
  onSelectZone: (nodeId: string) => void;
}) {
  if (!dialog) return null;

  if (dialog.kind === "new-zone") return <NewZoneWizard state={state} dispatch={dispatch} onClose={onClose} onCreated={(name) => onSelectZone(`zone:${name}`)} />;
  if (dialog.kind === "new-record") return <NewRecordDialog zoneName={dialog.zoneName} presetType={dialog.presetType} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "edit-record") return <EditRecordDialog zoneName={dialog.zoneName} index={dialog.index} state={state} dispatch={dispatch} onClose={onClose} />;
  if (dialog.kind === "zone-properties") return <ZonePropertiesDialog zoneName={dialog.zoneName} state={state} dispatch={dispatch} onClose={onClose} />;
  return null;
}

function NewZoneWizard({
  state,
  dispatch,
  onClose,
  onCreated,
}: {
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<AddsDnsZone["type"]>("Primary");
  const [adIntegrated, setAdIntegrated] = useState(true);
  const [replication, setReplication] = useState("To all DNS servers running on domain controllers in this domain");
  const [direction, setDirection] = useState<AddsDnsZone["direction"]>("Forward");
  const [zoneName, setZoneName] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [updates, setUpdates] = useState<AddsDnsZone["dynamicUpdates"]>("Secure only");

  const steps = ["1. Zone Type", "2. Direction", "3. Name", "4. Updates", "5. Confirm"];

  function resolvedName(): string {
    if (direction === "Forward") return zoneName.trim();
    const parts = networkId.trim().split(".").filter(Boolean);
    return `${parts.slice().reverse().join(".")}.in-addr.arpa`;
  }

  return (
    <AddsDialog
      title="New Zone Wizard"
      width="600px"
      onClose={onClose}
      buttons={[
        { label: "< Back", onClick: () => { if (step > 1) setStep(step - 1); return false; } },
        ...(step < 5
          ? [
              {
                label: "Next >",
                primary: true,
                onClick: () => {
                  if (step === 3) {
                    const name = resolvedName();
                    if (!name || name === ".in-addr.arpa") { alert(direction === "Forward" ? "Zone name is required." : "Network ID is required."); return false; }
                    if (state.dnsZones.some((z) => z.name === name)) { alert("A zone with that name already exists."); return false; }
                  }
                  setStep(step + 1);
                  return false;
                },
              },
            ]
          : [
              {
                label: "Finish",
                primary: true,
                onClick: () => {
                  const name = resolvedName();
                  if (state.dnsZones.some((z) => z.name === name)) { alert("A zone with that name already exists."); return false; }
                  const zone: AddsDnsZone = {
                    name,
                    type: kind,
                    direction,
                    adIntegrated,
                    replicationScope: replication,
                    dynamicUpdates: updates,
                    records: [soaRecord(state), nsRecord(state)],
                  };
                  dispatch({ type: "ADD_ZONE", zone });
                  toast.success(`Zone created: ${name}`);
                  onCreated(name);
                  return true;
                },
              },
            ]),
        { label: "Cancel" },
      ]}
    >
      <div className={styles.wizSteps}>
        {steps.map((s, i) => (
          <span key={s} className={i + 1 === step ? styles.wizStepActive : i + 1 < step ? styles.wizStepDone : styles.wizStep}>
            {s}
          </span>
        ))}
      </div>
      {step === 1 ? (
        <div style={{ padding: 14 }}>
          <p style={{ marginBottom: 6 }}>Select the type of zone you want to create:</p>
          <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            {(["Primary", "Secondary", "Stub"] as const).map((k) => (
              <label key={k}>
                <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {k} zone
              </label>
            ))}
          </div>
          <CheckboxRow
            id="zAdI"
            label="Store the zone in Active Directory (available only if DNS server is a writeable domain controller)"
            checked={adIntegrated}
            onChange={setAdIntegrated}
          />
          <FormRow label="Replication scope">
            <select value={replication} onChange={(e) => setReplication(e.target.value)}>
              <option>To all DNS servers running on domain controllers in this forest</option>
              <option>To all DNS servers running on domain controllers in this domain</option>
              <option>To all domain controllers in this domain (Windows 2000 compatibility)</option>
            </select>
          </FormRow>
        </div>
      ) : null}
      {step === 2 ? (
        <div style={{ padding: 14 }}>
          <p>Select whether you want to create a forward lookup zone or a reverse lookup zone.</p>
          <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <label>
              <input type="radio" checked={direction === "Forward"} onChange={() => setDirection("Forward")} /> Forward lookup zone
            </label>
            <label>
              <input type="radio" checked={direction === "Reverse"} onChange={() => setDirection("Reverse")} /> Reverse lookup zone
            </label>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div style={{ padding: 14 }}>
          {direction === "Forward" ? (
            <FormRow label="Zone name">
              <input type="text" value={zoneName} placeholder="e.g. corp.example.local" onChange={(e) => setZoneName(e.target.value)} />
            </FormRow>
          ) : (
            <FormRow label="Network ID (e.g. 192.168.1)">
              <input type="text" value={networkId} placeholder="192.168.1" onChange={(e) => setNetworkId(e.target.value)} />
            </FormRow>
          )}
        </div>
      ) : null}
      {step === 4 ? (
        <div style={{ padding: 14 }}>
          <p>Select the type of dynamic updates you want to allow:</p>
          <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <label>
              <input type="radio" checked={updates === "Secure only"} onChange={() => setUpdates("Secure only")} /> Allow only secure dynamic updates (recommended for Active Directory)
            </label>
            <label>
              <input type="radio" checked={updates === "Secure and nonsecure"} onChange={() => setUpdates("Secure and nonsecure")} /> Allow both nonsecure and secure dynamic updates
            </label>
            <label>
              <input type="radio" checked={updates === "None"} onChange={() => setUpdates("None")} /> Do not allow dynamic updates
            </label>
          </div>
        </div>
      ) : null}
      {step === 5 ? (
        <div style={{ padding: 14 }}>
          <p>You have specified the following settings:</p>
          <table className={styles.dashTable} style={{ marginTop: 8 }}>
            <tbody>
              <tr><th>Zone type</th><td>{kind}{adIntegrated ? " (AD-Integrated)" : ""}</td></tr>
              <tr><th>Replication</th><td>{replication}</td></tr>
              <tr><th>Direction</th><td>{direction}</td></tr>
              <tr><th>Name</th><td>{resolvedName()}</td></tr>
              <tr><th>Dynamic updates</th><td>{updates}</td></tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </AddsDialog>
  );
}

function NewRecordDialog({
  zoneName,
  presetType,
  state,
  dispatch,
  onClose,
}: {
  zoneName: string;
  presetType?: AddsDnsRecordType;
  state: AddsState;
  dispatch: (a: AddsAction) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<AddsDnsRecordType>(presetType ?? "A");
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [data, setData] = useState("");
  const [priority, setPriority] = useState(10);
  const [weight, setWeight] = useState(100);
  const [port, setPort] = useState(389);
  const [svc, setSvc] = useState("_ldap");
  const [proto, setProto] = useState("_tcp");
  const [host, setHost] = useState("");
  const [text, setText] = useState("");
  const [createPtr, setCreatePtr] = useState(false);

  const recordTypes: AddsDnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "PTR", "SRV", "TXT"];

  return (
    <AddsDialog
      title="New Resource Record"
      width="520px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            let record: AddsDnsRecord | null = null;
            if (type === "A" || type === "AAAA") {
              if (!ip.trim()) { alert(type === "A" ? "IP address is required." : "IPv6 address is required."); return false; }
              record = { name: name.trim() || "@", type, data: ip.trim(), timestamp: new Date().toISOString() };
            } else if (type === "CNAME") {
              if (!name.trim() || !data.trim()) { alert("Alias and target are required."); return false; }
              record = { name: name.trim(), type, data: data.trim(), timestamp: new Date().toISOString() };
            } else if (type === "MX") {
              record = { name: name.trim() || "@", type, data: `${priority} ${data.trim()}`, timestamp: new Date().toISOString() };
            } else if (type === "PTR") {
              if (!name.trim() || !data.trim()) { alert("IP and host name are required."); return false; }
              record = { name: name.trim(), type, data: data.trim(), timestamp: new Date().toISOString() };
            } else if (type === "SRV") {
              record = { name: `${svc.trim()}.${proto.trim()}`, type, data: `${priority} ${weight} ${port} ${host.trim()}`, timestamp: new Date().toISOString() };
            } else if (type === "TXT") {
              record = { name: name.trim() || "@", type, data: text, timestamp: new Date().toISOString() };
            }
            if (!record) return false;

            dispatch({ type: "ADD_RECORD", zoneName, record });

            if (type === "A" && createPtr) {
              const octets = record.data.split(".");
              if (octets.length === 4) {
                const revZoneName = reverseZoneNameFor(record.data);
                const revZone = state.dnsZones.find((z) => z.name === revZoneName);
                if (revZone) {
                  dispatch({
                    type: "ADD_RECORD",
                    zoneName: revZoneName,
                    record: { name: octets[3], type: "PTR", data: `${record.name}.${zoneName}.`, timestamp: new Date().toISOString() },
                  });
                } else {
                  toast.info(`Reverse zone ${revZoneName} not found - PTR not created.`);
                }
              }
            }
            toast.success(`${type} record added`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Type">
        <select value={type} onChange={(e) => setType(e.target.value as AddsDnsRecordType)}>
          {recordTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormRow>

      {type === "A" ? (
        <>
          <FormRow label="Name (uses parent domain if blank)">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="FQDN">
            <span style={{ color: "#555" }}>{`${name || "@"}.${zoneName}`}</span>
          </FormRow>
          <FormRow label="IP address">
            <input type="text" value={ip} placeholder="192.168.1.50" onChange={(e) => setIp(e.target.value)} />
          </FormRow>
          <CheckboxRow id="rcPtr" label="Create associated pointer (PTR) record" checked={createPtr} onChange={setCreatePtr} />
        </>
      ) : null}

      {type === "AAAA" ? (
        <>
          <FormRow label="Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="IPv6 address">
            <input type="text" value={ip} placeholder="fe80::1" onChange={(e) => setIp(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {type === "CNAME" ? (
        <>
          <FormRow label="Alias name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="FQDN for target host">
            <input type="text" value={data} placeholder="host.corp.cloudlab.local" onChange={(e) => setData(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {type === "MX" ? (
        <>
          <FormRow label="Host or child domain">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Priority">
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Mail server">
            <input type="text" value={data} placeholder="mail.corp.cloudlab.local" onChange={(e) => setData(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {type === "PTR" ? (
        <>
          <FormRow label="Host IP (last octet)">
            <input type="text" value={name} placeholder="50" onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Host name">
            <input type="text" value={data} placeholder="host.corp.cloudlab.local" onChange={(e) => setData(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {type === "SRV" ? (
        <>
          <FormRow label="Service">
            <input type="text" value={svc} placeholder="_ldap" onChange={(e) => setSvc(e.target.value)} />
          </FormRow>
          <FormRow label="Protocol">
            <input type="text" value={proto} placeholder="_tcp" onChange={(e) => setProto(e.target.value)} />
          </FormRow>
          <FormRow label="Priority">
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Weight">
            <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Port number">
            <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
          </FormRow>
          <FormRow label="Host offering this service">
            <input type="text" value={host} placeholder="dc01.corp.cloudlab.local" onChange={(e) => setHost(e.target.value)} />
          </FormRow>
        </>
      ) : null}

      {type === "TXT" ? (
        <>
          <FormRow label="Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Text">
            <textarea value={text} placeholder='"v=spf1 -all"' onChange={(e) => setText(e.target.value)} />
          </FormRow>
        </>
      ) : null}
    </AddsDialog>
  );
}

function EditRecordDialog({ zoneName, index, state, dispatch, onClose }: { zoneName: string; index: number; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const zone = state.dnsZones.find((z) => z.name === zoneName);
  const record = zone?.records[index];
  const [name, setName] = useState(record?.name ?? "");
  const [data, setData] = useState(record?.data ?? "");
  if (!record) return null;

  return (
    <AddsDialog
      title={`${record.type} Record Properties`}
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "UPDATE_RECORD", zoneName, index, patch: { name: name.trim(), data: data.trim() } });
            toast.success("Record updated");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Type">
        <input type="text" value={record.type} readOnly style={{ background: "#eee" }} />
      </FormRow>
      <FormRow label="Data">
        <input type="text" value={data} onChange={(e) => setData(e.target.value)} />
      </FormRow>
    </AddsDialog>
  );
}

function ZonePropertiesDialog({ zoneName, state, dispatch, onClose }: { zoneName: string; state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const zone = state.dnsZones.find((z) => z.name === zoneName);
  const [activeTab, setActiveTab] = useState("General");
  const [dynamicUpdates, setDynamicUpdates] = useState<AddsDnsZone["dynamicUpdates"]>(zone?.dynamicUpdates ?? "Secure only");
  if (!zone) return null;

  const tabs = ["General", "Start of Authority (SOA)", "Name Servers", "Zone Transfers"];
  const soa = zone.records.find((r) => r.type === "SOA");
  const nsRecords = zone.records.filter((r) => r.type === "NS");

  return (
    <AddsDialog
      title={`${zoneName} Properties`}
      width="560px"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            dispatch({ type: "UPDATE_ZONE", name: zoneName, patch: { dynamicUpdates } });
            toast.success("Zone properties saved");
            return true;
          },
        },
        { label: "Cancel" },
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
                <FormRow label="Status">
                  <input type="text" value="Running" readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Type">
                  <input type="text" value={zone.adIntegrated ? `${zone.type} (AD-Integrated)` : zone.type} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Replication">
                  <input type="text" value={zone.replicationScope} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Dynamic updates">
                  <select value={dynamicUpdates} onChange={(e) => setDynamicUpdates(e.target.value as AddsDnsZone["dynamicUpdates"])}>
                    <option>Secure only</option>
                    <option>Secure and nonsecure</option>
                    <option>None</option>
                  </select>
                </FormRow>
                <HelpText>To set aging/scavenging properties for this server, use Set Aging/Scavenging... on DC01.</HelpText>
              </>
            );
          if (tab === "Start of Authority (SOA)")
            return (
              <>
                <FormRow label="Serial number">
                  <input type="text" value="1" readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Primary server">
                  <input type="text" value={`dc01.${state.domain.fqdn}.`} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Responsible person">
                  <input type="text" value={`hostmaster.${state.domain.fqdn}.`} readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Refresh interval">
                  <input type="text" value="900" readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Retry interval">
                  <input type="text" value="600" readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Expires after">
                  <input type="text" value="86400" readOnly style={{ background: "#eee" }} />
                </FormRow>
                <FormRow label="Minimum (default) TTL">
                  <input type="text" value="3600" readOnly style={{ background: "#eee" }} />
                </FormRow>
                <HelpText>{soa ? soa.data : "(no SOA)"}</HelpText>
              </>
            );
          if (tab === "Name Servers")
            return (
              <>
                <p>Name servers:</p>
                <table className={styles.policyTable} style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>Server fully qualified domain name</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nsRecords.map((r, i) => (
                      <tr key={i}>
                        <td>{r.data}</td>
                        <td>[192.168.1.10]</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          if (tab === "Zone Transfers")
            return (
              <>
                <CheckboxRow id="ztAllow" label="Allow zone transfers" checked onChange={() => {}} />
                <div className={styles.checkboxRow} style={{ flexDirection: "column", alignItems: "flex-start", marginLeft: 24 }}>
                  <label>
                    <input type="radio" name="ztAllow" defaultChecked /> To any server
                  </label>
                  <label>
                    <input type="radio" name="ztAllow" /> Only to servers listed on the Name Servers tab
                  </label>
                  <label>
                    <input type="radio" name="ztAllow" /> Only to the following servers
                  </label>
                </div>
              </>
            );
          return <EmptyPane>Not configured in this lab.</EmptyPane>;
        }}
      />
    </AddsDialog>
  );
}
