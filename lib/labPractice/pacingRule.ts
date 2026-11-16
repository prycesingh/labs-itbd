/** Pure pacing rule — see lib/labPractice/pacing.ts for the full story. */

export type PacingDay = { id: number; dayNo: number; isActive: boolean };
export type DayState = {
  open: boolean;
  /** "early": opened beyond the pointer · "closed": closed inside it. */
  exception: "early" | "closed" | null;
};

/** Pure: each day's state for one batch. */
export function dayStates(
  days: PacingDay[],
  currentDay: number,
  exceptions: Map<number, boolean>,
): Map<number, DayState> {
  const out = new Map<number, DayState>();
  for (const d of days) {
    const byPointer = d.dayNo <= currentDay;
    const exc = exceptions.get(d.id);
    const wanted = exc ?? byPointer;
    out.set(d.id, {
      open: d.isActive && wanted,
      exception: exc === undefined || exc === byPointer ? null : exc ? "early" : "closed",
    });
  }
  return out;
}

export function isDayOpen(day: PacingDay, currentDay: number, exceptions: Map<number, boolean>) {
  return dayStates([day], currentDay, exceptions).get(day.id)!.open;
}
