import { db } from "@/DB/drizzle";
import { interviewModuleCapabilities, interviewModules } from "@/DB/interviewSchema";
import { requireAdmin } from "@/lib/admin/guard";
import { setModuleCapability } from "@/lib/interview/moduleCapabilities";
import { updateModuleCapabilitySchema } from "@/lib/validation/interview";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/interview/admin/module-capabilities?moduleId=...
 *
 * Lists every interview module alongside its capability rows, for the
 * admin Module Capabilities page. Modules with no row yet for a given
 * capability key simply omit that key from `capabilities` — the client
 * falls back to the same safe defaults getModuleCapability() would apply
 * (disabled / content-only / daily / static), so an unconfigured module
 * renders correctly without a separate "seed defaults" step.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const moduleIdFilter = request.nextUrl.searchParams.get("moduleId");

  const modules = await db
    .select({ id: interviewModules.id, name: interviewModules.name })
    .from(interviewModules)
    .where(
      moduleIdFilter ? eq(interviewModules.id, moduleIdFilter) : undefined,
    )
    .orderBy(interviewModules.name);

  const capabilityRows = await db
    .select({
      moduleId: interviewModuleCapabilities.moduleId,
      capabilityKey: interviewModuleCapabilities.capabilityKey,
      enabled: interviewModuleCapabilities.enabled,
      config: interviewModuleCapabilities.config,
    })
    .from(interviewModuleCapabilities);

  const capabilitiesByModule = new Map<
    string,
    Record<string, { enabled: boolean; config: Record<string, unknown> }>
  >();
  for (const row of capabilityRows) {
    const existing = capabilitiesByModule.get(row.moduleId) ?? {};
    existing[row.capabilityKey] = {
      enabled: row.enabled,
      config: (row.config as Record<string, unknown>) ?? {},
    };
    capabilitiesByModule.set(row.moduleId, existing);
  }

  const payload = modules.map((mod) => ({
    id: mod.id,
    name: mod.name,
    capabilities: capabilitiesByModule.get(mod.id) ?? {},
  }));

  return NextResponse.json(payload, { status: 200 });
}

/**
 * PATCH /api/interview/admin/module-capabilities
 *
 * Upserts one (moduleId, capabilityKey) row via setModuleCapability() —
 * the same helper every gated backend code path reads through, so a save
 * here takes effect on the very next session/job run with no deploy.
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = updateModuleCapabilitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { moduleId, capabilityKey, enabled, config } = parsed.data;

  const [module] = await db
    .select({ id: interviewModules.id })
    .from(interviewModules)
    .where(eq(interviewModules.id, moduleId))
    .limit(1);

  if (!module) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  await setModuleCapability(
    moduleId,
    capabilityKey,
    { enabled, config },
    guard.userId,
  );

  return NextResponse.json({ success: true }, { status: 200 });
}
