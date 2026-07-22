/**
 * Articles seed data — long-form reference pages ported from the standalone
 * itbd-lab static site (concepts.html, foundations.html, e2e-projects.html,
 * graph-api.html, hybrid-infra.html, postmortems.html, routing-protocols.html).
 * Used by the one-time admin seed endpoint to populate labs_articles; not
 * read directly at request time.
 *
 * Unlike Bucket A's flat-field tables, each source page here is long-form
 * prose/tutorial content best represented as a single markdown body per
 * article rather than atomic columns.
 */

export type ArticleSeedEntry = {
  slug: string;
  title: string;
  category: string;
  sourcePage: string;
  summary: string;
  bodyMarkdown: string;
  sortOrder: number;
};

export const ARTICLES_SEED: ArticleSeedEntry[] = [
  {
    slug: "concepts",
    title: "Concepts — Fundamentals Every IT Admin Must Know",
    category: "Fundamentals",
    sourcePage: "concepts.html",
    summary: "26 interactive fundamentals primers spanning OSI, subnetting, DNS, Kerberos, OAuth, Zero Trust, TLS 1.3, JWT, X.509 certificates, PIM, CI/CD, SAML, MFA methods, OWASP Top 10, and REST/GraphQL/gRPC.",
    bodyMarkdown: `# Concepts — Fundamentals every IT admin must know

Interactive OSI model, subnetting calculator, DKIM/SPF/DMARC, MDM vs MAM, HA vs DR vs FT vs Backup, XDR vs EDR vs SIEM vs SOAR.

## OSI Model — 7 layers with real-world examples

Click any layer to see what lives there + the common troubleshooting tools.

**L7 — Application**
- What: HTTP, HTTPS, DNS, SMTP, FTP, SSH, SNMP, NTP. The protocol your app speaks.
- Troubleshoot: curl, browser DevTools, Postman, Wireshark HTTP filter, application logs.

**L6 — Presentation**
- What: Encoding (UTF-8, base64), encryption (TLS), compression (gzip, brotli).
- Troubleshoot: openssl s_client, TLS ClientHello in Wireshark, cipher suite mismatch.

**L5 — Session**
- What: Session establishment + tear-down (NetBIOS, RPC, SOCKS). Often merged with L4 in practice.
- Troubleshoot: session timeouts, connection resets at higher protocols.

**L4 — Transport**
- What: TCP (reliable, ordered) + UDP (fast, lossy). Ports identify processes.
- Troubleshoot: netstat, ss, tcpdump -p, Wireshark TCP analysis (retransmit, window scaling).

**L3 — Network**
- What: IPv4, IPv6, ICMP. Routing between subnets. ARP belongs to L2/L3 boundary.
- Troubleshoot: ping, traceroute, ip route, mtr, Wireshark IP/ICMP filter.

**L2 — Data Link**
- What: Ethernet, Wi-Fi 802.11, ARP, MAC addresses, VLAN tagging.
- Troubleshoot: arp -a, switch port status, VLAN mismatch, MAC flapping in switch logs.

**L1 — Physical**
- What: Cables, RJ-45, fiber, wireless radio, link lights, SFP modules.
- Troubleshoot: link light off? cable tester? sfp diagnostics? distance limits (Cat6 = 100m).

## Subnetting Calculator

Enter a CIDR like \`10.0.0.0/16\` and split into smaller subnets. Math shown below.

The calculator takes a base network, a base prefix, and a new (smaller) prefix to subnet into, and computes the resulting subnet count, block size, and usable host ranges.

## DKIM vs SPF vs DMARC — setting up email authentication for cloudlab.in

Three records in DNS. Each proves a different thing. Roll out in this order: SPF → DKIM → DMARC.

**1. SPF (Sender Policy Framework)**
Proves: "These IPs are allowed to send mail for cloudlab.in."
DNS record (TXT on root): \`v=spf1 include:spf.protection.outlook.com -all\`
Failure mode: \`-all\` = hard fail (reject). \`~all\` = soft fail (mark spam).

**2. DKIM (DomainKeys Identified Mail)**
Proves: "This message was signed with the private key matching the public key in DNS — not tampered with."
DNS record: \`selector1._domainkey.cloudlab.in\` CNAME → \`selector1-cloudlab-in._domainkey.cloudlabin.onmicrosoft.com\`
Enable in M365: Defender portal → Email authentication → DKIM → Enable for cloudlab.in.

**3. DMARC (Domain-based Message Authentication, Reporting & Conformance)**
Proves: "Tells receivers what to do if SPF or DKIM fail."
DNS record: \`_dmarc.cloudlab.in\` TXT → \`v=DMARC1; p=quarantine; rua=mailto:dmarc@cloudlab.in; pct=100\`

Rollout sequence:
1. Start \`p=none; rua=mailto:dmarc@cloudlab.in\` — collect aggregate reports for 2-4 weeks. Make sure all legit senders pass.
2. Move to \`p=quarantine; pct=25\` — 25% of failures go to junk. Watch reports.
3. Ramp \`pct=50, pct=100\`.
4. Finally \`p=reject\` — bouncing failed mail outright.

## MDM vs MAM vs CMG

Three device management models. Pick based on who owns the device.

| | MDM (Mobile Device Management) | MAM (Mobile App Management) | CMG (Cloud Management Gateway) |
|---|---|---|---|
| What it manages | The WHOLE device — OS, apps, network, settings. | Only the corporate APPS on the device — not OS. | Internet-facing endpoint that exposes on-prem Configuration Manager over HTTPS. |
| Device ownership | Corporate | BYOD (personal device with work apps) | Used with corporate or BYOD via SCCM |
| Enrollment | Company Portal / Apple ABM / Android Enterprise / Windows Autopilot | App-launch prompt (sign in with work account in Outlook → MAM policy applies) | Internet-based devices reach CMG, which forwards to SCCM site server. |
| User experience | IT controls everything — can wipe whole device. | Personal photos untouched. Selective wipe = only work data removed. | SCCM features (software updates, app deploy) work even when device is off-VPN. |
| Microsoft product | Intune MDM | Intune App Protection Policies | SCCM CMG (now Configuration Manager) |
| When to use | Corporate laptops / phones / kiosks | BYOD where employees refuse full MDM enrollment | Org migrating from SCCM → Intune but still has on-prem app/update mgmt |

## HA vs DR vs FT vs Backup

Four resiliency concepts students mix up. Each addresses a different failure mode + cost tier.

| | High Availability (HA) | Fault Tolerance (FT) | Disaster Recovery (DR) | Backup |
|---|---|---|---|---|
| Goal | Survive 1 component failure — auto-failover | Zero downtime even with hardware failure | Recover from REGION / SITE loss | Restore data after corruption / deletion |
| RTO target | Seconds to minutes | Zero | Hours to days | Hours |
| RPO target | Zero (sync replication) | Zero | Minutes to hours (async) | Daily / weekly (point-in-time) |
| Cost | 1.5-2x base | 2x+ base (specialised hardware / lockstep VMs) | 0.5-1x base (cold/warm/hot standby) | Pennies per GB / month |
| Example | Hyper-V Failover Cluster, AlwaysOn AG, Azure VM Availability Set | VMware FT (lockstep secondary VM), mainframe systems | Azure Site Recovery to West region, VeeAm replica to DR site | Azure Backup (vault), Veeam, Cohesity, tape |
| Protects against | Single VM / disk / NIC failure | Any single hardware fault | Datacenter loss, region outage, cyber attack | Ransomware, accidental delete, corruption, audit needs |
| You still need | + DR, + Backup | + DR, + Backup | + HA, + Backup | + HA, + DR |

**Rule of thumb:** HA protects against component failure. DR protects against site/region failure. Backup protects against data loss. FT is rare in commodity infra. **All three are needed; they do not replace each other.**

## XDR vs EDR vs SIEM vs SOAR

Four security stack categories. Microsoft ships all four.

| | EDR | XDR | SIEM | SOAR |
|---|---|---|---|---|
| Full name | Endpoint Detection & Response | Extended Detection & Response | Security Information & Event Management | Security Orchestration, Automation & Response |
| Data scope | Endpoints (Windows, Mac, Linux, mobile) | Endpoints + identity + email + cloud apps + IoT (cross-domain) | EVERYTHING (firewall logs, AD, cloud APIs, web servers, custom apps) | Receives alerts — runs playbooks |
| Action | Block, isolate, live response on endpoint | Cross-domain investigation + auto-response | Detection rules + dashboards + investigation | Playbook automation — revoke tokens, disable user, page on-call, raise ticket |
| Microsoft product | Defender for Endpoint | Microsoft Defender XDR (security.microsoft.com) | Microsoft Sentinel | Sentinel Playbooks (Logic Apps) |
| Buying it solo gives you | Endpoint-only detection | Unified incident across identity / email / endpoint / cloud | Single pane of all log sources + custom rules | Just automation — you still need detection tools |
| Typical org uses | For each endpoint type | Replaces the need for separate EDR + email security + CASB tools | Compliance, regulated industries, long retention | Mature SOC reducing manual work |

**Stack pattern:** Defender XDR + Sentinel + Logic Apps = Microsoft's end-to-end SOC stack. Defender XDR is the analyst console; Sentinel ingests + correlates everything else; Logic Apps automates response.

## Cloud vs On-premise

Why orgs move (or stay).

| | On-premise | IaaS (Azure VM) | PaaS (App Service, SQL DB) | SaaS (M365, Salesforce) |
|---|---|---|---|---|
| You manage | Everything (hardware → app) | OS + middleware + app | App + data only | Nothing — config only |
| Capex vs Opex | Capex (depreciate over years) | Opex (monthly) | Opex (monthly) | Opex (per-user) |
| Scaling | Buy more hardware (weeks) | Resize VM (minutes), or scale set | Auto-scale built-in | Provider handles it |
| Patching | Your SCCM / WSUS | You own OS patches (Update Manager helps) | Provider patches OS + runtime | Provider patches everything |
| When it wins | Regulatory (data residency), legacy apps, stable workload, sunk-cost hardware | Lift-and-shift cloud migration, need OS control | Greenfield apps, don't want OS burden | Common business functions (email, CRM, HR) |

## TCP vs UDP

Both run at Layer 4. Pick based on whether your app needs reliability or speed.

| | TCP | UDP |
|---|---|---|
| Reliability | Guarantees delivery + order. Retransmits lost packets. | Fire-and-forget. No guarantees. |
| Connection | 3-way handshake (SYN → SYN-ACK → ACK) | No connection — just send. |
| Overhead | Higher (header + ACKs + retransmissions) | Minimal (8-byte header) |
| Ordering | Yes — packets reordered if needed. | No — app must handle ordering. |
| Use cases | HTTP, SSH, SMTP, FTP, file transfer — anything where loss is unacceptable. | DNS, VoIP/RTP, video streaming, online games, DHCP — speed > correctness. |
| Replaced by | QUIC (HTTP/3) — but built on UDP for transport speed. | Still dominant for media + low-latency. |

## DNS resolution — the 8-step walkthrough every admin must know

Type \`portal.azure.com\` in your browser. What actually happens to find the IP?

**The 8 steps (recursive resolution)**
1. **Browser cache** — check local cache for a fresh \`portal.azure.com\` entry.
2. **OS hosts file + cache** — \`/etc/hosts\` on Linux, \`C:\\Windows\\System32\\drivers\\etc\\hosts\` on Windows. \`ipconfig /displaydns\`.
3. **Configured DNS resolver** — usually your router or 8.8.8.8 / 1.1.1.1 / your AD DC.
4. **Recursive resolver asks root servers** ("Who handles \`.com\`?"). 13 root servers (a-m.root-servers.net).
5. **Root replies with TLD nameservers** for \`.com\`.
6. **Resolver asks TLD nameservers** ("Who handles \`azure.com\`?").
7. **TLD replies with authoritative nameservers** for \`azure.com\`.
8. **Authoritative NS returns the A / AAAA / CNAME** for \`portal.azure.com\`. Resolver caches it for the TTL.

**DNS record types — what each does**

| Type | Purpose |
|---|---|
| A | Hostname → IPv4 (e.g. \`cloudlab.in → 13.71.184.1\`) |
| AAAA | Hostname → IPv6 |
| CNAME | Alias to another name (e.g. \`www → cloudlab.azurewebsites.net\`) |
| MX | Mail server with priority (e.g. \`10 cloudlab-in.mail.protection.outlook.com\`) |
| TXT | Arbitrary text — SPF, DKIM, DMARC, domain verification |
| NS | Which nameservers are authoritative for this zone |
| SOA | Start of Authority — serial, refresh, TTL defaults |
| SRV | Service location (e.g. \`_sip._tls.cloudlab.in → sipdir.online.lync.com\` port 443) |
| PTR | Reverse: IP → hostname (used for spam reputation) |
| CAA | Which CAs are authorised to issue certs for this domain |

**Common troubleshooting**
\`nslookup portal.azure.com\` · \`dig portal.azure.com +trace\` · \`Resolve-DnsName -Type ALL\` · \`ipconfig /flushdns\` (Win) or \`sudo systemd-resolve --flush-caches\` (Linux).
Records cached badly? Lower TTL *before* the change, wait for old TTL to expire, make the change, then raise TTL again.

## Kerberos vs NTLM — how Windows authenticates

Every AD-joined workstation, file share, and SQL server uses one of these. NTLM is legacy; Kerberos is the modern default.

| | Kerberos | NTLM |
|---|---|---|
| Year | 1993 (MIT). Default on AD since Win2000. | 1993. Legacy fallback. |
| Trust model | Mutual auth via tickets from KDC (Key Distribution Center) on every DC. | Challenge-response only verifies the client. Server is NOT verified. |
| Crypto | AES-256 (modern) / AES-128 / RC4-HMAC (legacy, disable). DES is dead. | NTLMv2 (HMAC-MD5). NTLMv1 is broken — disable everywhere. |
| Tickets | TGT (10h) → service ticket per resource. Stored in LSA cache. | No tickets — fresh challenge every time. Hash sent on wire. |
| Pass-the-hash | Hard — credentials live as tickets, not hashes. | Trivial — capture an NTLM hash from memory, replay. |
| Delegation | Yes — constrained / RBCD (resource-based) / unconstrained (dangerous). | No delegation. |
| Trust direction | Cross-forest works via referrals. | Single domain only (mostly). |
| SPNs | Required — SPN must exist for the service (HTTP, MSSQLSvc, host). | No SPN needed. |
| Time skew | 5-minute clock-skew tolerance — sync NTP or auth fails. | Time-insensitive. |
| Fallback | If SPN missing / wrong → falls back to NTLM (audit + disable in 2026). | — |
| Detection | Event 4769 (TGS request) on DC. \`klist\` on client. | Event 4624 type 3 logon. \`Get-WinEvent\` with LogonType=3. |

**The Kerberos ticket flow (memorise this)**
1. **AS-REQ**: Client (user) → KDC (DC). Encrypted with user's password hash as pre-auth.
2. **AS-REP**: KDC → Client. Returns a TGT (encrypted with krbtgt secret) + session key.
3. **TGS-REQ**: Client → KDC. "I want a ticket for the SPN \`HTTP/portal.contoso.com\`." Sends TGT.
4. **TGS-REP**: KDC → Client. Returns a service ticket (encrypted with the service account's key).
5. **AP-REQ**: Client → Service. Presents the service ticket. Service decrypts with its own key — mutual auth complete.

**Common Kerberos attacks**
**Kerberoasting** — request a service ticket for any SPN, crack it offline (weak service account passwords).
**AS-REP roasting** — for accounts with pre-auth disabled, request a TGT and crack offline.
**Golden ticket** — forge a TGT with the \`krbtgt\` hash. Detection: rotate krbtgt twice / 6 months.
**Silver ticket** — forge a service ticket with the service account hash. No TGT involvement.
**Skeleton key** — LSASS implant that accepts any password as valid.

## OAuth 2.0 / OIDC — how modern apps authenticate

Entra ID, Google, Auth0, Okta all use these. Every "Sign in with Microsoft" / "Sign in with Google" button is a flow below.

| | OAuth 2.0 | OIDC (OpenID Connect) |
|---|---|---|
| Purpose | **Authorisation** — "can this app do X on my behalf?" | **Authentication** — "who is this user?" |
| Token | Access token (opaque or JWT). For API calls. | ID token (always JWT). Proves the user logged in. |
| Built on | — | OAuth 2.0 + UserInfo endpoint + ID token. |
| Discovery | — | \`/.well-known/openid-configuration\` — auto-discovers endpoints + signing keys. |
| Scopes | \`https://graph.microsoft.com/Mail.Read\` | \`openid profile email\` + OAuth scopes. |

**The 5 OAuth grant flows — when to use which**

| Flow | When to use |
|---|---|
| Authorization Code + PKCE | **Default for SPAs + mobile + native apps.** Browser redirect → auth code → token. PKCE prevents code interception. |
| Authorization Code (no PKCE) | Server-side web apps with a client secret. Same redirect dance, secret stays on server. |
| Client Credentials | App-to-app, no user. Daemon / cron / function calling Graph as itself. Uses certificate or secret + tenant ID. |
| On-Behalf-Of (OBO) | API A receives a user token, exchanges it for a new token to call API B as the user. |
| Device Code | TV / CLI / printer with no browser. User types code at \`aka.ms/devicelogin\`. |
| Resource Owner Password Credentials (ROPC) | **DEPRECATED.** App handles the password. Defeats MFA. Use only for legacy migration. |
| Implicit Flow | **DEPRECATED.** Token in the URL fragment. Replaced by Auth Code + PKCE. |

**Auth Code + PKCE flow (the modern default)**
1. App generates a random \`code_verifier\` + \`code_challenge = SHA256(code_verifier)\`.
2. App redirects user to \`login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize\` with \`code_challenge\`.
3. User signs in + consents. Entra redirects back with \`?code=...\`.
4. App POSTs to \`/token\` with the \`code\` + \`code_verifier\`.
5. Entra returns \`access_token\` (1 hour) + \`refresh_token\` (90 days) + \`id_token\` (OIDC).
6. App calls Graph with \`Authorization: Bearer {access_token}\`.

**Common token attacks**
**Consent phishing** — attacker registers an app, tricks users into consenting to \`Mail.ReadWrite\` + \`offline_access\`. Mitigation: admin consent workflow for risky permissions.
**Token theft** — lift the access token from a compromised browser. Mitigation: short token lifetime, Continuous Access Evaluation (CAE), token binding.
**Refresh-token replay** — attacker steals refresh token, gets new access tokens. Mitigation: refresh-token rotation, revoke on risky sign-in.

## Zero Trust — never trust, always verify

"Castle and moat" security is dead. Zero Trust assumes the attacker is *already inside* the network. Three guiding principles + six pillars.

**The 3 guiding principles (memorise verbatim)**
1. **Verify explicitly** — auth + authz on every request, based on identity + device + location + risk + behaviour. Not just username/password.
2. **Least privilege access** — just-enough-access (JEA), just-in-time (JIT) via PIM, risk-based adaptive policies.
3. **Assume breach** — minimise blast radius. Segment. Encrypt end-to-end. Use analytics to detect, drive threat protection.

**The 6 pillars**

| Pillar | Coverage |
|---|---|
| Identities | Strong MFA, passwordless, CA, PIM, identity protection (risky sign-ins). |
| Endpoints | Device compliance (Intune), EDR (Defender for Endpoint), app protection (MAM). |
| Applications | App proxy, app discovery (Defender for Cloud Apps), session controls. |
| Data | Classify (Purview labels), encrypt (DLP / IRM), monitor (audit + UEBA). |
| Infrastructure | JIT for VMs, NSG / firewall, Defender for Cloud, immutable infra. |
| Network | Micro-segmentation, no flat networks, encrypt internal traffic, ZTNA > VPN. |

**Maturity model — where are you?**
**Traditional** (Stage 1): On-prem firewall + AD + VPN. Trust the LAN. → **Advanced** (Stage 2): MFA everywhere, CA enforced, devices managed by Intune, perimeter shrinking. → **Optimal** (Stage 3): Passwordless, PIM for everything, all access risk-based, encrypted east-west traffic, micro-segmented apps, continuous evaluation.

## Backup 3-2-1, RPO & RTO — the rules every admin must explain

When the lawyer / auditor / CFO asks "how much data can we lose?" and "how fast can we recover?" — these are the answers.

**The 3-2-1 rule (and the 3-2-1-1-0 extension)**
- **3** — keep **3** copies of your data (1 primary + 2 backups).
- **2** — on **2** different media types (disk + tape, or Blob + Cool tier, etc.).
- **1** — **1** copy *off-site* (different physical building or region).
- **+1** (modern) — 1 copy **offline / air-gapped / immutable** (ransomware insurance).
- **+0** — **0** verification errors after restore tests. Test quarterly minimum.

**RPO vs RTO — don't confuse these**

| | Meaning |
|---|---|
| RPO — Recovery Point Objective | **How much data can you lose?** Measured in *time*. RPO = 1 hour means "we can afford to lose up to 1 hour of writes." Sets the backup **frequency**. |
| RTO — Recovery Time Objective | **How fast must you be back online?** Measured in *time*. RTO = 4 hours means "from disaster to restored, max 4 hours." Sets the backup **type** + restore tooling. |

**Mapping RPO/RTO to backup technology**

| Need | RPO / RTO | Technology |
|---|---|---|
| Mission-critical (banking, e-commerce checkout) | RPO seconds / RTO < 1h | Sync replication + active-active. Azure DB geo-replicas, AKS multi-region, Front Door. |
| Important (CRM, ERP) | RPO 15 min / RTO 4h | Async replication. Azure Site Recovery (ASR), SQL geo-restore. |
| Standard (line of business) | RPO 24h / RTO 24h | Daily backup. Azure Backup, Veeam, Recovery Services Vault. |
| Archive (compliance only) | RPO 7-30d / RTO 7d | Cool / Archive tier blob storage. Cold backups, slow restore. |

**Ransomware-era additions**
**Immutable backups** — once written, cannot be deleted/modified (Azure Backup Immutable Vaults, AWS Object Lock). Beat ransomware that deletes backups.
**Air-gapped copy** — offline tape / removable media in a vault. Last line of defence.
**Restore tests** — if you haven't restored from it, it's not a backup. Test full-restore quarterly.

## IPv4 vs IPv6 — what's actually different

IPv4 exhaustion is real. IPv6 has been "coming" for 20 years — but it's now mandatory for new mobile carriers, IoT, and Azure dual-stack. Know the differences.

| | IPv4 | IPv6 |
|---|---|---|
| Address size | 32 bits (4 billion addresses) | 128 bits (3.4 × 10^38 addresses) |
| Notation | Dotted decimal: \`192.168.1.1\` | Hex colons: \`2001:db8::1\` (with \`::\` for zero compression) |
| Header | 20 bytes (12 fields, variable options) | 40 bytes fixed (8 fields, extension headers) |
| Configuration | Manual or DHCP | SLAAC (auto) + DHCPv6 + Stateless |
| NAT needed? | Yes — everyone NATs (private → public) | No — every device gets a public address. NAT66 exists but discouraged. |
| Broadcast | Yes (\`255.255.255.255\`) | No — replaced by multicast + anycast |
| ARP / NDP | ARP (Address Resolution Protocol) | NDP (Neighbor Discovery Protocol — uses ICMPv6) |
| IPsec | Optional | Mandatory in spec (often disabled in practice) |
| Loopback | \`127.0.0.1\` | \`::1\` |
| Link-local | \`169.254.0.0/16\` (APIPA) | \`fe80::/10\` (always present, auto-generated) |
| Private range | \`10/8\`, \`172.16/12\`, \`192.168/16\` | \`fc00::/7\` (ULA — Unique Local Addresses) |
| Fragmentation | Routers can fragment | Only the sender fragments (Path MTU Discovery mandatory) |
| Subnetting | VLSM — arbitrary masks | Always /64 for end networks (SLAAC requires it) |

**Reading an IPv6 address — \`2001:0db8:85a3:0000:0000:8a2e:0370:7334\`**
- **Drop leading zeros** in each group: \`2001:db8:85a3:0:0:8a2e:370:7334\`
- **Collapse runs of zeros** with \`::\` (once per address): \`2001:db8:85a3::8a2e:370:7334\`
- **Network part** is first 64 bits, **host part** is last 64 (always for end LANs).
- **EUI-64**: host portion can derive from MAC address by flipping U/L bit + inserting \`ff:fe\`.

**Coexistence strategies**
**Dual-stack** — run both. Default in Azure VNets. Apps pick whichever DNS returns.
**Tunneling** — 6to4, Teredo, ISATAP. Legacy — avoid in production.
**Translation** — NAT64 / DNS64. Carrier-grade, for IPv6-only clients needing IPv4 services.

## RBAC vs ABAC vs PBAC — how access decisions are made

Every "who can do what to which thing under which conditions" question. Three answers, all in use.

| | RBAC (Role-based) | ABAC (Attribute-based) | PBAC (Policy-based) |
|---|---|---|---|
| Question answered | "What role does this user have?" | "What attributes does this user / resource / context have?" | "What does the policy say in this context?" |
| Example | User is in *Storage Account Contributor* role → can write to any storage account in scope. | User in Finance AND from corporate IP AND on managed device → can read Finance SharePoint site. | Conditional Access: "Block sign-in if user-risk=High AND device unmanaged." |
| Where you see it | Azure RBAC, AWS IAM, Linux groups, M365 admin roles. | Azure ABAC (storage data-plane), AWS IAM conditions, M365 Adaptive Scopes. | Entra Conditional Access, Defender for Cloud Apps session policies, Purview DLP, AWS SCPs. |
| Granularity | Role = bundle of permissions. Coarse-grained. | Per-attribute. Fine-grained but explosion of combinations. | Policy can combine RBAC + ABAC + risk signals. |
| Auditability | Easy: "show me everyone with role X." | Hard: must evaluate attribute-set per request. | Hardest: outcomes depend on runtime context. |
| When to use | Default. Static, well-known job functions. | Add when role alone is too coarse (data classification, location, project tags). | Wrap everything else. Use risk + device + location to gate the resulting access. |

**Real example: Azure storage**
**RBAC alone:** \`Storage Blob Data Contributor\` on the storage account → can read/write every container.
**+ ABAC condition:** Restrict the SAME role to objects with \`tag.Project = "Apollo"\`. Now the same user can only write to Apollo-tagged blobs in that account. One role, two scopes.
**+ PBAC (CA policy):** "Require managed device for any RBAC role with \`*write*\` permissions." Now even with role + ABAC, write fails from BYOD.

## TLS 1.3 handshake — how HTTPS sets up

The single most-asked interview question for security + network roles. TLS 1.3 cut the handshake from 2 round-trips to 1 (or 0 with resumption).

**TLS 1.3 — the 5 messages (1 RTT)**
1. **ClientHello** — client lists supported cipher suites + key shares (X25519, P-256) + SNI hostname + ALPN protocols (h2, http/1.1) + 0-RTT data (if resuming).
2. **ServerHello** — server picks cipher suite + key share + sends its certificate chain + signed key share + Finished.
3. **(Client validates cert chain)** — checks against trusted root CA, OCSP staple, SAN matches hostname, not expired, not revoked.
4. **Client Finished** — client sends Finished + application data (HTTP GET). Encrypted under derived session key.
5. **Application data flows** — both ways, AEAD-encrypted (AES-GCM or ChaCha20-Poly1305).

| | TLS 1.2 | TLS 1.3 |
|---|---|---|
| RTTs | 2 (full) / 1 (resume) | 1 (full) / 0 (resume with PSK) |
| Cipher suites | ~37 supported; many weak (RC4, 3DES, SHA-1) | 5 only (AES-GCM, ChaCha20-Poly1305 + SHA-256/384) |
| Forward secrecy | Optional (only with DHE/ECDHE suites) | Mandatory (always Diffie-Hellman) |
| RSA key exchange | Allowed (insecure) | Removed |
| Renegotiation | Yes (CVE-prone) | Removed |
| Compression | Allowed (CRIME attack) | Removed |
| SNI encryption | Plaintext | Encrypted Client Hello (ECH) in deployment |
| Cert validation | Same OCSP / CRL chain | Same (no change) |

**Common troubleshooting**
**"ERR_CERT_AUTHORITY_INVALID":** server cert not signed by a CA your client trusts (private CA missing from trust store, or expired root).
**"ERR_CERT_DATE_INVALID":** server clock off OR cert past \`notAfter\`.
**"ERR_SSL_PROTOCOL_ERROR":** client + server can't agree on TLS version or cipher (often: forcing TLS 1.0/1.1 on modern servers).
**"Bad handshake":** hostname-mismatch (SNI hostname doesn't match cert SAN).
**Test:** \`openssl s_client -connect host:443 -servername host -tls1_3\` · \`nmap --script ssl-enum-ciphers -p 443 host\`.

## JSON Web Token (JWT) — the bearer token format

Every Entra ID token, every OAuth access token, every "Bearer eyJhbG..." you see in HTTP headers. Decoded in 60 seconds.

**3 parts, dot-separated**

\`eyJhbGciOiJSUzI1NiIsImtpZCI6IkpKWXc...".eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc2....FE3sj8WyhqMpD4qXq91...\`

1. **Header** — base64-encoded JSON. Contains \`alg\` (signing algorithm: RS256, HS256, ES256), \`kid\` (key ID — which public key to verify with), \`typ\` (JWT or JWE).
2. **Payload (claims)** — base64-encoded JSON. Contains \`aud\` (audience — who this token is for), \`iss\` (issuer — who minted it), \`sub\` (subject — user ID), \`exp\` (expiry epoch), \`iat\` (issued at), \`nbf\` (not before), \`scp\` (OAuth scopes), \`roles\` (app roles), \`oid\` (Entra object ID), \`tid\` (tenant ID), \`azp\` (authorized party / client app).
3. **Signature** — HMAC or RSA/ECDSA signature of \`base64(header) + "." + base64(payload)\`. Proves the token wasn't tampered with.

**Validation steps (every API must do this)**
1. Split on dots → header, payload, signature.
2. Decode header → look up signing key from issuer's JWKS endpoint (\`https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys\`) using \`kid\`.
3. Verify signature against \`base64(header) + "." + base64(payload)\`.
4. Check \`iss\` matches expected issuer.
5. Check \`aud\` matches your API's audience.
6. Check \`exp\` > now (and optionally \`nbf\` < now).
7. Authorise: inspect \`scp\`/\`roles\` claims against the requested operation.

**Common JWT attacks**
**Algorithm confusion (\`alg: none\`):** attacker sends a token with no signature; broken libraries accept it. Always whitelist algs.
**HS/RS confusion:** attacker signs a token with HMAC using the public key as the secret. Mitigation: verify \`alg\` matches expected.
**Token theft + replay:** capture from compromised browser, replay until \`exp\`. Mitigation: short TTL, CAE (Continuous Access Evaluation), token binding.
**Sensitive data in claims:** JWTs are NOT encrypted, only signed. Anyone with the token can decode the payload at jwt.ms. Don't put PII or secrets.

## X.509 certificate lifecycle — cradle to grave

Web servers, mTLS for APIs, Entra app sign-in, code signing — same lifecycle. Get this once, never confused again.

**The 6 phases**
1. **Key generation** — private key generated (RSA 2048+ / EC P-256+) and CSR (Certificate Signing Request) created with subject + SANs + key usage.
2. **Issuance** — CSR submitted to CA. Public CA validates domain ownership (DNS / HTTP / email). Private CA validates via internal trust. CA signs the cert with its private key.
3. **Installation** — cert installed on the server (Windows cert store / Linux \`/etc/ssl/certs\` / Azure Key Vault / AWS ACM). Linked to the private key in the same store.
4. **Use** — presented during TLS handshake. Client validates signature chain back to a trusted root in its trust store.
5. **Renewal** — before \`notAfter\`, generate new CSR (often same key, sometimes new key for rotation). Common: 90-day Let's Encrypt, 397-day public CA max (since 2020).
6. **Revocation** — if compromised: CA publishes serial to CRL (Certificate Revocation List) or OCSP responder. Clients check during validation.

| Cert type | Issued by | Validation | Use |
|---|---|---|---|
| DV (Domain Validated) | Let's Encrypt, ZeroSSL | DNS or HTTP-01 | Standard HTTPS |
| OV (Organization Validated) | DigiCert, Sectigo | DV + business verification | Corporate websites |
| EV (Extended Validation) | DigiCert, Sectigo | Strict legal-identity verification | Banking, gov't (showed "green bar" until 2019) |
| Wildcard | Public or private CA | One cert for \`*.cloudlab.in\` | Multi-subdomain — but blast radius if stolen |
| SAN / multi-domain | Public or private CA | Up to 100 SANs in one cert | Many domains in one cert (e.g., Office 365) |
| Client / mTLS | Private CA | Client presents to server | API-to-API auth, smart cards, RDP |
| Code signing | DigiCert, Sectigo | Identity + EV-class | Sign executables, drivers, Office macros |

**Common cert pitfalls**
**Forgot to renew:** outage. Mitigation: automated renewal (Certbot, Let's Encrypt, ACME) + 30-day alert.
**Private key leaked:** rotate immediately, revoke old cert via CRL/OCSP, audit access logs to KV / file system.
**Untrusted root:** client device doesn't have your private CA installed. Push via Group Policy / Intune / mobile MDM.
**OCSP stapling not enabled:** client must check OCSP responder directly → 100+ ms added to every TLS handshake. Enable on Nginx/Apache/IIS.
**Weak ciphers / algorithms:** RSA < 2048 bit, MD5/SHA-1 signatures = browser warnings. Rotate to ECDSA P-256 + SHA-256.

## PIM / JIT / PAM — just-in-time privileged access

Standing admin access is the #1 attack-surface contributor. JIT activation cuts the window of opportunity to minutes.

| | PIM (Privileged Identity Mgmt) | JIT (Just-In-Time) | PAM (Privileged Access Mgmt) |
|---|---|---|---|
| What it is | Entra ID feature (P2 license) — eligible vs active assignments. | The activation concept itself — request → approve → time-bound. | A category (CyberArk, BeyondTrust, Delinea, Microsoft PAM for AD). |
| Scope | Entra roles + Azure RBAC roles + M365 admin roles + privileged groups. | Any RBAC system (Azure JIT VM access, AWS IAM, on-prem AD). | Servers, network gear, databases, RPA bots, service accounts. |
| Typical flow | User assigned *eligible* Global Reader. Activates via MFA + reason. Active for 1-8h. | Same: standing access removed, JIT-elevation on demand. | "Vault" the privileged credential. Check out via approval + record the session. |
| Approval required | Optional per-role (Global Admin = yes; Helpdesk = no). | Configurable per use case. | Yes for sensitive accounts (root, domain admin). |
| Session recording | No (audit log only). | No (audit log only). | Yes (full keystroke + screen recording for forensic). |
| Where they overlap | PIM IS Microsoft's JIT for Entra. AD PAM extends it for on-prem. | JIT is the technique. PIM + PAM both implement it. | PAM tools often include JIT — but also vault, password rotation, session recording. |

**Best-practice rollout**
1. **Inventory standing admins.** Run \`Get-AzRoleAssignment\` + Entra role report. Any account with permanent Global Admin / Owner is a target.
2. **Convert standing → eligible.** Move every member of high-privilege roles to *eligible* in PIM.
3. **Set activation policy.** Require MFA + justification + approval for Tier-0 (Global Admin, Privileged Role Admin). Maximum 4h. Auto-extend = off.
4. **Break-glass accounts.** 2 accounts excluded from CA + PIM (in case CA itself breaks). Monitor every sign-in.
5. **Quarterly access reviews.** Every PIM-eligible user reviewed; auto-remove inactive after 90 days.
6. **Alert on activation.** Sentinel rule: any Tier-0 activation outside business hours → page security on-call.

## CI/CD pipelines — from commit to production

Whether GitHub Actions, Azure DevOps, GitLab CI, Jenkins — the same 7 stages.

**The 7-stage pipeline**
1. **Source** — commit pushed to \`main\` / PR opened. Webhook triggers the pipeline.
2. **Build** — restore dependencies, compile, transpile, produce artifact (JAR, container image, exe, ZIP).
3. **Unit tests** — run in parallel. Fail-fast: if any unit test fails, abort.
4. **Security scan** — SAST (CodeQL, Semgrep), SCA (Dependabot, Snyk), secret scanning (TruffleHog), container scan (Trivy, Defender for Containers).
5. **Integration tests** — deploy artifact to ephemeral environment + run integration suite (Selenium, Postman, k6 load).
6. **Deploy** — blue/green or canary into staging. Smoke tests. Manual approval gate for production (or automated if mature).
7. **Monitor** — release health dashboards (App Insights / Datadog), error-budget burn-rate alerts, rollback automation if SLO breach.

| | CI (Continuous Integration) | CD (Continuous Delivery) | CD (Continuous Deployment) |
|---|---|---|---|
| Definition | Every commit → build + test. | Every commit → deployable artifact, manual approval to prod. | Every commit that passes tests → AUTO to prod. |
| Frequency | Per commit (minutes). | Per commit; deploys daily/weekly. | Multiple deploys per day (Netflix: 4000+). |
| Risk | Low (no deploy). | Medium (human-approved). | High but mitigated (feature flags, canary, fast rollback). |
| Required for | Any modern dev team. | Most product teams. | Mature SRE org with deep observability. |

**Identity in CI/CD — the modern way**
**Workload Identity Federation (OIDC):** GitHub Actions / Azure Pipelines exchange a workflow-signed token for an Azure access token via Entra ID federation. **No secrets stored.**
**OIDC trust setup (Azure):**
\`Federated identity credential on App Registration\` → issuer \`https://token.actions.githubusercontent.com\` + subject \`repo:org/repo:ref:refs/heads/main\`.
**Result:** the pipeline calls Azure APIs as its app identity, no long-lived service principal secrets to rotate or leak.

## Single Sign-On (SSO) and SAML

SAML pre-dates OIDC and is still the answer for most enterprise federations. ServiceNow, Workday, Salesforce, AWS IAM Identity Center — all SAML-first.

**SAML SP-initiated SSO flow**
1. User hits \`app.contoso.com\` (Service Provider — SP). Not signed in.
2. SP generates an **AuthnRequest** (XML, base64). Redirects browser to IdP login URL with \`SAMLRequest\` param.
3. IdP (Entra ID) authenticates the user (password + MFA + CA).
4. IdP generates a **SAML Response** — XML signed by IdP private key. Contains \`NameID\` (user identifier), \`AttributeStatement\` (groups, email, displayName), and \`AudienceRestriction\` (this SP only).
5. IdP POSTs the SAML Response to SP's **Assertion Consumer Service (ACS)** URL via the browser.
6. SP validates: signature (against IdP cert), audience, conditions (not expired, NotBefore/NotOnOrAfter), recipient.
7. SP creates a local session for the user. User in.

| | SAML 2.0 | OIDC |
|---|---|---|
| Year | 2005 | 2014 |
| Encoding | XML — signed, sometimes encrypted | JSON Web Tokens (JWT) |
| Transport | Browser POST (mostly) + Redirect binding | HTTP redirect + JSON over HTTPS |
| Token format | SAML Assertion (XML) | ID Token + Access Token (JWT) |
| Use case | Browser SSO to web apps; enterprise federation | Browser + mobile + API + IoT |
| Key role | X.509 certs for signing | JWK Set (public keys) |
| Where in Entra | Enterprise Applications — non-gallery SAML | App Registrations |

**Common SAML failures**
**"Signature validation failed":** SP doesn't trust the IdP's signing cert (rotated without uploading new cert), or wrong algorithm (RSA-SHA1 vs RSA-SHA256).
**"NameID mismatch":** NameID format / value doesn't match what the SP expects (User Principal Name vs Email vs Persistent ID).
**"Audience restriction":** SP's expected Entity ID doesn't match the IdP's \`Audience\` claim.
**"Replay attack":** assertion ID already seen — SP keeps a small cache for ~5 min.
**Clock skew:** SP and IdP must agree within 5 min on time. NTP is mandatory.

## MFA methods — strength, UX, cost

Not all MFA is equal. Microsoft + CISA have called out specific methods as broken; the modern recommendation is FIDO2 / passkey / Authenticator number-matching.

| Method | Strength | UX | Phishing-resistant? | Notes |
|---|---|---|---|---|
| FIDO2 security key | Highest | Tap key + PIN | Yes (cryptographic) | YubiKey / Feitian / Titan. Hardware bound. Best for admins. |
| Passkey (Windows Hello / Apple Passkey) | Highest | Biometric | Yes | Synced via iCloud / Google. Device-bound otherwise. Replaces password entirely. |
| Microsoft Authenticator (number matching) | High | Push + 2-digit match | Mostly — defeats MFA fatigue | Default since 2023. Add geo + app context for stronger context. |
| Microsoft Authenticator (legacy push) | Medium | Push tap | No — MFA fatigue attack | Microsoft enforced number-matching tenant-wide 2023. |
| TOTP (Microsoft / Google Authenticator OTP) | Medium | Type 6 digits | No | 30-sec OTP. Standard RFC 6238. Phishable via AiTM. |
| OATH hardware token | Medium | Type 6 digits | No | Physical fob. RSA SecurID, etc. Inventory + replacement burden. |
| Voice call | Low | Answer + press | No | SIM-swap, intercept. Microsoft deprecating for sign-in. |
| SMS text | Low | Type 6 digits | No | SIM-swap. NIST 800-63B downgraded SMS to "restricted." |
| Security questions | Lowest | Type answer | No | Mother's maiden name = LinkedIn search. Never use for sign-in. SSPR backup only. |
| Email OTP (guest B2B) | Low | Click magic link | No | Acceptable for guest B2B only. Compromised email → compromised auth. |

**Modern recommendation (2026)**
1. **Admins / Tier-0:** FIDO2 hardware key (require for PIM activation).
2. **Employees:** Passkey on managed device. Fallback: Authenticator number-matching.
3. **BYOD:** App-protection policy + Authenticator app push.
4. **Disable SMS + Voice** as primary method tenant-wide (allow as backup with audit).
5. **Conditional Access:** require *Phishing-resistant MFA strength* for risky sign-ins + admins.

## Hashing vs Encryption vs Encoding

A common interview question + a common security mistake — base64 is NOT encryption. Hashing is one-way. Encryption is two-way.

| | Encoding (base64, URL) | Hashing (SHA-256, bcrypt) | Encryption (AES, RSA) |
|---|---|---|---|
| Purpose | Transmit binary in text channels | Verify integrity / store password | Confidentiality |
| Reversible? | Yes (no key needed) | No (one-way) | Yes (with the key) |
| Key? | None | None (or "salt") | Required — symmetric or asymmetric |
| Output size | ~4/3 × input | Fixed (256 bits for SHA-256) | ≈ input size (+ IV / nonce) |
| Example use | JWT header, email attachment | Password DB, file integrity, blockchain | HTTPS, disk encryption, KMS |
| Common mistake | Thinking it's "secure" | Using plain SHA-256 for passwords (use bcrypt/argon2) | Hard-coding keys in source code |

**Hash function families**

| Family | Notes |
|---|---|
| MD5 | **Broken.** Collisions known since 2004. Never use for security. |
| SHA-1 | **Broken.** Practical collision 2017 (SHAttered). Avoid. |
| SHA-256 / SHA-512 | Strong for integrity. **But:** too fast for passwords — attacker can brute-force 10^9 hashes/sec on GPU. |
| SHA-3 / Keccak | Newer NIST standard. Use SHA-256 in practice — well-supported. |
| bcrypt | Adaptive — cost factor configurable. Standard for password storage 2000s-2020s. |
| scrypt | Memory-hard — defeats GPU/ASIC brute-force better than bcrypt. |
| Argon2 | **Current recommendation** (2026). Won PHC 2015. Use Argon2id variant. |
| HMAC | Hash-based message authentication. Used for JWT signing, AWS request signing, etc. |

**Symmetric vs asymmetric encryption**

| | Notes |
|---|---|
| Symmetric (AES) | One key for encrypt + decrypt. Fast (GB/sec on modern CPU). Key distribution is the hard problem. AES-256-GCM is the default for data at rest + in transit. |
| Asymmetric (RSA, ECC) | Public key encrypts, private key decrypts. ~1000x slower than AES. Used to bootstrap symmetric — i.e. TLS handshake uses RSA/ECDHE to agree on an AES session key, then bulk encryption is AES. |

## OWASP Top 10 (2021) — the 10 most common web app vulnerabilities

Updated every 3-4 years. Memorise these for any AppSec / pen-test / dev interview. New entries in bold.

| # | Category | Example | Defence |
|---|---|---|---|
| A01 | **Broken access control** | User edits another user's record by changing URL ID | Server-side ACL checks; never trust client; deny-by-default |
| A02 | Cryptographic failures | Storing passwords in plaintext or MD5 | Argon2 for passwords; AES-256-GCM for data; TLS 1.2+ |
| A03 | Injection (SQL / NoSQL / OS / LDAP) | SELECT * FROM users WHERE name='" + input + "' | Parameterised queries; allow-listing; escape on output |
| A04 | **Insecure design** (new in 2021) | Reset-password via security questions only | Threat modeling; secure-by-design patterns; least privilege |
| A05 | Security misconfiguration | Default admin/admin; unnecessary services on; verbose errors | Hardening baselines; least-functionality; minimal stack |
| A06 | Vulnerable + outdated components | log4j (Log4Shell), Spring4Shell, unpatched OS | SBOM; Dependabot / Snyk; quarterly patch cadence |
| A07 | Identification + auth failures | No MFA; long-lived sessions; credential stuffing succeeds | MFA mandatory; rate-limit; CAPTCHA on auth; password breach check |
| A08 | **Software + data integrity failures** (new) | CI/CD plugin from untrusted source; npm package compromise | Signed packages; pinned versions; SLSA framework; supply-chain monitoring |
| A09 | Security logging + monitoring failures | No log of failed sign-ins; attacker undetected for months | SIEM (Sentinel); alert on anomaly; retention 1+ year; immutable logs |
| A10 | **Server-side request forgery (SSRF)** (new) | App fetches a URL from user input; attacker reaches internal metadata service | Allow-list outbound URLs; block link-local (169.254.169.254); zero-trust egress |

**Microsoft mapping:** Defender for Cloud and GitHub Advanced Security both report OWASP Top 10 alignment. Defender for APIs (preview 2026) maps directly to the OWASP API Top 10.

## REST vs GraphQL vs gRPC — API style trade-offs

All three are widely deployed. Pick by problem shape, not fashion.

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Year | 2000 (Fielding) | 2015 (Facebook) | 2016 (Google) |
| Transport | HTTP / HTTPS | HTTP / HTTPS | HTTP/2 (binary) |
| Payload | JSON (typically) | JSON (typically) | Protocol Buffers (binary) |
| Schema | OpenAPI / Swagger (optional) | Required (SDL) | Required (.proto) |
| Endpoint design | Many endpoints (one per resource) | Single endpoint (/graphql) | Many (one per RPC method) |
| Over/under-fetch | Common | Solved (client picks fields) | Less issue (compact protos) |
| Best for | Public APIs, CRUD, web clients | Mobile + SPA with complex data needs | Microservices, low-latency, polyglot |
| Caching | Easy (HTTP cache by URL) | Hard (POST + many fields) | Hard (binary, custom logic) |
| Browser native? | Yes | Yes (via HTTP) | No (needs gRPC-Web proxy) |
| Streaming | Server-Sent Events / WebSocket | Subscriptions (over WS) | Bidirectional streaming built-in |
| Tooling maturity | Massive | Mature (Apollo) | Strong for Go / Java / .NET |

**When to pick which**
**REST:** 80% of public APIs. Default for CRUD, customer-facing APIs, when caching matters.
**GraphQL:** Pick when frontend teams complain "I had to make 7 calls to render this page." Or when mobile clients on slow networks need to minimize payload.
**gRPC:** Pick for internal microservices. Polyglot environments. Sub-millisecond latency requirements. Pair with service mesh (Istio).

## Webhooks vs Polling — event delivery

"How does my system know when something changes in another system?" Push (webhook) or pull (polling). Each has its place.

| | Polling | Webhook |
|---|---|---|
| Direction | Consumer → Producer (every N sec) | Producer → Consumer (on event) |
| Latency | Up to poll interval (often minutes) | ~Seconds |
| Producer load | High — every consumer hammers it | Low — one call per event |
| Consumer infra | Just an outbound client | Needs a public HTTPS endpoint |
| Reliability | Naturally retried — next poll | Producer must retry on failure |
| Ordering | Snapshot-based, easy | Out-of-order possible — add seq numbers |
| Auth | Consumer authenticates each call | Producer signs payload (HMAC); consumer verifies |
| Microsoft equivalent | Graph API GET in a loop | Graph change notifications + Event Grid |

**Webhook security checklist**
1. **Verify signature** — producer signs the body with a shared HMAC secret. Reject any request without a valid signature.
2. **HTTPS only** — never accept HTTP webhooks. Use a public cert (not self-signed).
3. **Replay protection** — include a timestamp + nonce in the signed payload. Reject if > 5 min old.
4. **Idempotency** — webhooks may arrive twice (producer retries on timeout). Make handlers idempotent via event ID dedupe.
5. **Rate limit** — even legitimate producers can spam. Return 429 if needed.
6. **Don't trust IDs in the payload** — re-fetch from source if doing anything sensitive (the webhook is a "ping," not the source of truth).

**Modern hybrid pattern**
**Webhook → queue → workers.** The webhook endpoint just validates + dumps to Service Bus / SQS / Pub-Sub. Workers process from the queue. Decouples spikes; survives downstream outages; gives durable retry. Default architecture for any production webhook receiver.`,
    sortOrder: 0,
  },
  {
    slug: "foundations",
    title: "Foundations 101",
    category: "Fundamentals",
    sourcePage: "foundations.html",
    summary: "Deep beginner lessons across Identity, Networking, Storage, Compute, Security, and Data — no prerequisites, with real-world examples and analogies.",
    bodyMarkdown: `# Foundations 101

Deep mini-lessons on Identity, Networking, Storage, Compute, Security, Data. No prerequisites. Real-world examples + analogies.

## Identity 101 — Who are you?

Authentication, authorization, directories, MFA, SSO, and Zero Trust — from first principles.

**What you'll learn:** 1. What is authentication vs authorization · 2. Directory services (AD, Entra ID) · 3. Single Sign-On + Federation · 4. MFA + phishing-resistant auth · 5. Conditional Access + Zero Trust · 6. PIM + Privileged Access Management

### 1. Authentication vs Authorization

**Authentication** answers: *"Who are you?"* — you prove your identity (password, biometric, hardware key).

**Authorization** answers: *"What can you do?"* — once authenticated, what permissions do you have?

**Analogy:** Authentication = showing your office ID badge at the lobby. Authorization = the badge determines if you can enter the server room.

**Concrete:** When you sign in to \`portal.azure.com\`:
1. **Authentication:** Entra ID checks your password + MFA (Authenticator push, FIDO2, etc.)
2. **Authorization:** Once in, RBAC determines what subscriptions, RGs, resources you can see + manage.

### 2. Directory services — AD, Entra ID, Cloud Identity

A **directory** is a database of identities. Every user, group, computer, service has a record.

| Service | Where it runs | What it manages | Used by |
|---|---|---|---|
| Active Directory (AD) | On-prem (Windows Server DCs) | Users, computers, groups, GPOs in your network | Domain-joined Windows machines, Kerberos, LDAP apps |
| Microsoft Entra ID | Cloud (Microsoft datacenters) | Cloud users, app registrations, federations, SSO | M365, Azure, 3rd-party SaaS (OAuth/SAML) |
| Cloud Identity (Google) | Cloud | Google Workspace users + GCP IAM | Google Workspace, GCP |
| Okta / Auth0 / Ping | Cloud (3rd-party) | Identity federation, SSO across multi-cloud | Apps that need to be cloud-agnostic identity |

Most enterprises run **hybrid identity**: on-prem AD + cloud Entra ID, synced via **Entra Connect**. Users have one identity, sign in once, can access both on-prem + cloud apps.

### 3. Single Sign-On (SSO) + Federation

**SSO** = log in once, access many apps without re-entering credentials. The magic that lets you click "Sign in with Microsoft" on a third-party SaaS.

**How it works (OIDC simplified):**
\`\`\`
1. You click "Sign in with Microsoft" on app.example.com
2. Browser redirected to login.microsoftonline.com
3. You authenticate (password + MFA) with Entra ID
4. Entra issues an ID token + Access token
5. Browser redirected back to app.example.com with the tokens
6. app.example.com verifies the token signature → you're in!
\`\`\`

**Federation** = a trust relationship between two identity systems. Entra ID can federate with Okta, Ping, ADFS, Google Workspace, etc.

### 4. MFA + phishing-resistant authentication

**MFA** = Multi-Factor Authentication. You need 2+ of these:
- **Something you know** — password, PIN
- **Something you have** — phone (Authenticator app), hardware token (YubiKey)
- **Something you are** — fingerprint, face recognition

**MFA methods ranked by security:**

| Method | Security | Phishing-resistant? |
|---|---|---|
| FIDO2 / Passkey (hardware key, Windows Hello, Touch ID) | Highest | Yes |
| Microsoft Authenticator (push + number matching) | High | Yes (with number matching) |
| TOTP (Authenticator code, Google Authenticator) | Good | No |
| SMS one-time code | Low (SIM swap risk) | No |
| Voice call | Lowest | No |

**NIST 800-63B retires SMS + voice as strong factors.** Microsoft also recommends moving away from these. Push notifications WITHOUT number matching are vulnerable to "MFA fatigue" attacks — attackers spam push prompts until user accidentally approves.

### 5. Conditional Access (CA) + Zero Trust

**Conditional Access** = "If THIS, then THAT" rules at sign-in.

**Example CA policies:**
- If user is in *Admin* role AND signing in to *Azure portal* → require MFA + compliant device.
- If user is signing in from *untrusted location* → block.
- If *sign-in risk* = High → block + force password reset.

**Zero Trust** = security model based on 3 principles:
1. **Verify explicitly** — always authenticate + authorize (no implicit trust based on network location).
2. **Least privilege access** — just-in-time + just-enough access.
3. **Assume breach** — segment, monitor, encrypt everywhere.

### 6. Privileged Identity Management (PIM)

Traditional model: User is "Global Admin" 24/7. **Problem:** if their account is compromised, attacker has Global Admin instantly.

**PIM model:** User is **eligible** for Global Admin. They must **activate** with MFA + business justification + time limit (e.g. 8 hours) when needed. Auto-deactivates after.

**Net result:** If compromised when NOT activated, attacker only has regular user permissions. Standing privilege → near-zero.

**Practice in our simulators:** The \`Microsoft Entra ID\` blade in Azure simulator has a full PIM module with Activate wizard, Access Reviews, and Discovery + Insights. Try activating a role to feel the flow.

## Networking 101 — How packets get from A to B

OSI model, IP addressing, routing, DNS, firewalls, VPNs — the fundamentals every cloud admin needs.

**What you'll learn:** 1. OSI 7 layers · 2. IP addresses + subnetting · 3. Routing + Default gateways · 4. DNS resolution · 5. Firewalls + NSGs · 6. VPN vs ExpressRoute · 7. Load balancing

### 1. The OSI Model — 7 layers of networking

The **OSI model** is a mental framework for how networking works. Real networks don't map perfectly but the model helps you reason about problems.

| Layer | What it does | Example |
|---|---|---|
| 7 — Application | The app itself (HTTP, SMTP, DNS, SSH) | Browser, Outlook, curl |
| 6 — Presentation | Encoding, encryption (TLS) | HTTPS, base64 |
| 5 — Session | Session establishment | NetBIOS, RPC |
| 4 — Transport | TCP (reliable) / UDP (fast) | TCP port 443 for HTTPS |
| 3 — Network | IP addresses, routing | 10.0.0.1 to 8.8.8.8 |
| 2 — Data Link | Ethernet, MAC addresses, VLANs | 00:1A:2B:3C:4D:5E |
| 1 — Physical | Cables, fiber, radio waves | Cat6 cable, Wi-Fi |

**Memorization trick:** "Please Do Not Throw Sausage Pizza Away" (Physical, Data Link, Network, Transport, Session, Presentation, Application).

### 2. IP addresses + subnetting

An **IP address** uniquely identifies a device on a network. IPv4 = 4 octets like \`192.168.1.100\`. IPv6 = 128 bits.

**Public vs Private:**
- **Public IPs** are globally unique, routable on the internet. Limited supply.
- **Private IPs** (RFC 1918) are reusable: \`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`. Not routable on internet.

**Subnet mask** + CIDR notation tells you which part is network + which is host:
\`\`\`
10.0.1.50/24    means /24 mask = 255.255.255.0
                Network: 10.0.1.0
                Host range: 10.0.1.1 to 10.0.1.254
                Broadcast: 10.0.1.255
                Usable: 254 addresses (network + broadcast reserved)
\`\`\`

**Common CIDR sizes:**

| CIDR | Addresses | Usable hosts | Used for |
|---|---|---|---|
| /30 | 4 | 2 | Point-to-point links |
| /27 | 32 | 30 | Small subnet (AzureBastionSubnet minimum) |
| /24 | 256 | 254 | Single subnet for ~250 hosts |
| /16 | 65,536 | 65,534 | Typical Azure VNet size |
| /8 | 16,777,216 | Lots | RFC 1918 10.0.0.0/8 |

### 3. Routing + Default gateway

When your computer wants to talk to \`google.com\`, it goes through a chain of routers. Each router has a **routing table** — rules saying "to reach network X, send packets to gateway Y."

Your computer's **default gateway** is where it sends traffic for any destination not in its local subnet.

\`\`\`
Computer (10.0.1.50) wants to reach 8.8.8.8

Routing table:
  10.0.1.0/24    → directly connected (eth0)
  0.0.0.0/0      → 10.0.1.1 (default gateway)

Packet goes to 10.0.1.1 (router) → ISP → internet → 8.8.8.8
\`\`\`

### 4. DNS — the internet's phone book

**DNS** translates names (\`cloudlab.in\`) to IP addresses (\`185.190.197.84\`). Without DNS, you'd type IP addresses everywhere.

**When you type \`cloudlab.in\` in your browser:**
1. Browser checks its cache (DNS results live ~5 min there).
2. OS checks system DNS cache.
3. If not found, OS asks the **recursive resolver** (often your ISP's DNS server, or 8.8.8.8 Google, 1.1.1.1 Cloudflare).
4. Recursive resolver asks **root servers** → returns "ask .in TLD server".
5. Recursive resolver asks **.in TLD server** → returns "ask cloudlab.in authoritative server".
6. Recursive resolver asks **authoritative server** → returns IP address.
7. Result is cached at each level for the **TTL** (Time To Live).

**Test it yourself:** Run \`nslookup cloudlab.in\` or \`dig cloudlab.in +trace\` to see the full resolution chain.

### 5. Firewalls + NSGs — controlling traffic

A **firewall** filters traffic based on rules. Rules typically match on: source IP, destination IP, protocol, port. Decision: allow or deny.

**Stateful vs stateless:**
- **Stateful** (modern firewalls, NSG): remembers active connections. Outbound → return traffic auto-allowed.
- **Stateless** (router ACLs): each packet independent. Must explicitly allow both directions.

In Azure: **Network Security Group (NSG)** = stateful L4 firewall on subnet or NIC. Default: deny inbound from Internet, allow outbound to Internet.

### 6. VPN vs ExpressRoute

| | VPN (Site-to-Site) | ExpressRoute |
|---|---|---|
| Transport | Over public internet, IPsec encrypted | Dedicated private fiber, no internet |
| Bandwidth | Up to 1.25 Gbps per tunnel | 50 Mbps to 100 Gbps |
| Latency | Variable (depends on internet) | Predictable, low (carrier-class) |
| SLA | 99.95% | 99.95%-99.99% |
| Cost | Few hundred $/month | Few thousand $/month + circuit cost |
| Use case | Branch offices, dev/test hybrid | Enterprise hybrid, latency-sensitive workloads |

### 7. Load balancing — spread the traffic

A **load balancer** distributes incoming requests across multiple backend servers. Benefits: scale horizontally + survive server failures.

**Layer 4 vs Layer 7:**
- **Layer 4 (TCP/UDP):** Routes based on IP + port only. Faster. Doesn't inspect content. Example: Azure Load Balancer.
- **Layer 7 (HTTP):** Inspects request content. Can route by URL path, hostname, headers. Slower. Example: Application Gateway, Front Door.

**Algorithms:**
- **Round-robin:** Each request goes to the next server in line. Simple.
- **Least connections:** New request → server with fewest active connections.
- **Hash-based:** Same client always hits same server (session affinity).
- **Weighted:** Bigger servers get more traffic.

**Try it:** Our Azure simulator has Load Balancer + Application Gateway + Front Door modules to play with. Each shows the difference in routing capability.

## Storage 101 — Where your data lives

Block, file, object storage. Performance tiers. Encryption. Backup. Replication.

**What you'll learn:** 1. Three types of storage · 2. Performance tiers (HDD/SSD/Ultra) · 3. Object storage tiers (Hot/Cool/Archive) · 4. Encryption at rest · 5. Replication + redundancy · 6. Backup vs DR vs Snapshot

### 1. Three types of storage

| Type | What it looks like | Best for | Azure service |
|---|---|---|---|
| Block storage | A raw disk attached to a VM. Formatted with NTFS / ext4. | OS boot disk, database storage, anything VM-attached | Managed Disks |
| File storage | Shared folder. Multiple computers mount the same files. | Lift-shift file servers, FSLogix profiles, shared dev folders | Azure Files (SMB / NFS) |
| Object storage | Buckets of "blobs". Accessed via HTTP API. No folder hierarchy (except prefixes). | Backups, web content, data lakes, archive, anything big + simple | Blob Storage |

**Cost rule of thumb:** Object < File < Block. Block is most expensive because of attached compute overhead.

### 2. Performance tiers for block storage

| Tier | Speed | Cost / month / 100 GB | Use case |
|---|---|---|---|
| Standard HDD | 500 IOPS, 60 MB/s | ~$5 | Dev/test, cold workloads |
| Standard SSD | 500 IOPS (burst 6000), 60 MB/s | ~$10 | Light prod, less I/O |
| Premium SSD | 500-20,000 IOPS, 100-900 MB/s | ~$15-25 | Production VMs, databases |
| Premium SSD v2 | 3,000-80,000 IOPS (independently tunable) | ~$10-20 | Most prod (newer) |
| Ultra Disk | Up to 160,000 IOPS, 4000 MB/s | ~$80+ | SAP HANA, ultra-low latency DB |

### 3. Object storage tiers

Object storage (Azure Blob, AWS S3, GCP Cloud Storage) charges in two ways:
1. **Storage cost** — per GB per month.
2. **Access cost** — per 10,000 operations + per GB egress.

**Tiering trade-off:** Cheaper storage = more expensive access. Use lifecycle rules to auto-move data:

| Tier | Storage / GB / mo | Access cost | Min retention |
|---|---|---|---|
| Hot | $0.018 | Cheap | None |
| Cool | $0.010 | More expensive than Hot | 30 days |
| Cold | $0.0036 | Even more expensive | 90 days |
| Archive | $0.00099 | Most expensive + 15 hr rehydrate time | 180 days |

### 4. Encryption at rest

All major clouds encrypt data at rest by default. The question is **who controls the keys**:
- **Platform-Managed Keys (PMK)**: Microsoft owns + rotates the keys. Easiest. Default.
- **Customer-Managed Keys (CMK)**: You generate / import the key into Key Vault. You can revoke it any time (kills access to data).
- **Customer-Provided Keys (BYOK)**: You provide the key at every operation. Rare. Used for highest compliance.

**Gotcha:** If you use CMK and accidentally delete or revoke the key, your data is unreadable forever (unless you have a backup of the key). Enable Key Vault soft-delete + purge protection.

### 5. Replication + redundancy

Storage doesn't live on one disk — multiple copies are kept. **How spread out** = the redundancy choice.

| Type | Copies | Protects against | Cost |
|---|---|---|---|
| LRS (Local) | 3 in same datacenter | Single disk failure | Cheapest |
| ZRS (Zone) | 3 across 3 Availability Zones in same region | Datacenter failure | Slightly more |
| GRS (Geo) | 3 in primary + 3 in paired region (async) | Region failure (RPO ~15 min) | ~2x LRS |
| GZRS (Geo-Zone) | 3 across AZs in primary + 3 in paired region | AZ + region failure | ~2x ZRS |
| RA-GRS / RA-GZRS | Same as above + read access to secondary | Same + secondary readable | ~2.2x |

### 6. Backup vs DR vs Snapshot — not the same thing

| | Snapshot | Backup | DR (Disaster Recovery) |
|---|---|---|---|
| Goal | Quick rollback | Restore data after corruption / delete | Recover from region/site loss |
| Granularity | Volume / disk | Files, databases, VMs | Whole workload |
| Where stored | Same storage account | Separate backup vault, geo-replicated | Separate region |
| RTO target | Minutes | Hours | Minutes-hours |
| RPO target | Last snapshot time (minutes) | Last backup (hours-days) | Replication lag (seconds-minutes) |
| Example | VM disk snapshot before OS upgrade | Daily Azure Backup of file shares | ASR replication to West region |

**Best practice:** Use all three. Snapshot for fast rollback during changes. Backup for ransomware + accidental delete recovery. DR for region/site failure.

## Compute 101 — Where your code runs

VMs, containers, serverless, Kubernetes. When to use which. Scaling strategies.

**What you'll learn:** 1. Compute models · 2. Virtual Machines basics · 3. Containers vs VMs · 4. Kubernetes intro · 5. Serverless functions · 6. Scaling strategies

### 1. Compute models — ladder from physical to serverless

| Model | What you manage | What's managed for you |
|---|---|---|
| On-prem physical | Hardware + OS + Apps + Everything | Nothing |
| IaaS (VMs) | OS + Apps + Data | Hardware, hypervisor |
| Containers (Kubernetes) | Container images + orchestration config | OS, runtime |
| Container-as-a-Service (App Service, Container Apps) | Container image only | OS, orchestration |
| Serverless (Functions, Lambda) | Just your code | Everything except code |

Lower on the ladder = more control, more responsibility. Higher = less control, easier.

### 2. Virtual Machines (VMs)

A **VM** is a virtualized computer. The hypervisor (Hyper-V, KVM, VMware) lets one physical host run many VMs.

**Key VM attributes:**
- **vCPU** — virtual CPU cores allocated.
- **RAM** — memory allocated.
- **OS disk** — where the OS lives (~30 GB).
- **Data disks** — additional storage attached.
- **NIC** — network interface card with an IP address.

In Azure: **VM size families** indicate purpose:
- **B-series**: Burstable. Cheap. Good for dev/test.
- **D-series**: General-purpose. Balanced CPU/RAM.
- **E-series**: Memory-optimized. Databases.
- **F-series**: Compute-optimized. High CPU per dollar.
- **M-series**: Big memory (up to 11 TB!). SAP HANA.
- **N-series**: GPU. ML, gaming, rendering.
- **L-series**: Storage-optimized. Local NVMe.

### 3. Containers vs VMs

| | VM | Container |
|---|---|---|
| Includes | Full OS + app | Just the app + runtime |
| Boot time | 30-60 seconds | 1-5 seconds |
| Size on disk | 10-50 GB | 50 MB - 2 GB |
| Density | 10-50 VMs per host | 100-1000+ containers per host |
| Isolation | Strong (full OS) | Process-level (shared kernel) |
| OS | Any (Windows + Linux) | Same kernel family (Linux containers need Linux host, mostly) |

**Container image** = a packaged app with all its dependencies. Built from a \`Dockerfile\`. Pushed to a registry (ACR, Docker Hub).

### 4. Kubernetes — orchestrate many containers

With 1 container = use \`docker run\`. With 100+ containers across multiple hosts = need orchestration. That's **Kubernetes (K8s)**.

**Key K8s concepts:**
- **Pod**: smallest deployable unit. Usually 1 container per pod.
- **Deployment**: declarative "I want 3 replicas of this pod always running."
- **Service**: stable IP + DNS name for a set of pods (they come and go).
- **Ingress**: HTTP routing into the cluster.
- **Namespace**: logical isolation. E.g. \`prod\`, \`dev\`, \`team-a\`.
- **Node**: a VM (or physical) running pods.

In Azure: **AKS (Azure Kubernetes Service)** manages the control plane for you. You manage node pools + workloads.

### 5. Serverless functions

**Serverless** = you write a function. Cloud runs it on demand. You pay per execution + memory.

**Trigger types (Azure Functions):**
- **HTTP**: function called by HTTP request. Like a webhook.
- **Timer**: cron-like schedule.
- **Queue/Service Bus**: each message triggers an execution.
- **Blob**: new file uploaded → function runs.
- **Event Grid**: any Azure event.

**Best for:** Event-driven workloads, scheduled jobs, glue code, small APIs.

**NOT for:** Long-running jobs (Consumption plan has 10 min limit), stateful processing, anything needing <10 ms cold start.

### 6. Scaling strategies

| Strategy | How it works | Trade-off |
|---|---|---|
| Vertical (scale up) | Use a bigger VM (more CPU/RAM) | Limited by max SKU. Requires reboot. |
| Horizontal (scale out) | Add more instances of same size | Stateless workload required. Linear scaling. |
| Auto-scale | Automatically add/remove based on metric (CPU, queue depth) | Scale-out latency 2-5 min for new VMs |
| Scheduled scale | Predictable scaling by time of day (e.g. work hours) | Doesn't adapt to unexpected load |
| Burst (Spot) | Use cheap Spot VMs that can be reclaimed | Workload must tolerate eviction |

**Modern apps** prefer horizontal scaling. Design stateless: store session in Redis/Cosmos, not in-memory. Then you can add instances at will.

## Security 101 — Defending against attackers

Threat model, defense in depth, common attacks, modern stack: SIEM, EDR, XDR, SOAR.

**What you'll learn:** 1. Threat model + Defense in depth · 2. Common attack types · 3. SIEM vs EDR vs XDR · 4. MITRE ATT&CK framework · 5. Incident response · 6. Compliance frameworks

### 1. Defense in depth — layered security

**Defense in depth** = multiple layers of security so a single failure doesn't lead to total compromise.

**The layers (outside in):**
1. **Perimeter**: DDoS protection, WAF, firewall.
2. **Network**: NSGs, network segmentation, ZTNA.
3. **Endpoint**: EDR, anti-malware, ASR rules, Conditional Access.
4. **Identity**: MFA, PIM, Identity Protection.
5. **Application**: input validation, secure coding, OAuth/OIDC.
6. **Data**: encryption, sensitivity labels, DLP.
7. **Detection + response**: SIEM, XDR, incident response.

### 2. Common attack types you must know

| Attack | How it works | Defense |
|---|---|---|
| Phishing | Fake email convinces user to click malicious link or enter credentials | User training + Safe Links + DMARC + phishing-resistant MFA |
| AiTM phishing | Attacker reverse-proxies real login page → steals session token AFTER MFA | Token binding + CA token replay detection + FIDO2 |
| Ransomware | Malware encrypts files, demands payment | Defender for Endpoint + EDR + backup with immutability + ASR rules |
| Credential stuffing | Leaked passwords tried against your service | MFA mandatory + Identity Protection + smart lockout |
| Password spray | 1 IP tries many users with common passwords | Anomaly detection on sign-ins (Sentinel rule) |
| Pass-the-Hash / Pass-the-Ticket | Stolen NTLM hash / Kerberos ticket replayed | Credential Guard + Tier-0 isolation + remove NTLM |
| Privilege escalation | Attacker low → Domain Admin via misconfig / vuln | Defender for Identity + PIM + least privilege |
| Supply chain | Compromised library / vendor → your code | SCA + image scanning + dependency review |

### 3. SIEM vs EDR vs XDR vs SOAR

| Tool | Scope | What it does | Microsoft product |
|---|---|---|---|
| EDR (Endpoint Detection & Response) | Endpoints (PCs / servers) | Records every process + file action. Block / isolate. Live response shell. | Defender for Endpoint |
| XDR (eXtended Detection & Response) | Endpoints + Email + Identity + Cloud Apps + IoT | Cross-domain incident correlation. One pane of glass. | Defender XDR |
| SIEM (Security Information & Event Management) | EVERYTHING (firewall, AD, cloud APIs, custom apps) | Centralized log ingestion + KQL queries + custom detection rules + dashboards. | Sentinel |
| SOAR (Security Orchestration, Automation, Response) | Runs after detection | Playbook automation. Disable user, isolate device, page on-call. | Sentinel Playbooks (Logic Apps) |

### 4. MITRE ATT&CK framework

**MITRE ATT&CK** is a knowledge base of how attackers operate, organized by Tactics and Techniques.

**Tactics** (the "why"):
1. Initial Access (how they got in)
2. Execution (running malicious code)
3. Persistence (staying in)
4. Privilege Escalation
5. Defense Evasion
6. Credential Access
7. Discovery
8. Lateral Movement
9. Collection
10. Command and Control
11. Exfiltration
12. Impact (encrypt, destroy, deface)

**Techniques** are the "how" within each Tactic. E.g. T1059.001 = "PowerShell" under Execution Tactic. Sentinel rules + Defender alerts are tagged with MITRE techniques for coverage tracking.

### 5. Incident response lifecycle

NIST 800-61 defines 4 phases:
1. **Preparation**: Tools, playbooks, training, tabletop exercises.
2. **Detection + Analysis**: Alert fires → triage → confirm true/false positive.
3. **Containment, Eradication, Recovery**: Isolate affected systems → remove threat → restore.
4. **Post-incident**: Lessons learned, update runbooks, improve detection.

**Phishing IR example:**
1. **Detect:** User reports email OR Sentinel rule fires.
2. **Contain:** Revoke user tokens (CAE), disable account, isolate device.
3. **Eradicate:** Find OAuth consents granted, mail forwarding rules, lateral logons. Remove all.
4. **Recover:** Reset password + MFA re-registration, re-enable user, monitor 7 days.
5. **Post-IR:** Tabletop with team, update detection rules.

### 6. Compliance frameworks you'll see

| Framework | What it covers | Who needs it |
|---|---|---|
| DPDP Act 2023 | India personal data protection | Any org processing data of Indian residents |
| GDPR | EU personal data protection | Any org with EU users |
| HIPAA | US healthcare data | Healthcare providers + insurers + their vendors |
| PCI DSS | Credit card data | Anyone processing cards |
| SOX | US public company financial controls | Listed companies in US |
| ISO 27001 | Information security management | Optional but common for enterprise + SaaS |
| NIST CSF | US cyber security framework | US government + contractors |
| SOC 2 | Service org controls (5 trust principles) | SaaS vendors selling to enterprise |

Microsoft Purview Compliance Manager + Defender for Cloud have templates to assess your posture against each framework.

## Data 101 — SQL, NoSQL, ETL, data lakes

Relational vs NoSQL, OLTP vs OLAP, batch vs streaming, data warehouse vs data lake.

**What you'll learn:** 1. SQL vs NoSQL · 2. OLTP vs OLAP · 3. Data warehouse vs data lake · 4. ETL vs ELT · 5. Batch vs streaming · 6. BI + analytics tools

### 1. SQL vs NoSQL — pick the right shape

| | Relational (SQL) | NoSQL |
|---|---|---|
| Structure | Predefined schema (tables, rows, columns) | Schema-flexible (documents, key-value, graph) |
| Joins | First-class. Complex queries across tables. | Limited or none. Denormalize instead. |
| Consistency | Strong (ACID transactions) | Tunable (often eventual consistency) |
| Scaling | Vertical (bigger server) primarily. Read replicas. Sharding is hard. | Horizontal (more servers) natively. |
| When to use | Banking, ERP, CRM — need complex queries + transactions | Catalogs, sessions, IoT, large-scale web apps with flexible schema |
| Examples | Azure SQL DB, PostgreSQL, MySQL, Oracle | Cosmos DB, DynamoDB, MongoDB, Cassandra, Redis |

### 2. OLTP vs OLAP — transactional vs analytical

| | OLTP (Online Transaction Processing) | OLAP (Online Analytical Processing) |
|---|---|---|
| Workload | Many small writes + reads | Few large reads (aggregations) |
| Query type | "Add this order" / "Get customer info" | "Average order value per region per month" |
| Schema | Normalized (3NF) | Denormalized (star / snowflake schema) |
| Latency target | milliseconds | seconds to minutes |
| Example service | Azure SQL DB, Cosmos DB | Azure Synapse Analytics, BigQuery |

### 3. Data warehouse vs data lake

| | Data warehouse | Data lake |
|---|---|---|
| Storage | Structured tables | Raw files (Parquet, JSON, CSV, AVRO, video, etc.) |
| Schema | Schema-on-write (predefined) | Schema-on-read (decide later) |
| Cost | Higher (structured + compute) | Cheap (just object storage) |
| Query tool | SQL | Spark, SQL on top via metadata layer |
| Example | Azure Synapse Dedicated Pool, Snowflake, BigQuery | ADLS Gen2 + Databricks, S3 + Athena |

**Modern: Data lakehouse** = both. Delta Lake / Apache Iceberg / Hudi add ACID + schema on top of files in a lake.

### 4. ETL vs ELT — processing order

**ETL** (Extract, Transform, Load): Pull data → transform it → load into warehouse. Old school. Heavy transform server in the middle.

**ELT** (Extract, Load, Transform): Pull data → load raw into warehouse/lake → transform inside using SQL or Spark. Modern approach.

**Why ELT won:**
- Cloud warehouses are powerful enough to transform at scale.
- Raw data preserved — you can re-transform if requirements change.
- No need for a separate transformation server.

Tools: **Azure Data Factory** (ETL/ELT pipelines), **dbt** (popular ELT tool for SQL transforms inside Snowflake/BigQuery/Synapse).

### 5. Batch vs streaming

| | Batch | Streaming |
|---|---|---|
| Frequency | Periodic (hourly, daily) | Continuous (real-time) |
| Latency | Minutes to hours | Milliseconds to seconds |
| Data volume | Large batches | Many small events |
| Use case | Daily reports, ML training, monthly billing | Live dashboards, fraud detection, IoT monitoring |
| Azure service | Data Factory, Synapse pipelines, Databricks jobs | Event Hubs + Stream Analytics, Databricks Structured Streaming |

### 6. BI + analytics tools

| Tool | Purpose | Best for |
|---|---|---|
| Power BI | Self-service BI dashboards | Enterprise (M365 customers especially) |
| Tableau | Visualization-focused BI | Data analysts, visual storytelling |
| Looker (GCP) | Semantic layer + BI | Engineering-heavy teams |
| Excel | The original analytics tool | Finance teams |
| SQL queries direct | Ad-hoc analysis | Data engineers, technical analysts |
| Jupyter Notebook | Code + visualization + notes | Data scientists, exploration |

**Career advice:** SQL is the lowest-effort highest-ROI skill for any data role. Spend 1 week mastering SELECT, JOIN, GROUP BY, window functions — opens doors everywhere.`,
    sortOrder: 1,
  },
  {
    slug: "e2e-projects",
    title: "End-to-End Projects",
    category: "Projects",
    sourcePage: "e2e-projects.html",
    summary: "Five fully implemented Azure / M365 / DevOps projects with complete code, YAML, Bicep, and PowerShell — copy-paste, ship to GitHub, add to your portfolio.",
    bodyMarkdown: `# End-to-End Projects

5 fully implemented projects with every line of code, YAML, Bicep, PowerShell. Clone, ship to GitHub, add to portfolio.

## 1. TODO app on AKS

Full 3-tier TODO app (React + Node.js + Cosmos DB) on AKS with HTTPS, monitoring, CI/CD.

**Difficulty:** Intermediate · **Time:** 4-6 hours · **Stack:** AKS · Cosmos DB · ACR · GitHub Actions · cert-manager · Application Gateway Ingress · **Cost:** ~$70/month

### Architecture

\`\`\`
USER
  |
  v
[Front Door + WAF]  ← public TLS, anycast
  |
  v
[Application Gateway]  ← AKS Application Routing add-on
  |
  v
[AKS cluster]
  +-- frontend: React (Nginx)
  +-- api: Node.js (Express)
  +-- (calls) Cosmos DB SQL API
\`\`\`

### Step 1: Provision infrastructure (Bicep)

Save as \`infra/main.bicep\`:

\`\`\`bicep
param location string = resourceGroup().location
param appName string = 'todoapp'

resource aks 'Microsoft.ContainerService/managedClusters@2024-08-01' = {
  name: 'aks-' + appName
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Base', tier: 'Standard' }
  properties: {
    kubernetesVersion: '1.30.5'
    dnsPrefix: appName
    agentPoolProfiles: [{
      name: 'system'
      count: 2
      vmSize: 'Standard_D2s_v5'
      mode: 'System'
      osType: 'Linux'
      enableAutoScaling: true
      minCount: 2
      maxCount: 4
    }]
    addonProfiles: {
      httpApplicationRouting: { enabled: true }
    }
    oidcIssuerProfile: { enabled: true }
    securityProfile: { workloadIdentity: { enabled: true } }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: 'acr' + appName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cosmos-' + appName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0 }]
    capabilities: [{ name: 'EnableServerless' }]
  }
}

output aksName string = aks.name
output acrLoginServer string = acr.properties.loginServer
output cosmosEndpoint string = cosmos.properties.documentEndpoint
\`\`\`

\`\`\`bash
az group create -n rg-todoapp -l eastus2
az deployment group create -g rg-todoapp -f infra/main.bicep
az aks get-credentials -g rg-todoapp -n aks-todoapp
az aks update -g rg-todoapp -n aks-todoapp --attach-acr acrtodoapp
\`\`\`

### Step 2: Backend API (Node.js + Express)

\`api/server.js\`:

\`\`\`javascript
const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  aadCredentials: new DefaultAzureCredential()
});
const container = client.database('todos').container('items');

const app = express();
app.use(express.json());

app.get('/api/todos', async (req, res) => {
  const { resources } = await container.items.readAll().fetchAll();
  res.json(resources);
});

app.post('/api/todos', async (req, res) => {
  const { resource } = await container.items.create({
    id: Date.now().toString(),
    text: req.body.text,
    done: false,
    created: new Date().toISOString()
  });
  res.json(resource);
});

app.put('/api/todos/:id', async (req, res) => {
  const { resource } = await container.item(req.params.id).replace({
    ...req.body,
    id: req.params.id
  });
  res.json(resource);
});

app.delete('/api/todos/:id', async (req, res) => {
  await container.item(req.params.id).delete();
  res.status(204).end();
});

app.listen(3000, () => console.log('API on :3000'));
\`\`\`

\`api/Dockerfile\`:

\`\`\`dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
\`\`\`

### Step 3: Frontend (React + Vite)

\`web/src/App.jsx\` (essentials):

\`\`\`jsx
import { useEffect, useState } from 'react';
export default function App() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const load = () => fetch('/api/todos').then(r => r.json()).then(setTodos);
  useEffect(load, []);
  const add = () => {
    fetch('/api/todos', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({text})})
      .then(() => { setText(''); load(); });
  };
  return (<div>
    <input value={text} onChange={e=>setText(e.target.value)}/>
    <button onClick={add}>Add</button>
    <ul>{todos.map(t => <li key={t.id}>{t.text}</li>)}</ul>
  </div>);
}
\`\`\`

### Step 4: Kubernetes manifests

\`k8s/api.yaml\`:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api, azure.workload.identity/use: "true" } }
    spec:
      serviceAccountName: api-wi
      containers:
      - name: api
        image: acrtodoapp.azurecr.io/api:latest
        ports: [{ containerPort: 3000 }]
        env:
        - { name: COSMOS_ENDPOINT, value: "https://cosmos-todoapp.documents.azure.com:443/" }
        resources:
          requests: { cpu: 100m, memory: 128Mi }
          limits:   { cpu: 500m, memory: 512Mi }
        livenessProbe:  { httpGet: { path: /api/todos, port: 3000 }, initialDelaySeconds: 15 }
        readinessProbe: { httpGet: { path: /api/todos, port: 3000 }, initialDelaySeconds: 5 }
---
apiVersion: v1
kind: Service
metadata: { name: api }
spec:
  selector: { app: api }
  ports: [{ port: 80, targetPort: 3000 }]
\`\`\`

### Step 5: GitHub Actions CI/CD with OIDC (no secrets!)

\`.github/workflows/deploy.yml\`:

\`\`\`yaml
name: deploy
on:
  push: { branches: [main] }
permissions: { id-token: write, contents: read }
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: azure/login@v2
      with:
        client-id: \${{ vars.AZURE_CLIENT_ID }}
        tenant-id: \${{ vars.AZURE_TENANT_ID }}
        subscription-id: \${{ vars.AZURE_SUBSCRIPTION_ID }}
    - run: az acr login --name acrtodoapp
    - run: docker build -t acrtodoapp.azurecr.io/api:\${{ github.sha }} ./api
    - run: docker push acrtodoapp.azurecr.io/api:\${{ github.sha }}
    - run: az aks get-credentials -g rg-todoapp -n aks-todoapp
    - run: kubectl set image deployment/api api=acrtodoapp.azurecr.io/api:\${{ github.sha }}
    - run: kubectl rollout status deployment/api --timeout=5m
\`\`\`

### Step 6: Workload Identity for Cosmos DB access

\`\`\`bash
# Create AAD app + federated credential
az identity create -g rg-todoapp -n api-wi
WI_CLIENT_ID=$(az identity show -g rg-todoapp -n api-wi --query clientId -o tsv)

# Create K8s service account + bind
kubectl create sa api-wi
kubectl annotate sa api-wi azure.workload.identity/client-id=$WI_CLIENT_ID

# Federate AKS OIDC to the managed identity
AKS_OIDC=$(az aks show -g rg-todoapp -n aks-todoapp --query oidcIssuerProfile.issuerUrl -o tsv)
az identity federated-credential create -g rg-todoapp -n api-fc \\
  --identity-name api-wi \\
  --issuer $AKS_OIDC \\
  --subject system:serviceaccount:default:api-wi

# Grant Cosmos DB data reader/writer role
COSMOS_ID=$(az cosmosdb show -g rg-todoapp -n cosmos-todoapp --query id -o tsv)
az cosmosdb sql role assignment create -g rg-todoapp -a cosmos-todoapp \\
  --role-definition-id 00000000-0000-0000-0000-000000000002 \\
  --principal-id $(az identity show -g rg-todoapp -n api-wi --query principalId -o tsv) \\
  --scope $COSMOS_ID
\`\`\`

**What you have now:** A 3-tier app on AKS with private container registry, Cosmos DB (no DB password to manage), CI/CD that has no long-lived secrets, autoscaling. Add this to your GitHub portfolio. Estimated time invested: 4-6 hours.

## 2. SOC starter — Sentinel + 5 detections

Sentinel workspace, 5 production-grade analytics rules, 1 playbook, MITRE workbook.

**Difficulty:** Intermediate · **Time:** 3-4 hours · **Stack:** Sentinel · KQL · Logic Apps · Microsoft Graph · **Cost:** ~$20-40/month (low ingestion)

### What we're building

A starter SOC for a 100-user M365 tenant. 5 detections + 1 auto-disable playbook + MITRE coverage workbook.

### Step 1: Provision Sentinel workspace

\`\`\`bash
az group create -n rg-soc -l eastus2

az monitor log-analytics workspace create -g rg-soc -n law-soc \\
  --retention-time 90 --sku PerGB2018

# Onboard Sentinel
az extension add --name sentinel
az sentinel workspace onboarding create --resource-group rg-soc \\
  --workspace-name law-soc
\`\`\`

### Step 2: Connect M365 data sources

Defender XDR + Entra ID + Azure Activity (all FREE in Sentinel).

\`\`\`bash
# Microsoft Defender XDR connector (UI-only configuration via portal)
# Defender → Settings → Microsoft Sentinel → Connect

# Entra ID sign-in + audit logs
az monitor diagnostic-settings create --name "to-sentinel" \\
  --resource $(az rest --method GET --uri \\
    "https://graph.microsoft.com/v1.0/policies/diagnostic-settings\\
     ?$filter=name eq 'EntraID'") \\
  --workspace law-soc \\
  --logs '[{"category":"SignInLogs","enabled":true},{"category":"AuditLogs","enabled":true}]'

# Azure Activity → all subscriptions
az policy assignment create --name sentinel-activity \\
  --policy "/providers/Microsoft.Authorization/policyDefinitions/..." \\
  --params '{"workspaceId":{"value":"/subscriptions/.../workspaces/law-soc"}}'
\`\`\`

### Step 3: Detection rule 1 — Brute force on user accounts

\`\`\`kql
// KQL — saved as Scheduled Analytics Rule
let timeframe = 1h;
let threshold = 10;
SecurityEvent
| where TimeGenerated > ago(timeframe)
| where EventID == 4625
| summarize FailedCount=count(), DistinctIPs=dcount(IpAddress) by Account
| where FailedCount > threshold
| extend Severity = iff(FailedCount > 50, "High", "Medium")
| project Account, FailedCount, DistinctIPs, Severity
\`\`\`

Rule settings: Severity High, Frequency 5 min, Lookup 1h, Entity mapping: Account → User.

### Step 4: Detection rule 2 — Password spray

\`\`\`kql
SigninLogs
| where TimeGenerated > ago(1h)
| where ResultType in (50126, 50053)
| summarize
    DistinctUsers = dcount(UserPrincipalName),
    TotalAttempts = count(),
    LastSeen = max(TimeGenerated)
  by IPAddress
| where DistinctUsers > 5 and TotalAttempts < 100
| extend Severity = "High"
\`\`\`

### Step 5: Detection rule 3 — OAuth consent to risky app

\`\`\`kql
AuditLogs
| where TimeGenerated > ago(1h)
| where OperationName == "Consent to application"
| extend ConsentScopes = tostring(parse_json(tostring(TargetResources[0].modifiedProperties[0].newValue)))
| where ConsentScopes has_any ("Mail.ReadWrite", "offline_access", "Files.ReadWrite.All")
| project TimeGenerated, InitiatedBy, AppDisplayName=tostring(TargetResources[0].displayName), ConsentScopes
| extend Severity = "High"
\`\`\`

### Step 6: Detection rules 4 + 5 (briefly)

\`\`\`kql
// Rule 4: Impossible travel
SigninLogs
| where ResultType == 0
| sort by UserPrincipalName, TimeGenerated
| extend PrevLoc = prev(Location), PrevTime = prev(TimeGenerated)
| where Location != PrevLoc and datetime_diff("hour", TimeGenerated, PrevTime) < 1
| project TimeGenerated, UserPrincipalName, FromLoc=PrevLoc, ToLoc=Location

// Rule 5: AS-REP roasting
SecurityEvent
| where EventID == 4768
| where PreAuthType == 0  // Kerberos pre-auth NOT required
| summarize count() by Account, IpAddress
| where count_ > 3
\`\`\`

### Step 7: Playbook — Auto-disable user on TruePositive

Logic App ARM:

\`\`\`json
{
  "definition": {
    "triggers": { "When_incident_updated": { "type": "SentinelIncidentUpdated" }},
    "actions": {
      "Check_TruePositive": {
        "type": "If",
        "expression": "@equals(triggerBody()?['object']?['properties']?['classification'], 'TruePositive')",
        "actions": {
          "Get_user_entities": { "type": "ApiConnection", "inputs": { ... }},
          "Disable_user": {
            "type": "Http",
            "inputs": {
              "method": "PATCH",
              "uri": "https://graph.microsoft.com/v1.0/users/@{items('For_each')?['name']}",
              "body": { "accountEnabled": false },
              "authentication": { "type": "ManagedServiceIdentity" }
            }
          }
        }
      }
    }
  }
}
\`\`\`

Wire to High severity rules via Automation Rule. Grant the Logic App's Managed Identity the \`User.ReadWrite.All\` Graph permission.

**What you have:** 5 production-grade detections + auto-disable playbook + MITRE coverage. SC-200 candidates: this is your portfolio project. Push to GitHub with the KQL files + Logic App ARM + setup README.

## 3. RAG chatbot Function App

Azure Function that does RAG over uploaded PDFs. AI Search vector index + Azure OpenAI.

**Difficulty:** Intermediate · **Time:** 4-6 hours · **Stack:** Azure Functions · Azure OpenAI · AI Search · Blob Storage · Python · **Cost:** ~$50/month idle, scales with usage

### What we're building

Upload a PDF → automatically indexed in AI Search vector store → users query via HTTP function → returns answers with citations.

### Step 1: Provision (Bicep)

\`\`\`bicep
resource search 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: 'srch-rag'
  location: location
  sku: { name: 'basic' }
  properties: { hostingMode: 'default', semanticSearch: 'free' }
}

resource aoai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'aoai-rag'
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: { customSubDomainName: 'aoai-rag' }
}

resource gpt 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: aoai
  name: 'gpt-4o-mini'
  sku: { name: 'Standard', capacity: 50 }
  properties: { model: { name: 'gpt-4o-mini', version: '2024-07-18', format: 'OpenAI' }}
}

resource emb 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: aoai
  name: 'text-embedding-3-small'
  sku: { name: 'Standard', capacity: 50 }
  properties: { model: { name: 'text-embedding-3-small', version: '1', format: 'OpenAI' }}
}

resource func 'Microsoft.Web/sites@2023-12-01' = {
  name: 'func-rag'
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: { ... }
}
\`\`\`

### Step 2: Ingest PDFs to AI Search (Python)

\`function_app.py\` — Blob trigger function that chunks + embeds:

\`\`\`python
import azure.functions as func
import openai, json
from azure.search.documents import SearchClient
from azure.identity import DefaultAzureCredential
from pypdf import PdfReader
import io

app = func.FunctionApp()

@app.blob_trigger(arg_name="myblob", path="docs/{name}",
                  connection="AzureWebJobsStorage")
def ingest(myblob: func.InputStream):
    pdf = PdfReader(io.BytesIO(myblob.read()))
    text = "".join(p.extract_text() for p in pdf.pages)
    chunks = [text[i:i+1000] for i in range(0, len(text), 800)]  # 200 overlap

    client = openai.AzureOpenAI(
        azure_endpoint="https://aoai-rag.openai.azure.com",
        api_version="2024-10-21",
        azure_ad_token_provider=DefaultAzureCredential().get_token
    )
    embeddings = client.embeddings.create(
        input=chunks, model="text-embedding-3-small"
    ).data

    search = SearchClient(
        endpoint="https://srch-rag.search.windows.net",
        index_name="docs",
        credential=DefaultAzureCredential()
    )
    docs = [{
        "id": f"{myblob.name}-{i}",
        "source": myblob.name,
        "content": c,
        "vector": e.embedding
    } for i, (c, e) in enumerate(zip(chunks, embeddings))]
    search.upload_documents(documents=docs)
\`\`\`

### Step 3: Query function (HTTP trigger)

\`\`\`python
@app.route(route="ask", methods=["POST"])
def ask(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    question = body["question"]

    client = openai.AzureOpenAI(
        azure_endpoint="https://aoai-rag.openai.azure.com",
        api_version="2024-10-21",
        azure_ad_token_provider=DefaultAzureCredential().get_token
    )

    # Embed query
    q_emb = client.embeddings.create(
        input=[question], model="text-embedding-3-small"
    ).data[0].embedding

    # Hybrid search (keyword + vector)
    search = SearchClient(
        endpoint="https://srch-rag.search.windows.net",
        index_name="docs",
        credential=DefaultAzureCredential()
    )
    results = search.search(
        search_text=question,
        vector_queries=[{"vector": q_emb, "k_nearest_neighbors": 5,
                         "fields": "vector", "kind": "vector"}],
        top=5,
        select=["source","content"]
    )
    context = "\\n---\\n".join(r["content"] for r in results)

    # Ask LLM with context
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"Answer using ONLY the context. Cite sources by [doc:N]."},
            {"role":"user","content":f"Context:\\n{context}\\n\\nQuestion: {question}"}
        ]
    )
    return func.HttpResponse(
        json.dumps({"answer": response.choices[0].message.content}),
        mimetype="application/json"
    )
\`\`\`

### Step 4: Test it

\`\`\`bash
# Upload a PDF
az storage blob upload --account-name stragdocs --container docs \\
  --name handbook.pdf --file ./handbook.pdf --auth-mode login

# Wait 30 sec for ingest function

# Query
curl -X POST https://func-rag.azurewebsites.net/api/ask \\
  -H "Content-Type: application/json" \\
  -d '{"question":"What is the leave policy?"}'
\`\`\`

**What you have:** Production RAG pipeline. Push to GitHub. Add Streamlit frontend for portfolio sizzle.

## 4. Identity Tier-0 hardening

PAW deployment + PIM + 2 break-glass + 6 baseline CA policies + access review.

**Difficulty:** Intermediate · **Time:** 6-8 hours · **Stack:** Entra ID · PIM · Conditional Access · Intune · Defender for Identity · **Cost:** + Entra ID P2 licenses

### What we're building

Production identity baseline for a 500-1000 user org. Every Tier-0 admin is PIM-eligible + uses a PAW + protected by CA + reviewed quarterly.

### Step 1: Create 2 break-glass accounts

\`\`\`powershell
Connect-MgGraph -Scopes "User.ReadWrite.All","Directory.ReadWrite.All"

# Generate strong password (28 chars random)
$pwd = -join ((33..126) | Get-Random -Count 28 | ForEach-Object {[char]$_})

# Create 2 break-glass
1..2 | ForEach-Object {
    $upn = "breakglass$_@cloudlab.in"
    New-MgUser -DisplayName "Break Glass $_" \`
        -UserPrincipalName $upn \`
        -MailNickname "breakglass$_" \`
        -PasswordProfile @{ Password = $pwd; ForceChangePasswordNextSignIn = $false } \`
        -AccountEnabled
}

# Grant permanent Global Admin
$gaRole = Get-MgDirectoryRole | Where-Object DisplayName -eq "Global Administrator"
Get-MgUser -Filter "startsWith(userPrincipalName,'breakglass')" | ForEach-Object {
    New-MgDirectoryRoleMemberByRef -DirectoryRoleId $gaRole.Id \`
        -BodyParameter @{ "@odata.id" = "https://graph.microsoft.com/v1.0/users/$($_.Id)" }
}

# Store password in physical safe. NEVER email or chat it.
\`\`\`

### Step 2: Baseline Conditional Access policies (6 of them)

\`\`\`powershell
# All policies EXCLUDE break-glass via security group
$bg = Get-MgUser -Filter "startsWith(userPrincipalName,'breakglass')" | Select-Object -ExpandProperty Id

New-MgGroup -DisplayName "CA-Excluded-BreakGlass" -SecurityEnabled -MailEnabled:$false -MailNickname "ca-exclude"
# Add break-glass users to this group, then exclude this group from every CA policy.

# Policy 1: Block legacy authentication
New-MgIdentityConditionalAccessPolicy -DisplayName "CA-Block-Legacy-Auth" \`
    -State Enabled \`
    -Conditions @{ Applications=@{IncludeApplications=@("All")}; Users=@{IncludeUsers=@("All"); ExcludeGroups=@($exclGroupId)}; ClientAppTypes=@("exchangeActiveSync","other") } \`
    -GrantControls @{ Operator="OR"; BuiltInControls=@("block") }

# Policy 2: Require MFA for admins (any directory role)
New-MgIdentityConditionalAccessPolicy -DisplayName "CA-Require-MFA-for-Admins" \`
    -State Enabled \`
    -Conditions @{ Applications=@{IncludeApplications=@("All")}; Users=@{IncludeRoles=@("62e90394-69f5-4237-9190-012177145e10","f28a1f50-f6e7-4571-818b-6a12f2af6b6c",...); ExcludeGroups=@($exclGroupId) } } \`
    -GrantControls @{ Operator="OR"; BuiltInControls=@("mfa") }

# Policies 3-6 similar pattern: Require MFA all users, Require compliant device,
# Block unsupported countries, Require MFA on high sign-in risk
\`\`\`

### Step 3: PIM-eligible all Global Admins

\`\`\`powershell
# Find current standing Global Admins
$gaRoleId = (Get-MgDirectoryRole | Where DisplayName -eq "Global Administrator").Id
$standingGAs = Get-MgDirectoryRoleMember -DirectoryRoleId $gaRoleId

# For each (except break-glass), convert to eligible
foreach ($ga in $standingGAs) {
    if ($ga.AdditionalProperties.userPrincipalName -like "breakglass*") { continue }

    # Remove from active (standing) role
    Remove-MgDirectoryRoleMemberByRef -DirectoryRoleId $gaRoleId -DirectoryObjectId $ga.Id

    # Create PIM eligibility
    New-MgRoleManagementDirectoryRoleEligibilityScheduleRequest -BodyParameter @{
        Action = "adminAssign"
        Justification = "Convert from standing to eligible"
        RoleDefinitionId = "62e90394-69f5-4237-9190-012177145e10"  # Global Admin
        DirectoryScopeId = "/"
        PrincipalId = $ga.Id
        ScheduleInfo = @{
            StartDateTime = (Get-Date)
            Expiration = @{ Type = "noExpiration" }
        }
    }
}

# Configure PIM role settings (in portal): Max activation 8h, MFA required, justification + ticket required, approval required (from break-glass owner)
\`\`\`

### Step 4: PAW deployment via Intune Autopilot

Hardware: 30 dedicated laptops for Tier-0 admins. Procurement spec: Win 11 Pro/Ent, TPM 2.0, vPro.

\`\`\`
# Autopilot profile (self-deploying for PAWs)
# Settings via Intune portal:
#  - Deployment mode: Self-deploying
#  - Join: Microsoft Entra joined
#  - User account type: Standard
#  - Skip user account type selection: Yes
#  - ESP timeout: 90 min, hide app errors

# Compliance baseline (Win 11 hardened for PAW)
# Settings catalog policies:
#  - BitLocker: required, XTS-AES 256-bit, TPM + PIN
#  - Credential Guard: enabled
#  - HVCI / Code Integrity: enabled
#  - Defender AV: real-time + cloud-delivered + cloud protection level High+
#  - ASR rules: all 16 in Block mode
#  - SmartScreen: Block
#  - Browser restrictions: only Edge, no extensions, only allowed admin URLs
#  - AppLocker: deny all except signed Microsoft + IT-approved exes
#  - No Internet access except: portal.azure.com, *.microsoft.com, github.com/cloudlab-org
#  - Defender for Endpoint: onboarded, EDR in block mode
\`\`\`

### Step 5: Quarterly access review

\`\`\`powershell
$reviewBody = @{
    DisplayName = "Q1 2026 — Global Admin eligibility review"
    DescriptionForAdmins = "Quarterly review of all PIM-eligible Global Admins"
    Scope = @{
        "@odata.type" = "#microsoft.graph.accessReviewQueryScope"
        Query = "/roleManagement/directory/roleAssignmentSchedules?$filter=roleDefinitionId eq '62e90394-69f5-4237-9190-012177145e10'"
        QueryType = "MicrosoftGraph"
    }
    Reviewers = @(
        @{ Query = "./manager"; QueryType = "MicrosoftGraph" },
        @{ Query = "/groups/$cisoGroupId/members"; QueryType = "MicrosoftGraph" }
    )
    Settings = @{
        MailNotificationsEnabled = $true
        ReminderNotificationsEnabled = $true
        JustificationRequiredOnApproval = $true
        DefaultDecisionEnabled = $true
        DefaultDecision = "Deny"  # If reviewer doesn't respond → revoke
        InstanceDurationInDays = 21
        AutoApplyDecisionsEnabled = $true
        RecurrenceSettings = @{ Type = "Quarterly"; Interval = 1 }
    }
}
New-MgIdentityGovernanceAccessReviewDefinition -BodyParameter $reviewBody
\`\`\`

**What you have:** Production identity baseline. SC-300 portfolio piece. Document the playbook in your GitHub repo with PowerShell scripts + screenshots.

## 5. Cost dashboard with anomaly alerts

Daily Azure Cost export → Storage → Synapse → Power BI dashboard with anomaly detection + Teams alerts.

**Difficulty:** Intermediate · **Time:** 4-5 hours · **Stack:** Cost Management exports · Storage · Synapse Serverless · Power BI · Logic Apps · Teams · **Cost:** ~$5/month

### What we're building

Continuous cost intelligence: daily exports → SQL views → Power BI dashboard → Logic App detects anomalies → Teams notification with culprit resource.

### Step 1: Daily Cost export to Storage

\`\`\`bash
az group create -n rg-cost -l eastus2

az storage account create -n stcostexports -g rg-cost \\
  -l eastus2 --sku Standard_LRS --kind StorageV2

az storage container create -n exports --account-name stcostexports

# Create the export via REST (CLI doesn't have it natively)
az rest --method PUT \\
  --uri "https://management.azure.com/subscriptions/$SUBID/providers/Microsoft.CostManagement/exports/daily-actual?api-version=2023-08-01" \\
  --body '{
    "properties": {
      "definition": { "type": "ActualCost", "timeframe": "MonthToDate" },
      "deliveryInfo": {
        "destination": {
          "resourceId": "/subscriptions/.../stcostexports",
          "container": "exports",
          "rootFolderPath": "daily"
        }
      },
      "schedule": {
        "status": "Active",
        "recurrence": "Daily",
        "recurrencePeriod": { "from": "2026-05-20T00:00:00Z", "to": "2030-12-31T00:00:00Z" }
      }
    }
  }'
\`\`\`

### Step 2: Synapse Serverless SQL view

\`\`\`sql
-- Create database
CREATE DATABASE costs;
USE costs;

-- Create credential to read from storage
CREATE EXTERNAL DATA SOURCE costlake
WITH (LOCATION = 'https://stcostexports.blob.core.windows.net/exports');

-- View on top of CSV exports
CREATE OR ALTER VIEW vw_DailyCost AS
SELECT
  TRY_CONVERT(date, UsageDate) AS Date,
  ServiceName,
  ResourceGroup,
  ResourceId,
  TRY_CONVERT(decimal(18,4), Cost) AS Cost,
  Currency,
  Tags
FROM OPENROWSET(
  BULK 'daily/*/manifest.json',
  DATA_SOURCE = 'costlake',
  FORMAT = 'CSV',
  PARSER_VERSION = '2.0',
  FIRSTROW = 2
) WITH (
  UsageDate VARCHAR(20),
  ServiceName VARCHAR(200),
  ResourceGroup VARCHAR(200),
  ResourceId VARCHAR(500),
  Cost VARCHAR(50),
  Currency VARCHAR(10),
  Tags VARCHAR(MAX)
) AS Costs;

-- 7-day moving average for anomaly detection
CREATE OR ALTER VIEW vw_AnomalyCheck AS
WITH Recent AS (
  SELECT Date, ServiceName, SUM(Cost) AS DailyCost
  FROM vw_DailyCost
  WHERE Date >= DATEADD(day, -30, GETDATE())
  GROUP BY Date, ServiceName
)
SELECT
  Date,
  ServiceName,
  DailyCost,
  AVG(DailyCost) OVER (PARTITION BY ServiceName ORDER BY Date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS Avg7d,
  CASE WHEN DailyCost > AVG(DailyCost) OVER (PARTITION BY ServiceName ORDER BY Date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) * 1.5
       THEN 'Anomaly' ELSE 'Normal' END AS Status
FROM Recent;
\`\`\`

### Step 3: Logic App detects anomalies + posts to Teams

\`\`\`json
{
  "triggers": {
    "Recurrence": { "type": "Recurrence", "recurrence": { "frequency": "Day", "interval": 1 } }
  },
  "actions": {
    "Run_query": {
      "type": "ApiConnection",
      "inputs": {
        "host": { "connection": { "name": "@parameters('$connections')['sqlazure']" } },
        "method": "post",
        "path": "/v2/datasets/.../query/sql",
        "body": "SELECT TOP 10 * FROM vw_AnomalyCheck WHERE Date = CAST(GETDATE() AS date) AND Status = 'Anomaly'"
      }
    },
    "For_each_anomaly": {
      "type": "Foreach",
      "foreach": "@body('Run_query')['ResultSets']['Table1']",
      "actions": {
        "Post_to_Teams": {
          "type": "ApiConnection",
          "inputs": {
            "host": { "connection": { "name": "@parameters('$connections')['teams']" } },
            "method": "post",
            "path": "/v3/beta/teams/conversation/message/poster/Flow%20bot/location/.../channel/...",
            "body": {
              "body": { "content": "⚠️ Cost anomaly detected: @{items('For_each_anomaly')?['ServiceName']} = $@{items('For_each_anomaly')?['DailyCost']} (7d avg = $@{items('For_each_anomaly')?['Avg7d']})" }
            }
          }
        }
      }
    }
  }
}
\`\`\`

### Step 4: Power BI dashboard

Power BI Desktop:
1. Get Data → Azure → Synapse Analytics SQL endpoint
2. Pick \`vw_DailyCost\` and \`vw_AnomalyCheck\` views
3. Build 4 visuals: Total spend MTD card, daily cost line chart, top 10 services bar chart, anomaly table
4. Publish to Power BI Service workspace
5. Configure scheduled refresh daily 06:00
6. Embed in SharePoint intranet page

**What you have:** Continuous FinOps. Cost anomalies hit Teams within 24h. Your CFO gets a daily summary email. Add this to your portfolio + LinkedIn.`,
    sortOrder: 2,
  },
  {
    slug: "graph-api",
    title: "Microsoft Graph Quickstart",
    category: "Reference",
    sourcePage: "graph-api.html",
    summary: "Microsoft Graph API basics: authentication flows, common operations, query patterns, and permissions, with PowerShell, REST, and Python examples side-by-side.",
    bodyMarkdown: `# Microsoft Graph Quickstart

The unified API for Microsoft 365. Authentication, common operations, query patterns, permissions. PowerShell + REST + Python examples side-by-side.

## What is Microsoft Graph?

Microsoft Graph is a single REST API endpoint (\`https://graph.microsoft.com\`) that exposes EVERYTHING in your Microsoft 365 + Entra ID tenant: users, groups, mailboxes, files, calendars, chats, security alerts, devices, policies. One API + one auth + one set of permissions.

### What you can do with it

- Create / update / disable users + groups
- Send email, read calendars, manage Teams chats
- Manage devices via Intune (Endpoint Manager)
- Read sign-in logs, Defender alerts, audit logs
- Configure Conditional Access policies, PIM, security baselines
- Get + modify SharePoint sites + files
- Build Copilot extensions (declarative agents)

### API versions

| Version | Use for |
|---|---|
| \`v1.0\` | Production. Stable. SLA backed. |
| \`beta\` | New + preview features. May break. Don't use in critical prod scripts. |

### How to call Graph (4 ways, ranked by ease)

1. **Microsoft.Graph PowerShell SDK** — easiest, full coverage, well-documented.
2. **Graph Explorer** (\`aka.ms/ge\`) — web-based REST playground. Auto-handles auth. Great for testing.
3. **SDK in your language** (Python, JavaScript, C#, Go, Java).
4. **Direct REST calls** with curl / Invoke-RestMethod. Most flexible, requires manual token handling.

**Where to learn:** \`aka.ms/ge\` (Graph Explorer with samples) and \`learn.microsoft.com/graph/api/overview\` (official reference).

## Authentication — getting a token

Every Graph API call needs an OAuth 2.0 access token in the \`Authorization: Bearer <token>\` header. Three flows you'll use:

### 1. Delegated (user signs in) — for interactive scripts

Token represents both the app + the signed-in user. Combined permissions: intersect of both.

**PowerShell:**

\`\`\`powershell
Connect-MgGraph -Scopes "User.Read.All","Group.ReadWrite.All"
# Browser pop-up. You sign in. Token cached for the session.
\`\`\`

### 2. App-only (service principal) — for unattended scripts / CI

Token represents the app itself. Uses client secret (legacy) or certificate (better) or federated credential (best — OIDC, no secrets).

**Client secret (legacy):**

\`\`\`powershell
$body = @{
    client_id = "<app-id>"
    client_secret = "<secret>"
    scope = "https://graph.microsoft.com/.default"
    grant_type = "client_credentials"
}
$resp = Invoke-RestMethod -Method POST \\
    -Uri "https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token" \\
    -Body $body
$token = $resp.access_token
\`\`\`

**Certificate (better, no secrets):**

\`\`\`powershell
Connect-MgGraph -ClientId "<app-id>" -TenantId "<tenant>" \\
    -CertificateThumbprint "ABC123..."
\`\`\`

**Workload Identity Federation / OIDC (best for CI/CD):**

\`\`\`yaml
# GitHub Actions example — uses OIDC token, no secrets in repo
permissions: { id-token: write, contents: read }
steps:
- uses: azure/login@v2
  with:
    client-id: \${{ vars.AZURE_CLIENT_ID }}
    tenant-id: \${{ vars.AZURE_TENANT_ID }}
    subscription-id: \${{ vars.AZURE_SUBSCRIPTION_ID }}
- run: |
    # Token already in env; Microsoft.Graph PowerShell can use it
    Import-Module Microsoft.Graph
    Connect-MgGraph -AccessToken (Get-AzAccessToken -ResourceUri https://graph.microsoft.com).Token
\`\`\`

### 3. Managed Identity — for Azure resources calling Graph

Azure Function / App Service / VM uses its system-assigned identity. No secrets, no tokens to manage.

\`\`\`python
# Inside the Azure resource
import requests
from azure.identity import ManagedIdentityCredential

cred = ManagedIdentityCredential()
token = cred.get_token("https://graph.microsoft.com/.default")

headers = { "Authorization": f"Bearer {token.token}" }
r = requests.get("https://graph.microsoft.com/v1.0/users", headers=headers)
\`\`\`

**Decision rule:** For your hands-on scripts → Delegated. For CI/CD pipelines → Workload Identity Federation (OIDC). For Azure-hosted apps → Managed Identity. Never put client secrets in source code.

## Common operations cheat sheet

Most-used Graph endpoints with PowerShell + REST + Python side-by-side.

### Users

**List all users (paged)**

\`\`\`powershell
# PowerShell
Get-MgUser -All

# REST
GET https://graph.microsoft.com/v1.0/users
# Auto-pages? No. Follow @odata.nextLink for next page.

# Python (SDK)
from msgraph import GraphServiceClient
from azure.identity import InteractiveBrowserCredential
client = GraphServiceClient(credentials=InteractiveBrowserCredential())
users = await client.users.get()
\`\`\`

**Get user by UPN**

\`\`\`powershell
# PowerShell
Get-MgUser -UserId "admin@itbd.net" -Property "id,displayName,department,jobTitle,manager"

# REST
GET https://graph.microsoft.com/v1.0/users/admin@itbd.net?$select=id,displayName,department,jobTitle
GET https://graph.microsoft.com/v1.0/users/admin@itbd.net/manager
\`\`\`

**Create user**

\`\`\`powershell
# PowerShell
New-MgUser -DisplayName "Test User" -GivenName "Test" -Surname "User" \\
    -UserPrincipalName "test.user@cloudlab.in" \\
    -MailNickname "testuser" -UsageLocation "IN" \\
    -PasswordProfile @{ Password = "Welcome01!"; ForceChangePasswordNextSignIn = $true } \\
    -AccountEnabled

# REST
POST https://graph.microsoft.com/v1.0/users
Content-Type: application/json
{
    "accountEnabled": true,
    "displayName": "Test User",
    "userPrincipalName": "test.user@cloudlab.in",
    "mailNickname": "testuser",
    "usageLocation": "IN",
    "passwordProfile": {
        "password": "Welcome01!",
        "forceChangePasswordNextSignIn": true
    }
}
\`\`\`

### Groups

**Create security group + add member**

\`\`\`powershell
# PowerShell
$g = New-MgGroup -DisplayName "HR-Staff" -SecurityEnabled \\
    -MailEnabled:$false -MailNickname "hr-staff"

New-MgGroupMember -GroupId $g.Id -DirectoryObjectId (Get-MgUser -UserId "user@cloudlab.in").Id

# REST
POST https://graph.microsoft.com/v1.0/groups
{ "displayName":"HR-Staff", "securityEnabled":true, "mailEnabled":false, "mailNickname":"hr-staff" }

POST https://graph.microsoft.com/v1.0/groups/{group-id}/members/$ref
{ "@odata.id": "https://graph.microsoft.com/v1.0/users/{user-id}" }
\`\`\`

**Dynamic group based on department**

\`\`\`powershell
# PowerShell
New-MgGroup -DisplayName "Finance-Dynamic" -SecurityEnabled \\
    -MailEnabled:$false -MailNickname "finance-dyn" \\
    -GroupTypes "DynamicMembership" \\
    -MembershipRule '(user.department -eq "Finance")' \\
    -MembershipRuleProcessingState "On"
\`\`\`

### Mail

**Send email**

\`\`\`powershell
# PowerShell
Send-MgUserMail -UserId "noreply@cloudlab.in" -BodyParameter @{
    Message = @{
        Subject = "Test from Graph"
        Body = @{ ContentType = "Text"; Content = "Hello from Microsoft Graph!" }
        ToRecipients = @( @{ EmailAddress = @{ Address = "user@cloudlab.in" } } )
    }
    SaveToSentItems = $true
}

# REST
POST https://graph.microsoft.com/v1.0/users/noreply@cloudlab.in/sendMail
{ "message": { "subject": "Test", "body": {"contentType":"Text","content":"Hello"}, "toRecipients": [...] } }
\`\`\`

### Sign-in logs (last 24h)

\`\`\`powershell
# PowerShell — requires AuditLog.Read.All
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ssZ")
Get-MgAuditLogSignIn -Filter "createdDateTime ge $yesterday" -Top 100 | \\
    Select CreatedDateTime, UserPrincipalName, IPAddress, AppDisplayName, Status

# REST
GET https://graph.microsoft.com/v1.0/auditLogs/signIns?$filter=createdDateTime ge 2026-05-19T00:00:00Z&$top=100
\`\`\`

### Conditional Access policies (read-only)

\`\`\`powershell
Get-MgIdentityConditionalAccessPolicy | \\
    Select DisplayName, State, CreatedDateTime, ModifiedDateTime
\`\`\`

### Intune devices

\`\`\`powershell
# PowerShell — list non-compliant devices
Get-MgDeviceManagementManagedDevice -Filter "complianceState eq 'noncompliant'" \\
    | Select DeviceName, OperatingSystem, ComplianceState, LastSyncDateTime
\`\`\`

## Query patterns — OData primer

Graph uses OData query parameters. Master these 6 and you can filter, sort, paginate efficiently.

| Parameter | Purpose | Example |
|---|---|---|
| \`$select\` | Choose which properties to return | \`?$select=id,displayName,department\` |
| \`$filter\` | Filter results | \`?$filter=department eq 'Engineering'\` |
| \`$orderby\` | Sort | \`?$orderby=displayName asc\` |
| \`$top\` | Limit results | \`?$top=50\` |
| \`$count\` | Get total count | \`?$count=true\` (needs \`ConsistencyLevel: eventual\` header) |
| \`$expand\` | Include related entities | \`?$expand=manager,memberOf\` |
| \`$search\` | Free-text search (with \`ConsistencyLevel: eventual\`) | \`?$search="displayName:ankit"\` |

### Real examples

**All Engineering users sorted by name (50 results)**

\`\`\`
GET https://graph.microsoft.com/v1.0/users?$filter=department eq 'Engineering'&$orderby=displayName&$top=50&$select=id,displayName,department,jobTitle
\`\`\`

**Users with title containing "manager" (advanced query)**

\`\`\`
GET https://graph.microsoft.com/v1.0/users?$filter=contains(jobTitle, 'manager')
ConsistencyLevel: eventual
# Note: contains() requires advanced query → add header
\`\`\`

**Count of guests in tenant**

\`\`\`
GET https://graph.microsoft.com/v1.0/users/$count?$filter=userType eq 'Guest'
ConsistencyLevel: eventual
\`\`\`

**User with their manager + groups in one call**

\`\`\`
GET https://graph.microsoft.com/v1.0/users/admin@itbd.net?$expand=manager($select=id,displayName),memberOf($select=id,displayName)
\`\`\`

### Pagination

Default page size varies (100-999). Look for \`@odata.nextLink\` in response. Follow it. PowerShell SDK handles this for you with \`-All\`.

\`\`\`powershell
# Manual pagination in PowerShell
$results = @()
$uri = "https://graph.microsoft.com/v1.0/users?$top=999"
do {
    $resp = Invoke-MgGraphRequest -Method GET -Uri $uri
    $results += $resp.value
    $uri = $resp."@odata.nextLink"
} while ($uri)
$results.Count
\`\`\`

### Batch requests (up to 20 in one call)

\`\`\`
POST https://graph.microsoft.com/v1.0/$batch
{
  "requests": [
    { "id": "1", "method": "GET", "url": "/me" },
    { "id": "2", "method": "GET", "url": "/me/messages?$top=5" },
    { "id": "3", "method": "GET", "url": "/me/manager" }
  ]
}
\`\`\`

Returns all 3 results in one HTTP round-trip. Saves latency for bulk operations.

## Permissions — what your app can do

Graph permissions are the heart of API access. Two types: **delegated** (signed-in user) and **application** (app acts on its own).

### Permission types

| | Delegated | Application |
|---|---|---|
| Used by | Interactive apps. Scripts you run while signed in. | Background services, daemons, CI/CD. |
| Effective scope | Intersection of user's rights AND app's permissions. | App's permissions only (subject to tenant consent). |
| Consent | User OR admin (depending on permission) | Always admin consent |
| Example: User.Read | Read the SIGNED-IN user's profile. | Cannot exist — read which user? Use \`User.Read.All\` instead. |

### Top 20 permissions you'll use

| Permission | What it does | Type |
|---|---|---|
| \`User.Read\` | Read signed-in user's profile | Delegated only |
| \`User.Read.All\` | Read all users' profiles | Both |
| \`User.ReadWrite.All\` | Read + update all users | Both |
| \`Group.Read.All\` | Read all groups | Both |
| \`Group.ReadWrite.All\` | Create + manage groups + memberships | Both |
| \`Directory.Read.All\` | Read everything in the directory | Both |
| \`Directory.ReadWrite.All\` | VERY POWERFUL. Manage directory objects. | Both |
| \`Mail.Read\` | Read signed-in user's mail | Delegated |
| \`Mail.Send\` | Send mail as signed-in user | Delegated |
| \`Mail.Send.Shared\` | Send mail as another user (with permission) | Delegated |
| \`Calendars.ReadWrite\` | Read + write calendars | Both |
| \`Files.ReadWrite.All\` | Read + write OneDrive / SharePoint files | Both |
| \`Sites.Read.All\` | Read SharePoint sites | Both |
| \`Sites.FullControl.All\` | Full SharePoint admin via Graph | App only |
| \`ChatMessage.Send\` | Send Teams messages | Delegated |
| \`Channel.Create\` | Create Teams channels | Both |
| \`AuditLog.Read.All\` | Read sign-in + audit logs (Entra ID P1+ tenant) | Both |
| \`DeviceManagementManagedDevices.ReadWrite.All\` | Manage Intune devices | Both |
| \`SecurityEvents.Read.All\` | Read Defender XDR alerts | Both |
| \`Policy.ReadWrite.ConditionalAccess\` | Manage CA policies | App only |

### Granting permissions

**1. Register app in Entra ID**

Entra portal → App registrations → New registration. Save the Client ID.

**2. Add API permission**

App → API permissions → Add a permission → Microsoft Graph → choose Delegated or Application → pick the permissions → Add.

**3. Grant admin consent**

App → API permissions → "Grant admin consent for &lt;tenant&gt;" (button at top). Required for app permissions + some delegated.

**Principle of least privilege:** Don't request \`Directory.ReadWrite.All\` when \`User.ReadWrite.All\` is enough. Don't request \`.ReadWrite\` when \`.Read\` works. Tenants are increasingly approving permission scope per request.

## Troubleshooting Graph calls

The 10 most common errors + how to fix them.

### 401 Unauthorized

**Token expired** — Graph tokens last 1 hour by default. Refresh.

**Wrong tenant** — token issued for tenant A but you're hitting tenant B's data.

### 403 Forbidden — insufficient permissions

Your app lacks the right permission OR consent wasn't granted. Check:

\`\`\`
# Decode your token at jwt.ms — look for "roles" or "scp" claim
# "roles": ["User.Read.All", "Group.Read.All"]   ← these are app permissions
# "scp": "User.Read User.ReadBasic.All"    ← these are delegated permissions
\`\`\`

### 404 Not Found

Wrong endpoint. Check API version (\`v1.0\` vs \`beta\`). Some endpoints only in beta.

### 429 Too Many Requests — throttling

Graph has per-tenant + per-app rate limits. Honor \`Retry-After\` header:

\`\`\`powershell
$resp = Invoke-RestMethod -Method GET -Uri $uri -Headers $headers
if ($resp.StatusCode -eq 429) {
    $wait = $resp.Headers['Retry-After']
    Start-Sleep -Seconds $wait
    # retry
}
\`\`\`

### 400 Bad Request

Malformed JSON body. Missing required field. \`userPrincipalName\` conflicts with existing user.

### 500 Internal Server Error

Microsoft side issue. Retry with exponential backoff. Open support ticket if persistent.

### "AdvancedQuery feature not enabled" (count, search, complex filter)

Need \`ConsistencyLevel: eventual\` header AND \`$count=true\` query param:

\`\`\`
GET https://graph.microsoft.com/v1.0/users/?$count=true&$filter=startsWith(displayName, 'A')
ConsistencyLevel: eventual
\`\`\`

### Pagination skipping records

You're using \`$skip\` — not supported on all endpoints. Use \`@odata.nextLink\` instead.

### Helpful debugging tools

- Graph Explorer (\`aka.ms/ge\`) — test queries with your auth
- jwt.ms — decode your access token to see roles/scopes/expiry
- Fiddler / Wireshark — capture raw HTTPS requests
- \`Microsoft.Graph -Debug\` — PowerShell SDK shows the raw REST call

**Best practice:** Always check \`X-Microsoft-Graph-Request-Id\` header from response. Include it in support tickets — Microsoft can trace your call.`,
    sortOrder: 3,
  },
  {
    slug: "hybrid-infra",
    title: "Hybrid Infra Map — How Every CloudLab Simulator Interconnects",
    category: "Reference",
    sourcePage: "hybrid-infra.html",
    summary: "One fictional company, CloudLab Inc., spans all 16 CloudLab simulators — the canonical user roster, devices, groups, sync flows, and network topology tying them together.",
    bodyMarkdown: `# Hybrid Infra Map — one company across 16 simulators

Every CloudLab simulator portrays the same fictional company: **CloudLab Inc.** with on-prem domain \`corp.cloudlab.local\`, public domain \`cloudlab.in\`, 247 employees across 5 sites, and a full Microsoft + network security stack. This page is the canonical roster and topology that ties every sim together.

**Forest:** corp.cloudlab.local · **Tenant:** cloudlabinc.onmicrosoft.com · **Public domain:** cloudlab.in · **Sites:** 5 (HQ Mumbai + 2 branches + DR + remote) · **Users:** 60 canonical (247 total) · **Devices:** 39 canonical · **Groups:** 25 (15 synced + 10 cloud-only)

## Topology — Internet to identity to endpoint to telemetry

Click any sim box to jump into that simulator. Arrows show the actual sync direction.

The topology flows as follows, from the internet inward:

- **Internet** connects to two edge firewalls in parallel: **Palo Alto FW** and **FortiGate**.
- Both edge firewalls connect into the core network layer: **Cisco IOS** and **Meraki SD-WAN**, with **Wireshark pcap** available for packet capture at that layer.
- The core network connects to the on-prem identity layer: **ADDS (on-prem)** — DC01 + DC02 + DC03 — and **Windows Server**.
- ADDS syncs to **Entra Connect (AADC01)**, which performs Password Hash Sync (PHS) every 30 minutes into **Microsoft Entra ID** (\`cloudlabinc.onmicrosoft.com\`) — the centerpiece of the whole map.
- Entra ID fans out auth/access to five M365-era services: **M365 admin** (Exchange + SharePoint + Teams), **Intune** (endpoint management), **Azure portal** (Subs + VNet + AKS + Key Vault), **Power Platform** (Apps + Automate + BI), and **Azure DevOps** (Repos + Pipelines).
- Security telemetry flows from M365 admin and Intune into **Defender XDR** (Identity + Endpoint + Email + Cloud), from ADDS via the MDI (Microsoft Defender for Identity) sensor on the Domain Controllers, and from managed endpoints via MDE (Microsoft Defender for Endpoint) EDR telemetry.
- Defender XDR feeds into **Microsoft Sentinel** (SIEM + SOAR + KQL).
- M365 admin also sends audit logs into **Microsoft Purview** (Audit + eDiscovery + DLP) for compliance.
- At the bottom of the stack sit the **Endpoints** — 39 devices: Win 11 laptops + macOS + iPhones/Android, Hybrid Entra-joined / Entra-joined / Mobile, managed by Intune and protected by Defender for Endpoint.

**Legend:** Identity sync (purple) · Auth/access (blue) · Security telemetry (red) · Management (green) · Compliance/audit (gold dashed).

## Follow a user through the stack

Pick any canonical user and you can see how their identity, devices, groups and roles appear across every simulator: UPN, samAccountName, on-prem SID, Entra object ID, manager, source of authority, admin role (if any), MFA enrollment status, licenses, group memberships (flagged whether synced to Entra or on-prem only), and owned devices with their compliance state. Each user links out to the relevant simulators — ADDS, M365, Intune, Defender, Sentinel, Purview, Azure, Power Platform, Azure DevOps — to see their record in that specific console.

## Sync flows — what flows where, how often, why

Every arrow on the topology diagram corresponds to one sync flow row, filterable by kind: **Identity**, **Device**, **Security**, **Compliance**, or **Network**. Each flow record captures: source system, target system, kind, what data flows, sync interval, protocol, and the operational impact if that flow breaks. For example, the ADDS → Entra Connect → Entra ID chain is tagged **Identity**, runs Password Hash Sync every 30 minutes, and its impact is that cloud sign-in reflects on-prem password changes with up to a 30-minute lag.

## Infrastructure nodes — DCs, servers, cloud, network gear

The underlying hardware and cloud resources that host the workloads simulated in each sim, organized into four categories:

- **Domain Controllers (4)** — name, site, role, IP, OS for each DC in the forest.
- **Member servers (16)** — the Windows Server fleet backing file shares, SCCM, CMG, and other on-prem roles.
- **Cloud resources (12)** — Azure resources (name, kind, region, purpose) backing the Azure portal simulator: VNets, AKS clusters, Key Vaults, etc.
- **Network devices (17)** — the Cisco, Meraki, Palo Alto, and FortiGate gear (name, vendor, model, site, role) that the network simulators model.

## Groups — synced vs cloud-only, with their purpose

25 canonical groups span both on-prem AD and cloud-only Entra ID groups. Each group record shows: name, kind (security/distribution/M365), scope, source (AD vs Entra-native), whether it's synced to Entra, its member list, and its purpose. Tier-0 administrative groups (e.g. Domain Admins equivalents) deliberately never sync to the cloud, while dynamic membership groups (e.g. department-based) are cloud-only by design.

## Devices — join type + Intune + Defender state

39 canonical endpoints across all 5 sites. Each device record shows: device name, kind, owner, site, OS, join type (Hybrid Entra-joined / Entra-joined / Entra-registered), whether it's Intune-enrolled, whether it's Defender-onboarded, BitLocker key escrow status, and overall compliance state. Every one of these devices would also appear in the ADDS Computers OU, in Entra ID, in Intune, and in Defender for Endpoint — this page is the cross-reference showing how the same device looks in all four places at once.

## All 16 simulators — what role each plays

The full simulator catalog spans every layer of the stack modeled by CloudLab Inc.: the identity layer (ADDS, Entra ID/Azure blade), the M365 productivity layer (M365 admin, Intune), the security layer (Defender XDR, Sentinel, Purview), the cloud infrastructure layer (Azure portal, Power Platform, Azure DevOps), and the network layer (Cisco IOS, Meraki SD-WAN, Palo Alto, FortiGate, Wireshark). Every simulator tile links directly into that simulator, and every tile represents one view onto the same underlying CloudLab Inc. infrastructure — the same users, devices, and groups reappear consistently across all 16.`,
    sortOrder: 4,
  },
  {
    slug: "postmortems",
    title: "Postmortems Library",
    category: "Postmortems",
    sourcePage: "postmortems.html",
    summary: "Ten real-style incident postmortems with timeline, root cause, what worked, what failed, and lessons — anonymised composites from real production fires.",
    bodyMarkdown: `# Postmortems Library

10 real-style incident stories with timeline, root cause, action items. Anonymised composites from real fires — learn from others' pain.

## 1. Conditional Access policy locked out all admins — SEV-1

A "tighten security" change locked out every Global Admin including the IT director. 4 hours of recovery work.

**Severity:** SEV-1 · **Duration:** 4 hours · **Users impacted:** 12 admins, ~50 affected ops · **Customer-visible?** Indirect — security changes paused

### What happened

The Security team rolled out a new Conditional Access policy requiring all users to come from a compliant device. The policy did NOT exclude break-glass accounts. Worse: no break-glass accounts existed. Within 30 minutes of enabling, the first admin tried to sign in from an unenrolled MacBook, was blocked, and could not unblock the others either.

### Timeline (IST)

- **14:00** — Security engineer creates CA policy "Require compliant device for all users" in **Report-only** mode.
- **14:42** — Reviews report-only logs. Looks clean. Switches policy to **Enabled**.
- **14:58** — IT Director tries to sign in to Azure portal from personal MacBook → BLOCKED.
- **15:05** — Director calls Security engineer. Engineer tries to disable policy from her enrolled work laptop. **It works.** Crisis averted, but only because she had a compliant device.
- **15:10** — Engineer reads policy more carefully. Realises: NO break-glass accounts existed. If she had been signed-in from any non-enrolled device, the entire org would be inaccessible.
- **15:30** — Incident declared SEV-1. CISO + IT director + on-call SRE join bridge.
- **15:40** — Team agrees: pause all CA policy changes. Create 2 break-glass accounts immediately.
- **17:18** — 2 break-glass accounts created. Passwords sealed in physical safes (one in Bangalore office, one in Pune secondary office). Excluded from ALL CA policies via dedicated security group "CA-Excluded-BreakGlass".
- **18:00** — Original "Require compliant device" CA policy re-enabled, but with break-glass group excluded + Marketing department excluded (~80 BYOD users still being enrolled).
- **18:24** — Incident closed.

### Root cause

Three contributing factors:
1. **No break-glass accounts existed** — the tenant was 4 years old, and break-glass was on the "we should do this" list but never executed.
2. **Report-only mode tested only "compliant users"** — the report showed expected behavior for already-enrolled users. It did NOT surface the IT Director's personal MacBook because he had never signed in from it during the report-only window.
3. **No phased rollout** — the policy targeted "All users" instead of a pilot group like "IT department" or "10 volunteers".

### What worked

- The Security engineer had a compliant device + admin role — she could disable the policy from a known-good state.
- Sign-in logs let us identify which CA policy was blocking each affected user.
- Recovery time was 4 hours, not 4 days. Microsoft support would have taken >24 hours.

### What did NOT work

- Report-only mode is a true/false signal only for users WHO ACTUALLY SIGNED IN during the window. It cannot predict users who haven't.
- Email approval workflow for CA changes was bypassed because "it's just turning on a default Microsoft recommendation".

### Action items

- Create 2 break-glass accounts. Stored physically in safes in 2 separate offices.
- Excluded break-glass group from all 14 CA policies retroactively.
- Enabled CA "What-If" tool. Required to be run for every policy change as part of change ticket.
- Every CA change now requires a 7-day report-only period + email signoff from CISO before enabling.
- Documented in runbook: "Recovery from CA lockout" with 3 paths (break-glass, Microsoft support, Domain Admin emergency).

**Lesson:** "Default Microsoft recommendation" is not a substitute for change management. Always: (1) Have break-glass accounts BEFORE first CA policy. (2) Pilot before broad rollout. (3) Read the policy from your worst user's perspective, not your best.

## 2. Cosmos DB monthly bill jumped from $500 to $18,000 — SEV-2

Auto-scale + bad partition key + retry storm = catastrophic RU consumption. Finance discovered before engineering.

**Severity:** SEV-2 · **Duration:** ~14 days undetected · **Cost impact:** $17,500 overrun · **Customer-visible?** No (perf was fine)

### What happened

An e-commerce team had been running Cosmos DB at $500/month for 18 months. A new "user analytics" feature shipped, which inadvertently created a hot partition. Cosmos's auto-scale RU/s setting kicked in to handle the load, scaling up to 50,000 RU/s sustained.

### Timeline

- **Day 0** — Engineering ships "user analytics" feature. New container \`user_events\` with partition key \`region\` (only 5 distinct regions). Auto-scale max set to 50,000 RU/s (the wizard's default).
- **Day 1-3** — Initial usage spread evenly. Cosmos auto-scaled to 5,000 RU/s. No alerts.
- **Day 4** — Marketing campaign goes live. Users from India region spike. Hot partition. Cosmos throttles → app sees 429 errors → app retries aggressively → MORE load → Cosmos scales up to **50,000 RU/s** (the cap).
- **Day 4-14** — App auto-retry covers throttling. Users see no errors. Cost continues to grow daily. No engineer notices.
- **Day 14** — Finance reviewing Azure bill. Spots Cosmos DB line at $14,000 for the month so far. Pings CTO.
- **Day 14, 11:00** — SEV-2 declared. SRE investigates.
- **Day 14, 12:00** — Identified hot partition via "Top 10 partitions by request units consumed" metric. India region was consuming 87% of all RUs.
- **Day 14, 14:00** — Immediate fix: capped auto-scale at 10,000 RU/s. App started seeing slower responses but no failures.
- **Day 14, 16:00** — Engineering started repartitioning: new container \`user_events_v2\` with partition key \`userId\`. Data migration via Change Feed.
- **Day 16** — Migration complete. Old container deleted. Cost drops back to ~$700/month.

### Root cause

Three causes compounded:
1. **Bad partition key**: \`region\` has only 5 distinct values. Any spike in one region creates a hot partition.
2. **Auto-scale max too high**: 50,000 RU/s is appropriate for a busy production DB, not for "a new feature."
3. **No cost alert**: Cosmos DB cost grew 30x without anyone noticing because there was no budget alert on it.

### What worked

- Auto-scale prevented user-visible failures — the system "did its job" by scaling up.
- Change Feed enabled zero-downtime data migration to the new container.

### What did NOT work

- No cost anomaly detection. Even a simple "monthly cost > 2x average" alert would have caught this in Day 5, not Day 14.
- The Azure architectural review of the feature happened, but partition key choice was not flagged.

### Action items

- Add anomaly detection alert: Cost Management → daily anomaly alerts at severity Medium.
- Added budget per resource group with 80/100/120% thresholds.
- Added engineering review checklist item: "For Cosmos DB, partition key must have high cardinality + even access pattern."
- Default auto-scale max in our Bicep templates lowered to 4,000 RU/s. Anything higher requires CTO approval.
- Added monitor on "throttled requests" metric — alert if 429 count > 100/hour.

**Lesson:** Auto-scale is a safety net, not a free pass. Combine with cost alerts + throttle alerts so it surfaces if the system is fighting itself.

## 3. AKS production cluster mass pod eviction during patch — SEV-1

Node upgrade triggered eviction without PodDisruptionBudgets. 30% of prod traffic lost for 18 minutes.

**Severity:** SEV-1 · **Duration:** 18 min outage · **Users impacted:** ~80,000 API requests failed · **Customer-visible?** Yes — 5xx errors

### What happened

SRE scheduled a routine AKS node image upgrade. Surge configured at 33%. No PodDisruptionBudgets (PDB) on critical workloads. When the upgrade started, Kubernetes drained 3 nodes simultaneously. Pods for the \`payment-api\` deployment (3 replicas) were ALL on those 3 nodes (no podAntiAffinity rules either). All 3 pods were evicted at once. Service became unavailable for 18 minutes while new pods scheduled on surge nodes.

### Timeline (UTC)

- **02:00** — SRE starts AKS node image upgrade. Maintenance window starts. Surge 33% (3 new nodes added to a 9-node pool).
- **02:08** — K8s starts draining first 3 nodes. \`payment-api\` pods all evicted at once.
- **02:08** — Front Door health probes for \`payment-api\` backend pool turn red. Front Door auto-fails over to a DR backend? No — there was no DR. Users get 503.
- **02:09** — PagerDuty alerts the on-call. SRE on bridge.
- **02:10** — SRE checks AKS. Sees the upgrade in progress + payment-api 0/3 pods ready. Realizes the eviction cascaded.
- **02:12** — SRE tries to pause the upgrade. \`az aks upgrade --node-image-only\` has no pause flag. Cluster autoscaler is provisioning surge nodes.
- **02:14** — Surge nodes ready. New \`payment-api\` pods scheduling. ImagePullBackOff briefly (ACR pull throttling).
- **02:24** — 3/3 payment-api pods Ready. Service restored.
- **02:26** — Front Door probes green. Traffic restored. 18-minute outage.

### Root cause

Multiple safety nets were missing:
1. **No PodDisruptionBudget** on \`payment-api\`. K8s allowed all 3 pods to be evicted simultaneously.
2. **No podAntiAffinity**: all 3 pods scheduled on 3 different nodes by chance, but no *guarantee* of spread. In this incident all 3 happened to be on nodes being drained.
3. **Upgrade scheduled during low-traffic but not zero traffic**: 02:00 UTC is mid-business-hours in some regions.
4. **No DR backend in Front Door**: single regional cluster, no failover backend pool.

### What worked

- Surge nodes provisioned correctly.
- Cluster autoscaler kept the new pods within capacity.
- Front Door health probes detected the issue + alerted on-call within 1 minute.

### What did NOT work

- No PDB blocked the simultaneous eviction.
- ACR pull throttling extended the recovery by ~2 minutes.
- No way to PAUSE the upgrade once started.

### Action items

- Added PDB to all critical Deployments: \`minAvailable: 2\` (out of 3 replicas).
- Added \`podAntiAffinity\` with \`preferredDuringSchedulingIgnoredDuringExecution\` to spread pods across nodes.
- Migrated upgrade window to 22:00 IST (5:30 PM UTC, lowest traffic).
- Stood up second AKS cluster in West Europe + Front Door backend pool. Now if Region 1 fails, Region 2 takes over.
- Configured ACR with geo-replication + Premium tier (no pull throttling).
- Added pre-upgrade runbook check: validate PDB exists for every Deployment in \`kubectl get pdb -A | grep payment\`.

**Lesson:** Kubernetes will happily evict everything if you don't tell it not to. PDB + podAntiAffinity is not optional in production. Test by simulating: \`kubectl drain\` a node and see if your service degrades.

## 4. Application Gateway cert expired → 30-min outage during business hours — SEV-2

Cert renewal in Key Vault was automatic. Application Gateway integration was NOT.

**Severity:** SEV-2 · **Duration:** 32 min · **Customer impact:** All web traffic blocked

### What happened

The org used Azure Key Vault with auto-renewal for their wildcard TLS certificate. Renewal worked correctly. **However**, Application Gateway was configured with a *versioned* reference to the certificate. When the new version was issued, Application Gateway continued serving the old (expired) cert. Browsers blocked. 30 minutes of downtime during India business hours.

### Timeline (IST)

- **12:00** — Certificate \`*.cloudlab.in\` v3 (issued 1 year ago) expires.
- **12:00** — Browsers + curl start returning \`NET::ERR_CERT_DATE_INVALID\`.
- **12:03** — Customer support gets first ticket: "Your site won't load."
- **12:04** — SRE checks. Confirms cert is expired (curl -vI returns expired). Realizes the v3 cert is still being served by Application Gateway despite v4 existing in Key Vault.
- **12:08** — SRE updates Application Gateway HTTP Settings to reference \`https://kv.vault.azure.net/secrets/cloudlab-cert\` (no version → always latest).
- **12:08** — Application Gateway picks up the new cert version. Takes 2-5 min to propagate to all instances.
- **12:18** — First successful HTTPS request to \`www.cloudlab.in\` with new cert.
- **12:32** — All requests succeeding. Incident closed.

### Root cause

The Bicep template that deployed Application Gateway referenced the cert with a specific version:

\`\`\`bicep
// BAD: pinned to specific version
sslCertificates: [{
  name: 'cloudlab-cert'
  properties: {
    keyVaultSecretId: 'https://kv.vault.azure.net/secrets/cloudlab-cert/abc123def456'  // ← version pinned
  }
}]

// GOOD: latest version always
sslCertificates: [{
  name: 'cloudlab-cert'
  properties: {
    keyVaultSecretId: 'https://kv.vault.azure.net/secrets/cloudlab-cert'  // ← no version, always latest
  }
}]
\`\`\`

### Why no alert fired

Key Vault has cert expiry alerts. They DID fire 30 days ago. But the team thought "Key Vault is renewing automatically — we're fine." Nobody verified that Application Gateway was actually picking up the new version.

### What worked

- SRE diagnosed the issue in 8 minutes using \`curl -vI\` + Key Vault inspection.
- Fix was a 30-second config change once root cause was known.

### What did NOT work

- Key Vault expiry alert was treated as "informational" because auto-renewal was on.
- No synthetic monitoring with cert expiry check.
- Application Gateway propagation took 10+ minutes.

### Action items

- Removed version pin from ALL Key Vault references in Bicep templates. \`az keyvault secret list | jq\` review confirmed 8 other resources had same anti-pattern.
- Added synthetic monitoring (Application Insights Availability test) that checks cert expiry via custom JavaScript. Alerts if cert expires within 30 days.
- Added runbook: "Cert renewal procedure" with a checklist that includes "Verify Application Gateway / App Service / API Management actually fetched the new version."
- Documented in our IaC golden patterns: "ALWAYS use versionless Key Vault references for certs and secrets unless you have a specific reason to pin."

**Lesson:** Automatic renewal is half the battle. The other half is making sure consumers refresh. Always verify end-to-end after a cert rotation. Pair Key Vault auto-renewal with versionless references so consumers automatically follow.

## 5. Business Email Compromise — fake CFO ordered $47K wire — SEV-1

Attacker compromised assistant's mailbox, set up inbox rule, sent fake instructions from real CFO's display name.

**Severity:** SEV-1 · **Financial loss:** $47,000 (recovered) · **Detection:** Bank flagged transaction

### What happened

An attacker successfully phished the CFO's administrative assistant. Once inside her mailbox, they created an inbox rule that auto-deleted any reply containing "wire transfer". Then they sent an email FROM her account TO the AP clerk, asking for an "urgent confidential wire" of $47K to a Hong Kong account, claiming it was from the CFO. The CFO never saw the conversation because the assistant's mailbox was hiding the replies.

### Timeline

- **Day -3** — Assistant receives phishing email mimicking Microsoft 365 password expiry. Clicks link, enters credentials on attacker's fake login page.
- **Day -3** — Attacker has assistant's creds. Logs in. NO MFA was enforced on her account (she was on the "legacy users" exclusion).
- **Day -3** — Attacker creates inbox rule: \`If subject contains "wire" OR "transfer" → move to Deleted Items\`.
- **Day 0, 10:00** — Attacker sends email FROM the assistant's mailbox TO the AP clerk. Subject: "Confidential — urgent wire request from CFO". Body claims the CFO needs $47K wired urgently for "acquisition closing".
- **Day 0, 10:30** — AP clerk replies to confirm. Reply auto-deleted by the inbox rule. Attacker (still controlling the mailbox) replies pretending to be the assistant: "Yes, please proceed urgently — CFO is in a meeting."
- **Day 0, 11:00** — AP clerk submits wire to bank.
- **Day 0, 14:00** — Bank fraud detection flags the wire (unusual amount + new beneficiary + Hong Kong). Bank calls CFO directly.
- **Day 0, 14:15** — CFO knows nothing about it. Bank halts the wire. CFO calls IT.
- **Day 0, 14:30** — SOC investigation starts. Find compromise of assistant's account, find inbox rule, find attacker IP from Russia.
- **Day 0, 14:45** — Disable assistant's account. Revoke tokens. Reset password. Remove inbox rule. Force MFA registration. Notify all who received emails from her in last 7 days.

### Root cause

1. **No MFA on assistant's account.** She was on a manually-maintained legacy exclusion list, never reviewed.
2. **Inbox rules not monitored.** Defender XDR has "Suspicious inbox rule" detection, but the AccessGroup was disabled.
3. **AP process trusted email instructions for >$10K wires.** No phone callback verification.

### What worked

- Bank fraud detection caught the unusual transaction pattern.
- Once notified, SOC contained the breach within 30 min.
- Wire was halted before settlement. Zero financial loss.

### What did NOT work

- Manual MFA exclusion list grew + nobody re-reviewed it for 18 months.
- Defender XDR inbox-rule detection was disabled "to reduce noise".
- AP wire process had no callback verification.

### Action items

- MFA enforced on 100% of users. Legacy exclusions reviewed + 12 stale exclusions removed.
- Defender XDR inbox-rule detection re-enabled, tuned to severity Medium.
- AP wire process: any wire > $5K requires phone callback to a known number from the requester.
- Mandatory phishing training for all finance + admin staff (quarterly).
- Attack Simulator: quarterly simulated phish to AP team.
- Sentinel rule: "Inbox rule created with auto-delete keywords" (high severity).

**Lesson:** BEC is mostly a process failure, not a tech failure. Even with full Defender XDR + MFA, if the AP team trusts email instructions for big wires, attackers win via social engineering. Always require *out-of-band* verification for high-value transfers.

## 6. Revoked root CA cert took down VPN for 12,000 remote workers — SEV-2

Security team rotated the root CA. Forgot the VPN clients trust the OLD root. 6 hours of no remote access.

**Severity:** SEV-2 · **Duration:** 6 hours · **Users impacted:** 12,000 WFH users · **Customer-visible?** Internal only

### What happened

Security team rotated the internal Root CA cert as part of a planned 10-year refresh. They updated all internal web servers + email + RADIUS. They forgot the corporate VPN client devices had the OLD root CA pinned via Intune. When the new root cert was issued and the old one revoked, every VPN tunnel attempt failed because the device couldn't validate the new VPN server cert.

### Timeline (IST)

- **Day -7** — Security team prepares new Root CA (CloudLab-Root-CA-2026). Tested in lab.
- **Day 0, 22:00** — Maintenance window starts. Old root CA revoked. New root CA active. All internal services migrated.
- **Day 1, 06:00** — India users (and other timezones already in workday) start WFH session via VPN. **VPN connections fail.**
- **Day 1, 06:45** — Helpdesk overwhelmed. SRE on bridge.
- **Day 1, 07:30** — SRE reproduces issue: VPN client throws "server cert not trusted". Realises Intune-pushed root CA on devices is still the OLD root.
- **Day 1, 08:00** — SRE pushes new root CA via Intune (Configuration Profile → Certificate). Targets all corporate Windows + Mac devices.
- **Day 1, 08:30** — First devices start picking up the new cert. Some sync immediately, some take longer.
- **Day 1, 12:00** — ~85% of devices have synced. ~15% still failing — either offline, in airplane mode, or Intune sync stuck.
- **Day 1, 13:00** — Helpdesk runs Intune "Sync now" via remote actions for outliers + emails users with manual cert install instructions.
- **Day 1, 14:00** — All users on VPN. Incident closed.

### Root cause

The CA rotation runbook covered: internal HTTPS, RADIUS, ADFS, internal CDP/AIA. It did NOT cover device-pushed CA trust (Intune Configuration Profile → Trusted Certificate).

### Why testing missed it

The lab test was on test devices with both roots pre-installed. Real production devices had only the old root.

### What worked

- Intune's mass-push of the new cert allowed recovery without physical device touch.
- Helpdesk had documented manual install instructions for offline devices.

### What did NOT work

- CA rotation runbook was incomplete.
- Test environment did not mirror production trust posture.
- No phased rollout — "big bang" cutover.

### Action items

- CA rotation runbook now includes **"Device trust" section**: Intune Trusted Cert profile, Win Server Group Policy, Mac MDM profile, mobile EAP profiles.
- All future CA rotations: push the NEW root 30 days BEFORE revoking the OLD one. Then revoke.
- Phased rollout: pilot group (IT team) → 10% users → 50% → 100%, each separated by 1 week.
- Test environment now uses production trust posture (both roots installed during transition).

**Lesson:** Trust changes are insidious. Every place a cert is validated needs to be updated BEFORE the old cert dies. List every consumer (servers, devices, mobile apps, embedded firmware, IoT). The blast radius of a CA mistake is enormous.

## 7. A single bad query took down SQL DB for 90 minutes — SEV-2

Data analyst ran a 4 TB cross-join in production accidentally. DTU pegged at 100%. App timeouts cascaded.

**Severity:** SEV-2 · **Duration:** 90 min · **Customer impact:** Slow + intermittent 503

### What happened

A data analyst was exploring data using SQL Server Management Studio connected to PRODUCTION Azure SQL DB. They accidentally wrote a query without a JOIN condition — Cartesian product across two large tables (~4 billion rows × 2 thousand rows). DTU hit 100% immediately. App started getting timeouts because their queries couldn't get enough DTU.

### Timeline

- **14:15** — Analyst runs the query in SSMS. SSMS shows it as "Executing..." with progress bar moving slowly.
- **14:18** — App users start seeing 503 errors. App Insights metric "Failed request" spikes.
- **14:20** — SRE checks Azure SQL DB metrics. DTU = 100%, sustained. CPU + I/O + log usage all maxed.
- **14:22** — SRE opens Query Performance Insight. Top query is one she's never seen, from an SSMS session with the analyst's UPN.
- **14:24** — SRE asks analyst (over chat) to cancel. Analyst tries Ctrl+C in SSMS. Cancel takes time because SQL has to roll back.
- **14:32** — SRE finds session ID via \`SELECT * FROM sys.dm_exec_requests\`. Runs \`KILL [session_id]\`.
- **14:35** — Query killed. DTU drops to 50%. App requests start succeeding again.
- **15:00** — DTU back to normal baseline (~30%). App recovered.
- **15:45** — Discussion with analyst + data team manager: how did production access happen?

### Root cause

1. **Analyst had direct production SQL access.** Justified for "ad-hoc reports" but no isolation from app workload.
2. **No query timeout** at the DB level. Default in Azure SQL DB is unlimited.
3. **No workload classification**: app + analyst queries competed equally for DTU.

### What worked

- Query Performance Insight identified the offending query within 4 minutes.
- KILL command + roll back was effective.
- App auto-retry handled most of the timeouts — only ~5% of users saw final 503s.

### What did NOT work

- No isolation between analyst queries + app queries.
- No DB-level resource limits per user / login.
- SSMS cancel button took 8 min because of rollback — should have killed via T-SQL faster.

### Action items

- Created a **read replica** (or named replica for Hyperscale tier). Analysts route ad-hoc queries here.
- Added **query timeout** for analyst logins via \`ALTER LOGIN ... WITH ... QUERY_GOVERNOR_COST_LIMIT = ...\` (effective for SQL MI; for SQL DB, app-level timeouts).
- Added Sentinel rule: alert if any single query consumes > 30% DTU for > 5 min.
- Training session for analysts: "Always preview with TOP 100 before running." "Always use a WHERE clause on big tables."
- Documented procedure: production read-only access via temporary JIT in Defender for SQL (1-hour window with justification).

**Lesson:** Production DBs should never serve human ad-hoc queries. Stand up a read replica + force analysts to use it. One bad query can take down the entire app.

## 8. Storage account accidentally exposed to internet — 3 weeks — SEV-1

Engineer disabled firewall for a one-time backup. Forgot to re-enable. Surfaced by a security audit.

**Severity:** SEV-1 · **Duration:** 23 days exposed · **Data exposed:** ~80 GB customer backups (NOT downloaded by external actors)

### What happened

An engineer needed to upload a 50 GB backup file from a corporate laptop. The storage account had a firewall rule allowing only specific Azure IPs. The engineer's laptop wasn't whitelisted. Instead of adding their IP, they temporarily set the firewall to "Allow from all networks" and uploaded. They forgot to revert. The change made the storage account internet-reachable for 23 days. A weekly Defender for Cloud scan eventually flagged it.

### Timeline

- **Day 0** — Engineer needs to upload \`db-backup-2026.bak\` to storage account \`stbackupsprod001\`. Their laptop IP not in firewall. They change firewall to "Allow all networks" via portal. Uploads. Walks away.
- **Day 0-22** — Storage account is internet-reachable. Auth still required (no anonymous public access enabled at account level, but firewall allows any IP to *try*). Nobody noticed.
- **Day 23** — Defender for Cloud weekly compliance scan runs. Reports "Storage accounts should disable public network access" as a Medium finding. Sent to Security team distribution list.
- **Day 23, 11:00** — SOC analyst sees the alert + investigates. Finds the firewall change in Activity Log + sees the engineer was the actor.
- **Day 23, 11:30** — SOC pulls Storage Analytics logs for the 23-day window. Looks for any external IP accessing data. **Finds none.** All access was from Azure internal IPs + the engineer's laptop IP. No data exfiltration.
- **Day 23, 12:00** — SRE re-enables firewall. Restricts to original Azure IPs only. No data was downloaded externally during the window.
- **Day 23, 14:00** — SOC reports to CISO. No customer notification needed (no data accessed externally).

### Root cause

1. **Engineer chose convenience over security**: opening the firewall completely instead of allowing a specific IP.
2. **No automation to re-close.** "Temporary" became permanent because no expiry.
3. **Detection lag**: 23 days. Weekly compliance scan was too slow; should be alert-driven.

### What worked

- Defender for Cloud caught it eventually.
- Storage Analytics logs preserved evidence of who accessed what during the exposure window.
- No data was actually exfiltrated.

### What did NOT work

- The Azure Policy "deny storage with public network access" was set to *Audit*, not *Deny*.
- Activity Log alert for "Storage firewall change" did not exist.
- No engineering culture around "temporary security changes need an automated expiry."

### Action items

- Azure Policy changed to **Deny** for public network access on production storage. Engineer cannot make this change manually.
- Added Sentinel rule: "Storage account public access enabled" (High severity), fires within 5 min of the change.
- Built self-service "Temporary access" tool: engineer requests their IP added → automatically removed after 4 hours.
- Training: engineers shown the new tool. "Allow all networks" is now considered a security incident.
- Defender for Cloud scan frequency increased to daily for storage findings.

**Lesson:** Convenience holes become permanent holes. Make the secure path easier than the dangerous one — build the temporary-access tool BEFORE you need to forbid the workaround. Otherwise engineers find creative ways to ship.

## 9. Pipeline deployed schema migration before code → 45-min outage — SEV-1

Ordering bug in deployment pipeline. New schema breaks old app version. Rollback was harder than expected.

**Severity:** SEV-1 · **Duration:** 45 min · **Customer impact:** All API requests 500

### What happened

The deployment pipeline ran a database migration BEFORE the new app code rolled out. The migration dropped a column that the OLD app version still referenced. App started returning 500 errors. Rolling back the schema would have lost the new column's data — so the team had to rush-forward the code deploy instead.

### Timeline

- **14:00** — Deployment pipeline starts. Stage 1: database migration via Flyway. Drops legacy \`users.legacy_token\` column. Adds \`users.new_token_id\`.
- **14:02** — DB migration completes successfully.
- **14:02** — OLD app (still running on AKS) tries to query \`users.legacy_token\`. Throws SQL exception. Returns 500.
- **14:03** — API error rate spikes from 0.1% to 100%. PagerDuty fires.
- **14:05** — SRE on bridge. Quick check: app version is still old (deployment phase still building new image).
- **14:07** — SRE realises schema migration ran BEFORE code deploy. Stage 2 (code deploy) is still going.
- **14:10** — Decision tree: (a) wait for code deploy to finish (still 30 min away), (b) rollback schema (loses new column data + 5 records added since migration), (c) deploy new app version urgently.
- **14:15** — Chose (c) Rush forward. SRE manually triggers urgent deploy: \`kubectl set image deployment/api api=registry/api:v2.4.0\` + waits for rollout.
- **14:32** — 3/3 pods running new image. First successful API requests.
- **14:45** — Error rate back to 0.1%. Incident resolved.

### Root cause

1. **Pipeline ordering bug**: schema migration ran in parallel with code build, not serially.
2. **Breaking schema change**: dropped column the old code still referenced.
3. **No "expand-then-contract" pattern**: should have done 2 migrations: (1) ADD new column. Deploy new code. (2) DROP old column. Deploy code that no longer references it.

### What worked

- Detection was immediate (<2 min via PagerDuty).
- Rush-forward deploy worked.
- Production stayed read-write — we didn't lose any data.

### What did NOT work

- Pipeline ordering had no guardrails.
- Schema changes were not expand-then-contract.
- No canary deployment — the migration affected the whole DB at once.

### Action items

- Pipeline reordered: code build + push → app deploy → THEN schema migration. With explicit gates.
- All schema changes follow expand-then-contract: 1. Add new column. Code reads both old + new. Deploy. 2. Code writes to new only, reads from new. Deploy. 3. Drop old column. Deploy.
- Added pre-deploy linter that checks for "destructive migration" keywords (DROP COLUMN, DROP TABLE). Fails the pipeline with a manual override required.
- Canary deployments enabled via Argo Rollouts. New code reaches 10% of traffic first, before 100%.
- Documented schema migration checklist in our DevOps wiki.

**Lesson:** The expand-then-contract pattern is non-negotiable for schema changes. Step 1 should always be additive (safe to roll back). Step 2 cleanup ships separately, after Step 1 is verified stable.

## 10. ACR throttling stalled 12 simultaneous deploys — SEV-3

Quarterly fleet upgrade hit ACR Basic tier pull rate limit. Deploys stuck for 90 min.

**Severity:** SEV-3 · **Duration:** 90 min stall · **Customer impact:** None (deploys delayed, not failed)

### What happened

The platform team scheduled a quarterly maintenance: upgrade 12 microservices simultaneously across 4 AKS clusters. Each cluster pulled the new images from ACR Basic tier. ACR Basic has a 1,000 pulls/min limit. With ~50 pods × 4 clusters × 12 services, the pull rate exceeded the limit. Pods stuck in ImagePullBackOff for 90 min.

### Timeline (no customer impact — just deploy delay)

- **22:00** — Maintenance window starts. 12 microservices upgraded via Helm.
- **22:05** — Pods across 4 clusters trying to pull new images. ACR returns \`429 TooManyRequests\` intermittently.
- **22:10** — Pods enter ImagePullBackOff cycle. K8s back-off retries (with jitter), but throttling continues.
- **22:18** — SRE checking deploy progress sees ImagePullBackOff. Checks ACR metrics. Confirms throttling.
- **22:20** — Decision: wait or upgrade ACR tier? Wait would take ~90 min (back-off retries clear over time).
- **22:22** — Decided to wait. Watching dashboards.
- **23:30** — All pods Running. Throttling cleared.

### Root cause

ACR Basic tier has lower limits than realised. Migration playbook didn't account for the multiplied load (~2,400 simultaneous pulls in burst).

### Why this was SEV-3

No customer-visible impact — old pods kept serving traffic during the 90-min delay. But internal SLO for "maintenance window completed within X hours" was missed.

### Action items

- Upgraded ACR from Basic → Premium ($16/mo → $167/mo). Premium has 50,000 pulls/min limit + geo-replication.
- Enabled ACR geo-replication to 2 regions for local pulls (further reduces single-region pressure).
- Added pre-upgrade check to estimate total pull volume: count of clusters × pods × services × image size.
- Maintenance procedure now staggers cluster upgrades by 5 min instead of running all 4 in parallel.

**Lesson:** Free + Basic tiers are great for development. Production fleet operations need Premium tier capacity. The $150/mo upgrade is cheap insurance against this exact scenario.`,
    sortOrder: 5,
  },
  {
    slug: "routing-protocols",
    title: "Routing Protocols — OSPF, EIGRP, BGP, RIP Reference",
    category: "Networking",
    sourcePage: "routing-protocols.html",
    summary: "OSPF, EIGRP, BGP, and RIP reference covering areas, LSAs, DUAL, path selection, and a troubleshooting playbook, with Cisco IOS config samples.",
    bodyMarkdown: `# Routing Protocols

OSPF, EIGRP, BGP, RIP — adjacency, metrics, convergence, design rules. The interview material for every network role.

## The 4 dynamic routing protocols in production today

Every interior gateway protocol (IGP) and the one exterior gateway protocol (EGP) you'll meet.

| Protocol | Category | Algorithm | Where used |
|---|---|---|---|
| OSPF | IGP (link-state) | Dijkstra (SPF) | Default for most enterprise + DC. Multi-vendor. RFC 2328 (v2 IPv4) + RFC 5340 (v3 IPv6). |
| EIGRP | IGP (advanced distance-vector) | DUAL | Cisco-heavy shops. Open-sourced RFC 7868 in 2016, but still mostly Cisco. |
| BGP | EGP (path-vector) | Path attribute decision | Internet-wide (eBGP) + large-scale DC fabric (iBGP / BGP EVPN). |
| RIP | IGP (distance-vector) | Bellman-Ford | Legacy / small networks. Avoid for new designs. |

**Mental model**
**Distance-vector** = "Tell my neighbors what I know." Slow convergence, can loop. Examples: RIP, EIGRP, BGP.
**Link-state** = "Flood the topology, every router computes the map." Fast convergence, no loops. Example: OSPF, IS-IS.
**Path-vector** = "Track the entire path." Used by BGP — needed at internet scale to prevent loops across thousands of autonomous systems.

## OSPF — Open Shortest Path First

Default IGP for 90% of enterprise networks. Standardized, multi-vendor, link-state.

**Key concepts**
- **Autonomous System (AS)** — group of routers under one administration.
- **Area** — logical grouping. Area 0 (backbone) connects all others. Inter-area traffic transits Area 0.
- **Router types:** Internal (one area), ABR (multi-area), ASBR (talks to external AS), Backbone (in Area 0).
- **Neighbor / Adjacency:** 2 routers Hello-discovered. Adjacency means full LSDB sync. On multi-access (Ethernet) only DR + BDR form adjacency with others.
- **DR / BDR election:** Highest priority wins (default 1; 0 = ineligible). Tiebreak: highest router ID.

**OSPF area types — when to use which**

| Area type | Notes |
|---|---|
| Area 0 (backbone) | Mandatory. Every non-0 area attaches via ABR. |
| Standard | Default. Accepts all LSA types (1-5). |
| Stub | Blocks Type 5 (external). Inject default route instead. Use for branch routers. |
| Totally Stubby | Blocks Type 5 + Type 3 (inter-area summary). Only default route. Cisco extension. |
| NSSA | Stub but allows local ASBR (Type 7 LSAs, converted to Type 5 at ABR). Branch with internet egress. |
| Totally NSSA | NSSA + blocks Type 3. Default route only. Cisco extension. |

**LSA types (read once, never confused again)**

| LSA type | Notes |
|---|---|
| Type 1 — Router LSA | Each router floods its own. Lists interfaces + neighbors. Area-scoped. |
| Type 2 — Network LSA | DR generates per multi-access network. Lists attached routers. Area-scoped. |
| Type 3 — Summary LSA (inter-area) | ABR injects between areas. "Network X reachable via me." |
| Type 4 — ASBR Summary | ABR advertises "ASBR is reachable via me." |
| Type 5 — External LSA | ASBR injects redistributed routes. Flooded entire AS (except stub). |
| Type 7 — NSSA External | NSSA-specific. ABR converts to Type 5 at area boundary. |

**Cisco IOS OSPF — minimal config**

\`\`\`
! R1 — connects to Area 0 via Gi0/0
router ospf 1
 router-id 1.1.1.1
 network 10.0.0.0 0.255.255.255 area 0
 passive-interface default
 no passive-interface GigabitEthernet0/0
 auto-cost reference-bandwidth 10000
!
! Verify
show ip ospf neighbor
show ip ospf interface brief
show ip route ospf
\`\`\`

**OSPF metric**
\`Cost = reference-bandwidth / interface-bandwidth\`
Default reference = 100 Mbps. With 10 Gbps interfaces all costing 1 (clamped), tune \`auto-cost reference-bandwidth 10000\` (10 Gbps reference).

## EIGRP — Enhanced Interior Gateway Routing Protocol

Cisco's "advanced distance-vector." Fast convergence via DUAL algorithm. Loop-free guaranteed.

**Key concepts**
- **Composite metric** — Bandwidth + Delay (+ Reliability + Load + MTU optional). Default uses BW + Delay only.
- **DUAL** — Diffusing Update Algorithm. Each route has a Successor (best path) + Feasible Successor (instant backup).
- **Feasibility Condition** — FS's Reported Distance < Successor's Feasible Distance. Guarantees no loops.
- **Convergence** — sub-second if FS available; otherwise query/reply through neighbors (Active state).

**EIGRP packet types**

| Packet | Notes |
|---|---|
| Hello | Multicast (224.0.0.10). Every 5s (LAN) / 60s (slow WAN). |
| Update | Reliable. Sent on neighbor up or topology change. |
| Query | Sent when no FS. Asks neighbors "do you have a path?" |
| Reply | Response to Query. |
| ACK | Reliable transport ACK. |

**Cisco IOS EIGRP — minimal config**

\`\`\`
router eigrp CORP
 address-family ipv4 unicast autonomous-system 100
  network 10.0.0.0 0.255.255.255
  af-interface default
   passive-interface
  exit-af-interface
  af-interface GigabitEthernet0/0
   no passive-interface
  exit-af-interface
 exit-address-family
!
show ip eigrp neighbors
show ip eigrp topology
show ip route eigrp
\`\`\`

## BGP — Border Gateway Protocol

The protocol that runs the Internet. Also runs the modern DC fabric. Path-vector. Policy-driven.

**Two flavors**

| Flavor | Notes |
|---|---|
| eBGP | Between different AS numbers. TTL = 1 by default (direct-connect). Used at the Internet edge. |
| iBGP | Within the same AS. Full mesh (or Route Reflectors). Used for DC fabric, MPLS PE-CE, internet transit. |

**BGP path selection (memorize the order)**
1. **Highest Weight** (Cisco-only, local to router)
2. **Highest Local Preference** (within AS — outbound traffic engineering)
3. **Locally originated** (network statement / redistribute / aggregate)
4. **Shortest AS_PATH** (fewer AS hops wins)
5. **Lowest Origin code** (IGP < EGP < Incomplete)
6. **Lowest MED** (between AS — inbound TE, lower better)
7. **eBGP over iBGP**
8. **Lowest IGP metric to next-hop**
9. **Oldest path** (eBGP only — stability)
10. **Lowest Router ID**
11. **Lowest neighbor IP**

**BGP route reflectors**

iBGP requires full mesh — N routers = N(N-1)/2 sessions. For N>10, deploy **route reflectors** (RRs). RRs reflect routes between clients, breaking the full-mesh requirement.

Cluster ID prevents loops. Pair RRs for redundancy. Modern DCs use 2 RRs per fabric, each in a different rack.

**Cisco IOS BGP — minimal eBGP config**

\`\`\`
router bgp 65001
 bgp router-id 1.1.1.1
 bgp log-neighbor-changes
 neighbor 203.0.113.1 remote-as 65002
 neighbor 203.0.113.1 password EBGP-AUTH-SECRET
 neighbor 203.0.113.1 description ISP-Primary
 !
 address-family ipv4 unicast
  network 198.51.100.0 mask 255.255.255.0
  neighbor 203.0.113.1 activate
  neighbor 203.0.113.1 prefix-list IN-FROM-ISP in
  neighbor 203.0.113.1 prefix-list OUT-TO-ISP out
  neighbor 203.0.113.1 maximum-prefix 100000 80 restart 5
 exit-address-family
!
ip prefix-list IN-FROM-ISP permit 0.0.0.0/0
ip prefix-list OUT-TO-ISP permit 198.51.100.0/24
\`\`\`

**BGP attack surface**
**Prefix hijack:** attacker announces your prefix from their AS. Mitigation: RPKI signing your prefixes; ISP filters based on IRR.
**Route leak:** customer accidentally re-announces transit. Mitigation: BGP roles (RFC 9234) on Cisco IOS-XR + Juniper.
**TCP RST / spoofing:** mitigation: BGP MD5 password + GTSM (TTL 255 check).
**Bogon prefixes:** filter RFC 1918, multicast, etc. on internet edge.

## RIP — Routing Information Protocol (legacy)

First IGP. Simple. Slow. 15-hop limit. Used today only in tiny labs and legacy lift-and-shift.

| | RIPv1 | RIPv2 | RIPng (IPv6) |
|---|---|---|---|
| Year | 1988 | 1998 | 1997 |
| Class | Classful | Classless (VLSM) | Classless (IPv6 only) |
| Transport | UDP 520, broadcast | UDP 520, multicast 224.0.0.9 | UDP 521, multicast FF02::9 |
| Auth | None | Plain text or MD5 | IPsec AH/ESP |
| Hop limit | 15 | 15 | 15 |
| Convergence | 30+ sec | 30+ sec | 30+ sec |

**Recommendation:** never use RIP for new networks. The 15-hop limit makes it unusable for anything beyond a single building. OSPF beats RIP on every metric. Document RIPv2 only for legacy inheritance situations.

## Side-by-side comparison

| | RIP | OSPF | EIGRP | BGP |
|---|---|---|---|---|
| Algorithm | Bellman-Ford | Dijkstra | DUAL | Path attributes |
| Type | Distance-vector | Link-state | Adv. distance-vector | Path-vector |
| Metric | Hop count | Cost (BW) | BW + Delay | Path attributes |
| Max hop / route | 15 | Unlimited | Unlimited | Unlimited (AS_PATH) |
| Convergence | 30+ s | ~10s | < 1s | ~30-180s (Internet) |
| Admin distance (Cisco) | 120 | 110 | 90 (internal) / 170 (external) | 20 (eBGP) / 200 (iBGP) |
| Transport | UDP 520 | IP protocol 89 | IP protocol 88 | TCP 179 |
| Authentication | v2: MD5 | MD5 / SHA / IPsec | MD5 | MD5 password / TCP-AO |
| Multi-vendor? | Yes | Yes (RFC standard) | Yes (since 2016 RFC) but mostly Cisco | Yes (RFC standard) |
| VRF support | Yes | Yes | Yes | Yes (MPLS L3VPN) |
| Use today | Avoid | Default IGP enterprise | Cisco-heavy shops | Internet edge + DC fabric |

## Design rules that always apply

**1. Pick one IGP per AS**
Mixing OSPF + EIGRP in one network forces redistribution, which is loop-prone. If you must redistribute, use route maps to filter and tag, and never form 2-way redistribution without route tags or distribute-lists.

**2. Authenticate every adjacency**
Every neighbor session must use a password (MD5 minimum, SHA preferred). Forgetting this opens you to route injection from a hostile router on the LAN.

**3. Passive-interface by default**
Enable routing protocols only on interfaces that face other routers. Use \`passive-interface default\` and explicitly un-passivate the ones you need. Prevents accidental routing exchanges with end hosts.

**4. Hierarchical OSPF**
Keep Area 0 small. Push branches into stub / NSSA areas. Aim for < 50 routers per area. Use ABR summarization (\`area X range\`) to limit LSA churn between areas.

**5. BGP — separate transit from peering**
Customers in one VRF / community. Peering (settlement-free) in another. Transit (paid upstream) in another. Use AS_PATH prepending to influence inbound; use Local Preference to influence outbound.

**6. Failure domain isolation**
Use BFD (Bidirectional Forwarding Detection) for sub-second link-down detection on Ethernet. Without BFD, OSPF/EIGRP hello timers (5s + 4 misses = 20s) miss fast link flaps.

## Troubleshooting playbook

**OSPF — neighbor not coming up**
1. \`show ip ospf interface brief\` — is the interface running OSPF?
2. \`show ip ospf neighbor\` — what state? Init / 2-way / Loading / Full?
3. Mismatched **area** on the two ends → never adjacent.
4. Mismatched **hello/dead timers** → Init only.
5. Mismatched **authentication** → never adjacent.
6. Mismatched **MTU** → stuck at Exchange or Exstart.
7. Mismatched **area type** (stub vs not) → never adjacent.
8. **Different subnets** on the link → never adjacent.

**BGP — session not establishing**
1. \`show ip bgp summary\` — what state? Idle / Active / Open* / Established?
2. Idle = TCP connection failed. Check IP reachability + ACLs.
3. Active = TCP open succeeded but session bouncing. Often **password mismatch** or **TTL too low** (eBGP needs TTL=1 for directly-connected).
4. OpenSent / OpenConfirm = **AS number mismatch**.
5. Established but no routes = missing \`network\` statement, missing \`activate\` under address-family, or **route-map** filtering everything out.
6. Half the routes = **maximum-prefix** hit, look for warnings.

**EIGRP — stuck in Active**
A route stuck in Active means the Successor went down, no Feasible Successor, EIGRP sent Queries, didn't get all Replies. Causes: unstable neighbor, slow link, broken policy filter, summarization issue. Use \`show ip eigrp topology active\` to see which neighbor hasn't replied.

**Universal first step**
Always check **physical layer** first. Cable / SFP / interface error counters. 80% of "routing problems" are actually a flaky link generating route flaps.`,
    sortOrder: 6,
  },
  {
    slug: "day2-runbooks",
    title: "Day-2 Operations Runbooks",
    category: "Runbooks",
    sourcePage: "day2-runbooks.html",
    summary: "Recurring operational procedures for Azure/M365 environments — monthly OS patching, quarterly backup restore drills, key/secret rotation, certificate renewal, annual DR drills, license audits, and access reviews.",
    bodyMarkdown: `# Day-2 Operations Runbooks

Recurring operational procedures: patching, backups, key rotation, certificate renewal, DR drill, license audit. The boring-but-critical work.

## OS Patching — Monthly OS patching for Azure VMs

**Frequency:** Monthly (2nd Tuesday + 7 days) · **Owner:** Platform team · **Duration:** 4-8 hours · **Risk:** Medium

### Overview
- Patch all Azure VMs each month within 14 days of Microsoft Patch Tuesday.
- Use Azure Update Manager (built-in) for orchestration.
- Group VMs by environment (Dev → UAT → Prod) and patch in waves.
- Have rollback plan in case a patch breaks something.

### Pre-patching checklist
- Verify all VMs are healthy (no existing alerts).
- Verify backups completed successfully in last 24h.
- Confirm maintenance window with app owners.
- Take a fresh snapshot of mission-critical VMs.
- Notify on-call team via Teams.

### Patching procedure (Update Manager)
- Portal → Update Manager → Update Deployments → Schedule.
- Schedule for Saturday 22:00 IST (least user activity).
- Set reboot policy: "Always reboot" for OS-update class, "Never reboot" for security-only.
- Pre-script: optional automation (e.g. stop a service first).
- Post-script: optional health check (e.g. ping app endpoint).
- Hit Deploy. Update Manager handles the rest.

### Verification
- After patches: \`Get-HotFix\` on each VM to confirm KB installed.
- Run application smoke tests.
- Monitor error rates in App Insights / Sentinel for 1 hour.
- Mark VMs as healthy in CMDB.

### Rollback if a patch breaks something
- Identify the problematic KB.
- Uninstall via PowerShell: \`wusa /uninstall /kb:KB5036899 /quiet\`.
- Or roll back via Recovery Vault restore from pre-patch snapshot.
- Disable the specific patch in Update Manager + escalate to Microsoft.

## Backup + Restore Drill — Quarterly backup restore drill

**Frequency:** Quarterly (1st month of each Q) · **Owner:** Platform / DR team · **Duration:** 4-8 hours · **Risk:** Low

### Why we drill
- Untested backups are not backups. Drills catch silent failures.
- Catch issues BEFORE you need them in a real incident.
- Build operational muscle memory.
- Tick the compliance box (SOC 2, ISO 27001 require evidence).

### Pre-drill checklist
- Pick 3 different resource types: 1 VM, 1 SQL DB, 1 Storage account.
- Verify last backup was recent (< 24h old).
- Schedule maintenance window if testing in-place restore (not common).
- Notify SOC + on-call.
- Document expected RTO + RPO upfront.

### Drill procedure
- **VM:** Recovery Vault → Backup Items → VM → Restore → Create new VM in DR resource group. Time it.
- **SQL DB:** Azure SQL → Restore → Point-in-time → Create new DB with new name. Verify schema + sample data.
- **Storage:** Restore container from soft-deleted state OR restore via versioning. Verify file integrity (compare checksums).

### Documentation + sign-off
- Record: Date, RTO (measured), RPO (measured), what worked, what failed.
- Compare against documented SLAs.
- File the report in a shared workspace.
- Get sign-off from CISO / Compliance for SOC 2 evidence.

## Key + Secret Rotation — Quarterly key + secret rotation

**Frequency:** Quarterly OR on-demand if compromise suspected · **Owner:** Security + Platform · **Duration:** 4-8 hours · **Risk:** Medium-High

### Scope
- Storage account keys
- Service Principal secrets
- Key Vault keys (RSA / EC) with customer-managed encryption
- Database connection passwords
- API keys (Cognitive Services, Maps, etc.)

### Why
- Compliance (PCI DSS, NIST, ISO 27001 require rotation).
- Reduces blast radius if a secret leaks.
- Forces you to know where every secret is used (good thing).

### Approach: zero-downtime rotation
- Use a 2-key model where possible: **Key1 (primary) + Key2 (secondary)**.
- Rotate Key2 first (only used as backup).
- Update all consumers to use Key2.
- Verify consumers work with Key2.
- Rotate Key1. Now no app uses old keys.
- Update consumers to use both keys (rotate Key2 in next cycle).

### Storage account key rotation
- Portal → Storage account → Access keys → Rotate key2.
- Update apps using SAS or Connection string to use the new Key2 (or use Key Vault references → no app config change).
- Verify apps using \`az storage blob list --account-name X --auth-mode key\`.
- Repeat for Key1 in next quarter.

### Service Principal secret rotation
- Portal → App registrations → Your app → Certificates & secrets → New client secret.
- Add new secret to your secret store (Key Vault).
- Update CI/CD / app config to use the new secret (via Key Vault reference).
- Wait 24h to verify no app failures.
- Delete the old secret.
- **Better:** migrate to Workload Identity Federation — no secret to rotate, ever.

### Key Vault key rotation
- Portal → Key Vault → Keys → Select key → Rotation Policy.
- Set "rotate every X months" + "Notify before expiry: 30 days".
- Apps using cryptographic operations should reference the key by name (not version) so they auto-use the new version.
- Verify: \`az keyvault key list-versions --vault-name X --name Y\` shows the new version is enabled.

### Document everything
- Where each secret is used (CMDB).
- Last rotation date.
- Next rotation due date.
- Owner / responsible engineer.

## Certificate Renewal — Certificate renewal for production

**Frequency:** Annual (90 days before expiry) · **Owner:** Platform · **Duration:** 2-4 hours per cert · **Risk:** High (mistakes cause outage)

### Inventory FIRST
- List every certificate: Application Gateway, App Service custom domain, AKS ingress, Service Fabric, on-prem AD CS, 3rd-party SaaS.
- For each: Domain, Expiry, CA (issuer), Renewal channel.
- Use Key Vault Certificate Inventory for Azure-issued.
- Use a tool like Cert-Manager for AKS (automatic renewal).
- Track in CMDB with owner + renewal date.

### Best practice: use Microsoft-managed certs where possible
- App Service: enable "App Service Managed Certificate" (free, auto-renew, 6-month lifetime).
- Application Gateway: Key Vault integration for auto-renewal.
- AKS: cert-manager + ACME (Let's Encrypt or Buypass).
- Front Door: Managed certs (Microsoft-issued, auto-renew).

### Manual renewal procedure
- **90 days before expiry:** Open ticket with CA (DigiCert / Entrust / GoDaddy etc.).
- Generate new CSR (with same SAN extensions).
- Submit CSR to CA. Receive signed cert (PFX or PEM bundle).
- Upload new cert to Key Vault.
- Update Application Gateway / App Service binding to reference the new cert.
- **30 days before expiry:** Verify new cert is serving traffic. Run \`openssl s_client -connect domain:443\` + check expiry.
- Keep old cert in Key Vault until new cert is verified working for 24h.

### Common gotchas
- **Forgotten certs:** Inventory is the #1 problem. Use Azure Monitor + cert expiry alerts.
- **SAN mismatch:** New cert missing a SAN. Apps using that SAN break silently.
- **Intermediate chain:** Some CAs need intermediate certs. Forgetting them = browsers show insecure.
- **Internal CA roots:** If clients trust your internal CA, expired root = mass trust failure.
- **Pinning:** Some mobile apps pin to a specific public key. Cert rotation = app broken. Plan migration with app owners.

## DR Drill — Annual Disaster Recovery drill

**Frequency:** Annually (or after major architecture change) · **Owner:** CIO sponsored · **Duration:** 1-2 days · **Risk:** High but controlled

### Scope
- Simulate region failure: pretend US East 2 is down.
- Failover all critical workloads to West US 2.
- Validate apps work from DR region.
- Measure actual RTO + RPO vs documented targets.
- Failback after drill completes.

### Pre-drill (4 weeks)
- CIO sponsors the drill. Get executive buy-in.
- Communicate to entire engineering org.
- Schedule blackout window (typically weekend).
- Review current DR docs. Update RTOs/RPOs.
- Identify which apps are in scope (start with 5-10, not 50).
- Get app owner sign-off per workload.

### During drill
- **T-0:** Trigger failover. Document time.
- **T+5 min:** Front Door routes traffic to DR.
- **T+15 min:** Verify each app responds in DR.
- **T+30 min:** Run end-to-end smoke tests.
- **T+60 min:** Validate data integrity (compare with source where possible).
- **T+2 hr:** Document any failures / partial functionality.
- **T+8 hr:** Stop drill. Failback to primary.
- **T+12 hr:** Verify primary running normally.
- **T+24 hr:** Retrospective with all owners.

### Post-drill
- Write post-mortem document.
- List every: thing that worked, thing that surprised us, thing we did not plan for.
- Quantify: actual RTO vs target, actual RPO vs target.
- Action items: who, by when, what change.
- Update DR runbook with lessons.
- Schedule next drill (+ 1 year).

### Common findings (real examples)
- DNS TTL too high (300 sec) — slow failover.
- Cosmos region failover stuck — single-write region misconfig.
- Storage account in DR region is empty — replication was paused.
- Backup vault restore takes 4 hours, documented RTO is 30 min.
- CI/CD pipelines hard-coded primary region endpoints.
- Application Insights instrumentation key tied to primary region.

## License Audit — Quarterly Microsoft license audit

**Frequency:** Quarterly · **Owner:** IT Procurement + Cloud team · **Duration:** 4-6 hours · **Risk:** Cost-impact only

### Why audit
- Microsoft EA renewal typically 3 years. Audit each year to right-size for next renewal.
- Catch unused licenses on terminated employees.
- Identify upgrade / downgrade opportunities (E3 vs E5 vs F3 per persona).
- Detect license sprawl (multiple SKUs for same capability).

### M365 audit
- \`Get-MgSubscribedSku\` → list all SKUs purchased + consumed.
- For each SKU: who is using it? \`Get-MgUser | Select DisplayName, AssignedLicenses\`.
- Find terminated users still licensed: \`Get-MgUser -Filter "accountEnabled eq false"\`.
- Find users with multiple licenses (e.g. E3 + E5 — usually unintentional).
- Find F3 users using E3 features (over-licensed).

### Azure subscription audit
- Cost Management → Cost Analysis → Filter by Resource type = Microsoft.AzureActiveDirectory/<SKU>.
- Hybrid Benefit: \`Get-AzVM | Where-Object {$_.LicenseType -ne "Windows_Server"}\` — find Windows VMs NOT using AHB.
- Reserved Instance utilisation: Cost Management → Reservations → Utilisation report. < 70% = wasted spend.
- Savings Plan utilisation similarly.

### Action items
- Recover unused licenses from terminated users.
- Move users between SKU tiers per actual use.
- Cancel unused subscriptions.
- Apply Hybrid Benefit to all eligible Win/SQL VMs.
- Buy more / fewer Reservations at next renewal.

### Documentation
- Report to CIO with: total spend, % savings achievable, action items.
- Update procurement forecasting for next year.
- Set up automated alerts: 90 days before EA renewal.

## Access Reviews — Quarterly access reviews (PIM + RBAC)

**Frequency:** Quarterly · **Owner:** Identity team + business owners · **Duration:** 21 days end-to-end · **Risk:** Low if process is mature

### Scope
- PIM-eligible roles (Global Admin, Privileged Role Admin, etc.).
- Azure RBAC role assignments at Subscription / RG level.
- Membership of role-assignable security groups (Tier-0 groups).
- Guest users in tenant.
- Service Principal access (any with high privilege).

### Setup (one-time)
- Entra ID → Identity Governance → Access Reviews → Create review series.
- Define cadence: Quarterly. Duration: 21 days.
- Reviewers: Manager + Group owner + Self-attestation.
- If reviewer does not respond: Apply recommendations / Auto-approve / Auto-deny based on risk.
- Notifications: email + Teams + start + 7 days remaining + summary.

### During review
- Day 1: Notifications sent. Reviewers see their queue in Entra portal / email link.
- Day 7: First reminder.
- Day 14: Second reminder. Escalation to manager-of-manager for non-responders.
- Day 21: Review closes. Decisions auto-applied.

### Reviewer guidance
For each user assigned a role:
1. Look at last activation date. If > 6 months → consider revoking.
2. Look at user's current job. Still in the role that needs this access?
3. Check audit log for recent activity. If silent → likely safe to remove.
4. If unsure → keep + ask the user.

### Post-review
- Generate compliance report. Send to CISO + auditors.
- Track metrics: % response rate, % revoked, % approved.
- Goal: response rate > 90%, revoked rate 5-15% per quarter.
- If response rate < 80%, intervene with managers.`,
    sortOrder: 13,
  },
  {
    slug: "migration-playbooks",
    title: "Migration Playbooks",
    category: "Migration",
    sourcePage: "migration-playbooks.html",
    summary: "Real-world migration playbooks with phased rollouts — VMware to Azure (200 VMs), SCCM to Intune, on-prem Exchange to Exchange Online, SSL VPN to ZTNA, SQL Server to Azure SQL Managed Instance, and M365 tenant-to-tenant M&A mergers.",
    bodyMarkdown: `# Migration Playbooks

Real-world migration projects with phased rollouts. Each playbook: scope, phases, gotchas, success criteria.

## VMware → Azure (200 VMs)

Lift-and-shift 200 production VMware VMs to Azure with minimum downtime.

**Duration:** 4-6 months · **Team:** 6-10 engineers · **Risk:** Medium · **Tools:** Azure Migrate, ASR, DMS

### Phase 1 — Discovery + Assessment (4 weeks)
1. Deploy Azure Migrate appliance in VMware vCenter. Wait 1-2 weeks to collect performance + dependency data.
2. Run readiness assessment per VM: Azure-ready (green), conditionally ready (amber), not ready (red).
3. Right-size: most VMs are over-provisioned on-prem. Azure Migrate suggests target VM SKU.
4. Cost estimate: monthly Azure run-rate + 1-yr / 3-yr Reservation projections.
5. Dependency map: which VMs talk to which? Group by application boundary.
6. Stakeholder briefing: present cost + readiness + timeline to app owners.

**Risk:** Dependency mapping miss 1 critical connection = production outage. Always validate with app owners + run network captures.
**Gotcha:** Linux VMs running custom kernels may need agent install before replication. Test on 1 per kernel version.

### Phase 2 — Foundation (landing zone) (3 weeks)
1. Deploy Azure landing zone (hub VNet + ER + Firewall + Bastion).
2. Configure ExpressRoute or VPN to on-prem.
3. Set up Backup vault + Recovery Services for ASR.
4. Identity: Entra Connect set up + DC promoted in Azure for AD-joined VMs.
5. Monitoring: Log Analytics workspace + Defender for Cloud enabled.
6. Apply Azure Policy initiative: tagging + region + SKU enforcement.

### Phase 3 — Pilot migration (5 VMs) (2 weeks)
1. Pick 5 low-risk VMs (1 web, 1 file, 1 DB, 1 app, 1 jump). Get app owner sign-off.
2. Install ASR mobility agent on each VM.
3. Replicate to Azure (continuous block-level sync, RPO ~1 min).
4. Schedule test failover (Azure isolated network — doesn't affect prod). Run app smoke tests.
5. After test pass: schedule cutover. Apps must be in maintenance mode (10-30 min downtime).
6. Cutover: ASR failover → DNS update → traffic shifts to Azure VM → uninstall on-prem.

**Gotcha:** Some apps have hardcoded IPs. Audit before migration; update to DNS names where possible.

### Phase 4 — Batched migration (5-10 VMs/week) (12 weeks)
1. Weekly batch: 5-10 VMs per Sat night maintenance window.
2. Pre-week: app owner sign-off + change ticket + comm plan.
3. During: cutover within agreed window. Rollback procedure documented.
4. Post-cutover Monday: app owner verification + sign-off.
5. Buffer: every 4 weeks, take a "no migration" week to address debt + retrospective.

**Risk:** Volume mistake: trying 30 VMs in one weekend. Disaster. Stick to 5-10 max, even if "easy" ones.

### Phase 5 — Post-migration optimisation (4 weeks)
1. Run cost analysis per VM. Right-size aggressively after 2 weeks of metrics.
2. Apply Reserved Instances on stable workloads.
3. Enable Azure Backup on all VMs. Configure retention per data class.
4. Enable Defender for Servers on all VMs.
5. Decommission on-prem VMware infrastructure once Azure proven stable for 30 days.

## SCCM → Intune (5000 devices)

Replace on-prem SCCM with cloud-managed Intune for 5000 Windows 11 endpoints.

**Duration:** 6-12 months · **Team:** 3-5 engineers · **Risk:** Medium · **Tools:** Intune, Autopilot, SCCM

### Phase 1 — Foundation (4 weeks)
1. Intune tenant provisioned + Entra ID Premium P1+ licensed for all users.
2. Configure Co-Management in SCCM: connect to Intune tenant.
3. Tenant Attach: upload SCCM device inventory to Intune for visibility.
4. Baseline policies: 1 compliance + 1 device config + 1 security baseline (don't assign yet).
5. Pilot group: 50 devices across IT team + power users.

### Phase 2 — Workload sliders pilot (4 weeks)
1. Start with safest workload: **Compliance policies** — flip slider to Intune for pilot group.
2. Watch for 2 weeks. Verify compliance reports populate. Resolve any non-compliance.
3. Next: **Device configuration** profiles. Migrate the 20 most-used GPO settings to Intune Settings Catalog.
4. Then: **Endpoint Protection** (Defender + ASR).
5. Then: **Resource access** (VPN + Wi-Fi profiles).
6. Then: **Client apps** (M365 Apps + LOB apps).
7. Finally: **Windows Update for Business**.
8. Each workload pilot for 2-4 weeks before next.

**Gotcha:** GPO Analytics report shows which on-prem GPO settings have Intune equivalents. Use this to plan migration scope.

### Phase 3 — Autopilot rollout (6 weeks)
1. Order new devices with Autopilot enrollment pre-baked at OEM.
2. Configure Autopilot profiles: User-driven mode, language, OOBE, ESP timeout 60 min.
3. Pilot: 10 new hires get Autopilot devices. Measure: time from unbox → productive (target: 4 hours).
4. Scale: all new devices via Autopilot. Existing devices stay co-managed.

### Phase 4 — Broad rollout (all 5000 devices) (12 weeks)
1. Per-workload rollout in rings: Ring 1 (200 IT/power users), Ring 2 (1000 corporate), Ring 3 (1000 frontline), Ring 4 (rest).
2. Each ring 2 weeks. Monitor support tickets weekly.
3. When ALL workload sliders are on Intune for ALL users for 30 days → device is "Intune-only".
4. Stop deploying new content from SCCM.

### Phase 5 — SCCM decommission (6 weeks)
1. Verify zero devices reporting to SCCM.
2. Migrate WSUS replacement: Windows Update for Business via Intune.
3. Migrate package source: re-package SCCM applications as Win32 apps in Intune.
4. Decommission SCCM site servers. Archive historic logs.
5. Cancel SCCM Software Assurance / licensing.

**Risk:** Custom SCCM apps (e.g. AutoIT scripts) may not translate cleanly to Win32. Plan re-packaging time.

## On-prem Exchange → Exchange Online (8000 mailboxes)

Cutover or hybrid migration of 8000 mailboxes (avg 25 GB) to Exchange Online.

**Duration:** 4-8 months · **Team:** 4-6 engineers · **Risk:** High · **Tools:** Hybrid Configuration Wizard, ExchangeMigration cmdlets

### Phase 1 — Hybrid deployment (6 weeks)
1. License M365 E3 / E5 for all users.
2. Run Hybrid Configuration Wizard from on-prem Exchange.
3. Configures: certs, public DNS, on-prem + EXO connectors.
4. Verify hybrid mail flow: send test mail in each direction (on-prem ↔ EXO).
5. Verify cross-org free/busy + delegation.

**Gotcha:** HCW often requires specific certificate names. Use SAN cert with mail.contoso.com + autodiscover.contoso.com.

### Phase 2 — Pilot migration (3 weeks)
1. Pilot 50 users: 1 each from each department, 1 admin, 1 senior, 1 with large mailbox (50+ GB).
2. Create migration endpoint (Remote move).
3. Create migration batch for pilot.
4. Monitor: each batch can take 6-72 hours depending on mailbox size.
5. After complete: user signs in to OWA, confirms mail flow, autodiscover works.

**Risk:** Large mailboxes (>100 GB) can take days. Set realistic expectations. Use Exchange Hybrid Pre-Migration Cleanup script first.

### Phase 3 — Batched migration (12 weeks)
1. 500-1000 users per week, scheduled in nightly batches.
2. Comm strategy: each user gets 48-hour notice of their migration window.
3. Autodiscover handles client redirection automatically.
4. Public folder migration: separate (Microsoft Tool, not HCW). Schedule WEEKEND-only.

### Phase 4 — MX cutover + decommission (4 weeks)
1. After ALL mailboxes migrated: update MX record to point to EXO directly.
2. Wait 7 days for DNS propagation.
3. Disable inbound on-prem mail flow connectors.
4. Decommission on-prem Exchange: uninstall the last Exchange server.
5. Keep AD Recipient Management tools (RBAC scope) for at least 90 days post-decommission.

**Risk:** Don't fully remove on-prem Exchange management while AD Connect is syncing — you lose RBAC scope. Microsoft now provides "Modern Exchange Hybrid" for management-only.

## Legacy SSL VPN → Zero Trust Network Access (50k users)

Replace SSL VPN with Entra Global Secure Access + Conditional Access per-app.

**Duration:** 6-9 months · **Team:** 3-4 engineers · **Risk:** High · **Tools:** Global Secure Access, Entra Connect, Defender

### Phase 1 — Discovery + Foundation (8 weeks)
1. Inventory all internal apps: catalogue 200-500 typical for a 50k-user org.
2. For each app: criticality, traffic type (web, RDP, SSH, native protocol), legacy auth or modern.
3. Provision Global Secure Access tenant + GSA Client deployment plan.
4. Configure Conditional Access policies per app: require compliant device + MFA + named location + risk-based.
5. Onboard Defender for Endpoint + Intune compliance.

### Phase 2 — Application proxy setup (6 weeks)
1. For modern web apps: configure Entra Application Proxy or Microsoft Entra Private Access.
2. For legacy apps: keep behind VPN (Phase 5 deals with this).
3. For RDP/SSH/native: use Microsoft Tunnel Gateway.
4. Test SSO + access from outside corp network for each app.
5. Configure Conditional Access for each app (custom CA per app).

### Phase 3 — Pilot users (1000) (8 weeks)
1. Pilot 1000 users: IT + a few business units.
2. Deploy GSA Client to pilot devices via Intune.
3. Users access pilot apps via GSA — same experience as VPN but with per-app access.
4. Compare experience: latency, reliability, UX. Monitor support tickets.

**Risk:** Branch-office users with poor internet may struggle. Test from branch offices first.

### Phase 4 — Broad rollout (50k users) (12 weeks)
1. Rollout in rings of 2500 users per week.
2. Each user: enrolled in Intune, compliant device, GSA Client installed.
3. VPN client still installed as backup. Users self-discover apps work without VPN.
4. Communicate: "VPN will be retired on [date]. Switch to GSA for these apps: [list]."

### Phase 5 — VPN decommission (8 weeks)
1. Verify all apps accessible via GSA.
2. Handle legacy apps (10-20 still on VPN): isolate them on a small VPN gateway just for those.
3. Decommission main VPN pool. Cancel VPN appliance licenses + maintenance.
4. Keep small "emergency" VPN for break-glass / 3rd-party contractor access.

**Risk:** Don't fully decommission VPN until 60+ days post-cutover. You will discover edge cases (a Mac user with a Linux VM that needs port 5900 to a specific server).

## On-prem SQL Server 2014 → Azure SQL Managed Instance (200 DBs)

Migrate 200 SQL Server 2014 databases (8 TB total) to Azure SQL Managed Instance.

**Duration:** 5-7 months · **Team:** 4 engineers · **Risk:** Medium · **Tools:** Azure Migrate, DMA, DMS

### Phase 1 — Discovery + Assessment (6 weeks)
1. Run Data Migration Assistant (DMA) on each DB. Report: SQL MI compatibility issues, breaking changes.
2. Common issues: cross-DB queries (allowed in MI), CLR (allowed but check version), deprecated features.
3. Performance benchmark each DB: current IOPS, throughput, query patterns.
4. Right-size: pick General Purpose vs Business Critical tier per DB.
5. Cost projection: Azure SQL MI vCore + storage + I/O.

### Phase 2 — Foundation (4 weeks)
1. Deploy SQL Managed Instance in target VNet (delegated subnet).
2. Configure Public Endpoint or Private Endpoint based on access pattern.
3. Set up failover group + read replicas if needed.
4. AAD authentication enabled on MI.
5. Long-term backup retention configured.

**Gotcha:** SQL MI takes 4-6 hours to provision. Plan for it.

### Phase 3 — Pilot migration (6 weeks)
1. Pilot 5 DBs: 1 simple, 1 with Agent jobs, 1 with cross-DB queries, 1 with replication, 1 large (500 GB+).
2. Use Azure DMS (Data Migration Service) for online migration (DBs stay online during sync).
3. Cutover window: <30 min. Run application smoke test before declaring success.

### Phase 4 — Batched migration (12 weeks)
1. Batch 5-10 DBs per weekend. Larger DBs separate.
2. Each batch: weekend window with rollback plan.
3. Application reconfiguration: connection strings updated. Test connectivity.
4. Monitor performance for 1 week before declaring done.

### Phase 5 — Post-migration optimisation (4 weeks)
1. Query Performance Insight: review top CPU queries weekly.
2. Apply Auto-tuning (force last good plan, create missing indexes).
3. Decommission on-prem SQL Server cluster after 60-day quiet period.
4. Cancel SQL Server licenses + maintenance contracts.

## Tenant-to-tenant M365 merger (M&A, 5000 + 3000 users)

Merge two M365 tenants over 6 months during corporate acquisition.

**Duration:** 6 months · **Team:** 6-8 engineers · **Risk:** Very high · **Tools:** Microsoft T2T, Quest On Demand, ShareGate

### Phase 1 — Pre-merger planning (4 weeks)
1. Decide target tenant (acquirer typically wins).
2. Inventory both tenants: users, groups, mailboxes, sites, Teams, licensing.
3. Identity strategy: cross-tenant access, B2B, or full migration.
4. Domain strategy: keep both? Combine? Subdomain?
5. Tooling decision: Microsoft T2T native vs Quest On Demand (paid).

### Phase 2 — Identity coexistence (6 weeks)
1. Set up Cross-Tenant Sync OR Entra Connect dual-tenant sync.
2. Provision shadow users in target tenant.
3. Configure SSO / federation if needed.
4. Test sign-in flows. Train helpdesk on dual-tenant patterns.

### Phase 3 — Mail flow + GAL coexistence (4 weeks)
1. Configure GALSync to unify Global Address Lists.
2. Mail forwarding: ensure mail to old domain still works.
3. Update SPF + DKIM + DMARC for combined domain (or both).

### Phase 4 — Data migration: pilot (4 weeks)
1. 50 users migrated as pilot: mailbox + OneDrive + Teams chats + SharePoint sites.
2. Validate each: data fidelity, permissions, links.
3. Communication strategy for affected users.

**Risk:** Cross-tenant migration of OneDrive can break SharePoint links. Test extensively.

### Phase 5 — Data migration: broad (12 weeks)
1. 500 users per week migrated.
2. Each migration: mailbox (Exchange Online tools), OneDrive (Microsoft T2T), Teams + SharePoint (Quest On Demand).
3. Old tenant data marked read-only after migration.
4. License rationalisation: combined seat count.

### Phase 6 — Source tenant decommission (8 weeks)
1. Verify zero active users in source tenant.
2. Final data archive (legal hold for retention).
3. Cancel source tenant subscription.
4. Update DNS to fully migrate any remaining services.

**Risk:** Don't cancel source tenant immediately — you may need it for audit / legal queries for 7+ years. Switch to a minimal subscription instead.`,
    sortOrder: 14,
  },
  {
    slug: "admin-cookbook",
    title: "Admin Cookbook",
    category: "Admin Playbook",
    sourcePage: "admin-cookbook.html",
    summary:
      "50+ daily admin tasks with copy-paste PowerShell, Az CLI, and portal steps spanning Identity, Azure resources, Storage, SQL, Networking, AKS, Backup, Exchange, Security, Cost, Automation, Intune, and AD DS.",
    bodyMarkdown: [
      "# Admin Cookbook",
      "",
      "50+ daily tasks every cloud admin needs. PowerShell + Az CLI + portal steps.",
      "",
      "## Identity",
      "",
      "### 1. Reset a user's password (2 min)",
      "**PowerShell (Microsoft Graph)**",
      "```powershell",
      "Connect-MgGraph -Scopes \"User.ReadWrite.All\"",
      "Update-MgUser -UserId \"user@cloudlab.in\" `",
      "  -PasswordProfile @{",
      "    Password = \"TempP@ssw0rd!\"",
      "    ForceChangePasswordNextSignIn = $true",
      "  }",
      "```",
      "**Portal:** Entra ID -> Users -> click user -> Reset password -> share temp password securely (Teams DM with self-destructing message).",
      "",
      "### 2. Unlock a locked-out user (1 min)",
      "**On-prem AD**",
      "```powershell",
      "Unlock-ADAccount -Identity \"tuser\"",
      "```",
      "**Entra ID (cloud):** Entra ID doesn't \"lock\" accounts; it applies smart lockout (10 wrong attempts -> 60-sec timeout per IP). Force re-MFA + revoke tokens:",
      "```powershell",
      "Revoke-MgUserSignInSession -UserId \"user@cloudlab.in\"",
      "# User signs in fresh + may need to re-register MFA",
      "```",
      "",
      "### 3. Add user to a security group (1 min)",
      "```powershell",
      "$group = Get-MgGroup -Filter \"displayName eq 'HR-Staff'\"",
      "$user = Get-MgUser -Filter \"userPrincipalName eq 'newhire@cloudlab.in'\"",
      "New-MgGroupMember -GroupId $group.Id -DirectoryObjectId $user.Id",
      "```",
      "",
      "### 4. Bulk assign a license to 50 users (5 min)",
      "```powershell",
      "$e5 = Get-MgSubscribedSku | Where SkuPartNumber -eq \"SPE_E5\"",
      "$users = Import-Csv .\\new-hires.csv",
      "$users | ForEach-Object {",
      "    Set-MgUserLicense -UserId $_.upn `",
      "        -AddLicenses @(@{ SkuId = $e5.SkuId }) `",
      "        -RemoveLicenses @()",
      "}",
      "```",
      "CSV format: `upn,displayname`",
      "",
      "### 5. Activate a PIM role (2 min)",
      "**Portal:** Open `aka.ms/myroles` -> Find role (e.g. Global Administrator) -> Activate -> Duration 1-8 hours, justification, ticket #, MFA challenge.",
      "**PowerShell**",
      "```powershell",
      "$myId = (Get-MgContext).Account; $me = (Get-MgUser -UserId $myId).Id",
      "New-MgRoleManagementDirectoryRoleAssignmentScheduleRequest -BodyParameter @{",
      "    Action = \"selfActivate\"",
      "    RoleDefinitionId = \"62e90394-69f5-4237-9190-012177145e10\"  # Global Admin",
      "    DirectoryScopeId = \"/\"",
      "    PrincipalId = $me",
      "    Justification = \"Weekly admin tasks per ticket TKT-1042\"",
      "    ScheduleInfo = @{ StartDateTime = (Get-Date); Expiration = @{ Type = \"AfterDuration\"; Duration = \"PT4H\" } }",
      "    LinkedRoleEligibilityScheduleId = (Get-MgRoleManagementDirectoryRoleEligibilitySchedule -Filter \"principalId eq '$me'\" | Where roleDefinitionId -eq \"62e90394-69f5-4237-9190-012177145e10\").Id",
      "}",
      "```",
      "",
      "### 6. Disable + offboard a leaver (5 min)",
      "```powershell",
      "# 1. Disable account",
      "Update-MgUser -UserId leaver@cloudlab.in -AccountEnabled:$false",
      "",
      "# 2. Revoke all tokens",
      "Revoke-MgUserSignInSession -UserId leaver@cloudlab.in",
      "",
      "# 3. Convert mailbox to Shared (preserves email for the team)",
      "Set-Mailbox leaver@cloudlab.in -Type Shared",
      "",
      "# 4. Grant Manager access to OneDrive",
      "Set-SPOUser -Site \"https://cloudlab-my.sharepoint.com/personal/leaver_cloudlab_in/\" `",
      "    -LoginName manager@cloudlab.in -IsSiteCollectionAdmin $true",
      "",
      "# 5. Remove all licenses",
      "Set-MgUserLicense -UserId leaver@cloudlab.in -AddLicenses @() `",
      "    -RemoveLicenses (Get-MgUserLicenseDetail -UserId leaver@cloudlab.in).SkuId",
      "```",
      "",
      "## Azure resources",
      "",
      "### 7. Stop / start / restart a VM (1 min)",
      "```bash",
      "# Stop (deallocate to stop billing)",
      "az vm deallocate -g rg-prod -n vm-app-01",
      "",
      "# Start",
      "az vm start -g rg-prod -n vm-app-01",
      "",
      "# Restart",
      "az vm restart -g rg-prod -n vm-app-01",
      "",
      "# Power state",
      "az vm get-instance-view -g rg-prod -n vm-app-01 --query instanceView.statuses[1] -o table",
      "```",
      "",
      "### 8. Resize a VM without losing data (5-10 min)",
      "```bash",
      "az vm resize -g rg-prod -n vm-app-01 --size Standard_D8s_v5",
      "# VM will restart automatically",
      "```",
      "Trade-offs: more vCPU/RAM. May change cost tier. Disk + IP retained. Resize fails if target size doesn't support same generation (Gen1/Gen2) or zone.",
      "",
      "### 9. Create a snapshot before a risky change (2 min)",
      "```powershell",
      "$disk = Get-AzVM -ResourceGroupName rg-prod -Name vm-app-01",
      "$diskId = $disk.StorageProfile.OsDisk.ManagedDisk.Id",
      "",
      "New-AzSnapshot -ResourceGroupName rg-prod `",
      "    -SnapshotName \"vm-app-01-pre-upgrade-$(Get-Date -Format yyyyMMdd)\" `",
      "    -Snapshot (New-AzSnapshotConfig -SourceUri $diskId -Location eastus2 -CreateOption Copy -SkuName Standard_LRS)",
      "```",
      "Snapshot lives in same Resource Group. Cost: incremental per GB. Restore: create new disk from snapshot + swap into VM.",
      "",
      "### 10. List my Azure spend this month (30 sec)",
      "```bash",
      "az consumption usage list --start-date $(date -u +%Y-%m-01) --end-date $(date -u +%Y-%m-%d) \\",
      "  --query '[].{Date:usageStart, Service:meterDetails.serviceName, RG:instanceName, Cost:pretaxCost}' \\",
      "  -o table",
      "```",
      "Better: Portal -> Cost Management + Billing -> Cost analysis. Group by Service / RG / Tag.",
      "",
      "### 11. Find orphan resources: unattached disks, empty RGs (5 min)",
      "```bash",
      "# Unattached disks (still costing $$$)",
      "az disk list --query \"[?managedBy==null].{name:name,rg:resourceGroup,sizeGB:diskSizeGB}\" -o table",
      "",
      "# Empty resource groups (JMESPath length() == 0)",
      "az group list --query \"[?length(resources)==\\`0\\`].name\" -o table",
      "",
      "# Stopped VMs (still billed if not deallocated!)",
      "az vm list -d --query \"[?powerState=='VM stopped'].{name:name,rg:resourceGroup}\" -o table",
      "",
      "# Public IPs not attached",
      "az network public-ip list --query \"[?ipConfiguration==null].{name:name,rg:resourceGroup,sku:sku.name}\" -o table",
      "```",
      "",
      "### 12. Tag every untagged resource with required tags (10 min)",
      "```bash",
      "# List untagged resources",
      "az resource list --query \"[?tags==null || !tags.Owner].{name:name,rg:resourceGroup,type:type}\" -o table",
      "",
      "# Bulk-tag all VMs with Environment + Owner",
      "az vm list --query \"[].id\" -o tsv | xargs -I{} az tag update --resource-id {} \\",
      "  --operation merge --tags Environment=Production Owner=platform@cloudlab.in",
      "```",
      "",
      "### 13. Add an NSG rule for HTTPS from a specific IP (2 min)",
      "```bash",
      "az network nsg rule create \\",
      "  --resource-group rg-prod \\",
      "  --nsg-name nsg-web \\",
      "  --name AllowHTTPS-from-MyIP \\",
      "  --priority 110 \\",
      "  --source-address-prefixes 203.0.113.42 \\",
      "  --destination-port-ranges 443 \\",
      "  --protocol Tcp \\",
      "  --access Allow",
      "```",
      "",
      "### 14. Check effective NSG rules on a VM's NIC (1 min)",
      "```bash",
      "az network nic list-effective-nsg --resource-group rg-prod --name nic-vm-app-01 -o json | jq",
      "```",
      "Or Portal: Network Watcher -> IP Flow Verify (simulates a packet) + Effective Security Rules (shows merged ruleset across NIC + Subnet NSGs).",
      "",
      "### 15. Find which CA policy is blocking a user (3 min)",
      "**Portal:** Entra ID -> Sign-in logs -> filter by user UPN + last 1 hour -> click the failed sign-in -> \"Conditional Access\" tab -> lists every policy evaluated + result (Success / Failure / Not applied) -> the one showing \"Failure\" is your culprit.",
      "**KQL (Sentinel)**",
      "```kql",
      "SigninLogs",
      "| where TimeGenerated > ago(1h)",
      "| where UserPrincipalName == \"user@cloudlab.in\"",
      "| where ResultType != 0",
      "| mv-expand ConditionalAccessPolicies",
      "| where ConditionalAccessPolicies.result == \"failure\"",
      "| project TimeGenerated, ResultType, ResultDescription,",
      "          PolicyName=tostring(ConditionalAccessPolicies.displayName),",
      "          PolicyResult=tostring(ConditionalAccessPolicies.result)",
      "```",
      "",
      "## Storage",
      "",
      "### 16. Upload a file to blob storage (1 min)",
      "```bash",
      "az storage blob upload \\",
      "  --account-name stmyaccount \\",
      "  --container uploads \\",
      "  --file ./report.pdf \\",
      "  --name report.pdf \\",
      "  --auth-mode login",
      "```",
      "",
      "### 17. Generate a SAS token for a blob (1 min)",
      "```bash",
      "# 24-hour read-only SAS",
      "az storage blob generate-sas \\",
      "  --account-name stmyaccount \\",
      "  --container-name uploads \\",
      "  --name report.pdf \\",
      "  --permissions r \\",
      "  --expiry $(date -u -d \"+1 day\" +\"%Y-%m-%dT%H:%MZ\") \\",
      "  --auth-mode login --as-user \\",
      "  --full-uri",
      "```",
      "",
      "### 18. Restore a soft-deleted blob (1 min)",
      "```bash",
      "# List soft-deleted blobs",
      "az storage blob list \\",
      "  --account-name stmyaccount --container uploads --include d \\",
      "  --query \"[?deleted].{name:name,deletedTime:deletedTime}\" -o table",
      "",
      "# Restore one",
      "az storage blob undelete \\",
      "  --account-name stmyaccount --container uploads --name deleted.pdf",
      "```",
      "",
      "### 19. Move a blob from Hot to Cool tier (30 sec)",
      "```bash",
      "az storage blob set-tier \\",
      "  --account-name stmyaccount \\",
      "  --container uploads \\",
      "  --name archive-2025.pdf \\",
      "  --tier Cool",
      "```",
      "Better: configure a lifecycle rule once + let Azure auto-tier based on age.",
      "",
      "### 20. Configure a storage account lifecycle rule (5 min)",
      "```bash",
      "az storage account management-policy create \\",
      "  --account-name stmyaccount \\",
      "  --policy '{",
      "    \"rules\": [{",
      "      \"enabled\": true,",
      "      \"name\": \"AgeOut\",",
      "      \"type\": \"Lifecycle\",",
      "      \"definition\": {",
      "        \"filters\": { \"blobTypes\": [\"blockBlob\"] },",
      "        \"actions\": {",
      "          \"baseBlob\": {",
      "            \"tierToCool\": { \"daysAfterModificationGreaterThan\": 30 },",
      "            \"tierToCold\": { \"daysAfterModificationGreaterThan\": 90 },",
      "            \"tierToArchive\": { \"daysAfterModificationGreaterThan\": 180 },",
      "            \"delete\": { \"daysAfterModificationGreaterThan\": 2555 }",
      "          }",
      "        }",
      "      }",
      "    }]",
      "  }'",
      "```",
      "",
      "## SQL DB",
      "",
      "### 21. Take a manual snapshot of a SQL DB (2 min)",
      "Azure SQL DB does continuous backup automatically. You can't take a \"manual snapshot\" but you can:",
      "```bash",
      "# 1. Create a database copy",
      "az sql db copy \\",
      "  --resource-group rg-prod --server sql-prod-001 --name PaymentsDB \\",
      "  --dest-resource-group rg-prod --dest-server sql-prod-001 \\",
      "  --dest-name PaymentsDB-pre-migration-$(date +%Y%m%d)",
      "",
      "# 2. Or use long-term retention for archival",
      "az sql db ltr-policy set \\",
      "  --resource-group rg-prod --server sql-prod-001 --name PaymentsDB \\",
      "  --weekly-retention P12W --monthly-retention P12M --yearly-retention P7Y --week-of-year 1",
      "```",
      "",
      "### 22. Point-in-time restore (15-30 min)",
      "```bash",
      "az sql db restore \\",
      "  --resource-group rg-prod --server sql-prod-001 \\",
      "  --name PaymentsDB \\",
      "  --dest-name PaymentsDB-restored \\",
      "  --time \"2026-05-19T10:00:00\"",
      "```",
      "Creates a new DB. The app must be re-pointed.",
      "",
      "### 23. Find top expensive queries / DTU consumers (2 min)",
      "Portal -> Azure SQL DB -> Query Performance Insight -> Top resource consuming queries -> CPU / Data IO / Log IO. Click each query to see its plan. Or T-SQL inside the DB:",
      "```sql",
      "SELECT TOP 10",
      "    LEFT(qt.text, 80) AS Query,",
      "    qs.execution_count,",
      "    qs.total_worker_time / 1000 AS CPU_ms,",
      "    qs.total_logical_reads,",
      "    qs.last_execution_time",
      "FROM sys.dm_exec_query_stats qs",
      "CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt",
      "ORDER BY qs.total_worker_time DESC",
      "```",
      "",
      "### 24. Add an Azure AD admin to a SQL DB (2 min)",
      "```bash",
      "az sql server ad-admin create \\",
      "  --resource-group rg-prod --server sql-prod-001 \\",
      "  --display-name \"DBA Team\" \\",
      "  --object-id $(az ad group show --group \"SQL-DBA-Prod\" --query id -o tsv)",
      "```",
      "",
      "## Networking",
      "",
      "### 25. Diagnose \"cannot reach VM\" with Network Watcher (2 min)",
      "```bash",
      "# IP flow verify - simulates a packet, tells you if it would be allowed",
      "az network watcher test-ip-flow \\",
      "  -g NetworkWatcherRG -n NetworkWatcher_eastus2 \\",
      "  --vm vm-app-01 --direction Inbound \\",
      "  --local 10.0.1.5:443 --remote 192.168.1.50:33333 --protocol TCP",
      "",
      "# Connection troubleshoot - end-to-end test",
      "az network watcher test-connectivity \\",
      "  --source-resource vm-app-01 --dest-resource vm-db-01 --dest-port 1433",
      "```",
      "",
      "### 26. Find which subnet a NIC is in (30 sec)",
      "```bash",
      "az network nic show -g rg-prod -n nic-vm-app-01 --query ipConfigurations[0].subnet.id -o tsv",
      "```",
      "",
      "### 27. Reset a VPN gateway (15 min)",
      "```bash",
      "az network vnet-gateway reset -g rg-prod -n vpn-gw-prod",
      "",
      "# Re-establish connection",
      "az network vpn-connection update -g rg-prod -n conn-on-prem --reset",
      "```",
      "Outage during reset ~5-10 min. Plan during a maintenance window.",
      "",
      "### 28. Add a route in a User Defined Route table (2 min)",
      "```bash",
      "az network route-table route create \\",
      "  --resource-group rg-prod \\",
      "  --route-table-name rt-spoke-prod \\",
      "  --name route-to-onprem \\",
      "  --address-prefix 192.168.0.0/16 \\",
      "  --next-hop-type VirtualAppliance \\",
      "  --next-hop-ip-address 10.10.1.4",
      "```",
      "",
      "## Containers + AKS",
      "",
      "### 29. Pull AKS credentials + verify (30 sec)",
      "```bash",
      "az aks get-credentials -g rg-prod -n aks-prod",
      "kubectl get nodes",
      "kubectl cluster-info",
      "```",
      "",
      "### 30. Scale a deployment (30 sec)",
      "```bash",
      "kubectl scale deployment payment-api --replicas=5",
      "# Watch rollout",
      "kubectl get pods -l app=payment-api -w",
      "```",
      "",
      "### 31. Roll back a deployment (1 min)",
      "```bash",
      "# See history",
      "kubectl rollout history deployment/payment-api",
      "",
      "# Roll back to previous revision",
      "kubectl rollout undo deployment/payment-api",
      "",
      "# Or to a specific revision",
      "kubectl rollout undo deployment/payment-api --to-revision=3",
      "",
      "kubectl rollout status deployment/payment-api",
      "```",
      "",
      "### 32. Find why a pod is failing (2 min)",
      "```bash",
      "# See pod state",
      "kubectl get pods",
      "",
      "# See events + recent details",
      "kubectl describe pod <pod-name>",
      "",
      "# See logs",
      "kubectl logs <pod-name>",
      "",
      "# Previous container (if crashed)",
      "kubectl logs <pod-name> --previous",
      "",
      "# Get events sorted by time",
      "kubectl get events --sort-by=.metadata.creationTimestamp -n <namespace>",
      "```",
      "",
      "### 33. Open a debug shell into a pod (30 sec)",
      "```bash",
      "kubectl exec -it <pod-name> -- /bin/bash",
      "# Or for alpine images",
      "kubectl exec -it <pod-name> -- /bin/sh",
      "",
      "# Run a debug pod alongside",
      "kubectl run debug --rm -it --image=busybox -- /bin/sh",
      "```",
      "",
      "## Backup + DR",
      "",
      "### 34. Trigger an ad-hoc VM backup (15-30 min)",
      "```bash",
      "az backup protection backup-now \\",
      "  --resource-group rg-backup \\",
      "  --vault-name rsv-prod \\",
      "  --container-name \"IaasVMContainer;iaasvmcontainerv2;rg-prod;vm-app-01\" \\",
      "  --item-name \"VM;iaasvmcontainerv2;rg-prod;vm-app-01\" \\",
      "  --backup-management-type AzureIaasVM \\",
      "  --retain-until $(date -u -d \"+30 days\" +\"%d-%m-%Y\")",
      "```",
      "",
      "### 35. Restore a single file from a VM backup (15 min)",
      "**Portal:** Recovery Services Vault -> Backup items -> click VM -> File recovery -> Mount disk script -> run the downloaded script on the target machine (it mounts the backup as a local drive) -> browse + copy the file you need -> run the unmount script when done.",
      "",
      "## M365 + Exchange",
      "",
      "### 36. Get a mailbox's size + send/receive history (2 min)",
      "```powershell",
      "Connect-ExchangeOnline -UserPrincipalName admin@cloudlab.in",
      "",
      "# Mailbox size",
      "Get-MailboxStatistics user@cloudlab.in | Select DisplayName, TotalItemSize, ItemCount",
      "",
      "# Message trace last 24h",
      "Get-MessageTrace -SenderAddress user@cloudlab.in `",
      "    -StartDate (Get-Date).AddDays(-1) -EndDate (Get-Date) `",
      "    | Select Received, Subject, Status, RecipientAddress",
      "```",
      "",
      "### 37. Convert a mailbox to Shared (1 min)",
      "```powershell",
      "Set-Mailbox user@cloudlab.in -Type Shared",
      "",
      "# Grant access to teammate",
      "Add-MailboxPermission -Identity user@cloudlab.in `",
      "    -User teammate@cloudlab.in -AccessRights FullAccess -AutoMapping $true",
      "```",
      "Shared mailbox is free up to 50 GB if the user has no license attached.",
      "",
      "### 38. Release a message from quarantine (1 min)",
      "**Portal:** Defender portal -> Email & collaboration -> Review -> Quarantine -> filter by sender / subject / received time -> click message -> Release -> (optional) add to Tenant Allow list to prevent future quarantine.",
      "**PowerShell**",
      "```powershell",
      "Get-QuarantineMessage -SenderAddress \"newsletter@safe-sender.com\" `",
      "    | Release-QuarantineMessage -ReleaseToAll",
      "```",
      "",
      "### 39. Set up forwarding, or block it tenant-wide (2 min)",
      "```powershell",
      "# Set forwarding for one user",
      "Set-Mailbox user@cloudlab.in -ForwardingAddress external@partner.com -DeliverToMailboxAndForward $true",
      "",
      "# Block ALL external forwarding (security best practice)",
      "New-RemoteDomain -Name \"BlockExternalForwarding\" -DomainName *.",
      "Set-RemoteDomain -Identity \"BlockExternalForwarding\" -AutoForwardEnabled $false",
      "```",
      "",
      "## Defender / Sentinel",
      "",
      "### 40. Isolate a compromised device via Defender XDR (1 min)",
      "**Portal:** Defender XDR (security.microsoft.com) -> Device inventory -> click the device -> Isolate device -> \"Full\" (vs \"Selective\" which allows Defender connectivity) -> document the reason in the audit log.",
      "**REST API**",
      "```text",
      "POST https://api.security.microsoft.com/api/machines/{id}/isolate",
      "  Authorization: Bearer <token>",
      "  Content-Type: application/json",
      "  Body: { \"Comment\": \"Suspected compromise - isolating\", \"IsolationType\": \"Full\" }",
      "```",
      "",
      "### 41. Quickly hunt for suspicious sign-ins with KQL (2 min)",
      "```kql",
      "// Top 10 failed sign-in IPs last 24h",
      "SigninLogs",
      "| where TimeGenerated > ago(24h)",
      "| where ResultType != 0",
      "| summarize FailedCount=count(), Users=dcount(UserPrincipalName) by IPAddress",
      "| top 10 by FailedCount desc",
      "",
      "// Sign-ins from new countries for high-value users",
      "SigninLogs",
      "| where TimeGenerated > ago(7d)",
      "| where UserPrincipalName in ('ceo@cloudlab.in', 'cfo@cloudlab.in')",
      "| where Location !in ('IN', 'US')",
      "```",
      "",
      "## Cost + Billing",
      "",
      "### 42. Set up a cost alert for a subscription (5 min)",
      "**Portal:** Cost Management + Billing -> Budgets -> + Add -> Scope: subscription. Amount: $500/month. Reset: monthly -> Threshold alerts: 80% (warning), 100% (critical) -> Email contacts: cost-alerts@cloudlab.in + your boss.",
      "**CLI**",
      "```bash",
      "az consumption budget create \\",
      "  --budget-name MonthlyBudget --amount 500 \\",
      "  --category Cost --time-grain Monthly \\",
      "  --time-period start-date=$(date -u +%Y-%m-01) \\",
      "  --notifications threshold=80 contact-emails=admin@itbd.net operator=GreaterThan",
      "```",
      "",
      "### 43. Generate a cost-per-tag report (5 min)",
      "Portal -> Cost analysis -> Group by: Tag -> add tag name (e.g., CostCenter / Environment / Project). Filter to current month. Export as CSV.",
      "",
      "## PowerShell + automation",
      "",
      "### 44. Schedule a runbook to auto-shutdown dev VMs at 7pm IST (15 min)",
      "```powershell",
      "# Automation Account -> Runbooks -> Create new PowerShell",
      "",
      "$vms = Get-AzVM | Where-Object {$_.Tags[\"Environment\"] -eq \"Dev\"}",
      "foreach ($vm in $vms) {",
      "    Write-Output \"Stopping $($vm.Name)\"",
      "    Stop-AzVM -ResourceGroupName $vm.ResourceGroupName -Name $vm.Name -Force",
      "}",
      "",
      "# Save + Publish",
      "# Then: Schedules -> Add schedule -> daily 7:00 PM IST -> Link to runbook",
      "```",
      "",
      "### 45. Find resources missing required tags (3 min)",
      "```bash",
      "# All resources missing Environment OR Owner tag",
      "az graph query -q \"",
      "  resources",
      "  | where isempty(tags.Environment) or isempty(tags.Owner)",
      "  | project name, type, resourceGroup, location, tags",
      "\" --first 100",
      "```",
      "",
      "## Intune",
      "",
      "### 46. Sync a device manually (30 sec)",
      "**Portal:** Intune -> Devices -> click device -> Sync.",
      "**PowerShell (Graph)**",
      "```powershell",
      "$device = Get-MgDeviceManagementManagedDevice -Filter \"deviceName eq 'LAPTOP-001'\"",
      "Sync-MgDeviceManagementManagedDevice -ManagedDeviceId $device.Id",
      "```",
      "",
      "### 47. Wipe a lost/stolen device (1 min)",
      "```powershell",
      "$device = Get-MgDeviceManagementManagedDevice -Filter \"deviceName eq 'LAPTOP-LOST'\"",
      "",
      "# Full wipe (factory reset)",
      "Invoke-MgWipeDeviceManagementManagedDevice -ManagedDeviceId $device.Id `",
      "    -KeepEnrollmentData $false -KeepUserData $false",
      "",
      "# Selective wipe (only corporate data, leaves personal data)",
      "Invoke-MgRetireDeviceManagementManagedDevice -ManagedDeviceId $device.Id",
      "```",
      "",
      "### 48. Find devices not compliant + why (2 min)",
      "```powershell",
      "Get-MgDeviceManagementManagedDevice -Filter \"complianceState eq 'noncompliant'\" `",
      "    -Top 50 | Select DeviceName, OperatingSystem, ComplianceState, JailBroken, LastSyncDateTime",
      "```",
      "Drill into a device: Portal -> Devices -> click device -> Device compliance -> see each rule + value.",
      "",
      "## AD DS / Server admin",
      "",
      "### 49. Force AD replication between DCs (1 min)",
      "```powershell",
      "# All DCs replicate everything",
      "repadmin /syncall /APed",
      "",
      "# Replicate one specific DC from another",
      "repadmin /sync dc02.corp.cloudlab.local dc01 (default-naming-context)",
      "```",
      "",
      "### 50. Test domain controller health (2 min)",
      "```powershell",
      "# Comprehensive DC test",
      "dcdiag /v /e /test:Replications /test:DNS /test:Services",
      "",
      "# Quick repadmin status",
      "repadmin /replsummary",
      "repadmin /showrepl",
      "```",
      "",
      "## Bonus high-value tasks",
      "",
      "### 51. Find who created a particular Azure resource (1 min)",
      "```bash",
      "# Activity log shows who created what",
      "az monitor activity-log list \\",
      "  --resource-id \"/subscriptions/.../resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-app-01\" \\",
      "  --query \"[?operationName.localizedValue=='Create or Update Virtual Machine'].{Caller:caller, Time:eventTimestamp, Status:status.value}\" \\",
      "  -o table",
      "```",
      "",
      "### 52. Test if a port is open from another VM (30 sec)",
      "```bash",
      "# Network Watcher (no SSH needed)",
      "az network watcher test-connectivity \\",
      "  --source-resource vm-app-01 \\",
      "  --dest-address api.example.com --dest-port 443",
      "",
      "# Inside the VM",
      "# Linux:",
      "nc -zv api.example.com 443",
      "# Windows:",
      "Test-NetConnection api.example.com -Port 443",
      "```",
      "",
      "### 53. List resources costing > $X / month (2 min)",
      "Portal -> Cost Management -> Cost analysis -> Sort by Cost descending. Filter to current month. Or via Resource Graph:",
      "```bash",
      "az graph query -q \"",
      "  costmanagementqueryresults",
      "  | where properties.columns has 'Cost'",
      "\" --first 100",
      "```",
      "",
      "### 54. Find recently-modified blobs (2 min)",
      "```bash",
      "az storage blob list \\",
      "  --account-name stmyaccount \\",
      "  --container uploads \\",
      "  --query \"[?properties.lastModified > '2026-05-19T00:00:00'].[name,properties.lastModified,properties.contentLength]\" \\",
      "  -o table \\",
      "  --auth-mode login",
      "```",
    ].join("\n"),
    sortOrder: 15,
  },
  {
    slug: "cli-reference",
    title: "CLI Reference",
    category: "CLI Reference",
    sourcePage: "cli-reference.html",
    summary:
      "Copy-paste CLI cheat sheets for Azure CLI, Cisco IOS, Palo Alto, FortiGate, kubectl, Helm, Git, and Linux admin essentials.",
    bodyMarkdown: [
      "# CLI Reference",
      "",
      "Production-ready CLI cheat sheets for Azure CLI, Cisco IOS, Palo Alto, FortiGate, kubectl, Helm, Git, Linux admin.",
      "",
      "## Azure CLI (az)",
      "Install: `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash` OR `winget install Microsoft.AzureCLI`",
      "",
      "### Login + context",
      "Sign in + switch subscriptions.",
      "```bash",
      "# Interactive sign-in (browser opens)",
      "az login",
      "",
      "# Sign in as service principal",
      "az login --service-principal -u <app-id> -p <password> --tenant <tenant-id>",
      "",
      "# List subscriptions",
      "az account list -o table",
      "",
      "# Set active subscription",
      "az account set -s \"CloudLab-Prod\"",
      "",
      "# Show current context",
      "az account show",
      "```",
      "",
      "### Resource Groups",
      "Create, list, delete.",
      "```bash",
      "# Create RG",
      "az group create -n rg-prod-network -l eastus2 --tags Env=Prod Owner=ankit",
      "",
      "# List RGs",
      "az group list -o table",
      "",
      "# Delete RG (and everything in it)",
      "az group delete -n rg-prod-network --yes --no-wait",
      "",
      "# List resources in RG",
      "az resource list -g rg-prod-network -o table",
      "```",
      "",
      "### VMs",
      "VM lifecycle.",
      "```bash",
      "# List VMs",
      "az vm list -o table",
      "",
      "# Start / Stop / Restart",
      "az vm start --name vm-prod-01 -g rg-prod",
      "az vm deallocate --name vm-prod-01 -g rg-prod",
      "az vm restart --name vm-prod-01 -g rg-prod",
      "",
      "# Resize",
      "az vm resize --name vm-prod-01 -g rg-prod --size Standard_D8s_v5",
      "",
      "# Run shell command on VM",
      "az vm run-command invoke -g rg-prod -n vm-prod-01 --command-id RunShellScript --scripts \"df -h\"",
      "```",
      "",
      "### Network",
      "VNet, NSG, Public IP.",
      "```bash",
      "# Create VNet + subnet",
      "az network vnet create -g rg-prod -n vnet-prod --address-prefix 10.0.0.0/16 --subnet-name web --subnet-prefix 10.0.1.0/24",
      "",
      "# Create NSG + rule",
      "az network nsg create -g rg-prod -n nsg-web",
      "az network nsg rule create -g rg-prod --nsg-name nsg-web -n AllowHTTPS --priority 100 --source-address-prefixes \"*\" --destination-port-ranges 443 --access Allow --protocol Tcp",
      "",
      "# Effective routes (debug)",
      "az network nic show-effective-route-table -g rg-prod -n nic-prod-01",
      "```",
      "",
      "### Storage",
      "Storage account + blob ops.",
      "```bash",
      "# Create storage account",
      "az storage account create -n stcloudlabprod -g rg-prod -l eastus2 --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2",
      "",
      "# Get connection string",
      "az storage account show-connection-string -n stcloudlabprod -g rg-prod -o tsv",
      "",
      "# Upload blob",
      "az storage blob upload --account-name stcloudlabprod -c uploads -f ./data.csv -n data.csv --auth-mode login",
      "",
      "# List blobs",
      "az storage blob list --account-name stcloudlabprod -c uploads --auth-mode login -o table",
      "```",
      "",
      "### AKS + Kubernetes",
      "Cluster ops.",
      "```bash",
      "# Create cluster",
      "az aks create -g rg-prod -n aks-prod --node-count 3 --enable-managed-identity --node-vm-size Standard_D4s_v5 --network-plugin azure --network-plugin-mode overlay --pod-cidr 10.244.0.0/16",
      "",
      "# Get credentials (kubeconfig)",
      "az aks get-credentials -g rg-prod -n aks-prod",
      "",
      "# Scale",
      "az aks scale -g rg-prod -n aks-prod --node-count 5",
      "",
      "# Upgrade",
      "az aks upgrade -g rg-prod -n aks-prod --kubernetes-version 1.30.0",
      "",
      "# Attach ACR (grant AcrPull to kubelet)",
      "az aks update -g rg-prod -n aks-prod --attach-acr acrprod",
      "```",
      "",
      "## Cisco IOS / IOS-XE",
      "Install: console / SSH access to router/switch.",
      "",
      "### Modes + navigation",
      "Move between privilege levels.",
      "```text",
      "# User EXEC mode (>)",
      "enable                          # become privileged (#)",
      "",
      "# Privileged EXEC mode (#)",
      "configure terminal              # enter global config",
      "",
      "# Global config (config)#",
      "interface gi0/0",
      "  ip address 10.0.0.1 255.255.255.0",
      "  no shutdown",
      "",
      "end                             # back to privileged",
      "write memory                    # save config to NVRAM",
      "```",
      "",
      "### Show commands (always start here)",
      "Diagnostic.",
      "```text",
      "show running-config             # current config",
      "show startup-config             # saved config",
      "show ip interface brief         # interface status one-liner",
      "show interface gi0/0            # detailed interface",
      "show ip route                   # routing table",
      "show ip route ospf              # only OSPF routes",
      "show ip bgp summary             # BGP peer status",
      "show ip bgp                     # BGP table",
      "show vlan brief                 # switch VLAN summary",
      "show spanning-tree              # STP state",
      "show mac address-table          # MAC table",
      "show cdp neighbors detail       # neighbour discovery",
      "show version                    # IOS version + uptime",
      "```",
      "",
      "### Switch config (access port + trunk)",
      "Layer 2.",
      "```text",
      "vlan 10",
      "  name Data",
      "vlan 20",
      "  name Voice",
      "vlan 30",
      "  name Guest",
      "",
      "# Access port for end-host",
      "interface gi0/1",
      "  switchport mode access",
      "  switchport access vlan 10",
      "  switchport voice vlan 20      # Voice VLAN auto-tag for IP phones",
      "  spanning-tree portfast",
      "  spanning-tree bpduguard enable",
      "",
      "# Trunk port to another switch",
      "interface gi0/24",
      "  switchport mode trunk",
      "  switchport trunk encapsulation dot1q",
      "  switchport trunk allowed vlan 10,20,30,99",
      "```",
      "",
      "### OSPF",
      "Single + multi-area config.",
      "```text",
      "router ospf 1",
      "  router-id 10.0.0.1",
      "  network 10.0.0.0 0.0.0.255 area 0",
      "  network 10.0.1.0 0.0.0.255 area 1",
      "  passive-interface default",
      "  no passive-interface gi0/0",
      "",
      "# Verify",
      "show ip ospf neighbor",
      "show ip ospf database",
      "show ip route ospf",
      "```",
      "",
      "### BGP",
      "eBGP to ISP.",
      "```text",
      "router bgp 65001",
      "  neighbor 198.51.100.1 remote-as 64500    # ISP A",
      "  neighbor 198.51.100.1 password Secret123",
      "  neighbor 198.51.100.1 prefix-list ALLOW_OUT out",
      "  network 203.0.113.0 mask 255.255.255.0   # advertise our /24",
      "",
      "ip prefix-list ALLOW_OUT seq 10 permit 203.0.113.0/24",
      "",
      "# Verify",
      "show ip bgp summary",
      "show ip bgp neighbors 198.51.100.1 routes",
      "show ip bgp 0.0.0.0",
      "```",
      "",
      "### ACL",
      "Access control list.",
      "```text",
      "# Extended ACL - allow HTTPS in",
      "ip access-list extended INBOUND",
      "  permit tcp any host 10.0.0.10 eq 443",
      "  permit icmp any host 10.0.0.10",
      "  deny ip any any log",
      "",
      "# Apply to interface",
      "interface gi0/0",
      "  ip access-group INBOUND in",
      "```",
      "",
      "### NAT (PAT for outbound internet)",
      "Many-to-one NAT.",
      "```text",
      "# Inside interface",
      "interface gi0/1",
      "  ip nat inside",
      "",
      "# Outside interface",
      "interface gi0/0",
      "  ip nat outside",
      "",
      "# NAT pool + ACL",
      "ip access-list standard INTERNAL",
      "  permit 10.0.0.0 0.255.255.255",
      "",
      "ip nat inside source list INTERNAL interface gi0/0 overload",
      "",
      "# Verify",
      "show ip nat translations",
      "```",
      "",
      "### Troubleshooting",
      "Common debug commands.",
      "```text",
      "ping 8.8.8.8",
      "traceroute 8.8.8.8",
      "",
      "# Detailed packet trace (CAREFUL on prod)",
      "debug ip ospf events",
      "debug ip bgp updates",
      "undebug all                       # always undo!",
      "",
      "# Reload / reboot",
      "reload",
      "reload in 10                      # in 10 minutes (cancel-able if you lose access)",
      "```",
      "",
      "## Palo Alto Networks (PAN-OS)",
      "Install: CLI `ssh admin@firewall`. Web UI `https://firewall/`",
      "",
      "### Operational + configuration modes",
      "Like Cisco, but with set/edit hierarchical syntax.",
      "```text",
      "# Operational mode (>)",
      "show system info",
      "show interface all",
      "",
      "# Configuration mode (#)",
      "configure",
      "  set deviceconfig system hostname firewall-01",
      "  commit",
      "  exit",
      "```",
      "",
      "### Security policy",
      "L7 policy.",
      "```text",
      "# Allow web traffic from internal to internet",
      "set rulebase security rules Allow-Web from internal to external",
      "set rulebase security rules Allow-Web source any destination any application web-browsing application ssl",
      "set rulebase security rules Allow-Web service application-default action allow",
      "set rulebase security rules Allow-Web log-end yes",
      "",
      "commit",
      "```",
      "",
      "### NAT",
      "Source NAT for outbound.",
      "```text",
      "set rulebase nat rules SNAT-Outbound from internal to external",
      "set rulebase nat rules SNAT-Outbound source 10.0.0.0/8 destination any",
      "set rulebase nat rules SNAT-Outbound translated-source dynamic-ip-and-port interface-address interface ethernet1/1",
      "",
      "commit",
      "```",
      "",
      "### IPSec VPN site-to-site",
      "To another Palo / Cisco.",
      "```text",
      "# IKE Gateway",
      "set network ike gateway VPN-Peer1 protocol ikev2 authentication pre-shared-key key Secret123",
      "set network ike gateway VPN-Peer1 protocol ikev2 ike-crypto-profile default",
      "set network ike gateway VPN-Peer1 local-address ip 198.51.100.1",
      "set network ike gateway VPN-Peer1 peer-address ip 203.0.113.1",
      "",
      "# IPsec Tunnel",
      "set network ipsec tunnel VPN-Tunnel1 auto-key ike-gateway VPN-Peer1",
      "set network ipsec tunnel VPN-Tunnel1 auto-key ipsec-crypto-profile default",
      "",
      "# Tunnel interface",
      "set network interface tunnel units tunnel.1 ip 10.255.0.1/30",
      "",
      "# Route to peer",
      "set network virtual-router default routing-table ip static-route Site-B destination 10.20.0.0/16",
      "set network virtual-router default routing-table ip static-route Site-B nexthop next-vr tunnel.1",
      "```",
      "",
      "### Useful show / debug",
      "Operational queries.",
      "```text",
      "show session all                    # all sessions",
      "show session id 12345                # one session detail",
      "show interface ethernet1/1",
      "show routing route",
      "show vpn ike-sa                      # IKE SA (Phase 1)",
      "show vpn ipsec-sa                    # IPsec SA (Phase 2)",
      "",
      "tail follow yes mp-log ikemgr.log    # IKE debug live",
      "less mp-log ikemgr.log               # IKE log historical",
      "```",
      "",
      "## FortiGate (FortiOS)",
      "Install: CLI `ssh admin@firewall`. Web UI `https://firewall/`",
      "",
      "### Modes",
      "Different from Cisco.",
      "```text",
      "config global                  # global config",
      "config vdom                    # virtual domain",
      "  edit root",
      "  config system interface",
      "    edit port1",
      "      set ip 10.0.0.1 255.255.255.0",
      "      set allowaccess ping ssh https",
      "    next",
      "  end",
      "end",
      "```",
      "",
      "### Firewall policy",
      "Allow web from inside to internet.",
      "```text",
      "config firewall policy",
      "  edit 1",
      "    set name \"Allow-Inside-to-Outside\"",
      "    set srcintf \"internal\"",
      "    set dstintf \"wan1\"",
      "    set srcaddr \"all\"",
      "    set dstaddr \"all\"",
      "    set action accept",
      "    set schedule \"always\"",
      "    set service \"HTTPS\"",
      "    set utm-status enable",
      "    set logtraffic all",
      "    set nat enable",
      "  next",
      "end",
      "```",
      "",
      "### Show commands",
      "Diagnostic.",
      "```text",
      "get system status              # version, uptime",
      "get system interface           # all interfaces",
      "get router info routing-table all",
      "get firewall policy            # all policies",
      "",
      "diagnose sniffer packet any \"host 10.0.0.10\" 4   # tcpdump-like",
      "diagnose debug flow filter daddr 8.8.8.8        # flow trace",
      "diagnose debug enable",
      "diagnose debug disable",
      "",
      "execute traceroute 8.8.8.8",
      "```",
      "",
      "### IPSec VPN",
      "Phase 1 + Phase 2.",
      "```text",
      "config vpn ipsec phase1-interface",
      "  edit \"vpn-site-b\"",
      "    set interface \"wan1\"",
      "    set ike-version 2",
      "    set local-gw 198.51.100.1",
      "    set peertype any",
      "    set proposal aes256-sha256",
      "    set remote-gw 203.0.113.1",
      "    set psksecret Secret123",
      "  next",
      "end",
      "",
      "config vpn ipsec phase2-interface",
      "  edit \"vpn-site-b-p2\"",
      "    set phase1name \"vpn-site-b\"",
      "    set proposal aes256-sha256",
      "    set src-subnet 10.0.0.0 255.255.0.0",
      "    set dst-subnet 10.20.0.0 255.255.0.0",
      "  next",
      "end",
      "```",
      "",
      "## kubectl",
      "Install: `az aks install-cli` OR `curl -LO \"https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl\"`",
      "",
      "### Context + config",
      "Connect to a cluster.",
      "```bash",
      "# AKS",
      "az aks get-credentials -g rg-prod -n aks-prod",
      "",
      "# List contexts",
      "kubectl config get-contexts",
      "",
      "# Switch context",
      "kubectl config use-context aks-prod",
      "",
      "# Current context",
      "kubectl config current-context",
      "```",
      "",
      "### Basic resource queries",
      "Get / describe / explain.",
      "```bash",
      "kubectl get pods                          # in current namespace",
      "kubectl get pods -A                       # all namespaces",
      "kubectl get pods -n kube-system",
      "kubectl get pods -o wide                  # show IPs + nodes",
      "kubectl get pods --watch                  # live updates",
      "",
      "kubectl describe pod <pod-name>           # full details + events",
      "",
      "kubectl explain pod.spec.containers       # docs for a field",
      "",
      "# Get all resources in a namespace",
      "kubectl get all -n production",
      "```",
      "",
      "### Logs + exec",
      "Debug inside pods.",
      "```bash",
      "kubectl logs <pod>                        # current container",
      "kubectl logs <pod> -c <container>         # if multi-container pod",
      "kubectl logs <pod> --previous             # previous crashed container",
      "kubectl logs <pod> --tail=100 --follow    # tail like tail -f",
      "",
      "kubectl exec -it <pod> -- /bin/bash       # interactive shell",
      "kubectl exec <pod> -- ls /var/log",
      "```",
      "",
      "### Apply + delete",
      "CRUD.",
      "```bash",
      "kubectl apply -f deployment.yaml          # create or update",
      "kubectl apply -f ./manifests/             # apply all files in dir",
      "",
      "kubectl delete -f deployment.yaml",
      "kubectl delete deployment my-app",
      "",
      "# Scale a deployment",
      "kubectl scale deployment my-app --replicas=5",
      "```",
      "",
      "### Rollout",
      "Update + rollback.",
      "```bash",
      "# Set new image",
      "kubectl set image deployment/my-app my-app=acr.io/my-app:v2",
      "",
      "kubectl rollout status deployment/my-app",
      "kubectl rollout history deployment/my-app",
      "kubectl rollout undo deployment/my-app    # rollback to previous",
      "kubectl rollout undo deployment/my-app --to-revision=3",
      "```",
      "",
      "### Debug commands",
      "Common fixes.",
      "```bash",
      "# Get events sorted by time",
      "kubectl get events --sort-by=.metadata.creationTimestamp",
      "",
      "# Resource usage",
      "kubectl top node",
      "kubectl top pod -A",
      "",
      "# Port-forward to local",
      "kubectl port-forward pod/my-pod 8080:80",
      "kubectl port-forward svc/my-service 8080:80",
      "",
      "# Quick debug pod",
      "kubectl run debug --rm -it --image=busybox -- /bin/sh",
      "```",
      "",
      "## Helm",
      "Install: `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash`",
      "",
      "### Repo management",
      "Add charts.",
      "```bash",
      "# Add a repo",
      "helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx",
      "helm repo add bitnami https://charts.bitnami.com/bitnami",
      "",
      "# Update local cache",
      "helm repo update",
      "",
      "# Search for a chart",
      "helm search repo nginx",
      "```",
      "",
      "### Install + upgrade",
      "Deploy charts.",
      "```bash",
      "# Install a chart",
      "helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace",
      "",
      "# Install with custom values",
      "helm install my-app ./charts/my-app -f values.prod.yaml",
      "",
      "# Upgrade",
      "helm upgrade my-app ./charts/my-app -f values.prod.yaml",
      "",
      "# Install or upgrade (idempotent)",
      "helm upgrade --install my-app ./charts/my-app -f values.prod.yaml",
      "",
      "# Rollback",
      "helm rollback my-app 1",
      "```",
      "",
      "### Inspect + debug",
      "See what would be applied.",
      "```bash",
      "# List installed releases",
      "helm list -A",
      "",
      "# Get values for a release",
      "helm get values my-app",
      "",
      "# Render templates locally (dry run)",
      "helm template my-app ./charts/my-app -f values.prod.yaml",
      "",
      "# Lint a chart",
      "helm lint ./charts/my-app",
      "",
      "# Uninstall",
      "helm uninstall my-app",
      "```",
      "",
      "## Git",
      "Install: `apt-get install git` OR `brew install git` OR `winget install Git.Git`",
      "",
      "### Initial setup",
      "One-time config.",
      "```bash",
      "git config --global user.name \"Alex Johnson\"",
      "git config --global user.email \"admin@itbd.net\"",
      "git config --global init.defaultBranch main",
      "git config --global pull.rebase false        # or true if you prefer rebase",
      "",
      "# SSH key setup (one-time)",
      "ssh-keygen -t ed25519 -C \"admin@itbd.net\"",
      "cat ~/.ssh/id_ed25519.pub                    # add to GitHub / GitLab",
      "```",
      "",
      "### Daily commands",
      "Clone, commit, push.",
      "```bash",
      "git clone https://github.com/user/repo.git",
      "git status",
      "git add .                                   # stage all changes",
      "git add path/to/file                        # stage specific",
      "git commit -m \"feat: add login flow\"",
      "git push origin main",
      "",
      "# Pull latest from remote",
      "git pull",
      "",
      "# See history",
      "git log --oneline --graph --all -20",
      "```",
      "",
      "### Branching",
      "Feature workflow.",
      "```bash",
      "# Create + switch to new branch",
      "git checkout -b feature/login",
      "# OR (newer syntax)",
      "git switch -c feature/login",
      "",
      "# List branches",
      "git branch -a",
      "",
      "# Switch back",
      "git switch main",
      "",
      "# Merge feature back",
      "git merge feature/login",
      "",
      "# Delete branch",
      "git branch -d feature/login                  # safe (only if merged)",
      "git branch -D feature/login                  # force",
      "```",
      "",
      "### Fixing mistakes",
      "Undo operations.",
      "```bash",
      "# Unstage a file",
      "git restore --staged file.txt",
      "",
      "# Discard local changes (DANGER)",
      "git restore file.txt",
      "",
      "# Amend last commit (before pushing)",
      "git commit --amend -m \"better message\"",
      "",
      "# Reset to a previous commit (DANGER if pushed)",
      "git reset --hard HEAD~1                     # remove last commit + changes",
      "git reset --soft HEAD~1                     # remove commit but keep changes staged",
      "",
      "# Revert a commit (safe, creates new commit)",
      "git revert <commit-hash>",
      "```",
      "",
      "### Rebase + interactive",
      "Clean up history.",
      "```bash",
      "# Rebase feature on latest main",
      "git switch feature/login",
      "git rebase main",
      "",
      "# Interactive rebase last 5 commits (squash, reword, drop)",
      "git rebase -i HEAD~5",
      "",
      "# Resolve conflicts during rebase",
      "# Edit files, then:",
      "git add .",
      "git rebase --continue",
      "```",
      "",
      "## Linux admin essentials",
      "Install: pre-installed on most distros. Use Bash or Zsh.",
      "",
      "### File operations",
      "Daily file commands.",
      "```bash",
      "ls -la                              # list with detail",
      "pwd                                 # print working dir",
      "cd /var/log",
      "mkdir -p path/to/dir",
      "rm -rf path                         # DANGER",
      "cp src dst                          # copy",
      "cp -r srcdir dstdir",
      "mv src dst                          # move/rename",
      "find / -name \"*.log\" -mtime +30     # find files older than 30 days",
      "du -sh /var/log                     # disk usage of dir",
      "```",
      "",
      "### Process + system",
      "See what is running.",
      "```bash",
      "ps auxf                             # tree of processes",
      "top                                 # live process view",
      "htop                                # better top (if installed)",
      "",
      "systemctl status nginx",
      "systemctl restart nginx",
      "systemctl enable nginx              # start on boot",
      "",
      "journalctl -u nginx -n 100 -f       # last 100 lines + follow",
      "```",
      "",
      "### Network",
      "Connectivity + ports.",
      "```bash",
      "ip addr show                        # all interfaces",
      "ip route show",
      "ss -tlnp                            # listening TCP + processes",
      "ss -an | head -50                   # all connections",
      "",
      "curl -v https://api.example.com     # verbose HTTP",
      "curl -L -o file.tar.gz https://...",
      "",
      "dig example.com",
      "dig example.com MX                  # mail records",
      "dig +trace example.com              # full delegation trace",
      "```",
      "",
      "### Log search",
      "Find errors.",
      "```bash",
      "tail -f /var/log/syslog             # follow live",
      "tail -n 200 /var/log/auth.log       # last 200 lines",
      "",
      "grep \"ERROR\" /var/log/app.log",
      "grep -i \"error\" /var/log/app.log    # case insensitive",
      "grep -A 5 \"ERROR\" /var/log/app.log  # 5 lines after match",
      "grep -B 5 \"ERROR\" /var/log/app.log  # 5 lines before",
      "",
      "# Combine pipes",
      "tail -10000 app.log | grep ERROR | wc -l",
      "```",
      "",
      "### Permissions",
      "chmod + chown.",
      "```bash",
      "# View permissions",
      "ls -la file",
      "# -rwxr-xr-x   1 user group   ...",
      "#  ^^^         owner",
      "#     ^^^      group",
      "#        ^^^   other",
      "",
      "chmod 755 file                      # rwx r-x r-x",
      "chmod +x script.sh                  # add execute",
      "chmod -R 644 dir                    # recursive",
      "",
      "chown user:group file",
      "chown -R nginx:nginx /var/www/html",
      "```",
    ].join("\n"),
    sortOrder: 16,
  },
  {
    slug: "powershell-cheatsheets",
    title: "PowerShell Cheat Sheets",
    category: "PowerShell",
    sourcePage: "powershell-cheatsheets.html",
    summary: "Copy-paste PowerShell snippets across seven Microsoft toolsets — Az, Microsoft Graph, ExchangeOnline, ActiveDirectory, Intune (via Graph), Defender for Endpoint (REST API), and Sentinel — covering connect/auth, core CRUD, and common ops for each.",
    bodyMarkdown: [
      "# PowerShell Cheat Sheets",
      "",
      "Copy-paste snippets for Az, Microsoft Graph, ExchangeOnline, ActiveDirectory, Intune, Defender, Sentinel. Production-ready, no fluff.",
      "",
      "## Az PowerShell (Azure)",
      "",
      "Install: `Install-Module Az -Scope CurrentUser -Force`",
      "",
      "### Connect + context",
      "",
      "Sign in interactively, set subscription context, see what you are connected to.",
      "",
      "```powershell",
      "# Sign in (browser pop-up)",
      "Connect-AzAccount",
      "",
      "# Sign in via Service Principal",
      "$cred = Get-Credential   # username = AppId",
      "Connect-AzAccount -ServicePrincipal -Credential $cred -Tenant <tenant-id>",
      "",
      "# Set context",
      "Set-AzContext -Subscription \"CloudLab-Prod\"",
      "",
      "# Show current context",
      "Get-AzContext",
      "",
      "# List subscriptions",
      "Get-AzSubscription",
      "```",
      "",
      "### Resource Group + Resources",
      "",
      "Create, list, delete resource groups + query resources.",
      "",
      "```powershell",
      "# Create resource group",
      "New-AzResourceGroup -Name \"rg-prod-network\" -Location \"eastus2\" -Tag @{ Environment=\"Prod\"; Owner=\"admin@itbd.net\" }",
      "",
      "# List all resource groups",
      "Get-AzResourceGroup | Format-Table ResourceGroupName, Location",
      "",
      "# List resources in a RG",
      "Get-AzResource -ResourceGroupName \"rg-prod-network\" | Format-Table Name, ResourceType, Location",
      "",
      "# Delete RG (and everything in it!)",
      "Remove-AzResourceGroup -Name \"rg-prod-network\" -Force",
      "```",
      "",
      "### Virtual Machines",
      "",
      "Common VM lifecycle commands.",
      "",
      "```powershell",
      "# List VMs",
      "Get-AzVM | Format-Table Name, ResourceGroupName, Location, PowerState",
      "",
      "# Start / Stop / Restart",
      "Start-AzVM -Name vm-prod-01 -ResourceGroupName rg-prod",
      "Stop-AzVM -Name vm-prod-01 -ResourceGroupName rg-prod -Force   # deallocate",
      "Restart-AzVM -Name vm-prod-01 -ResourceGroupName rg-prod",
      "",
      "# Resize VM",
      "$vm = Get-AzVM -Name vm-prod-01 -ResourceGroupName rg-prod",
      "$vm.HardwareProfile.VmSize = \"Standard_D8s_v5\"",
      "Update-AzVM -VM $vm -ResourceGroupName rg-prod",
      "",
      "# Run script on VM",
      "Invoke-AzVMRunCommand -ResourceGroupName rg-prod -VMName vm-prod-01 -CommandId RunPowerShellScript -ScriptPath ./script.ps1",
      "```",
      "",
      "### Networking",
      "",
      "VNet, NSG, Public IP basics.",
      "",
      "```powershell",
      "# Create VNet + subnet",
      "$subnet = New-AzVirtualNetworkSubnetConfig -Name web -AddressPrefix 10.0.1.0/24",
      "$vnet = New-AzVirtualNetwork -Name vnet-prod -ResourceGroupName rg-prod -Location eastus2 -AddressPrefix 10.0.0.0/16 -Subnet $subnet",
      "",
      "# Create NSG rule",
      "$rule = New-AzNetworkSecurityRuleConfig -Name AllowHTTPS -Description \"Allow 443\" -Access Allow -Protocol Tcp -Direction Inbound -Priority 100 -SourceAddressPrefix \"*\" -SourcePortRange \"*\" -DestinationAddressPrefix \"*\" -DestinationPortRange 443",
      "New-AzNetworkSecurityGroup -ResourceGroupName rg-prod -Location eastus2 -Name nsg-web -SecurityRules $rule",
      "",
      "# Effective routes (debugging)",
      "Get-AzEffectiveRouteTable -NetworkInterfaceName nic-prod-01 -ResourceGroupName rg-prod",
      "```",
      "",
      "### Storage",
      "",
      "Storage accounts + blob operations.",
      "",
      "```powershell",
      "# Create storage account",
      "New-AzStorageAccount -Name \"stcloudlabprod\" -ResourceGroupName rg-prod -Location eastus2 -SkuName Standard_LRS -Kind StorageV2 -EnableHttpsTrafficOnly $true -MinimumTlsVersion TLS1_2",
      "",
      "# Get connection string",
      "$ctx = (Get-AzStorageAccount -ResourceGroupName rg-prod -Name stcloudlabprod).Context",
      "",
      "# Upload blob",
      "Set-AzStorageBlobContent -File \"./data.csv\" -Container \"uploads\" -Blob \"data.csv\" -Context $ctx",
      "",
      "# List blobs",
      "Get-AzStorageBlob -Container \"uploads\" -Context $ctx",
      "```",
      "",
      "### Cost analysis",
      "",
      "Query costs programmatically.",
      "",
      "```powershell",
      "# Current month spend",
      "Get-AzConsumptionUsageDetail -BillingPeriodName 202605 | Group-Object -Property ConsumedService | Select-Object Name, @{N=\"Cost\";E={[math]::Round((($_.Group.PretaxCost | Measure-Object -Sum).Sum), 2)}}",
      "",
      "# Cost by RG (last month)",
      "$start = (Get-Date).AddMonths(-1).ToString(\"yyyy-MM-01\")",
      "$end = (Get-Date).ToString(\"yyyy-MM-01\")",
      "Get-AzConsumptionUsageDetail -StartDate $start -EndDate $end | Group-Object -Property InstanceName",
      "```",
      "",
      "## Microsoft Graph PowerShell",
      "",
      "Install: `Install-Module Microsoft.Graph -Scope CurrentUser`",
      "",
      "### Connect + scopes",
      "",
      "Sign in with required scopes.",
      "",
      "```powershell",
      "# Interactive sign-in (consent on first use)",
      "Connect-MgGraph -Scopes \"User.Read.All\", \"Group.ReadWrite.All\", \"Directory.Read.All\"",
      "",
      "# Sign in as service principal (app-only)",
      "Connect-MgGraph -ClientId \"<app-id>\" -TenantId \"<tenant-id>\" -CertificateThumbprint \"ABC123...\"",
      "",
      "# Disconnect",
      "Disconnect-MgGraph",
      "",
      "# Current context + scopes",
      "Get-MgContext",
      "```",
      "",
      "### Users",
      "",
      "Create, list, update, delete users.",
      "",
      "```powershell",
      "# Get user",
      "Get-MgUser -UserId \"admin@itbd.net\"",
      "",
      "# List users with filter",
      "Get-MgUser -Filter \"Department eq 'Engineering'\" -Top 50",
      "",
      "# Create user",
      "$password = @{ Password = \"Welcome01!\"; ForceChangePasswordNextSignIn = $true }",
      "New-MgUser -DisplayName \"Test User\" -GivenName \"Test\" -Surname \"User\" -UserPrincipalName \"test.user@cloudlab.in\" -MailNickname \"testuser\" -AccountEnabled -PasswordProfile $password -UsageLocation \"IN\"",
      "",
      "# Update user",
      "Update-MgUser -UserId \"test.user@cloudlab.in\" -Department \"Sales\"",
      "",
      "# Reset password",
      "Update-MgUser -UserId \"test.user@cloudlab.in\" -PasswordProfile @{ Password = \"NewP@ssw0rd!\"; ForceChangePasswordNextSignIn = $true }",
      "",
      "# Disable user",
      "Update-MgUser -UserId \"test.user@cloudlab.in\" -AccountEnabled:$false",
      "",
      "# List manager",
      "Get-MgUserManager -UserId \"admin@itbd.net\"",
      "```",
      "",
      "### Groups",
      "",
      "Manage M365 + security groups.",
      "",
      "```powershell",
      "# Create M365 group",
      "New-MgGroup -DisplayName \"Finance Team\" -MailEnabled -MailNickname \"finance\" -SecurityEnabled:$false -GroupTypes @(\"Unified\")",
      "",
      "# Add member",
      "$user = Get-MgUser -Filter \"userPrincipalName eq 'test.user@cloudlab.in'\"",
      "$group = Get-MgGroup -Filter \"displayName eq 'Finance Team'\"",
      "New-MgGroupMember -GroupId $group.Id -DirectoryObjectId $user.Id",
      "",
      "# List members",
      "Get-MgGroupMember -GroupId $group.Id",
      "",
      "# Remove member",
      "Remove-MgGroupMemberByRef -GroupId $group.Id -DirectoryObjectId $user.Id",
      "```",
      "",
      "### Conditional Access",
      "",
      "List + audit CA policies.",
      "",
      "```powershell",
      "# List all CA policies",
      "Get-MgIdentityConditionalAccessPolicy | Format-Table DisplayName, State, CreatedDateTime",
      "",
      "# Export policy as JSON",
      "Get-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId \"abc-123\" | ConvertTo-Json -Depth 10 | Out-File ./ca-backup.json",
      "",
      "# Find policies that affect a specific user (What-If)",
      "# Use Graph API: POST /identity/conditionalAccess/evaluate",
      "```",
      "",
      "### Licenses",
      "",
      "Assign / remove licenses.",
      "",
      "```powershell",
      "# List available SKUs",
      "Get-MgSubscribedSku | Format-Table SkuPartNumber, ConsumedUnits, @{N=\"Available\";E={$_.PrepaidUnits.Enabled - $_.ConsumedUnits}}",
      "",
      "# Assign E5 license",
      "$e5 = Get-MgSubscribedSku -All | Where-Object SkuPartNumber -EQ \"SPE_E5\"",
      "Set-MgUserLicense -UserId \"admin@itbd.net\" -AddLicenses @(@{SkuId = $e5.SkuId}) -RemoveLicenses @()",
      "",
      "# Remove license",
      "Set-MgUserLicense -UserId \"admin@itbd.net\" -AddLicenses @() -RemoveLicenses @($e5.SkuId)",
      "```",
      "",
      "## ExchangeOnline (M365 Mail)",
      "",
      "Install: `Install-Module ExchangeOnlineManagement -Scope CurrentUser`",
      "",
      "### Connect",
      "",
      "Sign in to Exchange Online.",
      "",
      "```powershell",
      "# Interactive (MFA prompt in browser)",
      "Connect-ExchangeOnline -UserPrincipalName admin@cloudlab.in",
      "",
      "# Service Principal",
      "Connect-ExchangeOnline -AppId \"<app-id>\" -CertificateThumbprint \"ABC...\" -Organization \"cloudlab.onmicrosoft.com\"",
      "",
      "# Disconnect",
      "Disconnect-ExchangeOnline -Confirm:$false",
      "```",
      "",
      "### Mailboxes",
      "",
      "Manage mailboxes.",
      "",
      "```powershell",
      "# Get mailbox",
      "Get-Mailbox -Identity admin@itbd.net | Format-List DisplayName, *Quota*, IssueWarningQuota, ProhibitSendQuota, ProhibitSendReceiveQuota",
      "",
      "# Set mailbox quotas",
      "Set-Mailbox -Identity admin@itbd.net -IssueWarningQuota 45GB -ProhibitSendQuota 49GB -ProhibitSendReceiveQuota 50GB",
      "",
      "# Enable archive",
      "Enable-Mailbox -Identity admin@itbd.net -Archive",
      "",
      "# List inactive mailboxes",
      "Get-Mailbox -InactiveMailboxOnly",
      "",
      "# Convert to shared mailbox",
      "Set-Mailbox -Identity former.employee@cloudlab.in -Type Shared",
      "```",
      "",
      "### Mail flow / Transport rules",
      "",
      "Configure mail flow.",
      "",
      "```powershell",
      "# List transport rules",
      "Get-TransportRule | Format-Table Name, State, Mode, Priority",
      "",
      "# Create rule: append disclaimer to external mail",
      "New-TransportRule -Name \"External Disclaimer\" -SentToScope NotInOrganization -ApplyHtmlDisclaimerLocation Append -ApplyHtmlDisclaimerText \"<p>This message is from Ankit CloudLab. Confidential.</p>\"",
      "",
      "# List connectors",
      "Get-InboundConnector | Format-Table Name, Enabled, ConnectorType",
      "Get-OutboundConnector | Format-Table Name, Enabled, ConnectorType",
      "```",
      "",
      "### Anti-spam / Anti-phish",
      "",
      "Manage Defender for Office 365 policies.",
      "",
      "```powershell",
      "# Anti-spam",
      "Get-HostedContentFilterPolicy | Format-Table Name, EnableLanguageBlockList, SpamAction, HighConfidenceSpamAction",
      "",
      "# Anti-phish",
      "Get-AntiPhishPolicy | Format-Table Name, Enabled, EnableMailboxIntelligence, ImpersonationProtectionState",
      "",
      "# Safe Links policy",
      "Get-SafeLinksPolicy | Format-Table Name, EnableSafeLinksForEmail, ScanUrls, DeliverMessageAfterScan",
      "",
      "# Quarantine messages",
      "Get-QuarantineMessage -StartReceivedDate (Get-Date).AddDays(-7) -Type Phish | Format-Table Subject, SenderAddress, ReceivedTime",
      "```",
      "",
      "### eDiscovery + Holds",
      "",
      "Manage compliance holds.",
      "",
      "```powershell",
      "# Litigation hold",
      "Set-Mailbox -Identity user@cloudlab.in -LitigationHoldEnabled $true -LitigationHoldDuration 2555",
      "",
      "# In-Place hold (legacy)",
      "New-MailboxSearch -Name \"Investigation_Q1\" -SourceMailboxes user1@cloudlab.in,user2@cloudlab.in -StartDate \"2026-01-01\" -EndDate \"2026-03-31\" -InPlaceHoldEnabled $true",
      "```",
      "",
      "## ActiveDirectory (on-prem)",
      "",
      "Install: `Add-WindowsFeature RSAT-AD-PowerShell` on Win Server, or RSAT on Windows 11.",
      "",
      "### Users",
      "",
      "AD user lifecycle.",
      "",
      "```powershell",
      "# Get user",
      "Get-ADUser -Identity \"admin\" -Properties DisplayName, Department, MemberOf, LockedOut, LastLogonDate",
      "",
      "# Create user",
      "New-ADUser -Name \"Test User\" -GivenName \"Test\" -Surname \"User\" -SamAccountName \"tuser\" -UserPrincipalName \"tuser@corp.cloudlab.local\" -Path \"OU=Users,DC=corp,DC=cloudlab,DC=local\" -AccountPassword (ConvertTo-SecureString \"Welcome01!\" -AsPlainText -Force) -Enabled $true -ChangePasswordAtLogon $true",
      "",
      "# Unlock account",
      "Unlock-ADAccount -Identity \"tuser\"",
      "",
      "# Reset password",
      "Set-ADAccountPassword -Identity \"tuser\" -NewPassword (ConvertTo-SecureString \"NewP@ss!\" -AsPlainText -Force) -Reset",
      "",
      "# Disable + move",
      "Disable-ADAccount -Identity \"tuser\"",
      "Move-ADObject -Identity \"CN=Test User,OU=Users,DC=corp,DC=cloudlab,DC=local\" -TargetPath \"OU=Disabled,DC=corp,DC=cloudlab,DC=local\"",
      "```",
      "",
      "### Groups",
      "",
      "Group management.",
      "",
      "```powershell",
      "# Create group",
      "New-ADGroup -Name \"HR-Staff\" -GroupCategory Security -GroupScope Global -Path \"OU=Groups,DC=corp,DC=cloudlab,DC=local\"",
      "",
      "# Add member",
      "Add-ADGroupMember -Identity \"HR-Staff\" -Members \"tuser\"",
      "",
      "# Recursively list nested members",
      "Get-ADGroupMember -Identity \"HR-Staff\" -Recursive",
      "",
      "# Audit: users with no group",
      "Get-ADUser -Filter * -Properties MemberOf | Where-Object { $_.MemberOf.Count -le 1 }",
      "```",
      "",
      "### GPO",
      "",
      "Group Policy management.",
      "",
      "```powershell",
      "Import-Module GroupPolicy",
      "",
      "# List GPOs",
      "Get-GPO -All | Format-Table DisplayName, GpoStatus, CreationTime, ModificationTime",
      "",
      "# Create + link GPO",
      "$gpo = New-GPO -Name \"ScreenLock-5min\"",
      "New-GPLink -Name $gpo.DisplayName -Target \"OU=Workstations,DC=corp,DC=cloudlab,DC=local\" -LinkEnabled Yes -Order 1",
      "",
      "# Set GPO setting",
      "Set-GPRegistryValue -Name \"ScreenLock-5min\" -Key \"HKCU\\Control Panel\\Desktop\" -ValueName \"ScreenSaveTimeOut\" -Type String -Value \"300\"",
      "",
      "# RSoP for a computer",
      "Get-GPResultantSetOfPolicy -Computer DC01 -ReportType Html -Path \"C:\\temp\\rsop.html\"",
      "```",
      "",
      "### FSMO + Replication",
      "",
      "Forest-level operations.",
      "",
      "```powershell",
      "# Show FSMO role holders",
      "netdom query fsmo",
      "",
      "# Transfer FSMO role",
      "Move-ADDirectoryServerOperationMasterRole -Identity \"DC02\" -OperationMasterRole PDCEmulator,RIDMaster,InfrastructureMaster",
      "",
      "# Replication status",
      "repadmin /showrepl",
      "repadmin /replsummary",
      "",
      "# Force replication",
      "repadmin /syncall /APed",
      "```",
      "",
      "### Diagnostics",
      "",
      "Common troubleshooting commands.",
      "",
      "```powershell",
      "# DC diagnostics",
      "dcdiag /v /e /test:DNS /test:Replications",
      "",
      "# Time sync check",
      "w32tm /monitor",
      "w32tm /query /status",
      "",
      "# Trust enumeration",
      "nltest /dclist:corp.cloudlab.local",
      "netdom query trust",
      "",
      "# Sysvol replication (DFS-R)",
      "dfsrdiag pollad /verbose",
      "dfsrdiag backlog /rgname:\"Domain System Volume\" /rfname:\"SYSVOL Share\" /smem:DC01 /rmem:DC02",
      "```",
      "",
      "## Intune via Graph",
      "",
      "Endpoint Manager has no dedicated module; use Microsoft.Graph.Beta.DeviceManagement.",
      "",
      "### Connect + scopes",
      "",
      "Graph scopes needed for Intune ops.",
      "",
      "```powershell",
      "Connect-MgGraph -Scopes \"DeviceManagementManagedDevices.ReadWrite.All\", \"DeviceManagementConfiguration.ReadWrite.All\", \"DeviceManagementApps.ReadWrite.All\", \"Directory.Read.All\"",
      "```",
      "",
      "### Devices",
      "",
      "Inventory + actions on managed devices.",
      "",
      "```powershell",
      "# List managed devices",
      "Get-MgDeviceManagementManagedDevice -All | Select-Object DeviceName, OperatingSystem, ComplianceState, LastSyncDateTime",
      "",
      "# Sync a device (force compliance check)",
      "$device = Get-MgDeviceManagementManagedDevice -Filter \"deviceName eq 'LAPTOP-001'\"",
      "Sync-MgDeviceManagementManagedDevice -ManagedDeviceId $device.Id",
      "",
      "# Wipe device",
      "$device | Invoke-MgDataActionDeviceManagementManagedDeviceWipe -KeepEnrollmentData $false -KeepUserData $false",
      "",
      "# Selective wipe (just corporate data, MAM)",
      "# Use App Protection Policy wipe via Graph beta",
      "```",
      "",
      "### Compliance + Configuration",
      "",
      "List policies and assignments.",
      "",
      "```powershell",
      "# List compliance policies",
      "Get-MgDeviceManagementDeviceCompliancePolicy | Format-Table DisplayName, \"@odata.type\"",
      "",
      "# List configuration policies",
      "Get-MgDeviceManagementDeviceConfiguration | Format-Table DisplayName, \"@odata.type\"",
      "",
      "# Get devices in compliance/non-compliance",
      "Get-MgDeviceManagementManagedDevice -Filter \"complianceState eq 'noncompliant'\" | Select-Object DeviceName, OperatingSystem",
      "```",
      "",
      "### Apps",
      "",
      "Manage mobile + Win32 apps.",
      "",
      "```powershell",
      "# List apps",
      "Get-MgDeviceAppManagementMobileApp | Format-Table DisplayName, \"@odata.type\", PublishingState",
      "",
      "# Get app assignments",
      "Get-MgDeviceAppManagementMobileAppAssignment -MobileAppId \"app-id\"",
      "```",
      "",
      "## Defender for Endpoint (M365 Defender API)",
      "",
      "Defender uses REST API. PowerShell wraps it via custom functions or modules.",
      "",
      "### Authenticate",
      "",
      "Get a token to call Defender APIs.",
      "",
      "```powershell",
      "# Get OAuth2 token",
      "$tenantId = \"<tenant-id>\"",
      "$appId = \"<app-id>\"",
      "$appSecret = \"<secret>\"",
      "$body = @{",
      "    resource = \"https://api.security.microsoft.com\"",
      "    client_id = $appId",
      "    client_secret = $appSecret",
      "    grant_type = \"client_credentials\"",
      "}",
      "$token = (Invoke-RestMethod -Method Post -Uri \"https://login.microsoftonline.com/$tenantId/oauth2/token\" -Body $body).access_token",
      "$headers = @{ Authorization = \"Bearer $token\" }",
      "```",
      "",
      "### Devices + Alerts",
      "",
      "Query Defender XDR data.",
      "",
      "```powershell",
      "# List devices",
      "$devices = (Invoke-RestMethod -Method Get -Uri \"https://api.security.microsoft.com/api/machines\" -Headers $headers).value",
      "$devices | Select-Object computerDnsName, osPlatform, lastSeen, riskScore, healthStatus",
      "",
      "# List alerts",
      "$alerts = (Invoke-RestMethod -Method Get -Uri \"https://api.security.microsoft.com/api/alerts\" -Headers $headers).value",
      "$alerts | Select-Object alertCreationTime, severity, status, title, category | Sort-Object alertCreationTime -Descending",
      "```",
      "",
      "### Live Response",
      "",
      "Run live commands on devices.",
      "",
      "```powershell",
      "# Get machine ID",
      "$machine = (Invoke-RestMethod -Method Get -Uri \"https://api.security.microsoft.com/api/machines?\\$filter=computerDnsName eq 'LAPTOP-001'\" -Headers $headers).value[0]",
      "",
      "# Isolate machine",
      "$body = @{ Comment = \"Suspected compromise — isolating\"; IsolationType = \"Full\" } | ConvertTo-Json",
      "Invoke-RestMethod -Method Post -Uri \"https://api.security.microsoft.com/api/machines/$($machine.id)/isolate\" -Headers $headers -Body $body -ContentType \"application/json\"",
      "",
      "# Release from isolation",
      "Invoke-RestMethod -Method Post -Uri \"https://api.security.microsoft.com/api/machines/$($machine.id)/unisolate\" -Headers $headers -Body $body -ContentType \"application/json\"",
      "```",
      "",
      "### Advanced Hunting",
      "",
      "Run KQL queries programmatically.",
      "",
      "```powershell",
      "$query = @\"",
      "DeviceProcessEvents",
      "| where Timestamp > ago(24h)",
      "| where InitiatingProcessFileName == \"outlook.exe\"",
      "| where FileName == \"powershell.exe\"",
      "| project Timestamp, DeviceName, AccountName, ProcessCommandLine",
      "\"@",
      "",
      "$body = @{ Query = $query } | ConvertTo-Json",
      "$result = Invoke-RestMethod -Method Post -Uri \"https://api.security.microsoft.com/api/advancedhunting/run\" -Headers $headers -Body $body -ContentType \"application/json\"",
      "$result.Results",
      "```",
      "",
      "## Sentinel via Az PowerShell",
      "",
      "Az.SecurityInsights manages Sentinel workspace + rules + incidents.",
      "",
      "### Connect + workspace context",
      "",
      "Set the workspace.",
      "",
      "```powershell",
      "Connect-AzAccount",
      "$ws = \"law-sentinel-prod\"",
      "$rg = \"rg-sec\"",
      "$wsId = (Get-AzOperationalInsightsWorkspace -Name $ws -ResourceGroupName $rg).CustomerId",
      "```",
      "",
      "### Incidents",
      "",
      "List + update incidents.",
      "",
      "```powershell",
      "# List incidents",
      "Get-AzSentinelIncident -ResourceGroupName $rg -WorkspaceName $ws | Where-Object Status -EQ \"New\" | Format-Table Number, Title, Severity, CreatedTimeUtc",
      "",
      "# Close incident",
      "Update-AzSentinelIncident -ResourceGroupName $rg -WorkspaceName $ws -Id \"<incident-id>\" -Status Closed -Classification TruePositive -ClassificationComment \"Confirmed phishing, user disabled.\"",
      "```",
      "",
      "### Analytics rules",
      "",
      "Manage detection rules.",
      "",
      "```powershell",
      "# List rules",
      "Get-AzSentinelAlertRule -ResourceGroupName $rg -WorkspaceName $ws | Format-Table DisplayName, Kind, Enabled",
      "",
      "# Enable / disable",
      "Update-AzSentinelAlertRule -ResourceGroupName $rg -WorkspaceName $ws -RuleId \"<rule-id>\" -Enabled $false",
      "```",
      "",
      "### KQL query",
      "",
      "Run KQL against the workspace.",
      "",
      "```powershell",
      "# Run a saved KQL query",
      "Invoke-AzOperationalInsightsQuery -WorkspaceId $wsId -Query @\"",
      "SigninLogs",
      "| where ResultType != 0",
      "| summarize count() by IPAddress",
      "| top 10 by count_",
      "\"@",
      "```",
    ].join("\n"),
    sortOrder: 17,
  },
  {
    slug: "architectures",
    title: "Reference Architectures",
    category: "Architecture",
    sourcePage: "architectures.html",
    summary: "12 canonical Azure/Microsoft reference architectures (landing zone, hub-spoke, AKS production, Zero Trust, multi-region DR, hybrid identity, AVD, AI Foundry RAG, SOC stack, storage tiering, FinOps, M365 tenant) with ASCII diagrams, component tables, and trade-offs.",
    bodyMarkdown: [
      "# Reference Architectures",
      "",
      "12 canonical architecture patterns with ASCII diagrams, component breakdowns, when-to-use guidance, and trade-offs. Each pattern below was rendered from a JS data object (`ARCHS`) on the original page — tab name, title, subtitle, an ASCII diagram, and one or more sections (a two-column component table, a callout, or plain text).",
      "",
      "## Azure Enterprise-Scale Landing Zone",
      "",
      "*Pattern for organizations adopting Azure at scale (50+ subscriptions). Based on Cloud Adoption Framework.*",
      "",
      "```",
      "                      Root MG",
      "                         |",
      "            +------------+------------+",
      "            |                         |",
      "        Platform MG            Landing Zones MG",
      "            |                         |",
      "    +-------+-------+         +-------+-------+",
      "    |       |       |         |       |       |",
      "  Identity Mgmt  Connectivity Corp  Online  Sandbox",
      "   sub-id  sub-mg   sub-net  app subs ...  dev/test",
      "    |       |       |         |",
      "  Entra   Sentinel  Hub VNet  App Spoke",
      "  Connect  Log An   Firewall  vNet (peered)",
      "   ADDS   Cost mgmt ExpressRt  AKS / VM / DB",
      "          Backup    VPN GW     App-team owned",
      "                    Bastion",
      "```",
      "",
      "### Management Group hierarchy",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Root MG | Tenant root. Applies tag policy + minimal global Audit policies. |",
      "| Platform MG | Shared services. Has Identity, Management, Connectivity sub-MGs. |",
      "| Identity sub-MG | Contains the identity-platform subscription: Entra Connect VMs, AD DS hybrid joins. |",
      "| Management sub-MG | Contains shared ops sub: Log Analytics, Sentinel, Automation, Backup Vault. |",
      "| Connectivity sub-MG | Contains the hub VNet sub: Firewall, ExpressRoute, VPN Gateway, Bastion, DNS. |",
      "| Landing Zones MG | Application workloads. Has Corp + Online sub-MGs. |",
      "| Corp sub-MG | Internal-facing workloads connected via the hub VNet. |",
      "| Online sub-MG | Internet-facing workloads with their own perimeter. |",
      "| Sandbox MG | Free experimentation. Strict Policy: no peering to Corp. |",
      "",
      "### Why this pattern",
      "",
      "**Separation of concerns:** Platform team owns hub + identity + ops. App teams own their landing zones. Policies inherit DOWN; deviations require exemption with a paper trail.",
      "",
      "**Scale story:** Adding 50 new apps = 50 new spoke subs auto-provisioned via Bicep + auto-peered to hub. No new IAM or Firewall config needed for the path itself.",
      "",
      "**Single pane of glass:** All monitoring + cost + security flows up to Platform MG. Boss sees Azure spend at root level; team-leads see their landing zone.",
      "",
      "## Classic Hub-Spoke Network Topology",
      "",
      "*Shared services in hub, workloads in spokes. Most common Azure network pattern.*",
      "",
      "```",
      "                       on-prem (10.0.0.0/16)",
      "                              |",
      "                       ExpressRoute / VPN",
      "                              |",
      "               +==============HUB VNet (10.10.0.0/16)===============+",
      "               |    GatewaySubnet (10.10.0.0/27)                     |",
      "               |    AzureFirewallSubnet (10.10.1.0/26)               |",
      "               |    AzureBastionSubnet (10.10.2.0/26)                |",
      "               |    AzureFirewallManagementSubnet (10.10.3.0/26)     |",
      "               |    SharedServices subnet (10.10.4.0/24) - DNS, AD   |",
      "               +==================+==================+==============+",
      "                                  |                  |",
      "                              peering            peering",
      "                                  |                  |",
      "               +========SPOKE 1==========+    +=======SPOKE 2========+",
      "               | Prod-Web (10.20.0.0/16) |    | UAT (10.30.0.0/16)   |",
      "               |  web subnet  (.1.0/24)  |    |  web subnet (.1.0/24)|",
      "               |  app subnet  (.2.0/24)  |    |  app subnet (.2.0/24)|",
      "               |  data subnet (.3.0/24)  |    |  data subnet(.3.0/24)|",
      "               | Defender on every NIC   |    | NSG + ASG + UDR      |",
      "               +=========================+    +======================+",
      "                  |                                  |",
      "               UDR → 0.0.0.0/0 via FW            UDR → 0.0.0.0/0 via FW",
      "```",
      "",
      "### Key components",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Hub VNet | Holds shared services. /24 minimum. Cannot be re-used as a workload VNet. |",
      "| ExpressRoute / VPN Gateway | Hybrid connectivity. ER for private fiber (50 Mbps-100 Gbps), VPN for fallback. |",
      "| Azure Firewall | L4-L7 inspection. Stateful, with DNAT + SNAT + threat intel. Premium for TLS inspection. |",
      "| Bastion | RDP/SSH access without public IPs on VMs. Standard tier supports session recording (Premium). |",
      "| Azure DNS Private Resolver | On-prem queries Azure private FQDNs. Azure queries on-prem zones via outbound endpoint. |",
      "| UDR (User Defined Route) | Force traffic from spoke → through FW → either to peer spoke (transit) or to internet. |",
      "| Peering settings | AllowGatewayTransit on hub side. UseRemoteGateways on spoke side. |",
      "",
      "### Gotcha: VNet peering is NOT transitive",
      "",
      "**Spoke 1 cannot ping Spoke 2 by default.** Even with hub peering on both sides. You must add a UDR on each spoke routing the other spoke's CIDR → Hub firewall (or NVA). Then traffic hairpins through the hub.",
      "",
      "### When to use",
      "",
      "Best for: 10-50 spokes, multi-team isolation, central security/monitoring. Outgrows: 50+ spokes or 6+ regions → consider Virtual WAN.",
      "",
      "## AKS Production-grade Cluster",
      "",
      "*Hardened multi-tenant AKS with private cluster, Workload Identity, Defender for Containers.*",
      "",
      "```",
      "                       USERS (internet)",
      "                            |",
      "                     Azure Front Door",
      "                            |",
      "            WAF + Bot Manager + Path-based routing",
      "                            |",
      "                       Private Link",
      "                            |",
      "              +============HUB VNET===========+",
      "              |   App Gateway Ingress         |",
      "              |   (AGIC controller)           |",
      "              +===============+===============+",
      "                              |",
      "                       VNet peering",
      "                              |",
      "            +================AKS SPOKE VNet (10.20.0.0/16)============+",
      "            |   nodes-subnet (10.20.1.0/24)                            |",
      "            |       Linux node pool (3-10 D8s_v5) — System workloads   |",
      "            |       User node pool (3-20 D8s_v5) — App workloads       |",
      "            |       Spot node pool (0-15 D8s_v5) — Batch workloads     |",
      "            |   pods-subnet (10.20.2.0/22) [Azure CNI Overlay]         |",
      "            |       ~1000 pods per cluster                             |",
      "            |   apiserver-subnet (10.20.3.0/27) — Private only         |",
      "            +==========================================================+",
      "                              |",
      "                       Azure Container Registry",
      "                       (Private endpoint)",
      "                              |",
      "            Workload Identity Federation (no secrets!)",
      "                              |",
      "            Azure Key Vault   |   Azure SQL  |  Cosmos DB",
      "            (Private          |   (Private    |  (Private",
      "             Endpoint)        |    Endpoint)  |   Endpoint)",
      "                              |",
      "                       Defender for Containers",
      "                       Managed Prometheus + Grafana",
      "                       Container Insights",
      "                       Microsoft Sentinel",
      "```",
      "",
      "### AKS hardening checklist (10 items)",
      "",
      "Private cluster (no public API endpoint). Workload Identity (no secrets in pods). Azure CNI Overlay (pod IPs not from VNet). NetworkPolicy with Cilium (default-deny). Defender for Containers + image scanning. Managed Prometheus + Grafana. Pod Security Standards (Restricted). Cluster Autoscaler + HPA + VPA + KEDA. Encrypted etcd. Multiple node pools (System / User / Spot).",
      "",
      "### Cost",
      "",
      "Free tier: 1 control plane (no SLA). Standard tier: 99.95% SLA per cluster ~$73/month + node compute. AKS is the cheapest part — nodes are 90% of cost.",
      "",
      "### When to use",
      "",
      "**Pick AKS when:** microservices, polyglot apps, container-native team, multi-region.",
      "",
      "**Skip AKS when:** < 5 services (App Service / Functions cheaper), team unfamiliar with K8s (Container Apps better), monolith (just App Service).",
      "",
      "## Microsoft Zero Trust Architecture",
      "",
      "*Identity + Endpoint + Apps + Network + Data + Infrastructure pillars. Replaces perimeter security.*",
      "",
      "```",
      "  IDENTITY                ENDPOINT              APPLICATION",
      "  --------                --------              -----------",
      "   User                    Device                App",
      "     |                       |                    |",
      "     |                       |                    |",
      "   Entra ID  ←────  Conditional Access  ───→   App Registry",
      "     |              Device compliance              |",
      "     |              MFA + Phishing-resistant       |",
      "   Identity Protection                          App-level RBAC",
      "   PIM + Access Reviews                            |",
      "                                              Defender for",
      "                                              Cloud Apps (CASB)",
      "",
      "                            ↓ ↑",
      "",
      "   DATA                    NETWORK               INFRASTRUCTURE",
      "   ----                    -------               --------------",
      "   Sensitivity              Hub-spoke +           Azure Policy",
      "   Labels +                 Private Endpoint        |",
      "   DLP +                    no public IPs         Defender for",
      "   IRM                      Encrypted in           Cloud (CSPM)",
      "     |                      transit                 |",
      "   Purview                                       Sentinel SIEM",
      "   Compliance                                   Microsoft 365",
      "   Manager                                      Defender XDR",
      "",
      "          ALL ROADS LEAD TO → ZERO TRUST PRINCIPLES:",
      "          1. Verify explicitly (always auth)",
      "          2. Least privilege (JIT + just-enough access)",
      "          3. Assume breach (segment + monitor)",
      "```",
      "",
      "### 6 pillars + Microsoft products",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Identity | Entra ID + Conditional Access + Identity Protection + PIM + Authentication strengths + B2B/B2C |",
      "| Endpoints | Intune + Defender for Endpoint + Endpoint Analytics + Defender XDR |",
      "| Applications | App Registrations + Defender for Cloud Apps + Workload Identity + Application Proxy |",
      "| Data | Purview Sensitivity Labels + DLP + IRM + Customer Lockbox + Encryption at rest/transit |",
      "| Network | Hub-spoke + Private Link + Azure Firewall + Defender for DNS + WAF + DDoS Protection |",
      "| Infrastructure | Azure Policy + Defender for Cloud + Defender for Servers/SQL/Containers + Update Manager |",
      "",
      "### Common project — Replace SSL VPN with ZTNA",
      "",
      "Old: SSL VPN → corp network → all apps. New: Global Secure Access + Entra app proxy + per-app access policies. Result: apps reachable only from compliant devices + compliant user + risk-scored session. No more \"VPN credential leaked = network breach\".",
      "",
      "## Multi-Region Active/Active Web App",
      "",
      "*Full RTO=0, RPO~0 architecture for global e-commerce.*",
      "",
      "```",
      "              CLIENTS (worldwide)",
      "                     |",
      "              Azure Front Door (Premium)",
      "              + WAF + Bot Manager + DDoS",
      "                     |",
      "        Anycast routing (closest healthy region)",
      "              |                    |",
      "        ┌─────┴──────┐       ┌─────┴──────┐",
      "        |  REGION 1   |       |  REGION 2  |",
      "        | East US 2   |       | West US 2  |",
      "        ├─────────────┤       ├────────────┤",
      "        | AKS regional|       | AKS regional|",
      "        | App + APIs  |       | App + APIs  |",
      "        ├─────────────┤       ├────────────┤",
      "        | Cosmos DB   | ←───→ | Cosmos DB   |",
      "        | (multi-write)       | (multi-write)",
      "        ├─────────────┤       ├────────────┤",
      "        | Redis active geo-replication ←───→",
      "        ├─────────────┤       ├────────────┤",
      "        | Storage RA-GZRS (paired regions automatic)",
      "        ├─────────────┤       ├────────────┤",
      "        | Azure SQL   |       | Azure SQL  |",
      "        | (Failover   |       | (read      |",
      "        |  Groups)    |       |  replica)  |",
      "        └─────────────┘       └────────────┘",
      "              ↑                    ↑",
      "           Defender                Defender",
      "            for Cloud              for Cloud",
      "              ↑                    ↑",
      "          Sentinel SIEM (global, 1 workspace)",
      "          Application Insights (global)",
      "```",
      "",
      "### Component decisions",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Cosmos DB | Multi-region writes — both regions accept writes. Conflict resolution policy (LWW or custom). |",
      "| Azure SQL | Failover Groups (active-passive) or Hyperscale read replicas. Manual failover < 60s. |",
      "| Storage | RA-GZRS (read-access geo-zone-redundant) — automatic replica to paired region. |",
      "| Redis | Enterprise tier with active geo-replication. Conflict-free CRDTs. |",
      "| Front Door | Premium with WAF + Private Link to backends. Latency-based routing. |",
      "| AKS | One cluster per region. Ingress publishes to private LB; Front Door accesses via Private Link. |",
      "| Session state | Redis (not in-memory) to allow cross-region failover mid-session. |",
      "",
      "### Failure scenarios",
      "",
      "**Region 1 dies:** Front Door health probes fail, traffic routes to Region 2 in <30s. Cosmos catches up writes within seconds. SQL Failover Group flips. Storage replication continues.",
      "",
      "**One AZ dies in Region 1:** AKS reschedules pods to surviving AZs. No user-visible failure. Cosmos + SQL ride through.",
      "",
      "**Cosmos partition unavailable:** Multi-region writes mean other region absorbs traffic. App must handle eventual consistency in read.",
      "",
      "## Microsoft Hybrid Identity",
      "",
      "*On-prem AD → Entra Connect → Entra ID with PHS or PTA or Federation.*",
      "",
      "```",
      "          ON-PREM AD                  ENTRA CONNECT          ENTRA ID (CLOUD)",
      "          -----------                  -------------          ----------------",
      "           User signs in                Sync engine                 User in cloud",
      "              ↓                            ↓                          ↓",
      "           DC (on-prem)                  Connector Spaces       Cloud directory",
      "              ↓                            ↓                          ↓",
      "           NTLM / Kerberos                Metaverse                  M365 / Azure apps",
      "           Domain join                                                ↓",
      "              ↓                                                  OAuth / OIDC",
      "           Domain-joined                                              ↓",
      "           devices                                              Cloud apps",
      "",
      "  Sync modes:",
      "  ═══════════",
      "   PHS (Password Hash Sync)    →  Hash sent to cloud (double-hashed). Cloud auths users.",
      "   PTA (Pass-Through Auth)     →  No hash sync. Each sign-in forwarded to on-prem agent.",
      "   Federation (ADFS - dying)   →  Old. ADFS auths. Entra issues token.",
      "",
      "  Recommended: Entra ID Pass-Through Auth + Password Hash Sync (PHS as backup).",
      "  Why PHS-only is best: simplest. No ADFS infrastructure. Leaked-cred alerts work.",
      "  Why PTA: orgs that cannot sync password hashes (policy reason).",
      "",
      "  Special components:",
      "  ══════════════════",
      "   Entra Connect (multi-instance)  ←→  Multiple in active/active for HA. One in staging mode.",
      "   Cloud Sync (lighter alternative)   →  For simple sync needs without filtering complexity.",
      "   Seamless SSO                       →  Domain-joined devices auto-SSO to Entra ID.",
      "   Hybrid Azure AD Join               →  Devices joined to BOTH on-prem AD + Entra.",
      "```",
      "",
      "### Sync mode comparison",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| PHS (Password Hash Sync) | Hash of hash uploaded to Entra. Simple. Auth happens in cloud. Leaked-creds alerts work. |",
      "| PTA (Pass-Through Auth) | No password upload. Each sign-in calls on-prem agent. Better for some compliance, but loses some features. |",
      "| Federation (ADFS) | Legacy. Entra delegates to ADFS. Extra infra, brittle. Use only if business reason exists. |",
      "| Cloud-only | No on-prem AD. Greenfield orgs or post-AD-decom. Entra is source of truth. |",
      "",
      "### Migration recommendation",
      "",
      "**Federation → PHS migration:** Microsoft strongly recommends moving off ADFS. Steps: 1) Enable PHS on Entra Connect alongside federation. 2) Convert domain from federated to managed (`Set-MsolDomainAuthentication`). 3) Test sign-ins. 4) Decommission ADFS farm. Result: simpler, cheaper, more secure, supports passwordless.",
      "",
      "## AVD Production Architecture",
      "",
      "*Pooled + Personal host pools with FSLogix profiles, scaling plan, golden image pipeline.*",
      "",
      "```",
      "            USERS  (internet or VPN)",
      "                  |",
      "                  ↓",
      "            Azure Front Door / RD Web Client",
      "                  |",
      "                  ↓",
      "            AVD Service (Microsoft-hosted) → orchestrates session brokering",
      "                  |",
      "                  ↓",
      "         ┌────────┴────────┐",
      "         │                  │",
      "   HOST POOL: Pooled    HOST POOL: Personal",
      "   (multi-session)      (1 user per VM)",
      "         │                  │",
      "   AppGroup: Desktop   AppGroup: Desktop",
      "   AppGroup: Apps      AppGroup: Apps (RemoteApp)",
      "         │                  │",
      "         ▼                  ▼",
      "  +----------------+  +----------------+",
      "  | Session hosts  |  | Session hosts  |",
      "  | D8s_v5 x 10    |  | D4s_v4 x 50    |",
      "  | Win 11 Multi-S |  | Win 11 EVD     |",
      "  | M365 Apps      |  | M365 Apps      |",
      "  +----------------+  +----------------+",
      "         │                  │",
      "     FSLogix profile     FSLogix profile",
      "     containers           containers (per user)",
      "         │                  │",
      "         ▼                  ▼",
      "       Azure Files / ANF (premium tier)",
      "       \\\\storage.privatelink.file.core.windows.net\\profiles",
      "         │",
      "     AAD-joined Storage + Kerberos auth",
      "",
      "   Image management:",
      "   ─────────────────",
      "     Azure Image Builder template → builds golden image with M365, FSLogix, custom apps",
      "     ↓",
      "     Compute Gallery (versions: 1.0.0, 1.1.0...)",
      "     ↓",
      "     Replicated to 2 regions (EastUS2, WestUS2)",
      "     ↓",
      "     Host pools point to latest version (or pinned per pool)",
      "```",
      "",
      "### Pooled vs Personal",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Pooled (multi-session) | Multiple users per VM. Lower cost. Good for task workers. Session is ephemeral. |",
      "| Personal (1 user per VM) | Dedicated VM per user. Higher cost. Good for developers, persistent state, admins. |",
      "",
      "### Cost rule of thumb",
      "",
      "~$80-150 per user/month for Pooled. ~$300-500 per user/month for Personal. Pooled + RI saves 35% more.",
      "",
      "### When AVD vs Windows 365",
      "",
      "**AVD** = full IT-managed VMs, complex policies, integration with on-prem AD, custom GPUs, custom apps.",
      "",
      "**Windows 365 (Cloud PC)** = simple per-user assignment, fixed monthly cost, no admin overhead.",
      "",
      "**Mix:** Cloud PC for sales/finance, AVD for developers needing more horsepower.",
      "",
      "## Production-grade RAG with AI Foundry",
      "",
      "*Retrieval-Augmented Generation for enterprise knowledge base + Q&A.*",
      "",
      "```",
      "                   USER QUESTION  (Teams / Web / API)",
      "                          |",
      "                          ↓",
      "                  AI Foundry Prompt Flow",
      "                  +---------------------------+",
      "                  | 1. Content Safety filter  |",
      "                  | 2. Query rewriter (LLM)   |",
      "                  | 3. Embedding generator    |",
      "                  | 4. Hybrid retrieval       |",
      "                  +---------------------------+",
      "                          |",
      "                          ↓",
      "                Azure AI Search index",
      "                +----------------------+",
      "                | Vector field (embed) |",
      "                | Keyword field        |",
      "                | Filters (security)   |",
      "                | Faceted navigation   |",
      "                +----------------------+",
      "                          ↑",
      "                  Retrieved top 5 chunks",
      "                          ↓",
      "                Reranker (semantic ranking)",
      "                          ↓",
      "                  Final top 3 chunks → prompt context",
      "                          ↓",
      "                  Azure OpenAI (GPT-4o)",
      "                          ↓",
      "                Response with citations + content safety output filter",
      "                          ↓",
      "                  USER (with [citation 1] links to source)",
      "",
      "  Data ingestion pipeline:",
      "  ━━━━━━━━━━━━━━━━━━━━━━",
      "     SharePoint / PDFs / web pages → Data Ingestion connector",
      "     ↓",
      "     Chunking (semantic / fixed / overlap)",
      "     ↓",
      "     Embedding (text-embedding-3-large)",
      "     ↓",
      "     Upload to AI Search vector index (with metadata: source, page, security)",
      "",
      "  Evaluation:",
      "  ━━━━━━━━━",
      "     Test set of 100 question-answer pairs",
      "     ↓",
      "     Run prompt flow → score each: groundedness, relevance, coherence",
      "     ↓",
      "     A/B test variants (different prompts, different rerankers)",
      "     ↓",
      "     Telemetry to App Insights (latency, cost, score per request)",
      "```",
      "",
      "### Key decisions",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Chunking strategy | Semantic chunking by paragraph + section header. 500-1000 token chunks. 10% overlap. |",
      "| Embedding model | text-embedding-3-large (3072 dims) for accuracy. Or text-embedding-3-small (1536) for cheaper. |",
      "| Vector search | Cosine similarity with HNSW index in AI Search. |",
      "| Hybrid retrieval | Vector + BM25 keyword combined. Beats either alone by 10-15%. |",
      "| Reranker | Semantic ranking model (built into AI Search). Critical for accuracy boost. |",
      "| LLM model | GPT-4o for prod (best instruction following). GPT-4o-mini for cheap variants. |",
      "| Grounding control | Strict mode: refuse if no citation. Lower mode: allow general knowledge fallback. |",
      "| Content safety | Input + output filters at sensitivity 4 (block hate / sexual / violence / self-harm). |",
      "",
      "### When NOT to use RAG",
      "",
      "**Skip RAG when:** answers are stable + small in scale (just use a regular FAQ database). Or when you need EXACT, real-time data (call the source API directly). RAG shines on free-form questions over a corpus of slowly-changing documents.",
      "",
      "## Microsoft SOC Stack",
      "",
      "*Defender XDR + Sentinel + Logic Apps SOAR for end-to-end security operations.*",
      "",
      "```",
      "  DATA SOURCES (everywhere)                            ANALYST PANE",
      "  ═══════════════════════════                          ════════════",
      "   Endpoint  (MDE)         ───→",
      "   Identity  (MDI)         ───→ Defender XDR  ←→  Sentinel",
      "   Email     (MDO)         ───→ (incidents)        (SIEM)",
      "   Cloud Apps (MDA)        ───→     ↑                ↑",
      "   IoT       (MDI for IoT) ───→     |                |",
      "   Azure logs              ─────────┘            Hunting",
      "                                                  Workbooks",
      "                                                  Watchlists",
      "   Defender for Cloud      ───→ (Azure CSPM/CWP)    TI",
      "                                                     |",
      "                                                Notebook KQL",
      "   3rd party logs (syslog,                            |",
      "   firewall, CASB, API)    ───→ Sentinel via",
      "                                Data Connectors",
      "",
      "                              ↓",
      "                       ENRICHED INCIDENT",
      "                              ↓",
      "                       SOAR PLAYBOOKS",
      "                       (Logic Apps)",
      "                  +-----------------------+",
      "                  | 1. Enrich with TI     |",
      "                  | 2. Notify analyst     |",
      "                  | 3. Auto-action low    |",
      "                  |    severity           |",
      "                  | 4. Human approval     |",
      "                  |    for high impact    |",
      "                  | 5. Audit + ticket     |",
      "                  +-----------------------+",
      "                              ↓",
      "                       RESPONSE",
      "                       - Disable user (Graph)",
      "                       - Isolate device (MDE)",
      "                       - Block IP (Firewall)",
      "                       - Quarantine email (Exchange)",
      "                       - Reset MFA (Graph)",
      "                       - Create ServiceNow ticket",
      "",
      "   FEEDBACK LOOP:",
      "   ═════════════",
      "     Post-incident review → tune analytics rules → reduce false positives",
      "     Threat hunt → discover new TTPs → create custom detections",
      "     MITRE ATT&CK coverage → workbook → identify gaps",
      "```",
      "",
      "### Component roles",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Defender XDR portal | security.microsoft.com — unified analyst console for incidents, hunting, simulator, training. |",
      "| Sentinel | SIEM for high-volume log ingestion + KQL analytics + workbooks + threat intel. |",
      "| Logic Apps (SOAR) | Playbook engine. Triggers on incident change. Calls APIs to act. |",
      "| Log Analytics workspace | Sentinel's storage. Pay per GB ingested + retention. |",
      "| Defender for Cloud | Posture + workload protection. Findings flow to Defender XDR as alerts. |",
      "| Microsoft Graph | API surface used by playbooks to act on identity / mail / device. |",
      "",
      "### Cost tip",
      "",
      "**Cost reduction levers:** 1) Use free tier tables (security alerts, M365 Defender). 2) Move noisy tables to Basic / Auxiliary Logs tier. 3) Use DCR transformations to drop noise BEFORE ingestion. 4) Archive after 90 days. Typical mid-size SOC: 100-300 GB/day = $5k-$15k/month.",
      "",
      "## Azure Storage Tiering Strategy",
      "",
      "*Lifecycle management across Hot / Cool / Cold / Archive for cost optimization.*",
      "",
      "```",
      "   USER UPLOADS FILE  →  Hot tier (immediate access)",
      "                              |",
      "                              | 30 days no access",
      "                              ↓",
      "                          Cool tier",
      "                              | (lower storage cost, slightly higher access cost)",
      "                              |",
      "                              | 90 days no access",
      "                              ↓",
      "                          Cold tier",
      "                              | (cheaper than Cool, 180-day commit)",
      "                              |",
      "                              | 180 days no access",
      "                              ↓",
      "                          Archive tier",
      "                              | (15-hour rehydrate to access)",
      "                              | retain for compliance/legal/cold backups",
      "                              |",
      "                              | 7 years",
      "                              ↓",
      "                          Delete (lifecycle rule)",
      "",
      "   PRICING (per GB/month, US Hot):",
      "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "     Hot:      $0.018         + access cheap",
      "     Cool:     $0.010         + access more expensive",
      "     Cold:     $0.0036        + access expensive, 180-day commit",
      "     Archive:  $0.00099       + rehydrate time + access very expensive",
      "",
      "   Lifecycle rule example (JSON):",
      "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "   {",
      "     \"rules\": [{",
      "       \"enabled\": true,",
      "       \"name\": \"AgeOutPolicy\",",
      "       \"type\": \"Lifecycle\",",
      "       \"definition\": {",
      "         \"actions\": {",
      "           \"baseBlob\": {",
      "             \"tierToCool\":    { \"daysAfterModificationGreaterThan\": 30 },",
      "             \"tierToCold\":    { \"daysAfterModificationGreaterThan\": 90 },",
      "             \"tierToArchive\": { \"daysAfterModificationGreaterThan\": 180 },",
      "             \"delete\":        { \"daysAfterModificationGreaterThan\": 2555 }",
      "           }",
      "         },",
      "         \"filters\": { \"blobTypes\": [\"blockBlob\"] }",
      "       }",
      "     }]",
      "   }",
      "```",
      "",
      "### Tier decision matrix",
      "",
      "| Component | Description |",
      "| --- | --- |",
      "| Hot | Daily access. Web assets, working data, frequent reads. |",
      "| Cool | Accessed 1-2x/month. Recent backups, short-term archive. |",
      "| Cold | 180-day commit. Quarterly access. Compliance archive. |",
      "| Archive | 1 year+ commit. Almost never accessed. Long-term retention. |",
      "",
      "### Common mistake",
      "",
      "**Don't move hot data to Cool!** Retrieval cost can exceed savings. Example: 1 TB read once a day from Cool = 30 GB/month × $0.01 retrieval = +$0.30. From Archive = +$24/TB rehydration + 15h wait. Only tier DOWN data you genuinely won't touch.",
      "",
      "## FinOps Operating Model",
      "",
      "*Crawl → Walk → Run maturity for cloud financial management.*",
      "",
      "```",
      "       CRAWL (0-6 months)",
      "       ━━━━━━━━━━━━━━━━━━",
      "        Tag everything (mandatory: Owner, Env, CostCenter)",
      "        Centralised cost dashboards",
      "        Showback to teams (no chargeback yet)",
      "        Find quick wins (orphaned, underutilized)",
      "        Buy 1-yr Reservations for steady-state",
      "              ↓",
      "       WALK (6-12 months)",
      "       ━━━━━━━━━━━━━━━━━",
      "        Chargeback (team budget = real budget)",
      "        Anomaly detection alerts",
      "        Right-sizing playbooks per team",
      "        Automated cleanup (idle VMs, snapshots)",
      "        Tag policy enforcement",
      "        3-yr Reservations + Savings Plans",
      "              ↓",
      "       RUN (12+ months)",
      "       ━━━━━━━━━━━━━━━",
      "        Unit economics ($/user, $/transaction)",
      "        Real-time cost decisions in pipelines",
      "        FinOps champions in every team",
      "        Automated guardrails (budget enforced via Logic Apps)",
      "        Forecasting + scenario planning",
      "        Cloud Center of Excellence (CCoE)",
      "",
      "   KPIs across the journey:",
      "   ━━━━━━━━━━━━━━━━━━━━━",
      "     - % spend covered by RI/SP            → 60% → 75% → 85%",
      "     - Tagging compliance                   → 50% → 90% → 99%",
      "     - Cost anomalies (auto-resolved)       → 0%  → 30% → 70%",
      "     - Unit economics defined per product   → 0   → 5   → 100% products",
      "     - Time-to-detect waste (hours)          → 720 → 168 → 24",
      "",
      "   Microsoft FinOps Toolkit:",
      "   ━━━━━━━━━━━━━━━━━━━━━━",
      "     - Cost Management API + Power BI templates",
      "     - FinOps Workbook (KQL + sample reports)",
      "     - Cost exports to storage → Synapse → forecasting",
      "```",
      "",
      "### First 30 days for a new FinOps lead",
      "",
      "1) Apply tag policy initiative. 2) Create cost alerts at 80% + 100% of subscription budget. 3) Enable anomaly detection. 4) Review top 10 cost drivers manually. 5) Run RI recommendation. 6) Identify 5 quick wins (orphans, oversized). 7) Schedule weekly cost review.",
      "",
      "### Who owns FinOps?",
      "",
      "**It is a shared discipline:** Finance owns the budget. Engineering owns the architecture choices. FinOps team coordinates. Cloud Center of Excellence sets policies. Without leadership backing FinOps, teams default to \"ship the feature, ignore the bill\" — and bills balloon.",
      "",
      "## M365 Production Tenant",
      "",
      "*Complete tenant architecture: identity, mail, collaboration, compliance.*",
      "",
      "```",
      "                   USERS (5000)",
      "                       |",
      "                       ↓",
      "                 ENTRA ID (Cloud)",
      "               ┌───────────────────┐",
      "               | Conditional Access |",
      "               | MFA (FIDO2 + Auth)  |",
      "               | Identity Protection |",
      "               | PIM (admin JIT)    |",
      "               | Defender for ID   |",
      "               └─────────┬─────────┘",
      "                         |",
      "                  Entra Connect Sync",
      "                         |",
      "               ┌─────────┴─────────┐",
      "               | ON-PREM AD (8000  |",
      "               | users + 3000      |",
      "               | devices)          |",
      "               └───────────────────┘",
      "",
      "  M365 Services Layer",
      "  ━━━━━━━━━━━━━━━━━━",
      "   Exchange Online  ←→  Hybrid Connector  ←→  On-prem Exchange (legacy mailboxes)",
      "   SharePoint Online + OneDrive (1 TB / user)",
      "   Microsoft Teams (incl. Teams Phone with Direct Routing)",
      "   Microsoft 365 Apps for Enterprise (Word, Excel, etc.)",
      "",
      "  Security & Compliance Layer",
      "  ━━━━━━━━━━━━━━━━━━━━━━━━━",
      "   Defender for Office 365 P2 (anti-phish, Safe Links, Attack Sim)",
      "   Defender for Cloud Apps (CASB)",
      "   Microsoft Purview",
      "     ↳ Sensitivity Labels (Public / Internal / Conf / HighlyConf)",
      "     ↳ DLP (Endpoint + Email + Teams + SharePoint)",
      "     ↳ Retention policies (7-year for finance)",
      "     ↳ Insider Risk Management",
      "     ↳ Audit Premium (1-year retention)",
      "     ↳ eDiscovery Premium",
      "",
      "  Endpoint Layer",
      "  ━━━━━━━━━━━━━",
      "   Intune MDM (3000 corp Windows + 1000 mobile)",
      "     ↳ Autopilot for new device onboarding",
      "     ↳ Compliance policies (BitLocker + Defender + OS version)",
      "     ↳ Configuration profiles (Settings Catalog)",
      "     ↳ Win32 apps via Intune",
      "   Intune App Protection (BYOD via MAM)",
      "   Defender for Endpoint P2 (XDR sensor)",
      "```",
      "",
      "### Licensing recommendation",
      "",
      "M365 E5 covers nearly everything. M365 E3 + EMS E5 + Defender for O365 P2 = same coverage at slightly lower cost. Pick E5 for simplicity. F1/F3 for frontline workers (no E5 features).",
      "",
      "### Day 1 baseline (40 hours of setup)",
      "",
      "**Block 1 (8h):** Add custom domain, configure MX + DKIM + DMARC, create 2 break-glass admins, enable Defender XDR + audit log, baseline CA policies, set authentication methods, deploy initial Intune compliance policy.",
      "",
      "**Block 2 (16h):** Configure all Exchange anti-spam/anti-phish policies, build Purview label framework, deploy Defender for Endpoint, onboard pilot users.",
      "",
      "**Block 3 (16h):** Train helpdesk on M365 admin center, document runbooks, schedule quarterly reviews.",
    ].join("\n"),
    sortOrder: 18,
  },
  {
    slug: "iac-examples",
    title: "IaC Examples (Bicep + Terraform)",
    category: "Infrastructure as Code",
    sourcePage: "iac-examples.html",
    summary: "Side-by-side Bicep and Terraform examples for seven common Azure deployments: Virtual Machine, Virtual Network, AKS Cluster, App Service, Azure SQL DB, Storage Account, and Key Vault.",
    bodyMarkdown: [
      "# IaC Examples (Bicep + Terraform)",
      "",
      "Real-world Bicep + Terraform examples for common Azure deployments. Each example below shows the same resource defined both ways.",
      "",
      "## Virtual Machine",
      "",
      "Linux VM with system-assigned managed identity, Standard SSD disk, no public IP, NSG with SSH from specific IP.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "@description('Resource location')",
      "param location string = resourceGroup().location",
      "param vmName string = 'vm-app-01'",
      "param adminUsername string = 'azureuser'",
      "@secure()",
      "param adminPasswordOrKey string",
      "param subnetId string",
      "param vmSize string = 'Standard_D2s_v5'",
      "",
      "resource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {",
      "  name: vmName",
      "  location: location",
      "  identity: { type: 'SystemAssigned' }",
      "  properties: {",
      "    hardwareProfile: { vmSize: vmSize }",
      "    storageProfile: {",
      "      imageReference: {",
      "        publisher: 'Canonical'",
      "        offer: '0001-com-ubuntu-server-jammy'",
      "        sku: '22_04-lts-gen2'",
      "        version: 'latest'",
      "      }",
      "      osDisk: {",
      "        createOption: 'FromImage'",
      "        managedDisk: { storageAccountType: 'StandardSSD_LRS' }",
      "      }",
      "    }",
      "    osProfile: {",
      "      computerName: vmName",
      "      adminUsername: adminUsername",
      "      linuxConfiguration: {",
      "        disablePasswordAuthentication: true",
      "        ssh: {",
      "          publicKeys: [",
      "            {",
      "              path: '/home/${adminUsername}/.ssh/authorized_keys'",
      "              keyData: adminPasswordOrKey",
      "            }",
      "          ]",
      "        }",
      "      }",
      "    }",
      "    networkProfile: {",
      "      networkInterfaces: [",
      "        { id: nic.id }",
      "      ]",
      "    }",
      "  }",
      "  tags: {",
      "    Environment: 'Production'",
      "    Owner: 'platform@cloudlab.in'",
      "  }",
      "}",
      "",
      "resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {",
      "  name: '${vmName}-nic'",
      "  location: location",
      "  properties: {",
      "    ipConfigurations: [",
      "      {",
      "        name: 'ipconfig1'",
      "        properties: {",
      "          subnet: { id: subnetId }",
      "          privateIPAllocationMethod: 'Dynamic'",
      "        }",
      "      }",
      "    ]",
      "  }",
      "}",
      "",
      "output vmId string = vm.id",
      "output principalId string = vm.identity.principalId",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "terraform {",
      "  required_providers {",
      "    azurerm = {",
      "      source  = \"hashicorp/azurerm\"",
      "      version = \"~> 4.0\"",
      "    }",
      "  }",
      "}",
      "",
      "provider \"azurerm\" { features {} }",
      "",
      "variable \"vm_name\"       { default = \"vm-app-01\" }",
      "variable \"location\"      { default = \"eastus2\" }",
      "variable \"admin_username\" { default = \"azureuser\" }",
      "variable \"ssh_public_key\" { sensitive = true }",
      "variable \"subnet_id\"     {}",
      "",
      "resource \"azurerm_linux_virtual_machine\" \"vm\" {",
      "  name                = var.vm_name",
      "  resource_group_name = \"rg-prod\"",
      "  location            = var.location",
      "  size                = \"Standard_D2s_v5\"",
      "  admin_username      = var.admin_username",
      "",
      "  identity { type = \"SystemAssigned\" }",
      "",
      "  admin_ssh_key {",
      "    username   = var.admin_username",
      "    public_key = var.ssh_public_key",
      "  }",
      "",
      "  os_disk {",
      "    caching              = \"ReadWrite\"",
      "    storage_account_type = \"StandardSSD_LRS\"",
      "  }",
      "",
      "  source_image_reference {",
      "    publisher = \"Canonical\"",
      "    offer     = \"0001-com-ubuntu-server-jammy\"",
      "    sku       = \"22_04-lts-gen2\"",
      "    version   = \"latest\"",
      "  }",
      "",
      "  network_interface_ids = [azurerm_network_interface.nic.id]",
      "",
      "  tags = {",
      "    Environment = \"Production\"",
      "    Owner       = \"platform@cloudlab.in\"",
      "  }",
      "}",
      "",
      "resource \"azurerm_network_interface\" \"nic\" {",
      "  name                = \"${var.vm_name}-nic\"",
      "  location            = var.location",
      "  resource_group_name = \"rg-prod\"",
      "",
      "  ip_configuration {",
      "    name                          = \"ipconfig1\"",
      "    subnet_id                     = var.subnet_id",
      "    private_ip_address_allocation = \"Dynamic\"",
      "  }",
      "}",
      "",
      "output \"vm_id\" { value = azurerm_linux_virtual_machine.vm.id }",
      "output \"principal_id\" { value = azurerm_linux_virtual_machine.vm.identity[0].principal_id }",
      "```",
      "",
      "## Virtual Network",
      "",
      "VNet with 4 subnets, NSGs, Service Endpoint for Storage, Private DNS zone integration.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "param location string = resourceGroup().location",
      "param vnetName string = 'vnet-prod'",
      "param addressSpace string = '10.0.0.0/16'",
      "",
      "resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {",
      "  name: vnetName",
      "  location: location",
      "  properties: {",
      "    addressSpace: { addressPrefixes: [addressSpace] }",
      "    subnets: [",
      "      {",
      "        name: 'web'",
      "        properties: {",
      "          addressPrefix: '10.0.1.0/24'",
      "          serviceEndpoints: [",
      "            { service: 'Microsoft.Storage' }",
      "            { service: 'Microsoft.KeyVault' }",
      "          ]",
      "        }",
      "      }",
      "      {",
      "        name: 'app'",
      "        properties: { addressPrefix: '10.0.2.0/24' }",
      "      }",
      "      {",
      "        name: 'data'",
      "        properties: { addressPrefix: '10.0.3.0/24' }",
      "      }",
      "      {",
      "        name: 'AzureBastionSubnet'",
      "        properties: { addressPrefix: '10.0.10.0/26' }",
      "      }",
      "    ]",
      "  }",
      "}",
      "",
      "resource nsgWeb 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {",
      "  name: 'nsg-web'",
      "  location: location",
      "  properties: {",
      "    securityRules: [",
      "      {",
      "        name: 'AllowHTTPS'",
      "        properties: {",
      "          access: 'Allow'",
      "          direction: 'Inbound'",
      "          priority: 100",
      "          protocol: 'Tcp'",
      "          sourceAddressPrefix: '*'",
      "          sourcePortRange: '*'",
      "          destinationAddressPrefix: '10.0.1.0/24'",
      "          destinationPortRange: '443'",
      "        }",
      "      }",
      "    ]",
      "  }",
      "}",
      "",
      "output vnetId string = vnet.id",
      "output subnets array = [for s in vnet.properties.subnets: s.name]",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "variable \"vnet_name\"      { default = \"vnet-prod\" }",
      "variable \"address_space\" { default = \"10.0.0.0/16\" }",
      "",
      "resource \"azurerm_virtual_network\" \"vnet\" {",
      "  name                = var.vnet_name",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "  address_space       = [var.address_space]",
      "}",
      "",
      "resource \"azurerm_subnet\" \"web\" {",
      "  name                 = \"web\"",
      "  resource_group_name  = \"rg-prod\"",
      "  virtual_network_name = azurerm_virtual_network.vnet.name",
      "  address_prefixes     = [\"10.0.1.0/24\"]",
      "  service_endpoints    = [\"Microsoft.Storage\", \"Microsoft.KeyVault\"]",
      "}",
      "",
      "resource \"azurerm_subnet\" \"app\" {",
      "  name                 = \"app\"",
      "  resource_group_name  = \"rg-prod\"",
      "  virtual_network_name = azurerm_virtual_network.vnet.name",
      "  address_prefixes     = [\"10.0.2.0/24\"]",
      "}",
      "",
      "resource \"azurerm_subnet\" \"bastion\" {",
      "  name                 = \"AzureBastionSubnet\"",
      "  resource_group_name  = \"rg-prod\"",
      "  virtual_network_name = azurerm_virtual_network.vnet.name",
      "  address_prefixes     = [\"10.0.10.0/26\"]",
      "}",
      "",
      "resource \"azurerm_network_security_group\" \"web\" {",
      "  name                = \"nsg-web\"",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "",
      "  security_rule {",
      "    name                       = \"AllowHTTPS\"",
      "    priority                   = 100",
      "    direction                  = \"Inbound\"",
      "    access                     = \"Allow\"",
      "    protocol                   = \"Tcp\"",
      "    source_port_range          = \"*\"",
      "    destination_port_range     = \"443\"",
      "    source_address_prefix      = \"*\"",
      "    destination_address_prefix = \"10.0.1.0/24\"",
      "  }",
      "}",
      "",
      "resource \"azurerm_subnet_network_security_group_association\" \"web\" {",
      "  subnet_id                 = azurerm_subnet.web.id",
      "  network_security_group_id = azurerm_network_security_group.web.id",
      "}",
      "",
      "output \"vnet_id\" { value = azurerm_virtual_network.vnet.id }",
      "```",
      "",
      "## AKS Cluster",
      "",
      "Private AKS cluster with Workload Identity, Azure CNI Overlay, Defender enabled, 3 node pools.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "param location string = resourceGroup().location",
      "param clusterName string = 'aks-prod'",
      "param subnetId string",
      "param kubernetesVersion string = '1.30.5'",
      "",
      "resource aks 'Microsoft.ContainerService/managedClusters@2024-08-01' = {",
      "  name: clusterName",
      "  location: location",
      "  identity: { type: 'SystemAssigned' }",
      "  sku: {",
      "    name: 'Base'",
      "    tier: 'Standard'",
      "  }",
      "  properties: {",
      "    kubernetesVersion: kubernetesVersion",
      "    dnsPrefix: clusterName",
      "    agentPoolProfiles: [",
      "      {",
      "        name: 'system'",
      "        count: 3",
      "        vmSize: 'Standard_D2s_v5'",
      "        osType: 'Linux'",
      "        mode: 'System'",
      "        availabilityZones: ['1', '2', '3']",
      "        vnetSubnetID: subnetId",
      "        type: 'VirtualMachineScaleSets'",
      "        enableAutoScaling: true",
      "        minCount: 3",
      "        maxCount: 5",
      "      }",
      "      {",
      "        name: 'app'",
      "        count: 3",
      "        vmSize: 'Standard_D4s_v5'",
      "        osType: 'Linux'",
      "        mode: 'User'",
      "        availabilityZones: ['1', '2', '3']",
      "        vnetSubnetID: subnetId",
      "        type: 'VirtualMachineScaleSets'",
      "        enableAutoScaling: true",
      "        minCount: 3",
      "        maxCount: 20",
      "      }",
      "      {",
      "        name: 'spot'",
      "        count: 0",
      "        vmSize: 'Standard_D4s_v5'",
      "        osType: 'Linux'",
      "        mode: 'User'",
      "        scaleSetPriority: 'Spot'",
      "        scaleSetEvictionPolicy: 'Delete'",
      "        spotMaxPrice: -1",
      "        nodeTaints: ['kubernetes.azure.com/scalesetpriority=spot:NoSchedule']",
      "        enableAutoScaling: true",
      "        minCount: 0",
      "        maxCount: 15",
      "      }",
      "    ]",
      "    networkProfile: {",
      "      networkPlugin: 'azure'",
      "      networkPluginMode: 'overlay'",
      "      networkPolicy: 'cilium'",
      "      networkDataplane: 'cilium'",
      "      podCidr: '10.244.0.0/16'",
      "      serviceCidr: '172.16.0.0/16'",
      "      dnsServiceIP: '172.16.0.10'",
      "    }",
      "    apiServerAccessProfile: {",
      "      enablePrivateCluster: true",
      "      privateDNSZone: 'system'",
      "    }",
      "    oidcIssuerProfile: { enabled: true }",
      "    securityProfile: {",
      "      workloadIdentity: { enabled: true }",
      "      defender: {",
      "        logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceId",
      "        securityMonitoring: { enabled: true }",
      "      }",
      "    }",
      "    addonProfiles: {",
      "      omsagent: {",
      "        enabled: true",
      "        config: { logAnalyticsWorkspaceResourceID: logAnalyticsWorkspaceId }",
      "      }",
      "    }",
      "  }",
      "  tags: {",
      "    Environment: 'Production'",
      "    Workload: 'Critical'",
      "  }",
      "}",
      "",
      "output clusterId string = aks.id",
      "output oidcIssuerUrl string = aks.properties.oidcIssuerProfile.issuerURL",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "resource \"azurerm_kubernetes_cluster\" \"aks\" {",
      "  name                = \"aks-prod\"",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "  dns_prefix          = \"aks-prod\"",
      "  kubernetes_version  = \"1.30.5\"",
      "  sku_tier            = \"Standard\"",
      "",
      "  identity { type = \"SystemAssigned\" }",
      "  oidc_issuer_enabled       = true",
      "  workload_identity_enabled = true",
      "",
      "  default_node_pool {",
      "    name                = \"system\"",
      "    node_count          = 3",
      "    vm_size             = \"Standard_D2s_v5\"",
      "    vnet_subnet_id      = var.subnet_id",
      "    type                = \"VirtualMachineScaleSets\"",
      "    zones               = [\"1\", \"2\", \"3\"]",
      "    auto_scaling_enabled = true",
      "    min_count           = 3",
      "    max_count           = 5",
      "    only_critical_addons_enabled = true",
      "  }",
      "",
      "  network_profile {",
      "    network_plugin      = \"azure\"",
      "    network_plugin_mode = \"overlay\"",
      "    network_policy      = \"cilium\"",
      "    network_data_plane  = \"cilium\"",
      "    pod_cidr            = \"10.244.0.0/16\"",
      "    service_cidr        = \"172.16.0.0/16\"",
      "    dns_service_ip      = \"172.16.0.10\"",
      "  }",
      "",
      "  api_server_access_profile {",
      "    authorized_ip_ranges = []",
      "  }",
      "",
      "  private_cluster_enabled = true",
      "",
      "  microsoft_defender {",
      "    log_analytics_workspace_id = var.log_analytics_workspace_id",
      "  }",
      "",
      "  oms_agent {",
      "    log_analytics_workspace_id = var.log_analytics_workspace_id",
      "  }",
      "",
      "  tags = { Environment = \"Production\" }",
      "}",
      "",
      "resource \"azurerm_kubernetes_cluster_node_pool\" \"app\" {",
      "  name                  = \"app\"",
      "  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id",
      "  vm_size               = \"Standard_D4s_v5\"",
      "  node_count            = 3",
      "  zones                 = [\"1\", \"2\", \"3\"]",
      "  auto_scaling_enabled  = true",
      "  min_count             = 3",
      "  max_count             = 20",
      "  mode                  = \"User\"",
      "}",
      "",
      "resource \"azurerm_kubernetes_cluster_node_pool\" \"spot\" {",
      "  name                  = \"spot\"",
      "  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id",
      "  vm_size               = \"Standard_D4s_v5\"",
      "  priority              = \"Spot\"",
      "  eviction_policy       = \"Delete\"",
      "  spot_max_price        = -1",
      "  node_taints           = [\"kubernetes.azure.com/scalesetpriority=spot:NoSchedule\"]",
      "  auto_scaling_enabled  = true",
      "  min_count             = 0",
      "  max_count             = 15",
      "}",
      "",
      "output \"aks_id\"        { value = azurerm_kubernetes_cluster.aks.id }",
      "output \"oidc_issuer\"   { value = azurerm_kubernetes_cluster.aks.oidc_issuer_url }",
      "```",
      "",
      "## App Service",
      "",
      "P1v3 App Service with VNet integration, Managed Identity, custom domain + managed cert, deployment slot.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "param location string = resourceGroup().location",
      "param appName string = 'app-payments-prod'",
      "param planSku string = 'P1v3'",
      "param vnetSubnetId string",
      "param keyVaultUri string",
      "",
      "resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {",
      "  name: '${appName}-plan'",
      "  location: location",
      "  sku: {",
      "    name: planSku",
      "    tier: 'PremiumV3'",
      "    size: planSku",
      "  }",
      "  kind: 'app'",
      "  properties: {",
      "    zoneRedundant: true",
      "  }",
      "}",
      "",
      "resource app 'Microsoft.Web/sites@2023-12-01' = {",
      "  name: appName",
      "  location: location",
      "  identity: { type: 'SystemAssigned' }",
      "  properties: {",
      "    serverFarmId: plan.id",
      "    httpsOnly: true",
      "    virtualNetworkSubnetId: vnetSubnetId",
      "    siteConfig: {",
      "      alwaysOn: true",
      "      minTlsVersion: '1.2'",
      "      ftpsState: 'Disabled'",
      "      vnetRouteAllEnabled: true",
      "      appSettings: [",
      "        {",
      "          name: 'KeyVaultUri'",
      "          value: keyVaultUri",
      "        }",
      "        {",
      "          name: 'DB_CONNECTION_STRING'",
      "          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}/secrets/db-conn)'",
      "        }",
      "      ]",
      "    }",
      "  }",
      "}",
      "",
      "resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = {",
      "  parent: app",
      "  name: 'staging'",
      "  location: location",
      "  identity: { type: 'SystemAssigned' }",
      "  properties: {",
      "    serverFarmId: plan.id",
      "    httpsOnly: true",
      "    virtualNetworkSubnetId: vnetSubnetId",
      "    siteConfig: {",
      "      alwaysOn: true",
      "      minTlsVersion: '1.2'",
      "    }",
      "  }",
      "}",
      "",
      "output appUrl string = 'https://${app.properties.defaultHostName}'",
      "output principalId string = app.identity.principalId",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "resource \"azurerm_service_plan\" \"plan\" {",
      "  name                = \"${var.app_name}-plan\"",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "  os_type             = \"Linux\"",
      "  sku_name            = \"P1v3\"",
      "  zone_balancing_enabled = true",
      "}",
      "",
      "resource \"azurerm_linux_web_app\" \"app\" {",
      "  name                = var.app_name",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "  service_plan_id     = azurerm_service_plan.plan.id",
      "  https_only          = true",
      "",
      "  identity { type = \"SystemAssigned\" }",
      "",
      "  virtual_network_subnet_id = var.subnet_id",
      "",
      "  site_config {",
      "    always_on = true",
      "    minimum_tls_version = \"1.2\"",
      "    ftps_state = \"Disabled\"",
      "    vnet_route_all_enabled = true",
      "  }",
      "",
      "  app_settings = {",
      "    \"KeyVaultUri\"          = var.key_vault_uri",
      "    \"DB_CONNECTION_STRING\" = \"@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}/secrets/db-conn)\"",
      "  }",
      "}",
      "",
      "resource \"azurerm_linux_web_app_slot\" \"staging\" {",
      "  name           = \"staging\"",
      "  app_service_id = azurerm_linux_web_app.app.id",
      "",
      "  identity { type = \"SystemAssigned\" }",
      "",
      "  virtual_network_subnet_id = var.subnet_id",
      "",
      "  site_config {",
      "    always_on = true",
      "    minimum_tls_version = \"1.2\"",
      "  }",
      "}",
      "```",
      "",
      "## Azure SQL DB",
      "",
      "Azure SQL Database with private endpoint, AAD authentication only, TDE with CMK, long-term retention.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "param location string = resourceGroup().location",
      "param serverName string = 'sql-prod-001'",
      "param dbName string = 'PaymentsDB'",
      "param aadAdminLogin string",
      "param aadAdminObjectId string",
      "param vnetSubnetId string",
      "param privateDnsZoneId string",
      "",
      "resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {",
      "  name: serverName",
      "  location: location",
      "  identity: { type: 'SystemAssigned' }",
      "  properties: {",
      "    publicNetworkAccess: 'Disabled'",
      "    administrators: {",
      "      administratorType: 'ActiveDirectory'",
      "      principalType: 'Group'",
      "      login: aadAdminLogin",
      "      sid: aadAdminObjectId",
      "      tenantId: subscription().tenantId",
      "      azureADOnlyAuthentication: true",
      "    }",
      "    minimalTlsVersion: '1.2'",
      "  }",
      "}",
      "",
      "resource database 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {",
      "  parent: sqlServer",
      "  name: dbName",
      "  location: location",
      "  sku: {",
      "    name: 'GP_Gen5_4'",
      "    tier: 'GeneralPurpose'",
      "    capacity: 4",
      "  }",
      "  properties: {",
      "    zoneRedundant: true",
      "    requestedBackupStorageRedundancy: 'Zone'",
      "  }",
      "}",
      "",
      "resource ltrPolicy 'Microsoft.Sql/servers/databases/backupLongTermRetentionPolicies@2023-08-01-preview' = {",
      "  parent: database",
      "  name: 'default'",
      "  properties: {",
      "    weeklyRetention: 'P12W'",
      "    monthlyRetention: 'P12M'",
      "    yearlyRetention: 'P7Y'",
      "    weekOfYear: 1",
      "  }",
      "}",
      "",
      "resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {",
      "  name: '${serverName}-pe'",
      "  location: location",
      "  properties: {",
      "    subnet: { id: vnetSubnetId }",
      "    privateLinkServiceConnections: [",
      "      {",
      "        name: '${serverName}-pls'",
      "        properties: {",
      "          privateLinkServiceId: sqlServer.id",
      "          groupIds: ['sqlServer']",
      "        }",
      "      }",
      "    ]",
      "  }",
      "}",
      "",
      "resource peDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {",
      "  parent: privateEndpoint",
      "  name: 'default'",
      "  properties: {",
      "    privateDnsZoneConfigs: [",
      "      {",
      "        name: 'default'",
      "        properties: { privateDnsZoneId: privateDnsZoneId }",
      "      }",
      "    ]",
      "  }",
      "}",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "resource \"azurerm_mssql_server\" \"sql\" {",
      "  name                         = \"sql-prod-001\"",
      "  resource_group_name          = \"rg-prod\"",
      "  location                     = \"eastus2\"",
      "  version                      = \"12.0\"",
      "  minimum_tls_version          = \"1.2\"",
      "  public_network_access_enabled = false",
      "",
      "  identity { type = \"SystemAssigned\" }",
      "",
      "  azuread_administrator {",
      "    login_username              = var.aad_admin_login",
      "    object_id                   = var.aad_admin_object_id",
      "    azuread_authentication_only = true",
      "  }",
      "}",
      "",
      "resource \"azurerm_mssql_database\" \"db\" {",
      "  name                = \"PaymentsDB\"",
      "  server_id           = azurerm_mssql_server.sql.id",
      "  sku_name            = \"GP_Gen5_4\"",
      "  zone_redundant      = true",
      "  storage_account_type = \"Zone\"",
      "",
      "  long_term_retention_policy {",
      "    weekly_retention  = \"P12W\"",
      "    monthly_retention = \"P12M\"",
      "    yearly_retention  = \"P7Y\"",
      "    week_of_year      = 1",
      "  }",
      "}",
      "",
      "resource \"azurerm_private_endpoint\" \"sql_pe\" {",
      "  name                = \"sql-prod-001-pe\"",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "  subnet_id           = var.subnet_id",
      "",
      "  private_service_connection {",
      "    name                           = \"sql-pls\"",
      "    private_connection_resource_id = azurerm_mssql_server.sql.id",
      "    subresource_names              = [\"sqlServer\"]",
      "    is_manual_connection           = false",
      "  }",
      "",
      "  private_dns_zone_group {",
      "    name                 = \"default\"",
      "    private_dns_zone_ids = [var.private_dns_zone_id]",
      "  }",
      "}",
      "```",
      "",
      "## Storage Account",
      "",
      "Storage with CMK encryption, private endpoint, lifecycle rule (Hot → Cool → Archive → Delete), versioning.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "param location string = resourceGroup().location",
      "param storageName string = 'stcloudlabprod001'",
      "param keyVaultUri string",
      "param keyName string",
      "",
      "resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = {",
      "  name: storageName",
      "  location: location",
      "  identity: { type: 'SystemAssigned' }",
      "  sku: { name: 'Standard_RAGZRS' }",
      "  kind: 'StorageV2'",
      "  properties: {",
      "    minimumTlsVersion: 'TLS1_2'",
      "    supportsHttpsTrafficOnly: true",
      "    allowBlobPublicAccess: false",
      "    allowSharedKeyAccess: false",
      "    publicNetworkAccess: 'Disabled'",
      "    encryption: {",
      "      keyvaultproperties: {",
      "        keyname: keyName",
      "        keyvaulturi: keyVaultUri",
      "      }",
      "      keySource: 'Microsoft.Keyvault'",
      "      services: {",
      "        blob: { enabled: true, keyType: 'Account' }",
      "        file: { enabled: true, keyType: 'Account' }",
      "      }",
      "    }",
      "  }",
      "}",
      "",
      "resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {",
      "  parent: sa",
      "  name: 'default'",
      "  properties: {",
      "    deleteRetentionPolicy: { enabled: true, days: 30 }",
      "    containerDeleteRetentionPolicy: { enabled: true, days: 30 }",
      "    isVersioningEnabled: true",
      "    changeFeed: { enabled: true }",
      "  }",
      "}",
      "",
      "resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {",
      "  parent: sa",
      "  name: 'default'",
      "  properties: {",
      "    policy: {",
      "      rules: [",
      "        {",
      "          enabled: true",
      "          name: 'AgeOutPolicy'",
      "          type: 'Lifecycle'",
      "          definition: {",
      "            filters: { blobTypes: ['blockBlob'] }",
      "            actions: {",
      "              baseBlob: {",
      "                tierToCool:    { daysAfterModificationGreaterThan: 30 }",
      "                tierToCold:    { daysAfterModificationGreaterThan: 90 }",
      "                tierToArchive: { daysAfterModificationGreaterThan: 180 }",
      "                delete:        { daysAfterModificationGreaterThan: 2555 }",
      "              }",
      "            }",
      "          }",
      "        }",
      "      ]",
      "    }",
      "  }",
      "}",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "resource \"azurerm_storage_account\" \"sa\" {",
      "  name                          = \"stcloudlabprod001\"",
      "  resource_group_name           = \"rg-prod\"",
      "  location                      = \"eastus2\"",
      "  account_tier                  = \"Standard\"",
      "  account_replication_type      = \"RAGZRS\"",
      "  account_kind                  = \"StorageV2\"",
      "  min_tls_version               = \"TLS1_2\"",
      "  enable_https_traffic_only     = true",
      "  allow_nested_items_to_be_public = false",
      "  shared_access_key_enabled     = false",
      "  public_network_access_enabled = false",
      "",
      "  identity { type = \"SystemAssigned\" }",
      "",
      "  customer_managed_key {",
      "    key_vault_key_id          = \"${var.key_vault_uri}/keys/${var.key_name}\"",
      "    user_assigned_identity_id = azurerm_user_assigned_identity.sa.id",
      "  }",
      "",
      "  blob_properties {",
      "    delete_retention_policy {",
      "      days = 30",
      "    }",
      "    container_delete_retention_policy {",
      "      days = 30",
      "    }",
      "    versioning_enabled = true",
      "    change_feed_enabled = true",
      "  }",
      "}",
      "",
      "resource \"azurerm_storage_management_policy\" \"policy\" {",
      "  storage_account_id = azurerm_storage_account.sa.id",
      "",
      "  rule {",
      "    name    = \"AgeOutPolicy\"",
      "    enabled = true",
      "    filters {",
      "      blob_types = [\"blockBlob\"]",
      "    }",
      "    actions {",
      "      base_blob {",
      "        tier_to_cool_after_days_since_modification_greater_than    = 30",
      "        tier_to_cold_after_days_since_modification_greater_than    = 90",
      "        tier_to_archive_after_days_since_modification_greater_than = 180",
      "        delete_after_days_since_modification_greater_than          = 2555",
      "      }",
      "    }",
      "  }",
      "}",
      "```",
      "",
      "## Key Vault",
      "",
      "Premium Key Vault (HSM-backed) with RBAC mode, soft delete + purge protection, private endpoint.",
      "",
      "### Bicep",
      "",
      "```bicep",
      "param location string = resourceGroup().location",
      "param kvName string = 'kv-cloudlab-prod'",
      "param vnetSubnetId string",
      "param privateDnsZoneId string",
      "",
      "resource kv 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {",
      "  name: kvName",
      "  location: location",
      "  properties: {",
      "    sku: {",
      "      family: 'A'",
      "      name: 'premium'",
      "    }",
      "    tenantId: subscription().tenantId",
      "    enableRbacAuthorization: true",
      "    enableSoftDelete: true",
      "    softDeleteRetentionInDays: 90",
      "    enablePurgeProtection: true",
      "    publicNetworkAccess: 'Disabled'",
      "    networkAcls: {",
      "      defaultAction: 'Deny'",
      "      bypass: 'AzureServices'",
      "    }",
      "  }",
      "}",
      "",
      "resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {",
      "  name: '${kvName}-pe'",
      "  location: location",
      "  properties: {",
      "    subnet: { id: vnetSubnetId }",
      "    privateLinkServiceConnections: [",
      "      {",
      "        name: '${kvName}-pls'",
      "        properties: {",
      "          privateLinkServiceId: kv.id",
      "          groupIds: ['vault']",
      "        }",
      "      }",
      "    ]",
      "  }",
      "}",
      "",
      "resource peDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {",
      "  parent: privateEndpoint",
      "  name: 'default'",
      "  properties: {",
      "    privateDnsZoneConfigs: [",
      "      {",
      "        name: 'default'",
      "        properties: { privateDnsZoneId: privateDnsZoneId }",
      "      }",
      "    ]",
      "  }",
      "}",
      "",
      "output kvUri string = kv.properties.vaultUri",
      "```",
      "",
      "### Terraform",
      "",
      "```hcl",
      "resource \"azurerm_key_vault\" \"kv\" {",
      "  name                       = \"kv-cloudlab-prod\"",
      "  location                   = \"eastus2\"",
      "  resource_group_name        = \"rg-prod\"",
      "  tenant_id                  = data.azurerm_client_config.current.tenant_id",
      "  sku_name                   = \"premium\"",
      "  enable_rbac_authorization  = true",
      "  soft_delete_retention_days = 90",
      "  purge_protection_enabled   = true",
      "  public_network_access_enabled = false",
      "",
      "  network_acls {",
      "    default_action = \"Deny\"",
      "    bypass         = \"AzureServices\"",
      "  }",
      "}",
      "",
      "resource \"azurerm_private_endpoint\" \"kv_pe\" {",
      "  name                = \"kv-pe\"",
      "  location            = \"eastus2\"",
      "  resource_group_name = \"rg-prod\"",
      "  subnet_id           = var.subnet_id",
      "",
      "  private_service_connection {",
      "    name                           = \"kv-pls\"",
      "    private_connection_resource_id = azurerm_key_vault.kv.id",
      "    subresource_names              = [\"vault\"]",
      "    is_manual_connection           = false",
      "  }",
      "",
      "  private_dns_zone_group {",
      "    name                 = \"default\"",
      "    private_dns_zone_ids = [var.private_dns_zone_id]",
      "  }",
      "}",
      "",
      "output \"kv_uri\" { value = azurerm_key_vault.kv.vault_uri }",
      "```",
    ].join("\n"),
    sortOrder: 19,
  },
  {
    slug: "hands-on-labs",
    title: "Hands-on Labs",
    category: "Hands-On Labs",
    sourcePage: "hands-on-labs.html",
    summary: "40+ structured, simulator-based lab exercises spanning Azure, Security, M365/ADDS, AKS/DevOps, and Network topics, each with a scenario, ordered steps, success criteria, and a hint.",
    bodyMarkdown: [
      "# Hands-on Labs",
      "",
      "40+ guided exercises (Beginner to Expert) using CloudLab simulators. Each lab includes a scenario, ordered steps, success criteria, and a hint.",
      "",
      "## Azure",
      "",
      "### Lab 1: Deploy your first VM with proper governance",
      "",
      "*Level: Beginner · Time: 20 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** Your manager wants you to deploy a Windows VM for a small file server pilot. They want it properly tagged, in a Resource Group, and secured.",
      "",
      "**Steps:**",
      "",
      "1. Open Azure simulator → Resource Groups → Create.",
      "2. Create RG named `rg-pilot-fileserver` in East US 2 with tags Environment=Pilot, Owner=you, CostCenter=IT-100.",
      "3. Inside the RG, create a VNet `vnet-pilot` (10.0.0.0/16) with subnet `web` (10.0.1.0/24).",
      "4. Create a Windows VM `vm-fs01`: Standard_D2s_v3, Windows Server 2022, attach to the subnet. NO public IP (use Bastion).",
      "5. Deploy Azure Bastion in the same VNet (or create AzureBastionSubnet).",
      "6. Connect via Bastion → verify Windows desktop loads.",
      "",
      "**Success criteria:** VM is running and reachable via Bastion. NSG default rules block direct internet. All resources have tags. No public IP on VM.",
      "",
      "**Hint:** Common mistake: forgetting AzureBastionSubnet must be named exactly that. Minimum /26.",
      "",
      "### Lab 2: Set up cost alerts for your subscription",
      "",
      "*Level: Beginner · Time: 15 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** You want to be alerted before your subscription bill spikes. Set a budget with 2 thresholds.",
      "",
      "**Steps:**",
      "",
      "1. Open Cost Management + Billing in Azure simulator.",
      "2. Create a budget: name \"Monthly-Pilot\", scope: subscription, amount: $500/month.",
      "3. Add threshold alerts: 80% of budget → email your address, 100% → also email manager.",
      "4. Optionally: attach an Action Group that pages on-call via webhook.",
      "5. View cost analysis and identify your top 3 cost drivers (if you have other resources).",
      "",
      "**Success criteria:** Budget created with at least 2 thresholds. Alerts are configured.",
      "",
      "**Hint:** Tag-based budget scope is more powerful than RG-scope — e.g. all resources with tag Environment=Production.",
      "",
      "### Lab 3: Build a hub-spoke network with Bastion",
      "",
      "*Level: Intermediate · Time: 40 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** Your company needs centralized network management. Build a hub VNet with shared services + 2 spoke VNets that workloads use.",
      "",
      "**Steps:**",
      "",
      "1. Create hub VNet `vnet-hub` (10.10.0.0/16). Add subnets: GatewaySubnet (10.10.0.0/27), AzureFirewallSubnet (10.10.1.0/26), AzureBastionSubnet (10.10.2.0/26), SharedServices (10.10.3.0/24).",
      "2. Create 2 spoke VNets: `vnet-spoke-prod` (10.20.0.0/16) and `vnet-spoke-dev` (10.30.0.0/16).",
      "3. Peer hub ↔ spoke-prod with \"Allow gateway transit\" on hub side and \"Use remote gateways\" on spoke side.",
      "4. Peer hub ↔ spoke-dev same way.",
      "5. Deploy Azure Firewall in AzureFirewallSubnet.",
      "6. Create UDR on spoke subnets: 0.0.0.0/0 → Firewall private IP. Force tunnel.",
      "7. Deploy a VM in each spoke. Verify outbound goes through firewall (check firewall logs).",
      "",
      "**Success criteria:** Hub-spoke peerings are healthy. Spoke VM can reach internet only via firewall. Firewall logs show the traffic.",
      "",
      "**Hint:** Gotcha: spoke-to-spoke traffic does NOT work by default (peering not transitive). Add UDR forcing inter-spoke through hub firewall.",
      "",
      "### Lab 4: Right-size a VM using metrics",
      "",
      "*Level: Intermediate · Time: 30 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** Finance flagged that vm-app-04 is expensive. Investigate, decide if it can be downsized, and execute.",
      "",
      "**Steps:**",
      "",
      "1. Open Azure Monitor → Metrics for vm-app-04.",
      "2. Check CPU percentage over last 30 days. Note: average, max, 95th percentile.",
      "3. Check Memory percentage (requires VM Insights agent).",
      "4. Check Disk IOPS + bandwidth.",
      "5. If avg CPU < 15% and avg Memory < 40% for 30 days → safe to downsize.",
      "6. Resize: VM → Size → Pick D4s_v5 (from current D8s_v5). Acknowledge that \"VM will restart\".",
      "7. After restart: verify app comes up. Monitor for 24h.",
      "",
      "**Success criteria:** You can read 30-day metrics. Resize succeeded. Cost savings calculated (~$80/month for D8 → D4).",
      "",
      "**Hint:** Production tip: drain traffic via LB first. For stateful: take snapshot before resize. Always have a rollback (re-resize up if app fails).",
      "",
      "### Lab 5: Design + deploy a 5-region landing zone",
      "",
      "*Level: Advanced · Time: 90 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** You are the cloud architect for a multinational. Design a landing zone for 5 regions, 3 BUs, dev/uat/prod environments.",
      "",
      "**Steps:**",
      "",
      "1. Plan the MG hierarchy on paper: Root → Platform (Identity/Mgmt/Connectivity) + Landing Zones (BU1/BU2/BU3) + Sandbox + Decommissioned.",
      "2. Create the MG hierarchy in Azure.",
      "3. In each region create a hub VNet for connectivity.",
      "4. Configure ExpressRoute + VPN for hybrid.",
      "5. Apply policy initiatives: Tag enforcement (Owner, Env, CostCenter), Region-allow list, VM SKU allow-list, Diagnostic settings DeployIfNotExists.",
      "6. Create the platform Sentinel workspace + Defender for Cloud at MG scope.",
      "7. Onboard a sample workload as a landing zone (3-tier app spoke).",
      "8. Document everything in Wiki / ADR records.",
      "",
      "**Success criteria:** MG hierarchy reflects the design. Policies applied at the right scope. Defender for Cloud secure score > 80%. Sample workload deployed.",
      "",
      "**Hint:** Don't do this without management approval — you are establishing rails the entire org will use. Get sign-off from app teams, finance, security, network leads first.",
      "",
      "## Security",
      "",
      "### Lab 1: Enable MFA + the 3 baseline CA policies",
      "",
      "*Level: Beginner · Time: 15 min · Simulator: `/simulators/m365/`*",
      "",
      "**Scenario:** You just inherited a M365 tenant. First thing: lock down admin access.",
      "",
      "**Steps:**",
      "",
      "1. Open M365 Admin Center → Security → Conditional Access (or directly Entra ID).",
      "2. CRITICAL FIRST: Create 2 break-glass accounts (e.g. breakglass1@cloudlab.in, breakglass2@cloudlab.in) with permanent Global Admin. Set MFA-exempt + FIDO2-only sign-in. Store passwords in physical safe.",
      "3. Create CA-Require-MFA-for-Admins: scope = directory role assignments, grant = require MFA.",
      "4. Create CA-Block-Legacy-Auth: scope = all users (exclude break-glass), client app = other clients, grant = block.",
      "5. Create CA-Require-MFA-for-All-Users: scope = all users (exclude break-glass), grant = require MFA. Start in Report-Only mode for 1 week.",
      "6. Watch the Sign-in logs daily for 1 week. After verifying no false positives, switch to On.",
      "",
      "**Success criteria:** Break-glass accounts exist + excluded from all CA. Legacy auth blocked. All admins forced to MFA.",
      "",
      "**Hint:** Without break-glass, you can lock yourself out. Microsoft support recovery takes hours.",
      "",
      "### Lab 2: Roll out passwordless with FIDO2",
      "",
      "*Level: Beginner · Time: 20 min · Simulator: `/simulators/m365/`*",
      "",
      "**Scenario:** You want to ditch passwords for IT admins. Configure FIDO2 + a pilot rollout.",
      "",
      "**Steps:**",
      "",
      "1. Entra ID → Authentication methods → FIDO2 Security Key. Enable for \"All users\" or pilot group.",
      "2. Configure key restriction policy (AAGUIDs of approved vendors, e.g. YubiKey 5).",
      "3. Procure 10 YubiKey 5 NFC for IT team.",
      "4. Enroll yourself: aka.ms/mfasetup → Add method → Security Key → register your YubiKey.",
      "5. Test: sign in to portal with YubiKey only (no password prompt if \"Passwordless sign-in\" config is on).",
      "6. Roll out training video to IT team.",
      "",
      "**Success criteria:** FIDO2 enabled in tenant. At least 1 user signed in passwordless.",
      "",
      "**Hint:** Allow FIDO2 to replace MFA, NOT just add another factor. Set Authentication Strengths → \"Phishing-resistant MFA\" + apply via CA to admins.",
      "",
      "### Lab 3: Build 5 Sentinel analytics rules for common attacks",
      "",
      "*Level: Intermediate · Time: 60 min · Simulator: `/simulators/sentinel/`*",
      "",
      "**Scenario:** New SOC tenant has 0 detections. Build a baseline detection set.",
      "",
      "**Steps:**",
      "",
      "1. Open Sentinel → Analytics → Rule wizard.",
      "2. Rule 1: Brute force on user accounts — SecurityEvent EventID 4625 grouped by Account with > 10 fails in 1h.",
      "3. Rule 2: Password spray — SigninLogs with 1 IP and > 5 distinct UPNs failed in 30 min.",
      "4. Rule 3: AS-REP roasting — KQL using `SecurityEvent | where EventID == 4768 and PreAuthType == 0`.",
      "5. Rule 4: OAuth consent to risky app — AuditLogs OperationName == \"Consent to application\" with high-permission scope (Mail.ReadWrite, Files.ReadWrite).",
      "6. Rule 5: Impossible travel — built-in Microsoft template + tune for known VPN IPs.",
      "7. Each rule: severity (High/Medium/Low), entity grouping (group by user/host), set up an incident.",
      "",
      "**Success criteria:** 5 rules deployed in Enabled state. Each has proper entity mapping. Severity matches business impact.",
      "",
      "**Hint:** Test each rule by simulating the attack pattern. Use Microsoft's Attack Simulator + the rule should fire within 5 min.",
      "",
      "### Lab 4: Investigate a simulated AiTM phishing incident",
      "",
      "*Level: Advanced · Time: 120 min · Simulator: `/simulators/sentinel/`*",
      "",
      "**Scenario:** Sentinel just fired \"Anomalous token issued from new device\". Walk the full IR cycle.",
      "",
      "**Steps:**",
      "",
      "1. Open the incident in Defender XDR. Read the entity graph: user, source IP, target sign-in.",
      "2. Confirm AiTM: SigninLogs filter for the user + check ConditionalAccessStatus + LocationDetails.",
      "3. Containment: revoke all refresh tokens (`Revoke-MgUserSignInSession`), disable account.",
      "4. Eradicate: search for OAuth consent grants in last 24h (`AuditLogs | where OperationName == \"Consent to application\"`). Revoke any unfamiliar app.",
      "5. Inbox rule audit: check MailboxAuditing for new forwarding rules added by attacker.",
      "6. Recover: force password reset, force MFA re-registration, enable user.",
      "7. Post-IR: document timeline, lessons learned, update CA to require token protection (preview).",
      "",
      "**Success criteria:** Account secured. No malicious OAuth grants. No mail forwarding rules. Post-IR report written.",
      "",
      "**Hint:** Real AiTM also leaves a session token in the attacker's hands. Token theft persists across password reset — must revoke tokens.",
      "",
      "### Lab 5: Build a Sentinel playbook to auto-disable on TruePositive",
      "",
      "*Level: Advanced · Time: 90 min · Simulator: `/simulators/sentinel/`*",
      "",
      "**Scenario:** Manual user-disable takes hours. Automate it via Logic Apps.",
      "",
      "**Steps:**",
      "",
      "1. Sentinel → Automation → Create playbook (Logic App). Trigger: \"When Microsoft Sentinel incident is created OR updated\".",
      "2. Condition: incident severity = High AND classification = TruePositive.",
      "3. Get entities: list user entities from incident.",
      "4. For each user: HTTP action → Microsoft Graph API → `PATCH /users/{id} { \"accountEnabled\": false }`. Use Managed Identity for auth.",
      "5. Revoke all refresh tokens for the user.",
      "6. Post a Teams adaptive card to #soc-alerts channel announcing the action with link to incident.",
      "7. Add the playbook to all High severity rules → Automation rule.",
      "",
      "**Success criteria:** Playbook runs in < 30 seconds end-to-end. Action audited in Entra. Teams notification arrives.",
      "",
      "**Hint:** Always require human approval for irreversible actions. Add an Adaptive Card with Approve/Deny + 4-hour timeout before disabling.",
      "",
      "## M365 / ADDS",
      "",
      "### Lab 1: Set up SPF + DKIM + DMARC for your domain",
      "",
      "*Level: Beginner · Time: 15 min · Simulator: `/simulators/m365/`*",
      "",
      "**Scenario:** Email from your domain is going to spam. Fix SPF + DKIM + DMARC.",
      "",
      "**Steps:**",
      "",
      "1. Verify SPF record: `v=spf1 include:spf.protection.outlook.com -all` for cloudlab.in.",
      "2. Enable DKIM: Defender portal → Email authentication settings → DKIM → Enable for cloudlab.in. Confirm 2 CNAME records added to DNS.",
      "3. Verify DKIM signing: send test email + view header → `Authentication-Results: dkim=pass`.",
      "4. Create DMARC TXT record: `v=DMARC1; p=none; rua=mailto:dmarc-reports@cloudlab.in; pct=100`. Start with p=none for 2 weeks.",
      "5. Receive aggregate reports for 2 weeks. Verify all legit senders pass.",
      "6. Move to p=quarantine; pct=25 for 1 week, then 50, 100.",
      "7. Finally: p=reject.",
      "",
      "**Success criteria:** All 3 records exist. Test email passes all 3 checks (SPF + DKIM + DMARC).",
      "",
      "**Hint:** Common typo: `~all` vs `-all`. ~all = soft fail (mark spam), -all = hard fail (reject). Start soft, harden later.",
      "",
      "### Lab 2: Migrate a user mailbox from on-prem to Exchange Online",
      "",
      "*Level: Intermediate · Time: 40 min · Simulator: `/simulators/m365/`*",
      "",
      "**Scenario:** Pilot user wants their on-prem mailbox migrated to EXO.",
      "",
      "**Steps:**",
      "",
      "1. Exchange admin center → Migration → Migration endpoint → Create with on-prem credentials.",
      "2. New migration batch → \"Migrate to Exchange Online\" → Cutover or Remote move.",
      "3. Select pilot user → assign EXO license first.",
      "4. Start migration: tracks status (progressing, completing, completed).",
      "5. After complete: verify user can log in via outlook.office.com.",
      "6. Update Outlook desktop autodiscover — should auto-redirect.",
      "7. Move MX record after all users migrated (for cutover) OR keep both running (for hybrid).",
      "",
      "**Success criteria:** Mailbox in EXO. User can sign in. Outlook desktop reconnects without help.",
      "",
      "**Hint:** For users with > 50 GB mailboxes: do them on weekends. The actual move can take 6+ hours per mailbox.",
      "",
      "### Lab 3: Build a CA policy for guest users with strict requirements",
      "",
      "*Level: Intermediate · Time: 30 min · Simulator: `/simulators/m365/`*",
      "",
      "**Scenario:** Guests should only access via compliant devices + MFA + session timeout 4h.",
      "",
      "**Steps:**",
      "",
      "1. Entra ID → Conditional Access → New policy.",
      "2. Name: CA-Guests-Strict.",
      "3. Users: Include \"All guest and external users\". Exclude break-glass.",
      "4. Cloud apps: All cloud apps.",
      "5. Conditions: Sign-in risk = Low + Medium + High (cover all guest sign-ins, not just risky).",
      "6. Grant controls: Require MFA + Require compliant device. Combine with AND.",
      "7. Session controls: Sign-in frequency = 4 hours. Persistent browser = never.",
      "8. Enable in Report-only first. Monitor 1 week.",
      "",
      "**Success criteria:** Policy active for all guests. Compliant device check works. 4-hour session enforced.",
      "",
      "**Hint:** Test with a real guest invite. CA gotchas: guests don't have Intune compliance — their device is \"Unknown\". Solution: B2B Direct Connect or Cross-tenant Access Settings.",
      "",
      "### Lab 4: Tier-0 admin isolation rollout",
      "",
      "*Level: Advanced · Time: 180 min · Simulator: `/simulators/adds/`*",
      "",
      "**Scenario:** Move all your admins from standing Global Admin to PIM-eligible + PAW + break-glass.",
      "",
      "**Steps:**",
      "",
      "1. Inventory: list all GAs, Schema Admins, Enterprise Admins, App Admins. ~10-30 in typical org.",
      "2. Create 2 break-glass accounts. Document storage in physical safe.",
      "3. Procure 10 PAW laptops. Win11 + Credential Guard + HVCI + AppLocker + no internet browsing.",
      "4. Each admin: create -admin suffix account separate from daily account.",
      "5. Move admin to PIM eligibility: max 8h activation, MFA required, justification + ticket required.",
      "6. Build access review: every 90 days, manager + CISO review who still needs eligibility.",
      "7. Decommission standing GA accounts gradually after PIM is working for 30 days.",
      "",
      "**Success criteria:** < 5 standing GA accounts (just break-glass). All admin work via -admin account on PAW. Access reviews running quarterly.",
      "",
      "**Hint:** This is a 3-6 month project. Pilot with IT team first. Don't try to roll all admins at once — you will have a revolt.",
      "",
      "## AKS / DevOps",
      "",
      "### Lab 1: Deploy your first AKS cluster",
      "",
      "*Level: Beginner · Time: 20 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** You need to deploy a small AKS cluster for a dev team. Make it production-ready.",
      "",
      "**Steps:**",
      "",
      "1. Azure CLI: `az aks create -g rg-aks-dev -n aks-dev --node-count 2 --enable-managed-identity --node-vm-size Standard_D2s_v5 --network-plugin azure --network-plugin-mode overlay`",
      "2. Get credentials: `az aks get-credentials -g rg-aks-dev -n aks-dev`",
      "3. Verify: `kubectl get nodes` should show 2 nodes.",
      "4. Deploy a sample app: `kubectl create deploy nginx --image=nginx --replicas=3`",
      "5. Expose: `kubectl expose deploy nginx --type=LoadBalancer --port=80`",
      "6. Get the external IP: `kubectl get svc nginx`. Open in browser.",
      "",
      "**Success criteria:** Cluster running. 3 pods serving traffic. External LB IP works.",
      "",
      "**Hint:** Avoid LoadBalancer in prod. Use AKS Application Routing addon (NGINX ingress) with TLS via cert-manager.",
      "",
      "### Lab 2: Set up CI/CD for a Container App",
      "",
      "*Level: Intermediate · Time: 60 min · Simulator: `/simulators/azure-devops/`*",
      "",
      "**Scenario:** Auto-deploy a containerized app to AKS on every commit to main.",
      "",
      "**Steps:**",
      "",
      "1. Create Azure Container Registry: `az acr create -n acrdev -g rg-aks-dev --sku Basic`",
      "2. Set up GitHub repo with Dockerfile + sample app.",
      "3. Configure Workload Identity Federation: create AAD app + federated credential for GitHub OIDC.",
      "4. Grant AAD app: AcrPush on ACR + AKS Cluster User on AKS.",
      "5. Build GitHub Actions workflow: 1) build image, 2) push to ACR, 3) deploy via kubectl set image.",
      "6. Test: push a commit, watch the workflow, verify pod gets new image.",
      "",
      "**Success criteria:** Image builds + pushes to ACR. AKS auto-rolls to new image. Zero secrets in repo (uses OIDC).",
      "",
      "**Hint:** Use semver image tags (1.0.0) not \"latest\" for prod. Pin in Helm chart for reproducible deploys.",
      "",
      "### Lab 3: Configure NetworkPolicy for pod-to-pod isolation",
      "",
      "*Level: Intermediate · Time: 90 min · Simulator: `/simulators/azure/`*",
      "",
      "**Scenario:** Multi-tenant cluster — team A pods should not reach team B pods.",
      "",
      "**Steps:**",
      "",
      "1. Enable AKS Network Policy: set `--network-policy cilium` at cluster create OR upgrade.",
      "2. Create namespace per team: `kubectl create ns team-a`, `kubectl create ns team-b`.",
      "3. Apply default-deny in each namespace: NetworkPolicy that denies all ingress + egress.",
      "4. Allow specific traffic: team-a-app needs to call team-a-db (allow). team-a-app needs to call shared kafka (allow).",
      "5. Test: `kubectl exec team-a-app -- curl team-b-svc:80` should fail (denied).",
      "6. Test: `kubectl exec team-a-app -- curl team-a-db:5432` should succeed.",
      "",
      "**Success criteria:** Cross-namespace traffic blocked. Same-namespace traffic works. Egress to internet still works (or controlled).",
      "",
      "**Hint:** Default-deny is harsh. Start with logging-only NetworkPolicy + see what breaks before flipping to deny.",
      "",
      "## Network",
      "",
      "### Lab 1: Configure OSPF in a 3-router topology",
      "",
      "*Level: Beginner · Time: 15 min · Simulator: `/simulators/network/`*",
      "",
      "**Scenario:** Build OSPF area 0 between 3 routers.",
      "",
      "**Steps:**",
      "",
      "1. Cisco sim → open R1.",
      "2. Configure interface IPs: R1 gi0/0 = 10.0.1.1/24, R1 gi0/1 = 10.0.12.1/24, etc.",
      "3. On each router: `router ospf 1` + `network <subnet> <wildcard> area 0` for each connected subnet.",
      "4. Verify: `show ip ospf neighbor` → should show 2 neighbors per router.",
      "5. Verify: `show ip route ospf` → should show learned routes via \"O\".",
      "6. Test: ping R3 from R1.",
      "",
      "**Success criteria:** All routers see each other as OSPF neighbors. Routes are learned. End-to-end ping works.",
      "",
      "**Hint:** Router ID conflict = no neighbors. Set explicit Router ID per router with `router-id 10.0.1.1`.",
      "",
      "### Lab 2: Set up site-to-site IPSec between Palo Alto + FortiGate",
      "",
      "*Level: Intermediate · Time: 45 min · Simulator: `/simulators/network/`*",
      "",
      "**Scenario:** Connect two sites with IPSec VPN. Site A = Palo Alto, Site B = FortiGate.",
      "",
      "**Steps:**",
      "",
      "1. On Palo Alto: configure IKE Gateway with peer IP + PSK + IKEv2 + crypto suite (AES256-SHA256).",
      "2. Configure IPSec tunnel: bind to IKE Gateway + IPSec crypto profile.",
      "3. Create tunnel interface tunnel.1 + assign IP from /30.",
      "4. On FortiGate: mirror config (same IKE proposals, same PSK, same encryption).",
      "5. On both: configure Phase 2 selectors (source/destination subnets must match exactly).",
      "6. Routing: on Palo, route remote subnet via tunnel.1. On Forti, route remote subnet via tunnel interface.",
      "7. Verify: `show vpn ipsec-sa` on Palo, `get vpn ipsec tunnel summary` on Forti.",
      "",
      "**Success criteria:** IKE Phase 1 + Phase 2 both up. Traffic flows both ways. Phase 2 keys rekey after timer.",
      "",
      "**Hint:** Mismatched proposals = phase 1 fails. Use `diagnose debug enable` + `diagnose debug application ike` on Forti to see exact mismatch.",
    ].join("\n"),
    sortOrder: 20,
  },
  {
    slug: "learning-paths",
    title: "Learning Paths",
    category: "Learning Paths",
    sourcePage: "learning-paths.html",
    summary: "Five week-by-week study plans (Junior Cloud Admin, Security Engineer, EUC/Endpoint Admin, Network Engineer, DevOps Engineer) mapping topics, simulator labs, and checkpoints to target certifications.",
    bodyMarkdown: [
      "# Learning Paths",
      "",
      "Five sequenced learning paths from Beginner to Architect across Azure, M365, Defender, Sentinel, Intune, AVD, and Azure DevOps. Each path maps topics and simulator-led labs to a target certification, week by week.",
      "",
      "## Junior Cloud Admin",
      "",
      "Most-hired Azure role. AZ-104 cert + hands-on portal experience opens 60-70% of cloud job listings.",
      "",
      "- **Target cert:** AZ-104",
      "- **Duration:** 10 weeks · 2-3 hours/day",
      "- **Total study:** ~140 hours across 10 weeks",
      "- **Salary range:** ₹4-8 LPA in India (0-2 yr exp)",
      "",
      "### Week 1: Azure fundamentals + Resource hierarchy (12 hours)",
      "",
      "**Topics:** Subscriptions, Management Groups, Resource Groups, Regions, AZ, Resources. Cost basics. RBAC roles vs Azure AD roles. Portal navigation.",
      "",
      "**Labs:**",
      "",
      "- Use Azure Portal sim → create 2 RGs, tag them, lock one with delete protection.",
      "- Cost Management sim → set a $100/mo budget alert.",
      "- Watch the 25-min Azure landing zone video on Microsoft Learn.",
      "",
      "**Checkpoint:** You can explain: subscription vs RG vs region in 1 minute.",
      "",
      "### Week 2: Entra ID + IAM (14 hours)",
      "",
      "**Topics:** Users, Groups (static + dynamic + assigned), B2B guests, Service Principals, Managed Identities, RBAC vs Entra roles, PIM basics, Conditional Access (basic policies).",
      "",
      "**Labs:**",
      "",
      "- Create 10 users in M365 Admin Center sim + dynamic group rule for \"Department eq Finance\".",
      "- Assign Reader role to a user at RG scope, then test in Portal sim.",
      "- Create a CA policy: Require MFA for admins.",
      "",
      "**Checkpoint:** You understand AGDLP and can explain when to use a Managed Identity.",
      "",
      "### Week 3: Storage (Blobs, Files, Disks) (12 hours)",
      "",
      "**Topics:** Storage account types (StorageV2 vs BlobStorage), tiers (Hot/Cool/Archive), redundancy (LRS/ZRS/GRS/RA-GZRS), Blob lifecycle, Storage account firewall + Private Endpoint.",
      "",
      "**Labs:**",
      "",
      "- Storage Account sim → upload 5 files, set lifecycle to move to Cool after 30 days.",
      "- Configure SAS token with read-only + expiry.",
      "- Enable Private Endpoint, test from VM in same VNet.",
      "",
      "**Checkpoint:** You can pick the right tier for: archive logs / daily reports / hot frontend.",
      "",
      "### Week 4: Virtual Networks (16 hours)",
      "",
      "**Topics:** VNet, subnets, NSG, ASG, peering, VNet integration, Service Endpoints, Private Endpoints, DNS in Azure (private DNS zones). NAT Gateway. Service Tags.",
      "",
      "**Labs:**",
      "",
      "- Build hub-spoke: 1 hub VNet + 2 spoke VNets, peer them, deploy a VM in each spoke and ping across.",
      "- Add NSG rules: allow SSH only from your home IP.",
      "- Configure NAT Gateway on outbound subnet.",
      "",
      "**Checkpoint:** You can troubleshoot a \"ping fails between subnets\" scenario using NSG + Effective Routes.",
      "",
      "### Week 5: Compute (VMs, App Service, Containers) (18 hours)",
      "",
      "**Topics:** VM SKUs (B/D/E/F/M families), pricing models (PAYG/Spot/Reserved/Savings Plan), App Service plans, App Service auto-scale, Containers basics (ACR, ACI, App Service for Containers).",
      "",
      "**Labs:**",
      "",
      "- Deploy a Windows VM with Bastion access (no public IP).",
      "- App Service: deploy a sample .NET app, configure auto-scale 1→10 by CPU > 70%.",
      "- Build a Docker image, push to ACR, run in App Service for Containers.",
      "",
      "**Checkpoint:** You can right-size a VM based on CPU + memory metrics.",
      "",
      "### Week 6: Storage performance + Disks + Backup (12 hours)",
      "",
      "**Topics:** Managed Disks (Standard HDD/SSD, Premium SSD, Ultra Disk), encryption (PMK vs CMK), Backup vault, VM backup policies, App-consistent snapshots, Snapshot copy across regions.",
      "",
      "**Labs:**",
      "",
      "- Resize a VM disk from Premium 128 GB → 256 GB without downtime.",
      "- Configure Azure Backup for the VM with daily 02:00 schedule.",
      "- Restore individual file from Backup.",
      "",
      "**Checkpoint:** You can recover a single deleted file from Backup in under 10 minutes.",
      "",
      "### Week 7: Monitoring + Log Analytics + Alerts (12 hours)",
      "",
      "**Topics:** Azure Monitor, Log Analytics workspace, Diagnostic settings, Activity Log vs Resource logs, KQL basics, Alerts (Metric / Log / Activity / Smart), Action Groups.",
      "",
      "**Labs:**",
      "",
      "- Send VM resource logs to Log Analytics workspace.",
      "- Write KQL: count failed logons from SecurityEvent in last 24h.",
      "- Create metric alert: VM CPU > 90% for 5 min → email.",
      "",
      "**Checkpoint:** You can write a basic KQL query and create an alert from it.",
      "",
      "### Week 8: Backup + Site Recovery + Governance (14 hours)",
      "",
      "**Topics:** Azure Site Recovery (ASR), Azure Backup vs ASR, Azure Policy initiatives, Recommendation engine (Advisor), Tags + cost allocation, Defender for Cloud Free tier.",
      "",
      "**Labs:**",
      "",
      "- Set up ASR replication for the VM to another region.",
      "- Apply Azure Policy: deny VM SKUs above D8s_v5.",
      "- Apply tag policy: all resources must have CostCenter tag.",
      "",
      "**Checkpoint:** You can deploy a 5-resource workload through ARM/Bicep template.",
      "",
      "### Week 9: Hybrid + AD + ExpressRoute basics (12 hours)",
      "",
      "**Topics:** Hybrid identity (Entra Connect, PHS/PTA/Federation), S2S VPN, ExpressRoute basics, AD on Azure VM vs Entra Domain Services, Domain join Azure VM.",
      "",
      "**Labs:**",
      "",
      "- Build a S2S VPN between simulated on-prem (local VNet) + Azure VNet.",
      "- Walk through Entra Connect sim wizard with PHS.",
      "- Domain-join an Azure VM to corp.cloudlab.local.",
      "",
      "**Checkpoint:** You can explain PHS vs PTA vs Federation.",
      "",
      "### Week 10: Exam prep + practice tests + review (18 hours)",
      "",
      "**Topics:** MeasureUp practice exam, MicrosoftLearn challenges, weak-area drill, hands-on review labs.",
      "",
      "**Labs:**",
      "",
      "- Take 2 full-length practice exams. Review every wrong answer.",
      "- Drill on Storage + Networking (commonly weak).",
      "- Schedule exam — pearsonvue.com.",
      "",
      "**Checkpoint:** Practice exam score > 80% consistently → schedule the real exam.",
      "",
      "End of path: schedule the AZ-104 exam at pearsonvue.com. Once passed, update LinkedIn and pursue the next role.",
      "",
      "## Security Engineer",
      "",
      "Security is the #1 demanded role in India IT. Two associate certs cover SOC analyst + Identity admin tracks.",
      "",
      "- **Target cert:** SC-200 + SC-300",
      "- **Duration:** 12 weeks · 2-3 hours/day",
      "- **Total study:** ~142 hours across 12 weeks",
      "- **Salary range:** ₹6-15 LPA in India",
      "",
      "### Week 1: Security concepts + Zero Trust (10 hours)",
      "",
      "**Topics:** Zero Trust model, CIA triad, MITRE ATT&CK, kill chain, defense in depth. CIS controls.",
      "",
      "**Labs:**",
      "",
      "- Read Microsoft Zero Trust paper.",
      "- Map your home network to the 5 Zero Trust pillars.",
      "- Read MITRE ATT&CK matrix for Enterprise → pick 3 techniques you can detect.",
      "",
      "**Checkpoint:** You can list MITRE ATT&CK tactics in order.",
      "",
      "### Week 2: Entra ID security (12 hours)",
      "",
      "**Topics:** CA policies, named locations, authentication strengths, MFA methods + phishing resistance, FIDO2, PIM.",
      "",
      "**Labs:**",
      "",
      "- Build the 6 \"Microsoft starter\" CA policies.",
      "- Configure PIM for Global Admin: 4-hour activation, MFA required, 2 approvers.",
      "- Set up FIDO2 key registration policy.",
      "",
      "**Checkpoint:** You can design a CA policy that blocks legacy auth without breaking IMAP for one exception group.",
      "",
      "### Week 3: Identity Protection (10 hours)",
      "",
      "**Topics:** Sign-in risk vs User risk, risk detections, risk-based CA, identity-secure-score.",
      "",
      "**Labs:**",
      "",
      "- Enable Sign-in risk policy: Medium → Require MFA.",
      "- Enable User risk policy: High → Require password change.",
      "- Trigger a fake risky sign-in (TOR Browser) and observe alert.",
      "",
      "**Checkpoint:** You can explain the difference between sign-in risk and user risk.",
      "",
      "### Week 4: PIM + Access Reviews (10 hours)",
      "",
      "**Topics:** PIM eligibility vs active, approval workflow, time-bound + tickets, access reviews, PAGs.",
      "",
      "**Labs:**",
      "",
      "- Make 5 admins PIM-eligible for Helpdesk Admin role.",
      "- Create a quarterly access review for all GA-eligible users.",
      "- Onboard sub-prod to PIM for Azure resources.",
      "",
      "**Checkpoint:** You ran 1 PIM activation as a test user and confirmed audit log entry.",
      "",
      "### Week 5: Defender for Office 365 (12 hours)",
      "",
      "**Topics:** Anti-phish, Anti-spam, Anti-malware, Safe Links, Safe Attachments. Preset Strict policies. Attack Simulator. Threat tracker.",
      "",
      "**Labs:**",
      "",
      "- Apply Standard preset policies to all users + Strict preset to executives.",
      "- Launch an Attack Simulator phish campaign against IT team.",
      "- Investigate a quarantined message and release one.",
      "",
      "**Checkpoint:** You can read the email entity graph and identify if a delivered email was ZAP-purged later.",
      "",
      "### Week 6: Defender XDR (14 hours)",
      "",
      "**Topics:** Defender for Endpoint, Defender for Identity, Defender for Cloud Apps. Incident triage. Live response.",
      "",
      "**Labs:**",
      "",
      "- Onboard a test endpoint to Defender for Endpoint.",
      "- Simulate AV detection (eicar test file) and observe incident creation.",
      "- Use Live Response shell to gather artifacts.",
      "",
      "**Checkpoint:** You completed a full incident triage from \"alert fires\" → \"investigation\" → \"containment\" → \"closure\".",
      "",
      "### Week 7: KQL deep dive (16 hours)",
      "",
      "**Topics:** where, project, summarize, extend, join, bin, render, parse, materialize, evaluate, lookup. Cross-table joins.",
      "",
      "**Labs:**",
      "",
      "- Drill 20 KQL queries from Sentinel KQL playground.",
      "- Build a workbook with 5 charts joining SigninLogs + AuditLogs.",
      "- Hunt for password spray pattern.",
      "",
      "**Checkpoint:** You can write KQL that joins 3 tables, filters by time, and renders a timechart.",
      "",
      "### Week 8: Sentinel rules + playbooks (14 hours)",
      "",
      "**Topics:** Analytics rules (Scheduled, Microsoft, NRT, Anomaly), Entity behaviors, Watchlists, Threat Intelligence, Playbooks (Logic Apps).",
      "",
      "**Labs:**",
      "",
      "- Build 3 custom analytics rules (Impossible travel / Password spray / OAuth consent).",
      "- Build a playbook that disables a user on incident close = TruePositive.",
      "- Import MITRE workbook + tune detections.",
      "",
      "**Checkpoint:** You have 5 working rules + 1 playbook deployed end-to-end.",
      "",
      "### Week 9: Defender for Cloud (Azure security) (10 hours)",
      "",
      "**Topics:** Defender plans per workload (Servers / SQL / Storage / Containers / Key Vault / Resource Manager / DNS). Secure Score. Regulatory compliance.",
      "",
      "**Labs:**",
      "",
      "- Enable Defender for Servers on 1 VM.",
      "- Run a vulnerability scan with the built-in TVM.",
      "- Apply NIST 800-53 R5 initiative + remediate top 5 findings.",
      "",
      "**Checkpoint:** You can read Secure Score breakdown and propose 3 actions to raise it.",
      "",
      "### Week 10: Threat intelligence + Hunting (12 hours)",
      "",
      "**Topics:** TI integration (TAXII, MISP), IoC management, Advanced Hunting tables in MDE/Sentinel.",
      "",
      "**Labs:**",
      "",
      "- Import a TAXII feed into Sentinel.",
      "- Hunt for IoC across DeviceProcessEvents + EmailEvents.",
      "- Build a hunt for \"process spawned from Outlook\"",
      "",
      "**Checkpoint:** You can write a hunt that finds Office → cmd.exe → curl.exe chain.",
      "",
      "### Week 11: Compliance basics (SC-400 prep optional) (8 hours)",
      "",
      "**Topics:** Sensitivity labels + DLP + IRM at a high level. Purview overview.",
      "",
      "**Labs:**",
      "",
      "- Configure 4 sensitivity labels (Public / Internal / Confidential / Highly Confidential).",
      "- Build a DLP policy blocking PCI in Exchange + Endpoint.",
      "- Enable Audit Premium + verify retention.",
      "",
      "**Checkpoint:** You can explain when to use labels vs DLP vs retention.",
      "",
      "### Week 12: Exam prep + review (14 hours)",
      "",
      "**Topics:** SC-200 practice test, SC-300 practice test, weak-area drills.",
      "",
      "**Labs:**",
      "",
      "- Take SC-200 + SC-300 practice exams. Score > 80% twice in a row before booking.",
      "",
      "**Checkpoint:** Both certs scheduled and on track.",
      "",
      "End of path: schedule the SC-200 + SC-300 exam at pearsonvue.com. Once passed, update LinkedIn and pursue the next role.",
      "",
      "## EUC / Endpoint Admin",
      "",
      "Every org migrating from SCCM → Intune needs EUC admins. MD-102 + MS-700 are the dual-cert path for modern desktop + Teams.",
      "",
      "- **Target cert:** MD-102 + MS-700",
      "- **Duration:** 10 weeks · 2-3 hours/day",
      "- **Total study:** ~114 hours across 10 weeks",
      "- **Salary range:** ₹4-10 LPA in India",
      "",
      "### Week 1: Intune basics + Tenant setup (10 hours)",
      "",
      "**Topics:** Endpoint Manager portal, tenant attach, RBAC, scope tags, filters, assignments.",
      "",
      "**Labs:**",
      "",
      "- Tour Intune sim. Create RBAC role for helpdesk: \"View only\" on devices.",
      "- Configure scope tag for \"EU-Region\" devices.",
      "",
      "**Checkpoint:** You understand assignment groups vs filters.",
      "",
      "### Week 2: Device enrollment (12 hours)",
      "",
      "**Topics:** Windows Autopilot (User-driven / Self-deploy / Pre-provisioning), iOS Apple Business Manager, Android Enterprise (BYOD / Corporate-owned).",
      "",
      "**Labs:**",
      "",
      "- Configure Autopilot profile + Enrollment Status Page (ESP).",
      "- Walk through iOS enrollment with Apple ABM.",
      "- Set up Android Enterprise Work Profile.",
      "",
      "**Checkpoint:** You can list the difference between User-driven and Self-deploy Autopilot.",
      "",
      "### Week 3: Device compliance + Conditional Access (12 hours)",
      "",
      "**Topics:** Compliance policies (Windows + iOS + Android), CA \"Require compliant device\", Defender for Endpoint risk score, Mobile Threat Defense.",
      "",
      "**Labs:**",
      "",
      "- Build Win11 compliance policy: BitLocker + Defender + OS version.",
      "- CA policy: Require compliant device for Exchange + SharePoint.",
      "- Mark a non-compliant device and verify CA blocks email.",
      "",
      "**Checkpoint:** A non-compliant test device cannot access M365.",
      "",
      "### Week 4: Configuration profiles (12 hours)",
      "",
      "**Topics:** Settings Catalog (modern), Admin Templates (ADMX), Custom OMA-URI, Wi-Fi + VPN + Certificates.",
      "",
      "**Labs:**",
      "",
      "- Deploy a Settings Catalog profile: enforce screen lock + disable USB storage.",
      "- Deploy a Wi-Fi profile to corporate SSID.",
      "- Deploy a certificate via SCEP + Intune Cert Connector.",
      "",
      "**Checkpoint:** You can migrate 1 GPO setting → Intune Settings Catalog.",
      "",
      "### Week 5: App deployment (Win32 + Store + LOB) (14 hours)",
      "",
      "**Topics:** Win32 packaging (.intunewin), detection rules, requirement rules, dependencies, MSIX, M365 Apps, Edge, Store apps (new).",
      "",
      "**Labs:**",
      "",
      "- Package a Win32 app (.intunewin) with custom detection script.",
      "- Deploy M365 Apps with semi-annual channel.",
      "- Deploy an Edge configuration policy.",
      "",
      "**Checkpoint:** You can troubleshoot a Win32 app stuck at \"Install pending\" using IntuneManagementExtension.log.",
      "",
      "### Week 6: Endpoint Security (12 hours)",
      "",
      "**Topics:** Defender for Endpoint integration, ASR rules, Disk encryption (BitLocker), Firewall, AppLocker / WDAC, Antivirus policies.",
      "",
      "**Labs:**",
      "",
      "- Onboard endpoints to MDE via Intune.",
      "- Enable 16 ASR rules in audit mode → review impact in MDE → flip to block.",
      "- BitLocker policy with recovery key escrow to Entra.",
      "",
      "**Checkpoint:** You ran \"View ASR events\" report and made one tuning decision.",
      "",
      "### Week 7: Reports + Endpoint Analytics (8 hours)",
      "",
      "**Topics:** Operational reports, Historical reports, Endpoint Analytics (Startup performance, App reliability, Proactive remediations), Update compliance.",
      "",
      "**Labs:**",
      "",
      "- Review Endpoint Analytics report for your fleet.",
      "- Build a Proactive Remediation script that fixes a known issue.",
      "- Build an Update Ring rollout pattern (Pilot → Broad).",
      "",
      "**Checkpoint:** You can identify slowest 10 endpoints + propose a remediation.",
      "",
      "### Week 8: Teams admin basics (MS-700 prep) (12 hours)",
      "",
      "**Topics:** Teams policies (Messaging / Meeting / Calling / App), Teams lifecycle, Live Events, Direct Routing basics.",
      "",
      "**Labs:**",
      "",
      "- Configure 3 Teams policies + assign to security groups.",
      "- Set up a Live Event policy.",
      "- Walk through Direct Routing config.",
      "",
      "**Checkpoint:** You can lock down anonymous join + recording per policy.",
      "",
      "### Week 9: Microsoft Tunnel + ZTNA basics (8 hours)",
      "",
      "**Topics:** Microsoft Tunnel Gateway (Linux), VPN profile via Intune, Global Secure Access basics.",
      "",
      "**Labs:**",
      "",
      "- Deploy Microsoft Tunnel Gateway in Azure VM.",
      "- Push a Tunnel VPN profile to a mobile device.",
      "- Compare with Global Secure Access.",
      "",
      "**Checkpoint:** You can sketch a per-app VPN architecture.",
      "",
      "### Week 10: Exam prep + practice (14 hours)",
      "",
      "**Topics:** MD-102 + MS-700 practice tests, weak-area drills.",
      "",
      "**Labs:**",
      "",
      "- Score > 80% twice. Schedule both exams in same week to save energy.",
      "",
      "**Checkpoint:** Both certs scheduled.",
      "",
      "End of path: schedule the MD-102 + MS-700 exam at pearsonvue.com. Once passed, update LinkedIn and pursue the next role.",
      "",
      "## Network Engineer",
      "",
      "Network is the foundation of cloud. AZ-700 + CCNA combo opens enterprise NOC + cloud network engineering roles.",
      "",
      "- **Target cert:** AZ-700 + CCNA",
      "- **Duration:** 12 weeks · 2-3 hours/day",
      "- **Total study:** ~144 hours across 12 weeks",
      "- **Salary range:** ₹5-15 LPA in India",
      "",
      "### Week 1: Networking fundamentals (14 hours)",
      "",
      "**Topics:** OSI model, TCP vs UDP, subnetting, CIDR, public vs private IPs, NAT, DNS basics.",
      "",
      "**Labs:**",
      "",
      "- Drill 10 subnetting problems with /30 to /16 split.",
      "- Wireshark sim: capture a DNS query + identify resolver chain.",
      "- Build mental map of OSI layers + tools at each layer.",
      "",
      "**Checkpoint:** You can subnet 10.0.0.0/16 into 16 equal subnets by hand.",
      "",
      "### Week 2: Routing concepts (12 hours)",
      "",
      "**Topics:** Static vs dynamic routing, RIP/OSPF/EIGRP/BGP fundamentals, default route, route table, longest prefix match.",
      "",
      "**Labs:**",
      "",
      "- Cisco sim: build a 3-router OSPF area 0.",
      "- Trace a packet from R1 → R2 → R3 + watch the route table updates.",
      "",
      "**Checkpoint:** You understand OSPF DR/BDR + area design.",
      "",
      "### Week 3: Switching + VLAN + STP (12 hours)",
      "",
      "**Topics:** Access vs Trunk, 802.1Q tags, Native VLAN, Voice VLAN, STP/RSTP/PVST, Etherchannel.",
      "",
      "**Labs:**",
      "",
      "- Cisco sim: build 3-switch + 2-router setup. Configure trunks + STP root.",
      "- Meraki sim: build VLANs for Data + Voice + Guest + Mgmt.",
      "",
      "**Checkpoint:** You can manually trace which switch becomes STP root.",
      "",
      "### Week 4: WiFi (WPA3 + 802.1X) (10 hours)",
      "",
      "**Topics:** WiFi 6/6E/7, WPA3-PSK vs WPA3-Enterprise, EAP-TLS, EAP-TTLS, NPS RADIUS.",
      "",
      "**Labs:**",
      "",
      "- Meraki sim: configure WPA3-Enterprise with corporate RADIUS.",
      "- ADDS sim: configure NPS as RADIUS server with cert-based EAP-TLS.",
      "- Walk through cert lifecycle (CA issues cert, NPS validates).",
      "",
      "**Checkpoint:** You can join a WPA3-Enterprise WiFi from a domain-joined laptop.",
      "",
      "### Week 5: Firewall + Security (14 hours)",
      "",
      "**Topics:** Stateful firewall, Layer 4 vs Layer 7, NAT/PAT, IPSec VPN, SSL VPN, IDS/IPS.",
      "",
      "**Labs:**",
      "",
      "- Palo Alto sim: build security policies for inside → outside.",
      "- FortiGate sim: build IPSec VPN to second site.",
      "- Cisco sim: configure ACL on router interface.",
      "",
      "**Checkpoint:** You can troubleshoot \"VPN tunnel up but no traffic\" using phase 2 SAs.",
      "",
      "### Week 6: Cloud networking (Azure) (14 hours)",
      "",
      "**Topics:** VNet, peering, subnets, NSG, ASG, Service Tags, Route tables, Forced tunneling, Service Endpoints, Private Endpoints.",
      "",
      "**Labs:**",
      "",
      "- Azure VNet sim: build hub-spoke + force tunnel + NVA inspection.",
      "- Configure Private Endpoint for Storage + DNS resolution.",
      "",
      "**Checkpoint:** You can debug a \"VM cannot reach Storage\" with Network Watcher Connection Troubleshoot.",
      "",
      "### Week 7: Azure VPN + ExpressRoute (12 hours)",
      "",
      "**Topics:** S2S VPN (Active/Active, BGP), Point-to-Site, ExpressRoute (Private vs Microsoft peering), ER FastPath.",
      "",
      "**Labs:**",
      "",
      "- Azure VPN sim: configure A/A S2S VPN + BGP.",
      "- Walk through ExpressRoute provisioning steps + circuit health.",
      "",
      "**Checkpoint:** You can troubleshoot why one of two BGP peers is down.",
      "",
      "### Week 8: Azure load balancing (10 hours)",
      "",
      "**Topics:** Application Gateway (L7), Azure Load Balancer (L4), Traffic Manager (DNS), Front Door (global), private LB vs public.",
      "",
      "**Labs:**",
      "",
      "- Build internal LB for backend pool.",
      "- Build App Gateway with WAF + path-based routing.",
      "- Configure Front Door with health probes + multi-region failover.",
      "",
      "**Checkpoint:** You can pick the right LB for: regional HTTPS / global HTTPS / TCP / DNS.",
      "",
      "### Week 9: Cisco IOS deep + BGP (12 hours)",
      "",
      "**Topics:** Cisco IOS basics, IOS-XE, BGP attributes (Local Pref, AS path, MED), route maps, prefix-lists, route-reflectors.",
      "",
      "**Labs:**",
      "",
      "- Cisco sim: build 3-router iBGP mesh + 1 eBGP to ISP.",
      "- Configure prefix-list to block private networks from outbound.",
      "- Diagnose AS path prepending strategy.",
      "",
      "**Checkpoint:** You can read \"show ip bgp\" output and trace AS path.",
      "",
      "### Week 10: SD-WAN basics (Meraki / Velocloud / Versa) (8 hours)",
      "",
      "**Topics:** SD-WAN concepts, uplink monitoring, dynamic path selection, Auto-VPN, SD-WAN policies.",
      "",
      "**Labs:**",
      "",
      "- Meraki sim: build 4-site SD-WAN with dual ISP + traffic shaping.",
      "",
      "**Checkpoint:** You can explain why an MPLS-only org would adopt SD-WAN.",
      "",
      "### Week 11: Monitoring + Troubleshooting (10 hours)",
      "",
      "**Topics:** Wireshark deep, MTR, tcpdump, Network Watcher (Connection Monitor, IP Flow Verify, Effective Routes).",
      "",
      "**Labs:**",
      "",
      "- Wireshark: diagnose a slow TCP transfer (window scaling, retransmissions).",
      "- Diagnose VoIP jitter with RTP analysis.",
      "",
      "**Checkpoint:** You can read a Wireshark capture and identify TCP retransmission cause.",
      "",
      "### Week 12: Exam prep (16 hours)",
      "",
      "**Topics:** AZ-700 practice exam, CCNA practice exam, weak areas.",
      "",
      "**Labs:**",
      "",
      "- Both exams scored 80%+ twice. Schedule.",
      "",
      "**Checkpoint:** Both certs scheduled.",
      "",
      "End of path: schedule the AZ-700 + CCNA exam at pearsonvue.com. Once passed, update LinkedIn and pursue the next role.",
      "",
      "## DevOps Engineer",
      "",
      "Highest-paid Azure track. AZ-104 base + AZ-400 expert opens platform engineering, DevOps, SRE roles.",
      "",
      "- **Target cert:** AZ-400 + AZ-104",
      "- **Duration:** 14 weeks · 2-3 hours/day",
      "- **Total study:** ~160 hours across 14 weeks",
      "- **Salary range:** ₹8-22 LPA in India",
      "",
      "### Week 1: Git + GitHub fundamentals (10 hours)",
      "",
      "**Topics:** Git basics, branching strategies (Git Flow vs Trunk-based), PR workflow, code review, GitHub vs GitLab vs Azure Repos.",
      "",
      "**Labs:**",
      "",
      "- Build a feature branch → PR → merge workflow on a sample repo.",
      "- Configure branch policies (require reviewers, build validation).",
      "",
      "**Checkpoint:** You can resolve a merge conflict and rebase cleanly.",
      "",
      "### Week 2: CI/CD pipelines (Azure DevOps) (14 hours)",
      "",
      "**Topics:** YAML pipelines, multi-stage, templates, variable groups, environments, approvals, artifacts.",
      "",
      "**Labs:**",
      "",
      "- Build a multi-stage YAML: Build → Test → Stage → Prod with manual approval.",
      "- Use templates for reusable steps.",
      "- Sign artifact + publish to Azure Artifacts feed.",
      "",
      "**Checkpoint:** Pipeline runs cleanly from commit → prod with 2 approvers.",
      "",
      "### Week 3: GitHub Actions (10 hours)",
      "",
      "**Topics:** Workflow syntax, runners (GitHub-hosted vs self-hosted), Marketplace actions, environments + secrets, OIDC to Azure.",
      "",
      "**Labs:**",
      "",
      "- Same pipeline as week 2 but in GitHub Actions.",
      "- Configure OIDC federated credential → no SP secret.",
      "- Self-host a runner on Azure VM.",
      "",
      "**Checkpoint:** Pipeline runs without long-lived secrets.",
      "",
      "### Week 4: Docker + containers (12 hours)",
      "",
      "**Topics:** Image vs container, layered FS, multi-stage builds, multi-arch, distroless, BuildKit cache.",
      "",
      "**Labs:**",
      "",
      "- Containerize a .NET app with multi-stage Dockerfile.",
      "- Build for amd64 + arm64.",
      "- Scan for vulnerabilities with Trivy.",
      "",
      "**Checkpoint:** Image is < 200 MB + 0 critical CVEs.",
      "",
      "### Week 5: Kubernetes basics (14 hours)",
      "",
      "**Topics:** Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, Namespaces, RBAC, NetworkPolicy.",
      "",
      "**Labs:**",
      "",
      "- Deploy a 3-tier app on local kubectl / kind.",
      "- Helm install nginx-ingress + cert-manager.",
      "- Apply NetworkPolicy + RBAC.",
      "",
      "**Checkpoint:** You can debug a CrashLoopBackOff pod with describe + logs.",
      "",
      "### Week 6: AKS deep (14 hours)",
      "",
      "**Topics:** AKS cluster types, node pools, Workload Identity, AKS Application Routing, Network Policy (Cilium), Azure RBAC vs K8s RBAC, AKS upgrade strategy.",
      "",
      "**Labs:**",
      "",
      "- Deploy AKS with Workload Identity + Azure CNI Overlay.",
      "- Pull image from ACR via WI.",
      "- Blue-green node pool upgrade.",
      "",
      "**Checkpoint:** You can upgrade AKS minor version with zero downtime.",
      "",
      "### Week 7: IaC with Terraform (14 hours)",
      "",
      "**Topics:** HCL syntax, modules, state (local vs remote), providers, workspaces, drift detection, plan vs apply.",
      "",
      "**Labs:**",
      "",
      "- Write Terraform for VNet + AKS + ACR.",
      "- Use remote state in Azure Storage with state locking.",
      "- Drift detection via terraform plan.",
      "",
      "**Checkpoint:** You can build a reusable module + version-pin providers.",
      "",
      "### Week 8: IaC with Bicep (8 hours)",
      "",
      "**Topics:** Bicep DSL, modules, what-if, deployment scopes, decompile from ARM.",
      "",
      "**Labs:**",
      "",
      "- Build Bicep equivalent of week 7's Terraform.",
      "- Compare what-if vs terraform plan.",
      "",
      "**Checkpoint:** You can pick Bicep vs Terraform for a project.",
      "",
      "### Week 9: Observability (Prometheus + Grafana + OTel) (12 hours)",
      "",
      "**Topics:** Managed Prometheus, Grafana, Application Insights, OpenTelemetry, log/metric/trace.",
      "",
      "**Labs:**",
      "",
      "- Wire AKS workload to managed Prometheus.",
      "- Build Grafana dashboard with SLOs + alerts.",
      "- Instrument app with OTel SDK.",
      "",
      "**Checkpoint:** You can answer: \"what is p95 latency last 24h?\" in <30s.",
      "",
      "### Week 10: GitOps with ArgoCD (10 hours)",
      "",
      "**Topics:** GitOps principles, ArgoCD, FluxCD, sync waves, app-of-apps pattern.",
      "",
      "**Labs:**",
      "",
      "- Install ArgoCD on AKS.",
      "- Sync a sample app from GitHub.",
      "- Implement app-of-apps with sync waves.",
      "",
      "**Checkpoint:** Push to git → automatic deployment within 3 min.",
      "",
      "### Week 11: Secret management (8 hours)",
      "",
      "**Topics:** Azure Key Vault, CSI driver, External Secrets Operator, sealed-secrets, SOPS.",
      "",
      "**Labs:**",
      "",
      "- Mount Key Vault secret as Pod env via CSI driver.",
      "- Compare ESO vs CSI.",
      "",
      "**Checkpoint:** No secrets in git or pod YAML.",
      "",
      "### Week 12: Security in pipelines (10 hours)",
      "",
      "**Topics:** SAST (SonarQube, CodeQL), DAST, SCA, secret scanning, container scanning, IaC scanning (Checkov).",
      "",
      "**Labs:**",
      "",
      "- Add SonarQube + CodeQL + Trivy + Checkov to the pipeline.",
      "- Fail build on Critical CVE.",
      "",
      "**Checkpoint:** Pipeline has 5+ security gates.",
      "",
      "### Week 13: SRE basics (8 hours)",
      "",
      "**Topics:** SLI/SLO/SLA, error budget, post-mortem, toil reduction, runbooks.",
      "",
      "**Labs:**",
      "",
      "- Define 3 SLOs for the sample app.",
      "- Calculate remaining error budget for the month.",
      "",
      "**Checkpoint:** You can define SLI for \"request availability\" + \"p95 latency\".",
      "",
      "### Week 14: Exam prep AZ-400 (16 hours)",
      "",
      "**Topics:** AZ-400 practice exam, case studies.",
      "",
      "**Labs:**",
      "",
      "- Score 80%+ twice. Schedule.",
      "",
      "**Checkpoint:** AZ-400 scheduled.",
      "",
      "End of path: schedule the AZ-400 + AZ-104 exam at pearsonvue.com. Once passed, update LinkedIn and pursue the next role.",
    ].join("\n"),
    sortOrder: 21,
  },
];
