import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { z } from "zod";

import { db } from "@/DB/drizzle";
import {
  labPracticeLabs,
  labPracticeModules,
  labPracticeSteps,
  labPracticeTasks,
} from "@/DB/labPracticeSchema";
import { handleError, parseBody, parseId } from "@/lib/labPractice/api";
import { nextSequenceNo, reorderChildren } from "@/lib/labPractice/curriculum";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";
import { reorderSchema } from "@/lib/validation/labPractice";

/**
 * Route-handler factories for the Lab / Task / Step levels, which all share
 * the same shape: POST (create under parent, appended at the end), PUT
 * (reorder all siblings) and PATCH (update one item). Trainer-only.
 */

type ParentTable = typeof labPracticeModules | typeof labPracticeLabs | typeof labPracticeTasks;
type ChildTable = typeof labPracticeLabs | typeof labPracticeTasks | typeof labPracticeSteps;
type Ctx<P extends string> = { params: Promise<Record<P, string>> };

function parentKey(child: ChildTable): "moduleId" | "labId" | "taskId" {
  if (child === labPracticeLabs) return "moduleId";
  if (child === labPracticeTasks) return "labId";
  return "taskId";
}

export function childrenRoutes<P extends string, S extends z.ZodTypeAny>(opts: {
  param: P;
  parent: ParentTable;
  child: ChildTable;
  createSchema: S;
}) {
  async function parentExists(id: number) {
    const [row] = await db
      .select({ id: opts.parent.id })
      .from(opts.parent)
      .where(eq(opts.parent.id, id))
      .limit(1);
    return Boolean(row);
  }

  async function POST(request: Request, context: Ctx<P>) {
    const { actor, response } = await requireApiTrainer();
    if (response) return response;
    const parentId = parseId((await context.params)[opts.param]);
    if (!parentId || !(await parentExists(parentId))) return jsonError("Not found.", 404);

    const { data, response: bad } = await parseBody(request, opts.createSchema);
    if (bad) return bad;

    try {
      const sequenceNo = await nextSequenceNo(opts.child, parentId);
      const [res] = await db.insert(opts.child).values({
        ...(data as object),
        [parentKey(opts.child)]: parentId,
        sequenceNo,
        createdBy: actor.trainer.id,
      } as never);
      return NextResponse.json({ id: res.insertId, sequenceNo }, { status: 201 });
    } catch (err) {
      return handleError(err);
    }
  }

  async function PUT(request: Request, context: Ctx<P>) {
    const { response } = await requireApiTrainer();
    if (response) return response;
    const parentId = parseId((await context.params)[opts.param]);
    if (!parentId) return jsonError("Not found.", 404);

    const { data, response: bad } = await parseBody(request, reorderSchema);
    if (bad) return bad;

    try {
      await reorderChildren(opts.child, parentId, data.orderedIds);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return handleError(err);
    }
  }

  return { POST, PUT };
}

export function itemRoutes<P extends string, S extends z.ZodTypeAny>(opts: {
  param: P;
  table: ParentTable | ChildTable;
  updateSchema: S;
}) {
  async function PATCH(request: Request, context: Ctx<P>) {
    const { response } = await requireApiTrainer();
    if (response) return response;
    const id = parseId((await context.params)[opts.param]);
    if (!id) return jsonError("Not found.", 404);

    const { data, response: bad } = await parseBody(request, opts.updateSchema);
    if (bad) return bad;
    const set = Object.fromEntries(
      Object.entries(data as object).filter(([, v]) => v !== undefined),
    );
    if (!Object.keys(set).length) return jsonError("Nothing to update.");

    try {
      const [res] = await db
        .update(opts.table)
        .set(set as never)
        .where(eq(opts.table.id, id));
      if (!res.affectedRows) return jsonError("Not found.", 404);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return handleError(err);
    }
  }

  return { PATCH };
}
