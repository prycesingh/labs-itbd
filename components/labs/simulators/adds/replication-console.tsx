"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsReplicationEvent, AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable, TabbedPanel } from "./mmc-console";
import styles from "./adds-console.module.css";

const TABS = ["Status Dashboard", "Repadmin", "DCdiag", "Force Replication", "Replication Events"];

function dcState(state: AddsState, name: string) {
  return state.dcState[name] ?? { usn: 0, lastSync: "" };
}

function minutesSince(iso: string): number {
  if (!iso) return Infinity;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

function healthFor(minutes: number): "pass" | "warn" | "fail" {
  if (minutes <= 30) return "pass";
  if (minutes <= 240) return "warn";
  return "fail";
}

function healthLabel(status: "pass" | "warn" | "fail"): string {
  return status === "pass" ? "Healthy" : status === "warn" ? "Warning" : "Critical";
}

function healthPillClass(status: "pass" | "warn" | "fail"): string {
  return status === "pass" ? styles.pillGreen : status === "fail" ? styles.pillRed : styles.pill;
}

function eventPillClass(level: AddsReplicationEvent["level"]): string {
  if (level === "Error") return styles.pillRed;
  if (level === "Warning") return styles.pill;
  return styles.pillGreen;
}

export function ReplicationConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [lines, setLines] = useState<string[]>(["repadmin/dcdiag console - select a button on the right to run a command."]);

  function appendLines(newLines: string[]) {
    setLines((prev) => [...prev, ...newLines].slice(-600));
  }

  return (
    <>
      <ContentHeading>Active Directory Replication - {state.domain.fqdn}</ContentHeading>
      <ContentBody>
        <TabbedPanel
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          renderTab={(tab) => {
            if (tab === "Status Dashboard") return <StatusDashboardTab state={state} />;
            if (tab === "Repadmin") return <RepadminTab state={state} lines={lines} onRun={appendLines} />;
            if (tab === "DCdiag") return <DCdiagTab state={state} lines={lines} onRun={appendLines} />;
            if (tab === "Force Replication") return <ForceReplicationTab state={state} dispatch={dispatch} onLog={appendLines} />;
            return <ReplicationEventsTab state={state} />;
          }}
        />
      </ContentBody>
    </>
  );
}

function StatusDashboardTab({ state }: { state: AddsState }) {
  return (
    <>
      <ItemListTable columns={["Domain Controller", "Site", "USN (last sync)", "Last Sync", "Status"]}>
        {state.domainControllers.map((dc) => {
          const s = dcState(state, dc.name);
          const minutes = minutesSince(s.lastSync);
          const status = healthFor(minutes);
          return (
            <tr key={dc.name}>
              <td>{dc.name}.{state.domain.fqdn}</td>
              <td>{dc.site}</td>
              <td>{s.usn}</td>
              <td>{s.lastSync ? new Date(s.lastSync).toLocaleString() : "-"}</td>
              <td>
                <span className={healthPillClass(status)}>{healthLabel(status)}</span>
              </td>
            </tr>
          );
        })}
      </ItemListTable>
      <div style={{ marginTop: 12, padding: "8px 10px", background: "#f7fbff", border: "1px solid #cfdef0", fontSize: 12 }}>
        <b>About Replication:</b> AD replication uses USNs (Update Sequence Numbers) per DC. Intra-site replication runs on a
        15-second change-notify schedule. Inter-site replication follows the Site Link schedule (default every 180 minutes,
        compressed). The KCC (Knowledge Consistency Checker) generates the topology automatically every 15 minutes.
      </div>
    </>
  );
}

function RepadminTab({ state, lines, onRun }: { state: AddsState; lines: string[]; onRun: (lines: string[]) => void }) {
  function showrepl() {
    const dcs = state.domainControllers;
    const out = ["", "C:\\> repadmin /showrepl", ""];
    dcs.forEach((dc) => {
      const s = dcState(state, dc.name);
      out.push("==== INBOUND NEIGHBORS ======================================");
      out.push("");
      out.push(`${dc.site}\\${dc.name}`);
      out.push(`DSA Options: ${dc.isGC ? "IS_GC" : "(none)"}`);
      out.push("Site Options: (none)");
      out.push(`DSA invocationID: ${s.usn}`);
      out.push("");
      dcs
        .filter((other) => other.name !== dc.name)
        .forEach((other) => {
          const otherState = dcState(state, other.name);
          out.push(`  DC=${state.domain.fqdn.split(".").join(",DC=")}`);
          out.push(`    ${other.site}\\${other.name} via RPC`);
          out.push(`      Last attempt @ ${otherState.lastSync || "never"} was successful.`);
          out.push(`      USN at last success: ${otherState.usn}`);
        });
      out.push("");
    });
    onRun(out);
  }

  function replsummary() {
    const now = new Date().toLocaleString();
    const out = ["", "C:\\> repadmin /replsummary", "", `Replication Summary Start Time: ${now}`, "", "Source DSA          largest delta    fails/total %%   error"];
    state.domainControllers.forEach((dc) => {
      const minutes = minutesSince(dcState(state, dc.name).lastSync);
      out.push(` ${dc.name.padEnd(20)}${String(minutes + "m:00s").padStart(11)}    0 /  10    0`);
    });
    out.push("");
    out.push("Destination DSA     largest delta    fails/total %%   error");
    state.domainControllers.forEach((dc) => {
      const minutes = minutesSince(dcState(state, dc.name).lastSync);
      out.push(` ${dc.name.padEnd(20)}${String(minutes + "m:00s").padStart(11)}    0 /  10    0`);
    });
    out.push("");
    onRun(out);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button type="button" className={styles.btn} onClick={showrepl}>
          Run repadmin /showrepl
        </button>
        <button type="button" className={styles.btn} onClick={replsummary}>
          Run repadmin /replsummary
        </button>
        <button type="button" className={styles.btn} onClick={() => onRun(["Console cleared."])} style={{ marginTop: 10 }}>
          Clear console
        </button>
      </div>
      <div className={styles.terminal}>{lines.join("\n")}</div>
    </div>
  );
}

function DCdiagTab({ state, lines, onRun }: { state: AddsState; lines: string[]; onRun: (lines: string[]) => void }) {
  function runDcdiag() {
    const out = [
      "",
      "C:\\> dcdiag /v",
      "",
      "Directory Server Diagnosis",
      "",
      "Performing initial setup:",
      "   Trying to find home server...",
      `   Home Server = ${state.domainControllers[0]?.name ?? "DC01"}`,
      "   * Identified AD Forest.",
      "   Done gathering initial info.",
      "",
    ];
    const tests = ["Connectivity", "Advertising", "SysVolCheck", "KccEvent", "NetLogons", "Replications", "Services", "FsmoCheck"];
    state.domainControllers.forEach((dc) => {
      out.push(`Testing server: ${dc.site}\\${dc.name}`);
      tests.forEach((test) => {
        out.push(`   Starting test: ${test}`);
        out.push(`      ......................... ${dc.name} passed test ${test}`);
      });
      out.push("");
    });
    out.push(`Running enterprise tests on : ${state.domain.fqdn}`);
    ["Intersite", "FsmoCheck", "LocatorCheck"].forEach((test) => {
      out.push(`   Starting test: ${test}`);
      out.push(`      ......................... ${state.domain.fqdn} passed test ${test}`);
    });
    onRun(out);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button type="button" className={styles.btn} onClick={runDcdiag}>
          Run dcdiag
        </button>
        <button type="button" className={styles.btn} onClick={() => onRun(["Console cleared."])} style={{ marginTop: 10 }}>
          Clear console
        </button>
      </div>
      <div className={styles.terminal}>{lines.join("\n")}</div>
    </div>
  );
}

function ForceReplicationTab({
  state,
  dispatch,
  onLog,
}: {
  state: AddsState;
  dispatch: (action: AddsAction) => void;
  onLog: (lines: string[]) => void;
}) {
  const dcNames = state.domainControllers.map((dc) => dc.name);
  const [fromDc, setFromDc] = useState(dcNames[0] ?? "");
  const [toDc, setToDc] = useState(dcNames[1] ?? dcNames[0] ?? "");
  const [output, setOutput] = useState("Output will appear here.");

  function replicateNow() {
    if (!fromDc || !toDc) return;
    if (fromDc === toDc) {
      setOutput("Source and destination must differ.");
      toast.error("Source and destination DCs must differ.");
      return;
    }
    const beforeTo = dcState(state, toDc);
    const beforeFrom = dcState(state, fromDc);
    dispatch({ type: "FORCE_REPLICATION", fromDc, toDc });
    const out = [
      `C:\\> repadmin /replicate ${toDc} ${fromDc} "DC=${state.domain.fqdn.split(".").join(",DC=")}"`,
      "",
      `Sync from ${fromDc} to ${toDc} completed successfully.`,
      "",
      `USN @ destination (before): ${beforeTo.usn}`,
      `USN @ destination (after):  ${beforeTo.usn + 1}`,
      `USN @ source:               ${beforeFrom.usn + 1}`,
      `Last replication: ${new Date().toLocaleString()}`,
      "",
      "The command completed successfully.",
    ];
    setOutput(out.join("\n"));
    onLog(["", ...out, ""]);
    toast.success(`Replication from ${fromDc} to ${toDc} completed.`);
  }

  return (
    <>
      <div style={{ background: "#fff", border: "1px solid #d4d4d4", padding: 14, marginBottom: 10, maxWidth: 520 }}>
        <h3 style={{ marginBottom: 10, fontSize: 14, color: "#1d6dad" }}>Force Replication</h3>
        <div className={styles.formRow}>
          <label>Source DC</label>
          <select value={fromDc} onChange={(e) => setFromDc(e.target.value)}>
            {dcNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Destination DC</label>
          <select value={toDc} onChange={(e) => setToDc(e.target.value)}>
            {dcNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <label>&nbsp;</label>
          <button type="button" className={styles.btnPrimary} onClick={replicateNow}>
            Replicate Now
          </button>
        </div>
      </div>
      <div className={styles.terminal}>{output}</div>
    </>
  );
}

function ReplicationEventsTab({ state }: { state: AddsState }) {
  const sorted = [...state.replicationEvents].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return (
    <ItemListTable columns={["Level", "Date and Time", "Source", "Destination", "Message"]}>
      {sorted.length ? (
        sorted.map((ev, i) => (
          <tr key={`${ev.time}-${i}`}>
            <td>
              <span className={eventPillClass(ev.level)}>{ev.level}</span>
            </td>
            <td>{new Date(ev.time).toLocaleString()}</td>
            <td>{ev.source}</td>
            <td>{ev.dest}</td>
            <td>{ev.message}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={5} style={{ textAlign: "center", color: "#888", padding: 12 }}>
            No replication events recorded.
          </td>
        </tr>
      )}
    </ItemListTable>
  );
}
