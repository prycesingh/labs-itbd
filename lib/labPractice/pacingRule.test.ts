import { describe, expect, it } from "vitest";

import { dayStates } from "@/lib/labPractice/pacingRule";

const days = [1, 2, 3, 4, 5].map((n) => ({ id: n * 10, dayNo: n, isActive: true }));
const openNos = (m: ReturnType<typeof dayStates>) =>
  days.filter((d) => m.get(d.id)!.open).map((d) => d.dayNo);

describe("dayStates", () => {
  it("opens days 1..pointer with no exceptions", () => {
    expect(openNos(dayStates(days, 3, new Map()))).toEqual([1, 2, 3]);
    expect(openNos(dayStates(days, 0, new Map()))).toEqual([]);
  });

  it("opens a single day beyond the pointer (open only Day 5)", () => {
    const m = dayStates(days, 0, new Map([[50, true]]));
    expect(openNos(m)).toEqual([5]);
    expect(m.get(50)!.exception).toBe("early");
  });

  it("closes a single day inside the pointer", () => {
    const m = dayStates(days, 4, new Map([[20, false]]));
    expect(openNos(m)).toEqual([1, 3, 4]);
    expect(m.get(20)!.exception).toBe("closed");
  });

  it("treats an exception that agrees with the pointer as no exception", () => {
    const m = dayStates(days, 3, new Map([[20, true], [50, false]]));
    expect(openNos(m)).toEqual([1, 2, 3]);
    expect(m.get(20)!.exception).toBeNull();
    expect(m.get(50)!.exception).toBeNull();
  });

  it("keeps a switched-off day closed whatever the pacing", () => {
    const off = days.map((d) => (d.dayNo === 2 || d.dayNo === 5 ? { ...d, isActive: false } : d));
    const m = dayStates(off, 3, new Map([[50, true]]));
    expect(off.filter((d) => m.get(d.id)!.open).map((d) => d.dayNo)).toEqual([1, 3]);
  });
});
