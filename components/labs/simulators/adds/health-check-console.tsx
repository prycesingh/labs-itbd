"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { HEALTH_CHECKS, type HealthCheckOutcome, type HealthCheckStatus } from "@/lib/labs/simulators/adds/healthChecks";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading } from "./mmc-console";
import styles from "./adds-console.module.css";

type ScanResult = { id: string; label: string; outcome: HealthCheckOutcome };

function tileClass(status: HealthCheckStatus): string {
  if (status === "pass") return styles.healthTilePass;
  if (status === "warn") return styles.healthTileWarn;
  return styles.healthTileFail;
}

function statusLabel(status: HealthCheckStatus): string {
  return status === "pass" ? "Healthy" : status === "warn" ? "Warning" : "Critical";
}

function statusIcon(status: HealthCheckStatus): string {
  return status === "pass" ? "✓" : status === "warn" ? "!" : "✕";
}

export function HealthCheckConsole({ state }: { state: AddsState }) {
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const summaryTiles = useMemo(() => {
    return HEALTH_CHECKS.slice(0, 8).map((check) => ({ id: check.id, label: check.label, outcome: check.run(state) }));
  }, [state]);

  function runFullScan() {
    setScanning(true);
    const scanResults = HEALTH_CHECKS.map((check) => ({ id: check.id, label: check.label, outcome: check.run(state) }));
    setResults(scanResults);
    setScanning(false);
    const passed = scanResults.filter((r) => r.outcome.status === "pass").length;
    const warned = scanResults.filter((r) => r.outcome.status === "warn").length;
    const failed = scanResults.filter((r) => r.outcome.status === "fail").length;
    toast.success(`Health scan complete: ${passed} passed, ${warned} warning, ${failed} failed`);
  }

  function clearResults() {
    setResults(null);
    setExpanded({});
  }

  function copyCommands(commands: string[]) {
    const text = commands.join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast.success("Commands copied to clipboard"),
        () => toast.error("Could not copy commands"),
      );
    }
  }

  return (
    <>
      <ContentHeading>AD Health Check - {state.domain.fqdn}</ContentHeading>
      <ContentBody>
        <h3 style={{ marginBottom: 8, color: "#1d6dad", fontSize: 14 }}>Health Summary</h3>
        <div className={styles.healthGrid}>
          {summaryTiles.map((tile) => (
            <div key={tile.id} className={`${styles.healthTile} ${tileClass(tile.outcome.status)}`}>
              <div style={{ fontWeight: 600 }}>{tile.label}</div>
              <div style={{ marginTop: 4, fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>{statusLabel(tile.outcome.status)}</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{tile.outcome.detail}</div>
            </div>
          ))}
        </div>

        <h3 style={{ margin: "14px 0 8px 0", color: "#1d6dad", fontSize: 14 }}>Full Health Scan</h3>
        <div style={{ marginBottom: 10, display: "flex", gap: 6 }}>
          <button type="button" className={styles.btnPrimary} onClick={runFullScan} disabled={scanning}>
            Run Full Scan ({HEALTH_CHECKS.length} checks)
          </button>
          <button type="button" className={styles.btn} onClick={clearResults}>
            Clear results
          </button>
        </div>

        {results ? (
          <div>
            {results.map((result) => {
              const isOpen = !!expanded[result.id];
              return (
                <div
                  key={result.id}
                  style={{ border: "1px solid #d4d4d4", borderLeft: `5px solid ${result.outcome.status === "pass" ? "#348534" : result.outcome.status === "warn" ? "#c45911" : "#c42b1c"}`, background: "#fff", marginBottom: 6 }}
                >
                  <div
                    style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                    onClick={() => setExpanded((e) => ({ ...e, [result.id]: !e[result.id] }))}
                  >
                    <span
                      className={result.outcome.status === "pass" ? styles.pillGreen : result.outcome.status === "fail" ? styles.pillRed : styles.pill}
                    >
                      <b>
                        {statusIcon(result.outcome.status)} {statusLabel(result.outcome.status).toUpperCase()}
                      </b>
                    </span>
                    <span style={{ fontWeight: 600 }}>{result.label}</span>
                    <span style={{ flex: 1 }} />
                    <a style={{ color: "#1d6dad", cursor: "pointer" }}>{isOpen ? "Hide details" : "Show details"}</a>
                  </div>
                  {isOpen ? (
                    <div style={{ padding: "8px 12px", borderTop: "1px solid #ececec", fontSize: 12 }}>
                      <div style={{ marginBottom: 6 }}>
                        <b>Finding:</b> {result.outcome.detail}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <b>Recommended fix:</b> {result.outcome.fix}
                      </div>
                      <div>
                        <b>Commands:</b>
                        <pre className={styles.terminal} style={{ maxHeight: "none", marginTop: 4 }}>
                          {result.outcome.commands.join("\n")}
                        </pre>
                        <button type="button" className={styles.btn} onClick={() => copyCommands(result.outcome.commands)}>
                          Copy commands
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "8px 10px", background: "#f7fbff", border: "1px solid #cfdef0", fontSize: 12 }}>
            Run the full scan to evaluate all {HEALTH_CHECKS.length} checks against the current directory state.
          </div>
        )}
      </ContentBody>
    </>
  );
}
