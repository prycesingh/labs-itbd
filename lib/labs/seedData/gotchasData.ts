/**
 * Gotchas ("Common Mistakes") seed data — extracted from the source itbd-lab
 * static site (gotchas.html). Used by the one-time admin seed endpoint to
 * populate the labs gotchas table; not read directly at request time.
 */

export type GotchaSeedEntry = {
  cat: string;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
};

export const GOTCHAS_SEED: GotchaSeedEntry[] = [
  // ── Azure
  { "cat": "Azure", "title": "NSG rule allows port 443 but traffic still blocked", "symptom": "curl times out from VM A to VM B even though NSG explicitly allows TCP/443 inbound.",
    "cause": "A UDR (user-defined route) in the subnet's route table is forcing traffic to an NVA or null route, bypassing the NSG path you tested.",
    "fix": "Use Network Watcher → Effective Routes on the source VM's NIC to see what route is actually applied. Also check NSG on the destination NIC + destination subnet — both apply." },
  { "cat": "Azure", "title": "Storage account: \"AuthorizationPermissionMismatch\" despite Storage Blob Data Reader role", "symptom": "User assigned Storage Blob Data Reader at storage account scope, but Storage Explorer / curl returns 403.",
    "cause": "Storage account \"Networking\" blade is set to \"Selected networks\". Even though RBAC is correct, the firewall rejects the IP.",
    "fix": "Add the user's public IP to the firewall allow list OR set to \"Enabled from all networks\" temporarily for testing. Also check \"Allow Azure services on trusted services list\"." },
  { "cat": "Azure", "title": "VM still being billed after shutdown", "symptom": "VM shows \"Stopped\" in portal but monthly cost keeps accumulating.",
    "cause": "\"Stopped\" ≠ \"Stopped (Deallocated)\". A simple OS shutdown from inside the VM keeps the compute allocated.",
    "fix": "Use Portal → VM → Stop button (which deallocates) OR PowerShell: <code>Stop-AzVM -Force</code>. Look for \"Stopped (deallocated)\" status to confirm." },
  { "cat": "Azure", "title": "Bicep template deployment fails: \"PolicyViolation\"", "symptom": "az deployment fails with \"RequestDisallowedByPolicy\".",
    "cause": "An Azure Policy in the scope (MG, subscription, or RG) has a Deny effect for the resource property you are setting.",
    "fix": "Check Portal → Policy → Compliance → click the failed deployment to see which policy blocked it. Either fix your template to comply, request exemption, or update the policy." },
  { "cat": "Azure", "title": "AKS cluster cannot pull image from ACR", "symptom": "Pods stuck in ImagePullBackOff. <code>kubectl describe pod</code> shows authentication error.",
    "cause": "AKS kubelet identity does not have AcrPull role on the ACR. OR AKS cluster was attached to ACR but credentials are stale.",
    "fix": "<code>az aks update --attach-acr &lt;acr-name&gt;</code> — this assigns AcrPull to the kubelet identity. For Workload Identity, configure federated credential separately." },
  { "cat": "Azure", "title": "App Service custom domain: \"DNS verification failed\"", "symptom": "Adding www.app.com to App Service custom domain → \"Verification failed\".",
    "cause": "TXT verification record not propagated yet, OR CNAME points to the wrong target (must point to <code>&lt;app&gt;.azurewebsites.net</code>).",
    "fix": "Use <code>nslookup -type=TXT asuid.www.app.com</code> to verify TXT record. DNS propagation can take up to 48h but usually 5-15 min. CNAME for root domain not allowed — use A record or ALIAS." },
  { "cat": "Azure", "title": "Cannot delete a resource group: \"Cannot delete RG with locked resource\"", "symptom": "Delete RG fails. Error mentions a lock.",
    "cause": "A \"Delete lock\" is set on the RG or on one of its resources. Locks inherit downward.",
    "fix": "Portal → RG → Locks → remove. Or PowerShell: <code>Remove-AzResourceLock -LockName ... -Force</code>. Verify no parent scope (MG, subscription) has a lock too." },
  { "cat": "Azure", "title": "Public IP cannot be deleted: \"still in use\"", "symptom": "Delete PIP fails. Error: associated with another resource.",
    "cause": "PIP is still attached to a NIC, LB front-end, App Gateway, NAT GW, or VPN gateway.",
    "fix": "Find association: Portal → PIP → Overview → \"Associated to\". Disassociate first, then delete. Sometimes you see ghost references — wait 5 min or use ARM REST API." },
  { "cat": "Azure", "title": "Container Registry: \"denied: requested access to the resource is denied\"", "symptom": "<code>docker push</code> to ACR fails with denied error.",
    "cause": "Token-based auth (admin user) is disabled. OR az CLI login is stale. OR repo path is wrong (case-sensitive!).",
    "fix": "<code>az acr login --name myacr</code> — uses your AAD identity. OR enable admin user in ACR → use docker login with username/password. Repo paths must match exactly." },
  { "cat": "Azure", "title": "Function App times out after 5 minutes", "symptom": "Long-running Function on Consumption plan returns 503 after 5 minutes.",
    "cause": "Consumption plan has a hard 5-min timeout. 10-min if you set <code>functionTimeout</code> but max is 10 min.",
    "fix": "Move to Premium plan (default 30 min, configurable to 60 min) or Dedicated (no timeout). Better: break into Durable Functions for orchestration." },

  // ── ADDS / Windows
  { "cat": "ADDS", "title": "GPO not applying — \"gpresult /r\" shows it skipped", "symptom": "GPO linked to OU but does not apply to users/computers in that OU.",
    "cause": "Security filtering is set to \"Authenticated Users\" but missing \"Read\" + \"Apply group policy\". OR WMI filter mismatches. OR client policy refresh has not happened (90 min default).",
    "fix": "Check GPO Delegation tab: Authenticated Users must have both Read + Apply. Run <code>gpupdate /force</code> on the client. Use <code>gpresult /h report.html</code> for full evidence." },
  { "cat": "ADDS", "title": "Replication broken: repadmin /replsum shows \"8453: Replication access denied\"", "symptom": "DC01 cannot replicate from DC02. <code>repadmin /showrepl</code> shows \"Access denied\".",
    "cause": "DC computer account secure channel broken, or member of \"Enterprise Domain Controllers\" / \"Pre-Windows 2000\" groups missing.",
    "fix": "On affected DC: <code>netdom resetpwd /server:&lt;peer DC&gt; /userd:DOMAIN\\Administrator /passwordd:*</code>. Reboot. Verify computer account in \"Domain Controllers\" OU." },
  { "cat": "ADDS", "title": "New user cannot log in: \"The trust relationship between this workstation and the primary domain failed\"", "symptom": "User's workstation cannot authenticate. Trust relationship broken.",
    "cause": "Workstation's computer account password got out of sync (machine offline > 30 days, or rebuilt from snapshot).",
    "fix": "<code>Reset-ComputerMachinePassword -Server &lt;DC&gt; -Credential (Get-Credential)</code>. OR re-join domain: leave + rejoin (preserves SID with /reuse)." },
  { "cat": "ADDS", "title": "FSMO transfer fails: \"Active Directory Domain Services is currently unavailable\"", "symptom": "Trying to transfer Schema Master fails.",
    "cause": "The target DC doesn't have Schema Master operations enabled in registry, OR you are not in Schema Admins group.",
    "fix": "On target DC: <code>regsvr32 schmmgmt.dll</code>, then add yourself to Schema Admins. Set registry: HKLM\\System\\CCS\\Services\\NTDS\\Parameters\\Schema Update Allowed = 1." },
  { "cat": "ADDS", "title": "NTLM authentication breaks after raising Functional Level to 2025", "symptom": "Old apps using NTLM fail after FFL raise.",
    "cause": "Wrong — FFL raise does not disable NTLM. Likely an unrelated change: GPO \"Network Security: LAN Manager auth level\" set to \"Send NTLMv2 only / Refuse LM + NTLM\".",
    "fix": "Check GPO setting \"Computer Config → Windows Settings → Local Policies → Security Options → Network Security: LAN Manager auth level\". For legacy apps requiring NTLMv1, you may need to allow it (security risk)." },

  // ── M365
  { "cat": "M365", "title": "Sent mail going to recipient's junk folder", "symptom": "External recipients report mail from cloudlab.in lands in Junk.",
    "cause": "SPF / DKIM / DMARC misconfigured. OR your sending IP is on a public blocklist (Spamhaus etc).",
    "fix": "Test at <code>mxtoolbox.com</code> + verify SPF, DKIM, DMARC. Move SPF to <code>v=spf1 include:spf.protection.outlook.com -all</code>. Enable DKIM. Set DMARC to p=quarantine." },
  { "cat": "M365", "title": "Conditional Access policy locks out all admins", "symptom": "Just enabled \"Require MFA for all users\". Now I can't log in either!",
    "cause": "No emergency access (break-glass) account excluded. Service principals missing exclusion.",
    "fix": "CRITICAL: Before enabling any CA policy, create 2 break-glass accounts excluded from ALL CA policies. Stored offline. If locked out: support call to Microsoft (slow). PREVENTION = always have break-glass." },
  { "cat": "M365", "title": "User added to Teams but cannot see channel", "symptom": "New employee added to Team but channels appear empty.",
    "cause": "Private channel needs explicit member-add (membership doesn't inherit from parent Team). OR M365 Group provisioning is lagging.",
    "fix": "Private channels → Add member explicitly. M365 group provisioning is async — up to 24h propagation in worst case." },
  { "cat": "M365", "title": "Exchange Online: \"Mailbox is at warning quota\"", "symptom": "User getting NDR for outbound mail. Quota warning email received.",
    "cause": "Mailbox at 49 GB / 50 GB limit. Archive not enabled. Online archive can extend by 100 GB (E3) or auto-expanding (E5).",
    "fix": "Portal → Recipient → Online archive → Enable. Then run inbox rules to move old mail to archive. Or move user to E5 for auto-expanding archive (up to 1.5 TB)." },
  { "cat": "M365", "title": "SharePoint hub site change doesn't reflect on associated sites", "symptom": "Updated hub site theme. Associated sites still old theme.",
    "cause": "Hub site association may take up to 24h to propagate, especially navigation + permissions.",
    "fix": "Wait 24h. Force-resync via PowerShell: <code>Invoke-SPOSiteSwap -SourceUrl ... -TargetUrl ...</code>. Manual: re-associate the site (Site settings → Hub)." },

  // ── Identity
  { "cat": "Identity", "title": "OAuth consent prompt failing: \"AADSTS65001: The user or administrator has not consented\"", "symptom": "App tries to call Graph API. User gets consent dialog. Pressing accept loops back to error.",
    "cause": "Permissions need ADMIN consent (e.g. application permissions, or scopes flagged as \"requires admin\"). Single user cannot grant.",
    "fix": "Tenant admin must consent. Portal → Enterprise Applications → app → Permissions → Grant admin consent. Or trigger consent flow with <code>prompt=admin_consent</code>." },
  { "cat": "Identity", "title": "PIM activation MFA challenge appears every time despite recent MFA", "symptom": "User MFA'd 5 minutes ago. PIM still demands MFA for activation.",
    "cause": "PIM has its OWN MFA freshness setting (default 10 min if \"On activation, require MFA\" is set). Independent of CA session token.",
    "fix": "Configure PIM role settings: \"Require MFA on activation\" + ensure MFA was actually a multi-factor (not just password). FIDO2 satisfies. SMS sometimes does not." },
  { "cat": "Identity", "title": "Service principal secret expires, app starts failing silently", "symptom": "Daily sync job worked yesterday, today fails with \"AADSTS7000222: The provided client secret keys for app ... are expired.\"",
    "cause": "SP secret has expiry date. Default 1 or 2 years. No alerts unless you configured.",
    "fix": "IMMEDIATELY: Rotate secret. PREVENTION: Use Managed Identity (no secret rotation) OR Workload Identity Federation (OIDC, no secrets at all). Configure expiry alerts in Entra." },
  { "cat": "Identity", "title": "Group-based licensing: user gets removed from group, license still active", "symptom": "Removed user from \"M365 E3 licensed\" group. License attached to user still.",
    "cause": "Direct license assignment took precedence. Group only sets it on add; removal from group removes group-source.",
    "fix": "Portal → User → Licenses → see \"Direct assigned\" vs \"Inherited from group\". Remove direct assignment manually if you want it gone." },

  // ── Intune / EUC
  { "cat": "Intune", "title": "Win32 app deployment stuck at \"Install pending\"", "symptom": "App shows pending forever in Company Portal.",
    "cause": "Most common: Detection rule does not match what the installer actually creates. Or app size > 8 GB (limit). Or device offline.",
    "fix": "Check <code>C:\\ProgramData\\Microsoft\\IntuneManagementExtension\\Logs\\IntuneManagementExtension.log</code>. Search for the app name. The error is verbose — usually detection script returned wrong value." },
  { "cat": "Intune", "title": "Compliance policy: device shows \"Not Compliant\" — Defender for Endpoint risk", "symptom": "Device compliant in all areas EXCEPT \"MDE risk score\".",
    "cause": "Defender XDR sees an unresolved alert on the device. Risk stays Medium+ until alert closed.",
    "fix": "Defender XDR → Device inventory → click device → resolve outstanding alerts. Compliance re-evaluates within 30 min — 8h." },
  { "cat": "Intune", "title": "BitLocker compliance fails on encrypted devices", "symptom": "Device IS encrypted but Intune says non-compliant for BitLocker.",
    "cause": "BitLocker is on, but recovery key not escrowed to Entra ID. Compliance policy requires both.",
    "fix": "PowerShell: <code>manage-bde -protectors -get C:</code> → confirm key exists. Push <code>BackupToAAD-BitLockerKeyProtector</code> via Proactive Remediation. Or trigger via Settings Catalog setting." },
  { "cat": "Intune", "title": "Autopilot enrollment failing at ESP \"Account setup\"", "symptom": "New device boots → Autopilot starts → fails during Account Setup phase.",
    "cause": "Conditional Access policy blocking initial user sign-in (e.g. requires compliant device, but device is not yet enrolled). OR ESP timeout too short.",
    "fix": "Exclude Autopilot device-prep + first-sign-in from CA. Use \"Microsoft Intune\" + \"Microsoft Intune Enrollment\" cloud app filter. OR exempt your Autopilot AAD-joined user temporarily." },

  // ── Sentinel / Security
  { "cat": "Sentinel", "title": "Analytics rule firing constantly — alert fatigue", "symptom": "Rule generates 500 alerts/day. SOC ignoring.",
    "cause": "Threshold too low. Entity grouping not configured. Known-good entities not excluded.",
    "fix": "Use entity grouping (group by user/host → 1 incident per entity). Raise threshold. Add exclusion in KQL: <code>| where InitiatingProcessAccountName !in (\"svc-backup\", \"svc-scan\")</code>." },
  { "cat": "Sentinel", "title": "Data connector shows \"Connected\" but no data in table", "symptom": "Sentinel says connector healthy but table is empty.",
    "cause": "Ingestion latency (typically 10-15 min, up to 6h for some sources). Or diagnostic settings not actually streaming. Or workspace transformation rule dropping data.",
    "fix": "Check connector \"Data received\" graph for spikes. Verify diagnostic settings on the source resource. Check if a workspace transformation rule (DCR) is filtering everything out." },
  { "cat": "Sentinel", "title": "KQL query returns empty result despite data clearly existing", "symptom": "Data is in workspace but query returns 0 rows.",
    "cause": "Time range mismatch (default 24h might not cover the data). OR table name typo (KQL is case-sensitive!). OR column name typo.",
    "fix": "Expand time range to 30 days. Verify table name with auto-complete. Use <code>print T = \"MyTable\"; T</code> to check spelling." },
  { "cat": "Sentinel", "title": "Playbook runs but does nothing — Logic App appears succeeded", "symptom": "Playbook triggers, Run history shows success, but no action taken (e.g. user not disabled).",
    "cause": "HTTP action used managed identity but MI lacks the Graph permission. Or Connector cached old token.",
    "fix": "Inspect Logic App run output: each action shows raw response. 403 means permission missing. Grant Graph permission to the Logic App's MI. For Office 365 connector, re-authenticate." },

  // ── Networking
  { "cat": "Networking", "title": "Site-to-Site VPN tunnel up but no traffic", "symptom": "IPsec tunnel shows \"Connected\" but ping/SSH from on-prem to Azure VM fails.",
    "cause": "Phase 2 selectors mismatch. Or routing not configured (local network gateway prefix). Or NSG / firewall blocking on Azure side.",
    "fix": "Verify Phase 2: local subnet on both sides matches. Check Local Network Gateway in Azure has on-prem prefix. NSG on Azure subnet allows VPN gateway as source." },
  { "cat": "Networking", "title": "DNS resolution returns public IP for Private Endpoint", "symptom": "Private Endpoint configured for storage. nslookup from VM returns public IP, not private.",
    "cause": "Private DNS zone (e.g. privatelink.blob.core.windows.net) not linked to the VNet. Or \"registration enabled\" set wrong way.",
    "fix": "Portal → Private DNS zone → Virtual network links → Add link to your VNet. Restart VM's NIC or wait 5 min. Test: <code>nslookup mystorage.blob.core.windows.net</code> should return 10.x.x.x." },
  { "cat": "Networking", "title": "BGP peer flaps every few minutes", "symptom": "BGP session up, down, up, down.",
    "cause": "MTU mismatch causing TCP/179 to fragment. Or BGP keepalive/hold timers don't match peer. Or MD5 password mismatch intermittently.",
    "fix": "Match MTU (1500 LAN, 1300-1400 over VPN). Set timers explicitly: keepalive 60s + hold 180s. Verify MD5 password char-for-char (no trailing spaces)." },
  { "cat": "Networking", "title": "Network Watcher Connection Monitor \"Connection state unknown\"", "symptom": "Configured Connection Monitor between two VMs. Status: Unknown.",
    "cause": "Source VM does not have Network Watcher agent extension installed.",
    "fix": "Install AzureNetworkWatcherExtension on source VM. Or use Connection Troubleshoot (different feature) which works without agent." },

  // ── DevOps / Build
  { "cat": "DevOps", "title": "GitHub Actions workflow uses OIDC but fails: \"AADSTS70021\"", "symptom": "OIDC token issued, but Azure says claims do not match.",
    "cause": "Federated credential in Entra ID app registration has wrong subject identifier (repo:OWNER/REPO:ref:refs/heads/main). Common typo: missing \"refs/\" or wrong branch.",
    "fix": "Match exactly: <code>repo:JaggaDaku-main/ITBD Technical Lab:ref:refs/heads/main</code>. For PR triggers: <code>repo:OWNER/REPO:pull_request</code>. Environment: <code>repo:OWNER/REPO:environment:Prod</code>." },
  { "cat": "DevOps", "title": "Terraform apply hangs forever on Azure resource", "symptom": "Terraform stuck on \"Still creating...\" for hours.",
    "cause": "Azure deployment legitimately failed but didn't signal back. Common with networking resources during peering.",
    "fix": "Ctrl+C out, run <code>terraform plan</code> to see drift. Check Azure Portal → Activity Log → Deployments to see status. Add explicit <code>depends_on</code> if order is wrong." },
  { "cat": "DevOps", "title": "Azure DevOps pipeline: \"There was a failure in sending the request\"", "symptom": "Pipeline using service connection suddenly fails.",
    "cause": "Service principal secret expired. OR service connection scope mismatch.",
    "fix": "Project Settings → Service connections → click connection → Re-authorize. If using OIDC (Workload Identity Federation): convert to it — no expiry." },

  // ── Hyper-V / Cluster
  { "cat": "Hyper-V", "title": "Live migration fails: \"Failed to migrate the virtual machine\"", "symptom": "VM live migration between cluster nodes fails.",
    "cause": "Network adapter on source + destination doesn't match (different vSwitch names). OR CPU compatibility check failing (different CPU generations).",
    "fix": "Match vSwitch names across all cluster nodes. Enable \"CPU Compatibility for migration\" on VM (VM Settings → Compatibility). Test with <code>Move-VM</code> first." },
  { "cat": "Hyper-V", "title": "Cluster heartbeat lost: nodes \"Down\", services failover", "symptom": "Cluster nodes randomly mark each other Down. Services flap.",
    "cause": "Cluster network NIC slow or saturated. Heartbeat timeout = 5s by default.",
    "fix": "Verify dedicated cluster heartbeat NIC. Increase <code>SameSubnetThreshold</code> + <code>CrossSubnetThreshold</code>. Check NIC errors with <code>Get-NetAdapter</code>." },

  // ── Compliance / Purview
  { "cat": "Compliance", "title": "Sensitivity label auto-apply policy not labelling docs", "symptom": "Configured auto-label policy for Confidential. Existing docs in SharePoint not getting labelled.",
    "cause": "Auto-apply policy in \"Simulation mode\" only. Or no SITs match. Or policy not yet processed (can take 24h for large libraries).",
    "fix": "Compliance portal → Policy → switch from Simulation to Active. Check Match summary — if 0 matches, your SIT rules are too strict." },
  { "cat": "Compliance", "title": "eDiscovery search returns \"Search status: Failed\"", "symptom": "Search across all mailboxes fails.",
    "cause": "Some mailboxes blocked by hold or InPlaceHold conflict. Or partial mailbox is corrupted (rare).",
    "fix": "Check \"Search status\" detailed report. Exclude problematic mailboxes. Retry with smaller scope." },

  // ── Misc
  { "cat": "Defender XDR", "title": "Defender for Endpoint device shows \"Onboarded\" but \"No sensor data\"", "symptom": "Device enrolled but no events in 24+ hours.",
    "cause": "Sensor cannot reach Defender cloud endpoints. Proxy config wrong. Or Mute / Tamper protection misconfigured.",
    "fix": "Run <code>MdeClientAnalyzer.cmd</code> on device → review report. Test connectivity to <code>*.endpoint.security.microsoft.com</code> over HTTPS. Check for system proxy via netsh winhttp." },
  { "cat": "Defender XDR", "title": "Auto-investigation taking very long or \"Pending\"", "symptom": "AIR investigation stays Pending for hours.",
    "cause": "Investigations need certain entities/events. If endpoint offline, AIR cannot complete. Or quota reached.",
    "fix": "Check device online status. Quota issue: increase Defender for Endpoint capacity in tenant settings." },

  { "cat": "Azure", "title": "Function App custom domain SSL: \"ERR_SSL_KEY_USAGE_INCOMPATIBLE\"", "symptom": "Function App custom domain works for HTTP but HTTPS shows TLS error.",
    "cause": "Custom domain SSL binding missing. OR uploaded cert has wrong Key Usage.",
    "fix": "Function App → Custom domains → Add binding → Select managed cert (free). Or upload PFX with Key Usage = Digital Signature + Key Encipherment." },
  { "cat": "Azure", "title": "Cosmos DB throws 429 \"Request rate too large\"", "symptom": "App randomly fails with 429 errors.",
    "cause": "Throughput (RU/s) exhausted. Manual throughput too low for spike load.",
    "fix": "Enable Autoscale on container (default upper limit = 10x base). Or add retry logic with exponential backoff in app code (Cosmos SDK has this built in)." },
  { "cat": "Azure", "title": "Key Vault: app cannot retrieve secret despite role assigned", "symptom": "Granted \"Key Vault Secrets User\" role to managed identity. App still 403.",
    "cause": "Key Vault is in \"Vault access policy\" mode, not RBAC mode. Two permission models exist; RBAC role only works in RBAC mode.",
    "fix": "Portal → Key Vault → Access configuration → switch to \"Azure role-based access control (recommended)\". Migrate existing access policies to role assignments." },
  { "cat": "Azure", "title": "AKS pod cannot resolve external DNS", "symptom": "kubectl exec into pod → nslookup google.com fails. Internal DNS works.",
    "cause": "CoreDNS upstream broken. Or NetworkPolicy blocking egress. Or NSG on AKS subnet missing.",
    "fix": "<code>kubectl get cm coredns -n kube-system -o yaml</code> + verify forward 8.8.8.8 or Azure DNS. Test with <code>nslookup google.com 8.8.8.8</code> from pod. NSG on subnet must allow UDP/53." },

  // ── More Identity
  { "cat": "Identity", "title": "Conditional Access \"What If\" tool says \"Will apply\" but the policy doesn't apply in real sign-in", "symptom": "What-If predicts policy. Real sign-in slips through.",
    "cause": "What-If is a static analyser. Real sign-in evaluates RUNTIME signals (location, device platform, app type). Could differ if you change conditions just-in-time.",
    "fix": "Use Sign-in logs filter for the specific user → see \"Conditional Access\" tab → which policies evaluated + status (Success / Failure / Not Applied). Verify \"Applied\" matches expectation." },
  { "cat": "Identity", "title": "PowerShell ExchangeOnline module: \"401 unauthorised\"", "symptom": "Connect-ExchangeOnline asks for creds, then 401.",
    "cause": "MFA required but PowerShell session not interactive. Or modern auth disabled for the account.",
    "fix": "Use <code>Connect-ExchangeOnline -UserPrincipalName ... </code> (browser pops up for MFA). Or use Service Principal: <code>Connect-ExchangeOnline -AppId xxx -CertificateThumbprint yyy</code>." },

  // ── Storage
  { "cat": "Azure", "title": "Storage blob deletion does not free up cost immediately", "symptom": "Deleted 1 TB of blobs. Bill still shows them.",
    "cause": "Soft delete is enabled (default 7 days retention). Or container has versioning + previous versions still exist.",
    "fix": "Storage account → Data protection → Soft delete settings. Disable temporarily OR purge soft-deleted blobs. Account for versioning costs too." },
  { "cat": "Azure", "title": "Storage Static Website: \"Failed to build\" or 404 on root", "symptom": "Static website enabled. URL returns 404.",
    "cause": "Index document name mismatch. Or files uploaded to wrong container ($web is the special one).",
    "fix": "Verify: files in <code>$web</code> container. Index doc = <code>index.html</code> in setting. Custom 404 = <code>404.html</code>. Static website URL is different from blob URL (z34.web.core.windows.net)." },

  // ── Misc gotchas
  { "cat": "Networking", "title": "Speed test shows 10x slower than expected", "symptom": "Bandwidth between Azure VMs across regions much lower than ExpressRoute SLA.",
    "cause": "TCP single-stream limits. Test using single iperf3 client = single TCP stream = throughput limited by latency × window.",
    "fix": "Run multi-stream test: <code>iperf3 -c &lt;server&gt; -P 16</code> (16 parallel streams). True available bandwidth shows up. Single stream often capped 5-10 Gbps regardless of link." },
  { "cat": "Defender XDR", "title": "ASR rules in Audit mode flooding event log but no Block actions", "symptom": "ASR rules enabled in Audit. Events showing but exceptions not actually applied.",
    "cause": "Audit mode logs only; does not block. Exceptions (Allow rules) are honoured only in Block/Warn mode.",
    "fix": "Phased rollout: Audit → analyse → Warn → final Block. Defender → Endpoint security → ASR rules. Apply per-policy exception list before flipping to Block." },
  { "cat": "M365", "title": "Teams meeting recording doesn't appear in OneDrive", "symptom": "Recorded a Teams meeting. No file in OneDrive/SharePoint.",
    "cause": "Meeting recording policy assigns recording to specific user (organiser). Organiser's OneDrive quota full, or in trial state.",
    "fix": "Verify Teams admin → Meeting policies → Recording allowed. Check organiser's OneDrive: should have free space. Recording can take 30 min to process for long meetings." },
  { "cat": "M365", "title": "Outlook desktop won't accept new password after change", "symptom": "Changed password in M365. Outlook keeps prompting + failing.",
    "cause": "Cached Windows Credential Manager entry holding the old password.",
    "fix": "Control Panel → Credential Manager → Windows Credentials → remove \"MicrosoftOffice15_Data:...\" entries. Restart Outlook → enter new password." }
];
