import type { AzureResource, AzureSimState } from "./azureState";
import { labAppService, labLb, labNsg, labNsgRule, labRg, labSql, labStorage, labVm, labVnet } from "./labBuilders";

export type LabDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type LabObjective = {
  id: string;
  description: string;
  check: (state: AzureSimState) => boolean;
};

export type LabScenario = {
  id: string;
  title: string;
  difficulty: LabDifficulty;
  estimatedMin: number;
  description: string;
  tags: string[];
  setup: () => AzureResource[];
  objectives: LabObjective[];
  hints: string[];
};

function findByName(state: AzureSimState, name: string): AzureResource | undefined {
  return state.resources.find((r) => r.name === name);
}

function ofType<T extends AzureResource["resourceType"]>(state: AzureSimState, type: T): Extract<AzureResource, { resourceType: T }>[] {
  return state.resources.filter((r): r is Extract<AzureResource, { resourceType: T }> => r.resourceType === type);
}

export const LAB_SCENARIOS: LabScenario[] = [
  // ===== BEGINNER =====
  {
    id: "create-first-vm",
    title: "Create your first VM",
    difficulty: "Beginner",
    estimatedMin: 5,
    description: "Deploy a Linux VM with SSH access. Practice the full create wizard.",
    tags: ["VM", "Basics"],
    setup: () => [labRg("rg1", "rg-learn-vm")],
    objectives: [
      { id: "rg-exists", description: 'Resource group "rg-learn-vm" exists', check: (s) => ofType(s, "ResourceGroup").some((r) => r.name === "rg-learn-vm") },
      { id: "vm-exists", description: "A Virtual Machine is deployed", check: (s) => ofType(s, "VirtualMachine").length > 0 },
      { id: "vm-running", description: "The VM is in Running state", check: (s) => ofType(s, "VirtualMachine").some((v) => v.status === "Running") },
      { id: "vm-linux", description: "The VM is running Linux", check: (s) => ofType(s, "VirtualMachine").some((v) => v.os === "Linux") },
    ],
    hints: [
      'Click "+ Create" on the Virtual machines page.',
      'On the Basics tab pick the existing resource group "rg-learn-vm".',
      "Choose an Ubuntu image — that ensures the VM is Linux.",
    ],
  },
  {
    id: "tag-resources",
    title: "Tag resources for billing",
    difficulty: "Beginner",
    estimatedMin: 5,
    description: "Apply environment and cost-center tags to track spending.",
    tags: ["Tags", "Cost"],
    setup: () => [
      labRg("rg1", "rg-untagged"),
      labVm("vm1", "vm-web-01", "rg-untagged"),
      labVm("vm2", "vm-db-01", "rg-untagged"),
    ],
    objectives: [
      { id: "web-env", description: "vm-web-01 has tag environment=production", check: (s) => findByName(s, "vm-web-01")?.tags.environment === "production" },
      { id: "web-cc", description: "vm-web-01 has tag costCenter set", check: (s) => !!findByName(s, "vm-web-01")?.tags.costCenter },
      { id: "db-env", description: "vm-db-01 has tag environment=production", check: (s) => findByName(s, "vm-db-01")?.tags.environment === "production" },
      { id: "db-cc", description: "vm-db-01 has tag costCenter set", check: (s) => !!findByName(s, "vm-db-01")?.tags.costCenter },
    ],
    hints: [
      "Open each VM from the Virtual machines page.",
      'In the VM blade, click "Tags" in the left navigation.',
      "Add name=environment value=production, and a costCenter tag (e.g., IT-001).",
    ],
  },
  {
    id: "stop-idle-vm",
    title: "Stop idle VMs to save cost",
    difficulty: "Beginner",
    estimatedMin: 3,
    description: "You have three VMs running over the weekend — none in use. Deallocate them.",
    tags: ["VM", "Cost"],
    setup: () => [
      labRg("rg1", "rg-weekend"),
      labVm("vmi-0", "vm-idle-1", "rg-weekend", { size: "Standard_D4s_v5", vcpus: 4, ram: 16, estimatedCost: 140.16 }),
      labVm("vmi-1", "vm-idle-2", "rg-weekend", { size: "Standard_D4s_v5", vcpus: 4, ram: 16, estimatedCost: 140.16 }),
      labVm("vmi-2", "vm-idle-3", "rg-weekend", { size: "Standard_D4s_v5", vcpus: 4, ram: 16, estimatedCost: 140.16 }),
    ],
    objectives: [
      { id: "s1", description: "vm-idle-1 is Stopped", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-idle-1")?.status === "Stopped" },
      { id: "s2", description: "vm-idle-2 is Stopped", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-idle-2")?.status === "Stopped" },
      { id: "s3", description: "vm-idle-3 is Stopped", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-idle-3")?.status === "Stopped" },
    ],
    hints: [
      'Open each VM and click "Stop" in the action bar at the top of the blade.',
      "Stopped VMs are deallocated and no longer incur compute charges (storage still billed).",
    ],
  },

  // ===== INTERMEDIATE =====
  {
    id: "allow-https",
    title: "Allow HTTPS traffic to web server",
    difficulty: "Intermediate",
    estimatedMin: 8,
    description: "A web server VM can only receive HTTP (port 80). Add an NSG rule to allow HTTPS (port 443).",
    tags: ["NSG", "Networking"],
    setup: () => [
      labRg("rg1", "rg-web"),
      labNsg("nsg-1", "nsg-web", "rg-web", [
        labNsgRule({ id: "r1", direction: "Inbound", priority: 100, name: "Allow_HTTP", destPortRanges: "80" }),
      ]),
      labVm("vmw-1", "vm-web-01", "rg-web", { inboundPorts: ["HTTP (80)"] }),
    ],
    objectives: [
      {
        id: "has-rule",
        description: "NSG nsg-web has an inbound rule allowing port 443",
        check: (s) => {
          const nsg = ofType(s, "NetworkSecurityGroup").find((n) => n.name === "nsg-web");
          return !!nsg?.inboundRules.some((r) => r.action === "Allow" && String(r.destPortRanges).includes("443"));
        },
      },
      {
        id: "priority-valid",
        description: "The HTTPS rule has a valid priority (100-4096)",
        check: (s) => {
          const nsg = ofType(s, "NetworkSecurityGroup").find((n) => n.name === "nsg-web");
          const rule = nsg?.inboundRules.find((r) => String(r.destPortRanges).includes("443"));
          return !!rule && rule.priority >= 100 && rule.priority <= 4096;
        },
      },
    ],
    hints: [
      'Open Network security groups and select "nsg-web".',
      'Click "Inbound security rules" in the left navigation.',
      "Add a rule with destination port 443, Action=Allow, priority like 110.",
    ],
  },
  {
    id: "resize-vm-cpu",
    title: "Resize VM hitting CPU limit",
    difficulty: "Intermediate",
    estimatedMin: 6,
    description: "vm-app-01 (Standard_B1s) is running at 100% CPU. Resize to a larger SKU.",
    tags: ["VM", "Scale"],
    setup: () => [
      labRg("rg1", "rg-app"),
      labVm("vm-app-01", "vm-app-01", "rg-app", { size: "Standard_B1s", vcpus: 1, ram: 1, estimatedCost: 7.59, tags: { workload: "production-app" } }),
    ],
    objectives: [
      { id: "resized", description: "vm-app-01 is now at least 4 vCPUs", check: (s) => (ofType(s, "VirtualMachine").find((v) => v.name === "vm-app-01")?.vcpus ?? 0) >= 4 },
      { id: "still-running", description: "vm-app-01 is still Running after resize", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-app-01")?.status === "Running" },
    ],
    hints: [
      "Open vm-app-01 from Virtual machines.",
      'Click "Size" in the left navigation under Settings.',
      "Pick a size with >=4 vCPUs (e.g. Standard_D4s_v5).",
    ],
  },
  {
    id: "autoshutdown",
    title: "Configure auto-shutdown across fleet",
    difficulty: "Intermediate",
    estimatedMin: 7,
    description: "Dev VMs are running 24x7. Enable auto-shutdown at 19:00 on all dev VMs.",
    tags: ["VM", "Cost", "Governance"],
    setup: () => [
      labRg("rg1", "rg-dev"),
      labVm("dev-0", "vm-dev-01", "rg-dev", { tags: { env: "dev" }, estimatedCost: 30.37 }),
      labVm("dev-1", "vm-dev-02", "rg-dev", { tags: { env: "dev" }, estimatedCost: 30.37 }),
      labVm("dev-2", "vm-dev-03", "rg-dev", { tags: { env: "dev" }, estimatedCost: 30.37 }),
    ],
    objectives: [
      { id: "d1", description: "vm-dev-01 has auto-shutdown enabled", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-dev-01")?.enableAutoShutdown === true },
      { id: "d2", description: "vm-dev-02 has auto-shutdown enabled", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-dev-02")?.enableAutoShutdown === true },
      { id: "d3", description: "vm-dev-03 has auto-shutdown enabled", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-dev-03")?.enableAutoShutdown === true },
    ],
    hints: [
      "For existing VMs, auto-shutdown is edited from the VM blade > Operations > Auto-shutdown.",
      "Toggle it on and set a daily time of 19:00.",
      "Pro tip: in production, use an Azure Policy to enforce auto-shutdown across all VMs.",
    ],
  },
  {
    id: "connect-broken",
    title: "Fix VM that you cannot SSH into",
    difficulty: "Intermediate",
    estimatedMin: 10,
    description: "A junior engineer says they cannot SSH to vm-bastion-01. Diagnose and fix.",
    tags: ["VM", "NSG", "Networking"],
    setup: () => [
      labRg("rg1", "rg-prod"),
      labNsg("nsg-broken", "nsg-bastion", "rg-prod", [
        labNsgRule({ id: "rdp", direction: "Inbound", priority: 100, name: "Allow_RDP", destPortRanges: "3389" }),
      ]),
      labVm("vmb-1", "vm-bastion-01", "rg-prod", { inboundPorts: [], publicIp: "None", publicIpAddress: null }),
    ],
    objectives: [
      { id: "has-public-ip", description: "vm-bastion-01 has a Public IP address", check: (s) => ofType(s, "VirtualMachine").find((v) => v.name === "vm-bastion-01")?.publicIp !== "None" },
      {
        id: "has-ssh-rule",
        description: "NSG allows inbound SSH (port 22)",
        check: (s) => {
          const nsg = ofType(s, "NetworkSecurityGroup").find((n) => n.name === "nsg-bastion");
          return !!nsg?.inboundRules.some((r) => r.action === "Allow" && String(r.destPortRanges).includes("22"));
        },
      },
    ],
    hints: [
      "Linux VMs need port 22 (SSH) open and a reachable IP. Check both.",
      "Open the VM blade > Networking; check inbound rules and whether Public IP is set.",
      "Add an inbound rule for SSH (priority 110, port 22, action Allow). Note: Public IP cannot be added retroactively in this simulator — focus on the NSG rule.",
    ],
  },
  {
    id: "vnet-peering",
    title: "Connect two VNets with peering",
    difficulty: "Intermediate",
    estimatedMin: 8,
    description: "Two app teams have separate VNets and need their VMs to communicate. Set up bidirectional peering.",
    tags: ["VNet", "Networking"],
    setup: () => [
      labRg("rg1", "rg-teams"),
      labVnet("vnet-a", "vnet-team-a", "rg-teams", { addressSpace: ["10.10.0.0/16"] }),
      labVnet("vnet-b", "vnet-team-b", "rg-teams", { addressSpace: ["10.20.0.0/16"] }),
    ],
    objectives: [
      {
        id: "peer-a",
        description: "vnet-team-a has a peering to vnet-team-b",
        check: (s) => !!ofType(s, "VirtualNetwork").find((v) => v.name === "vnet-team-a")?.peerings.some((p) => p.remoteVnet.includes("vnet-team-b")),
      },
      {
        id: "peer-b",
        description: "vnet-team-b has a peering to vnet-team-a",
        check: (s) => !!ofType(s, "VirtualNetwork").find((v) => v.name === "vnet-team-b")?.peerings.some((p) => p.remoteVnet.includes("vnet-team-a")),
      },
    ],
    hints: [
      "Peering is bidirectional but each VNet has its own peering entry — configure both ends.",
      "Open vnet-team-a > Peerings > + Add peering. Choose remote VNet = vnet-team-b.",
      "Repeat from vnet-team-b > Peerings to point back to vnet-team-a.",
    ],
  },
  {
    id: "web-app-deploy",
    title: "Deploy a Web App with HTTPS only",
    difficulty: "Intermediate",
    estimatedMin: 10,
    description: "Create an App Service running Node.js 20 with HTTPS-only enforcement and a custom App setting.",
    tags: ["App Service", "Web"],
    setup: () => [labRg("rg1", "rg-web")],
    objectives: [
      { id: "exists", description: "An App Service is created in rg-web", check: (s) => ofType(s, "AppService").some((a) => a.resourceGroup === "rg-web") },
      { id: "node", description: "Runtime stack is Node 20 LTS", check: (s) => ofType(s, "AppService").some((a) => a.runtimeStack.includes("Node 20")) },
      { id: "app-setting", description: "App has a setting named ENVIRONMENT", check: (s) => ofType(s, "AppService").some((a) => "ENVIRONMENT" in a.appSettings) },
    ],
    hints: [
      "On App Services click + Create.",
      "Basics tab: pick rg-web, set a unique name, runtime Node 20 LTS, OS Linux.",
      "After creation, go to Configuration > App settings → + New application setting → Name ENVIRONMENT, Value production.",
    ],
  },
  {
    id: "sql-firewall",
    title: "Restrict SQL Database access",
    difficulty: "Intermediate",
    estimatedMin: 7,
    description: "A SQL Database is open to the world. Add firewall rules to allow only your IP and disable Azure-services bypass.",
    tags: ["SQL", "Security"],
    setup: () => [
      labRg("rg1", "rg-db"),
      labSql("sql-open", "sqldb-public", "rg-db", {
        server: "srv-open",
        serverFQDN: "srv-open.database.windows.net",
        publicAccess: true,
        allowAzureServices: true,
        firewallRules: [{ name: "AllowAll", startIp: "0.0.0.0", endIp: "255.255.255.255" }],
        minTlsVersion: "1.0",
        defender: false,
      }),
    ],
    objectives: [
      {
        id: "no-allowall",
        description: 'The "AllowAll" firewall rule is removed',
        check: (s) => {
          const sql = ofType(s, "SqlDatabase").find((x) => x.name === "sqldb-public");
          return !!sql && !sql.firewallRules.some((r) => r.name === "AllowAll" || r.endIp === "255.255.255.255");
        },
      },
      { id: "no-azure-bypass", description: "Allow Azure services bypass is disabled", check: (s) => ofType(s, "SqlDatabase").find((x) => x.name === "sqldb-public")?.allowAzureServices === false },
      { id: "tls-12", description: "Minimum TLS version is at least 1.2", check: (s) => parseFloat(ofType(s, "SqlDatabase").find((x) => x.name === "sqldb-public")?.minTlsVersion ?? "0") >= 1.2 },
    ],
    hints: [
      "Open the SQL database and its firewall rules (via server networking).",
      'Remove the "AllowAll" firewall rule and add a specific rule for your client IP.',
      'Toggle "Allow Azure services and resources to access this server" to Off, and set Min TLS to 1.2.',
    ],
  },
  {
    id: "lb-backend",
    title: "Wire up a Load Balancer with two VMs",
    difficulty: "Intermediate",
    estimatedMin: 12,
    description: "You have two web VMs. Create a Public Load Balancer with a backend pool containing both, plus a health probe and HTTPS rule.",
    tags: ["Load Balancer", "Networking"],
    setup: () => [
      labRg("rg1", "rg-lb"),
      labVm("web-1", "vm-web-01", "rg-lb", { privateIp: "10.0.0.4" }),
      labVm("web-2", "vm-web-02", "rg-lb", { privateIp: "10.0.0.5" }),
    ],
    objectives: [
      { id: "lb-exists", description: "A Public Load Balancer is created", check: (s) => ofType(s, "LoadBalancer").some((lb) => lb.lbType === "Public") },
      {
        id: "pool-has-both",
        description: "Backend pool contains vm-web-01 and vm-web-02",
        check: (s) => {
          const lb = ofType(s, "LoadBalancer")[0];
          if (!lb?.backendPools.length) return false;
          const names = lb.backendPools[0].targets.map((t) => t.vmName ?? t.name);
          return names.includes("vm-web-01") && names.includes("vm-web-02");
        },
      },
      { id: "probe", description: "At least one health probe is configured", check: (s) => (ofType(s, "LoadBalancer")[0]?.healthProbes.length ?? 0) > 0 },
      {
        id: "https-rule",
        description: "A load-balancing rule for port 443 exists",
        check: (s) => ofType(s, "LoadBalancer")[0]?.lbRules.some((r) => r.frontendPort === 443) ?? false,
      },
    ],
    hints: [
      "Create a Load Balancer with SKU Standard, Type Public. Add a frontend IP (new public IP).",
      "On Backend pools, add a pool containing the two VMs (NIC mode).",
      "On Load balancing rules, create a rule: Frontend port 443, Backend port 443, with a new HTTP health probe on port 80.",
    ],
  },

  // ===== ADVANCED =====
  {
    id: "vm-no-internet",
    title: "VM cannot reach the internet",
    difficulty: "Advanced",
    estimatedMin: 12,
    description: "A VM in production cannot reach the internet — package updates fail. Outbound traffic is being blocked.",
    tags: ["NSG", "Networking", "Troubleshooting"],
    setup: () => [
      labRg("rg1", "rg-isolated"),
      labNsg(
        "nsg-iso",
        "nsg-isolated",
        "rg-isolated",
        [labNsgRule({ id: "r1", direction: "Inbound", priority: 100, name: "Allow_SSH", destPortRanges: "22" })],
        [labNsgRule({ id: "r-bug", direction: "Outbound", priority: 100, name: "BLOCK_INTERNET", action: "Deny", protocol: "Any", destPortRanges: "*", dest: "Service Tag", destAddresses: "Internet" })],
      ),
      labVm("vm-iso", "vm-prod-app", "rg-isolated", { tags: { app: "critical" } }),
    ],
    objectives: [
      {
        id: "no-deny-internet",
        description: "Remove or override the rule blocking outbound Internet traffic",
        check: (s) => {
          const nsg = ofType(s, "NetworkSecurityGroup").find((n) => n.name === "nsg-isolated");
          if (!nsg) return false;
          const deny = nsg.outboundRules.find((r) => r.action === "Deny" && r.destAddresses === "Internet");
          if (!deny) return true;
          return nsg.outboundRules.some((r) => r.action === "Allow" && r.destAddresses === "Internet" && r.priority < deny.priority);
        },
      },
    ],
    hints: [
      "Internet failures from a VM usually mean an outbound NSG rule, route table, or firewall is in the way.",
      'Open nsg-isolated > Outbound security rules. Look for any Deny rule with destination "Internet".',
      "Either delete that rule, or add an Allow rule with a lower priority number (lower priority = higher precedence).",
    ],
  },
  {
    id: "private-storage",
    title: "Lock down publicly-exposed storage",
    difficulty: "Advanced",
    estimatedMin: 10,
    description: "Security audit found a storage account allowing public access. Restrict it to a specific VNet.",
    tags: ["Storage", "Security"],
    setup: () => [labRg("rg1", "rg-data"), labStorage("sa-leak", "sapubleak001", "rg-data", { networkAccess: "Enable from all networks" })],
    objectives: [
      {
        id: "restricted",
        description: 'Storage account networkAccess is no longer "all networks"',
        check: (s) => ofType(s, "StorageAccount").find((x) => x.name === "sapubleak001")?.networkAccess !== "Enable from all networks",
      },
    ],
    hints: [
      "Open Storage accounts > sapubleak001.",
      'Find "Networking" in the left nav.',
      'Change network access to "Enable from selected virtual networks and IP addresses" or "Disable public access".',
    ],
  },
  {
    id: "security-audit",
    title: "Security audit: find non-compliant resources",
    difficulty: "Advanced",
    estimatedMin: 15,
    description: "A new auditor wants every VM tagged with env, every storage account NOT publicly accessible, and every resource group tagged with owner.",
    tags: ["Governance", "Security", "Tags"],
    setup: () => [
      labRg("rg1", "rg-mixed"),
      labRg("rg2", "rg-legacy"),
      labStorage("sa-a", "salegacy001", "rg-legacy", { networkAccess: "Enable from all networks" }),
      labStorage("sa-b", "safine002", "rg-mixed", { networkAccess: "Disabled" }),
      labVm("vm-a", "vm-app", "rg-mixed"),
      labVm("vm-b", "vm-db", "rg-mixed", { tags: { env: "prod" } }),
      labVm("vm-c", "vm-old", "rg-legacy", { status: "Stopped", os: "Windows" }),
    ],
    objectives: [
      { id: "vms-tagged", description: 'Every VM has tag "env"', check: (s) => ofType(s, "VirtualMachine").every((v) => !!v.tags.env) },
      { id: "sa-private", description: "No Storage Account allows public access", check: (s) => ofType(s, "StorageAccount").every((x) => x.networkAccess !== "Enable from all networks") },
      { id: "rg-owner", description: 'Every Resource Group has tag "owner"', check: (s) => ofType(s, "ResourceGroup").every((rg) => !!rg.tags.owner) },
    ],
    hints: [
      "Check every VM, storage account, and resource group individually — there is no single audit view yet.",
      "Open each VM and storage account, apply the missing tags from their Tags blade.",
      "Resource groups can be tagged from the Resource groups blade > tag editor.",
    ],
  },
  {
    id: "storage-keys-rotation",
    title: "Rotate storage account access keys",
    difficulty: "Advanced",
    estimatedMin: 8,
    description: "A leaked key was found in source control. Rotate both keys — verify key1 no longer matches the leaked value.",
    tags: ["Storage", "Security"],
    setup: () => [labRg("rg1", "rg-secure"), labStorage("sa-rot", "saneedsrotation", "rg-secure", { key1: "leaked-key-do-not-use" })],
    objectives: [
      {
        id: "key-rotated",
        description: "Key1 has been changed from the leaked value",
        check: (s) => ofType(s, "StorageAccount").find((x) => x.name === "saneedsrotation")?.key1 !== "leaked-key-do-not-use",
      },
    ],
    hints: [
      "Open Storage accounts > saneedsrotation > Access keys.",
      "Click Rotate next to key1.",
      "In production, always update applications to use the NEW key BEFORE rotating; or use Managed Identities to avoid keys entirely.",
    ],
  },
  {
    id: "multi-tier-app",
    title: "Set up a 3-tier web/app/db environment",
    difficulty: "Advanced",
    estimatedMin: 25,
    description: "Build a production-grade 3-tier deployment: 1 Load Balancer + 2 web VMs + 1 app VM + 1 SQL Database, all in a VNet with appropriate NSGs.",
    tags: ["Architecture", "VM", "LB", "SQL", "Networking"],
    setup: () => [labRg("rg1", "rg-3tier")],
    objectives: [
      { id: "vnet", description: "A Virtual Network exists in rg-3tier", check: (s) => ofType(s, "VirtualNetwork").some((v) => v.resourceGroup === "rg-3tier") },
      { id: "vms-2", description: "At least 2 web-tier VMs (Linux)", check: (s) => ofType(s, "VirtualMachine").filter((v) => v.resourceGroup === "rg-3tier" && v.os === "Linux").length >= 2 },
      { id: "app-vm", description: "At least one additional VM (app tier)", check: (s) => ofType(s, "VirtualMachine").filter((v) => v.resourceGroup === "rg-3tier").length >= 3 },
      { id: "sql", description: "A SQL Database exists in rg-3tier", check: (s) => ofType(s, "SqlDatabase").some((x) => x.resourceGroup === "rg-3tier") },
      { id: "lb", description: "A Load Balancer exists in rg-3tier", check: (s) => ofType(s, "LoadBalancer").some((x) => x.resourceGroup === "rg-3tier") },
      { id: "nsg", description: "At least one NSG is created", check: (s) => ofType(s, "NetworkSecurityGroup").some((x) => x.resourceGroup === "rg-3tier") },
    ],
    hints: [
      "Build the foundation first: VNet with 3 subnets (web, app, db).",
      "Deploy 2 Linux VMs in the web subnet, 1 VM in app subnet, 1 SQL DB.",
      "Add Load Balancer with backend pool = the 2 web VMs.",
      "Create NSGs: web-nsg allows 80/443 from Internet, app-nsg allows traffic only from web subnet, db-nsg only from app subnet.",
    ],
  },
  {
    id: "cost-runaway",
    title: "Find and stop the runaway cost driver",
    difficulty: "Advanced",
    estimatedMin: 12,
    description: "Your monthly Azure bill jumped 5x. Identify which resources are responsible and apply cost mitigations: downsize, stop, or delete.",
    tags: ["Cost", "Governance"],
    setup: () => [
      labRg("rg1", "rg-spend"),
      labVm("oversized-1", "vm-oversized-01", "rg-spend", { size: "Standard_D8s_v5", vcpus: 8, ram: 32, estimatedCost: 280.32, tags: { env: "dev" } }),
      labVm("oversized-2", "vm-oversized-02", "rg-spend", { size: "Standard_D8s_v5", vcpus: 8, ram: 32, estimatedCost: 280.32, tags: { env: "dev" } }),
      labVm("zombie", "vm-zombie", "rg-spend", { status: "Stopped", os: "Windows", size: "Standard_E4s_v5", vcpus: 4, ram: 32, estimatedCost: 183.96 }),
      labSql("lega-sql", "sql-rarely-used", "rg-spend", { server: "srv1", vCores: 8, dataMaxGB: 250, estimatedCost: 1200 }),
    ],
    objectives: [
      {
        id: "downsized",
        description: "At least one of the dev oversized VMs is resized below 4 vCPUs",
        check: (s) => ofType(s, "VirtualMachine").filter((v) => v.name.includes("vm-oversized")).some((v) => v.vcpus < 4),
      },
      {
        id: "zombie-handled",
        description: "The stopped zombie VM is deleted (or restarted with purpose)",
        check: (s) => {
          const z = ofType(s, "VirtualMachine").find((v) => v.name === "vm-zombie");
          return !z || z.status === "Running";
        },
      },
    ],
    hints: [
      "Check the estimated cost shown on each resource to see where money is going.",
      "Dev VMs at Standard_D8s_v5 are way oversized for development. Resize to B2s/B4ms via VM > Size.",
      "Stopped VMs still bill for managed disks. If truly unused, delete from the VM blade > Delete.",
    ],
  },
  {
    id: "app-service-scale",
    title: "Scale App Service for Black Friday",
    difficulty: "Advanced",
    estimatedMin: 10,
    description: "Your e-commerce app is on Basic B1 with 1 instance. Scale up to Premium and out to 3 instances for the upcoming traffic surge.",
    tags: ["App Service", "Scale"],
    setup: () => [
      labRg("rg1", "rg-shop"),
      labAppService("app-shop", "app-shop-prod", "rg-shop", {
        planTier: "Basic (B1)",
        appServicePlan: "plan-shop-basic",
        runtimeStack: "Node 20 LTS",
        defaultUrl: "https://app-shop-prod.azurewebsites.net",
        instances: 1,
      }),
    ],
    objectives: [
      { id: "tier-up", description: "App Service plan tier is at least Premium (P1v3)", check: (s) => /Premium|P1v3|P2v3|P3v3/.test(ofType(s, "AppService").find((a) => a.name === "app-shop-prod")?.planTier ?? "") },
      { id: "instances", description: "Instance count is at least 3", check: (s) => (ofType(s, "AppService").find((a) => a.name === "app-shop-prod")?.instances ?? 0) >= 3 },
    ],
    hints: [
      "Scale Up changes the App Service Plan tier (more CPU/RAM per instance).",
      "Scale Out changes the number of instances (horizontal scale).",
      "Open the App Service > Scale up, pick Premium P1v3. Then Scale out, slide to 3.",
    ],
  },
  {
    id: "lab-master",
    title: "Mock AZ-104 mini-exam",
    difficulty: "Advanced",
    estimatedMin: 30,
    description: "A timed end-to-end exam covering 8 tasks across compute, networking, storage, and governance. Hint penalty doubled — relying on hints means a fail.",
    tags: ["Exam Prep", "AZ-104"],
    setup: () => [labRg("rg1", "rg-exam")],
    objectives: [
      { id: "rg-tagged", description: "rg-exam has tag owner", check: (s) => !!ofType(s, "ResourceGroup").find((r) => r.name === "rg-exam")?.tags.owner },
      { id: "vnet", description: "A VNet with at least 2 subnets exists", check: (s) => ofType(s, "VirtualNetwork").some((v) => v.subnets.length >= 2) },
      { id: "vm", description: "A Linux VM is deployed", check: (s) => ofType(s, "VirtualMachine").some((v) => v.os === "Linux" && v.status === "Running") },
      { id: "storage", description: "A non-public storage account exists", check: (s) => ofType(s, "StorageAccount").some((x) => x.networkAccess !== "Enable from all networks") },
      {
        id: "nsg",
        description: "An NSG with a custom inbound HTTPS rule exists",
        check: (s) => ofType(s, "NetworkSecurityGroup").some((n) => n.inboundRules.some((r) => r.action === "Allow" && String(r.destPortRanges).includes("443"))),
      },
      { id: "app", description: "An App Service is deployed", check: (s) => ofType(s, "AppService").length > 0 },
      { id: "sql", description: "A SQL Database is created", check: (s) => ofType(s, "SqlDatabase").length > 0 },
      { id: "autoshut", description: "At least one VM has auto-shutdown enabled", check: (s) => ofType(s, "VirtualMachine").some((v) => v.enableAutoShutdown) },
    ],
    hints: [
      "Pace yourself. This mirrors the breadth of AZ-104 task-based questions.",
      "Tasks are independent — finish what is fastest first (e.g., tag the RG) to build confidence.",
      "Reuse: a single VNet with 2 subnets covers the network requirement. A single NSG covers the rule task.",
    ],
  },
];

export function getScenario(id: string): LabScenario | undefined {
  return LAB_SCENARIOS.find((s) => s.id === id);
}

export function difficultyColor(d: LabDifficulty): string {
  if (d === "Beginner") return "#107c10";
  if (d === "Intermediate") return "#d83b01";
  return "#7719aa";
}

export function formatLabTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function computeLabScore(estimatedMin: number, timeSec: number, hintsUsed: number): { score: number; timePenalty: number; hintPenalty: number } {
  const targetSec = estimatedMin * 60;
  const timePenalty = Math.max(0, Math.floor((timeSec - targetSec) / 6));
  const hintPenalty = hintsUsed * 15;
  const score = Math.max(0, 100 - timePenalty - hintPenalty);
  return { score, timePenalty, hintPenalty };
}
