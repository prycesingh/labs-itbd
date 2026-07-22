"use client";

import { useMemo, useState } from "react";

import type { AzureResource } from "@/lib/labs/simulators/azure/azureState";
import { SUBSCRIPTION } from "@/lib/labs/simulators/azure/vmData";
import type { RgResource } from "@/lib/labs/simulators/azure/rgTypes";
import styles from "./azure-portal.module.css";
import { Callout, PropPair } from "./wizard-fields";

const SECTIONS = [
  {
    group: "",
    items: [
      { id: "overview", label: "Overview" },
      { id: "activity", label: "Activity log" },
      { id: "iam", label: "Access control (IAM)" },
      { id: "tags", label: "Tags" },
    ],
  },
  {
    group: "Settings",
    items: [
      { id: "deployments", label: "Deployments" },
      { id: "properties", label: "Properties" },
      { id: "locks", label: "Locks" },
    ],
  },
  {
    group: "Cost Management",
    items: [
      { id: "cost", label: "Cost analysis" },
      { id: "advisor", label: "Advisor recommendations" },
    ],
  },
] as const;

function statusLabel(resource: AzureResource): string {
  if (resource.resourceType === "VirtualMachine") return resource.status;
  return "Succeeded";
}

export function RgDetailBlade({
  rg,
  resourcesInGroup,
  onBack,
  onDelete,
  onAddTag,
  onDeleteTag,
  onOpenResource,
}: {
  rg: RgResource;
  resourcesInGroup: AzureResource[];
  onBack: () => void;
  onDelete: () => void;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
  onOpenResource: (id: string) => void;
}) {
  const [section, setSection] = useState("overview");

  return (
    <div className={styles.blade}>
      <div className={styles.bladeTitlebar}>
        <button type="button" className={styles.actBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>
        <div className={styles.bladeIcon} style={{ background: "#3999c6" }}>
          RG
        </div>
        <div style={{ flex: 1 }}>
          <h1>{rg.name}</h1>
          <p className={styles.bladeSub}>Resource group</p>
        </div>
        <div className={styles.bladeActions}>
          <button type="button" className={`${styles.actBtn} ${styles.actBtnDelete}`} onClick={onDelete}>
            🗑 Delete resource group
          </button>
        </div>
      </div>

      <div className={styles.bladeFrame}>
        <aside className={styles.bladeNav}>
          {SECTIONS.map((grp) => (
            <div key={grp.group || "root"}>
              {grp.group ? <div className={styles.bladeHeading}>{grp.group}</div> : null}
              {grp.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`${styles.bladeItem} ${section === item.id ? styles.bladeItemActive : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main className={styles.bladeMain}>
          {section === "overview" && (
            <SecOverview rg={rg} resourcesInGroup={resourcesInGroup} onOpenResource={onOpenResource} onEditTags={() => setSection("tags")} />
          )}
          {section === "activity" && <SecActivity />}
          {section === "iam" && <SecIAM />}
          {section === "tags" && <SecTags rg={rg} onAddTag={onAddTag} onDeleteTag={onDeleteTag} />}
          {section === "deployments" && <SecDeployments />}
          {section === "properties" && <SecProperties rg={rg} />}
          {section === "locks" && <SecLocks />}
          {section === "cost" && <SecCost resourcesInGroup={resourcesInGroup} />}
          {section === "advisor" && <SecAdvisor resourcesInGroup={resourcesInGroup} />}
        </main>
      </div>
    </div>
  );
}

function SecOverview({
  rg,
  resourcesInGroup,
  onOpenResource,
  onEditTags,
}: {
  rg: RgResource;
  resourcesInGroup: AzureResource[];
  onOpenResource: (id: string) => void;
  onEditTags: () => void;
}) {
  return (
    <>
      <div className={styles.sectionCard}>
        <h3>Essentials</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <PropPair label="Subscription" value={SUBSCRIPTION.name} />
          <PropPair label="Subscription ID" value={SUBSCRIPTION.id} />
          <PropPair label="Location" value={rg.region} />
          <PropPair label="Deployments" value="0 succeeded" />
          <PropPair label="Resources" value={resourcesInGroup.length} />
          <PropPair label="Created on" value={new Date(rg.createdAt).toLocaleString()} />
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3 style={{ display: "flex", justifyContent: "space-between" }}>
          Tags
          <button type="button" className={styles.link} onClick={onEditTags}>
            Edit
          </button>
        </h3>
        {Object.keys(rg.tags).length === 0 ? (
          <p>No tags</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(rg.tags).map(([k, v]) => (
              <span key={k} className={`${styles.badge} ${styles.badgeOutline}`}>
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.sectionCard}>
        <h3>Resources ({resourcesInGroup.length})</h3>
        {resourcesInGroup.length === 0 ? (
          <p>
            No resources in this group yet.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {resourcesInGroup.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button type="button" className={styles.link} onClick={() => onOpenResource(r.id)}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.resourceType === "VirtualMachine" ? "Virtual machine" : r.resourceType}</td>
                  <td>{r.region}</td>
                  <td>
                    <span className={`${styles.badge} ${statusLabel(r) === "Running" || statusLabel(r) === "Succeeded" ? styles.badgeRunning : styles.badgeStopped}`}>
                      {statusLabel(r)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function SecActivity() {
  return (
    <div className={styles.sectionCard}>
      <h3>Activity log</h3>
      <p>Recent operations across resources in this group.</p>
    </div>
  );
}

function SecIAM() {
  return (
    <div className={styles.sectionCard}>
      <h3>Access control (IAM)</h3>
      <p style={{ fontWeight: 600 }}>Built-in roles applicable at resource group scope:</p>
      <ul style={{ paddingLeft: 20, fontSize: 13, color: "#605e5c", lineHeight: 1.8 }}>
        <li>Owner — Full access including delegation</li>
        <li>Contributor — Full access except delegation</li>
        <li>Reader — View-only access</li>
        <li>User Access Administrator — Manage user access to resources</li>
      </ul>
    </div>
  );
}

function SecTags({
  rg,
  onAddTag,
  onDeleteTag,
}: {
  rg: RgResource;
  onAddTag: (key: string, value: string) => void;
  onDeleteTag: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div className={styles.sectionCard}>
      <h3>Tags</h3>
      <Callout tone="info">
        Tags on a resource group are <b>not</b> inherited by the resources it contains.
      </Callout>
      <table className={styles.table} style={{ marginTop: 12, marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Object.keys(rg.tags).length === 0 ? (
            <tr>
              <td colSpan={3}>No tags. Add one below.</td>
            </tr>
          ) : (
            Object.entries(rg.tags).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
                <td>
                  <button type="button" className={styles.link} onClick={() => onDeleteTag(k)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Name"
          className={styles.input}
          style={{ width: 160 }}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          className={styles.input}
          style={{ width: 160 }}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (!key) return;
            onAddTag(key, value);
            setKey("");
            setValue("");
          }}
        >
          Add tag
        </button>
      </div>
    </div>
  );
}

function SecDeployments() {
  return (
    <div className={styles.sectionCard}>
      <h3>Deployments</h3>
      <p>Each Azure Resource Manager (ARM) or Bicep deployment is recorded here for 30 days.</p>
      <p>No deployments to show.</p>
    </div>
  );
}

function SecProperties({ rg }: { rg: RgResource }) {
  return (
    <div className={styles.sectionCard}>
      <h3>Essentials</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PropPair label="Resource ID" value={`/subscriptions/${SUBSCRIPTION.id}/resourceGroups/${rg.name}`} />
        <PropPair label="Subscription" value={SUBSCRIPTION.name} />
        <PropPair label="Location" value={rg.region} />
        <PropPair label="Provisioning state" value="Succeeded" />
        <PropPair label="Created on" value={new Date(rg.createdAt).toISOString()} />
      </div>
    </div>
  );
}

function SecLocks() {
  return (
    <div className={styles.sectionCard}>
      <h3>Locks</h3>
      <p>Locks prevent other users from accidentally deleting or modifying critical resources in this group.</p>
      <button type="button" className={styles.btn}>
        + Add
      </button>
      <p style={{ marginTop: 12 }}>No locks defined for this resource group.</p>
    </div>
  );
}

function SecCost({ resourcesInGroup }: { resourcesInGroup: AzureResource[] }) {
  const total = resourcesInGroup.reduce((a, r) => a + r.estimatedCost, 0);
  return (
    <div className={styles.sectionCard}>
      <h3>Cost analysis</h3>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#0078d4", margin: "8px 0" }}>
        ${total.toFixed(2)}{" "}
        <span style={{ fontSize: 14, color: "#605e5c", fontWeight: 400 }}>/ month (estimated)</span>
      </div>
      <p>Breakdown by resource:</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Type</th>
            <th>Cost/mo</th>
          </tr>
        </thead>
        <tbody>
          {resourcesInGroup.length === 0 ? (
            <tr>
              <td colSpan={3}>No resources to bill</td>
            </tr>
          ) : (
            resourcesInGroup.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.resourceType}</td>
                <td>${r.estimatedCost.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SecAdvisor({ resourcesInGroup }: { resourcesInGroup: AzureResource[] }) {
  const recs = useMemo(() => {
    const list: { resource: string; category: string; text: string }[] = [];
    resourcesInGroup.forEach((r) => {
      if (r.resourceType === "VirtualMachine" && r.status === "Stopped") {
        list.push({
          resource: r.name,
          category: "Cost",
          text: "VM is stopped but storage is still being billed. Delete if no longer needed.",
        });
      }
      if (r.resourceType === "VirtualMachine" && !r.enableBackup) {
        list.push({ resource: r.name, category: "Reliability", text: "Enable Azure Backup to protect this VM." });
      }
      if (Object.keys(r.tags).length === 0) {
        list.push({
          resource: r.name,
          category: "Governance",
          text: 'Resource has no tags. Add at least an "environment" and "owner" tag.',
        });
      }
    });
    return list;
  }, [resourcesInGroup]);

  return (
    <div className={styles.sectionCard}>
      <h3>Advisor recommendations</h3>
      <p>
        Personalized best-practice recommendations across cost, security, reliability, performance, and
        operational excellence.
      </p>
      {recs.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <Callout tone="info">No recommendations at this time. Great job!</Callout>
        </div>
      ) : (
        <table className={styles.table} style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Resource</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((rc, i) => (
              <tr key={i}>
                <td>{rc.category}</td>
                <td>{rc.resource}</td>
                <td>{rc.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
