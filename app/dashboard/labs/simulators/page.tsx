import { SimulatorLaunchCard } from "@/components/labs/simulator-launch-card";
import { requireUser } from "@/lib/labs/auth";

const SIMULATORS = [
  {
    title: "Azure",
    description: "Create and manage VMs, storage, networking, and more in a hands-on Azure Portal simulation.",
    href: "/dashboard/labs/simulators/azure-vm",
    logoSrc: "/labs-logos/Azure.png",
  },
  {
    title: "Active Directory",
    description: "Server Manager, ADUC, GPO editor, and DNS Manager.",
    href: "/dashboard/labs/simulators/adds",
    logoSrc: "/labs-logos/Active Directory.png",
  },
  {
    title: "Microsoft 365 Admin",
    description: "Users, groups, licenses, Exchange, SharePoint, and Teams admin.",
    href: "/dashboard/labs/simulators/m365",
    logoSrc: "/labs-logos/M365.png",
  },
  {
    title: "Microsoft Intune",
    description: "Device compliance, configuration profiles, and Conditional Access.",
    href: "/dashboard/labs/simulators/intune",
    logoSrc: "/labs-logos/microsoft-intune.png",
  },
  {
    title: "Azure Virtual Desktop",
    description: "Host pools, session hosts, app groups, and FSLogix.",
    href: "/dashboard/labs/simulators/avd",
    logoSrc: "/labs-logos/Azure Virtual Desktop_512x512.png",
  },
  {
    title: "Microsoft Defender XDR",
    description: "Incidents, alerts, and Secure Score.",
    href: "/dashboard/labs/simulators/defender",
    logoSrc: "/labs-logos/Defender_512x512.png",
  },
  {
    title: "Microsoft Sentinel",
    description: "KQL-powered SIEM/SOAR hunting and analytics rules.",
    href: "/dashboard/labs/simulators/sentinel",
    logoSrc: "/labs-logos/Azure Sentinel_512x512.png",
  },
  {
    title: "Microsoft Purview",
    description: "DLP, sensitivity labels, eDiscovery, and audit.",
    href: "/dashboard/labs/simulators/purview",
    logoSrc: "/labs-logos/purview color_512x512.png",
  },
  {
    title: "Windows Server",
    description: "Hyper-V, DHCP, WSUS, and Windows Admin Center.",
    href: "/dashboard/labs/simulators/winserver",
    logoSrc: "/labs-logos/Windows Server.png",
  },
  {
    title: "Azure DevOps",
    description: "Pipelines, Repos, and Boards.",
    href: "/dashboard/labs/simulators/azure-devops",
    logoSrc: "/labs-logos/azure-devops.png",
  },
  {
    title: "Power Platform Admin",
    description: "Environments, apps, flows, and DLP policies.",
    href: "/dashboard/labs/simulators/power-platform",
    logoSrc: "/labs-logos/Power Platform_512x512.png",
  },
  {
    title: "Network Devices",
    description: "Multi-vendor CLI: Cisco, FortiGate, Palo Alto, Juniper, Meraki.",
    href: "/dashboard/labs/simulators/network-cisco",
    logoSrc: "/labs-logos/cisco.png",
  },
  {
    title: "Cisco Meraki",
    description: "Cloud-managed networking dashboard.",
    href: "/dashboard/labs/simulators/meraki",
    logoSrc: "/labs-logos/meraki.png",
  },
  {
    title: "Wireshark",
    description: "Packet capture inspection and filter syntax.",
    href: "/dashboard/labs/simulators/wireshark",
    logoSrc: "/labs-logos/wireshark.png",
  },
  {
    title: "NetSim Pro",
    description: "Networking fundamentals, topology builder, troubleshooting, and scenarios.",
    href: "/dashboard/labs/simulators/netsim-pro",
    logoSrc: "/labs-logos/netsim.png",
  },
];

export default async function LabsSimulatorsPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          <span className="text-itbd-blue">Simulators</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Hands-on practice environments modeled on real admin consoles. More suites roll out over time.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATORS.map((sim, i) => (
          <SimulatorLaunchCard key={sim.title} {...sim} index={i} />
        ))}
      </div>
    </div>
  );
}
