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
import { can } from "@/lib/rbac";

/**
 * Lab Practice identity resolution.
 *
 *   SSO session (users.email) ──email──▶ lab_practice_employees ──▶ trainers
 *
 * Trainer authority comes ONLY from the app role (permission
 * "guidedLabs.train" in lib/rbac.ts). The `lab_practice_trainers` row is just
 * the trainer's identity for foreign keys (created_by, enrollment ownership,
 * rejections): it is created/reactivated on demand the first time a role-holder
 * acts here, and is never consulted for authority — revoking the role revokes
 * trainer access immediately, while their history stays intact.
 * "guidedLabs.viewAll" grants read access to every enrollment (oversight);
 * "guidedLabs.manageAll" lets the holder unassign / re-assign any enrollment.
 */

export type Employee = typeof labPracticeEmployees.$inferSelect;
export type Trainer = typeof labPracticeTrainers.$inferSelect;
export type Enrollment = typeof labPracticeEnrollments.$inferSelect;

export type PracticeActor = {
  userId: string;
  email: string;
  /** guidedLabs.viewAll — may read every enrollment. */
  canViewAll: boolean;
  /** guidedLabs.manageAll — may unassign / re-assign every enrollment. */
  canManageAll: boolean;
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

/** The trainer identity row for an employee who holds the trainer role,
 *  created (or reactivated) on first use. The unique index on employee_id
 *  makes concurrent first requests safe: the loser's insert is ignored. */
async function ensureTrainerRow(employeeId: number): Promise<Trainer> {
  const find = async () =>
    (
      await db
        .select()
        .from(labPracticeTrainers)
        .where(eq(labPracticeTrainers.employeeId, employeeId))
        .limit(1)
    )[0];

  let row = await find();
  if (!row) {
    await db.insert(labPracticeTrainers).values({ employeeId }).onDuplicateKeyUpdate({
      set: { isActive: true },
    });
    row = await find();
  } else if (!row.isActive) {
    await db
      .update(labPracticeTrainers)
      .set({ isActive: true })
      .where(eq(labPracticeTrainers.id, row.id));
    row = { ...row, isActive: true };
  }
  if (!row) throw new Error(`Could not create trainer row for employee ${employeeId}`);
  return row;
}

/** Resolve the current user. Null when not signed in. */
export async function getPracticeActor(): Promise<PracticeActor | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;

  const employee = await getEmployeeByEmail(user.email);
  const trainer =
    employee && can(user.role, "guidedLabs.train") ? await ensureTrainerRow(employee.id) : null;

  return {
    userId: user.id,
    email: user.email.toLowerCase(),
    canViewAll: can(user.role, "guidedLabs.viewAll"),
    canManageAll: can(user.role, "guidedLabs.manageAll"),
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

export type TrainerActor = PracticeActor & { employee: Employee; trainer: Trainer };

export async function requireApiTrainer(): Promise<Guard<TrainerActor>> {
  const g = await requireApiActor();
  if (g.response) return g;
  if (!g.actor.trainer || !g.actor.employee) {
    return {
      actor: null,
      response: jsonError(
        g.actor.employee
          ? "Only trainers can do this."
          : "Your email isn't in the HRIS employee list, so you can't act as a trainer yet.",
        403,
      ),
    };
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
  if (!actor.trainer || !actor.employee) redirect("/dashboard/guided-labs");
  return actor as TrainerActor;
}

// ─────────────────────────────────────────────
// Enrollment access
// ─────────────────────────────────────────────

export type EnrollmentAccess = "trainee" | "trainer" | "admin" | "manager";

export async function getEnrollment(enrollmentId: number): Promise<Enrollment | null> {
  const [row] = await db
    .select()
    .from(labPracticeEnrollments)
    .where(eq(labPracticeEnrollments.id, enrollmentId))
    .limit(1);
  return row ?? null;
}

/**
 * Every way the actor may access an enrollment (empty = no access):
 *   trainee — it is their own enrollment
 *   trainer — they are the trainer who owns it
 *   admin   — guidedLabs.viewAll (read access to everything)
 *   manager — guidedLabs.manageAll (may unassign / re-assign it)
 * These are NOT exclusive: a trainer who enrolls themselves is both trainee
 * and trainer on that enrollment and must be able to act as either (practice
 * on the trainee page, review on the trainer page).
 */
export function enrollmentAccessFor(
  actor: PracticeActor,
  enrollment: Enrollment,
): EnrollmentAccess[] {
  const access: EnrollmentAccess[] = [];
  if (actor.employee && enrollment.traineeId === actor.employee.id) access.push("trainee");
  if (actor.trainer && enrollment.trainerId === actor.trainer.id) access.push("trainer");
  if (actor.canViewAll) access.push("admin");
  if (actor.canManageAll) access.push("manager");
  return access;
}
