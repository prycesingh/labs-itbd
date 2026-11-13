import { describe, expect, it } from "vitest";

import { resolveVisibility, visibleLabIdSet } from "@/lib/labPractice/visibility";

const labs = [
  { id: 30, sequenceNo: 3, isActive: true },
  { id: 10, sequenceNo: 1, isActive: true },
  { id: 20, sequenceNo: 2, isActive: true },
  { id: 40, sequenceNo: 4, isActive: false },
];
const none = new Map<number, boolean>();

describe("lab visibility", () => {
  it("shows only the first active lab by default", () => {
    expect([...visibleLabIdSet(labs, null, none)]).toEqual([10]);
  });

  it("skips an inactive first lab", () => {
    const l = [{ id: 1, sequenceNo: 1, isActive: false }, ...labs];
    expect([...visibleLabIdSet(l, null, none)]).toEqual([10]);
  });

  it("uses the batch selection when it has labs", () => {
    expect([...visibleLabIdSet(labs, [20, 30], none)].sort()).toEqual([20, 30]);
  });

  it("falls back to the default when the batch selects nothing (or only inactive labs)", () => {
    expect([...visibleLabIdSet(labs, [], none)]).toEqual([10]);
    expect([...visibleLabIdSet(labs, [40], none)]).toEqual([10]);
  });

  it("never shows an inactive lab, even if selected or overridden", () => {
    const v = visibleLabIdSet(labs, [10, 40], new Map([[40, true]]));
    expect(v.has(40)).toBe(false);
  });

  it("lets individual overrides win over the batch", () => {
    const v = visibleLabIdSet(labs, [10, 20], new Map([[20, false], [30, true]]));
    expect([...v].sort()).toEqual([10, 30]);
  });

  it("reports source and base visibility", () => {
    const r = resolveVisibility(labs, [10], new Map([[20, true]]));
    expect(r.map((x) => [x.labId, x.visible, x.source, x.baseVisible])).toEqual([
      [10, true, "batch", true],
      [20, true, "override", false],
      [30, false, "batch", false],
    ]);
  });
});
