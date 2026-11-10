import { NextResponse } from "next/server";
import type { z } from "zod";

import { isDuplicateKeyError, ReorderError } from "@/lib/labPractice/curriculum";
import { HrisError } from "@/lib/labPractice/hris";
import {
  enrollmentAccessFor,
  getEnrollment,
  jsonError,
  type EnrollmentAccess,
  type PracticeActor,
} from "@/lib/labPractice/identity";
import { PracticeError } from "@/lib/labPractice/practice";

/** Shared helpers for /api/lab-practice route handlers. */

export function parseId(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response: null } | { data: null; response: NextResponse }> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return { data: null, response: jsonError(message) };
  }
  return { data: parsed.data, response: null };
}

/** Map known domain errors to JSON responses; rethrow anything unexpected. */
export function handleError(err: unknown, duplicateMessage = "That title is already used here.") {
  if (err instanceof PracticeError) return jsonError(err.message, err.status);
  if (err instanceof ReorderError) return jsonError(err.message, 400);
  if (err instanceof HrisError) return jsonError(err.message, 502);
  if (isDuplicateKeyError(err)) return jsonError(duplicateMessage, 409);
  console.error("[lab-practice] unexpected error", err);
  return jsonError("Something went wrong.", 500);
}

/** Load an enrollment and check the actor's access level against `allowed`. */
export async function loadEnrollmentFor(
  actor: PracticeActor,
  rawId: string,
  allowed: EnrollmentAccess[],
) {
  const id = parseId(rawId);
  const enrollment = id ? await getEnrollment(id) : null;
  if (!enrollment) return { enrollment: null, access: null, response: jsonError("Not found.", 404) };
  const access = enrollmentAccessFor(actor, enrollment);
  if (!access.some((a) => allowed.includes(a))) {
    return { enrollment: null, access: null, response: jsonError("Not allowed.", 403) };
  }
  return { enrollment, access, response: null };
}

export { NextResponse };
