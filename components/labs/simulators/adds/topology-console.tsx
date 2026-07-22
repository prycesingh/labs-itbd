"use client";

import { useState } from "react";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

function buildKccTranscript(state: AddsState): string {
  const lines: string[] = [];
  lines.push(`[KCC] Simulating intra-site topology for ${state.domain.fqdn} (${state.domainControllers.length} DCs)`);
  lines.push("[KCC] Computing connection objects...");
  state.connectionObjects.forEach((c) => {
    lines.push(`[KCC] ${c.owner} <-> ${c.replicateFrom} (${c.auto ? "already exists" : "manually created"})`);
  });
  lines.push("[KCC] All NCs satisfied; no changes required.");
  lines.push("");
  lines.push(`[KCC] Simulating inter-site topology (ISTG: ${state.domainControllers[0]?.name ?? "n/a"})`);
  lines.push("[KCC] Evaluating site link costs...");
  state.siteLinks.forEach((l) => {
    lines.push(`[KCC]   ${l.sitesContained.join(" -> ") || l.name} (link: ${l.name}, cost ${l.cost}) OK`);
  });
  lines.push("[KCC] Bridge all site links: ON (transitive paths inferred)");
  lines.push("[KCC] Forest convergence target: ~25 minutes worst case");
  lines.push(`[KCC] Completed in ${(Math.random() * 300 + 100).toFixed(0)}ms. No anomalies.`);
  return lines.join("\n");
}

export function TopologyConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [transcript, setTranscript] = useState<string | null>(null);

  return (
    <>
      <ContentHeading>Replication Topology (Architect view)</ContentHeading>
      <ContentBody>
        <p style={{ marginBottom: 10 }}>Read-only summary of the current inter-site and intra-site replication topology.</p>

        <h4 style={{ margin: "10px 0 4px" }}>Site Links</h4>
        <ItemListTable columns={["Name", "Transport", "Cost", "Interval (min)", "Schedule", "Sites Contained"]}>
          {state.siteLinks.map((l) => (
            <tr key={l.name}>
              <td>{l.name}</td>
              <td>{l.transport}</td>
              <td>{l.cost}</td>
              <td>{l.interval}</td>
              <td>{l.schedule}</td>
              <td>{l.sitesContained.join(", ")}</td>
            </tr>
          ))}
        </ItemListTable>

        <h4 style={{ margin: "14px 0 4px" }}>Connection Objects</h4>
        <ItemListTable columns={["Name", "Owner", "Replicate From", "Transport", "Schedule", "Auto-generated"]}>
          {state.connectionObjects.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.owner}</td>
              <td>{c.replicateFrom}</td>
              <td>{c.transport}</td>
              <td>{c.schedule}</td>
              <td>{c.auto ? "Yes" : "No"}</td>
            </tr>
          ))}
        </ItemListTable>

        <div style={{ margin: "14px 0" }}>
          <button type="button" className={styles.btnPrimary} onClick={() => setTranscript(buildKccTranscript(state))}>
            Simulate KCC Run
          </button>
        </div>

        {transcript ? <div className={styles.terminal}>{transcript}</div> : null}
      </ContentBody>
    </>
  );
}
