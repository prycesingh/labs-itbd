"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function RrasConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { rras } = state.tools;

  return (
    <>
      <ContentHeading>Routing and Remote Access</ContentHeading>
      <ContentBody>
        <h4 style={{ marginBottom: 4 }}>VPN Servers</h4>
        <ItemListTable columns={["Name", "Type", "Status"]}>
          {rras.vpnServers.map((v) => (
            <tr key={v.name}>
              <td>{v.name}</td>
              <td>{v.type}</td>
              <td>
                <span className={v.status === "Running" ? styles.pillGreen : styles.pillRed}>{v.status}</span>
              </td>
            </tr>
          ))}
        </ItemListTable>

        <h4 style={{ margin: "16px 0 4px" }}>Routing Interfaces</h4>
        <ItemListTable columns={["Name", "Type", "Status"]}>
          {rras.routingInterfaces.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td>{r.type}</td>
              <td>
                <span className={r.status === "Enabled" ? styles.pillGreen : styles.pillRed}>{r.status}</span>
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
