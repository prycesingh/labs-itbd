"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";

export function PsoConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  return (
    <>
      <ContentHeading>Fine-Grained Password Policies (Password Settings Objects)</ContentHeading>
      <ContentBody>
        <p style={{ marginBottom: 10 }}>
          PSOs let you apply stricter password and lockout rules to specific users or groups without changing the Default Domain Policy. Lower precedence wins when
          multiple PSOs apply.
        </p>
        <ItemListTable columns={["Name", "Precedence", "Min. Password Length", "Max. Password Age (days)", "Lockout Threshold", "Applies To"]}>
          {state.psos.length ? (
            state.psos
              .slice()
              .sort((a, b) => a.precedence - b.precedence)
              .map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.precedence}</td>
                  <td>{p.minPasswordLength}</td>
                  <td>{p.maxPasswordAge || "Never expires"}</td>
                  <td>{p.lockoutThreshold || "None"}</td>
                  <td>{p.appliesTo.join(", ")}</td>
                </tr>
              ))
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                No fine-grained password policies configured.
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
