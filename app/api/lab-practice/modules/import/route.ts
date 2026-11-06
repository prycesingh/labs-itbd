import { NextResponse } from "next/server";

import { handleError } from "@/lib/labPractice/api";
import {
  buildTemplate,
  IMPORT_MAX_BYTES,
  importCurriculum,
  parseCurriculumWorkbook,
} from "@/lib/labPractice/curriculumExcel";
import { jsonError, requireApiTrainer } from "@/lib/labPractice/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — download the blank curriculum Excel template. */
export async function GET() {
  const { response } = await requireApiTrainer();
  if (response) return response;
  const file = await buildTemplate();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="guided-labs-module-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

/**
 * POST multipart { file, commit? } — parse + validate an uploaded template.
 * Without `commit=true` it's a dry run that returns the summary and any row
 * errors. With `commit=true` it re-validates and, only if clean, creates every
 * module in one transaction.
 */
export async function POST(request: Request) {
  const { actor, response } = await requireApiTrainer();
  if (response) return response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return jsonError("Choose an .xlsx file to upload.");
  if (file.size > IMPORT_MAX_BYTES) return jsonError("File is too large (max 5 MB).");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return jsonError("Upload the .xlsx template.");

  const buffer = await file.arrayBuffer();
  // .xlsx is a zip container — check the "PK\x03\x04" signature.
  const sig = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (sig[0] !== 0x50 || sig[1] !== 0x4b || sig[2] !== 0x03 || sig[3] !== 0x04) {
    return jsonError("That file isn't a valid .xlsx workbook.");
  }

  const result = await parseCurriculumWorkbook(buffer);
  const commit = form?.get("commit") === "true";

  if (!commit || result.errors.length) {
    return NextResponse.json(
      { summary: result.summary, errors: result.errors, created: [] },
      { status: commit ? 422 : 200 },
    );
  }

  try {
    const created = await importCurriculum(result.plan, actor.trainer.id);
    return NextResponse.json({ summary: result.summary, errors: [], created }, { status: 201 });
  } catch (err) {
    // A title collision here means someone created the same module between
    // the check and the insert — the transaction rolled back.
    return handleError(err, "A module in this file was just created by someone else — re-upload to check.");
  }
}
