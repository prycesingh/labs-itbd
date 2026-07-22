"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";

export function DhcpConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { scopes } = state.tools.dhcp;

  return (
    <>
      <ContentHeading>DHCP Manager</ContentHeading>
      <ContentBody>
        <ItemListTable columns={["Scope Name", "Subnet", "Range", "Lease Duration", "Leases Used"]}>
          {scopes.map((s) => {
            const pct = s.leasesTotal > 0 ? Math.round((s.leasesUsed / s.leasesTotal) * 100) : 0;
            return (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.subnet}</td>
                <td>
                  {s.startRange} - {s.endRange}
                </td>
                <td>{s.leaseDurationHours}h</td>
                <td style={{ minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 10, background: "#e6e6e6", border: "1px solid #ccc" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct > 85 ? "#c42b1c" : "#1d6dad" }} />
                    </div>
                    <span>
                      {s.leasesUsed}/{s.leasesTotal} ({pct}%)
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
