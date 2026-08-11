import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/interview/admin/practice-overrides/users
 * Minimal user list for the search/select UI on the attempt-overrides admin
 * page. Scoped to ADMIN_ROLES (not superadmin-only like /api/admin/users)
 * since granting a practice-attempt override is not a role-management action.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .orderBy(asc(users.email));

  return NextResponse.json(rows, { status: 200 });
}
