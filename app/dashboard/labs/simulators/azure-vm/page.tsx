import { AzureSimulator } from "@/components/labs/simulators/azure/azure-simulator";
import { SimulatorSessionTracker } from "@/components/labs/SimulatorSessionTracker";
import { requireUser } from "@/lib/labs/auth";

/**
 * Cancels the dashboard shell's `p-6` content padding so the simulator gets
 * the full viewport, like the real Azure Portal — a training simulator reads
 * as more convincing at real scale than boxed inside the app's normal
 * content margins.
 */
export default async function AzureSimulatorPage() {
  await requireUser();

  return (
    <div className="-m-6 h-[calc(100%+3rem)]">
      <SimulatorSessionTracker simulatorKey="azure-vm" />
      <AzureSimulator />
    </div>
  );
}
