import { db } from "@/DB/drizzle";
import { interviewModules } from "@/DB/interviewSchema";
import { eq } from "drizzle-orm";

/**
 * GET /api/interview/modules?active=true
 * List active interview modules (public - for user discovery)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    let query = db.select().from(interviewModules);

    if (activeOnly) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(eq(interviewModules.isActive, true)) as any;
    }

    const modules = await query;
    return Response.json(modules, { status: 200 });
  } catch (error) {
    console.error("GET /api/interview/modules:", error);
    return Response.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}
