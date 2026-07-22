"use client";

import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsState } from "@/lib/labs/simulators/adds/types";
import { ContentBody, ContentHeading, ItemListTable } from "./mmc-console";
import styles from "./adds-console.module.css";

export function TaskSchedulerConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  function toggle(name: string) {
    dispatch({ type: "TOOLS_TASK_TOGGLE", name });
    toast.success("Task status updated.");
  }

  return (
    <>
      <ContentHeading>Task Scheduler</ContentHeading>
      <ContentBody>
        <ItemListTable columns={["Task Name", "Status", "Trigger", "Last Run Time", "Next Run Time", ""]}>
          {state.tools.taskScheduler.map((t) => (
            <tr key={t.name}>
              <td style={{ maxWidth: 320, wordBreak: "break-word" }}>{t.name}</td>
              <td>
                <span className={t.status === "Disabled" ? styles.pillRed : styles.pillGreen}>{t.status}</span>
              </td>
              <td>{t.trigger}</td>
              <td>{new Date(t.lastRun).toLocaleString()}</td>
              <td>{new Date(t.nextRun).toLocaleString()}</td>
              <td>
                <button type="button" className={styles.btn} onClick={() => toggle(t.name)}>
                  {t.status === "Disabled" ? "Enable" : "Disable"}
                </button>
              </td>
            </tr>
          ))}
        </ItemListTable>
      </ContentBody>
    </>
  );
}
