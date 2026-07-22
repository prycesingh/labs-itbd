"use client";

import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function RecycleBinConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  function enable() {
    if (state.recycleBinEnabled) return;
    if (!confirm("Once enabled, the AD Recycle Bin cannot be disabled. Continue?")) return;
    dispatch({ type: "SET_RECYCLE_BIN_ENABLED", enabled: true });
    toast.success("AD Recycle Bin enabled for the forest.");
  }

  function restore(id: string, name: string) {
    dispatch({ type: "RESTORE_RECYCLE_BIN_ITEM", id });
    toast.success(`Restored ${name} to its last known parent.`);
  }

  return (
    <>
      <ContentHeading>Active Directory Recycle Bin</ContentHeading>
      <ContentBody>
        <div style={{ marginBottom: 12 }}>
          <span className={state.recycleBinEnabled ? styles.pillGreen : styles.pillRed}>{state.recycleBinEnabled ? "Enabled" : "Disabled"}</span>{" "}
          {state.recycleBinEnabled ? (
            <span style={{ color: "#555" }}>Recycle Bin is enabled for {state.domain.fqdn}. This action is irreversible.</span>
          ) : (
            <button type="button" className={styles.btnPrimary} onClick={enable}>
              Enable Recycle Bin
            </button>
          )}
        </div>

        <ItemListTable columns={["Name", "Type", "Deleted On", "Deleted From", "Last Known Parent", "Status", ""]}>
          {state.recycleBin.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.kind}</td>
              <td>{new Date(item.deletedOn).toLocaleString()}</td>
              <td>{item.deletedFrom}</td>
              <td>{item.lastKnownParent}</td>
              <td>
                <span className={item.restored ? styles.pillGreen : styles.pill}>{item.restored ? "Restored" : "Deleted"}</span>
              </td>
              <td>
                {!item.restored ? (
                  <button type="button" className={styles.btn} disabled={!state.recycleBinEnabled} onClick={() => restore(item.id, item.name)}>
                    Restore
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </ItemListTable>
        {!state.recycleBinEnabled ? (
          <p style={{ color: "#555", fontSize: 11, marginTop: 8 }}>Restore is unavailable until the Recycle Bin is enabled for this forest.</p>
        ) : null}
      </ContentBody>
    </>
  );
}
