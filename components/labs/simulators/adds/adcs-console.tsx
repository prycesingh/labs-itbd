"use client";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";

export function AdcsConsole({ state }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { adcs } = state.tools;

  return (
    <>
      <ContentHeading>Active Directory Certificate Services — {adcs.caName}</ContentHeading>
      <ContentBody>
        <h4 style={{ marginBottom: 4 }}>Certificate Templates</h4>
        <ItemListTable columns={["Template Name", "Enrollee Supplies Subject", "Validity Period"]}>
          {adcs.templates.map((t) => (
            <tr key={t.name}>
              <td>{t.name}</td>
              <td>{t.enrolleeSuppliesSubject ? "Yes" : "No"}</td>
              <td>{t.validityYears} year(s)</td>
            </tr>
          ))}
        </ItemListTable>

        <h4 style={{ margin: "16px 0 4px" }}>Issued Certificates</h4>
        <ItemListTable columns={["Template", "Subject", "Issued", "Expires"]}>
          {adcs.issued.length ? (
            adcs.issued.map((c, i) => (
              <tr key={i}>
                <td>{c.template}</td>
                <td>{c.subject}</td>
                <td>{new Date(c.issued).toLocaleDateString()}</td>
                <td>{new Date(c.expires).toLocaleDateString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", color: "#888", padding: 12 }}>
                No certificates issued.
              </td>
            </tr>
          )}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
