"use client";

import { useState } from "react";

import type {
  StorageDefenderConfig,
  StorageFrontDoorProfile,
  StorageIpRule,
  StoragePrivateEndpoint,
  StorageResource,
  StorageVnetRule,
} from "@/lib/labs/simulators/azure/storageTypes";
import styles from "./azure-portal.module.css";
import { Field, NativeSelect } from "./wizard-fields";

export function SecNetworking({
  sa,
  onSetAccess,
  onAddVnetRule,
  onDeleteVnetRule,
  onAddIpRule,
  onDeleteIpRule,
  onAddPE,
  onDeletePE,
}: {
  sa: StorageResource;
  onSetAccess: (value: string) => void;
  onAddVnetRule: (rule: StorageVnetRule) => void;
  onDeleteVnetRule: (index: number) => void;
  onAddIpRule: (rule: StorageIpRule) => void;
  onDeleteIpRule: (index: number) => void;
  onAddPE: (endpoint: StoragePrivateEndpoint) => void;
  onDeletePE: (index: number) => void;
}) {
  const [vnet, setVnet] = useState("");
  const [subnet, setSubnet] = useState("subnet-app");
  const [range, setRange] = useState("10.10.1.0/24");
  const [ipCidr, setIpCidr] = useState("");
  const [ipLabel, setIpLabel] = useState("");
  const [peName, setPeName] = useState("");
  const [peVnet, setPeVnet] = useState("");
  const [peSubnet, setPeSubnet] = useState("subnet-pe");
  const [peSub, setPeSub] = useState("blob");

  return (
    <>
      <div className={styles.sectionCard} style={{ marginTop: 0 }}>
        <h3>Public network access</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className={styles.checkboxRow}>
            <input type="radio" name="netAcc" checked={sa.networkAccess === "Enable from all networks"} onChange={() => onSetAccess("Enable from all networks")} />
            Enabled from all networks
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="radio"
              name="netAcc"
              checked={sa.networkAccess.includes("selected")}
              onChange={() => onSetAccess("Enabled from selected virtual networks and IP addresses")}
            />
            Enabled from selected virtual networks and IP addresses
          </label>
          <label className={styles.checkboxRow}>
            <input type="radio" name="netAcc" checked={sa.networkAccess.includes("Disable")} onChange={() => onSetAccess("Disabled")} />
            Disabled
          </label>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Virtual networks</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Virtual network</th>
              <th>Subnet</th>
              <th>Address range</th>
              <th>Endpoint status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sa.networkVnets.length === 0 ? (
              <tr>
                <td colSpan={5}>No virtual networks configured.</td>
              </tr>
            ) : (
              sa.networkVnets.map((v, i) => (
                <tr key={i}>
                  <td>{v.vnet}</td>
                  <td>{v.subnet}</td>
                  <td>{v.range}</td>
                  <td>
                    <span className={`${styles.containerPublic} ${styles.containerPublicBlob}`}>{v.endpointStatus}</span>
                  </td>
                  <td>
                    <button type="button" className={styles.link} onClick={() => onDeleteVnetRule(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Virtual network">
              <input value={vnet} onChange={(e) => setVnet(e.target.value)} placeholder="vnet-prod-eastus2" className={styles.input} />
            </Field>
            <Field label="Subnet">
              <input value={subnet} onChange={(e) => setSubnet(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Address range">
              <input value={range} onChange={(e) => setRange(e.target.value)} className={styles.input} />
            </Field>
          </div>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              if (!vnet) return;
              onAddVnetRule({ vnet, subnet, range, endpointStatus: "Enabled" });
              setVnet("");
            }}
          >
            + Add existing virtual network
          </button>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Firewall — IP rules</h3>
        <p>
          <b>Address range:</b> Add IP address ranges that will have access to this storage account.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>IP address or CIDR</th>
              <th>Label</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sa.networkIps.length === 0 ? (
              <tr>
                <td colSpan={3}>No IP rules configured.</td>
              </tr>
            ) : (
              sa.networkIps.map((ip, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "Consolas, monospace" }}>{ip.cidr}</td>
                  <td>{ip.label}</td>
                  <td>
                    <button type="button" className={styles.link} onClick={() => onDeleteIpRule(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={ipCidr} onChange={(e) => setIpCidr(e.target.value)} placeholder="203.0.113.0/24" className={styles.input} style={{ width: 200 }} />
          <input value={ipLabel} onChange={(e) => setIpLabel(e.target.value)} placeholder="Label (optional)" className={styles.input} style={{ width: 200 }} />
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => {
              if (!ipCidr) return;
              onAddIpRule({ cidr: ipCidr, label: ipLabel });
              setIpCidr("");
              setIpLabel("");
            }}
          >
            + Add IP range
          </button>
        </div>
      </div>
      <div className={styles.sectionCard}>
        <h3>Private endpoint connections</h3>
        <p>Private endpoints connect this storage account into your VNet using a private IP. The traffic doesn&apos;t traverse the internet.</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>VNet / subnet</th>
              <th>Target sub-resource</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sa.privateEndpoints.length === 0 ? (
              <tr>
                <td colSpan={5}>No private endpoint connections.</td>
              </tr>
            ) : (
              sa.privateEndpoints.map((pe, i) => (
                <tr key={i}>
                  <td>{pe.name}</td>
                  <td>
                    {pe.vnet} / {pe.subnet}
                  </td>
                  <td>{pe.targetSubResource}</td>
                  <td>
                    <span className={`${styles.containerPublic} ${styles.containerPublicBlob}`}>{pe.status}</span>
                  </td>
                  <td>
                    <button type="button" className={styles.link} onClick={() => onDeletePE(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.miniForm}>
          <div className={styles.ruleGrid}>
            <Field label="Name">
              <input value={peName} onChange={(e) => setPeName(e.target.value)} placeholder={`${sa.name}-pe`} className={styles.input} />
            </Field>
            <Field label="VNet">
              <input value={peVnet} onChange={(e) => setPeVnet(e.target.value)} placeholder="vnet-prod-eastus2" className={styles.input} />
            </Field>
            <Field label="Subnet">
              <input value={peSubnet} onChange={(e) => setPeSubnet(e.target.value)} className={styles.input} />
            </Field>
            <Field label="Target sub-resource">
              <NativeSelect value={peSub} onChange={setPeSub}>
                <option value="blob">blob</option>
                <option value="file">file</option>
                <option value="queue">queue</option>
                <option value="table">table</option>
                <option value="dfs">dfs</option>
                <option value="web">web</option>
              </NativeSelect>
            </Field>
          </div>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              if (!peName || !peVnet) return;
              onAddPE({ name: peName, vnet: peVnet, subnet: peSubnet, targetSubResource: peSub, status: "Approved" });
              setPeName("");
              setPeVnet("");
            }}
          >
            + Add private endpoint
          </button>
        </div>
      </div>
    </>
  );
}

export function SecFrontDoor({
  sa,
  onLink,
  onPurge,
  onUnlink,
}: {
  sa: StorageResource;
  onLink: (profile: StorageFrontDoorProfile) => void;
  onPurge: () => void;
  onUnlink: () => void;
}) {
  const [profile, setProfile] = useState(`afd-${sa.name}`);
  const [sku, setSku] = useState("Standard");
  const [waf, setWaf] = useState("wafp-default-prod");

  if (sa.frontDoorProfile) {
    const p = sa.frontDoorProfile;
    return (
      <div className={styles.sectionCard}>
        <h3>Front Door and CDN</h3>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>Profile</td>
              <td>
                <strong>{p.profile}</strong>
              </td>
            </tr>
            <tr>
              <td>Endpoint</td>
              <td>
                <code style={{ fontSize: 11 }}>{p.endpoint}.azurefd.net</code>
              </td>
            </tr>
            <tr>
              <td>SKU</td>
              <td>{p.sku}</td>
            </tr>
            <tr>
              <td>Origin</td>
              <td>{sa.name}.blob.core.windows.net</td>
            </tr>
            <tr>
              <td>WAF policy</td>
              <td>{p.waf}</td>
            </tr>
            <tr>
              <td>Caching</td>
              <td>{p.caching}</td>
            </tr>
            <tr>
              <td>Status</td>
              <td>
                <span className={`${styles.containerPublic} ${styles.containerPublicBlob}`}>Healthy</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button type="button" className={styles.btnOutline} onClick={onPurge}>
            Purge cache
          </button>
          <button type="button" className={styles.btnOutline} onClick={onUnlink}>
            Unlink Front Door
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <h3>Front Door and CDN</h3>
      <p>No Azure Front Door profile linked. Front Door accelerates global content delivery + adds WAF protection.</p>
      <div className={styles.miniForm}>
        <div className={styles.ruleGrid}>
          <Field label="Profile name">
            <input value={profile} onChange={(e) => setProfile(e.target.value)} className={styles.input} />
          </Field>
          <Field label="SKU">
            <NativeSelect value={sku} onChange={setSku}>
              <option>Standard</option>
              <option>Premium</option>
            </NativeSelect>
          </Field>
          <Field label="WAF policy">
            <input value={waf} onChange={(e) => setWaf(e.target.value)} className={styles.input} />
          </Field>
        </div>
        <button
          type="button"
          className={styles.btn}
          onClick={() => onLink({ profile, endpoint: profile, sku, waf: waf || "None", caching: "Standard caching enabled" })}
        >
          + Link a Front Door profile
        </button>
      </div>
    </div>
  );
}

export function SecDefender({
  sa,
  onToggle,
  onSetPlan,
}: {
  sa: StorageResource;
  onToggle: (key: keyof StorageDefenderConfig, value: boolean) => void;
  onSetPlan: (plan: StorageDefenderConfig["plan"]) => void;
}) {
  const def = sa.defenderForStorage;
  return (
    <div className={styles.sectionCard}>
      <h3>Microsoft Defender for Storage</h3>
      <p>Detects unusual or potentially harmful attempts to access or exploit storage accounts. Optional malware scanning + sensitive data discovery.</p>
      <table className={styles.table}>
        <tbody>
          <tr>
            <td style={{ width: 280 }}>Defender for Storage</td>
            <td>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={def.enabled} onChange={(e) => onToggle("enabled", e.target.checked)} />
                Enabled
              </label>
            </td>
          </tr>
          <tr>
            <td>Plan</td>
            <td>
              <NativeSelect value={def.plan} onChange={(v) => onSetPlan(v as StorageDefenderConfig["plan"])}>
                <option>On-upload</option>
                <option>Per-transaction</option>
              </NativeSelect>
            </td>
          </tr>
          <tr>
            <td>Sensitive data discovery</td>
            <td>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={def.sensitiveDataDiscovery} onChange={(e) => onToggle("sensitiveDataDiscovery", e.target.checked)} />
                Discover PII, PCI, PHI in uploaded blobs
              </label>
            </td>
          </tr>
          <tr>
            <td>Malware scanning</td>
            <td>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={def.malwareScanning} onChange={(e) => onToggle("malwareScanning", e.target.checked)} />
                Scan blobs on upload (1MB-2GB)
              </label>
            </td>
          </tr>
          <tr>
            <td>Last scan</td>
            <td>{def.enabled ? "just now" : "-"}</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.help} style={{ marginTop: 12 }}>
        <b>Cost:</b> ~$10 per storage account per month. Malware scanning adds ~$0.15 / GB scanned. Sensitive data discovery free preview.
      </p>
    </div>
  );
}
