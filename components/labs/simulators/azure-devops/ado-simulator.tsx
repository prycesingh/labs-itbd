"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { adoReducer } from "@/lib/labs/simulators/azure-devops/reducer";
import { freshAdoState } from "@/lib/labs/simulators/azure-devops/seedData";
import type { AdoState } from "@/lib/labs/simulators/azure-devops/types";
import { AdoShell, type AdoPage } from "./ado-shell";
import { ArtifactsPage } from "./artifacts-page";
import { BoardsBacklogPage, BoardsDeliveryPlansPage, BoardsQueriesPage } from "./boards-planning-page";
import { BoardsSprintsPage } from "./boards-sprints-page";
import { EnvironmentsLibraryPage } from "./environments-library-page";
import { OverviewPage } from "./overview-page";
import { PipelinesListPage } from "./pipelines-list-page";
import { NewPipelineWizardModal, PipelinesYamlEditorPage } from "./pipelines-yaml-page";
import { ReposBranchesPage, ReposPushesPage, ReposTagsPage } from "./repos-branches-page";
import { ReposCommitsPage, ReposFilesPage } from "./repos-files-commits-page";
import { ReposPullRequestsPage } from "./repos-pull-requests-page";
import { TestPlansPage } from "./test-plans-page";
import { WorkItemsPage } from "./work-items-page";

const SIMULATOR_KEY = "azure-devops";
const SAVE_DEBOUNCE_MS = 1200;

export function AdoSimulator() {
  const [state, dispatch] = useReducer(adoReducer, undefined, freshAdoState);
  const [current, setCurrent] = useState<AdoPage>("overview");
  const [loaded, setLoaded] = useState(false);
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`)
      .then((res) => (res.ok ? res.json() : { state: null }))
      .then((data) => {
        if (cancelled) return;
        if (data.state) {
          dispatch({ type: "LOAD_STATE", state: data.state as AdoState });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const saveState = useCallback(() => {
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: stateRef.current }),
    }).catch(() => {
      /* best-effort — a failed save just means this session's changes won't
         survive logout; the simulator itself keeps working from local state */
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveState, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, loaded, saveState]);

  useEffect(() => {
    return () => saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return <div style={{ padding: 48, textAlign: "center", color: "#605e5c" }}>Loading…</div>;
  }

  return (
    <AdoShell state={state} page={current} onNavigate={setCurrent} dispatch={dispatch}>
      {current === "overview" ? <OverviewPage state={state} onNavigate={setCurrent} /> : null}
      {current === "work-items" ? <WorkItemsPage state={state} dispatch={dispatch} /> : null}
      {current === "boards-sprints" ? <BoardsSprintsPage state={state} dispatch={dispatch} /> : null}
      {current === "boards-backlog" ? <BoardsBacklogPage state={state} /> : null}
      {current === "boards-queries" ? <BoardsQueriesPage state={state} dispatch={dispatch} /> : null}
      {current === "boards-delivery-plans" ? <BoardsDeliveryPlansPage state={state} /> : null}
      {current === "repos-files" ? <ReposFilesPage state={state} dispatch={dispatch} /> : null}
      {current === "repos-commits" ? <ReposCommitsPage state={state} /> : null}
      {current === "repos-branches" ? <ReposBranchesPage state={state} dispatch={dispatch} /> : null}
      {current === "repos-tags" ? <ReposTagsPage state={state} dispatch={dispatch} /> : null}
      {current === "repos-pushes" ? <ReposPushesPage state={state} /> : null}
      {current === "repos-pull-requests" ? <ReposPullRequestsPage state={state} dispatch={dispatch} /> : null}
      {current === "pipelines-list" ? (
        <PipelinesListPage state={state} dispatch={dispatch} onNewPipeline={() => setNewPipelineOpen(true)} />
      ) : null}
      {current === "pipelines-yaml-editor" ? <PipelinesYamlEditorPage state={state} dispatch={dispatch} /> : null}
      {current === "environments-library" ? <EnvironmentsLibraryPage state={state} dispatch={dispatch} /> : null}
      {current === "test-plans" ? <TestPlansPage state={state} dispatch={dispatch} /> : null}
      {current === "artifacts" ? <ArtifactsPage state={state} dispatch={dispatch} /> : null}
      {current === "project-settings" ? (
        <div style={{ padding: 24, color: "#605e5c" }}>Project settings aren&apos;t wired up in this simulator.</div>
      ) : null}
      {newPipelineOpen ? (
        <NewPipelineWizardModal state={state} dispatch={dispatch} onClose={() => setNewPipelineOpen(false)} />
      ) : null}
    </AdoShell>
  );
}
