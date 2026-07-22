import { CiscoSimulator } from "@/components/labs/simulators/network-cisco/cisco-simulator";
import { requireUser } from "@/lib/labs/auth";

/**
 * Cancels the dashboard shell's `p-6` content padding so the simulator gets
 * the full viewport, like a real IOS WebUI/CCP Express management console —
 * a training simulator reads as more convincing at real scale than boxed
 * inside the app's normal content margins.
 */
export default async function CiscoSimulatorPage() {
  await requireUser();

  return (
    <div className="-m-6 h-[calc(100%+3rem)]">
      <CiscoSimulator />
    </div>
  );
}
