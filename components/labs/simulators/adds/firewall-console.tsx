"use client";

import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function FirewallConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  function toggle(name: string) {
    dispatch({ type: "TOOLS_FIREWALL_TOGGLE", name });
    toast.success("Firewall rule updated.");
  }

  return (
    <>
      <ContentHeading>Windows Firewall with Advanced Security</ContentHeading>
      <ContentBody>
        <ItemListTable columns={["Rule Name", "Direction", "Action", "Profile", "Enabled", ""]}>
          {state.tools.firewall.map((f) => (
            <tr key={f.name}>
              <td>{f.name}</td>
              <td>{f.direction}</td>
              <td>{f.action}</td>
              <td>{f.profile}</td>
              <td>
                <span className={f.enabled ? styles.pillGreen : styles.pillRed}>{f.enabled ? "Yes" : "No"}</span>
              </td>
              <td>
                <button type="button" className={styles.btn} onClick={() => toggle(f.name)}>
                  {f.enabled ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
