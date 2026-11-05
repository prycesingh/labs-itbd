/**
 * Lab Practice Tracker — Zod validation schemas for API request bodies.
 */

import { z } from "zod";

import { PROGRESSION_MODES } from "@/lib/labPractice/constants";

const title = z.string().trim().min(1, "Title is required").max(200);
const longText = z.string().trim().max(20_000).optional().nullable();
const id = z.coerce.number().int().positive();

// ─────────────────────────────────────────────
// Trainer registry (admin)
// ─────────────────────────────────────────────
export const registerTrainerSchema = z.object({ employeeId: id });
export const setActiveSchema = z.object({ isActive: z.boolean() });

// ─────────────────────────────────────────────
// Curriculum
// ─────────────────────────────────────────────
export const moduleSchema = z.object({
  title,
  info: longText,
  progressionMode: z.enum(PROGRESSION_MODES).default("fully_sequential"),
});
export const moduleUpdateSchema = moduleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const labSchema = z.object({ title, details: longText });
export const labUpdateSchema = labSchema.partial().extend({ isActive: z.boolean().optional() });

export const taskSchema = z.object({ title, description: longText });
export const taskUpdateSchema = taskSchema.partial().extend({ isActive: z.boolean().optional() });

export const stepSchema = z.object({
  title,
  instructions: longText,
  requiresPhoto: z.boolean().default(false),
});
export const stepUpdateSchema = stepSchema.partial().extend({ isActive: z.boolean().optional() });

/** Full desired order of siblings under one parent. */
export const reorderSchema = z.object({
  orderedIds: z.array(id).min(1).max(500),
});

// ─────────────────────────────────────────────
// Enrollment
// ─────────────────────────────────────────────
export const enrollSchema = z.object({
  moduleId: id,
  traineeIds: z.array(id).min(1).max(200),
});

// ─────────────────────────────────────────────
// Practice
// ─────────────────────────────────────────────
const practiceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const commentSchema = z.object({
  practiceDate,
  comment: z.string().trim().max(5_000),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Give the trainee a reason").max(2_000),
});

// Photo limits (shared by API + client dialog)
export { PHOTO_MAX_BYTES, PHOTO_MAX_FILES, PHOTO_MIME_TYPES } from "@/lib/labPractice/constants";
