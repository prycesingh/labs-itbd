import { describe, expect, it } from "vitest";

import { dayFromTitle, planFromTitles, planPerDay, type GenLab } from "@/lib/labPractice/scheduleGenerator";

describe("dayFromTitle", () => {
  it("reads the bootcamp title formats", () => {
    expect(dayFromTitle("Day 01.1 — Connect to the Lab Environment")).toBe(1);
    expect(dayFromTitle("Day 11.12 — Secure channel break and repair")).toBe(11);
    expect(dayFromTitle("day 5 Fix HTTPS")).toBe(5);
    expect(dayFromTitle("D07 — Subnetting")).toBe(7);
  });

  it("ignores titles without a leading day number", () => {
    expect(dayFromTitle("Device Manager Core Tasks")).toBeNull();
    expect(dayFromTitle("Scenario Lab — Day 3")).toBeNull();
    expect(dayFromTitle("Day 0 — Setup")).toBeNull();
    expect(dayFromTitle("Daylight savings")).toBeNull();
  });
});

const labs: GenLab[] = [
  { id: 1, moduleId: 11, title: "Day 01.1 — A", sequenceNo: 1 },
  { id: 2, moduleId: 11, title: "Day 01.2 — B", sequenceNo: 2 },
  { id: 3, moduleId: 11, title: "Day 05.1 — C", sequenceNo: 3 },
  { id: 4, moduleId: 12, title: "Day 05.1 — Stretch", sequenceNo: 1 },
  { id: 5, moduleId: 12, title: "No day here", sequenceNo: 2 },
];

describe("planFromTitles", () => {
  it("groups labs by the day in their title, across modules, in module order", () => {
    const p = planFromTitles(labs, [11, 12]);
    expect([...p.days.entries()]).toEqual([
      [1, [1, 2]],
      [5, [3, 4]],
    ]);
    expect(p.unplaced).toEqual([5]);
  });

  it("respects the chosen module order within a day", () => {
    expect(planFromTitles(labs, [12, 11]).days.get(5)).toEqual([4, 3]);
  });
});

describe("planPerDay", () => {
  it("fills N labs per day walking modules in order", () => {
    const p = planPerDay(labs, [11, 12], 2);
    expect([...p.days.entries()]).toEqual([
      [1, [1, 2]],
      [2, [3, 4]],
      [3, [5]],
    ]);
  });

  it("can append after existing days", () => {
    expect([...planPerDay(labs.slice(0, 2), [11], 5, 8).days.keys()]).toEqual([8]);
  });
});
