import { requireUser } from "@/lib/labs/auth";
import { getSiteTimeStats } from "@/lib/labs/simulatorSessionStats";
import { DashboardHomeClient } from "./DashboardHomeClient";

const TOTAL_SIMULATORS = 15;

export default async function DashboardHome() {
  const user = await requireUser();
  const { todaySeconds, weekSeconds } = await getSiteTimeStats(user.id);

  return (
    <DashboardHomeClient
      totalSimulators={TOTAL_SIMULATORS}
      todaySeconds={todaySeconds}
      weekSeconds={weekSeconds}
    />
  );
}
