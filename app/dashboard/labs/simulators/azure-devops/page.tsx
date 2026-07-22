import { AdoSimulator } from "@/components/labs/simulators/azure-devops/ado-simulator";
import { requireUser } from "@/lib/labs/auth";

/**
 * Cancels the dashboard shell's `p-6` content padding so the simulator gets
 * the full viewport, like the real dev.azure.com — a training simulator reads
 * as more convincing at real scale than boxed inside the app's normal content
 * margins.
 */
export default async function AdoSimulatorPage() {
  await requireUser();

  return (
    <div className="-m-6 h-[calc(100%+3rem)]">
      <AdoSimulator />
    </div>
  );
}
