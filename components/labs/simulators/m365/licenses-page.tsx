"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { M365Action } from "@/lib/labs/simulators/m365/reducer";
import type { M365License, M365State } from "@/lib/labs/simulators/m365/types";
import { Flyout, FormGroup, Modal, Pill, StatRow, UsageBar, WizStep } from "./m365-ui";
import styles from "./m365-console.module.css";

type FlyTab = "users" | "apps" | "settings";
type RenewalMode = NonNullable<M365License["renewalMode"]>;
type PaymentTerm = "monthly" | "annual" | "annual-upfront";

const BUY_CATALOG: { sku: string; name: string; monthly: number; desc: string }[] = [
  { sku: "M365_BUSINESS_BASIC", name: "Microsoft 365 Business Basic", monthly: 6.0, desc: "Web/mobile apps + email and Teams." },
  { sku: "M365_BUSINESS_STANDARD", name: "Microsoft 365 Business Standard", monthly: 12.5, desc: "Desktop Office apps + Teams + email." },
  { sku: "M365_E3", name: "Microsoft 365 E3", monthly: 36.0, desc: "Enterprise: Office, EMS, Windows." },
  { sku: "M365_E5", name: "Microsoft 365 E5", monthly: 57.0, desc: "E3 + Audio Conf + Defender E5 + Power BI Pro." },
  { sku: "ENTRA_ID_P1", name: "Microsoft Entra ID P1", monthly: 6.0, desc: "Conditional Access, SSPR, MFA." },
  { sku: "ENTRA_ID_P2", name: "Microsoft Entra ID P2", monthly: 9.0, desc: "P1 + Identity Protection + PIM." },
  { sku: "POWER_BI_PRO", name: "Power BI Pro", monthly: 10.0, desc: "Self-service business intelligence." },
  { sku: "VISIO_P2", name: "Visio Plan 2", monthly: 15.0, desc: "Advanced diagramming, online and desktop." },
];

function appsForSku(sku: string): string[] {
  switch (sku) {
    case "M365_BUSINESS_BASIC":
      return ["Exchange Online (Plan 1)", "OneDrive (1 TB)", "SharePoint Online", "Microsoft Teams", "Word, Excel, PowerPoint (web)"];
    case "M365_BUSINESS_STANDARD":
      return ["Exchange Online (Plan 1)", "OneDrive (1 TB)", "SharePoint Online", "Microsoft Teams", "Outlook", "Word, Excel, PowerPoint (desktop)"];
    case "M365_E3":
      return ["Exchange Online (Plan 2)", "OneDrive (Unlimited)", "SharePoint Online", "Microsoft Teams", "Outlook", "Word, Excel, PowerPoint", "Microsoft Intune", "Entra ID P1", "Windows 11 Enterprise E3"];
    case "M365_E5":
      return ["Everything in M365 E3", "Microsoft Defender for Office 365", "Entra ID P2", "Power BI Pro", "Microsoft Bookings", "Audio Conferencing"];
    case "ENTRA_ID_P1":
      return ["Conditional Access", "Group-based licensing", "Self-service password reset", "Dynamic groups", "Cloud App Discovery"];
    case "ENTRA_ID_P2":
      return ["Everything in Entra ID P1", "Identity Protection", "Privileged Identity Management", "Access reviews"];
    case "POWER_BI_PRO":
      return ["Power BI service", "Power BI Desktop", "Power BI Mobile", "Shared workspaces"];
    case "VS_ENTERPRISE":
      return ["Visual Studio Enterprise IDE", "Azure DevTest credit", "App Center", "Load testing"];
    case "VS_PRO":
      return ["Visual Studio Professional IDE", "Azure DevTest credit"];
    case "VISIO_P2":
      return ["Visio for the web", "Visio desktop app", "Visio data visualizer"];
    case "MDE_P2":
      return ["Microsoft Defender for Endpoint P2", "Endpoint detection and response", "Threat and vulnerability management"];
    case "INTUNE_P2":
      return ["Microsoft Intune Suite add-on", "Advanced endpoint analytics", "Remote help"];
    default:
      return [];
  }
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LicensesPage({ state, dispatch }: { state: M365State; dispatch: (action: M365Action) => void }) {
  const [flySku, setFlySku] = useState<string | null>(null);
  const [flyTab, setFlyTab] = useState<FlyTab>("users");
  const [assignSku, setAssignSku] = useState<string | null>(null);
  const [assignChecked, setAssignChecked] = useState<Set<string>>(new Set());
  const [addSeatsSku, setAddSeatsSku] = useState<string | null>(null);
  const [addSeatsCount, setAddSeatsCount] = useState(5);
  const [renewalSku, setRenewalSku] = useState<string | null>(null);
  const [renewalChoice, setRenewalChoice] = useState<RenewalMode>("Auto-renew");
  const [cancelSku, setCancelSku] = useState<string | null>(null);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [buySku, setBuySku] = useState<string | null>(null);
  const [buyStep, setBuyStep] = useState<1 | 2 | 3>(1);
  const [buySeats, setBuySeats] = useState(25);
  const [buyTerm, setBuyTerm] = useState<PaymentTerm>("annual");

  const assignedCount = (sku: string) => state.users.filter((u) => u.licenses.includes(sku)).length;

  const totalProducts = state.licenses.length;
  const totalPurchased = state.licenses.reduce((sum, l) => sum + l.purchased, 0);
  const totalAssigned = state.licenses.reduce((sum, l) => sum + assignedCount(l.sku), 0);
  const totalAvailable = totalPurchased - totalAssigned;

  const flyLicense = flySku ? state.licenses.find((l) => l.sku === flySku) ?? null : null;
  const assignLicense = assignSku ? state.licenses.find((l) => l.sku === assignSku) ?? null : null;
  const addSeatsLicense = addSeatsSku ? state.licenses.find((l) => l.sku === addSeatsSku) ?? null : null;
  const renewalLicense = renewalSku ? state.licenses.find((l) => l.sku === renewalSku) ?? null : null;
  const cancelLicense = cancelSku ? state.licenses.find((l) => l.sku === cancelSku) ?? null : null;
  const buyCatalogEntry = buySku ? BUY_CATALOG.find((c) => c.sku === buySku) ?? null : null;
  const buyExisting = buySku ? state.licenses.find((l) => l.sku === buySku) ?? null : null;

  function openFlyout(sku: string) {
    setFlySku(sku);
    setFlyTab("users");
  }
  function closeFlyout() {
    setFlySku(null);
  }

  function openAssign(sku: string) {
    setAssignSku(sku);
    setAssignChecked(new Set());
  }
  function closeAssign() {
    setAssignSku(null);
  }
  function toggleAssignUser(id: string, checked: boolean) {
    setAssignChecked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function confirmAssign() {
    if (!assignLicense || assignChecked.size === 0) return;
    dispatch({ type: "ASSIGN_LICENSES", ids: Array.from(assignChecked), skus: [assignLicense.sku], assign: true });
    toast.success(`Assigned ${assignLicense.name} to ${assignChecked.size} user(s).`);
    closeAssign();
  }
  function removeAssignment(userId: string, userName: string, sku: string) {
    dispatch({ type: "ASSIGN_LICENSES", ids: [userId], skus: [sku], assign: false });
    toast.success(`License removed from ${userName}.`);
  }

  function openAddSeats(sku: string) {
    setAddSeatsSku(sku);
    setAddSeatsCount(5);
  }
  function closeAddSeats() {
    setAddSeatsSku(null);
  }
  function confirmAddSeats() {
    if (!addSeatsLicense || addSeatsCount <= 0) return;
    dispatch({ type: "ADD_SEATS", sku: addSeatsLicense.sku, count: addSeatsCount });
    toast.success(`${addSeatsCount} seats added to ${addSeatsLicense.name}.`);
    closeAddSeats();
  }

  function openRenewal(sku: string, current?: RenewalMode) {
    setRenewalSku(sku);
    setRenewalChoice(current ?? "Auto-renew");
  }
  function closeRenewal() {
    setRenewalSku(null);
  }
  function confirmRenewal() {
    if (!renewalLicense) return;
    dispatch({ type: "SET_LICENSE_RENEWAL", sku: renewalLicense.sku, renewalMode: renewalChoice });
    toast.success(`Renewal setting updated for ${renewalLicense.name}.`);
    closeRenewal();
  }

  function openCancel(sku: string) {
    setCancelSku(sku);
    setCancelStep(1);
  }
  function closeCancel() {
    setCancelSku(null);
  }
  function confirmCancel() {
    if (!cancelLicense) return;
    dispatch({ type: "CANCEL_LICENSE", sku: cancelLicense.sku });
    toast.warning(`${cancelLicense.name} cancelled. Service ends ${cancelLicense.renewalDate}.`);
    closeCancel();
  }

  function openBuy(sku: string) {
    setBuySku(sku);
    setBuyStep(1);
    setBuySeats(25);
    setBuyTerm("annual");
  }
  function closeBuy() {
    setBuySku(null);
  }
  function commitBuy() {
    if (!buyCatalogEntry || buySeats <= 0) return;
    dispatch({ type: "BUY_LICENSE", sku: buyCatalogEntry.sku, name: buyCatalogEntry.name, seats: buySeats, monthly: buyCatalogEntry.monthly });
    toast.success(`Purchased ${buySeats} seat(s) of ${buyCatalogEntry.name}.`);
    closeBuy();
  }

  const buyPrice = buyCatalogEntry ? buyCatalogEntry.monthly * buySeats : 0;
  const buyPriceUpfront = buyCatalogEntry ? buyCatalogEntry.monthly * buySeats * 12 * 0.95 : 0;

  return (
    <div>
      <h1 className={styles.pageH1}>Licenses</h1>
      <p className={styles.pageSub}>Manage product licenses for your organization.</p>

      <StatRow
        stats={[
          { label: "Total products", value: totalProducts },
          { label: "Total purchased seats", value: totalPurchased },
          { label: "Total assigned", value: totalAssigned },
          { label: "Total available", value: totalAvailable },
        ]}
      />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product name</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Renewal date</th>
            </tr>
          </thead>
          <tbody>
            {state.licenses.map((l) => (
              <tr key={l.sku} onClick={() => openFlyout(l.sku)}>
                <td>
                  <span className={styles.rowLink}>{l.name}</span>
                </td>
                <td>
                  <UsageBar used={assignedCount(l.sku)} total={l.purchased} />
                </td>
                <td>
                  <Pill tone={l.status === "Active" ? "ok" : "muted"}>{l.status}</Pill>
                </td>
                <td>{l.renewalDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.h2}>Purchase services</div>
      <p className={styles.pageSub}>Subscriptions and add-ons available to your tenant.</p>
      <div className={styles.cardGrid}>
        {BUY_CATALOG.map((c) => {
          const existing = state.licenses.find((l) => l.sku === c.sku);
          return (
            <div key={c.sku} className={styles.tile} onClick={() => openBuy(c.sku)}>
              <div className={styles.tileTitle}>{c.name}</div>
              <div className={styles.tileSub}>{c.desc}</div>
              <div className={styles.tileSub} style={{ marginTop: 6 }}>
                ${money(c.monthly)} user/mo{existing ? ` · ${existing.purchased} owned` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {flyLicense ? (
        <Flyout
          title={flyLicense.name}
          onClose={closeFlyout}
          tabs={
            <>
              <button type="button" className={`${styles.subtab} ${flyTab === "users" ? styles.subtabActive : ""}`} onClick={() => setFlyTab("users")}>
                Users
              </button>
              <button type="button" className={`${styles.subtab} ${flyTab === "apps" ? styles.subtabActive : ""}`} onClick={() => setFlyTab("apps")}>
                Apps and services
              </button>
              <button type="button" className={`${styles.subtab} ${flyTab === "settings" ? styles.subtabActive : ""}`} onClick={() => setFlyTab("settings")}>
                Subscription
              </button>
            </>
          }
          footer={
            <button type="button" className={styles.btnOutline} onClick={closeFlyout}>
              Close
            </button>
          }
        >
          {flyTab === "users" ? (
            <div>
              <StatRow
                stats={[
                  { label: "Purchased", value: flyLicense.purchased },
                  { label: "Assigned", value: assignedCount(flyLicense.sku) },
                  { label: "Available", value: flyLicense.purchased - assignedCount(flyLicense.sku) },
                ]}
              />
              <div className={styles.h3}>Assigned users</div>
              <div style={{ marginBottom: 10 }}>
                <button type="button" className={styles.btn} onClick={() => openAssign(flyLicense.sku)}>
                  + Assign to users
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Department</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.users.filter((u) => u.licenses.includes(flyLicense.sku)).length ? (
                      state.users
                        .filter((u) => u.licenses.includes(flyLicense.sku))
                        .map((u) => (
                          <tr key={u.id}>
                            <td>{u.displayName}</td>
                            <td>{u.upn}</td>
                            <td>{u.department || "-"}</td>
                            <td>
                              <button type="button" className={styles.btnSubtle} onClick={() => removeAssignment(u.id, u.displayName, flyLicense.sku)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={4} className={styles.center}>
                          No users have this license assigned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {flyTab === "apps" ? (
            <div>
              <div className={styles.muted} style={{ marginBottom: 10 }}>
                Apps and services included with {flyLicense.name}.
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>App</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appsForSku(flyLicense.sku).map((app) => (
                      <tr key={app}>
                        <td>{app}</td>
                        <td>
                          <Pill tone="ok">On</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {flyTab === "settings" ? (
            <div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Product</div>
                <div>{flyLicense.name}</div>
                <div className={styles.lbl}>SKU</div>
                <div>{flyLicense.sku}</div>
                <div className={styles.lbl}>Status</div>
                <div>
                  <Pill tone={flyLicense.status === "Active" ? "ok" : "muted"}>{flyLicense.status}</Pill>
                </div>
                <div className={styles.lbl}>Billing</div>
                <div>
                  {flyLicense.billingCycle} · ${money(flyLicense.monthly)}/user/month
                </div>
                <div className={styles.lbl}>Purchased</div>
                <div>{flyLicense.purchaseDate}</div>
                <div className={styles.lbl}>Renews</div>
                <div>{flyLicense.renewalDate}</div>
                <div className={styles.lbl}>Renewal mode</div>
                <div>{flyLicense.renewalMode ?? "Auto-renew"}</div>
                <div className={styles.lbl}>Total cost</div>
                <div>${money(flyLicense.monthly * flyLicense.purchased)} / month</div>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className={styles.btnOutline} onClick={() => openAddSeats(flyLicense.sku)}>
                  Add more seats
                </button>
                <button type="button" className={styles.btnOutline} onClick={() => openRenewal(flyLicense.sku, flyLicense.renewalMode)}>
                  Manage renewal
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => openCancel(flyLicense.sku)}>
                  Cancel subscription
                </button>
              </div>
            </div>
          ) : null}
        </Flyout>
      ) : null}

      {assignLicense ? (
        <Modal
          title={`Assign ${assignLicense.name}`}
          onClose={closeAssign}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={closeAssign}>
                Cancel
              </button>
              <button type="button" className={styles.btn} disabled={assignChecked.size === 0} onClick={confirmAssign}>
                Save
              </button>
            </>
          }
        >
          <div className={styles.muted} style={{ marginBottom: 8 }}>
            {assignLicense.purchased - assignedCount(assignLicense.sku)} license(s) available.
          </div>
          <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid #edebe9", borderRadius: 3, padding: 8 }}>
            {state.users
              .filter((u) => !u.licenses.includes(assignLicense.sku))
              .map((u) => {
                const available = assignLicense.purchased - assignedCount(assignLicense.sku);
                const wouldExceed = !assignChecked.has(u.id) && assignChecked.size >= available;
                return (
                  <label key={u.id} className={styles.checkboxRow} style={{ borderBottom: "1px solid #f3f2f1", padding: "4px 0" }}>
                    <input
                      type="checkbox"
                      checked={assignChecked.has(u.id)}
                      disabled={wouldExceed}
                      onChange={(e) => toggleAssignUser(u.id, e.target.checked)}
                    />
                    <span style={{ flex: 1 }}>
                      {u.displayName} <span className={styles.muted}>({u.upn})</span>
                    </span>
                  </label>
                );
              })}
          </div>
        </Modal>
      ) : null}

      {addSeatsLicense ? (
        <Modal
          title={`Add seats — ${addSeatsLicense.name}`}
          onClose={closeAddSeats}
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={closeAddSeats}>
                Cancel
              </button>
              <button type="button" className={styles.btn} disabled={addSeatsCount <= 0} onClick={confirmAddSeats}>
                Purchase
              </button>
            </>
          }
        >
          <p className={styles.muted} style={{ marginBottom: 10 }}>
            Current seats: <strong>{addSeatsLicense.purchased}</strong>
          </p>
          <FormGroup label="Add how many seats?" help="Charges will be prorated.">
            <input
              type="number"
              className={styles.input}
              min={1}
              value={addSeatsCount}
              onChange={(e) => setAddSeatsCount(parseInt(e.target.value, 10) || 0)}
            />
          </FormGroup>
        </Modal>
      ) : null}

      {renewalLicense ? (
        <Modal
          title={`Manage renewal — ${renewalLicense.sku}`}
          onClose={closeRenewal}
          width="560px"
          footer={
            <>
              <button type="button" className={styles.btnOutline} onClick={closeRenewal}>
                Cancel
              </button>
              <button type="button" className={styles.btn} onClick={confirmRenewal}>
                Save
              </button>
            </>
          }
        >
          <div className={styles.muted} style={{ marginBottom: 16 }}>
            Current renewal: <strong>{renewalLicense.renewalDate}</strong> · {renewalLicense.purchased} seats · ${money(renewalLicense.monthly)}/seat/mo
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <label className={styles.radioRow} style={{ alignItems: "flex-start" }}>
              <input type="radio" name="renewal" checked={renewalChoice === "Auto-renew"} onChange={() => setRenewalChoice("Auto-renew")} />
              <span>
                <b>Turn on recurring billing (auto-renew)</b>
                <div className={styles.formHelp}>Renews automatically at end of term. Payment method on file is charged.</div>
              </span>
            </label>
            <label className={styles.radioRow} style={{ alignItems: "flex-start" }}>
              <input type="radio" name="renewal" checked={renewalChoice === "Manual"} onChange={() => setRenewalChoice("Manual")} />
              <span>
                <b>Manual renewal</b>
                <div className={styles.formHelp}>Subscription expires unless you renew before {renewalLicense.renewalDate}. Service stops within 90 days.</div>
              </span>
            </label>
            <label className={styles.radioRow} style={{ alignItems: "flex-start" }}>
              <input type="radio" name="renewal" checked={renewalChoice === "Cancel at end of term"} onChange={() => setRenewalChoice("Cancel at end of term")} />
              <span>
                <b>Cancel at end of term</b>
                <div className={styles.formHelp}>Disables auto-renew and schedules cancellation on {renewalLicense.renewalDate}.</div>
              </span>
            </label>
          </div>
          <div style={{ marginTop: 14, padding: "10px 12px", background: "#fff4ce", borderLeft: "3px solid #ffaa44", fontSize: 12, color: "#3b3a39" }}>
            Tip: Microsoft requires 60 days notice for annual term cancellations to avoid early-termination fees.
          </div>
        </Modal>
      ) : null}

      {cancelLicense ? (
        <Modal
          title={cancelStep === 1 ? `Cancel ${cancelLicense.sku}?` : "Confirm cancellation"}
          onClose={closeCancel}
          width="560px"
          footer={
            cancelStep === 1 ? (
              <>
                <button type="button" className={styles.btnOutline} onClick={closeCancel}>
                  Keep subscription
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setCancelStep(2)}>
                  Continue
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.btnOutline} onClick={() => setCancelStep(1)}>
                  Back
                </button>
                <button type="button" className={styles.btnDanger} onClick={confirmCancel}>
                  Confirm cancellation
                </button>
              </>
            )
          }
        >
          {cancelStep === 1 ? (
            <div>
              <div style={{ marginBottom: 14 }}>
                <strong>{assignedCount(cancelLicense.sku)}</strong> user(s) currently assigned. They will lose access on {cancelLicense.renewalDate}.
              </div>
              <div className={styles.muted}>
                Cancellation policy:
                <ul style={{ margin: "6px 0 0 18px" }}>
                  <li>Within 7 days of purchase: full refund.</li>
                  <li>After 7 days: prorated refund of paid term.</li>
                  <li>Annual term: 25% early-termination fee may apply.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              This will permanently cancel <strong>{cancelLicense.name}</strong> ({cancelLicense.purchased} seats). This action cannot be undone from this
              screen.
            </div>
          )}
        </Modal>
      ) : null}

      {buyCatalogEntry ? (
        <Modal
          title={`Buy ${buyCatalogEntry.name}`}
          onClose={closeBuy}
          width="600px"
          steps={
            <>
              <WizStep label="1. Seats" active={buyStep === 1} done={buyStep > 1} />
              <WizStep label="2. Payment term" active={buyStep === 2} done={buyStep > 2} />
              <WizStep label="3. Review" active={buyStep === 3} done={false} />
            </>
          }
          footer={
            <>
              {buyStep > 1 ? (
                <button type="button" className={styles.btnOutline} onClick={() => setBuyStep((s) => (s === 3 ? 2 : 1))}>
                  Back
                </button>
              ) : (
                <button type="button" className={styles.btnOutline} onClick={closeBuy}>
                  Cancel
                </button>
              )}
              {buyStep < 3 ? (
                <button type="button" className={styles.btn} disabled={buyStep === 1 && buySeats <= 0} onClick={() => setBuyStep((s) => (s === 1 ? 2 : 3))}>
                  Next
                </button>
              ) : (
                <button type="button" className={styles.btn} onClick={commitBuy}>
                  Place order
                </button>
              )}
            </>
          }
        >
          {buyStep === 1 ? (
            <div>
              <div style={{ marginBottom: 10 }}>{buyCatalogEntry.desc}</div>
              <div style={{ marginBottom: 18 }}>
                <b>${money(buyCatalogEntry.monthly)}</b> per user / month{buyExisting ? ` · you already own ${buyExisting.purchased} seat(s)` : ""}
              </div>
              <FormGroup label="Number of seats">
                <input
                  type="number"
                  className={styles.input}
                  min={1}
                  value={buySeats}
                  onChange={(e) => setBuySeats(parseInt(e.target.value, 10) || 0)}
                />
              </FormGroup>
            </div>
          ) : null}

          {buyStep === 2 ? (
            <div style={{ display: "grid", gap: 12 }}>
              <label className={styles.radioRow} style={{ border: `1px solid ${buyTerm === "monthly" ? "#0078d4" : "#edebe9"}`, borderRadius: 4, padding: 12 }}>
                <input type="radio" name="term" checked={buyTerm === "monthly"} onChange={() => setBuyTerm("monthly")} />
                <span>
                  <b>Monthly</b> · ${money(buyPrice)} / month · no commitment, cancel anytime, ~20% higher unit price
                </span>
              </label>
              <label className={styles.radioRow} style={{ border: `1px solid ${buyTerm === "annual" ? "#0078d4" : "#edebe9"}`, borderRadius: 4, padding: 12 }}>
                <input type="radio" name="term" checked={buyTerm === "annual"} onChange={() => setBuyTerm("annual")} />
                <span>
                  <b>Annual (paid monthly)</b> · ${money(buyPrice)} / month for 12 months · most common for tenants
                </span>
              </label>
              <label
                className={styles.radioRow}
                style={{ border: `1px solid ${buyTerm === "annual-upfront" ? "#0078d4" : "#edebe9"}`, borderRadius: 4, padding: 12 }}
              >
                <input type="radio" name="term" checked={buyTerm === "annual-upfront"} onChange={() => setBuyTerm("annual-upfront")} />
                <span>
                  <b>Annual (paid upfront)</b> · ${money(buyPriceUpfront)} charged today · 5% discount
                </span>
              </label>
            </div>
          ) : null}

          {buyStep === 3 ? (
            <div>
              <div className={styles.reviewGrid}>
                <div className={styles.lbl}>Product</div>
                <div>{buyCatalogEntry.name}</div>
                <div className={styles.lbl}>Seats</div>
                <div>{buySeats}</div>
                <div className={styles.lbl}>Unit price</div>
                <div>${money(buyCatalogEntry.monthly)} / user / month</div>
                <div className={styles.lbl}>Payment term</div>
                <div>{buyTerm}</div>
                <div className={styles.lbl}>Total now</div>
                <div>${money(buyTerm === "annual-upfront" ? buyPriceUpfront : buyPrice)}</div>
              </div>
              <div style={{ marginTop: 14, padding: "10px 12px", background: "#dff6dd", borderLeft: "3px solid #107c10", fontSize: 12 }}>
                Order will be added to your subscriptions immediately. Seats are ready to assign within 5 minutes.
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
