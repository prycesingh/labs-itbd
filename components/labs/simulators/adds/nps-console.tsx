"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { AddsAction } from "@/lib/labs/simulators/adds/reducer";
import type { AddsRadiusClient, AddsState } from "@/lib/labs/simulators/adds/types";
import { AddsDialog, FormRow } from "./adds-dialog";
import { ContentBody, ContentHeading, ItemListTable, TabbedPanel } from "./mmc-console";
import styles from "./adds-console.module.css";

export function NpsConsole({ state, dispatch }: { state: AddsState; dispatch: (action: AddsAction) => void }) {
  const [activeTab, setActiveTab] = useState("RADIUS Clients");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { nps } = state.tools;

  return (
    <>
      <ContentHeading>Network Policy Server (RADIUS)</ContentHeading>
      <ContentBody>
        <TabbedPanel
          tabs={["RADIUS Clients", "Policies"]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          renderTab={(tab) => {
            if (tab === "RADIUS Clients")
              return (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <button type="button" className={styles.btn} onClick={() => setDialogOpen(true)}>
                      New RADIUS Client...
                    </button>
                  </div>
                  <ItemListTable columns={["Friendly Name", "IP Address", "Vendor", "Shared Secret"]}>
                    {nps.clients.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>{c.ip}</td>
                        <td>{c.vendor}</td>
                        <td>{c.sharedSecretSet ? "••••••••" : "(not set)"}</td>
                      </tr>
                    ))}
                  </ItemListTable>
                </>
              );
            return (
              <ItemListTable columns={["Policy Name", "Type", "Enabled", "Conditions", "Processing Order"]}>
                {nps.policies.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.type}</td>
                    <td>
                      <span className={p.enabled ? styles.pillGreen : styles.pillRed}>{p.enabled ? "Yes" : "No"}</span>
                    </td>
                    <td>{p.conditions}</td>
                    <td>{p.processingOrder}</td>
                  </tr>
                ))}
              </ItemListTable>
            );
          }}
        />
      </ContentBody>
      {dialogOpen ? <NewClientDialog dispatch={dispatch} onClose={() => setDialogOpen(false)} /> : null}
    </>
  );
}

function NewClientDialog({ dispatch, onClose }: { dispatch: (a: AddsAction) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [vendor, setVendor] = useState("RADIUS Standard");
  const [secret, setSecret] = useState("");

  return (
    <AddsDialog
      title="New RADIUS Client"
      onClose={onClose}
      buttons={[
        {
          label: "OK",
          primary: true,
          onClick: () => {
            if (!name.trim() || !ip.trim()) {
              alert("Friendly name and IP address are required.");
              return false;
            }
            if (!secret.trim()) {
              alert("A shared secret is required.");
              return false;
            }
            const client: AddsRadiusClient = { name: name.trim(), ip: ip.trim(), vendor, sharedSecretSet: true };
            dispatch({ type: "TOOLS_NPS_ADD_CLIENT", client });
            toast.success(`RADIUS client ${name} added.`);
            return true;
          },
        },
        { label: "Cancel" },
      ]}
    >
      <FormRow label="Friendly name">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow label="Address (IP or DNS)">
        <input type="text" value={ip} onChange={(e) => setIp(e.target.value)} />
      </FormRow>
      <FormRow label="Vendor">
        <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option>RADIUS Standard</option>
          <option>Cisco</option>
          <option>HP/Aruba</option>
          <option>Fortinet</option>
          <option>Meraki</option>
        </select>
      </FormRow>
      <FormRow label="Shared secret">
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      </FormRow>
    </AddsDialog>
  );
}
