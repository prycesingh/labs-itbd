import { requireUser } from "@/lib/labs/auth";
import { getSimulatorTimeStats } from "@/lib/labs/simulatorSessionStats";
import { DashboardHomeClient } from "./DashboardHomeClient";

const TOTAL_SIMULATORS = 15;

export default async function DashboardHome() {
  const user = await requireUser();
  const { todaySeconds, weekSeconds } = await getSimulatorTimeStats(user.id);

  return (
    <DashboardHomeClient
      totalSimulators={TOTAL_SIMULATORS}
      todaySeconds={todaySeconds}
      weekSeconds={weekSeconds}
    />
  );
}
