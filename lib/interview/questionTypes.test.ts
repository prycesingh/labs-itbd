import { describe, expect, it } from "vitest";
import {
  classifySourceId,
  DEFAULT_COACH_BLUEPRINT,
  parseBlueprint,
  selectQuestionsByBlueprint,
  type QuestionType,
} from "./questionTypes";

/** Deterministic RNG: always picks the first of tied candidates. */
const first = () => 0;

const q = (id: string, questionType: QuestionType | null) => ({
  id,
  questionType,
});

describe("classifySourceId", () => {
  it.each([
    ["scr__about_you", "screening", "Screening"],
    ["beh__dont_know_answer", "behavioral", "Behavioral"],
    ["con__dns", "concept", "Concept"],
    ["tool__ticketing", "tools", "Tools"],
    ["kaseya-rmm__agent-procedures", "technical", "Kaseya RMM"],
    ["exchange-online__transport-rules", "technical", "Exchange Online"],
    ["one-drive__how-to-recover-a-file", "technical", "OneDrive"],
  ])("%s → %s / %s", (sourceId, questionType, category) => {
    expect(classifySourceId(sourceId)).toEqual({ questionType, category });
  });

  it.each([null, undefined, "", "no-separator", "__leading", "unknown__x"])(
    "returns null for %s",
    (sourceId) => {
      expect(classifySourceId(sourceId)).toBeNull();
    },
  );
});

describe("parseBlueprint", () => {
  it("accepts a valid blueprint", () => {
    expect(parseBlueprint(DEFAULT_COACH_BLUEPRINT)).toEqual(
      DEFAULT_COACH_BLUEPRINT,
    );
  });

  it("drops unknown slot types", () => {
    expect(
      parseBlueprint({ slots: [{ type: "screening" }, { type: "trivia" }, 7] }),
    ).toEqual({ slots: [{ type: "screening" }] });
  });

  it.each([null, undefined, "x", {}, { slots: "x" }, { slots: [] }])(
    "returns null for %j",
    (config) => {
      expect(parseBlueprint(config)).toBeNull();
    },
  );
});

describe("selectQuestionsByBlueprint", () => {
  const pool = [
    q("s1", "screening"),
    q("s2", "screening"),
    q("c1", "concept"),
    q("c2", "concept"),
    q("c3", "concept"),
    q("t1", "technical"),
    q("t2", "technical"),
    q("t3", "technical"),
    q("o1", "tools"),
    q("b1", "behavioral"),
    q("b2", "behavioral"),
  ];

  it("follows the blueprint order, one question per slot", () => {
    const picked = selectQuestionsByBlueprint(pool, DEFAULT_COACH_BLUEPRINT, {
      random: first,
    });
    expect(picked.map((p) => p.questionType)).toEqual([
      "screening",
      "concept",
      "concept",
      "technical",
      "technical",
      "tools",
      "behavioral",
    ]);
    expect(new Set(picked.map((p) => p.id)).size).toBe(7);
  });

  it("prefers questions the candidate has not seen", () => {
    const picked = selectQuestionsByBlueprint(
      pool,
      { slots: [{ type: "screening" }] },
      { recentlySeenIds: ["s1"], random: first },
    );
    expect(picked.map((p) => p.id)).toEqual(["s2"]);
  });

  it("when everything was seen, picks the one seen longest ago", () => {
    const picked = selectQuestionsByBlueprint(
      pool,
      { slots: [{ type: "behavioral" }] },
      // b2 is most recent, b1 older → b1 should come back first.
      { recentlySeenIds: ["b2", "x", "b1"], random: first },
    );
    expect(picked.map((p) => p.id)).toEqual(["b1"]);
  });

  it("rotates through the whole pool across sessions before repeating", () => {
    const technical = pool.filter((p) => p.questionType === "technical");
    const history: string[] = [];
    const served: string[] = [];
    for (let session = 0; session < technical.length; session += 1) {
      const [pick] = selectQuestionsByBlueprint(
        pool,
        { slots: [{ type: "technical" }] },
        { recentlySeenIds: history, random: Math.random },
      );
      served.push(pick.id);
      history.unshift(pick.id);
    }
    expect(new Set(served).size).toBe(technical.length);
  });

  it("fills a slot from another type when its type is exhausted", () => {
    const picked = selectQuestionsByBlueprint(
      [q("s1", "screening"), q("t1", "technical")],
      { slots: [{ type: "tools" }, { type: "screening" }] },
      { random: first },
    );
    expect(picked.map((p) => p.id)).toEqual(["s1", "t1"]);
  });

  it("never repeats a question within a session and stops when the pool runs out", () => {
    const picked = selectQuestionsByBlueprint(
      [q("a", "screening"), q("b", null)],
      DEFAULT_COACH_BLUEPRINT,
      { random: first },
    );
    expect(picked.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
});
