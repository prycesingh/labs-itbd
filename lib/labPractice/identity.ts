import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import {
  labPracticeEmployees,
  labPracticeEnrollments,
  labPracticeTrainers,
} from "@/DB/labPracticeSchema";
import { syncIfStale } from "@/lib/labPractice/hris";
import { isAdminRole, type Role } from "@/lib/rbac";

/**
 * Lab Practice identity resolution.
 *
 *   SSO session (users.email) ──email──▶ lab_practice_employees ──▶ trainers
 *
 * Trainer authority comes ONLY from the active `lab_practice_trainers` row
 * (no app role). App admins (ADMIN_ROLES) can read everything and manage the
 * trainer registry, but cannot act as a trainer unless registered as one.
 */

export type Employee = typeof labPracticeEmployees.$inferSelect;
export type Trainer = typeof labPracticeTrainers.$inferSelect;
export type Enrollment = typeof labPracticeEnrollments.$inferSelect;

export type PracticeActor = {
  userId: string;
  email: string;
  isAdmin: boolean;
  employee: Employee | null;
  trainer: Trainer | null;
};

async function findEmployeeByEmail(email: string): Promise<Employee | null> {
  const [row] = await db
    .select()
    .from(labPracticeEmployees)
    .where(
      and(
        eq(labPracticeEmployees.email, email.toLowerCase()),
        eq(labPracticeEmployees.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  const found = await findEmployeeByEmail(email);
  if (found) return found;
  // Cache miss: a new joiner may not be cached yet. Re-sync only if stale so
  // repeated misses (e.g. a contractor not in HRIS) don't hammer the API.
  if (await syncIfStale()) return findEmployeeByEmail(email);
  return null;
}

async function getActiveTrainer(employeeId: number): Promise<Trainer | null> {
  const [row] = await db
    .select()
    .from(labPracticeTrainers)
    .where(
      and(
        eq(labPracticeTrainers.employeeId, employeeId),
        eq(labPracticeTrainers.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Resolve the current user. Null when not signed in. */
export async function getPracticeActor(): Promise<PracticeActor | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;

  const employee = await getEmployeeByEmail(user.email);
  const trainer = employee ? await getActiveTrainer(employee.id) : null;

  return {
    userId: user.id,
    email: user.email.toLowerCase(),
    isAdmin: isAdminRole((user.role ?? null) as Role | null),
    employee,
    trainer,
  };
}

// ─────────────────────────────────────────────
// API guards — return { actor, response }; bail with `if (response) return response;`
// ─────────────────────────────────────────────

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Guard<T> = { actor: T; response: null } | { actor: null; response: NextResponse };

export async function requireApiActor(): Promise<Guard<PracticeActor>> {
  const actor = await getPracticeActor();
  if (!actor) return { actor: null, response: jsonError("Authentication required.", 401) };
  return { actor, response: null };
}

export async function requireApiAdmin(): Promise<Guard<PracticeActor>> {
  const g = await requireApiActor();
  if (g.response) return g;
  if (!g.actor.isAdmin) return { actor: null, response: jsonError("Insufficient permissions.", 403) };
  return g;
}

export type TrainerActor = PracticeActor & { employee: Employee; trainer: Trainer };

export async function requireApiTrainer(): Promise<Guard<TrainerActor>> {
  const g = await requireApiActor();
  if (g.response) return g;
  if (!g.actor.trainer || !g.actor.employee) {
    return { actor: null, response: jsonError("Only registered trainers can do this.", 403) };
  }
  return { actor: g.actor as TrainerActor, response: null };
}

// ─────────────────────────────────────────────
// Page guards (server components)
// ─────────────────────────────────────────────

export async function requirePageActor(): Promise<PracticeActor> {
  const actor = await getPracticeActor();
  if (!actor) redirect("/");
  return actor;
}

export async function requirePageTrainer(): Promise<TrainerActor> {
  const actor = await requirePageActor();
  if (!actor.trainer || !actor.employee) redirect("/dashboard/practice");
  return actor as TrainerActor;
}

export async function requirePageAdmin(): Promise<PracticeActor> {
  const actor = await requirePageActor();
  if (!actor.isAdmin) redirect("/dashboard/practice");
  return actor;
}

// ─────────────────────────────────────────────
// Enrollment access
// ─────────────────────────────────────────────

export type EnrollmentAccess = "trainee" | "trainer" | "admin";

export async function getEnrollment(enrollmentId: number): Promise<Enrollment | null> {
  const [row] = await db
    .select()
    .from(labPracticeEnrollments)
    .where(eq(labPracticeEnrollments.id, enrollmentId))
    .limit(1);
  return row ?? null;
}

/**
 * How (if at all) the actor may access an enrollment:
 *   trainee — it is their own enrollment
 *   trainer — they are the trainer who owns it
 *   admin   — app admin (read access to everything)
 * Order matters: a trainer viewing their own trainee record gets "trainer".
 */
export function enrollmentAccessFor(
  actor: PracticeActor,
  enrollment: Enrollment,
): EnrollmentAccess | null {
  if (actor.trainer && enrollment.trainerId === actor.trainer.id) return "trainer";
  if (actor.employee && enrollment.traineeId === actor.employee.id) return "trainee";
  if (actor.isAdmin) return "admin";
  return null;
}
