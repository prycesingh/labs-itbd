/**
 * Glossary seed data — extracted from the source itbd-lab static site
 * (glossary.html). Used by the one-time admin seed endpoint to populate
 * labs_glossary_terms; not read directly at request time.
 */

export type GlossarySeedTerm = {
  term: string;
  category: string;
  definition: string;
  example?: string;
};

export const GLOSSARY_SEED: GlossarySeedTerm[] = [
  {
    "term": "Active Directory (AD)",
    "category": "Identity",
    "definition": "Microsoft directory service for Windows networks. Stores users, computers, groups, GPOs. Domain-joined devices authenticate against AD.",
    "example": "On-prem login to corp.cloudlab.local."
  },
  {
    "term": "Active Directory Domain Services (AD DS)",
    "category": "Identity",
    "definition": "The AD role that provides authentication and directory services for a Windows domain.",
    "example": "A Domain Controller runs AD DS."
  },
  {
    "term": "AD CS (Active Directory Certificate Services)",
    "category": "Identity",
    "definition": "Issues + manages X.509 certificates inside your AD environment — enterprise PKI.",
    "example": "Issuing certs for 802.1X, S/MIME, code signing."
  },
  {
    "term": "ADFS",
    "category": "Identity",
    "definition": "Active Directory Federation Services. Federated identity, SAML/WS-Fed identity provider. Largely replaced by Entra ID Pass-through + Seamless SSO.",
    "example": "Legacy SAML SSO to Salesforce."
  },
  {
    "term": "AGDLP",
    "category": "Identity",
    "definition": "Account → Global group → Domain Local group → Permission. AD best practice for permission inheritance.",
    "example": "User → \"HR-Staff\" → \"HR-FS01-Modify\" → NTFS modify on \\\\fs01\\hr$."
  },
  {
    "term": "AiTM (Adversary-in-the-Middle)",
    "category": "Security",
    "definition": "Modern phishing technique where attacker reverse-proxies the login page to steal the session token AFTER MFA. Defends: token binding, CA on token replay, phishing-resistant MFA.",
    "example": "Evilginx attacks against M365 login."
  },
  {
    "term": "AAD Connect (Entra Connect)",
    "category": "Identity",
    "definition": "Sync tool from on-prem AD to Entra ID. Modes: PHS (password hash sync), PTA (pass-through auth), Federation (ADFS).",
    "example": "Syncing 5000 on-prem users to M365 tenant."
  },
  {
    "term": "Application proxy",
    "category": "Identity",
    "definition": "Entra ID feature to publish on-prem web apps externally via Entra reverse proxy. Replaced by Global Secure Access.",
    "example": "SAP web GUI accessed outside corp network without VPN."
  },
  {
    "term": "Authentication strength",
    "category": "Identity",
    "definition": "Entra Conditional Access primitive that defines which authentication methods are acceptable for a given policy.",
    "example": "\"Phishing-resistant\" strength requires FIDO2 or Windows Hello."
  },
  {
    "term": "B2B / B2C",
    "category": "Identity",
    "definition": "B2B = External business users (guests) in your tenant. B2C = Customer Identity (your own user-facing apps), separate tenant.",
    "example": "Inviting a partner to Teams = B2B. Login-with-Google on your e-commerce site = B2C."
  },
  {
    "term": "Break-glass account",
    "category": "Identity",
    "definition": "Emergency admin account with permanent Global Admin, excluded from MFA + CA. Used when normal auth is broken. Locked in physical safe.",
    "example": "breakglass1@cloudlab.in — never logs in normally."
  },
  {
    "term": "Conditional Access (CA)",
    "category": "Identity",
    "definition": "If-this-then-that rules at sign-in. Conditions check user/app/device/location/risk → Grant/Block + session controls.",
    "example": "Block legacy auth, Require MFA from non-corp networks."
  },
  {
    "term": "Continuous Access Evaluation (CAE)",
    "category": "Identity",
    "definition": "Real-time revocation of access tokens when user/device state changes. Replaces 1-hour token lifetime delay.",
    "example": "User offboarding → CAE forces sign-out within 5 minutes."
  },
  {
    "term": "Domain Controller (DC)",
    "category": "Identity",
    "definition": "A Windows Server running AD DS. Holds a writable copy of the AD database. Authenticates domain users.",
    "example": "DC01, DC02 in a typical setup with FSMO roles split."
  },
  {
    "term": "Entra ID (Azure AD)",
    "category": "Identity",
    "definition": "Microsoft cloud identity service. Successor name for Azure AD. Identity layer for M365, Azure, and 3rd-party SaaS.",
    "example": "Signing into outlook.office365.com authenticates against Entra ID."
  },
  {
    "term": "Federation",
    "category": "Identity",
    "definition": "Identity provider trust between systems. ADFS federates AD with apps. Entra ID federates with external IdPs (Okta, Ping).",
    "example": "SAML federation between Entra and Workday."
  },
  {
    "term": "FIDO2",
    "category": "Identity",
    "definition": "Phishing-resistant authentication standard. Hardware keys (YubiKey, Feitian) or platform authenticators (Windows Hello, Touch ID).",
    "example": "YubiKey 5 NFC for SOC analysts."
  },
  {
    "term": "FSMO (Flexible Single Master Operations)",
    "category": "Identity",
    "definition": "5 specialized DC roles that handle changes requiring single source of truth. Schema Master, Domain Naming, RID, PDC Emulator, Infrastructure.",
    "example": "PDC Emulator is the authoritative time source."
  },
  {
    "term": "GPO (Group Policy Object)",
    "category": "Identity",
    "definition": "Container for AD policy settings. Linked to OU/Site/Domain to apply settings to computers + users.",
    "example": "GPO \"Lock screen after 5 min\" linked to Workstations OU."
  },
  {
    "term": "IGA (Identity Governance)",
    "category": "Identity",
    "definition": "Lifecycle management of identity rights: provisioning, certification, access reviews, entitlement management.",
    "example": "Entra ID Identity Governance for SOX audits."
  },
  {
    "term": "JIT (Just-In-Time)",
    "category": "Identity",
    "definition": "On-demand privilege elevation. Privileged Identity Management is the JIT model for Entra/Azure roles.",
    "example": "Helpdesk admin activates role for 4-hour shift."
  },
  {
    "term": "Kerberos",
    "category": "Identity",
    "definition": "Network authentication protocol used in AD. Tickets (TGT, ST) issued by KDC. Replaces NTLM.",
    "example": "Workstation logon uses Kerberos to authenticate to DC."
  },
  {
    "term": "LAPS (Windows LAPS)",
    "category": "Identity",
    "definition": "Local Administrator Password Solution. Auto-rotates local admin passwords + escrows to AD or Entra ID.",
    "example": "Recover laptop local password when domain is unreachable."
  },
  {
    "term": "Managed Identity",
    "category": "Identity",
    "definition": "Azure-managed service principal for Azure resources. No secrets to rotate. System-assigned vs User-assigned.",
    "example": "VM uses its system-assigned MI to read from Key Vault."
  },
  {
    "term": "MFA (Multi-Factor Authentication)",
    "category": "Identity",
    "definition": "Two or more factors: something you know (password) + something you have (phone, key) + something you are (biometric).",
    "example": "Authenticator push notification after entering password."
  },
  {
    "term": "NTLM",
    "category": "Identity",
    "definition": "Legacy Windows challenge-response authentication. Phased out in modern AD — vulnerable to pass-the-hash and relay attacks.",
    "example": "Disable NTLM step-by-step via audit policy first."
  },
  {
    "term": "OAuth 2.0",
    "category": "Identity",
    "definition": "Authorization framework (not authentication). Issues access tokens for an app to call APIs on user's behalf.",
    "example": "App requests Mail.Send scope to send email via Graph."
  },
  {
    "term": "OIDC",
    "category": "Identity",
    "definition": "OpenID Connect — authentication layer on top of OAuth 2.0. Issues ID tokens.",
    "example": "Sign in with Microsoft on a 3rd-party site."
  },
  {
    "term": "OU (Organizational Unit)",
    "category": "Identity",
    "definition": "AD container. Delegate admin + link GPOs at the OU level.",
    "example": "OU=Workstations,DC=corp,DC=cloudlab,DC=local."
  },
  {
    "term": "Pass-the-Hash",
    "category": "Security",
    "definition": "Attack where the password hash (not plaintext) is replayed against another system. Mitigated by Credential Guard, Tier-0 isolation, NTLM removal.",
    "example": "Mimikatz dumps LSASS to extract hashes."
  },
  {
    "term": "Pass-the-Ticket",
    "category": "Security",
    "definition": "Kerberos attack — replaying TGT/ST from one host to another. Mitigated by Protected Users, AES-only, time-bound tickets.",
    "example": "Rubeus extracts TGT from a workstation."
  },
  {
    "term": "PIM (Privileged Identity Management)",
    "category": "Identity",
    "definition": "Entra feature for JIT role activation, approval workflow, access reviews.",
    "example": "Activate Global Admin role for 4 hours with MFA + justification."
  },
  {
    "term": "PHS (Password Hash Sync)",
    "category": "Identity",
    "definition": "Entra Connect sync mode — on-prem password hashes synced to Entra (double-hashed). Simplest hybrid mode.",
    "example": "Cheapest hybrid — no ADFS, no PTA agent."
  },
  {
    "term": "PRT (Primary Refresh Token)",
    "category": "Identity",
    "definition": "Long-lived token issued to AAD-joined Windows devices. Used for SSO + WS-Trust to legacy apps.",
    "example": "Single sign-on from Windows 11 to M365 web apps."
  },
  {
    "term": "PTA (Pass-through Auth)",
    "category": "Identity",
    "definition": "Entra Connect mode where Entra forwards password check to on-prem agent (no hash sync).",
    "example": "Used when org cannot sync password hashes for policy reasons."
  },
  {
    "term": "SAML",
    "category": "Identity",
    "definition": "XML-based SSO protocol. Older but widely deployed. Replaced by OIDC for new apps.",
    "example": "Workday + Salesforce SAML federation with Entra."
  },
  {
    "term": "Service Principal (SP)",
    "category": "Identity",
    "definition": "Entra identity for an application. Has secret/certificate. Manual rotation needed (vs Managed Identity).",
    "example": "Pipeline auth to Azure ARM via SP secret."
  },
  {
    "term": "Sign-in risk",
    "category": "Identity",
    "definition": "Likelihood that THIS sign-in is malicious. Atypical travel, anonymous IP, malware-linked IP.",
    "example": "Sign-in from TOR exit node → High risk."
  },
  {
    "term": "SPN (Service Principal Name)",
    "category": "Identity",
    "definition": "AD attribute identifying a Kerberos service. Used for Kerberos delegation.",
    "example": "HTTP/web01.corp.local for IIS Kerberos auth."
  },
  {
    "term": "SSPR (Self-Service Password Reset)",
    "category": "Identity",
    "definition": "Entra feature allowing users to reset passwords without helpdesk. Method requirements + on-prem writeback.",
    "example": "Reduces helpdesk tickets by ~40%."
  },
  {
    "term": "User risk",
    "category": "Identity",
    "definition": "Likelihood the USER ACCOUNT is compromised. Leaked credentials, multiple risky sign-ins, suspicious inbox rules.",
    "example": "Password in HIBP breach → High user risk."
  },
  {
    "term": "WSTrust",
    "category": "Identity",
    "definition": "Web Services Trust — protocol for legacy app federation. Used by ADFS.",
    "example": "Skype for Business on-prem authenticated via WS-Trust."
  },
  {
    "term": "Workload Identity Federation",
    "category": "Identity",
    "definition": "Replace service principal secrets with OIDC federation. GitHub Actions, GitLab, AWS, GCP can authenticate to Azure without secrets.",
    "example": "GitHub Actions deploys to Azure via federated credential."
  },
  {
    "term": "ARM (Azure Resource Manager)",
    "category": "Azure",
    "definition": "Azure's deployment + management layer. All resources go through ARM API. JSON/Bicep templates.",
    "example": "CLI: az group create → ARM API."
  },
  {
    "term": "AKS (Azure Kubernetes Service)",
    "category": "Azure",
    "definition": "Managed Kubernetes. Microsoft manages the control plane; you manage node pools.",
    "example": "Container workloads with horizontal pod autoscaling."
  },
  {
    "term": "Application Gateway",
    "category": "Azure",
    "definition": "Layer-7 load balancer with WAF, path-based routing, SSL termination. Regional.",
    "example": "AKS Application Routing addon uses AppGW ingress controller."
  },
  {
    "term": "Availability Zone (AZ)",
    "category": "Azure",
    "definition": "Physically separate datacenter in a region. 3 AZs in supported regions.",
    "example": "VM Scale Set spread across AZ1, AZ2, AZ3 for 99.99% SLA."
  },
  {
    "term": "Azure Arc",
    "category": "Azure",
    "definition": "Bring on-prem / multi-cloud servers + K8s under Azure governance. Apply policy, Defender, Update Manager.",
    "example": "On-prem Windows Server connected to Azure Arc for Update Manager."
  },
  {
    "term": "Azure Front Door",
    "category": "Azure",
    "definition": "Global Layer-7 load balancer + CDN + WAF + DDoS. Anycast edge with 192 PoPs.",
    "example": "Multi-region failover for e-commerce site."
  },
  {
    "term": "Azure Policy",
    "category": "Azure",
    "definition": "Governance engine. Define rules (only allowed VM sizes, only certain regions). Audit / Deny / Modify / Deploy-if-not-exists.",
    "example": "Policy: All storage accounts must use Customer-Managed Keys."
  },
  {
    "term": "Bicep",
    "category": "Azure",
    "definition": "DSL for ARM templates. Cleaner syntax than JSON. Compiles to ARM JSON.",
    "example": "main.bicep deploys a VNet + AKS."
  },
  {
    "term": "Cosmos DB",
    "category": "Azure",
    "definition": "Globally distributed NoSQL DB. APIs: SQL (Core), Mongo, Cassandra, Gremlin, Table. Multi-region writes.",
    "example": "Active-active globally distributed app session store."
  },
  {
    "term": "Defender for Cloud",
    "category": "Security",
    "definition": "Azure-native CSPM + CWP. Free tier = posture. Paid = workload protection per resource type.",
    "example": "Defender for Servers, Defender for SQL, Defender for Containers."
  },
  {
    "term": "ExpressRoute",
    "category": "Azure",
    "definition": "Private dedicated connectivity from on-prem to Azure. Bypasses internet. 50 Mbps to 100 Gbps.",
    "example": "Enterprise WAN extension to East US 2 region."
  },
  {
    "term": "Front Door (Premium)",
    "category": "Azure",
    "definition": "Adds Private Link to backends, Bot Manager, Microsoft Threat Intelligence rules.",
    "example": "Origin = Private Link to App Service."
  },
  {
    "term": "Functions",
    "category": "Azure",
    "definition": "Serverless compute. Consumption / Premium / Dedicated plans. Triggers: HTTP, Timer, Queue, Event Grid, etc.",
    "example": "Image-resize function triggered by Blob upload."
  },
  {
    "term": "Hub-Spoke",
    "category": "Azure",
    "definition": "Network topology — hub VNet holds shared services (Firewall, Bastion, ExpressRoute GW), spokes peer to hub.",
    "example": "Default Azure landing zone topology."
  },
  {
    "term": "Hybrid Benefit (AHB)",
    "category": "Azure",
    "definition": "Apply existing Windows / SQL Server licenses with SA to Azure VMs — save up to 40-55%.",
    "example": "Migrate 200 Win VMs to Azure with AHB."
  },
  {
    "term": "Key Vault",
    "category": "Azure",
    "definition": "Centralized secret, key, and certificate store. Soft delete + purge protection.",
    "example": "App reads DB connection string from Key Vault via Managed Identity."
  },
  {
    "term": "Landing Zone",
    "category": "Azure",
    "definition": "Pre-built Azure environment following Cloud Adoption Framework. MG hierarchy + policies + identity + networking.",
    "example": "Enterprise-scale landing zone for 100k-VM org."
  },
  {
    "term": "Logic Apps",
    "category": "Azure",
    "definition": "Serverless workflow orchestrator. Consumption (multi-tenant) vs Standard (single-tenant container).",
    "example": "Sentinel playbook to disable a user on incident."
  },
  {
    "term": "Management Group",
    "category": "Azure",
    "definition": "Hierarchical container above subscriptions. Apply RBAC + Policy at MG level — inherits down.",
    "example": "Root → Prod / Non-prod → Sub."
  },
  {
    "term": "NAT Gateway",
    "category": "Azure",
    "definition": "Outbound-only NAT for subnets. Replaces \"Outbound Rules\" on Standard LB. Avoids SNAT port exhaustion.",
    "example": "AKS cluster outbound through NAT GW for predictable egress IP."
  },
  {
    "term": "NSG (Network Security Group)",
    "category": "Azure",
    "definition": "Stateful Layer-4 firewall on subnet or NIC. Default rules: allow VNet, deny inbound from Internet.",
    "example": "NSG rule: allow TCP 443 from Internet to web subnet."
  },
  {
    "term": "Private Endpoint",
    "category": "Azure",
    "definition": "Private IP in your VNet for an Azure PaaS resource. Eliminates public exposure.",
    "example": "Storage account accessed only via Private Endpoint."
  },
  {
    "term": "Reservation (RI)",
    "category": "Azure",
    "definition": "Pre-pay VM / SQL DB capacity for 1 or 3 years. Save up to 72% vs PAYG. SKU + region locked.",
    "example": "D8s_v5 x 12 reservation for 3 years."
  },
  {
    "term": "Resource Group",
    "category": "Azure",
    "definition": "Logical container for related Azure resources. RBAC + tagging + lifecycle at RG level.",
    "example": "rg-prod-network contains VNet + Firewall + Bastion."
  },
  {
    "term": "Savings Plan",
    "category": "Azure",
    "definition": "Commit $X/hour for compute — flexible across regions/VM families. 1 or 3 years.",
    "example": "Compute savings plan $50/hr 3-year — saves 28% vs PAYG."
  },
  {
    "term": "SQL Database (Single)",
    "category": "Azure",
    "definition": "PaaS SQL DB. DTU or vCore. Service tiers: Basic, Standard, General Purpose, Business Critical, Hyperscale.",
    "example": "4-vCore Gen Purpose DB for finance app."
  },
  {
    "term": "SQL Managed Instance",
    "category": "Azure",
    "definition": "PaaS SQL with full SQL Server engine features (Agent, cross-DB queries, CLR). VNet-injected.",
    "example": "Migrate 30 SQL DBs from SQL 2014 → SQL MI."
  },
  {
    "term": "Standard / Basic SKU",
    "category": "Azure",
    "definition": "Public IP + LB tiers. Standard = AZ-aware, multi-VM, secure-by-default. Basic = legacy, retiring Sep 2025.",
    "example": "Always use Standard for new deployments."
  },
  {
    "term": "VNet (Virtual Network)",
    "category": "Azure",
    "definition": "Azure private network. /8 to /29 address space. Peering to other VNets within or across regions.",
    "example": "10.0.0.0/16 hub VNet with /24 subnets per workload."
  },
  {
    "term": "VWAN (Virtual WAN)",
    "category": "Azure",
    "definition": "Managed SD-WAN service. Hub-and-spoke as a service. Built-in firewall + routing.",
    "example": "6 regions + 14 spokes managed via VWAN."
  },
  {
    "term": "Defender for Office 365",
    "category": "Security",
    "definition": "Email + collaboration security in M365. Safe Links, Safe Attachments, anti-phishing, Threat Tracker.",
    "example": "Phishing email auto-quarantined by Anti-phishing policy."
  },
  {
    "term": "Defender XDR",
    "category": "Security",
    "definition": "Unified XDR — identities, endpoints, email, cloud apps, IoT. security.microsoft.com.",
    "example": "Cross-domain incident correlation: phish email → endpoint exec → identity compromise."
  },
  {
    "term": "Exchange Online",
    "category": "M365",
    "definition": "Cloud email service in M365. Successor to Exchange on-prem. Mail flow, mailboxes, public folders.",
    "example": "EXO connectors for hybrid mail routing."
  },
  {
    "term": "Intune",
    "category": "M365",
    "definition": "Microsoft's cloud MDM + MAM service. Manage Windows, macOS, iOS, Android devices + apps.",
    "example": "Win11 compliance policy + Conditional Access."
  },
  {
    "term": "Microsoft 365 Apps",
    "category": "M365",
    "definition": "Word, Excel, PowerPoint, Outlook, OneNote, Teams. Click-to-Run deployment, semi-annual + monthly channels.",
    "example": "Deploy via Intune as required Win32 app."
  },
  {
    "term": "OneDrive for Business",
    "category": "M365",
    "definition": "Per-user cloud storage (1TB+). Known folder move syncs Desktop/Documents/Pictures.",
    "example": "OneDrive for Business backs up local Documents folder."
  },
  {
    "term": "Purview",
    "category": "Compliance",
    "definition": "Microsoft's data governance + compliance platform. DLP, Labels, eDiscovery, IRM, Audit, Data Map.",
    "example": "Sensitivity label \"Confidential\" auto-applied to sensitive docs."
  },
  {
    "term": "SharePoint Online",
    "category": "M365",
    "definition": "Cloud SharePoint — sites, libraries, lists, search, hub sites.",
    "example": "Team site for HR with libraries, lists, news."
  },
  {
    "term": "Teams",
    "category": "M365",
    "definition": "Chat + meetings + calling + collaboration. Replaces Skype for Business.",
    "example": "Teams meeting with breakout rooms and recording."
  },
  {
    "term": "BEC (Business Email Compromise)",
    "category": "Security",
    "definition": "Phishing variant targeting finance/HR with invoice fraud or fake CEO/CFO emails.",
    "example": "Fake CEO email to AP asking for wire transfer."
  },
  {
    "term": "CASB",
    "category": "Security",
    "definition": "Cloud Access Security Broker. Visibility, threat protection, DLP for SaaS apps. MS: Defender for Cloud Apps.",
    "example": "Block uploads of PII to personal Dropbox."
  },
  {
    "term": "CIS Benchmarks",
    "category": "Security",
    "definition": "Security configuration baselines for OS / apps / cloud. Level 1 (safe) vs Level 2 (hardened).",
    "example": "CIS Microsoft Windows 11 v3.0.0 Level 1."
  },
  {
    "term": "CSPM",
    "category": "Security",
    "definition": "Cloud Security Posture Management. Continuously assess cloud config against baselines. MS: Defender for Cloud.",
    "example": "Detect public-facing storage accounts."
  },
  {
    "term": "CWP",
    "category": "Security",
    "definition": "Cloud Workload Protection. Runtime threat detection. Defender for Servers / SQL / Containers.",
    "example": "Live response on a compromised AKS pod."
  },
  {
    "term": "DKIM",
    "category": "Security",
    "definition": "DomainKeys Identified Mail. DNS-published public key + email signed with private. Proves sender domain.",
    "example": "cloudlab.in publishes selector1._domainkey TXT record."
  },
  {
    "term": "DLP (Data Loss Prevention)",
    "category": "Security",
    "definition": "Detect + block sensitive data exfiltration. Endpoint DLP, email DLP, Teams DLP.",
    "example": "Block sending credit card numbers via email."
  },
  {
    "term": "DMARC",
    "category": "Security",
    "definition": "Domain-based Message Authentication, Reporting & Conformance. Tells receivers what to do when SPF/DKIM fail.",
    "example": "p=reject + rua=mailto:dmarc@cloudlab.in for reports."
  },
  {
    "term": "EDR",
    "category": "Security",
    "definition": "Endpoint Detection and Response. MS: Defender for Endpoint. Records behavior, hunts threats, responds.",
    "example": "Live response shell to isolated host."
  },
  {
    "term": "eDiscovery",
    "category": "Security",
    "definition": "Legal hold + search + export of M365 content for litigation/regulatory requests.",
    "example": "eDiscovery Premium case for SEC investigation."
  },
  {
    "term": "EOP",
    "category": "Security",
    "definition": "Exchange Online Protection. Baseline anti-spam + anti-malware for all M365 mailboxes.",
    "example": "EOP quarantine vs MDO quarantine."
  },
  {
    "term": "Goldenticket",
    "category": "Security",
    "definition": "Forged Kerberos TGT signed with stolen KRBTGT key. Persistent domain access. Defense: rotate KRBTGT twice.",
    "example": "Mimikatz golden ticket lifetime 10 years."
  },
  {
    "term": "IRM (Insider Risk Management)",
    "category": "Security",
    "definition": "Purview module detecting data theft / sabotage indicators. HR connector, sensitive triage workflow.",
    "example": "Departing employee policy template."
  },
  {
    "term": "Kerberoasting",
    "category": "Security",
    "definition": "Attack on Kerberos service tickets. Request ST for SPN-mapped account, crack offline.",
    "example": "Defense: long random passwords for service accounts."
  },
  {
    "term": "MITRE ATT&CK",
    "category": "Security",
    "definition": "Open knowledge base of adversary tactics + techniques. Sentinel rules tagged with ATT&CK.",
    "example": "T1078 Valid Accounts, T1059.001 PowerShell."
  },
  {
    "term": "MFA fatigue / push bombing",
    "category": "Security",
    "definition": "Attacker spams MFA push prompts until user approves. Defense: Number Matching in Authenticator.",
    "example": "Lapsus$ used this against Cisco."
  },
  {
    "term": "NIST 800-63B",
    "category": "Security",
    "definition": "NIST digital identity guidelines. Retired: forced periodic password change, SMS MFA.",
    "example": "Modern guidance: long passphrases, no rotation, MFA via app."
  },
  {
    "term": "Phishing-resistant MFA",
    "category": "Security",
    "definition": "Authenticators that bind to origin: FIDO2, Windows Hello, certificate-based.",
    "example": "YubiKey 5 NFC + Windows Hello for Business."
  },
  {
    "term": "Quishing",
    "category": "Security",
    "definition": "Phishing via QR code — bypasses URL scanning. User scans on mobile, lands on attacker page.",
    "example": "QR code in email asking to \"verify Microsoft account\"."
  },
  {
    "term": "Sentinel",
    "category": "Security",
    "definition": "Microsoft's cloud-native SIEM + SOAR. KQL queries, analytics rules, playbooks.",
    "example": "Custom analytics rule for AS-REP roasting."
  },
  {
    "term": "SIEM",
    "category": "Security",
    "definition": "Security Information and Event Management. Centralized log ingestion + correlation + alerting.",
    "example": "Sentinel, Splunk, QRadar."
  },
  {
    "term": "SOAR",
    "category": "Security",
    "definition": "Security Orchestration, Automation, Response. Playbook-driven response.",
    "example": "Sentinel playbook to disable user on Entra ID."
  },
  {
    "term": "SPF",
    "category": "Security",
    "definition": "Sender Policy Framework. DNS TXT lists IPs allowed to send mail for the domain.",
    "example": "v=spf1 include:spf.protection.outlook.com -all."
  },
  {
    "term": "XDR",
    "category": "Security",
    "definition": "Extended Detection and Response. Unified visibility across identity, endpoint, email, cloud, OT.",
    "example": "Microsoft Defender XDR."
  },
  {
    "term": "Zero Trust",
    "category": "Security",
    "definition": "Security model: never trust, always verify. Continuous verification + least privilege + assume breach.",
    "example": "CA + device compliance + Sentinel detections together."
  },
  {
    "term": "BGP",
    "category": "Networking",
    "definition": "Border Gateway Protocol. Routing protocol of the internet. eBGP between AS, iBGP within AS.",
    "example": "Enterprise eBGP with 2 ISPs for redundancy."
  },
  {
    "term": "CIDR",
    "category": "Networking",
    "definition": "Classless Inter-Domain Routing. /n notation for subnets. /24 = 256 addresses.",
    "example": "10.0.0.0/24 = 10.0.0.0 to 10.0.0.255."
  },
  {
    "term": "DHCP",
    "category": "Networking",
    "definition": "Dynamic Host Config Protocol. DORA flow: Discover, Offer, Request, Ack.",
    "example": "Renew lease at 50% + 87.5% of lease time."
  },
  {
    "term": "DNS",
    "category": "Networking",
    "definition": "Domain Name System. Translates names → IPs. Recursive resolver → root → TLD → authoritative.",
    "example": "cloudlab.in A record points to Cloudflare anycast."
  },
  {
    "term": "EAP-TLS",
    "category": "Networking",
    "definition": "Extensible Authentication Protocol with certificate-based mutual auth. Most secure 802.1X.",
    "example": "WPA3-Enterprise with EAP-TLS for corporate WiFi."
  },
  {
    "term": "HTTP/2",
    "category": "Networking",
    "definition": "Multiplexed binary HTTP. Streams, server push, header compression (HPACK). Over TLS.",
    "example": "Modern web stack defaults to HTTP/2."
  },
  {
    "term": "HTTP/3 (QUIC)",
    "category": "Networking",
    "definition": "HTTP over QUIC (UDP-based). Encrypted transport. Faster handshake, no head-of-line blocking.",
    "example": "Cloudflare, Google services use HTTP/3."
  },
  {
    "term": "IPsec",
    "category": "Networking",
    "definition": "IP layer encryption suite. AH (auth only) + ESP (encrypt). Tunnel vs Transport mode.",
    "example": "Site-to-site VPN between branches."
  },
  {
    "term": "NAT",
    "category": "Networking",
    "definition": "Network Address Translation. Maps private RFC1918 IPs to public. PAT = Port Address Translation (one IP, many ports).",
    "example": "Home router with 1 public IP + many devices."
  },
  {
    "term": "OSI Model",
    "category": "Networking",
    "definition": "7-layer model: Physical, Data Link, Network, Transport, Session, Presentation, Application.",
    "example": "Layer 4 = TCP, Layer 7 = HTTP."
  },
  {
    "term": "OSPF",
    "category": "Networking",
    "definition": "Open Shortest Path First. IGP routing protocol. Link-state, Dijkstra SPF, areas.",
    "example": "Single-area OSPF in small enterprise."
  },
  {
    "term": "SD-WAN",
    "category": "Networking",
    "definition": "Software-Defined WAN. Centrally orchestrate branch routers. Per-app path selection.",
    "example": "Meraki MX SD-WAN with dual ISP failover."
  },
  {
    "term": "TCP",
    "category": "Networking",
    "definition": "Transmission Control Protocol. Connection-oriented, reliable, ordered. 3-way handshake.",
    "example": "HTTP, SSH, SMTP use TCP."
  },
  {
    "term": "UDP",
    "category": "Networking",
    "definition": "User Datagram Protocol. Connectionless, unreliable, no ordering. Lower overhead.",
    "example": "DNS query, VoIP RTP, video stream."
  },
  {
    "term": "VLAN",
    "category": "Networking",
    "definition": "Virtual LAN. 802.1Q tag separates broadcast domains. Access vs Trunk ports.",
    "example": "Data VLAN 10, Voice VLAN 20, Guest VLAN 30."
  },
  {
    "term": "VPN",
    "category": "Networking",
    "definition": "Virtual Private Network. Site-to-site (IPsec) or client-to-site (SSL VPN, IKEv2).",
    "example": "Replace SSL VPN with Entra Global Secure Access."
  },
  {
    "term": "VRF",
    "category": "Networking",
    "definition": "Virtual Routing and Forwarding. Multiple routing tables on one router.",
    "example": "MPLS L3VPN per-customer VRF."
  },
  {
    "term": "WPA3",
    "category": "Networking",
    "definition": "Wi-Fi Protected Access 3. SAE handshake (PSK) or 802.1X (Enterprise). Replaces WPA2.",
    "example": "Move 12 sites from WPA2 → WPA3-Enterprise."
  },
  {
    "term": "Ansible",
    "category": "DevOps",
    "definition": "Configuration management tool. Agentless, YAML playbooks.",
    "example": "Ansible playbook to harden 200 Windows servers."
  },
  {
    "term": "Bicep",
    "category": "DevOps",
    "definition": "See Azure section."
  },
  {
    "term": "CI/CD",
    "category": "DevOps",
    "definition": "Continuous Integration + Continuous Delivery/Deployment.",
    "example": "Build on PR, deploy to UAT on merge."
  },
  {
    "term": "Docker",
    "category": "DevOps",
    "definition": "Container runtime. Image = layered filesystem + metadata. Engine runs containers.",
    "example": "docker build / docker run / docker push."
  },
  {
    "term": "GitHub Actions",
    "category": "DevOps",
    "definition": "CI/CD inside GitHub. Workflow YAML in .github/workflows/. Marketplace actions.",
    "example": "Auto-deploy on push to main."
  },
  {
    "term": "gMSA (Group Managed Service Account)",
    "category": "Identity",
    "definition": "AD-managed service account. Auto-rotated password. Used for services + scheduled tasks.",
    "example": "IIS app pool runs as gMSA."
  },
  {
    "term": "Helm",
    "category": "DevOps",
    "definition": "Kubernetes package manager. Chart = templated YAML.",
    "example": "helm install nginx-ingress ingress-nginx."
  },
  {
    "term": "KQL",
    "category": "Security",
    "definition": "Kusto Query Language. Used in Log Analytics, Sentinel, Defender XDR Advanced Hunting.",
    "example": "SigninLogs | where ResultType != 0 | summarize count() by IPAddress."
  },
  {
    "term": "Terraform",
    "category": "DevOps",
    "definition": "Multi-cloud IaC tool. HCL syntax. State file tracks resources.",
    "example": "terraform apply to provision AKS + VNet."
  },
  {
    "term": "DPDP Act 2023 (India)",
    "category": "Compliance",
    "definition": "Digital Personal Data Protection Act. Consent, data principal rights, breach notification within 72h.",
    "example": "Purview Data Map + DLP + Retention for DPDP readiness."
  },
  {
    "term": "GDPR",
    "category": "Compliance",
    "definition": "EU General Data Protection Regulation. Right to be forgotten, breach notify 72h, fines up to 4% global revenue.",
    "example": "Subject Access Request (SAR) responded within 30 days."
  },
  {
    "term": "HIPAA",
    "category": "Compliance",
    "definition": "US Health Insurance Portability and Accountability Act. PHI protection.",
    "example": "BAA + encryption + audit logging."
  },
  {
    "term": "ISO 27001",
    "category": "Compliance",
    "definition": "International standard for Information Security Management System (ISMS).",
    "example": "Risk register + Statement of Applicability + Annex A controls."
  },
  {
    "term": "PCI DSS",
    "category": "Compliance",
    "definition": "Payment Card Industry Data Security Standard. 12 requirements for processing card data.",
    "example": "Quarterly ASV scan + annual SAQ-D."
  },
  {
    "term": "SOX",
    "category": "Compliance",
    "definition": "Sarbanes-Oxley Act. US public company financial controls. ITGCs.",
    "example": "Access reviews quarterly for privileged accounts."
  }
];
