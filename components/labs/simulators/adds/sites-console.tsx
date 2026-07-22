"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsConnectionObject, AddsSite, AddsSiteLink, AddsState, AddsSubnetObject } from "@/lib/labs/simulators/adds/types";
import { AddsDialog, FormRow, HelpText } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable, TabbedPanel } from "./mmc-console";
import styles from "./adds-console.module.css";

type Dialog = { kind: "new-site" } | { kind: "new-subnet" } | { kind: "new-site-link" } | { kind: "new-connection" };

export function SitesConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [activeTab, setActiveTab] = useState("Sites");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  function deleteSite(name: string) {
    if (name === "Default-First-Site-Name") {
      toast.error("The default site cannot be deleted.");
      return;
    }
    if (state.domainControllers.some((dc) => dc.site === name)) {
      toast.error("Cannot delete a site that still contains domain controllers.");
      return;
    }
    dispatch({ type: "DELETE_SITE", name });
    toast.success(`Deleted site ${name}`);
  }

  return (
    <>
      <ContentHeading>Active Directory Sites and Services</ContentHeading>
      <ContentBody>
        <TabbedPanel
          tabs={["Sites", "Subnets", "Site Links", "Connection Objects"]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          renderTab={(tab) => {
            if (tab === "Sites")
              return (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-site" })}>
                      New Site...
                    </button>
                  </div>
                  <ItemListTable columns={["Name", "Subnets", "Location", "Description", ""]}>
                    {state.sites.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>{s.subnets.join(", ") || "-"}</td>
                        <td>{s.location || "-"}</td>
                        <td>{s.description || "-"}</td>
                        <td>
                          <button type="button" className={styles.btn} onClick={() => deleteSite(s.name)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </ItemListTable>
                </>
              );
            if (tab === "Subnets")
              return (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-subnet" })}>
                      New Subnet...
                    </button>
                  </div>
                  <ItemListTable columns={["Prefix", "Site", "Location", "Description"]}>
                    {state.subnetObjects.map((s) => (
                      <tr key={s.prefix}>
                        <td>{s.prefix}</td>
                        <td>{s.site}</td>
                        <td>{s.location}</td>
                        <td>{s.description}</td>
                      </tr>
                    ))}
                  </ItemListTable>
                </>
              );
            if (tab === "Site Links")
              return (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-site-link" })}>
                      New Site Link...
                    </button>
                  </div>
                  <ItemListTable columns={["Name", "Transport", "Cost", "Interval (min)", "Schedule", "Sites"]}>
                    {state.siteLinks.map((l) => (
                      <tr key={l.name}>
                        <td>{l.name}</td>
                        <td>{l.transport}</td>
                        <td>{l.cost}</td>
                        <td>{l.interval}</td>
                        <td>{l.schedule}</td>
                        <td>{l.sitesContained.join(", ")}</td>
                      </tr>
                    ))}
                  </ItemListTable>
                </>
              );
            return (
              <>
                <div style={{ marginBottom: 8 }}>
                  <button type="button" className={styles.btn} onClick={() => setDialog({ kind: "new-connection" })}>
                    New Connection Object...
                  </button>
                </div>
                <ItemListTable columns={["Name", "Owner", "Replicate From", "Transport", "Schedule", "Enabled", "Auto-generated"]}>
                  {state.connectionObjects.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.owner}</td>
                      <td>{c.replicateFrom}</td>
                      <td>{c.transport}</td>
                      <td>{c.schedule}</td>
                      <td>
                        <span className={c.enabled ? styles.pillGreen : styles.pillRed}>{c.enabled ? "Yes" : "No"}</span>
                      </td>
                      <td>{c.auto ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </ItemListTable>
              </>
            );
          }}
        />
      </ContentBody>
      {dialog?.kind === "new-site" ? <NewSiteDialog dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "new-subnet" ? <NewSubnetDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "new-site-link" ? <NewSiteLinkDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "new-connection" ? <NewConnectionDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

function NewSiteDialog({ dispatch, onClose }: { dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  return (
    <AddsDialog
      title="New Object - Site"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!name.trim()) {
              alert("Site name is required.");
              return false;
            }
            const site: AddsSite = { name: name.trim(), subnets: [], location, description };
            dispatch({ type: "ADD_SITE", site });
            toast.success(`Site ${name} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Site name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Location">
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
      <HelpText>Select a site link object to associate this site with when you are finished creating it.</HelpText>
    </AddsDialog>
  );
}

function NewSubnetDialog({ state, dispatch, onClose }: { state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [prefix, setPrefix] = useState("");
  const [site, setSite] = useState(state.sites[0]?.name ?? "");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  return (
    <AddsDialog
      title="New Object - Subnet"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!prefix.trim()) {
              alert("Prefix (network/bits) is required.");
              return false;
            }
            const subnet: AddsSubnetObject = { prefix: prefix.trim(), site, location, description };
            dispatch({ type: "ADD_SUBNET", subnet });
            toast.success(`Subnet ${prefix} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Prefix">
        <input type="text" placeholder="10.0.0.0/24" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      </FormRow>
      <FormRow label="Site">
        <select value={site} onChange={(e) => setSite(e.target.value)}>
          {state.sites.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Location">
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </FormRow>
      <FormRow label="Description">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormRow>
    </AddsDialog>
  );
}

function NewSiteLinkDialog({ state, dispatch, onClose }: { state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState(100);
  const [interval, setInterval] = useState(180);
  const [schedule, setSchedule] = useState("24x7");
  const [sitesContained, setSitesContained] = useState<string[]>(state.sites.map((s) => s.name));

  return (
    <AddsDialog
      title="New Object - Site Link"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!name.trim()) {
              alert("Site link name is required.");
              return false;
            }
            const link: AddsSiteLink = { name: name.trim(), transport: "IP", cost, interval, schedule, sitesContained };
            dispatch({ type: "ADD_SITE_LINK", link });
            toast.success(`Site link ${name} created.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Cost">
        <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
      </FormRow>
      <FormRow label="Replicate every (min)">
        <input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
      </FormRow>
      <FormRow label="Schedule">
        <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
          <option>24x7</option>
          <option>Business hours only (Mon-Fri 09:00-18:00)</option>
          <option>Off-hours only (18:00-06:00)</option>
        </select>
      </FormRow>
      <HelpText>Sites in this link: {sitesContained.join(", ") || "(none)"}</HelpText>
    </AddsDialog>
  );
}

function NewConnectionDialog({ state, dispatch, onClose }: { state: AddsState; dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [owner, setOwner] = useState(state.domainControllers[0]?.name ?? "");
  const [replicateFrom, setReplicateFrom] = useState(state.domainControllers[1]?.name ?? state.domainControllers[0]?.name ?? "");

  return (
    <AddsDialog
      title="New Object - Connection"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!owner || !replicateFrom) {
              alert("Both a destination and source server are required.");
              return false;
            }
            if (owner === replicateFrom) {
              alert("A server cannot replicate from itself.");
              return false;
            }
            const conn: AddsConnectionObject = {
              id: crypto.randomUUID(),
              name: `${owner} <- ${replicateFrom}`,
              owner,
              replicateFrom,
              transport: "IP",
              schedule: "Every 15 minutes",
              enabled: true,
              auto: false,
            };
            dispatch({ type: "ADD_CONNECTION_OBJECT", conn });
            toast.success("Connection object created.");
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Destination server">
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          {state.domainControllers.map((dc) => (
            <option key={dc.name} value={dc.name}>
              {dc.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Replicate from server">
        <select value={replicateFrom} onChange={(e) => setReplicateFrom(e.target.value)}>
          {state.domainControllers.map((dc) => (
            <option key={dc.name} value={dc.name}>
              {dc.name}
            </option>
          ))}
        </select>
      </FormRow>
      <HelpText>This will manually create a replication connection object, which by default the KCC would generate automatically.</HelpText>
    </AddsDialog>
  );
}
