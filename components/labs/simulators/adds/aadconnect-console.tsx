"use client";

import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function AadConnectConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const { aadConnect } = state;

  function runSync() {
    dispatch({ type: "AAD_CONNECT_RUN_SYNC" });
    toast.success("Delta sync cycle started.");
  }

  function toggleStaging() {
    dispatch({ type: "AAD_CONNECT_SET_STAGING", staging: !aadConnect.stagingMode });
    toast.success(`Staging mode ${aadConnect.stagingMode ? "disabled" : "enabled"}.`);
  }

  return (
    <>
      <ContentHeading>Microsoft Entra Connect Sync</ContentHeading>
      <ContentBody>
        <table className={styles.dashTable} style={{ maxWidth: 560 }}>
          <tbody>
            <tr>
              <th>Sync interval</th>
              <td>Every {aadConnect.syncIntervalMin} minutes</td>
            </tr>
            <tr>
              <th>Last run</th>
              <td>{new Date(aadConnect.lastRun).toLocaleString()}</td>
            </tr>
            <tr>
              <th>Next scheduled run</th>
              <td>{new Date(aadConnect.nextRun).toLocaleString()}</td>
            </tr>
            <tr>
              <th>Staging mode</th>
              <td>
                <span className={aadConnect.stagingMode ? styles.pillGreen : styles.pill}>{aadConnect.stagingMode ? "Enabled" : "Disabled"}</span>
              </td>
            </tr>
            <tr>
              <th>Synced objects</th>
              <td>{aadConnect.syncedObjects.toLocaleString()}</td>
            </tr>
            <tr>
              <th>Pending exports</th>
              <td>{aadConnect.pendingExports}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ margin: "14px 0" }}>
          <button type="button" className={styles.btnPrimary} onClick={runSync}>
            Run Sync Now
          </button>{" "}
          <button type="button" className={styles.btn} onClick={toggleStaging}>
            {aadConnect.stagingMode ? "Disable Staging Mode" : "Enable Staging Mode"}
          </button>
        </div>

        <h4 style={{ marginBottom: 4 }}>Connectors</h4>
        <ItemListTable columns={["Name", "Kind", "Object Count", "Last Full Import", "Last Delta Sync"]}>
          {aadConnect.connectors.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td>{c.kind}</td>
              <td>{c.objectCount.toLocaleString()}</td>
              <td>{new Date(c.lastFullImport).toLocaleString()}</td>
              <td>{new Date(c.lastDeltaSync).toLocaleString()}</td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
