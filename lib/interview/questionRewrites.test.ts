import { describe, expect, it } from "vitest";
import {
  buildRewriteUserMessage,
  isTemplatedPrompt,
  planRewriteUpdates,
  validateProposedQuestion,
  type RewriteReviewEntry,
} from "./questionRewrites";

describe("isTemplatedPrompt", () => {
  it.each([
    `A user reports: "Unable to print". Walk me through how you'd troubleshoot and resolve that.`,
    "Walk me through how you'd troubleshoot and resolve: How to access ITG.",
    "  Walk me through how you'd troubleshoot and resolve: Introduction to Microsoft Intune.  ",
  ])("detects %s", (text) => {
    expect(isTemplatedPrompt(text)).toBe(true);
  });

  it.each([
    "What's a BSOD, and how would you approach troubleshooting one?",
    "If a user can't print to the office printer, how would you troubleshoot it?",
    "",
  ])("leaves natural questions alone: %s", (text) => {
    expect(isTemplatedPrompt(text)).toBe(false);
  });
});

describe("validateProposedQuestion", () => {
  it("accepts a natural, self-contained question", () => {
    expect(
      validateProposedQuestion(
        "Let's say a user's Outlook won't send or receive email — what would you check first?",
      ),
    ).toBeNull();
  });

  it.each([
    [undefined, "empty question"],
    ["   ", "empty question"],
    ["x".repeat(2001), "question is too long"],
    [
      "Walk me through how you'd troubleshoot and resolve: Teams.",
      "still uses the old template",
    ],
    [
      "What would you do if you were to troubleshoot another technical issue?",
      'refers to "another issue" instead of a concrete situation',
    ],
  ])("rejects %j", (text, reason) => {
    expect(validateProposedQuestion(text)).toBe(reason);
  });
});

describe("buildRewriteUserMessage", () => {
  it("includes scenarios and vetted points when present", () => {
    const message = buildRewriteUserMessage({
      topic: "How to resolve Printer issues",
      category: "End User Computing",
      scenarios: ["Unable to print", "Unable to scan"],
      idealPoints: ["Check the print spooler service"],
    });
    expect(message).toContain("- Unable to print");
    expect(message).toContain("- Check the print spooler service");
  });

  it("asks the model to invent a scenario when none exist", () => {
    const message = buildRewriteUserMessage({
      topic: "How to access ITG",
      category: "IT Glue",
      scenarios: [],
      idealPoints: [],
    });
    expect(message).toContain("invent a typical one");
    expect(message).not.toContain("Vetted key points");
  });
});

describe("planRewriteUpdates", () => {
  const template =
    "Walk me through how you'd troubleshoot and resolve: How to access ITG.";
  const proposed =
    "A new technician needs to look up a client's documentation in IT Glue — how would you log in and find it?";

  const entry = (overrides: Partial<RewriteReviewEntry> = {}) => ({
    questionId: "q1",
    sourceId: "it-glue__how-to-access-itg",
    category: "IT Glue",
    topic: "How to access ITG",
    scenarioUsed: "",
    currentText: template,
    proposedText: proposed,
    status: "approved" as const,
    ...overrides,
  });

  it("applies an approved, valid rewrite", () => {
    const { updates, skipped } = planRewriteUpdates(
      [entry()],
      [{ id: "q1", promptText: template }],
    );
    expect(updates).toEqual([{ questionId: "q1", from: template, to: proposed }]);
    expect(skipped).toEqual([]);
  });

  it.each([
    [{ status: "rejected" as const }, [{ id: "q1", promptText: template }], "rejected in review"],
    [{}, [], "question no longer exists"],
    [
      {},
      [{ id: "q1", promptText: "An admin already improved this." }],
      "question text was edited after the rewrite was generated",
    ],
    [{ proposedText: "" }, [{ id: "q1", promptText: template }], "empty question"],
    [{ proposedText: template }, [{ id: "q1", promptText: template }], "still uses the old template"],
  ])("skips %j", (overrides, rows, reason) => {
    const { updates, skipped } = planRewriteUpdates([entry(overrides)], rows);
    expect(updates).toEqual([]);
    expect(skipped).toEqual([{ questionId: "q1", reason }]);
  });

  it("trims the proposed text before applying", () => {
    const { updates } = planRewriteUpdates(
      [entry({ proposedText: `  ${proposed}\n` })],
      [{ id: "q1", promptText: template }],
    );
    expect(updates[0].to).toBe(proposed);
  });
});
