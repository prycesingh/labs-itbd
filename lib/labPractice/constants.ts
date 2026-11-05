/**
 * Client-safe Lab Practice constants (no DB / server imports) — shared by the
 * Drizzle schema, Zod validation, API and client components.
 */

export const PROGRESSION_MODES = [
  "free_order", // anything, any time
  "steps_in_order", // steps inside a task sequential; labs/tasks free
  "fully_sequential", // DEFAULT — step, task and lab each unlock after the previous
] as const;
export type ProgressionMode = (typeof PROGRESSION_MODES)[number];

// Photo proof limits
export const PHOTO_MAX_FILES = 10;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
