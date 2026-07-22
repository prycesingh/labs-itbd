/**
 * Troubleshooting flowcharts seed data — extracted from the source itbd-lab
 * static site (troubleshoot-flowcharts.html). Used by the one-time admin seed
 * endpoint to populate the labs troubleshoot-flowchart-steps table; not read
 * directly at request time.
 *
 * Source models each flow as a LINEAR, top-to-bottom numbered step list (not
 * a branching {q, yes, no} decision tree like the network simulator's own
 * troubleshoot.js) — every step is colour-coded by `stepType` (question/
 * action/success/failure) and walked strictly in `stepIndex` order, with no
 * yes/no branch targets at all.
 */

export type TroubleshootFlowchartStepSeedEntry = {
  flowName: string;
  stepIndex: number;
  stepType: "question" | "action" | "success" | "failure";
  title: string;
  description: string;
};

export const TROUBLESHOOT_FLOWCHART_STEPS_SEED: TroubleshootFlowchartStepSeedEntry[] = [
  // ── Cannot log in (M365 / Entra ID)
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 1, stepType: "question", title: "Is the error message visible to the user?", description: "Ask user for the exact wording. Common: \"Your account or password is incorrect\", \"Need to make sure it's really you\" (MFA), \"Sign-in blocked due to Conditional Access\"." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 2, stepType: "action", title: "Check Sign-in logs in Entra ID", description: "Portal → Entra ID → Sign-in logs → filter by UPN + last 24h. Note the <code>ResultType</code> (0 = success; 50053 = locked; 50126 = wrong password; 50158 = MFA required; 50059 = no tenant)." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 3, stepType: "question", title: "Is ResultType = 50158 (MFA required)?", description: "If yes, MFA flow is needed." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 4, stepType: "action", title: "Verify MFA registration", description: "Portal → Entra ID → User → Authentication methods. If empty: register new auth method (mobile, FIDO2). If account is admin and methods broken, use break-glass + reset MFA." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 5, stepType: "question", title: "Is ResultType = 53003 (CA block)?", description: "Conditional Access blocked. Note \"Conditional Access\" tab in sign-in log." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 6, stepType: "action", title: "Identify the blocking CA policy", description: "Sign-in log → Conditional Access tab → policy showing \"Failure\". Common causes: legacy auth, geo block, compliant device required + non-compliant." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 7, stepType: "action", title: "Determine fix per policy", description: "Legacy auth: user uses modern client. Geo block: temp travel exclusion. Device compliance: enroll device in Intune + wait for compliance." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 8, stepType: "question", title: "Is the account locked?", description: "ResultType 50053. Smart lockout default = 10 fails + 60s lockout." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 9, stepType: "action", title: "Unlock + reset password", description: "PowerShell: <code>Unlock-ADAccount</code> (on-prem) OR Entra: <code>Update-MgUser -PasswordProfile</code>. Force MFA re-registration if suspicious." },
  { flowName: "Cannot log in (M365 / Entra ID)", stepIndex: 10, stepType: "success", title: "Verify resolution", description: "Ask user to sign in. Check Sign-in logs again for success." },

  // ── Mail not delivering (Exchange Online)
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 1, stepType: "question", title: "Inbound or outbound mail?", description: "Inbound = from internet TO your tenant. Outbound = your tenant TO recipient." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 2, stepType: "action", title: "Run Message Trace", description: "Exchange Admin Center → Mail flow → Message trace. Last 7 days quick search. For older: extended trace (CSV report)." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 3, stepType: "question", title: "Does the message appear in Trace?", description: "If no message found at all, sender never reached EXO." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 4, stepType: "action", title: "Check sender SPF + DKIM + DMARC", description: "Use mxtoolbox.com or run: <code>Resolve-DnsName -Type TXT cloudlab.in</code>. Common: SPF too restrictive, DKIM missing, DMARC reject without proper setup." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 5, stepType: "action", title: "Check Microsoft IP not on blocklist", description: "For your sending IPs, verify reverse DNS (PTR) and check on <code>mxtoolbox.com/blacklists.aspx</code>." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 6, stepType: "question", title: "Message trace shows \"Filtered\"?", description: "EXO blocked it as spam/phish/malware." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 7, stepType: "action", title: "Check Quarantine + Submissions", description: "Defender portal → Email & collaboration → Review → Quarantine. Find the message. If false positive: Release + Report. Add sender to allow-list via Tenant Allow/Block List." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 8, stepType: "question", title: "Message trace shows \"FailedOther\"?", description: "Connector / TLS / IP rep / external problem." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 9, stepType: "action", title: "Examine connector logs + TLS", description: "Exchange admin → Mail flow → Connectors. Verify connector enabled, TLS certificate valid, partner domain configured." },
  { flowName: "Mail not delivering (Exchange Online)", stepIndex: 10, stepType: "success", title: "Send test from external mailbox", description: "Use Gmail or test mailbox. Run trace again. If delivered: educate user about previous block reason." },

  // ── VPN tunnel down (Azure VPN Gateway)
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 1, stepType: "action", title: "Check VPN Gateway connection status", description: "Portal → VPN Gateway → Connections → status should be \"Connected\". If \"Not Connected\" or \"Connecting\" → tunnel issue." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 2, stepType: "question", title: "Is tunnel up but no traffic flowing?", description: "IPSec phase 1 + 2 might be up but no data passes." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 3, stepType: "action", title: "Verify Local Network Gateway prefix", description: "LNG should have all on-prem subnets that need to reach Azure. Missing prefix = packets get dropped by Azure routing." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 4, stepType: "action", title: "Verify on-prem device IPsec selectors", description: "Phase 2 selectors must match Azure exactly. On Cisco/Palo: \"show crypto ipsec sa detail\" to see SAs + traffic counters." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 5, stepType: "question", title: "Are NSG rules blocking traffic?", description: "Azure NSG on the subnet might drop on-prem traffic." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 6, stepType: "action", title: "Use Network Watcher IP Flow Verify", description: "Network Watcher → IP Flow Verify → enter source (on-prem IP) + destination (Azure VM IP). Returns \"Allow\" or \"Deny\" + which rule." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 7, stepType: "question", title: "BGP-enabled VPN — peering down?", description: "For BGP VPN: <code>Get-AzVirtualNetworkGatewayBgpPeerStatus</code> shows status." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 8, stepType: "action", title: "Check BGP timers + MD5 + ASN", description: "On-prem ASN must NOT match Azure ASN (default 65515). MD5 password char-for-char. Keepalive 60s / Hold 180s." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 9, stepType: "action", title: "Reset VPN tunnel from Azure side", description: "Portal → VPN Gateway → Connections → Reset. Forces a clean re-establishment. Use as last resort (5-10 min outage)." },
  { flowName: "VPN tunnel down (Azure VPN Gateway)", stepIndex: 10, stepType: "success", title: "Validate end-to-end traffic", description: "Ping from on-prem host to Azure VM. Run continuous trace during a re-key event (typically every 27000 seconds for phase 2)." },

  // ── AD replication broken
  { flowName: "AD replication broken", stepIndex: 1, stepType: "action", title: "Run repadmin /replsummary", description: "On any DC. Shows per-DC failure summary + when last replicated. Fails > 0 = problem." },
  { flowName: "AD replication broken", stepIndex: 2, stepType: "action", title: "Run repadmin /showrepl for the failing DC", description: "Shows specific replication errors with codes. Common: 8453 (access denied), 8456/8457 (source DC unavailable), 1722 (RPC unavailable)." },
  { flowName: "AD replication broken", stepIndex: 3, stepType: "question", title: "Error 8453 — Access denied?", description: "Permissions issue." },
  { flowName: "AD replication broken", stepIndex: 4, stepType: "action", title: "Verify DC computer account membership", description: "DC must be in \"Domain Controllers\" OU + \"Enterprise Domain Controllers\" + \"Pre-Windows 2000 Compatible Access\" groups." },
  { flowName: "AD replication broken", stepIndex: 5, stepType: "action", title: "Reset DC computer account password", description: "<code>netdom resetpwd /server:&lt;peer DC&gt; /userd:DOMAIN\\admin /passwordd:*</code> on the affected DC. Reboot." },
  { flowName: "AD replication broken", stepIndex: 6, stepType: "question", title: "Error 1722 — RPC server unavailable?", description: "Network or service issue." },
  { flowName: "AD replication broken", stepIndex: 7, stepType: "action", title: "Test network + service", description: "<code>portqry -n DC02 -e 135 -p TCP</code> + verify firewall + DNS resolution. Replication needs TCP 135 + RPC ephemeral ports (49152-65535)." },
  { flowName: "AD replication broken", stepIndex: 8, stepType: "question", title: "USN rollback detected?", description: "Rare but serious. Typically after VM snapshot restore on a DC." },
  { flowName: "AD replication broken", stepIndex: 9, stepType: "action", title: "USN rollback recovery", description: "Affected DC must be demoted + re-promoted. <code>dcpromo /forceremoval</code> + metadata cleanup + re-promote." },
  { flowName: "AD replication broken", stepIndex: 10, stepType: "action", title: "Force replication after fix", description: "<code>repadmin /syncall /APed</code> on the fixed DC. Then <code>repadmin /replsummary</code> to confirm clean." },
  { flowName: "AD replication broken", stepIndex: 11, stepType: "success", title: "Run dcdiag for clean bill", description: "<code>dcdiag /v /e /test:Replications /test:DNS</code> — all PASS confirms healthy AD." },

  // ── App is slow (3-tier web app)
  { flowName: "App is slow (3-tier web app)", stepIndex: 1, stepType: "question", title: "Slow for all users or specific users?", description: "All = systemic. Specific = client-side / network path." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 2, stepType: "action", title: "Check Application Insights live metrics", description: "Server response time, CPU, memory, dependencies (DB, cache). Identify the slowest dependency." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 3, stepType: "question", title: "Is the database the bottleneck?", description: "AI dependencies tab shows SQL call durations." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 4, stepType: "action", title: "Run SQL Query Performance Insight", description: "Azure SQL DB → Query Performance Insight → top CPU queries. Check Query Store for missing indexes recommendations." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 5, stepType: "action", title: "Check DTU/vCore usage", description: "Azure SQL DB → Overview → DTU graph. If > 80% sustained, scale up or add read replicas." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 6, stepType: "question", title: "Is the App Service the bottleneck?", description: "AI shows high server response time even before DB call." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 7, stepType: "action", title: "Check App Service Plan metrics", description: "Plan → Metrics → CPU + Memory + HTTP queue length. If > 60% CPU sustained, scale up plan tier or scale out instances." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 8, stepType: "question", title: "Is the front-end (CDN/Front Door) slow?", description: "Frontend tests slow but server-side metrics fine." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 9, stepType: "action", title: "Run Lighthouse + WebPageTest", description: "Identify TTFB, CDN cache hit ratio, image optimization, bundle size. Often Front Door caching misconfigured." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 10, stepType: "question", title: "Slow only from one geography?", description: "CDN regional issue or backbone problem." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 11, stepType: "action", title: "Check Front Door routing + health probes", description: "Front Door → Health probes → verify all backends healthy. Geo-filter rules might be routing to far region." },
  { flowName: "App is slow (3-tier web app)", stepIndex: 12, stepType: "success", title: "Validate with synthetic monitoring", description: "Application Insights → Availability test from multiple geos. Confirm response < 2 sec everywhere." },

  // ── AKS pods crash / not running
  { flowName: "AKS pods crash / not running", stepIndex: 1, stepType: "action", title: "Check pod state", description: "<code>kubectl get pods -A</code>. Common bad states: CrashLoopBackOff, ImagePullBackOff, Pending, ContainerCreating (stuck)." },
  { flowName: "AKS pods crash / not running", stepIndex: 2, stepType: "question", title: "ImagePullBackOff?", description: "Cannot pull image." },
  { flowName: "AKS pods crash / not running", stepIndex: 3, stepType: "action", title: "Inspect describe + check ACR auth", description: "<code>kubectl describe pod &lt;name&gt;</code> → events section. Likely: ACR pull permission missing. Fix: <code>az aks update --attach-acr</code>." },
  { flowName: "AKS pods crash / not running", stepIndex: 4, stepType: "question", title: "CrashLoopBackOff?", description: "Container starts then crashes repeatedly." },
  { flowName: "AKS pods crash / not running", stepIndex: 5, stepType: "action", title: "Inspect container logs", description: "<code>kubectl logs &lt;pod&gt; --previous</code> to see last crash output. Often: missing env var, bad config map, DB unreachable, OOM." },
  { flowName: "AKS pods crash / not running", stepIndex: 6, stepType: "question", title: "OOMKilled in events?", description: "Container memory limit too low." },
  { flowName: "AKS pods crash / not running", stepIndex: 7, stepType: "action", title: "Increase memory limit in Deployment", description: "Resources.limits.memory = \"512Mi\" to \"2Gi\" (or whatever profile needs). Redeploy. Watch <code>kubectl top pod</code>." },
  { flowName: "AKS pods crash / not running", stepIndex: 8, stepType: "question", title: "Pending forever — no node fits?", description: "Scheduler cannot place pod." },
  { flowName: "AKS pods crash / not running", stepIndex: 9, stepType: "action", title: "Check node pool capacity", description: "<code>kubectl get nodes</code> + <code>kubectl describe pod</code> events. Either scale up cluster autoscaler or reduce resource requests." },
  { flowName: "AKS pods crash / not running", stepIndex: 10, stepType: "question", title: "Network issue — service unreachable?", description: "kubectl get svc, then test from a debug pod." },
  { flowName: "AKS pods crash / not running", stepIndex: 11, stepType: "action", title: "Test connectivity + NetworkPolicy", description: "<code>kubectl exec -it debug-pod -- curl service-name:port</code>. Check NetworkPolicy: <code>kubectl get netpol -A</code>. Often default-deny blocks pod-to-pod." },
  { flowName: "AKS pods crash / not running", stepIndex: 12, stepType: "success", title: "Validate end-to-end", description: "External traffic → Ingress → Service → Pod. Watch Application Insights / Prometheus to confirm response time normal." },

  // ── Cannot RDP to Azure VM
  { flowName: "Cannot RDP to Azure VM", stepIndex: 1, stepType: "question", title: "Have you tried Bastion first?", description: "Bastion is the secure way. Direct RDP via public IP is discouraged." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 2, stepType: "action", title: "Verify VM is running", description: "Portal → VM → Overview → \"Status: Running\". If Deallocated, Start it." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 3, stepType: "action", title: "Check NSG allows RDP from your source", description: "Portal → VM → Networking → look for inbound rule allowing TCP 3389. Source = your public IP (Google \"what is my IP\")." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 4, stepType: "question", title: "Is JIT VM Access enabled?", description: "Defender for Cloud feature. Closes RDP/SSH ports + requires \"Request access\" per session." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 5, stepType: "action", title: "Request JIT access for this VM", description: "Defender for Cloud → Workload protections → Just-in-time VM access → Request access. Set duration, source IP, port." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 6, stepType: "question", title: "RDP error: \"credentials did not work\"?", description: "Auth issue." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 7, stepType: "action", title: "Reset password via Run Command", description: "Portal → VM → Run command → RunPowerShellScript → <code>Set-LocalUser -Name azureuser -Password (ConvertTo-SecureString \"NewP@ss!\" -AsPlainText -Force)</code>." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 8, stepType: "question", title: "RDP error: \"remote computer not found\"?", description: "Network unreachable." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 9, stepType: "action", title: "Run Network Watcher Connection Troubleshoot", description: "Network Watcher → Connection Troubleshoot → Source: your laptop, Destination: VM IP. Returns full path + where it failed." },
  { flowName: "Cannot RDP to Azure VM", stepIndex: 10, stepType: "success", title: "Connect via Bastion", description: "After fix, prefer Bastion: VM → Connect → Bastion → enter creds. No public IP, no NSG rule needed." },

  // ── Storage account access denied (403)
  { flowName: "Storage account access denied (403)", stepIndex: 1, stepType: "action", title: "Identify auth method used", description: "SAS token / Account key / AAD identity (RBAC) / Anonymous? Each has separate failure modes." },
  { flowName: "Storage account access denied (403)", stepIndex: 2, stepType: "question", title: "Using SAS token?", description: "SAS has expiry + permissions + IP restrictions." },
  { flowName: "Storage account access denied (403)", stepIndex: 3, stepType: "action", title: "Verify SAS expiry + permissions", description: "Decode SAS in browser dev tools. Check <code>se</code> (expiry), <code>sp</code> (permissions: r/w/d/l), <code>sip</code> (IP range)." },
  { flowName: "Storage account access denied (403)", stepIndex: 4, stepType: "question", title: "Using AAD identity?", description: "RBAC role required." },
  { flowName: "Storage account access denied (403)", stepIndex: 5, stepType: "action", title: "Verify RBAC assignment", description: "Storage Account → Access Control (IAM) → Role assignments → look for \"Storage Blob Data Reader\" or higher for the identity. Wait 5 min after assignment." },
  { flowName: "Storage account access denied (403)", stepIndex: 6, stepType: "question", title: "Storage account firewall blocking?", description: "Most common cause even when RBAC is correct." },
  { flowName: "Storage account access denied (403)", stepIndex: 7, stepType: "action", title: "Check Networking blade", description: "Storage Account → Networking → \"Public network access\". If \"Selected networks\", verify your IP is on allow list OR set to \"Disabled\" + use Private Endpoint." },
  { flowName: "Storage account access denied (403)", stepIndex: 8, stepType: "question", title: "Using account key but secure transfer enforced?", description: "TLS 1.2 required since 2020." },
  { flowName: "Storage account access denied (403)", stepIndex: 9, stepType: "action", title: "Use HTTPS not HTTP", description: "Storage Account → Configuration → \"Secure transfer required\" = Enabled. Client must use https:// URL." },
  { flowName: "Storage account access denied (403)", stepIndex: 10, stepType: "success", title: "Test with az storage", description: "<code>az storage blob list --account-name X --container Y --auth-mode login</code>. Returns list = working." },

  // ── Sentinel data connector "No data"
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 1, stepType: "action", title: "Check connector status", description: "Sentinel → Data connectors → click connector → \"Last Log Received\". Should be recent (within last hour for most sources)." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 2, stepType: "question", title: "Last Log Received > 24 hours ago?", description: "Data pipeline broken." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 3, stepType: "action", title: "Verify source resource is logging", description: "Go to source resource (e.g. NSG) → Diagnostic settings → check enabled + correct workspace + correct log categories." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 4, stepType: "question", title: "Diagnostic settings enabled but no data?", description: "Path is right, content is missing." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 5, stepType: "action", title: "Run KQL to test", description: "<code>&lt;TableName&gt; | take 10</code>. If empty: data not arriving at workspace. Check workspace ID + key match." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 6, stepType: "question", title: "Custom DCR transformation dropping data?", description: "Data Collection Rule could filter everything out." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 7, stepType: "action", title: "Inspect DCR transformations", description: "Workspace → Data Collection Rules → check transformKQL field. If filter is too strict, data drops silently." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 8, stepType: "question", title: "Workspace daily cap reached?", description: "Sentinel has optional ingestion cap." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 9, stepType: "action", title: "Check workspace daily cap", description: "Workspace → Usage and estimated costs → Daily cap. Increase or remove if needed. Cap triggers data drop." },
  { flowName: "Sentinel data connector \"No data\"", stepIndex: 10, stepType: "success", title: "Confirm with test event", description: "Generate a known event (e.g. failed sign-in). Wait 10-15 min. Run KQL filter for that event. Confirm visible." },
];
