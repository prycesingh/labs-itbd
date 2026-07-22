import { MerakiSimulator } from "@/components/labs/simulators/meraki/meraki-simulator";
import { requireUser } from "@/lib/labs/auth";

/**
 * Cancels the dashboard shell's `p-6` content padding so the simulator gets
 * the full viewport, like the real dashboard.meraki.com — a training
 * simulator reads as more convincing at real scale than boxed inside the
 * app's normal content margins.
 */
export default async function MerakiSimulatorPage() {
  await requireUser();

  return (
    <div className="-m-6 h-[calc(100%+3rem)]">
      <MerakiSimulator />
    </div>
  );
}
