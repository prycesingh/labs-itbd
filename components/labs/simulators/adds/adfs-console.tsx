"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";

export function AdfsConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { adfs } = state.tools;

  return (
    <>
      <ContentHeading>AD FS Management — {adfs.federationServiceName}</ContentHeading>
      <ContentBody>
        <p style={{ marginBottom: 10 }}>
          Federation Service Name: <b>{adfs.federationServiceName}</b>
        </p>
        <h4 style={{ marginBottom: 4 }}>Relying Party Trusts</h4>
        <ItemListTable columns={["Display Name", "Identifier", "Enabled"]}>
          {adfs.relyingParties.length ? (
            adfs.relyingParties.map((rp) => (
              <tr key={rp.name}>
                <td>{rp.name}</td>
                <td>{rp.identifier}</td>
                <td>{rp.enabled ? "Yes" : "No"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                No relying party trusts configured.
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
