"use client";

import { useState } from "react";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable, TabbedPanel } from "./mmc-console";
import styles from "./adds-console.module.css";

export function ExtraToolsConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [activeTab, setActiveTab] = useState("LAPS");
  const { laps, dfsn } = state.tools;

  return (
    <>
      <ContentHeading>LAPS / DFS Namespaces</ContentHeading>
      <ContentBody>
        <TabbedPanel
          tabs={["LAPS", "DFS Namespaces"]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          renderTab={(tab) => {
            if (tab === "LAPS")
              return (
                <>
                  <p style={{ marginBottom: 10 }}>
                    Local Administrator Password Solution status:{" "}
                    <span className={laps.enabled ? styles.pillGreen : styles.pillRed}>{laps.enabled ? "Enabled" : "Disabled"}</span> &nbsp; Password rotation:{" "}
                    {laps.passwordAgeDays} days
                  </p>
                  <h4 style={{ marginBottom: 4 }}>Retrieval Log</h4>
                  <ItemListTable columns={["Device", "Retrieved By", "Time"]}>
                    {laps.retrievals.length ? (
                      laps.retrievals.map((r, i) => (
                        <tr key={i}>
                          <td>{r.device}</td>
                          <td>{r.retrievedBy}</td>
                          <td>{new Date(r.time).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                          No LAPS password retrievals logged.
                        </td>
                      </tr>
                    )}
                  </ItemListTable>
                </>
              );
            return (
              <ItemListTable columns={["Namespace", "Type", "Targets"]}>
                {dfsn.namespaces.map((n) => (
                  <tr key={n.name}>
                    <td>{n.name}</td>
                    <td>{n.type}</td>
                    <td>{n.targets.join(", ")}</td>
                  </tr>
                ))}
              </ItemListTable>
            );
          }}
        />
      </ContentBody>
    </>
  );
}
