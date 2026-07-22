import { SimulatorLaunchCard } from "@/components/labs/simulator-launch-card";
import { requireUser } from "@/lib/labs/auth";

const SIMULATORS = [
  {
    title: "Azure",
    description: "Create and manage VMs, storage, networking, and more in a hands-on Azure Portal simulation.",
    href: "/dashboard/labs/simulators/azure-vm",
  },
  {
    title: "Active Directory",
    description: "Server Manager, ADUC, GPO editor, and DNS Manager.",
    href: "/dashboard/labs/simulators/adds",
  },
  {
    title: "Microsoft 365 Admin",
    description: "Users, groups, licenses, Exchange, SharePoint, and Teams admin.",
    href: "/dashboard/labs/simulators/m365",
  },
  {
    title: "Microsoft Intune",
    description: "Device compliance, configuration profiles, and Conditional Access.",
    href: "/dashboard/labs/simulators/intune",
  },
  {
    title: "Azure Virtual Desktop",
    description: "Host pools, session hosts, app groups, and FSLogix.",
    href: "/dashboard/labs/simulators/avd",
  },
  {
    title: "Microsoft Defender XDR",
    description: "Incidents, alerts, and Secure Score.",
    href: "/dashboard/labs/simulators/defender",
  },
  {
    title: "Microsoft Sentinel",
    description: "KQL-powered SIEM/SOAR hunting and analytics rules.",
    href: "/dashboard/labs/simulators/sentinel",
  },
  {
    title: "Microsoft Purview",
    description: "DLP, sensitivity labels, eDiscovery, and audit.",
    href: "/dashboard/labs/simulators/purview",
  },
  {
    title: "Windows Server",
    description: "Hyper-V, DHCP, WSUS, and Windows Admin Center.",
    href: "/dashboard/labs/simulators/winserver",
  },
  {
    title: "Azure DevOps",
    description: "Pipelines, Repos, and Boards.",
    href: "/dashboard/labs/simulators/azure-devops",
  },
  {
    title: "Power Platform Admin",
    description: "Environments, apps, flows, and DLP policies.",
    href: "/dashboard/labs/simulators/power-platform",
  },
  {
    title: "Network Devices",
    description: "Multi-vendor CLI: Cisco, FortiGate, Palo Alto, Juniper, Meraki.",
    href: "/dashboard/labs/simulators/network-cisco",
  },
  {
    title: "Cisco Meraki",
    description: "Cloud-managed networking dashboard.",
    href: "/dashboard/labs/simulators/meraki",
  },
  {
    title: "Wireshark",
    description: "Packet capture inspection and filter syntax.",
    href: "/dashboard/labs/simulators/wireshark",
  },
  {
    title: "NetSim Pro",
    description: "Networking fundamentals, topology builder, troubleshooting, and scenarios.",
    href: "/dashboard/labs/simulators/netsim-pro",
  },
];

export default async function LabsSimulatorsPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Simulators</h1>
        <p className="text-muted-foreground">
          Hands-on practice environments modeled on real admin consoles. More suites roll out over time.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATORS.map((sim) => (
          <SimulatorLaunchCard key={sim.title} {...sim} />
        ))}
      </div>
    </div>
  );
}
