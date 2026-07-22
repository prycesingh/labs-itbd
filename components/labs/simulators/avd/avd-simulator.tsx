"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { avdReducer } from "@/lib/labs/simulators/avd/reducer";
import { freshAvdState } from "@/lib/labs/simulators/avd/seedData";
import type { AvdState } from "@/lib/labs/simulators/avd/types";
import { ApplicationGroupsPage } from "./application-groups-page";
import { AvdShell, type AvdPage } from "./avd-shell";
import { FslogixPage } from "./fslogix-page";
import { HomePage } from "./home-page";
import { HostPoolsPage } from "./host-pools-page";
import { ImageUpdatePrivatePage } from "./image-update-private-page";
import { InsightsPage } from "./insights-page";
import { MsixPackagesPage } from "./msix-packages-page";
import { PersonalDesktopsPage } from "./personal-desktops-page";
import { RdpPropertiesPage } from "./rdp-properties-page";
import { ScalingPlansPage } from "./scaling-plans-page";
import { SessionHostsPage } from "./session-hosts-page";
import { UsersPage } from "./users-page";
import { WorkspacesPage } from "./workspaces-page";

const SIMULATOR_KEY = "avd";
const SAVE_DEBOUNCE_MS = 1200;

export function AvdSimulator() {
  const [state, dispatch] = useReducer(avdReducer, undefined, freshAvdState);
  const [current, setCurrent] = useState<AvdPage>("home");
  const [loaded, setLoaded] = useState(false);
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
          dispatch({ type: "LOAD_STATE", state: data.state as AvdState });
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
    <AvdShell
      page={current}
      breadcrumb={[{ label: "Azure Virtual Desktop", onClick: current !== "home" ? () => setCurrent("home") : undefined }]}
      onNavigate={setCurrent}
    >
      {current === "home" ? <HomePage state={state} onNavigate={setCurrent} /> : null}
      {current === "host-pools" ? <HostPoolsPage state={state} dispatch={dispatch} /> : null}
      {current === "session-hosts" ? <SessionHostsPage state={state} dispatch={dispatch} /> : null}
      {current === "application-groups" ? <ApplicationGroupsPage state={state} dispatch={dispatch} /> : null}
      {current === "workspaces" ? <WorkspacesPage state={state} dispatch={dispatch} /> : null}
      {current === "scaling-plans" ? <ScalingPlansPage state={state} dispatch={dispatch} /> : null}
      {current === "msix-packages" ? <MsixPackagesPage state={state} dispatch={dispatch} /> : null}
      {current === "personal-desktops" ? <PersonalDesktopsPage state={state} dispatch={dispatch} /> : null}
      {current === "fslogix" ? <FslogixPage state={state} dispatch={dispatch} /> : null}
      {current === "rdp-properties" ? <RdpPropertiesPage state={state} dispatch={dispatch} /> : null}
      {current === "image-builder" ? <ImageUpdatePrivatePage view="image-builder" state={state} dispatch={dispatch} /> : null}
      {current === "update-plans" ? <ImageUpdatePrivatePage view="update-plans" state={state} dispatch={dispatch} /> : null}
      {current === "private-link" ? <ImageUpdatePrivatePage view="private-link" state={state} dispatch={dispatch} /> : null}
      {current === "insights" ? <InsightsPage state={state} /> : null}
      {current === "users" ? <UsersPage state={state} /> : null}
    </AvdShell>
  );
}
