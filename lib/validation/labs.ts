/**
 * Labs Module Zod Validation Schemas
 *
 * Used for:
 * - Request body validation
 * - Response type safety
 */

import { z } from "zod";

// ─────────────────────────────────────────────
// GLOSSARY SCHEMAS
// ─────────────────────────────────────────────

export const upsertGlossaryTermSchema = z.object({
  term: z.string().trim().min(1, "Term is required").max(160),
  category: z.string().trim().min(1, "Category is required").max(80),
  definition: z.string().trim().min(1, "Definition is required"),
  example: z.string().trim().max(1000).optional(),
});

export type UpsertGlossaryTermInput = z.infer<typeof upsertGlossaryTermSchema>;

// ─────────────────────────────────────────────
// SERVICES CATALOG SCHEMAS
// ─────────────────────────────────────────────

export const upsertServicesCatalogEntrySchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(80),
  name: z.string().trim().min(1, "Name is required").max(160),
  icon: z.string().trim().max(16).optional(),
  description: z.string().trim().min(1, "Description is required"),
  whenToUse: z.string().trim().optional(),
  alternative: z.string().trim().max(160).optional(),
  pricing: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpsertServicesCatalogEntryInput = z.infer<typeof upsertServicesCatalogEntrySchema>;

// ─────────────────────────────────────────────
// CLOUD COMPARISON SCHEMAS
// ─────────────────────────────────────────────

export const upsertCloudComparisonSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(80),
  label: z.string().trim().min(1, "Label is required").max(160),
  azureEquivalent: z.string().trim().max(200).optional(),
  awsEquivalent: z.string().trim().max(200).optional(),
  gcpEquivalent: z.string().trim().max(200).optional(),
  note: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpsertCloudComparisonInput = z.infer<typeof upsertCloudComparisonSchema>;

// ─────────────────────────────────────────────
// GOTCHAS SCHEMAS
// ─────────────────────────────────────────────

export const upsertGotchaSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(80),
  title: z.string().trim().min(1, "Title is required").max(200),
  symptom: z.string().trim().min(1, "Symptom is required"),
  cause: z.string().trim().min(1, "Cause is required"),
  fix: z.string().trim().min(1, "Fix is required"),
  sortOrder: z.number().int().optional(),
});

export type UpsertGotchaInput = z.infer<typeof upsertGotchaSchema>;

// ─────────────────────────────────────────────
// CERT ROADMAP SCHEMAS
// ─────────────────────────────────────────────

export const upsertCertRoadmapEntrySchema = z.object({
  certCode: z.string().trim().min(1, "Cert code is required").max(20),
  certName: z.string().trim().min(1, "Cert name is required").max(160),
  level: z.string().trim().min(1, "Level is required").max(40),
  track: z.string().trim().min(1, "Track is required").max(60),
  description: z.string().trim().min(1, "Description is required"),
  studyTime: z.string().trim().max(80).optional(),
  examFormat: z.string().trim().max(120).optional(),
  passingScore: z.string().trim().max(40).optional(),
  pricing: z.string().trim().max(80).optional(),
  relatedSims: z.string().trim().max(200).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  tips: z.string().trim().optional(),
  relatedSimulatorKeys: z.array(z.string().trim().min(1)).optional(),
  sortOrder: z.number().int().optional(),
});

export type UpsertCertRoadmapEntryInput = z.infer<typeof upsertCertRoadmapEntrySchema>;

// ─────────────────────────────────────────────
// PRODUCTION CHECKLIST SCHEMAS
// ─────────────────────────────────────────────

export const upsertProductionChecklistItemSchema = z.object({
  checklistName: z.string().trim().min(1, "Checklist name is required").max(120),
  category: z.string().trim().min(1, "Category is required").max(80),
  item: z.string().trim().min(1, "Item is required"),
  sortOrder: z.number().int().optional(),
});

export type UpsertProductionChecklistItemInput = z.infer<typeof upsertProductionChecklistItemSchema>;

// ─────────────────────────────────────────────
// KQL PLAYGROUND SCHEMAS
// ─────────────────────────────────────────────

export const upsertKqlPlaygroundQuerySchema = z.object({
  level: z.string().trim().min(1, "Level is required").max(40),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().optional(),
  kqlQuery: z.string().trim().min(1, "KQL query is required"),
  explanation: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpsertKqlPlaygroundQueryInput = z.infer<typeof upsertKqlPlaygroundQuerySchema>;

// ─────────────────────────────────────────────
// TROUBLESHOOT FLOWCHART SCHEMAS
// ─────────────────────────────────────────────

export const upsertTroubleshootFlowchartStepSchema = z.object({
  flowName: z.string().trim().min(1, "Flow name is required").max(160),
  stepIndex: z.number().int().nonnegative(),
  stepType: z.enum(["question", "action", "success", "failure"]),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().min(1, "Description is required"),
});

export type UpsertTroubleshootFlowchartStepInput = z.infer<typeof upsertTroubleshootFlowchartStepSchema>;

// ─────────────────────────────────────────────
// QUIZ CERT SCHEMAS
// ─────────────────────────────────────────────

export const upsertQuizCertSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(20),
  name: z.string().trim().min(1, "Name is required").max(160),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpsertQuizCertInput = z.infer<typeof upsertQuizCertSchema>;

// ─────────────────────────────────────────────
// QUIZ QUESTION SCHEMAS
// ─────────────────────────────────────────────

export const upsertQuizQuestionSchema = z
  .object({
    certId: z.string().uuid("Invalid cert ID"),
    question: z.string().trim().min(1, "Question is required"),
    options: z.array(z.string().trim().min(1)).min(2, "At least 2 options are required"),
    correctIndexes: z.array(z.number().int().nonnegative()).min(1, "At least 1 correct answer is required"),
    explanation: z.string().trim().min(1, "Explanation is required"),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.correctIndexes.every((i) => i < data.options.length), {
    message: "correctIndexes must reference valid option indexes",
    path: ["correctIndexes"],
  });

export type UpsertQuizQuestionInput = z.infer<typeof upsertQuizQuestionSchema>;

// ─────────────────────────────────────────────
// QUIZ ATTEMPT SCHEMAS
// ─────────────────────────────────────────────

export const startQuizAttemptSchema = z.object({
  certId: z.string().uuid("Invalid cert ID"),
});

export type StartQuizAttemptInput = z.infer<typeof startQuizAttemptSchema>;

export const submitQuizAnswerSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID"),
  questionId: z.string().uuid("Invalid question ID"),
  selectedIndexes: z.array(z.number().int().nonnegative()).min(1, "At least 1 selection is required"),
});

export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerSchema>;

export const completeQuizAttemptSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID"),
});

export type CompleteQuizAttemptInput = z.infer<typeof completeQuizAttemptSchema>;

// ─────────────────────────────────────────────
// ARTICLE SCHEMAS
// ─────────────────────────────────────────────

export const upsertArticleSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required").max(160),
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.string().trim().min(1, "Category is required").max(80),
  sourcePage: z.string().trim().min(1, "Source page is required").max(120),
  summary: z.string().trim().max(2000).optional(),
  bodyMarkdown: z.string().min(1, "Body is required"),
  sortOrder: z.number().int().optional(),
});

export type UpsertArticleInput = z.infer<typeof upsertArticleSchema>;
