/**
 * Interview Coach question types, categories and the interview blueprint.
 *
 * Ported from interview-coach-main, where a "full interview" is not a random
 * pick from the bank but a fixed sequence of question TYPES
 * (data/interview_blueprint.json) — screening → concept → technical → tools
 * → behavioral, like a real ITBD/MSP interview — and questions are rotated so
 * a candidate works through the whole pool before anything repeats
 * (interview.py's _pick_fresh). Our first port dropped both: sessions were 5
 * uniformly random questions from 211, so with 150 technical topics most
 * sessions were 3–4 templated technical questions and no screening or
 * behavioral at all.
 *
 * Everything here is pure (no DB) so it can be unit-tested; the sessions
 * route supplies the pool and the candidate's history.
 */

export const QUESTION_TYPES = [
  "screening",
  "concept",
  "technical",
  "tools",
  "behavioral",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  screening: "Screening",
  concept: "Concept",
  technical: "Technical",
  tools: "Tools",
  behavioral: "Behavioral",
};

export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === "string" &&
    (QUESTION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Category slugs from interview-coach-main's data/question_bank.json →
 * display labels (original labels, with product-name casing corrected).
 */
export const TECHNICAL_CATEGORY_LABELS: Record<string, string> = {
  "end-user-computing": "End User Computing",
  "ad-dns-dhcp": "AD/DNS/DHCP",
  "exchange-online": "Exchange Online",
  "entra-id": "Entra ID",
  "microsoft-intune": "Microsoft Intune",
  sharepoint: "SharePoint",
  teams: "Teams",
  "one-drive": "OneDrive",
  "security-training": "Security Training",
  "mac-training": "Mac Training",
  "kaseya-rmm": "Kaseya RMM",
  "it-glue": "IT Glue",
  "ai-training": "AI Training",
  "windows-networking": "Windows Networking",
};

/** Mined (non-technical) question id prefixes in data/interview_sets.json. */
const MINED_PREFIX_TYPES: Record<string, QuestionType> = {
  scr: "screening",
  beh: "behavioral",
  con: "concept",
  tool: "tools",
};

export interface QuestionClassification {
  questionType: QuestionType;
  /** Display label; for mined questions this is the type label itself. */
  category: string;
}

/**
 * Derives type + category from an imported question's source id, e.g.
 * "scr__about_you" → screening, "kaseya-rmm__agent-procedures" → technical /
 * Kaseya RMM. Returns null for ids that match neither shape (hand-written
 * questions have no source id at all).
 */
export function classifySourceId(
  sourceId: string | null | undefined,
): QuestionClassification | null {
  if (!sourceId) return null;
  const separator = sourceId.indexOf("__");
  if (separator <= 0) return null;
  const prefix = sourceId.slice(0, separator);

  const minedType = MINED_PREFIX_TYPES[prefix];
  if (minedType) {
    return { questionType: minedType, category: QUESTION_TYPE_LABELS[minedType] };
  }

  const technicalCategory = TECHNICAL_CATEGORY_LABELS[prefix];
  if (technicalCategory) {
    return { questionType: "technical", category: technicalCategory };
  }

  return null;
}

// ─────────────────────────────────────────────
// BLUEPRINT
// ─────────────────────────────────────────────

export interface BlueprintSlot {
  type: QuestionType;
}

export interface InterviewBlueprint {
  slots: BlueprintSlot[];
}

/**
 * Default Interview Coach structure — the condensed 7-question version of
 * the original 11-slot full interview, still covering every type in
 * interview order.
 */
export const DEFAULT_COACH_BLUEPRINT: InterviewBlueprint = {
  slots: [
    { type: "screening" },
    { type: "concept" },
    { type: "concept" },
    { type: "technical" },
    { type: "technical" },
    { type: "tools" },
    { type: "behavioral" },
  ],
};

/**
 * Validates a blueprint read from module capability config (untrusted JSON).
 * Unknown slot types are dropped; an empty result is treated as "no
 * blueprint" so the caller falls back to plain random selection.
 */
export function parseBlueprint(config: unknown): InterviewBlueprint | null {
  if (!config || typeof config !== "object") return null;
  const slots = (config as { slots?: unknown }).slots;
  if (!Array.isArray(slots)) return null;

  const valid = slots
    .map((slot) =>
      slot && typeof slot === "object" ? (slot as { type?: unknown }).type : null,
    )
    .filter(isQuestionType)
    .map((type) => ({ type }));

  return valid.length > 0 ? { slots: valid } : null;
}

// ─────────────────────────────────────────────
// SELECTION
// ─────────────────────────────────────────────

/**
 * Whether a session's fixed question set no longer fits the module: wrong
 * size for the current setup, or it includes questions that are no longer
 * active. Only meaningful for sessions with no answers yet — the caller
 * must never refresh a set the candidate has started answering.
 */
export function isQuestionSetStale(
  assignedIds: readonly string[],
  activeIds: Iterable<string>,
  expectedCount: number,
): boolean {
  if (assignedIds.length !== expectedCount) return true;
  const active = new Set(activeIds);
  return assignedIds.some((id) => !active.has(id));
}

export interface SelectableQuestion {
  id: string;
  questionType: QuestionType | null;
}

export interface SelectionOptions {
  /**
   * Question ids the candidate was given before, MOST RECENT FIRST. Unseen
   * questions are always preferred; among seen ones, the one seen longest
   * ago wins — so the whole pool rotates before anything repeats.
   */
  recentlySeenIds?: readonly string[];
  /** Injectable RNG in [0, 1) for deterministic tests. */
  random?: () => number;
}

/**
 * Picks one question per blueprint slot, in slot order.
 *
 * - Within a slot's type: unseen first, else least-recently-seen, ties
 *   broken at random.
 * - If a type has nothing left (e.g. an admin unassigned every "tools"
 *   question), the slot is filled from any remaining question by the same
 *   freshness rule, so the session keeps its length.
 * - A question is never picked twice in one session; if the whole pool is
 *   used up, remaining slots are skipped.
 */
export function selectQuestionsByBlueprint<T extends SelectableQuestion>(
  pool: readonly T[],
  blueprint: InterviewBlueprint,
  options: SelectionOptions = {},
): T[] {
  const random = options.random ?? Math.random;
  const seenRank = new Map<string, number>();
  (options.recentlySeenIds ?? []).forEach((id, index) => {
    // First occurrence = most recent; keep that rank.
    if (!seenRank.has(id)) seenRank.set(id, index);
  });
  // Higher = fresher. Unseen beats everything; then older beats newer.
  const freshness = (id: string) =>
    seenRank.has(id) ? seenRank.get(id)! : Number.POSITIVE_INFINITY;

  const chosen = new Set<string>();
  const result: T[] = [];

  const pickFreshest = (candidates: T[]): T | null => {
    if (candidates.length === 0) return null;
    let best = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      best = Math.max(best, freshness(candidate.id));
    }
    const top = candidates.filter((c) => freshness(c.id) === best);
    return top[Math.floor(random() * top.length)] ?? top[0];
  };

  for (const slot of blueprint.slots) {
    const remaining = pool.filter((question) => !chosen.has(question.id));
    const pick =
      pickFreshest(remaining.filter((q) => q.questionType === slot.type)) ??
      pickFreshest(remaining);
    if (!pick) break;
    chosen.add(pick.id);
    result.push(pick);
  }

  return result;
}
