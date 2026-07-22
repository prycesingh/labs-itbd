"use client";

import { useMemo, useState } from "react";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable, MmcLayout, MmcTreeNode, type TreeNode } from "./mmc-console";
import styles from "./adds-console.module.css";

type EventLevel = "Information" | "Warning" | "Error" | "Critical";
type EventEntry = { level: EventLevel; time: string; source: string; id: number; task: string; log: string; message: string };

const EVENTS: EventEntry[] = [
  { level: "Information", time: "2025-05-14 06:55:01", source: "NTDS General", id: 1000, task: "Directory Service Startup", log: "Directory Service", message: "Active Directory Domain Services startup complete." },
  { level: "Warning", time: "2025-05-13 22:10:04", source: "NTDS Replication", id: 1864, task: "Replication", log: "Directory Service", message: "Replication latency for one or more partners has exceeded the warning interval (4 hours)." },
  { level: "Error", time: "2025-05-12 03:41:19", source: "NTDS KCC", id: 1311, task: "Knowledge Consistency Checker", log: "Directory Service", message: "The KCC was unable to form a complete spanning tree network topology." },
  { level: "Information", time: "2025-05-14 07:00:00", source: "DNS-Server-Service", id: 2, task: "Service", log: "DNS Server", message: "The DNS server has started." },
  { level: "Critical", time: "2025-05-10 14:02:55", source: "DNS-Server-Service", id: 4521, task: "Service", log: "DNS Server", message: "The DNS server has lost the ability to start; Active Directory is not available." },
  { level: "Information", time: "2025-05-14 09:00:12", source: "Security-Auditing", id: 4624, task: "Logon", log: "Security", message: "An account was successfully logged on." },
  { level: "Warning", time: "2025-05-13 18:31:47", source: "Security-Auditing", id: 4625, task: "Logon", log: "Security", message: "An account failed to log on. Bad password or unknown user name." },
  { level: "Information", time: "2025-05-14 08:00:00", source: "Security-Auditing", id: 4768, task: "Kerberos Authentication", log: "Security", message: "A Kerberos authentication ticket (TGT) was requested." },
  { level: "Error", time: "2025-05-09 11:15:33", source: "NETLOGON", id: 5774, task: "None", log: "System", message: "Dynamic registration of the DNS record '_ldap._tcp.dc._msdcs' failed." },
  { level: "Information", time: "2025-05-14 07:00:00", source: "DFSR", id: 5002, task: "Initial Sync", log: "DFS Replication", message: "The DFS Replication service completed initial replication for SYSVOL." },
  { level: "Warning", time: "2025-05-11 09:22:00", source: "Print Spooler", id: 372, task: "None", log: "Application", message: "The print spooler failed to load a plugin module." },
  { level: "Information", time: "2025-05-08 06:00:00", source: "MSI Installer", id: 1035, task: "None", log: "Setup", message: "Windows update package installed successfully." },
];

const LOGS = ["Application", "Security", "Setup", "System", "Directory Service", "DNS Server", "DFS Replication"];

export function EventViewerConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [selectedLog, setSelectedLog] = useState<string>("Directory Service");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true, logs: true });
  const [filter, setFilter] = useState("");

  const treeRoot: TreeNode = {
    id: "root",
    icon: "EV",
    label: "Event Viewer (Local)",
    children: [
      {
        id: "logs",
        icon: "L",
        label: "Windows Logs",
        children: LOGS.map((l) => ({ id: `log:${l}`, icon: "L", label: l })),
      },
    ],
  };

  const rows = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return EVENTS.filter((e) => e.log === selectedLog).filter(
      (e) => !q || e.message.toLowerCase().includes(q) || e.source.toLowerCase().includes(q) || String(e.id).includes(q),
    );
  }, [selectedLog, filter]);

  return (
    <MmcLayout
      tree={
        <MmcTreeNode
          node={treeRoot}
          selected={`log:${selectedLog}`}
          expanded={expanded}
          onSelect={(id) => {
            if (id.startsWith("log:")) setSelectedLog(id.slice(4));
          }}
          onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
        />
      }
      content={
        <>
          <ContentHeading>{selectedLog}</ContentHeading>
          <ContentBody>
            <div style={{ marginBottom: 8 }}>
              <input type="text" placeholder="Filter current log..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 260, border: "1px solid #adadad", padding: "3px 4px", fontSize: 12 }} />
            </div>
            <ItemListTable columns={["Level", "Date and Time", "Source", "Event ID", "Task Category"]}>
              {rows.length ? (
                rows.map((e, i) => (
                  <tr key={i}>
                    <td className={e.level === "Error" || e.level === "Critical" ? styles.policyStateDisabled : e.level === "Warning" ? styles.rtSRV : ""}>{e.level}</td>
                    <td>{e.time}</td>
                    <td>{e.source}</td>
                    <td>{e.id}</td>
                    <td>{e.task}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                    No events found.
                  </td>
                </tr>
              )}
            </ItemListTable>
            {rows.length ? (
              <div style={{ marginTop: 10, borderTop: "1px solid #d4d4d4", paddingTop: 8 }}>
                <b>General</b>
                <p style={{ marginTop: 4 }}>{rows[0].message}</p>
                <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                  Log Name: {rows[0].log} &nbsp; Source: {rows[0].source} &nbsp; Event ID: {rows[0].id}
                </p>
              </div>
            ) : null}
          </ContentBody>
        </>
      }
    />
  );
}
