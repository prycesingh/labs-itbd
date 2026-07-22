"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { m365Reducer } from "@/lib/labs/simulators/m365/reducer";
import { freshM365State } from "@/lib/labs/simulators/m365/seedData";
import type { M365State } from "@/lib/labs/simulators/m365/types";
import { AppsDeployPage } from "./apps-deploy-page";
import { DomainsPage } from "./domains-page";
import { ExchangePage } from "./exchange-page";
import { DeletedUsersPage, UsersPage } from "./users-page";
import { GroupsPage, SharedMailboxesPage } from "./groups-page";
import { HomePage } from "./home-page";
import { LicensesPage } from "./licenses-page";
import { M365Shell, type M365Page } from "./m365-shell";
import { ReportsPage } from "./reports-page";
import { RolesPage } from "./roles-page";
import { SecurityPage } from "./security-page";
import { SetupPage } from "./setup-page";
import { SharepointPage } from "./sharepoint-page";
import { TeamsPage } from "./teams-page";

const SIMULATOR_KEY = "m365";
const SAVE_DEBOUNCE_MS = 1200;

export function M365Simulator() {
  const [state, dispatch] = useReducer(m365Reducer, undefined, freshM365State);
  const [current, setCurrent] = useState<M365Page>("home");
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
          dispatch({ type: "LOAD_STATE", state: data.state as M365State });
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
    <M365Shell current={current} onNavigate={setCurrent}>
      {current === "home" ? <HomePage state={state} onNavigate={setCurrent} /> : null}
      {current === "users-active" ? <UsersPage state={state} dispatch={dispatch} /> : null}
      {current === "users-deleted" ? <DeletedUsersPage state={state} dispatch={dispatch} /> : null}
      {current === "groups-active" ? <GroupsPage state={state} dispatch={dispatch} /> : null}
      {current === "groups-shared-mailbox" ? <SharedMailboxesPage state={state} dispatch={dispatch} /> : null}
      {current === "licenses" ? <LicensesPage state={state} dispatch={dispatch} /> : null}
      {current === "domains" ? <DomainsPage state={state} dispatch={dispatch} /> : null}
      {current === "setup" ? <SetupPage state={state} /> : null}
      {current === "reports" ? <ReportsPage state={state} /> : null}
      {current === "roles" ? <RolesPage state={state} /> : null}
      {current === "security" ? <SecurityPage state={state} /> : null}
      {current === "exchange" ? <ExchangePage state={state} dispatch={dispatch} /> : null}
      {current === "sharepoint" ? <SharepointPage state={state} dispatch={dispatch} /> : null}
      {current === "teams" ? <TeamsPage state={state} dispatch={dispatch} /> : null}
      {current === "apps-deploy" ? <AppsDeployPage state={state} dispatch={dispatch} /> : null}
    </M365Shell>
  );
}
