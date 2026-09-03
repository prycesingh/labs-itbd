/**
 * One-time migration: creates the "Interview Coach" module and imports
 * interview-coach-main's question bank (150 MSP technical topics + 61 mined
 * screening/behavioral/concept/tools questions) into interviewQuestionBank,
 * preserving grounded answer-key data for module-gated grounded grading.
 *
 * Idempotent: safe to re-run. The module is looked up by name before
 * inserting; each question is looked up by its original interview-coach-main
 * id (stored in sourceId) before inserting, so re-running only fills gaps
 * rather than duplicating rows.
 *
 * Explicitly does not touch any existing module, question, or assignment
 * belonging to Customer Centricity (or any other pre-existing module) — it
 * only inserts new rows and seeds capability rows via setModuleCapability().
 *
 * Usage: npx tsx scripts/migrate-interview-coach-questions.ts
 */

import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "../DB/drizzle";
import {
  interviewModuleQuestionAssignments,
  interviewModules,
  interviewQuestionBank,
} from "../DB/interviewSchema";
import { users } from "../DB/schema";
import {
  CAPABILITY_KEYS,
  setModuleCapability,
} from "../lib/interview/moduleCapabilities";
import { ADMIN_ROLES } from "../lib/rbac";

const COACH_ROOT = path.resolve(__dirname, "..", "interview-coach-main");
const QUESTION_BANK_PATH = path.join(
  COACH_ROOT,
  "data",
  "question_bank.json",
);
const INTERVIEW_SETS_PATH = path.join(
  COACH_ROOT,
  "data",
  "interview_sets.json",
);

const MODULE_NAME = "Interview Coach";

interface AnswerKey {
  coverage?: "full" | "partial" | "none";
  ideal_points?: string[];
  acceptance_criteria?: string[];
  sources?: string[];
}

interface Topic {
  id: string;
  topic: string;
  scenarios?: string[];
  answer_key?: AnswerKey;
}

interface QuestionBankCategory {
  category: string;
  slug: string;
  topics: Topic[];
}

interface QuestionBank {
  categories: QuestionBankCategory[];
}

interface MinedQuestion {
  id: string;
  question: string;
  ideal_points?: string[];
}

interface InterviewSets {
  sets: Record<string, MinedQuestion[]>;
}

/** Mirrors interview.py's _resolve_stub() fallback template — a clear,
 * ticket-scenario-grounded prompt built directly from the topic, since this
 * migration does not run the Python app's LLM question-phrasing step. */
function buildTechnicalPromptText(topic: Topic): string {
  const scenario = topic.scenarios?.[0];
  if (scenario) {
    return `A user reports: "${scenario}". Walk me through how you'd troubleshoot and resolve that.`;
  }
  return `Walk me through how you'd troubleshoot and resolve: ${topic.topic}.`;
}

async function findOrCreateInterviewCoachModule(): Promise<string> {
  const [existing] = await db
    .select({ id: interviewModules.id })
    .from(interviewModules)
    .where(eq(interviewModules.name, MODULE_NAME))
    .limit(1);

  if (existing) {
    console.log(`[migrate] Module "${MODULE_NAME}" already exists (${existing.id})`);
    return existing.id;
  }

  const id = randomUUID();
  await db.insert(interviewModules).values({
    id,
    name: MODULE_NAME,
    description:
      "MSP / service-desk mock interview practice with source-grounded grading, adaptive follow-ups, and acoustic delivery scoring.",
    interviewType: "technical-qa",
    questionDisplayCount: 5,
    isActive: true,
  });
  console.log(`[migrate] Created module "${MODULE_NAME}" (${id})`);
  return id;
}

/**
 * Finds the pre-existing "Customer Centricity" module by fuzzy match rather
 * than an exact/substring name check — the live DB has this module stored
 * under a typo'd name ("Customer Cetricity"), and matching on the
 * "customer-service" interviewType plus a loose "centric"/"cetric" name
 * fragment is more robust than depending on exact spelling.
 */
async function findExistingCustomerCentricityModule(): Promise<{
  id: string;
  name: string;
} | null> {
  const rows = await db
    .select({
      id: interviewModules.id,
      name: interviewModules.name,
      interviewType: interviewModules.interviewType,
    })
    .from(interviewModules)
    .where(eq(interviewModules.interviewType, "customer-service"));

  const match = rows.find((r) => {
    const n = r.name.toLowerCase();
    return n.includes("centric") || n.includes("cetric");
  });
  return match ? { id: match.id, name: match.name } : null;
}

async function seedCapabilities(
  interviewCoachModuleId: string,
  updatedBy: string,
) {
  await setModuleCapability(
    interviewCoachModuleId,
    CAPABILITY_KEYS.DELIVERY_SCORING,
    { enabled: true, config: { calibrationMode: "static" } },
    updatedBy,
  );
  await setModuleCapability(
    interviewCoachModuleId,
    CAPABILITY_KEYS.GROUNDED_GRADING,
    { enabled: true, config: {} },
    updatedBy,
  );
  await setModuleCapability(
    interviewCoachModuleId,
    CAPABILITY_KEYS.FOLLOW_UPS,
    { enabled: true, config: {} },
    updatedBy,
  );
  await setModuleCapability(
    interviewCoachModuleId,
    CAPABILITY_KEYS.EVALUATION_DEPTH,
    {
      enabled: false,
      config: { depth: "full-rubric", dimensionSet: "technical-interview" },
    },
    updatedBy,
  );
  await setModuleCapability(
    interviewCoachModuleId,
    CAPABILITY_KEYS.ATTEMPT_CADENCE,
    { enabled: false, config: { cadence: "weekly" } },
    updatedBy,
  );
  console.log(
    `[migrate] Seeded Interview Coach capabilities: delivery_scoring=on, grounded_grading=on, follow_ups=on, evaluation_depth=full-rubric, attempt_cadence=weekly`,
  );

  const customerCentricity = await findExistingCustomerCentricityModule();
  if (!customerCentricity) {
    console.warn(
      `[migrate] Could not find an existing customer-service module (e.g. "Customer Centricity") — skipping explicit capability seed for it. Seed it manually via the admin Module Capabilities page if needed.`,
    );
    return;
  }
  console.log(
    `[migrate] Found existing customer-service module: "${customerCentricity.name}" (${customerCentricity.id})`,
  );
  const customerCentricityId = customerCentricity.id;

  await setModuleCapability(
    customerCentricityId,
    CAPABILITY_KEYS.DELIVERY_SCORING,
    { enabled: false, config: {} },
    updatedBy,
  );
  await setModuleCapability(
    customerCentricityId,
    CAPABILITY_KEYS.GROUNDED_GRADING,
    { enabled: false, config: {} },
    updatedBy,
  );
  await setModuleCapability(
    customerCentricityId,
    CAPABILITY_KEYS.FOLLOW_UPS,
    { enabled: false, config: {} },
    updatedBy,
  );
  await setModuleCapability(
    customerCentricityId,
    CAPABILITY_KEYS.EVALUATION_DEPTH,
    {
      enabled: false,
      config: { depth: "content-only", dimensionSet: "customer-service" },
    },
    updatedBy,
  );
  await setModuleCapability(
    customerCentricityId,
    CAPABILITY_KEYS.ATTEMPT_CADENCE,
    { enabled: false, config: { cadence: "daily" } },
    updatedBy,
  );
  console.log(
    `[migrate] Seeded Customer Centricity (${customerCentricityId}) capabilities explicitly as disabled/content-only, attempt_cadence=daily`,
  );
}

async function findExistingQuestionBySourceId(
  sourceId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: interviewQuestionBank.id })
    .from(interviewQuestionBank)
    .where(eq(interviewQuestionBank.sourceId, sourceId))
    .limit(1);
  return row?.id ?? null;
}

async function insertQuestionIfMissing(params: {
  sourceId: string;
  primaryModuleId: string;
  promptText: string;
  groundedIdealPoints?: string[];
  groundedAcceptanceCriteria?: string[];
  groundedSources?: string[];
  groundedCoverage?: "full" | "partial" | "none";
}): Promise<string> {
  const existingId = await findExistingQuestionBySourceId(params.sourceId);
  if (existingId) return existingId;

  const id = randomUUID();
  await db.insert(interviewQuestionBank).values({
    id,
    promptText: params.promptText,
    isActive: true,
    primaryModuleId: params.primaryModuleId,
    sourceId: params.sourceId,
    groundedIdealPoints: params.groundedIdealPoints,
    groundedAcceptanceCriteria: params.groundedAcceptanceCriteria,
    groundedSources: params.groundedSources,
    groundedCoverage: params.groundedCoverage,
  });
  return id;
}

async function assignQuestionIfMissing(
  moduleId: string,
  questionId: string,
  questionOrder: number,
) {
  const [existing] = await db
    .select({ id: interviewModuleQuestionAssignments.id })
    .from(interviewModuleQuestionAssignments)
    .where(
      and(
        eq(interviewModuleQuestionAssignments.moduleId, moduleId),
        eq(interviewModuleQuestionAssignments.questionId, questionId),
      ),
    )
    .limit(1);
  if (existing) return;

  await db.insert(interviewModuleQuestionAssignments).values({
    id: randomUUID(),
    moduleId,
    questionId,
    questionOrder,
    isActive: true,
  });
}

async function migrateTechnicalTopics(
  moduleId: string,
  startOrder: number,
): Promise<number> {
  const bank: QuestionBank = JSON.parse(
    fs.readFileSync(QUESTION_BANK_PATH, "utf-8"),
  );

  let order = startOrder;
  let inserted = 0;
  for (const category of bank.categories) {
    for (const topic of category.topics) {
      const ak = topic.answer_key;
      const questionId = await insertQuestionIfMissing({
        sourceId: topic.id,
        primaryModuleId: moduleId,
        promptText: buildTechnicalPromptText(topic),
        groundedIdealPoints: ak?.ideal_points,
        groundedAcceptanceCriteria: ak?.acceptance_criteria,
        groundedSources: ak?.sources,
        groundedCoverage: ak?.coverage ?? "none",
      });
      await assignQuestionIfMissing(moduleId, questionId, order);
      order += 1;
      inserted += 1;
    }
  }
  console.log(`[migrate] Technical topics processed: ${inserted}`);
  return order;
}

async function migrateMinedQuestions(
  moduleId: string,
  startOrder: number,
): Promise<number> {
  const sets: InterviewSets = JSON.parse(
    fs.readFileSync(INTERVIEW_SETS_PATH, "utf-8"),
  );

  let order = startOrder;
  let inserted = 0;
  for (const [, questions] of Object.entries(sets.sets)) {
    for (const q of questions) {
      const questionId = await insertQuestionIfMissing({
        sourceId: q.id,
        primaryModuleId: moduleId,
        promptText: q.question,
        groundedIdealPoints: q.ideal_points,
        groundedCoverage: "full",
      });
      await assignQuestionIfMissing(moduleId, questionId, order);
      order += 1;
      inserted += 1;
    }
  }
  console.log(`[migrate] Mined screening/behavioral/concept/tools questions processed: ${inserted}`);
  return order;
}

async function pickMigrationActor(): Promise<string> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ADMIN_ROLES))
    .limit(1);
  if (admin) return admin.id;

  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser) return anyUser.id;

  throw new Error(
    "[migrate] No users found in the database — cannot attribute capability rows via updatedBy. Create at least one user first.",
  );
}

async function main() {
  console.log("[migrate] Starting Interview Coach question bank migration...");

  const moduleId = await findOrCreateInterviewCoachModule();
  const actor = await pickMigrationActor();
  await seedCapabilities(moduleId, actor);

  let order = 0;
  order = await migrateTechnicalTopics(moduleId, order);
  order = await migrateMinedQuestions(moduleId, order);

  console.log(
    `[migrate] Done. Interview Coach module ${moduleId} now has ${order} assigned questions.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
