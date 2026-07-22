"use client";

import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function ServicesConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  function setStatus(name: string, status: "Running" | "Stopped") {
    dispatch({ type: "TOOLS_SERVICE_SET_STATUS", name, status });
    toast.success(`${name} ${status === "Running" ? "started" : "stopped"}.`);
  }

  return (
    <>
      <ContentHeading>Services (Local)</ContentHeading>
      <ContentBody>
        <ItemListTable columns={["Name", "Status", "Startup Type", ""]}>
          {state.tools.services.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>
                <span className={s.status === "Running" ? styles.pillGreen : styles.pillRed}>{s.status}</span>
              </td>
              <td>{s.startupType}</td>
              <td>
                {s.status === "Running" ? (
                  <button type="button" className={styles.btn} onClick={() => setStatus(s.name, "Stopped")}>
                    Stop
                  </button>
                ) : (
                  <button type="button" className={styles.btn} onClick={() => setStatus(s.name, "Running")}>
                    Start
                  </button>
                )}
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
