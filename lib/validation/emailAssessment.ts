import { z } from "zod";

// ─────────────────────────────────────────────
// PRACTICE ATTEMPT OVERRIDE SCHEMAS
// ─────────────────────────────────────────────

export const createEmailAssessmentOverrideSchema = z.object({
  userId: z.string().trim().min(1, "User is required"),
  dailyLimit: z.coerce.number().int().min(1).max(365),
});

export type CreateEmailAssessmentOverrideInput = z.infer<
  typeof createEmailAssessmentOverrideSchema
>;
