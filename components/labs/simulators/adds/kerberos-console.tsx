"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";

export function KerberosConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { kerberos } = state.tools;

  return (
    <>
      <ContentHeading>Kerberos / Service Principal Names / Delegation</ContentHeading>
      <ContentBody>
        <h4 style={{ marginBottom: 4 }}>Registered SPNs</h4>
        <ItemListTable columns={["Account", "Service Principal Name"]}>
          {kerberos.spns.map((s, i) => (
            <tr key={i}>
              <td>{s.account}</td>
              <td>{s.spn}</td>
            </tr>
          ))}
        </ItemListTable>

        <h4 style={{ margin: "16px 0 4px" }}>Delegation Settings</h4>
        <ItemListTable columns={["Account", "Delegation Type", "Services"]}>
          {kerberos.delegation.length ? (
            kerberos.delegation.map((d, i) => (
              <tr key={i}>
                <td>{d.account}</td>
                <td>{d.type}</td>
                <td>{d.services.join(", ") || "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                No delegation configured.
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
