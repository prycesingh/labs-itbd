import { eq, sql } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import { labsSimulatorSessions } from "@/DB/labsSchema";
import { startOfThisWeek, startOfToday } from "@/lib/labs/date";

export async function getSimulatorTimeStats(userId: string) {
  const today = startOfToday();
  const thisWeek = startOfThisWeek();

  const [row] = await db
    .select({
      todaySeconds: sql<number>`coalesce(sum(case when ${labsSimulatorSessions.startedAt} >= ${today} then ${labsSimulatorSessions.accumulatedSeconds} else 0 end), 0)`,
      weekSeconds: sql<number>`coalesce(sum(case when ${labsSimulatorSessions.startedAt} >= ${thisWeek} then ${labsSimulatorSessions.accumulatedSeconds} else 0 end), 0)`,
    })
    .from(labsSimulatorSessions)
    .where(eq(labsSimulatorSessions.userId, userId));

  return {
    todaySeconds: Number(row?.todaySeconds ?? 0),
    weekSeconds: Number(row?.weekSeconds ?? 0),
  };
}
