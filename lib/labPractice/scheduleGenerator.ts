/**
 * Day generator for schedules — PURE (no DB), so the preview the trainer sees
 * and the rows that get written come from the same function.
 *
 * Strategies:
 *   fromTitles — read "Day 05.2 — …" / "Day 5 …" / "D05 …" from the lab title
 *                and place the lab in that day. Labs without a day number are
 *                returned as `unplaced`.
 *   perDay     — walk the chosen modules in order (labs in module order) and
 *                fill `perDay` labs into each day, like the bootcamp sheet.
 *
 * `startDay` lets perDay append after existing days; fromTitles always uses
 * the number in the title.
 */

export type GenLab = { id: number; moduleId: number; title: string; sequenceNo: number };

export type GeneratedPlan = {
  /** dayNo → lab ids, in placement order. */
  days: Map<number, number[]>;
  unplaced: number[];
};

const DAY_RE = /^\s*(?:day|d)\s*0*(\d{1,3})(?!\d)/i;

/** Day number written at the start of a lab title, or null. */
export function dayFromTitle(title: string): number | null {
  const m = DAY_RE.exec(title);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/** Labs ordered by the given module order, then by sequence within a module. */
function ordered(labs: GenLab[], moduleOrder: number[]): GenLab[] {
  const rank = new Map(moduleOrder.map((id, i) => [id, i]));
  return [...labs].sort(
    (a, b) =>
      (rank.get(a.moduleId) ?? Infinity) - (rank.get(b.moduleId) ?? Infinity) || a.sequenceNo - b.sequenceNo,
  );
}

export function planFromTitles(labs: GenLab[], moduleOrder: number[]): GeneratedPlan {
  const days = new Map<number, number[]>();
  const unplaced: number[] = [];
  for (const lab of ordered(labs, moduleOrder)) {
    const day = dayFromTitle(lab.title);
    if (day == null) {
      unplaced.push(lab.id);
      continue;
    }
    days.set(day, [...(days.get(day) ?? []), lab.id]);
  }
  return { days: new Map([...days.entries()].sort((a, b) => a[0] - b[0])), unplaced };
}

export function planPerDay(
  labs: GenLab[],
  moduleOrder: number[],
  perDay: number,
  startDay = 1,
): GeneratedPlan {
  const size = Math.max(1, Math.floor(perDay));
  const days = new Map<number, number[]>();
  ordered(labs, moduleOrder).forEach((lab, i) => {
    const day = startDay + Math.floor(i / size);
    days.set(day, [...(days.get(day) ?? []), lab.id]);
  });
  return { days, unplaced: [] };
}
