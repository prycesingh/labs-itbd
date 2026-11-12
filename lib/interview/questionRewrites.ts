/**
 * Pure logic for turning Interview Coach's templated technical prompts into
 * natural interview questions (scripts/rewrite-interview-coach-questions.ts
 * does the I/O).
 *
 * Background: interview-coach-main never stored finished technical
 * questions — it stored TOPICS plus ticket scenarios and had the LLM phrase
 * a spoken question at interview time (llm.py phrase_question), falling back
 * to a fixed template only if the LLM failed. Our migration stored that
 * fallback template for every topic, producing prompts like
 * `Walk me through how you'd troubleshoot and resolve: How to access ITG.`
 * Rewrites are generated once, reviewed by a person, then applied — never
 * written straight to the live question bank.
 */

/** Matches both shapes produced by the migration's template. */
const TEMPLATE_PATTERNS = [
  /^A user reports: "[\s\S]*"\. Walk me through how you'd troubleshoot and resolve that\.$/,
  /^Walk me through how you'd troubleshoot and resolve: [\s\S]*\.$/,
];

export function isTemplatedPrompt(text: string): boolean {
  const trimmed = text.trim();
  return TEMPLATE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export interface RewriteTopic {
  topic: string;
  category: string;
  scenarios: string[];
  /** Vetted answer-key points; empty when the topic has no grounded key. */
  idealPoints: string[];
}

/**
 * System prompt — ported from interview-coach-main's _INTERVIEWER_SYS
 * (llm.py), including its real-interviewer style examples, plus the rules
 * our bench testers' feedback showed were needed (self-contained, no
 * "another issue" phrasing).
 */
export const REWRITE_SYSTEM_PROMPT = `You are an experienced IT Managed Service Provider (MSP) hiring manager interviewing a candidate for a Service Desk / System Engineer role. Write ONE realistic interview question for the topic you are given, phrased naturally as if spoken aloud. Keep it to 1-3 sentences.

Rules:
- Ground it in a concrete user or ticket situation. Pick the single most realistic scenario from the list provided; if none fits, invent a typical one for the topic.
- It must make complete sense on its own — the candidate hears only this question. Name the specific product, symptom or request; never refer to "this issue", "another issue" or anything not stated in the question.
- Ask about DOING the work ("how would you…", "walk me through…", "what would you check…"), not trivia, unless the topic is purely conceptual.
- When vetted key points are provided, the question must let a strong candidate demonstrate them — but never list or hint at them in the question.
- Do not ask the candidate to debate whether to do something or compare alternatives unless the topic is explicitly about that comparison.

Match the voice of these REAL interviewer questions (tone and format only — do not copy them):
- "If a user reports that they can't access a shared drive, can you walk me through what steps you'd take to troubleshoot that issue?"
- "Let's say a user has a new device — what would the steps look like to set them up, and how would you walk them through it?"
- "And as far as patching goes, can you tell me the extent of what you've done?"
- "Do you have experience troubleshooting mail delivery issues? How would you approach one?"
- "When you're checking whether a network drive is reachable before remapping it, what are some things you'd look for?"

Return JSON: {"question": "<the spoken question>", "scenario_used": "<the scenario you grounded it in>"}`;

export function buildRewriteUserMessage(topic: RewriteTopic): string {
  return [
    `Category: ${topic.category}`,
    `Topic: ${topic.topic}`,
    topic.scenarios.length > 0
      ? `Ticket scenarios to choose from:\n${topic.scenarios.map((s) => `- ${s}`).join("\n")}`
      : "No ticket scenarios were provided — invent a typical one for this topic.",
    topic.idealPoints.length > 0
      ? `Vetted key points a strong answer should cover (do NOT reveal them):\n${topic.idealPoints
          .slice(0, 6)
          .map((p) => `- ${p}`)
          .join("\n")}`
      : "",
    "Candidate level: mid-level.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const MAX_PROMPT_LENGTH = 2000;

/** Returns an error message, or null when the proposed question is usable. */
export function validateProposedQuestion(text: unknown): string | null {
  if (typeof text !== "string" || text.trim().length === 0) {
    return "empty question";
  }
  const trimmed = text.trim();
  if (trimmed.length > MAX_PROMPT_LENGTH) return "question is too long";
  if (isTemplatedPrompt(trimmed)) return "still uses the old template";
  if (/\b(another|a different) (technical )?(issue|problem)\b/i.test(trimmed)) {
    return 'refers to "another issue" instead of a concrete situation';
  }
  return null;
}

// ─────────────────────────────────────────────
// REVIEW FILE → APPLY PLAN
// ─────────────────────────────────────────────

export type ReviewStatus = "approved" | "rejected";

export interface RewriteReviewEntry {
  questionId: string;
  sourceId: string;
  category: string;
  topic: string;
  scenarioUsed: string;
  /** promptText at generation time — guards against overwriting later edits. */
  currentText: string;
  /** Edit this freely during review. */
  proposedText: string;
  /** Set to "rejected" to skip an entry. */
  status: ReviewStatus;
  /** Validation problem found at generation time, if any. */
  warning?: string;
}

export interface CurrentQuestionRow {
  id: string;
  promptText: string;
}

export interface PlannedUpdate {
  questionId: string;
  from: string;
  to: string;
}

export interface SkippedEntry {
  questionId: string;
  reason: string;
}

/**
 * Decides which reviewed entries can be applied. An entry is skipped when
 * it was rejected, its question no longer exists, the question's text was
 * edited since generation (a person's edit always wins), the proposed text
 * fails validation, or nothing would change.
 */
export function planRewriteUpdates(
  entries: readonly RewriteReviewEntry[],
  currentRows: readonly CurrentQuestionRow[],
): { updates: PlannedUpdate[]; skipped: SkippedEntry[] } {
  const current = new Map(currentRows.map((row) => [row.id, row.promptText]));
  const updates: PlannedUpdate[] = [];
  const skipped: SkippedEntry[] = [];

  for (const entry of entries) {
    const skip = (reason: string) =>
      skipped.push({ questionId: entry.questionId, reason });

    if (entry.status !== "approved") {
      skip("rejected in review");
      continue;
    }
    const liveText = current.get(entry.questionId);
    if (liveText === undefined) {
      skip("question no longer exists");
      continue;
    }
    if (liveText.trim() !== entry.currentText.trim()) {
      skip("question text was edited after the rewrite was generated");
      continue;
    }
    const problem = validateProposedQuestion(entry.proposedText);
    if (problem) {
      skip(problem);
      continue;
    }
    const to = entry.proposedText.trim();
    if (to === liveText.trim()) {
      skip("no change");
      continue;
    }
    updates.push({ questionId: entry.questionId, from: liveText, to });
  }

  return { updates, skipped };
}
