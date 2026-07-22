"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function BitlockerConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [revealed, setRevealed] = useState<Record<string, { by: string; at: string }>>({});

  function reveal(deviceName: string) {
    if (!confirm(`Reveal the BitLocker recovery key for "${deviceName}"? This action is logged.`)) return;
    const retrievedBy = "asharma";
    dispatch({ type: "BITLOCKER_RETRIEVE", deviceName, retrievedBy });
    setRevealed((r) => ({ ...r, [deviceName]: { by: retrievedBy, at: new Date().toISOString() } }));
    toast.success(`Recovery key for ${deviceName} retrieved.`);
  }

  return (
    <>
      <ContentHeading>BitLocker Recovery Key Vault</ContentHeading>
      <ContentBody>
        <ItemListTable columns={["Device", "Drive", "Key ID", "Recovery Key", "Last Backup", ""]}>
          {state.bitlocker.map((b) => {
            const audit = revealed[b.deviceName];
            return (
              <tr key={b.deviceName}>
                <td>{b.deviceName}</td>
                <td>{b.driveLabel}</td>
                <td>{b.recoveryKeyId}</td>
                <td style={{ fontFamily: "Consolas, monospace" }}>
                  {audit ? (
                    <>
                      {b.recoveryKey}
                      <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>
                        Retrieved by {audit.by} at {new Date(audit.at).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    "•••••• - •••••• - •••••• - •••••• - •••••• - •••••• - •••••• - ••••••"
                  )}
                </td>
                <td>{new Date(b.lastBackup).toLocaleDateString()}</td>
                <td>
                  {!audit ? (
                    <button type="button" className={styles.btn} onClick={() => reveal(b.deviceName)}>
                      Reveal Recovery Key
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
