"use client";

import { AlertCircle, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { MODE_LABELS } from "@/components/labPractice/shared";
import { Button } from "@/components/ui/button";
import type { ProgressionMode } from "@/lib/labPractice/constants";

const ENDPOINT = "/api/lab-practice/modules/import";

type ImportResponse = {
  summary: {
    modules: { title: string; progressionMode: ProgressionMode; labs: number; tasks: number; steps: number }[];
    totals: { modules: number; labs: number; tasks: number; steps: number };
  };
  errors: { row: number | null; message: string }[];
  created: { id: number; title: string }[];
};

async function send(file: File, commit: boolean): Promise<{ ok: boolean; body: ImportResponse | null; error?: string }> {
  const form = new FormData();
  form.set("file", file);
  if (commit) form.set("commit", "true");
  const res = await fetch(ENDPOINT, { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  if (body && "summary" in body) return { ok: res.ok, body };
  return { ok: false, body: null, error: body?.error ?? "Upload failed." };
}

/** Download the Excel template, upload it filled in, preview, then import. */
export function BulkImportCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [created, setCreated] = useState<ImportResponse["created"]>([]);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setCreated([]);
    setBusy("preview");
    const res = await send(f, false);
    setBusy(null);
    if (!res.body) {
      toast.error(res.error);
      reset();
      return;
    }
    setPreview(res.body);
  }

  async function runImport() {
    if (!file) return;
    setBusy("import");
    const res = await send(file, true);
    setBusy(null);
    if (!res.body) {
      toast.error(res.error);
      return;
    }
    if (!res.ok) {
      setPreview(res.body); // re-validated with new errors
      return;
    }
    const n = res.body.created.length;
    toast.success(`${n} module${n === 1 ? "" : "s"} created.`);
    setCreated(res.body.created);
    reset();
    router.refresh();
  }

  const errors = preview?.errors ?? [];
  const totals = preview?.summary.totals;

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        Build several modules at once: fill one row per step in the Excel template, then upload it.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={ENDPOINT} download>
            <Download className="size-4" /> Download template
          </a>
        </Button>
        <DefaultButton
          size="sm"
          loading={busy === "preview"}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" /> Upload filled template
        </DefaultButton>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
          aria-label="Curriculum Excel file"
        />
      </div>

      {file && preview && (
        <div className="space-y-3 rounded-lg border border-white/10 p-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 shrink-0 text-itbd-blue" />
            <p className="min-w-0 flex-1 truncate text-sm text-white">{file.name}</p>
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Clear file">
              <X />
            </Button>
          </div>

          {totals && totals.modules > 0 && (
            <div className="divide-y divide-white/10 rounded-md border border-white/10 text-sm">
              {preview.summary.modules.map((m) => (
                <div key={m.title} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{m.title}</span>
                    <span className="text-xs text-white/50">{MODE_LABELS[m.progressionMode]}</span>
                  </span>
                  <span className="shrink-0 text-xs text-white/60">
                    {m.labs} labs · {m.tasks} tasks · {m.steps} steps
                  </span>
                </div>
              ))}
            </div>
          )}

          {errors.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                <AlertCircle className="size-4 text-itbd-blue" />
                {errors.length === 100 ? "100+" : errors.length} problem{errors.length === 1 ? "" : "s"} — fix
                them in Excel and upload again. Nothing was imported.
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md bg-white/5 p-2 text-xs text-white/70">
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.row !== null && <span className="mr-1.5 font-semibold text-white">Row {e.row}:</span>}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            totals && (
              <DefaultButton size="sm" onClick={runImport} loading={busy === "import"}>
                Import {totals.modules} module{totals.modules === 1 ? "" : "s"} ({totals.steps} steps)
              </DefaultButton>
            )
          )}
        </div>
      )}

      {created.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="text-white/60">Created — open one to review or adjust:</p>
          {created.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/practice/trainer/modules/${c.id}`}
              className="block truncate text-itbd-blue hover:underline"
            >
              {c.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
