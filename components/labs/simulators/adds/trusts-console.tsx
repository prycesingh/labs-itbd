"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { EmptyPane } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";

export function TrustsConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { trusts } = state.tools;

  return (
    <>
      <ContentHeading>Active Directory Domains and Trusts</ContentHeading>
      <ContentBody>
        <p style={{ marginBottom: 4 }}>
          Forest functional level: <b>{trusts.forestFunctionalLevel}</b>
        </p>
        <p style={{ marginBottom: 10 }}>UPN suffixes: {trusts.upnSuffixes.join(", ") || "(none)"}</p>

        <h4 style={{ marginBottom: 4 }}>Trust Relationships</h4>
        {trusts.relationships.length ? (
          <ItemListTable columns={["Domain", "Direction", "Type", "SID Filtering", "Selective Authentication"]}>
            {trusts.relationships.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.direction}</td>
                <td>{r.type}</td>
                <td>{r.sidFiltering ? "Enabled" : "Disabled"}</td>
                <td>{r.selectiveAuth ? "Enabled" : "Disabled"}</td>
              </tr>
            ))}
          </ItemListTable>
        ) : (
          <EmptyPane>This domain has no trust relationships configured.</EmptyPane>
        )}
      </ContentBody>
    </>
  );
}
