/**
 * Quiz seed data — extracted from the source itbd-lab static site
 * (quizzes.html). Used by the one-time admin seed endpoint to populate
 * labs_quiz_certs and labs_quiz_questions; not read directly at request time.
 */

export type QuizSeedQuestion = {
  question: string;
  options: string[];
  correctIndexes: number[];
  explanation: string;
};

export type QuizSeedCert = {
  code: string;
  name: string;
  questions: QuizSeedQuestion[];
};

export const QUIZ_SEED: QuizSeedCert[] = [
  {
    "code": "AZ-104",
    "name": "AZ-104 — Azure Administrator",
    "questions": [
      {
        "question": "You need to give a developer permission to create + delete VMs in resource group \"rg-dev\" but NOT modify VNet configuration. Which role assignment is correct?",
        "options": [
          "Owner on rg-dev",
          "Virtual Machine Contributor on rg-dev",
          "Contributor on rg-dev",
          "Reader on rg-dev"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Virtual Machine Contributor manages VMs without giving access to network/storage. Contributor would also let them modify VNets. Owner can grant role assignments — too broad."
      },
      {
        "question": "Which Azure Storage redundancy option provides RPO of zero for synchronous, cross-region replication?",
        "options": [
          "LRS",
          "GRS",
          "GZRS (Geo-Zone-Redundant Storage)",
          "None — cross-region is always async"
        ],
        "correctIndexes": [
          3
        ],
        "explanation": "All Azure cross-region storage replication is asynchronous (GRS, RA-GRS, GZRS, RA-GZRS). RPO is typically <15 min but never zero. For RPO=0 you need same-region ZRS or LRS."
      },
      {
        "question": "A VM in subnet1 (NSG1) cannot reach a VM in subnet2 (NSG2) over TCP/443. Both NSGs allow VirtualNetwork inbound + outbound. What is the most likely cause?",
        "options": [
          "NSG rule priority conflict",
          "A custom route in the route table forces traffic to an NVA",
          "Service Endpoint mismatch",
          "Public IP missing"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Custom routes (UDR) in the subnet's route table can override default VNet routing — sending traffic to an NVA, Internet, or null. Use Network Watcher Effective Routes to see what is in effect."
      },
      {
        "question": "Which authentication method is REQUIRED for hybrid identity if you want seamless SSO without exposing on-prem password hashes to Microsoft?",
        "options": [
          "Password Hash Sync (PHS)",
          "Pass-Through Authentication (PTA)",
          "Federation with ADFS",
          "Cloud-only identity"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "PTA does not store password hashes in Entra. Each sign-in is validated by an on-prem agent. ADFS also avoids hash sync but adds infrastructure. PHS is simpler but does sync (double-hashed) password hashes."
      },
      {
        "question": "You want to enforce that all VMs in a subscription must have a specific tag \"Owner\" set. Which Azure Policy effect best fits?",
        "options": [
          "Audit",
          "Deny",
          "Modify",
          "DeployIfNotExists"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Modify auto-adds the tag during create + can backfill existing resources via remediation. Deny would only block creation. Audit just reports. DeployIfNotExists deploys separate resources."
      },
      {
        "question": "Which backup type is REQUIRED for SQL Server running inside an Azure VM to get application-consistent backup?",
        "options": [
          "Azure Backup VM-level backup",
          "Azure Backup SQL Server in Azure VM",
          "Snapshot of OS disk",
          "Storage account snapshots"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Azure Backup for SQL Server in Azure VM uses the SQL VSS writer for app-consistent backups + supports full/diff/log backups. Plain VM-level backup is crash-consistent only for SQL workloads."
      },
      {
        "question": "Which TWO benefits does Azure Bastion provide vs. opening RDP/SSH ports on a VM's NSG? (Pick 2)",
        "options": [
          "VM does not need a public IP",
          "Reduces VM cost",
          "MFA can be enforced via CA on the Bastion session",
          "Faster RDP rendering"
        ],
        "correctIndexes": [
          0,
          2
        ],
        "explanation": "Bastion eliminates the need for a public IP on the target VM (option A) and the session goes through Entra ID auth, allowing CA + MFA (option C). It does not reduce VM cost or improve RDP rendering speed."
      },
      {
        "question": "A storage account with the Blob service. Which TWO Azure features ensure traffic FROM your VNet to that storage account stays on the Microsoft backbone (not Internet)?",
        "options": [
          "Service Endpoints",
          "Private Endpoint",
          "NSG rule allowing Storage service tag",
          "Cross-region VNet peering"
        ],
        "correctIndexes": [
          0,
          1
        ],
        "explanation": "Service Endpoint extends VNet identity to the PaaS service over Azure backbone. Private Endpoint provides a private IP in your VNet for that storage account. Both keep traffic off the internet. NSG service tag is a filter — does not change routing."
      },
      {
        "question": "You need to migrate 50 on-prem Windows Server VMs to Azure with minimum downtime. Which Microsoft tool handles discovery + assessment + migration?",
        "options": [
          "Azure Migrate",
          "Azure Site Recovery",
          "Azure Database Migration Service",
          "Storage Migration Service"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "Azure Migrate is the unified tool for server discovery, assessment (right-size, cost estimate), and migration. ASR is for DR replication — can be used for migration too but Migrate is the recommended starting point."
      },
      {
        "question": "A Resource Manager template is failing with \"PolicyViolation\" error. Where would you check?",
        "options": [
          "Activity Log → Deployments → Failed",
          "Defender for Cloud",
          "Azure Advisor",
          "Cost Management"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "Failed deployments + their detailed error (including which policy assignment blocked it) are in Activity Log → Deployments. You can also check Policy Compliance to see which policy is in scope."
      },
      {
        "question": "You assigned a user the \"Storage Blob Data Reader\" role at the storage account scope but they still get \"AuthorizationPermissionMismatch\" when trying to download a blob via Storage Explorer. What is missing?",
        "options": [
          "Wait 1 hour for token refresh",
          "Storage account firewall is blocking their IP",
          "They need the legacy \"Reader\" role at the same scope",
          "Add them to the Storage Blob Data Contributor role"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Common gotcha — Storage account firewall (Networking blade) might be set to \"Selected networks\". Their IP must be on the allow list OR they must connect from an Azure trusted service. Permission alone is not enough."
      },
      {
        "question": "Which Azure VM SKU family is optimised for HPC + GPU workloads?",
        "options": [
          "D family",
          "E family",
          "N family",
          "B family"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "N-series = NVIDIA-equipped GPU VMs (NC for compute, NV for visualisation, ND for deep learning). D = general purpose. E = memory-optimised. B = burstable."
      },
      {
        "question": "A user reports they cannot access a web app. The app runs on a private App Service Plan. What is the first diagnostic to try?",
        "options": [
          "App Service Plan tier",
          "Web App \"Networking\" blade → Inbound + Outbound traffic",
          "Application Insights live metrics",
          "Restart the App Service Plan"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Networking blade shows inbound (Private Endpoint or Access Restrictions) + outbound (VNet Integration). Most \"cannot access\" issues for private App Services are inbound access restrictions. Restart is a last resort."
      },
      {
        "question": "You want to delete a storage account but Azure Portal says \"Storage account contains soft-deleted blobs\". What must you do FIRST?",
        "options": [
          "Wait for retention period to expire",
          "Purge soft-deleted blobs OR disable soft delete + wait until retention drops to zero",
          "Delete the resource group",
          "Submit support ticket"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "You need to remove soft-deleted blobs (or wait for soft-delete retention to expire). You can also disable soft delete + wait for grace period. Deleting the RG would not bypass this protection."
      },
      {
        "question": "Which Azure governance hierarchy level allows policies to inherit DOWNWARD?",
        "options": [
          "Resource Group → Subscription",
          "Subscription → Tenant",
          "Management Group → Subscription → Resource Group → Resource",
          "Tenant only"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Policies + RBAC assigned at MG level inherit to subscriptions, then RGs, then resources. This is the standard governance pattern in Azure landing zones."
      }
    ]
  },
  {
    "code": "AZ-500",
    "name": "AZ-500 — Azure Security Engineer",
    "questions": [
      {
        "question": "Which feature ALLOWS Microsoft to access customer data only with customer approval?",
        "options": [
          "Just-In-Time VM access",
          "Customer Lockbox",
          "Privileged Identity Management",
          "Conditional Access"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Customer Lockbox requires approval from designated approvers before a Microsoft engineer can access data in M365/Azure for support. Audit log captures every approval."
      },
      {
        "question": "You need to detect when a user is signing in from an \"impossible travel\" location. Which feature is responsible?",
        "options": [
          "Conditional Access",
          "Identity Protection (sign-in risk)",
          "PIM",
          "Defender for Cloud"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Identity Protection signals sign-in risk. CA can then enforce action (block, require MFA) when sign-in risk is High. PIM is for privileged role activation, not sign-in detection."
      },
      {
        "question": "Which key type in Azure Key Vault provides FIPS 140-2 Level 3 protection?",
        "options": [
          "Software-protected key",
          "HSM-protected key (Premium tier)",
          "Storage account key",
          "Service Principal secret"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Premium tier Key Vault offers HSM-protected keys backed by Thales nShield HSMs at FIPS 140-2 Level 3. Standard tier is software-protected (Level 1). Managed HSM is a separate service at Level 3 too."
      },
      {
        "question": "A pen test report shows your storage account allows anonymous Blob access. Which is the QUICKEST fix at scale across many accounts?",
        "options": [
          "Manually toggle \"Allow Blob public access\" off on each",
          "Azure Policy: \"Storage accounts should disable public network access\" + Deny effect",
          "Defender for Storage",
          "NSG rules"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Azure Policy with Deny effect prevents creation + flags existing as non-compliant. Auto-remediation can disable them. Defender for Storage detects malicious access but does not enforce config."
      },
      {
        "question": "You want to give a Logic App identity-based access to a Key Vault secret. Which is most secure?",
        "options": [
          "Hard-code SP secret in Logic App connection",
          "Use Managed Identity + grant Key Vault Secrets User role",
          "Store the secret in Logic App parameters",
          "Use a shared access signature"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Managed Identity = no secrets to rotate. Grant the MI Key Vault Secrets User RBAC role (or vault access policy if using legacy mode). Logic App connector authenticates via MI."
      },
      {
        "question": "Which Azure feature allows you to set a hardware root-of-trust for VM disk encryption keys?",
        "options": [
          "BitLocker",
          "Azure Disk Encryption (ADE)",
          "Encryption at host",
          "Confidential VMs with vTPM + AMD SEV-SNP"
        ],
        "correctIndexes": [
          3
        ],
        "explanation": "Confidential VMs use AMD SEV-SNP + virtualised TPM, where the encryption key is sealed to the platform. ADE uses Key Vault. Encryption at host is at infra level."
      },
      {
        "question": "You receive a Sentinel incident \"TI map IP entity to AzureActivity\". Which entity is the IoC matched against?",
        "options": [
          "CallerIpAddress in Activity log",
          "SourceIp in SigninLogs",
          "DestinationIp in firewall logs",
          "IP in NSG flow logs"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "This rule joins TI watchlist (TI map) with AzureActivity table on CallerIpAddress — useful to detect ARM API calls from known-malicious IPs."
      },
      {
        "question": "Which Conditional Access condition is BEST suited to block legacy authentication (IMAP/POP/SMTP)?",
        "options": [
          "Sign-in risk",
          "Client apps → Other clients (legacy)",
          "Device platform",
          "Location"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "CA \"Client apps\" condition has explicit option \"Other clients\" which covers all legacy authentication protocols. Pair with Block grant."
      },
      {
        "question": "A user activates Global Administrator via PIM with a 1-hour duration. What happens after 1 hour?",
        "options": [
          "Auto-deactivation + role removed from their token",
          "Indefinite extension",
          "Email alert only, role stays",
          "PIM blocks future activations"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "PIM auto-deactivates after the duration. Continuous Access Evaluation revokes the role from active tokens (within minutes). User must re-activate with fresh MFA + justification."
      },
      {
        "question": "You need to expose an internal AKS API to internet users with WAF protection. Which combination is correct?",
        "options": [
          "Application Gateway with WAF + Private endpoint to AKS",
          "Public LB + NSG rules",
          "Azure Firewall",
          "AKS Ingress with public IP"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "AppGW with WAF v2 provides L7 + OWASP rules. Use Private Link / Private Endpoint to AKS for ingress so AKS itself stays private. AKS Application Routing addon uses AppGW."
      },
      {
        "question": "Which Defender for Cloud plan provides Just-In-Time VM access?",
        "options": [
          "Defender for Servers Plan 1",
          "Defender for Servers Plan 2",
          "Defender for Resource Manager",
          "Defender for DNS"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "JIT VM Access is included in Defender for Servers Plan 2 (it was also in Plan 1 historically but Microsoft consolidated into Plan 2)."
      },
      {
        "question": "You want to log all role assignment changes for compliance. Where does this data go?",
        "options": [
          "Application Insights",
          "Activity Log → Subscription scope",
          "Diagnostic Settings on Entra ID → Stream to Log Analytics",
          "Resource logs"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Role assignments at the directory level are Entra ID events. Enable diagnostic settings on Entra (Audit logs + Sign-in logs) and stream to a Log Analytics workspace for long-term retention + Sentinel correlation."
      },
      {
        "question": "A Sentinel analytics rule generates 5,000 alerts/day, drowning the SOC. What is the FIRST tuning step?",
        "options": [
          "Disable the rule",
          "Increase the threshold + add entity grouping",
          "Move to Defender XDR",
          "Add a playbook to auto-close"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Tune by raising thresholds + entity grouping (e.g. group by user → 1 incident per user instead of per event). Disabling kills detection. Auto-closing masks the issue."
      },
      {
        "question": "Which Entra ID feature prevents an admin from elevating their own role?",
        "options": [
          "MFA",
          "Conditional Access",
          "PIM approval workflow",
          "Authentication strength"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "PIM with approval required by another admin (often the security team or break-glass owner) prevents self-elevation. Without approval, even MFA-protected activation is self-service."
      },
      {
        "question": "You want to enforce that ALL Azure Storage accounts use customer-managed keys (CMK). Which Azure Policy effect blocks creation of non-compliant accounts?",
        "options": [
          "Audit",
          "AuditIfNotExists",
          "Deny",
          "DeployIfNotExists"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Deny prevents the resource from being created if non-compliant. Audit only reports. DeployIfNotExists deploys an additional resource. Deny is the right enforcement gate."
      }
    ]
  },
  {
    "code": "SC-200",
    "name": "SC-200 — Security Operations Analyst",
    "questions": [
      {
        "question": "You see an incident in Defender XDR titled \"Possible AiTM phishing attempt\". Which signal MOST commonly triggers this?",
        "options": [
          "Multiple failed sign-ins",
          "Token issued + replayed from different device fingerprint within 1 hour",
          "High sign-in risk",
          "Anonymous IP"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "AiTM steals the session token after MFA. The detection signal is \"same token issued at time T, replayed from different device or IP within 1 hour\" — indicating the cookie was stolen. Microsoft's \"AiTM phishing\" detection uses this pattern."
      },
      {
        "question": "Which KQL operator combines two tables ON a key column?",
        "options": [
          "summarize",
          "project",
          "join",
          "extend"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "join combines two tables on key columns. summarize aggregates. project selects columns. extend creates calculated columns."
      },
      {
        "question": "You want to find all SigninLogs entries WHERE the user signed in from a country other than India OR USA. KQL?",
        "options": [
          "SigninLogs | where Location !in (\"IN\", \"US\")",
          "SigninLogs | filter Location <> \"IN\" and Location <> \"US\"",
          "SigninLogs | where Location == \"Other\"",
          "SigninLogs | top 100 by Location"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "KQL `where Location !in (\"IN\", \"US\")` is the cleanest. The `!in` operator checks against a list. `filter` is not a KQL keyword (Splunk uses it)."
      },
      {
        "question": "A Sentinel playbook needs to disable a user in Entra ID when a high-severity incident closes as TruePositive. Which connector should the Logic App use?",
        "options": [
          "Azure AD connector",
          "Microsoft Sentinel connector + Microsoft Graph API call",
          "Defender for Endpoint connector",
          "Office 365 connector"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Sentinel connector triggers on incident change. Use HTTP action to call Microsoft Graph PATCH /users/{id} with accountEnabled=false. The legacy \"Azure AD\" connector is deprecated; use Graph."
      },
      {
        "question": "In Defender XDR, what is the difference between an ALERT and an INCIDENT?",
        "options": [
          "Alert is automated, incident is manual",
          "Incident is a correlated group of alerts across products",
          "Alert is high severity, incident is low",
          "No difference"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Incident = correlated bundle of related alerts (e.g. phishing email → endpoint exec → identity compromise become 1 incident). Alert = single detection from one product (MDE, MDI, MDA, MDO)."
      },
      {
        "question": "Which KQL operator FILTERS rows?",
        "options": [
          "where",
          "project",
          "summarize",
          "extend"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "where filters rows by condition. project selects columns. summarize aggregates. extend computes new columns."
      },
      {
        "question": "A Sentinel rule generates 100 alerts/hour and only 5% are TruePositive. What is the BEST tuning approach?",
        "options": [
          "Disable the rule",
          "Lower the threshold",
          "Add an entity grouping + raise threshold + exclude known-good (e.g. service accounts)",
          "Send all alerts to one analyst"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Combine entity grouping (collapse multiple per user/host into 1), raise the threshold to reduce noise, and explicitly exclude known-good entities (e.g. internal scanners, backup service accounts)."
      },
      {
        "question": "Which Defender XDR table contains process creation events from endpoints?",
        "options": [
          "SecurityEvent",
          "DeviceProcessEvents",
          "CommonSecurityLog",
          "SigninLogs"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "DeviceProcessEvents (in Defender XDR Advanced Hunting / Sentinel via DCR) has process creation events with parent process, command line, hash. SecurityEvent is Windows Event Logs (Sentinel native)."
      },
      {
        "question": "You want to enrich an incident with Threat Intelligence from MISP. Which Sentinel feature?",
        "options": [
          "Watchlists",
          "Threat Intelligence (TAXII connector)",
          "Workbooks",
          "Hunting queries"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Threat Intelligence pane supports TAXII feeds (MISP exposes a TAXII server). Indicators land in ThreatIntelligenceIndicator table and can be joined in rules + hunts."
      },
      {
        "question": "Which KQL function converts a string to datetime?",
        "options": [
          "todatetime()",
          "toString()",
          "now()",
          "tostring()"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "todatetime() parses a string into datetime. tostring() converts to string. now() returns current time. toString is C# — KQL is case sensitive."
      },
      {
        "question": "In Sentinel, what is a WORKBOOK?",
        "options": [
          "A playbook",
          "A KQL-powered dashboard with parameters + visualisations",
          "An incident note",
          "A user account"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Workbooks are interactive dashboards. Built-in: Identity Posture, Azure Activity, Investigations. You can author custom workbooks with parameter controls + KQL widgets."
      },
      {
        "question": "You need to retain Sentinel data for 7 years for compliance but only need fast query on last 90 days. What is the cost-efficient approach?",
        "options": [
          "Increase the workspace retention to 7 years",
          "Move tables to Auxiliary Logs / Archive tier after 90 days",
          "Export to Storage account daily",
          "Disable Sentinel"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Tables can have per-table retention. Use Analytics tier for hot 90 days, then Archive tier (cheaper but slower restore) for years 1-7. Auxiliary Logs tier is for high-volume but rarely queried."
      },
      {
        "question": "Which entity type in Sentinel can be used to BLOCK in a playbook?",
        "options": [
          "Hostname only",
          "IP, User, Host, File hash, URL, Mailbox",
          "User only",
          "IP only"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Sentinel entities include IP, account/user, host, file hash, URL, mailbox, malware, registry, process. Playbooks can act on each (block IP via firewall, disable user, isolate host, delete email, etc.)."
      },
      {
        "question": "A SOC analyst submits a phish-reported email back to Microsoft. Which Microsoft service uses this data?",
        "options": [
          "Threat Tracker",
          "Submissions (Email + collaboration)",
          "Defender XDR",
          "Sentinel"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "User-reported phish lands in Submissions queue in Defender portal. Microsoft uses to tune classifiers + update Threat Intelligence shared across tenants."
      },
      {
        "question": "Which KQL operator creates a TIMESERIES chart from raw events?",
        "options": [
          "render timechart",
          "summarize count() by bin(TimeGenerated, 1h) | render timechart",
          "top 10 by TimeGenerated",
          "order by TimeGenerated"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "You need to aggregate (summarize + bin), then render. bin(TimeGenerated, 1h) buckets events by hour. render timechart visualises."
      }
    ]
  },
  {
    "code": "MS-102",
    "name": "MS-102 — Microsoft 365 Administrator",
    "questions": [
      {
        "question": "Which authentication method should you AVOID per NIST 800-63B guidance?",
        "options": [
          "Microsoft Authenticator push",
          "SMS",
          "FIDO2 key",
          "Windows Hello for Business"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "NIST retired SMS as a strong factor due to SIM-swap + interception attacks. Use Authenticator push + Number Matching, FIDO2, or Windows Hello."
      },
      {
        "question": "You enabled DKIM for cloudlab.in. Which DNS record type does Microsoft require?",
        "options": [
          "TXT",
          "CNAME",
          "A",
          "MX"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Microsoft uses 2 CNAME records: selector1._domainkey + selector2._domainkey pointing to their service. Microsoft hosts the public key; you do not manage the TXT directly."
      },
      {
        "question": "A user reports they cannot delete an email older than 1 year. The mailbox is on Legal Hold. What happens to the deletion?",
        "options": [
          "Permanent delete",
          "Moved to Recoverable Items folder + retained per hold",
          "Bounced",
          "Quarantined"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Litigation/Legal Hold preserves all items even after user deletes — moved to Recoverable Items hidden folder. Visible only to eDiscovery searches."
      },
      {
        "question": "You want to block external sharing of all SharePoint sites except for a specific Marketing site. Approach?",
        "options": [
          "Tenant-level setting: \"Block external sharing\"",
          "Tenant: \"Existing guests + new guests\" + Site-level: Marketing → \"Anyone (anonymous)\"",
          "Per-user policy",
          "M365 group policy"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Set tenant to most-restrictive that you need broadly (e.g. \"Existing guests only\"). Then on the specific site, allow more permissive sharing (Anyone). Site-level cannot be MORE permissive than tenant max."
      },
      {
        "question": "A user receives the phishing email but it WAS delivered before Defender ZAP'd it. What evidence is in their mailbox?",
        "options": [
          "No trace — fully purged",
          "Item moved to Quarantine + audit log entry",
          "Email is in Junk",
          "Email is in Drafts"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "ZAP moves the message to quarantine (or admin-defined location). User-recoverable depending on quarantine policy. Audit log records the ZAP action."
      },
      {
        "question": "Which M365 license tier includes Defender for Office 365 Plan 2?",
        "options": [
          "Microsoft 365 E3",
          "Microsoft 365 E5",
          "Microsoft 365 Business Standard",
          "Microsoft 365 F3"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "MDO P2 is bundled with M365 E5 + can be added a la carte. E3 includes MDO P1 (Safe Links, Safe Attachments) but not P2 (Attack Simulator, Threat Tracker, automated investigation)."
      },
      {
        "question": "A user reports they receive emails late by ~2 hours. Where do you check?",
        "options": [
          "Outlook autodiscover",
          "Message trace in Exchange Online",
          "Service Health",
          "Defender XDR"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Message Trace shows the journey of an email — when received by Microsoft, when delivered, any delays. Delays often = anti-spam queue, backscatter, or hybrid connector lag."
      },
      {
        "question": "Which feature ENFORCES that personal device users (BYOD) can only see corporate email via the Outlook mobile app (not native iOS Mail)?",
        "options": [
          "Conditional Access + App Protection Policy (MAM)",
          "Intune device compliance",
          "Exchange Online Connector",
          "OWA mailbox policy"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "CA grant control \"Require app protection policy\" pairs with Intune MAM. Native iOS Mail does not support MAM, so it gets blocked. Outlook iOS has built-in MAM support."
      },
      {
        "question": "A user accidentally deleted a SharePoint site. Within what timeframe can it be restored?",
        "options": [
          "7 days",
          "14 days",
          "93 days",
          "30 days"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "SharePoint site recycle bin = 93 days. Within this window, a SharePoint admin can restore via SharePoint admin center → Deleted sites."
      },
      {
        "question": "Which M365 service uses Customer Lockbox for support access approval?",
        "options": [
          "Free for all tenants",
          "E5 / equivalent license",
          "F3 license",
          "Pay-per-incident"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Customer Lockbox is included in M365 E5, Business Premium with E5 Compliance, and other E5-equivalent SKUs. Lower tiers do not have approval workflow for Microsoft engineer access."
      },
      {
        "question": "A user signs in from a new country and CA requires MFA. They successfully complete MFA. What happens next time they sign in from same country?",
        "options": [
          "MFA every time",
          "MFA only if sign-in frequency lapsed (default 90 days)",
          "No MFA forever",
          "CA blocks them"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "After successful MFA, the device is registered. Subsequent sign-ins skip MFA unless sign-in frequency expires or CA explicitly demands every-time MFA via \"Sign-in frequency 0\"."
      },
      {
        "question": "A finance user got a phishing email. They forwarded it to junk@office365.microsoft.com. What happens?",
        "options": [
          "It triggers manual investigation by Microsoft",
          "It is added to the user's personal junk filter only",
          "It is used to update Microsoft's anti-spam classifiers",
          "Nothing"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Microsoft uses user-reported phish/junk emails to improve their global anti-spam classifiers. Admin should also configure \"Report message\" button in Outlook to streamline this."
      },
      {
        "question": "You want all users to receive a daily summary of their quarantined messages. Which policy?",
        "options": [
          "Anti-spam outbound policy",
          "Quarantine notifications policy",
          "Hosted content filter policy",
          "Junk folder policy"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Quarantine policy → \"Quarantine notifications\" controls end-user notifications (frequency, recipients, customisable text)."
      },
      {
        "question": "Microsoft Teams External Access vs Guest Access — which is correct?",
        "options": [
          "External Access = federation with another tenant; Guest Access = guest user IN your tenant",
          "Same thing",
          "External Access is for chat only",
          "Guest Access requires E5"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "External Access = federation with another tenant (or anonymous meetings). Guest Access = adding an external user as a guest member of YOUR team with access to channels, files, etc."
      },
      {
        "question": "You configure Conditional Access to require compliant device. A user on a Mac that is enrolled in Intune as compliant still gets blocked. First check?",
        "options": [
          "Mac OS version",
          "CA policy \"Device Platforms\" includes macOS",
          "User license",
          "Authenticator app"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "CA \"Conditions → Device platforms\" lets you target specific OS families. If macOS is excluded (default with \"Any\" then specifically excluded), the policy applies but the device requirement might mismatch."
      }
    ]
  },
  {
    "code": "MD-102",
    "name": "MD-102 — Endpoint Administrator",
    "questions": [
      {
        "question": "A Windows 11 device shows \"Not compliant\" in Intune. The compliance policy requires BitLocker on. BitLocker is on. What is the most common reason?",
        "options": [
          "Hash mismatch",
          "BitLocker recovery key not escrowed to AD/Entra",
          "Device offline",
          "CA policy conflict"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Common Intune compliance gotcha — BitLocker is on locally but recovery key has not synced to Entra ID. Policy requires both \"Encrypted\" + \"Recovery key backed up\". Run \"manage-bde -protectors -get\" to verify."
      },
      {
        "question": "You want to deploy a Win32 app with a dependency on .NET 8 runtime. Which Intune feature?",
        "options": [
          "App protection policy",
          "Win32 app dependencies",
          "PowerShell script",
          "Custom OMA-URI"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Win32 app properties include Dependencies tab — install required app first. Intune handles the install order. .NET 8 runtime must be packaged as a Win32 app too."
      },
      {
        "question": "Which Autopilot mode is best for a 500-laptop refresh where each user gets a new device delivered to home?",
        "options": [
          "Self-deploying",
          "User-driven (white-glove optional)",
          "Pre-provisioned",
          "Hybrid AD-joined"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "User-driven sends device → user signs in with corporate credentials → device joins Entra + applies policies + installs apps. Pre-provisioning (white glove) does the heavy install at the OEM, then user only signs in."
      },
      {
        "question": "A user complains their Win32 app deployment is \"Install pending\" forever. Where do you look on the device?",
        "options": [
          "Event Viewer",
          "C:\\ProgramData\\Microsoft\\IntuneManagementExtension\\Logs",
          "Add/Remove Programs",
          "Task Manager"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "IntuneManagementExtension.log (and AgentExecutor.log) under that folder shows the Win32 app download + install attempt + detection rule evaluation. Most issues = bad detection rule or bad install command."
      },
      {
        "question": "Which ASR rule is \"Block credential stealing from the Windows local security authority subsystem\"?",
        "options": [
          "9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2",
          "Block process creations originating from PSExec and WMI commands",
          "Block executable files from running unless they meet a prevalence/age/trusted-list criterion",
          "Block credential stealing from Windows local security authority subsystem (lsass.exe)"
        ],
        "correctIndexes": [
          3
        ],
        "explanation": "ASR rule \"Block credential stealing from the Windows local security authority subsystem (lsass.exe)\" — high impact, recommended in Block mode for all Win10/11 devices."
      },
      {
        "question": "A user reports their company portal app shows \"We need to verify your device\". What is happening?",
        "options": [
          "Device is not enrolled",
          "CA policy is requiring MFA registration",
          "Compliance check is in progress",
          "Sign-in is from a new device + CA is enforcing MFA"
        ],
        "correctIndexes": [
          3
        ],
        "explanation": "When CA detects an unfamiliar device, it can require MFA challenge in Company Portal. Once user verifies + device registers, future sign-ins skip MFA per the sign-in frequency settings."
      },
      {
        "question": "You want to migrate 200 GPO settings from on-prem AD to Intune. Which tool?",
        "options": [
          "Manual recreation in Intune",
          "Group Policy Analytics (Intune)",
          "PowerShell DSC",
          "SCCM"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Group Policy Analytics imports GPOs and maps each setting to MDM equivalent. Then you can bulk-create Settings Catalog profiles. Saves weeks vs manual."
      },
      {
        "question": "A device shows non-compliant for \"Defender for Endpoint risk score > Medium\". Where do you investigate the risk score?",
        "options": [
          "Intune compliance report",
          "Defender XDR → Device inventory → Device page",
          "Endpoint Analytics",
          "Azure AD audit log"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Defender XDR Device page shows: current risk level, exposure score, active alerts, suggestion to lower risk. Intune just consumes this score for compliance."
      },
      {
        "question": "You want all Win11 devices to receive monthly updates the second week of every month. Which feature?",
        "options": [
          "Update rings",
          "Feature update profile",
          "Quality update profile",
          "Driver update profile"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "Update rings let you set deferral periods + active hours + restart behaviour. Set \"Quality update deferral period: 7 days\" so updates land after 2nd Tuesday + 7 days = 2nd Tuesday + 1 week."
      },
      {
        "question": "A user enrolls a personal Android phone via BYOD. They use the Outlook app for work email. Which technology protects work data without managing the whole phone?",
        "options": [
          "Intune MDM",
          "Intune App Protection Policy (MAM)",
          "Conditional Access",
          "Defender for Endpoint"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "MAM = wraps the app with corporate data protection. Selective wipe = only Outlook work data, not personal photos. MDM would require enrollment + full device control."
      },
      {
        "question": "You want to whitelist a domain for SafeLinks. Where?",
        "options": [
          "Tenant Allow/Block Lists (TABL)",
          "Intune trusted sites policy",
          "Edge enterprise mode",
          "CA policy"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "TABL has explicit \"URLs to allow\" + \"URLs to block\" entries. SafeLinks honours TABL. Edge enterprise mode is a different mechanism for IE mode compatibility."
      },
      {
        "question": "A user reports slow OneDrive sync. What is the FIRST diagnostic to try?",
        "options": [
          "Restart Windows",
          "Right-click OneDrive icon → View sync problems / Get help",
          "Re-install OneDrive",
          "Clear file cache"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "OneDrive client has a \"Get help\" link with diagnostic. Logs are at %localappdata%\\Microsoft\\OneDrive\\logs. Don't re-install before checking logs."
      },
      {
        "question": "Which feature allows you to deploy a Wi-Fi profile WITH a certificate for 802.1X authentication?",
        "options": [
          "Settings Catalog → Wi-Fi",
          "Configuration profile → Wi-Fi + SCEP cert profile linked",
          "OMA-URI",
          "Quick assist"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "You create 2 profiles: SCEP cert profile (delivers cert from CA), Wi-Fi profile (references the cert + uses EAP-TLS). Both assigned to same group."
      },
      {
        "question": "Which Endpoint Analytics metric measures \"time from power-on to user able to interact\"?",
        "options": [
          "Startup performance",
          "App reliability",
          "Resource performance",
          "Endpoint score"
        ],
        "correctIndexes": [
          0
        ],
        "explanation": "Startup performance = time from boot to desktop ready. Tracks system + sign-in performance. Industry benchmark visible to compare your fleet."
      },
      {
        "question": "You want to push a custom registry key via Intune to disable Cortana. Which approach?",
        "options": [
          "PowerShell script",
          "Custom OMA-URI in Settings Catalog",
          "Win32 app",
          "Group Policy via Intune"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Settings Catalog has explicit Cortana settings. If not found there: OMA-URI policy with the registry path/value. PowerShell script can work but harder to manage at scale."
      }
    ]
  },
  {
    "code": "AZ-700",
    "name": "AZ-700 — Azure Network Engineer",
    "questions": [
      {
        "question": "A Hub VNet (10.0.0.0/16) is peered with Spoke1 (10.1.0.0/16) and Spoke2 (10.2.0.0/16). Spoke1 and Spoke2 cannot ping each other. Why?",
        "options": [
          "NSG rule",
          "VNet peering is non-transitive by default",
          "DNS issue",
          "Subnet mask mismatch"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "VNet peering is NOT transitive. To enable spoke-to-spoke: enable \"Allow gateway transit\" + \"Use remote gateways\" on the hub-spoke peering, then add UDR in spokes routing 10.x.0.0/16 → Hub firewall."
      },
      {
        "question": "Which routing protocol does ExpressRoute use to exchange routes with Microsoft?",
        "options": [
          "OSPF",
          "BGP",
          "RIP",
          "Static"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "ExpressRoute uses eBGP between your edge router and Microsoft Enterprise Edge (MSEE). You announce on-prem prefixes; Microsoft announces Azure prefixes per peering type."
      },
      {
        "question": "You need a Layer 7 load balancer with WAF + path-based routing for Azure. Which service?",
        "options": [
          "Azure Load Balancer",
          "Application Gateway with WAF v2",
          "Traffic Manager",
          "Front Door"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Application Gateway v2 has WAF (OWASP CRS 3.x) + path-based routing + URL rewriting. Front Door is global but more limited path routing. ALB is L4 only."
      },
      {
        "question": "A VM in subnet 10.0.1.0/24 cannot reach Azure Storage at storage.blob.core.windows.net. Which two help?",
        "options": [
          "Service Endpoint for Microsoft.Storage on the subnet",
          "Private Endpoint for the storage account in the same VNet",
          "NSG allow Storage service tag outbound",
          "Add a public IP to the VM"
        ],
        "correctIndexes": [
          0,
          1
        ],
        "explanation": "Service Endpoint routes via Microsoft backbone (still public IP). Private Endpoint gives a private IP in your VNet for the storage account. NSG service tag is just a filter, not a routing change."
      },
      {
        "question": "Which Azure firewall feature inspects URL+HTTP/HTTPS traffic with explicit FQDN allow/deny rules?",
        "options": [
          "Standard tier",
          "Premium tier with TLS inspection + URL filtering",
          "Network rules",
          "Application rules"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Azure Firewall Premium does TLS inspection (man-in-the-middle for HTTPS), IDPS signatures, URL filtering categories. Standard supports FQDN tags + application rules without TLS inspection."
      },
      {
        "question": "You have a S2S VPN with 2 tunnels (A/A). One tunnel goes down. Traffic continues. Which BGP feature ensures fast failover?",
        "options": [
          "eBGP",
          "BFD (Bidirectional Forwarding Detection)",
          "iBGP",
          "Static failback"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "BFD detects link failure in sub-second (300ms typical). Without BFD, BGP timers (30s+) cause traffic to keep using the dead tunnel briefly."
      },
      {
        "question": "Which is TRUE about NAT Gateway?",
        "options": [
          "Inbound NAT",
          "Outbound-only NAT, attached to subnet, scales to 64K SNAT ports per public IP",
          "Replaces Public IP",
          "Used for ExpressRoute"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "NAT Gateway = outbound-only with predictable SNAT ports (64K per attached PIP, up to 16 PIPs = 1M ports). Replaces \"Outbound rules\" on Standard LB. Better than SNAT exhaustion on Basic LB."
      },
      {
        "question": "A Web App in West US needs to call a private SQL DB in East US 2 over private endpoints. Which is REQUIRED?",
        "options": [
          "Global VNet peering",
          "Public access to SQL",
          "Hub-spoke + ExpressRoute",
          "VNet Integration on the Web App + Global VNet peering between VNets"
        ],
        "correctIndexes": [
          3
        ],
        "explanation": "Web App needs VNet Integration (regional or gateway) into its VNet, then global peering to the SQL DB's VNet. Private DNS zone resolution must also be sorted."
      },
      {
        "question": "You want global L7 load balancing with WAF for a multi-region web app. Best choice?",
        "options": [
          "Application Gateway",
          "Front Door Premium with WAF",
          "Traffic Manager",
          "NAT Gateway"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Front Door = global anycast L7 with WAF. App Gateway is regional. Traffic Manager is DNS-based (no payload inspection). NAT Gateway is outbound NAT."
      },
      {
        "question": "Which Network Watcher tool tells you what NSG rule is blocking traffic?",
        "options": [
          "IP Flow Verify",
          "Effective Security Rules",
          "Connection Troubleshoot",
          "All of the above"
        ],
        "correctIndexes": [
          3
        ],
        "explanation": "IP Flow Verify simulates a packet; tells you if it would be allowed/denied + which rule. Effective Security Rules shows the merged NSG view (subnet + NIC). Connection Troubleshoot does end-to-end test."
      },
      {
        "question": "Forced tunnelling forces outbound traffic from Azure to on-prem. Which is the typical mechanism?",
        "options": [
          "NSG default rule",
          "BGP route advertised from on-prem with 0.0.0.0/0",
          "Storage account firewall",
          "Service Endpoint"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "On-prem advertises 0.0.0.0/0 via BGP to ER/VPN. Azure VNet learns this default → all internet-bound traffic from Azure goes back to on-prem firewall. Often combined with split-tunnel exclusions for SaaS."
      },
      {
        "question": "In ExpressRoute Microsoft peering, what is advertised?",
        "options": [
          "Private RFC1918 prefixes",
          "Microsoft 365 + Azure public service prefixes",
          "0.0.0.0/0",
          "Multicast"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Microsoft peering = access to Microsoft 365 + other Azure public services over ER (instead of Internet). You filter prefixes via the ER PeeringFilter."
      },
      {
        "question": "Azure Private DNS zone — what does it solve?",
        "options": [
          "Public DNS resolution",
          "Resolves private endpoint FQDNs (e.g. storage.blob.core.windows.net → private IP) inside your VNet",
          "Email routing",
          "TCP load balancing"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "Without Private DNS, accessing a private endpoint via its FQDN returns the public IP (Microsoft's default DNS). Link Private DNS zone (e.g. privatelink.blob.core.windows.net) to the VNet → resolves to the PE's private IP."
      },
      {
        "question": "You want to inspect E-W traffic between two spoke VNets through an NVA in the hub. Which feature is needed?",
        "options": [
          "VNet peering with Allow gateway transit",
          "UDR on each spoke routing remote spoke CIDR → NVA IP",
          "NSG on the NVA",
          "Service Endpoints"
        ],
        "correctIndexes": [
          1
        ],
        "explanation": "UDRs force the hairpin through the NVA. Combined with spoke-to-hub peering (not spoke-to-spoke). Add NSG on the NVA NIC. Without UDR, peering is direct + NVA never sees the traffic."
      },
      {
        "question": "Standard SKU Public IP + Standard Load Balancer — what is \"secure by default\"?",
        "options": [
          "Allow all inbound",
          "Allow all outbound",
          "Deny all inbound unless allowed by NSG",
          "No NSG required"
        ],
        "correctIndexes": [
          2
        ],
        "explanation": "Standard SKU is closed by default. You must explicitly allow with NSG. Basic SKU was open by default (legacy, deprecated). Same applies to Standard LB outbound = explicit rules needed."
      }
    ]
  }
];
