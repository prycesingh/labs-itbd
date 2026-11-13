import { describe, expect, it } from "vitest";

import { resolveVisibility, visibleLabIdSet, type VisibilityBase } from "@/lib/labPractice/visibility";

const labs = [
  { id: 30, sequenceNo: 3, isActive: true },
  { id: 10, sequenceNo: 1, isActive: true },
  { id: 20, sequenceNo: 2, isActive: true },
  { id: 40, sequenceNo: 4, isActive: false },
];
const none = new Map<number, boolean>();
const def: VisibilityBase = { kind: "default" };
const batch = (labIds: number[]): VisibilityBase => ({ kind: "batch", labIds });
const days = (labIds: number[]): VisibilityBase => ({ kind: "days", labIds });

describe("lab visibility", () => {
  it("shows only the first active lab by default", () => {
    expect([...visibleLabIdSet(labs, def, none)]).toEqual([10]);
  });

  it("skips an inactive first lab", () => {
    const l = [{ id: 1, sequenceNo: 1, isActive: false }, ...labs];
    expect([...visibleLabIdSet(l, def, none)]).toEqual([10]);
  });

  it("uses the module batch selection when it has labs", () => {
    expect([...visibleLabIdSet(labs, batch([20, 30]), none)].sort()).toEqual([20, 30]);
  });

  it("falls back to the first lab when a module batch selects nothing (or only inactive labs)", () => {
    expect([...visibleLabIdSet(labs, batch([]), none)]).toEqual([10]);
    expect([...visibleLabIdSet(labs, batch([40]), none)]).toEqual([10]);
  });

  it("never shows an inactive lab, even if selected or overridden", () => {
    const v = visibleLabIdSet(labs, batch([10, 40]), new Map([[40, true]]));
    expect(v.has(40)).toBe(false);
  });

  it("lets individual overrides win over the batch", () => {
    const v = visibleLabIdSet(labs, batch([10, 20]), new Map([[20, false], [30, true]]));
    expect([...v].sort()).toEqual([10, 30]);
  });

  it("reports source and base visibility", () => {
    const r = resolveVisibility(labs, batch([10]), new Map([[20, true]]));
    expect(r.map((x) => [x.labId, x.visible, x.source, x.baseVisible])).toEqual([
      [10, true, "batch", true],
      [20, true, "override", false],
      [30, false, "batch", false],
    ]);
  });

  describe("schedule (days)", () => {
    it("shows exactly the labs in active days", () => {
      expect([...visibleLabIdSet(labs, days([20, 30]), none)].sort()).toEqual([20, 30]);
    });

    it("shows nothing when no active day touches this module (no first-lab fallback)", () => {
      expect(visibleLabIdSet(labs, days([]), none).size).toBe(0);
      expect(visibleLabIdSet(labs, days([999]), none).size).toBe(0);
    });

    it("tags day-driven labs and still lets overrides win", () => {
      const r = resolveVisibility(labs, days([10]), new Map([[10, false], [30, true]]));
      expect(r.map((x) => [x.labId, x.visible, x.source])).toEqual([
        [10, false, "override"],
        [20, false, "day"],
        [30, true, "override"],
      ]);
    });
  });
});
