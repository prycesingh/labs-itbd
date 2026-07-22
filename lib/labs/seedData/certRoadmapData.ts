/**
 * Certification roadmap seed data — extracted from the source itbd-lab
 * static site (cert-roadmap.html). Used by the one-time admin seed endpoint
 * to populate the labs cert-roadmap table; not read directly at request time.
 *
 * `relatedSimulatorKeys` is derived from each source entry's free-text `sims`
 * field, mapped to the simulator route-key slugs already used in this app.
 * Only confident, unambiguous mappings are included; entries left empty (or
 * omitted) where the source text didn't map cleanly to a known slug.
 */

export type CertRoadmapSeedEntry = {
  code: string;
  name: string;
  level: string;
  track: string;
  desc: string;
  time: string;
  questions: string;
  passing: string;
  price: string;
  sims: string;
  skills: string[];
  tips: string;
  relatedSimulatorKeys?: string[];
};

export const CERT_ROADMAP_SEED: CertRoadmapSeedEntry[] = [
  // ── Fundamentals (entry level)
  { "code": "AZ-900", "name": "Azure Fundamentals", "level": "Fundamental", "track": "fundamentals",
    "desc": "Cloud concepts, Azure services, security, governance, pricing, support. 1-day exam.",
    "time": "20-30 hours", "questions": "40-60 q, 85 min", "passing": "700/1000", "price": "$99 / ₹4,800",
    "sims": "Azure Portal sim", "skills": ["Cloud models", "Azure architecture", "IAM", "Cost", "Governance"],
    "tips": "Easiest Azure cert. Cover all 5 domains evenly. Free Microsoft Learn covers 95%.",
    "relatedSimulatorKeys": [] },
  { "code": "SC-900", "name": "Security, Compliance, Identity Fundamentals", "level": "Fundamental", "track": "fundamentals",
    "desc": "Entra ID + M365 Defender + Purview at high level. No deep technical config.",
    "time": "15-20 hours", "questions": "40-60 q, 60 min", "passing": "700/1000", "price": "$99 / ₹4,800",
    "sims": "Defender XDR + Entra ID + Purview sims", "skills": ["IAM", "XDR", "SIEM", "Compliance basics"],
    "tips": "Pair with AZ-900 for both fundamental certs. Strong foundation for SC-200 / SC-300 later.",
    "relatedSimulatorKeys": ["defender", "purview"] },
  { "code": "MS-900", "name": "Microsoft 365 Fundamentals", "level": "Fundamental", "track": "fundamentals",
    "desc": "M365 services overview: Office, Teams, SharePoint, OneDrive, Intune, Defender, licensing.",
    "time": "15-20 hours", "questions": "40-60 q, 60 min", "passing": "700/1000", "price": "$99 / ₹4,800",
    "sims": "M365 Admin Center + Teams + SharePoint sims", "skills": ["M365 productivity", "Identity", "Compliance basics", "Pricing"],
    "tips": "Lightest of the 3 fundamentals. Focus on licensing tiers + Copilot.",
    "relatedSimulatorKeys": ["m365"] },
  { "code": "AI-900", "name": "Azure AI Fundamentals", "level": "Fundamental", "track": "fundamentals",
    "desc": "ML basics, Azure AI services, NLP, computer vision, generative AI.",
    "time": "15-25 hours", "questions": "40-60 q, 60 min", "passing": "700/1000", "price": "$99 / ₹4,800",
    "sims": "Azure AI Foundry sim", "skills": ["ML lifecycle", "AI services", "Cognitive Services", "GPT basics"],
    "tips": "Heavy on generative AI now. Use AI Foundry sim to practice prompt flow.",
    "relatedSimulatorKeys": [] },
  { "code": "DP-900", "name": "Data Fundamentals", "level": "Fundamental", "track": "fundamentals",
    "desc": "Relational vs non-relational data, Azure SQL, Cosmos DB, Synapse, Data Factory at a high level.",
    "time": "15-25 hours", "questions": "40-60 q, 60 min", "passing": "700/1000", "price": "$99 / ₹4,800",
    "sims": "Azure SQL + Cosmos sims", "skills": ["SQL basics", "NoSQL", "Analytics", "Data lake"],
    "tips": "Lightweight intro to Azure data. Required before DP-203 / DP-300.",
    "relatedSimulatorKeys": [] },

  // ── AZ (Azure) Associate
  { "code": "AZ-104", "name": "Azure Administrator Associate", "level": "Associate", "track": "azure",
    "desc": "Real-world Azure admin: identity, governance, storage, virtual networks, compute, monitoring.",
    "time": "60-100 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "All Azure Portal sub-modules (VM, VNet, NSG, Storage, RBAC, AKS, Backup)",
    "skills": ["IAM + Entra ID", "Governance", "Storage", "VNets", "Compute", "Monitor + Backup"],
    "tips": "Most popular Azure cert. CloudLab covers 100% of exam objectives. Plan: 6-8 weeks at 2h/day.",
    "relatedSimulatorKeys": ["azure-vm"] },
  { "code": "AZ-204", "name": "Azure Developer Associate", "level": "Associate", "track": "azure",
    "desc": "Build Azure-hosted apps: App Service, Functions, Containers, Cosmos, Storage, security.",
    "time": "60-90 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "App Service + Functions + Cosmos + Container Apps + ACR sims",
    "skills": ["App Service", "Functions", "Containers", "Cosmos", "Storage", "Auth (MSAL)", "Monitor"],
    "tips": "Most code-heavy AZ exam. Hands-on with Visual Studio + GitHub helps.",
    "relatedSimulatorKeys": [] },
  { "code": "AZ-500", "name": "Azure Security Engineer Associate", "level": "Associate", "track": "azure",
    "desc": "Identity + platform protection + data + apps + security operations on Azure.",
    "time": "70-100 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Defender for Cloud + Sentinel + Key Vault + Entra ID + PIM sims",
    "skills": ["IAM hardening", "PIM", "Defender for Cloud", "Sentinel basics", "KV + secrets", "Network sec"],
    "tips": "Pair with SC-200 for SOC role. AZ-500 is broader; SC-200 deeper on Defender XDR + Sentinel.",
    "relatedSimulatorKeys": ["defender", "sentinel"] },
  { "code": "AZ-700", "name": "Azure Network Engineer Associate", "level": "Associate", "track": "azure",
    "desc": "Hybrid + core networking: VNets, ExpressRoute, VPN, NVA, Front Door, Private Link.",
    "time": "60-90 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "VNet + VPN + ExpressRoute + Firewall + AppGW + Front Door + Network Watcher sims",
    "skills": ["VNet + peering", "VPN + ER", "NVA + Firewall", "Load balancing", "Private Link"],
    "tips": "Deep on networking. Real-world hybrid network design questions.",
    "relatedSimulatorKeys": [] },
  { "code": "AZ-800", "name": "Windows Server Hybrid Admin Associate", "level": "Associate", "track": "azure",
    "desc": "Manage Windows Server in hybrid (on-prem + Azure Arc) scenarios. AD DS, file services, Hyper-V.",
    "time": "60-80 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "ADDS + WinServer (Hyper-V / Failover Cluster) + AVD sims",
    "skills": ["AD DS hybrid", "Hyper-V", "Storage + DFS", "Failover Cluster", "Azure Arc"],
    "tips": "Pair with AZ-801 for Windows Server Hybrid Administrator certification.",
    "relatedSimulatorKeys": ["adds", "winserver", "avd"] },
  { "code": "AZ-801", "name": "Configure Windows Server Hybrid Advanced Services", "level": "Associate", "track": "azure",
    "desc": "Advanced hybrid: ADFS, security, troubleshooting, migration to Azure.",
    "time": "40-60 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "ADDS + WinServer + Azure Migrate sim",
    "skills": ["Advanced AD", "Hyper-V advanced", "Storage migration", "Defender for Servers"],
    "tips": "Companion to AZ-800. Both required for Windows Server Hybrid Administrator badge.",
    "relatedSimulatorKeys": ["adds", "winserver"] },
  { "code": "AZ-140", "name": "Azure Virtual Desktop Specialty", "level": "Specialty", "track": "azure",
    "desc": "Plan + deploy AVD: host pools, app groups, FSLogix, scaling, security.",
    "time": "40-60 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "AVD sim (Host pool / App group / FSLogix / MSIX / Scaling)",
    "skills": ["AVD design", "Image management", "FSLogix", "Scaling plans", "Networking + security"],
    "tips": "Niche but high-demand. CloudLab AVD sim covers 90% of exam.",
    "relatedSimulatorKeys": ["avd"] },

  // ── AZ Expert
  { "code": "AZ-305", "name": "Azure Solutions Architect Expert", "level": "Expert", "track": "azure",
    "desc": "Design cloud solutions: identity + governance + data + business continuity + infrastructure.",
    "time": "80-120 hours", "questions": "40-60 q + 2 case studies, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "All Azure sims + landing zone design",
    "skills": ["Solution design", "Identity arch", "Governance", "BC/DR", "Data architecture"],
    "tips": "Prerequisite: AZ-104. Case studies dominate — practice with real scenarios.",
    "relatedSimulatorKeys": [] },

  // ── SC (Security) Associate
  { "code": "SC-200", "name": "Security Operations Analyst Associate", "level": "Associate", "track": "security",
    "desc": "Sentinel + Defender XDR analyst role. KQL hunting, incident response, threat intelligence.",
    "time": "60-80 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Sentinel (KQL, rules, playbooks, workbooks) + Defender XDR sim",
    "skills": ["KQL", "Sentinel analytics rules", "Defender XDR hunting", "Incident response", "Threat intelligence"],
    "tips": "Heavy KQL focus. Use Sentinel KQL playground daily. Memorize 20 common queries.",
    "relatedSimulatorKeys": ["sentinel", "defender"] },
  { "code": "SC-300", "name": "Identity and Access Administrator Associate", "level": "Associate", "track": "security",
    "desc": "Entra ID admin: identity lifecycle, MFA, PIM, Conditional Access, Identity Protection, Governance.",
    "time": "60-80 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Entra ID + PIM + Identity Protection + M365 Roles sims",
    "skills": ["Identity governance", "CA design", "PIM workflows", "Risk policies", "B2B + B2C basics"],
    "tips": "Identity-only role. Practice CA policy authoring + PIM activation flows.",
    "relatedSimulatorKeys": ["m365"] },
  { "code": "SC-400", "name": "Information Protection and Compliance Administrator Associate", "level": "Associate", "track": "security",
    "desc": "Purview deep: labels, DLP, IRM, eDiscovery, audit, retention, communication compliance.",
    "time": "50-70 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Purview (Labels, DLP, IRM, eDiscovery, Data Map, Compliance Manager) sim",
    "skills": ["Sensitivity labels", "DLP policy", "IRM", "eDiscovery", "Retention", "Audit log"],
    "tips": "Compliance-heavy. Memorize built-in sensitive info types + label encryption.",
    "relatedSimulatorKeys": ["purview"] },

  // ── SC Expert
  { "code": "SC-100", "name": "Cybersecurity Architect Expert", "level": "Expert", "track": "security",
    "desc": "End-to-end security architecture: Zero Trust, identity, data, devices, posture, governance.",
    "time": "80-100 hours", "questions": "40-60 q + 2 case studies, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "All security sims", "skills": ["Zero Trust design", "GRC", "Identity arch", "Data protection", "Cloud + on-prem security"],
    "tips": "Capstone exam. Prerequisite: any 1 of SC-200, SC-300, AZ-500, MS-500.",
    "relatedSimulatorKeys": [] },

  // ── MS (M365) Associate + Expert
  { "code": "MS-102", "name": "Microsoft 365 Administrator Expert", "level": "Expert", "track": "m365",
    "desc": "Tenant admin: Entra hybrid, Exchange, SharePoint, Teams, security, compliance, support.",
    "time": "70-100 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "M365 Admin Center + Exchange + SharePoint + Teams + Defender XDR sims",
    "skills": ["Tenant management", "Exchange Online", "SharePoint Online", "Teams", "Compliance"],
    "tips": "Replaced MS-100 + MS-101. Mega-exam covering everything in M365 admin.",
    "relatedSimulatorKeys": ["m365", "defender"] },
  { "code": "MS-203", "name": "Messaging Administrator Associate", "level": "Associate", "track": "m365",
    "desc": "Exchange Online + hybrid: mailboxes, mail flow, anti-spam, migration, public folders.",
    "time": "50-70 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Exchange sim (Recipients, Mail flow, Protection, Migration)", "skills": ["Mail flow", "Recipient mgmt", "Hybrid", "Protection", "Migration"],
    "tips": "Practical Exchange admin role. Practice transport rules + DKIM/DMARC setup.",
    "relatedSimulatorKeys": [] },
  { "code": "MS-700", "name": "Teams Administrator Associate", "level": "Associate", "track": "m365",
    "desc": "Teams: voice, meetings, channels, lifecycle, policies, troubleshooting.",
    "time": "40-60 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "M365 Teams sim + Phone System", "skills": ["Teams admin", "Voice + meeting policies", "Direct Routing", "Lifecycle", "Adoption"],
    "tips": "Voice/calling is the differentiator. Practice Direct Routing + Operator Connect.",
    "relatedSimulatorKeys": ["m365"] },
  { "code": "MS-721", "name": "Collaboration Communications Systems Engineer", "level": "Associate", "track": "m365",
    "desc": "Voice engineering deep: Teams Phone, Direct Routing, SBC integration, troubleshooting.",
    "time": "50-70 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Teams + Phone System + SBC config", "skills": ["Direct Routing", "SBC", "Voice routing policies", "Call quality"],
    "tips": "Niche but well-paid voice engineering role.",
    "relatedSimulatorKeys": [] },

  // ── MD (Modern Work) - was Microsoft 365 Modern Desktop, now Endpoint
  { "code": "MD-102", "name": "Endpoint Administrator Associate", "level": "Associate", "track": "md",
    "desc": "Intune-based endpoint management: Windows, macOS, iOS, Android, Autopilot, app deployment, compliance.",
    "time": "50-80 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Intune sim (Devices, Apps, Compliance, Conditional Access, Autopilot)",
    "skills": ["Intune device mgmt", "Apps deployment", "Compliance", "Conditional Access", "Autopilot", "Endpoint Analytics"],
    "tips": "Replaced MD-100 + MD-101. The endpoint admin role for modern orgs.",
    "relatedSimulatorKeys": ["intune"] },

  // ── DP (Data) Associate
  { "code": "DP-203", "name": "Data Engineer Associate", "level": "Associate", "track": "data",
    "desc": "Synapse + Data Factory + Stream Analytics + Cosmos. ELT/ETL, batch + streaming.",
    "time": "70-100 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Azure SQL + Cosmos + Synapse + Data Factory sims",
    "skills": ["Data lake", "Synapse", "Data Factory", "Streaming", "Cosmos", "Security + monitoring"],
    "tips": "Heavy Synapse + Spark focus. Hands-on with Notebook + Synapse pipelines.",
    "relatedSimulatorKeys": [] },
  { "code": "DP-300", "name": "Azure Database Administrator Associate", "level": "Associate", "track": "data",
    "desc": "Azure SQL + SQL MI + SQL on VM: deploy, secure, monitor, optimize, HA/DR.",
    "time": "50-80 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "Azure SQL sim (Performance, Backup, Failover Groups, Security)",
    "skills": ["SQL DB admin", "Performance tuning", "Security", "HA/DR", "Automation"],
    "tips": "For DBAs migrating skills to Azure. Practice query store + auto-tuning.",
    "relatedSimulatorKeys": [] },
  { "code": "DP-100", "name": "Azure Data Scientist Associate", "level": "Associate", "track": "data",
    "desc": "Azure ML: data prep, train, evaluate, deploy, MLOps.",
    "time": "60-90 hours", "questions": "40-60 q, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "AI Foundry sim", "skills": ["Azure ML workspace", "Pipelines", "AutoML", "Deployment", "MLOps basics"],
    "tips": "Python coding required. Practice with the Azure ML SDK.",
    "relatedSimulatorKeys": [] },

  // ── AI Associate
  { "code": "AI-102", "name": "AI Engineer Associate", "level": "Associate", "track": "ai",
    "desc": "Azure AI services + AI Foundry: Computer Vision, Language, OpenAI, Speech, ML deployment.",
    "time": "60-90 hours", "questions": "40-60 q + case study, 100 min", "passing": "700/1000", "price": "$165 / ₹4,800",
    "sims": "AI Foundry sim (Prompt Flow, Model catalogue, Content Safety, Evaluation)",
    "skills": ["Cognitive Services", "OpenAI", "Prompt engineering", "RAG", "Content Safety", "Speech + Translator"],
    "tips": "Heavily updated for generative AI. Practice prompt flow + RAG patterns.",
    "relatedSimulatorKeys": [] }
];
