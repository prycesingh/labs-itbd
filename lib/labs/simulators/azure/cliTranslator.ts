import type { VmWizardState } from "./wizardState";
import type { RgWizardState } from "./rgWizardState";
import type { StorageWizardState } from "./storageWizardState";
import type { VnetWizardState } from "./vnetWizardState";
import type { NsgWizardState } from "./nsgWizardState";
import type { NsgRule } from "./nsgTypes";
import type { AppServiceWizardState } from "./appServiceWizardState";
import type { LbWizardState } from "./lbWizardState";
import type { SqlWizardState } from "./sqlWizardState";

function quote(value: string | null | undefined): string {
  if (value == null) return '""';
  const s = String(value);
  if (/[\s"'$`\\]/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

function continuation(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(" \\\n    ");
}

function region(r: string): string {
  return (r || "").replace(/^\([^)]+\)\s*/, "").toLowerCase().replace(/\s+/g, "");
}

const VM_IMAGE_MAP: Record<string, string> = {
  "ubuntu-22-04": "Ubuntu2204",
  "ubuntu-20-04": "Ubuntu2004",
  win2022: "Win2022Datacenter",
  win2019: "Win2019Datacenter",
  rhel9: "RHELRaw9LVM",
  debian12: "Debian12",
  "win11-ent": "win11-23h2-ent",
  sqlsvr: "MicrosoftSQLServer:sql2022-ws2022:enterprise:latest",
};

export function cliFromVm(s: VmWizardState): string {
  const image = VM_IMAGE_MAP[s.image] ?? s.image;
  const cmd = continuation([
    "az vm create",
    `--name ${quote(s.vmName)}`,
    `--resource-group ${quote(s.resourceGroup)}`,
    `--location ${quote(region(s.region))}`,
    `--image ${quote(image)}`,
    `--size ${quote(s.size)}`,
    `--admin-username ${quote(s.username)}`,
    s.authType === "Password" ? `--admin-password ${quote(s.password || "P@ssw0rd-replace-me!")}` : "--generate-ssh-keys",
    s.inboundPorts === "Allow selected ports" && s.selectedPorts.length > 0
      ? `--nsg-rule ${s.selectedPorts.includes("SSH (22)") ? "SSH" : s.selectedPorts.includes("RDP (3389)") ? "RDP" : "NONE"}`
      : null,
    s.acceleratedNetworking ? "--accelerated-networking true" : null,
    s.osDiskType ? `--storage-sku ${s.osDiskType}` : null,
    s.tags.filter((t) => t.key).length > 0
      ? `--tags ${s.tags.filter((t) => t.key).map((t) => quote(`${t.key}=${t.value}`)).join(" ")}`
      : null,
  ]);

  const extras: string[] = [];
  if (s.enableAutoShutdown) {
    extras.push("# Configure auto-shutdown");
    extras.push(`az vm auto-shutdown -g ${quote(s.resourceGroup)} -n ${quote(s.vmName)} --time ${(s.autoShutdownTime || "1900").replace(":", "")}`);
  }
  if (s.enableBackup) {
    extras.push("# Enable Azure Backup (requires existing Recovery Services Vault)");
    extras.push(
      `az backup protection enable-for-vm \\\n    --resource-group ${quote(s.resourceGroup)} \\\n    --vault-name <vault-name> \\\n    --vm ${quote(s.vmName)} \\\n    --policy-name DefaultPolicy`,
    );
  }
  return cmd + (extras.length ? `\n\n${extras.join("\n\n")}` : "");
}

export function cliFromRg(s: RgWizardState): string {
  const tags = s.tags.filter((t) => t.key);
  return continuation([
    "az group create",
    `--name ${quote(s.name)}`,
    `--location ${quote(region(s.region))}`,
    tags.length > 0 ? `--tags ${tags.map((t) => quote(`${t.key}=${t.value}`)).join(" ")}` : null,
  ]);
}

export function cliFromStorage(s: StorageWizardState): string {
  const tags = s.tags.filter((t) => t.key);
  const skuPrefix = s.performance === "Premium" ? "Premium" : "Standard";
  return continuation([
    "az storage account create",
    `--name ${quote(s.storageName)}`,
    `--resource-group ${quote(s.resourceGroup)}`,
    `--location ${quote(region(s.region))}`,
    `--sku ${skuPrefix}_${s.redundancy.replace(/-/g, "")}`,
    `--kind ${s.primaryService === "Azure Files" ? "FileStorage" : "StorageV2"}`,
    s.tlsVersion ? `--min-tls-version ${s.tlsVersion.replace("Version ", "TLS1_").replace(".", "_")}` : null,
    s.secureTransfer === false ? "--https-only false" : "--https-only true",
    s.hierarchicalNamespace ? "--enable-hierarchical-namespace true" : null,
    s.accessTier ? `--access-tier ${s.accessTier}` : null,
    tags.length > 0 ? `--tags ${tags.map((t) => quote(`${t.key}=${t.value}`)).join(" ")}` : null,
  ]);
}

export function cliFromVnet(s: VnetWizardState): string {
  const addressSpace = s.addressSpaces.length > 0 ? s.addressSpaces : ["10.0.0.0/16"];
  const subnet0 = s.subnets[0] ?? { name: "default", addressRange: "10.0.0.0/24" };
  const commands: string[] = [];

  commands.push(
    continuation([
      "az network vnet create",
      `--name ${quote(s.vnetName)}`,
      `--resource-group ${quote(s.resourceGroup)}`,
      `--location ${quote(region(s.region))}`,
      `--address-prefixes ${addressSpace.join(" ")}`,
      `--subnet-name ${quote(subnet0.name)}`,
      `--subnet-prefix ${quote(subnet0.addressRange)}`,
    ]),
  );

  if (s.subnets.length > 1) {
    commands.push("# Add additional subnets");
    for (let i = 1; i < s.subnets.length; i++) {
      const sn = s.subnets[i];
      commands.push(
        continuation([
          "az network vnet subnet create",
          `--name ${quote(sn.name)}`,
          `--vnet-name ${quote(s.vnetName)}`,
          `--resource-group ${quote(s.resourceGroup)}`,
          `--address-prefixes ${quote(sn.addressRange)}`,
        ]),
      );
    }
  }
  return commands.join("\n\n");
}

export function cliFromNsg(s: NsgWizardState): string {
  return continuation([
    "az network nsg create",
    `--name ${quote(s.nsgName)}`,
    `--resource-group ${quote(s.resourceGroup)}`,
    `--location ${quote(region(s.region))}`,
  ]);
}

export function cliFromNsgRule(nsgName: string, resourceGroup: string, rule: NsgRule): string {
  return continuation([
    "az network nsg rule create",
    `--name ${quote(rule.name)}`,
    `--nsg-name ${quote(nsgName)}`,
    `--resource-group ${quote(resourceGroup)}`,
    `--priority ${rule.priority}`,
    `--direction ${rule.direction}`,
    `--access ${rule.action}`,
    `--protocol ${rule.protocol === "Any" ? "*" : rule.protocol}`,
    `--source-address-prefixes ${(rule.sourceAddresses || "*").split(/\s+/).map(quote).join(" ")}`,
    `--source-port-ranges ${rule.sourcePortRanges || "*"}`,
    `--destination-address-prefixes ${(rule.destAddresses || "*").split(/\s+/).map(quote).join(" ")}`,
    `--destination-port-ranges ${rule.destPortRanges || "*"}`,
    rule.description ? `--description ${quote(rule.description)}` : null,
  ]);
}

export function cliFromAppService(s: AppServiceWizardState): string {
  const plan = s.operatingSystem === "Linux" ? s.linuxPlan : s.windowsPlan;
  const commands: string[] = [];
  commands.push(
    continuation([
      "az appservice plan create",
      `--name ${quote(`plan-${s.appName || "app"}`)}`,
      `--resource-group ${quote(s.resourceGroup)}`,
      `--location ${quote(region(s.region))}`,
      `--sku ${plan.replace(/[()]/g, "").split(" ").pop() || "B1"}`,
      s.operatingSystem === "Linux" ? "--is-linux" : null,
    ]),
  );
  commands.push(
    continuation([
      "az webapp create",
      `--name ${quote(s.appName)}`,
      `--resource-group ${quote(s.resourceGroup)}`,
      `--plan ${quote(`plan-${s.appName || "app"}`)}`,
      s.operatingSystem === "Linux" ? `--runtime ${quote(s.runtimeStack)}` : null,
    ]),
  );
  if (s.basicAuth === "Disable") {
    commands.push("# Disable basic authentication");
    commands.push(`az webapp auth-classic-config update --name ${quote(s.appName)} --resource-group ${quote(s.resourceGroup)} --enabled false`);
  }
  if (s.enableAppInsights === "Yes") {
    commands.push("# Enable Application Insights");
    commands.push(
      `az monitor app-insights component create --app ${quote(`${s.appName}-insights`)} --location ${quote(region(s.appInsightsRegion))} --resource-group ${quote(s.resourceGroup)}`,
    );
  }
  const tags = s.tags.filter((t) => t.key);
  if (tags.length > 0) {
    commands.push(`az webapp update --name ${quote(s.appName)} --resource-group ${quote(s.resourceGroup)} --set tags='${tags.map((t) => `${t.key}=${t.value}`).join(" ")}'`);
  }
  return commands.join("\n\n");
}

export function cliFromLb(s: LbWizardState): string {
  const commands: string[] = [];
  const fe = s.frontendConfigs[0];
  commands.push(
    continuation([
      "az network lb create",
      `--name ${quote(s.lbName)}`,
      `--resource-group ${quote(s.resourceGroup)}`,
      `--location ${quote(region(s.region))}`,
      `--sku ${s.sku}`,
      fe?.publicIpName ? `--public-ip-address ${quote(fe.publicIpName)}` : s.lbType === "Internal" ? "--frontend-ip-zone 1" : null,
      fe ? `--frontend-ip-name ${quote(fe.name)}` : null,
      s.backendPools[0] ? `--backend-pool-name ${quote(s.backendPools[0].name)}` : null,
    ]),
  );

  s.healthProbes.forEach((p) => {
    commands.push(
      continuation([
        "az network lb probe create",
        `--lb-name ${quote(s.lbName)}`,
        `--resource-group ${quote(s.resourceGroup)}`,
        `--name ${quote(p.name)}`,
        `--protocol ${p.protocol}`,
        `--port ${p.port}`,
      ]),
    );
  });

  s.lbRules.forEach((r) => {
    commands.push(
      continuation([
        "az network lb rule create",
        `--lb-name ${quote(s.lbName)}`,
        `--resource-group ${quote(s.resourceGroup)}`,
        `--name ${quote(r.name)}`,
        `--protocol ${r.protocol}`,
        `--frontend-port ${r.frontendPort}`,
        `--backend-port ${r.backendPort}`,
        `--frontend-ip-name ${quote(r.frontendIp)}`,
        `--backend-pool-name ${quote(r.backendPool)}`,
        r.healthProbe ? `--probe-name ${quote(r.healthProbe)}` : null,
      ]),
    );
  });

  s.natRules.forEach((n) => {
    commands.push(
      continuation([
        "az network lb inbound-nat-rule create",
        `--lb-name ${quote(s.lbName)}`,
        `--resource-group ${quote(s.resourceGroup)}`,
        `--name ${quote(n.name)}`,
        `--protocol Tcp`,
        `--frontend-port-range-start ${n.portRange.split("-")[0]}`,
        `--frontend-port-range-end ${n.portRange.split("-")[1] ?? n.portRange.split("-")[0]}`,
        `--backend-port ${n.backendPort}`,
      ]),
    );
  });

  return commands.join("\n\n");
}

export function cliFromSql(s: SqlWizardState): string {
  const commands: string[] = [];
  if (s.serverChoice === "new") {
    commands.push(
      continuation([
        "az sql server create",
        `--name ${quote(s.serverName)}`,
        `--resource-group ${quote(s.resourceGroup)}`,
        `--location ${quote(region(s.serverLocation))}`,
        s.authMethod !== "Use Microsoft Entra-only authentication" ? `--admin-user ${quote(s.serverAdminLogin)}` : null,
        s.authMethod !== "Use Microsoft Entra-only authentication" ? `--admin-password ${quote(s.adminPassword || "P@ssw0rd-replace-me!")}` : null,
      ]),
    );
  }
  const server = s.serverChoice === "new" ? s.serverName : s.existingServer;
  commands.push(
    continuation([
      "az sql db create",
      `--name ${quote(s.databaseName)}`,
      `--resource-group ${quote(s.resourceGroup)}`,
      `--server ${quote(server)}`,
      s.pricingModel === "DTU" ? `--edition ${s.dtuTier} --capacity ${s.dtuValue}` : `--edition GeneralPurpose --family ${s.hardwareFamily} --capacity ${s.vCores}`,
      `--max-size ${s.pricingModel === "DTU" ? s.dtuMaxGB : s.dataMaxGB}GB`,
    ]),
  );
  if (s.addClientIp) {
    commands.push("# Allow your current client IP");
    commands.push(`az sql server firewall-rule create --resource-group ${quote(s.resourceGroup)} --server ${quote(server)} --name AllowClientIP --start-ip-address 203.0.113.42 --end-ip-address 203.0.113.42`);
  }
  return commands.join("\n\n");
}
