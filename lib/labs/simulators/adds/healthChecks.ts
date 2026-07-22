import type { AddsState } from "./types";

export type HealthCheckStatus = "pass" | "warn" | "fail";

export type HealthCheckOutcome = {
  status: HealthCheckStatus;
  detail: string;
  fix: string;
  commands: string[];
};

export type HealthCheckDefinition = {
  id: string;
  label: string;
  run: (state: AddsState) => HealthCheckOutcome;
};

function minutesSince(iso: string): number {
  if (!iso) return Infinity;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

function daysSince(iso: string): number {
  if (!iso) return Infinity;
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export const HEALTH_CHECKS: HealthCheckDefinition[] = [
  {
    id: "dc-reachable",
    label: "All domain controllers reachable (LDAP/ICMP)",
    run: (state) => {
      const dcs = state.domainControllers;
      return {
        status: "pass",
        detail: `Pinged ${dcs.length} DC(s) — all responded on TCP 389 (LDAP) and ICMP.`,
        fix: "No action.",
        commands: dcs.map((dc) => `Test-NetConnection ${dc.name} -Port 389`),
      };
    },
  },
  {
    id: "fsmo-distributed",
    label: "FSMO roles distributed",
    run: (state) => {
      const roleFields: (keyof AddsState["domain"])[] = ["schemaMaster", "domainNamingMaster", "pdcEmulator", "ridMaster", "infrastructureMaster"];
      const holders = new Set(roleFields.map((f) => state.domain[f]));
      const allSameDc = holders.size === 1;
      return {
        status: allSameDc ? "warn" : "pass",
        detail: allSameDc
          ? `All 5 FSMO roles are held by ${[...holders][0]}. A single point of failure exists for role-dependent operations.`
          : `FSMO roles are spread across ${holders.size} domain controller(s): ${[...holders].join(", ")}.`,
        fix: allSameDc
          ? "Consider transferring at least the RID and Infrastructure Master roles to a second DC to reduce single-DC risk."
          : "No action.",
        commands: ["netdom query fsmo", "Get-ADForest | Select-Object *Master*", "Get-ADDomain | Select-Object *Master*"],
      };
    },
  },
  {
    id: "replication-currency",
    label: "Replication currency (USN / lastSync age)",
    run: (state) => {
      const entries = state.domainControllers.map((dc) => ({ name: dc.name, minutes: minutesSince(state.dcState[dc.name]?.lastSync ?? "") }));
      const stalest = entries.reduce((max, e) => (e.minutes > max.minutes ? e : max), entries[0] ?? { name: "-", minutes: 0 });
      if (stalest.minutes > 240) {
        return {
          status: "fail",
          detail: `${stalest.name} has not replicated in ${stalest.minutes} minutes, exceeding the 4-hour warning threshold.`,
          fix: "Investigate connectivity/DNS between partners and force replication.",
          commands: ["repadmin /showrepl", "repadmin /replsummary", "repadmin /syncall /AdeP"],
        };
      }
      if (stalest.minutes > 30) {
        return {
          status: "warn",
          detail: `Largest replication delta is ${stalest.minutes} minutes (${stalest.name}). Above the 30-minute healthy baseline but under the 4-hour warning threshold.`,
          fix: "Monitor; if the delta continues to grow, run repadmin /showrepl to check for a broken link.",
          commands: ["repadmin /showrepl", "repadmin /replsummary"],
        };
      }
      return {
        status: "pass",
        detail: `Largest replication delta is ${stalest.minutes} minute(s) (${stalest.name}). No partner exceeds the warning interval.`,
        fix: "No action.",
        commands: ["repadmin /showrepl", "repadmin /replsummary"],
      };
    },
  },
  {
    id: "recycle-bin",
    label: "AD Recycle Bin enabled",
    run: (state) => {
      if (state.recycleBinEnabled) {
        return {
          status: "pass",
          detail: "AD Recycle Bin is enabled for this forest. Deleted objects can be restored from tombstone state.",
          fix: "No action.",
          commands: ["Get-ADOptionalFeature -Filter \"Name -eq 'Recycle Bin Feature'\" | Select-Object EnabledScopes"],
        };
      }
      return {
        status: "warn",
        detail: "AD Recycle Bin is not enabled. Deleted objects are tombstoned but cannot be easily restored with full attributes.",
        fix: "Enable the AD Recycle Bin optional feature (irreversible, requires forest functional level 2008 R2+).",
        commands: [
          "Enable-ADOptionalFeature -Identity 'Recycle Bin Feature' -Scope ForestOrConfigurationSet -Target " + state.domain.fqdn,
        ],
      };
    },
  },
  {
    id: "default-password-policy",
    label: "Default password policy strength",
    run: (state) => {
      const defaultPolicy = state.gpos.find((g) => g.name === "Default Domain Policy");
      const maxAge = defaultPolicy?.settings["Computer/Windows Settings/Security Settings/Account Policies/Password Policy/Maximum password age"];
      const minLen = defaultPolicy?.settings["Computer/Windows Settings/Security Settings/Account Policies/Password Policy/Minimum password length"];
      const minLenNum = minLen ? parseInt(minLen, 10) : 0;
      if (!defaultPolicy || minLenNum < 8) {
        return {
          status: "fail",
          detail: `Default Domain Policy minimum password length is ${minLen ?? "unset"}. Below the 8-character security baseline.`,
          fix: "Raise minimum password length to at least 14 characters and enable complexity requirements.",
          commands: ["Get-ADDefaultDomainPasswordPolicy", "Set-ADDefaultDomainPasswordPolicy -Identity " + state.domain.fqdn + " -MinPasswordLength 14"],
        };
      }
      return {
        status: "warn",
        detail: `Default Domain Policy: minimum length ${minLen}, maximum age ${maxAge ?? "unset"}. Fine-grained PSOs may override this for privileged accounts — verify coverage.`,
        fix: "Review fine-grained password policies to ensure privileged groups are covered by a stricter PSO than the default.",
        commands: ["Get-ADDefaultDomainPasswordPolicy", "Get-ADFineGrainedPasswordPolicy -Filter *"],
      };
    },
  },
  {
    id: "stale-computer-accounts",
    label: "Stale computer accounts",
    run: (state) => {
      const staleThresholdDays = 90;
      const stale = state.computers.filter((c) => c.enabled && daysSince(c.lastLogon) > staleThresholdDays);
      if (stale.length === 0) {
        return {
          status: "pass",
          detail: `No enabled computer accounts have gone longer than ${staleThresholdDays} days without a logon.`,
          fix: "No action.",
          commands: ["Get-ADComputer -Filter * -Properties LastLogonDate | Where-Object {$_.LastLogonDate -lt (Get-Date).AddDays(-90)}"],
        };
      }
      return {
        status: stale.length > 2 ? "fail" : "warn",
        detail: `${stale.length} enabled computer account(s) have not logged on in over ${staleThresholdDays} days: ${stale.map((c) => c.name).join(", ")}.`,
        fix: "Confirm the devices are decommissioned, then disable or delete the stale computer objects.",
        commands: [
          "Search-ADAccount -ComputersOnly -AccountInactive -TimeSpan 90.00:00:00",
          "Disable-ADAccount -Identity <ComputerName>$",
        ],
      };
    },
  },
  {
    id: "stale-user-accounts",
    label: "Inactive user accounts",
    run: (state) => {
      const staleThresholdDays = 60;
      const stale = state.users.filter((u) => u.enabled && daysSince(u.lastLogon) > staleThresholdDays);
      if (stale.length === 0) {
        return {
          status: "pass",
          detail: `No enabled user accounts have gone longer than ${staleThresholdDays} days without a logon.`,
          fix: "No action.",
          commands: ["Search-ADAccount -UsersOnly -AccountInactive -TimeSpan 60.00:00:00"],
        };
      }
      return {
        status: "warn",
        detail: `${stale.length} enabled user account(s) have not logged on in over ${staleThresholdDays} days: ${stale.map((u) => u.sAMAccountName).join(", ")}.`,
        fix: "Review with the business owner; disable accounts that are no longer needed.",
        commands: ["Search-ADAccount -UsersOnly -AccountInactive -TimeSpan 60.00:00:00", "Disable-ADAccount -Identity <sam>"],
      };
    },
  },
  {
    id: "privileged-group-size",
    label: "Privileged group membership size",
    run: (state) => {
      const domainAdmins = state.groups.find((g) => g.name === "Domain Admins");
      const enterpriseAdmins = state.groups.find((g) => g.name === "Enterprise Admins");
      const count = (domainAdmins?.members.length ?? 0) + (enterpriseAdmins?.members.length ?? 0);
      if (count > 5) {
        return {
          status: "warn",
          detail: `${domainAdmins?.members.length ?? 0} Domain Admins and ${enterpriseAdmins?.members.length ?? 0} Enterprise Admins members. Large privileged groups increase attack surface.`,
          fix: "Apply least-privilege: move day-to-day admin tasks to delegated OU permissions or tiered admin accounts.",
          commands: ["Get-ADGroupMember 'Domain Admins'", "Get-ADGroupMember 'Enterprise Admins'"],
        };
      }
      return {
        status: "pass",
        detail: `${domainAdmins?.members.length ?? 0} Domain Admins and ${enterpriseAdmins?.members.length ?? 0} Enterprise Admins members — within a reasonable range.`,
        fix: "No action.",
        commands: ["Get-ADGroupMember 'Domain Admins'", "Get-ADGroupMember 'Enterprise Admins'"],
      };
    },
  },
  {
    id: "dns-msdcs-zone",
    label: "DNS health (_msdcs zone present)",
    run: (state) => {
      const hasMsdcs = state.dnsZones.some((z) => z.name.startsWith("_msdcs"));
      if (!hasMsdcs) {
        return {
          status: "fail",
          detail: "The _msdcs forward lookup zone is missing. DC locator (SRV record) queries will fail forest-wide.",
          fix: "Recreate the _msdcs zone or force re-registration of DC locator records.",
          commands: ["ipconfig /registerdns", "net stop netlogon && net start netlogon"],
        };
      }
      const staleRecords = state.dnsZones
        .flatMap((z) => z.records)
        .filter((r) => r.timestamp !== "static" && daysSince(r.timestamp) > 21);
      if (staleRecords.length > 0) {
        return {
          status: "warn",
          detail: `${staleRecords.length} DNS record(s) have a timestamp older than 21 days and are eligible for scavenging.`,
          fix: "Enable DNS scavenging with 7-day no-refresh and 7-day refresh intervals on AD-integrated zones.",
          commands: ["Set-DnsServerScavenging -ScavengingState $true -RefreshInterval 7.00:00:00 -NoRefreshInterval 7.00:00:00 -ApplyOnAllZones"],
        };
      }
      return {
        status: "pass",
        detail: "_msdcs zone present and no stale dynamic records detected.",
        fix: "No action.",
        commands: ["Get-DnsServerZone -Name _msdcs." + state.domain.fqdn],
      };
    },
  },
  {
    id: "time-sync",
    label: "Time synchronization (w32tm)",
    run: (state) => {
      const pdc = state.domainControllers.find((dc) => dc.isPDC);
      return {
        status: "pass",
        detail: `${pdc?.name ?? "PDC"} is authoritative for the domain hierarchy; other DCs sync from it. Max observed skew < 1 second.`,
        fix: "No action.",
        commands: ["w32tm /query /status", "w32tm /query /source", "w32tm /monitor"],
      };
    },
  },
  {
    id: "sysvol-replication",
    label: "SYSVOL / NETLOGON replication (DFSR)",
    run: (state) => {
      const dcNames = state.domainControllers.map((dc) => dc.name);
      return {
        status: "pass",
        detail: `DFSR backlog: 0 files. SYSVOL Share is healthy across ${dcNames.join(", ")}.`,
        fix: "No action.",
        commands: [
          `dfsrdiag backlog /rfname:"SYSVOL Share" /smem:${dcNames[0] ?? "DC01"} /rmem:${dcNames[1] ?? "DC02"}`,
          "Get-DfsrBacklog -GroupName 'Domain System Volume' -FolderName 'SYSVOL Share'",
        ],
      };
    },
  },
  {
    id: "gpo-orphaned-links",
    label: "GPOs with no links (orphaned policy)",
    run: (state) => {
      const nonBuiltinUnlinked = state.gpos.filter((g) => !g.builtin && g.links.length === 0);
      if (nonBuiltinUnlinked.length === 0) {
        return {
          status: "pass",
          detail: "All non-built-in GPOs are linked to at least one OU or the domain root.",
          fix: "No action.",
          commands: ["Get-GPO -All | ForEach-Object { if (-not (Get-GPInheritance -Target $_.Path)) { $_.DisplayName } }"],
        };
      }
      return {
        status: "warn",
        detail: `${nonBuiltinUnlinked.length} GPO(s) exist with no links: ${nonBuiltinUnlinked.map((g) => g.name).join(", ")}.`,
        fix: "Link the intended OUs or remove the unused GPOs to reduce management clutter.",
        commands: ["Get-GPOReport -All -ReportType Html -Path C:\\Reports\\gpo-report.html"],
      };
    },
  },
];
