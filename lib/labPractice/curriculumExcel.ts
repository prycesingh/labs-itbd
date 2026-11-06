import ExcelJS from "exceljs";
import { inArray } from "drizzle-orm";

import { db } from "@/DB/drizzle";
import {
  labPracticeLabs,
  labPracticeModules,
  labPracticeSteps,
  labPracticeTasks,
} from "@/DB/labPracticeSchema";
import { PROGRESSION_MODES, type ProgressionMode } from "@/lib/labPractice/constants";

/**
 * Bulk curriculum import/export via an Excel template.
 *
 * Format — ONE sheet ("Curriculum"), ONE ROW PER STEP, hierarchy flattened
 * into columns: Module → Lab → Task → Step. To keep the sheet quick to fill,
 * a blank Module / Lab / Task title INHERITS the title from the row above,
 * as long as the row has something at that level or deeper. So a module with
 * 12 steps only needs its title typed once.
 *
 * Rows that share a title under the same parent are MERGED (case-insensitive,
 * matching the DB's unique-title collation); first appearance sets the
 * sequence order. A repeated attribute (e.g. Lab Description) must either be
 * blank or identical — a differing value is an error rather than a silent
 * "last one wins".
 *
 * The import only CREATES new modules (titles must not already exist) and is
 * all-or-nothing: any error → nothing written. Created modules are then
 * edited in the normal builder.
 */

export const TEMPLATE_SHEET = "Curriculum";
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5_000;
const MAX_MODULES = 50;
const MAX_REPORTED_ERRORS = 100;
const TITLE_MAX = 200;
const TEXT_MAX = 20_000;

// ─────────────────────────────────────────────
// Column definitions (shared by template + parser)
// ─────────────────────────────────────────────
type ColumnKey =
  | "moduleTitle"
  | "moduleInfo"
  | "progressionMode"
  | "labTitle"
  | "labDescription"
  | "labScenario"
  | "taskTitle"
  | "taskDescription"
  | "stepTitle"
  | "stepInstructions"
  | "requiresPhoto";

type Column = { key: ColumnKey; header: string; width: number; note: string; wrap?: boolean };

const COLUMNS: Column[] = [
  { key: "moduleTitle", header: "Module Title *", width: 28, note: "Required on the module's first row. Leave blank on following rows to stay in the same module. Must not match an existing module." },
  { key: "moduleInfo", header: "Module Info", width: 36, wrap: true, note: "Optional overview shown to trainees." },
  { key: "progressionMode", header: "Progression Mode", width: 20, note: "fully_sequential (default), steps_in_order or free_order." },
  { key: "labTitle", header: "Lab Title *", width: 28, note: "Required on the lab's first row. Leave blank to stay in the same lab." },
  { key: "labDescription", header: "Lab Description *", width: 40, wrap: true, note: "Required once per lab (on any of its rows)." },
  { key: "labScenario", header: "Lab Scenario", width: 40, wrap: true, note: "Optional real-world situation the trainee works through." },
  { key: "taskTitle", header: "Task Title", width: 28, note: "Leave blank to stay in the same task." },
  { key: "taskDescription", header: "Task Description", width: 36, wrap: true, note: "Optional." },
  { key: "stepTitle", header: "Step Title", width: 30, note: "One step per row. Must be unique within its task." },
  { key: "stepInstructions", header: "Step Instructions", width: 44, wrap: true, note: "Optional." },
  { key: "requiresPhoto", header: "Requires Photo", width: 16, note: "Yes / No (blank = No)." },
];

type RowValues = Record<ColumnKey, string>;

const LEVEL_COLUMNS = {
  module: ["moduleTitle", "moduleInfo", "progressionMode"],
  lab: ["labTitle", "labDescription", "labScenario"],
  task: ["taskTitle", "taskDescription"],
  step: ["stepTitle", "stepInstructions", "requiresPhoto"],
} as const satisfies Record<string, readonly ColumnKey[]>;

// ─────────────────────────────────────────────
// Template
// ─────────────────────────────────────────────
const EXAMPLE_ROWS: Partial<RowValues>[] = [
  {
    moduleTitle: "Windows Server Fundamentals",
    moduleInfo: "Core server administration for new L1 engineers.",
    progressionMode: "fully_sequential",
    labTitle: "Active Directory setup",
    labDescription: "Stand up a domain controller and manage users.",
    labScenario: "A new 20-seat client needs a fresh domain before Monday.",
    taskTitle: "Install AD DS",
    taskDescription: "Promote the server to a domain controller.",
    stepTitle: "Add the AD DS role",
    stepInstructions: "Server Manager → Add Roles and Features → Active Directory Domain Services.",
    requiresPhoto: "No",
  },
  {
    stepTitle: "Promote to domain controller",
    stepInstructions: "Create a new forest named lab.local.",
    requiresPhoto: "Yes",
  },
  {
    taskTitle: "Manage users",
    stepTitle: "Create an OU structure",
    requiresPhoto: "No",
  },
  { stepTitle: "Create 5 test users", requiresPhoto: "Yes" },
  {
    labTitle: "DNS and DHCP",
    labDescription: "Configure name resolution and address leasing.",
    taskTitle: "Configure DHCP scope",
    stepTitle: "Create a scope for 10.0.0.0/24",
    requiresPhoto: "Yes",
  },
  {
    moduleTitle: "Networking Basics",
    progressionMode: "free_order",
    labTitle: "Cabling",
    labDescription: "Terminate and test Ethernet cables.",
    taskTitle: "Crimp a patch cable",
    stepTitle: "Crimp both ends to T568B",
    requiresPhoto: "Yes",
  },
];

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));
  const header = ws.getRow(1);
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.note = c.note;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    // ITBD Blue header on the brand's black foundation.
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00ADDA" } };
    cell.alignment = { vertical: "middle" };
  });
  header.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  COLUMNS.forEach((c, i) => {
    if (c.wrap) ws.getColumn(i + 1).alignment = { wrapText: true, vertical: "top" };
  });
}

function addValidations(ws: ExcelJS.Worksheet, lastRow: number) {
  const modeCol = COLUMNS.findIndex((c) => c.key === "progressionMode") + 1;
  const photoCol = COLUMNS.findIndex((c) => c.key === "requiresPhoto") + 1;
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(r, modeCol).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${PROGRESSION_MODES.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Progression mode",
      error: `Pick one of: ${PROGRESSION_MODES.join(", ")}`,
    };
    ws.getCell(r, photoCol).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Yes,No"'],
      showErrorMessage: true,
      errorTitle: "Requires photo",
      error: "Pick Yes or No",
    };
  }
}

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Labs ITBD";
  wb.created = new Date();

  // Instructions
  const help = wb.addWorksheet("Instructions");
  help.getColumn(1).width = 110;
  const lines: [string, Partial<ExcelJS.Font>?][] = [
    ["Lab Practice — bulk curriculum import", { bold: true, size: 14, color: { argb: "FF00ADDA" } }],
    [""],
    ["How to fill it in", { bold: true }],
    [`1. Enter your curriculum on the "${TEMPLATE_SHEET}" sheet — one row per step. Only that sheet is imported.`],
    ["2. A blank Module / Lab / Task title means \"same as the row above\", so type each title only once."],
    ["3. Every lab needs a Lab Description (put it on any one of that lab's rows). Lab Scenario is optional."],
    ["4. A row may stop early: a row with only a Lab (no task/step) creates an empty lab you can fill later."],
    ["5. Rows are imported in sheet order — that order becomes the lab / task / step sequence."],
    ["6. Module titles must be NEW. To change an existing module, use the builder in the app."],
    ["7. Progression Mode: fully_sequential (default), steps_in_order, or free_order."],
    ["8. Requires Photo: Yes / No (blank = No)."],
    [""],
    ["If anything is wrong, nothing is imported — the upload lists each problem with its row number.", { italic: true }],
    [`See the "Example" sheet for a filled-in sample (it is NOT imported).`, { italic: true }],
    [""],
    ["Columns", { bold: true }],
    ...COLUMNS.map((c): [string] => [`${c.header} — ${c.note}`]),
  ];
  lines.forEach(([text, font], i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    if (font) cell.font = font;
    cell.alignment = { wrapText: true };
  });

  // Curriculum (blank, to fill)
  const sheet = wb.addWorksheet(TEMPLATE_SHEET);
  styleHeader(sheet);
  addValidations(sheet, 1000);

  // Example (ignored on import)
  const example = wb.addWorksheet("Example");
  styleHeader(example);
  for (const row of EXAMPLE_ROWS) example.addRow(row);

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────
export type ImportIssue = { row: number | null; message: string };

type StepPlan = { title: string; instructions: string | null; requiresPhoto: boolean };
type TaskPlan = { title: string; description: string | null; steps: StepPlan[] };
type LabPlan = { title: string; description: string; scenario: string | null; tasks: TaskPlan[] };
export type ModulePlan = {
  title: string;
  info: string | null;
  progressionMode: ProgressionMode;
  labs: LabPlan[];
};

export type ImportSummary = {
  modules: { title: string; progressionMode: ProgressionMode; labs: number; tasks: number; steps: number }[];
  totals: { modules: number; labs: number; tasks: number; steps: number };
};

export type ParseResult = { plan: ModulePlan[]; summary: ImportSummary; errors: ImportIssue[] };

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("formula" in value || "sharedFormula" in value) {
      return cellText((value as { result?: ExcelJS.CellValue }).result ?? null);
    }
    if ("text" in value) return String(value.text ?? "").trim(); // hyperlink
  }
  return "";
}

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const titleKey = (s: string) => s.trim().toLowerCase();

function parseMode(raw: string): ProgressionMode | null {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (PROGRESSION_MODES as readonly string[]).includes(v) ? (v as ProgressionMode) : null;
}

function parseYesNo(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (["", "no", "n", "false", "0"].includes(v)) return false;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  return null;
}

// Mutable build-time nodes (track which row set each attribute, for messages).
type Attr = { value: string; row: number } | null;
type StepNode = { title: string; row: number; instructions: string; requiresPhoto: boolean };
type TaskNode = { title: string; description: Attr; steps: Map<string, StepNode> };
type LabNode = { title: string; row: number; description: Attr; scenario: Attr; tasks: Map<string, TaskNode> };
type ModuleNode = { title: string; row: number; info: Attr; mode: Attr; labs: Map<string, LabNode> };

/** Parse + validate an uploaded workbook. Never throws for bad content —
 *  problems come back in `errors`. */
export async function parseCurriculumWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const errors: ImportIssue[] = [];
  const fail = (row: number | null, message: string) => {
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message });
  };
  const empty: ParseResult = {
    plan: [],
    summary: { modules: [], totals: { modules: 0, labs: 0, tasks: 0, steps: 0 } },
    errors,
  };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as never);
  } catch {
    fail(null, "Could not read the file — upload the .xlsx template (not .xls or .csv).");
    return empty;
  }

  const ws =
    wb.getWorksheet(TEMPLATE_SHEET) ??
    wb.worksheets.find((w) => normHeader(w.name) === normHeader(TEMPLATE_SHEET));
  if (!ws) {
    fail(null, `Sheet "${TEMPLATE_SHEET}" not found — download a fresh template.`);
    return empty;
  }

  // Map columns by header text so reordered/extra columns still work.
  const colOf = new Map<ColumnKey, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const h = normHeader(cellText(cell.value));
    const match = COLUMNS.find((c) => normHeader(c.header) === h);
    if (match && !colOf.has(match.key)) colOf.set(match.key, col);
  });
  for (const req of ["moduleTitle", "labTitle", "labDescription"] as const) {
    if (!colOf.has(req)) {
      fail(1, `Missing column "${COLUMNS.find((c) => c.key === req)!.header}" — download a fresh template.`);
    }
  }
  if (errors.length) return empty;

  if (ws.rowCount - 1 > MAX_ROWS) {
    fail(null, `Too many rows (max ${MAX_ROWS}). Split the file into smaller uploads.`);
    return empty;
  }

  const modules = new Map<string, ModuleNode>();
  let ctxModule: ModuleNode | null = null;
  let ctxLab: LabNode | null = null;
  let ctxTask: TaskNode | null = null;

  const setAttr = (node: Record<string, unknown>, field: string, label: string, value: string, row: number, owner: string) => {
    if (!value) return;
    const cur = node[field] as Attr;
    if (!cur) node[field] = { value, row };
    else if (cur.value !== value) {
      fail(row, `${label} for "${owner}" differs from row ${cur.row}. Give it once, or repeat it exactly.`);
    }
  };

  const checkLen = (row: number, label: string, value: string, max: number) => {
    if (value.length > max) fail(row, `${label} is too long (max ${max.toLocaleString()} characters).`);
  };

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const v = Object.fromEntries(
      COLUMNS.map((c) => [c.key, colOf.has(c.key) ? cellText(row.getCell(colOf.get(c.key)!).value) : ""]),
    ) as RowValues;
    // An explicit "No" (the dropdown default people tend to fill) carries no
    // information — treat it as blank so it doesn't count as step content.
    if (parseYesNo(v.requiresPhoto) === false) v.requiresPhoto = "";
    const has =(keys: readonly ColumnKey[]) => keys.some((k) => v[k] !== "");
    if (!has(COLUMNS.map((c) => c.key))) continue; // blank row

    for (const c of COLUMNS) {
      const isTitle = c.key.endsWith("Title");
      checkLen(r, c.header.replace(" *", ""), v[c.key], isTitle ? TITLE_MAX : TEXT_MAX);
    }

    const hasLab = has([...LEVEL_COLUMNS.lab, ...LEVEL_COLUMNS.task, ...LEVEL_COLUMNS.step]);
    const hasTask = has([...LEVEL_COLUMNS.task, ...LEVEL_COLUMNS.step]);
    const hasStep = has(LEVEL_COLUMNS.step);

    // ── Module ──
    if (v.moduleTitle) {
      const key = titleKey(v.moduleTitle);
      let mod = modules.get(key);
      if (!mod) {
        if (modules.size >= MAX_MODULES) {
          fail(r, `Too many modules in one file (max ${MAX_MODULES}).`);
          break;
        }
        mod = { title: v.moduleTitle, row: r, info: null, mode: null, labs: new Map() };
        modules.set(key, mod);
      }
      if (mod !== ctxModule) {
        ctxLab = null;
        ctxTask = null;
      }
      ctxModule = mod;
    } else if (!ctxModule) {
      fail(r, "Module Title is required (no module above to continue).");
      continue;
    }
    const mod = ctxModule;
    setAttr(mod, "info", "Module Info", v.moduleInfo, r, mod.title);
    if (v.progressionMode) {
      if (!parseMode(v.progressionMode)) {
        fail(r, `Progression Mode "${v.progressionMode}" is not valid — use ${PROGRESSION_MODES.join(", ")}.`);
      } else {
        setAttr(mod, "mode", "Progression Mode", parseMode(v.progressionMode)!, r, mod.title);
      }
    }
    if (!hasLab) {
      ctxLab = null;
      ctxTask = null;
      continue;
    }

    // ── Lab ──
    if (v.labTitle) {
      const key = titleKey(v.labTitle);
      let lab = mod.labs.get(key);
      if (!lab) {
        lab = { title: v.labTitle, row: r, description: null, scenario: null, tasks: new Map() };
        mod.labs.set(key, lab);
      }
      if (lab !== ctxLab) ctxTask = null;
      ctxLab = lab;
    } else if (!ctxLab) {
      fail(r, "Lab Title is required (no lab above to continue in this module).");
      continue;
    }
    const lab = ctxLab;
    setAttr(lab, "description", "Lab Description", v.labDescription, r, lab.title);
    setAttr(lab, "scenario", "Lab Scenario", v.labScenario, r, lab.title);
    if (!hasTask) {
      ctxTask = null;
      continue;
    }

    // ── Task ──
    if (v.taskTitle) {
      const key = titleKey(v.taskTitle);
      let task = lab.tasks.get(key);
      if (!task) {
        task = { title: v.taskTitle, description: null, steps: new Map() };
        lab.tasks.set(key, task);
      }
      ctxTask = task;
    } else if (!ctxTask) {
      fail(r, "Task Title is required (no task above to continue in this lab).");
      continue;
    }
    const task = ctxTask;
    setAttr(task, "description", "Task Description", v.taskDescription, r, task.title);
    if (!hasStep) continue;

    // ── Step ──
    if (!v.stepTitle) {
      fail(r, "Step Title is required when Step Instructions or Requires Photo is filled.");
      continue;
    }
    const photo = parseYesNo(v.requiresPhoto);
    if (photo === null) fail(r, `Requires Photo "${v.requiresPhoto}" is not valid — use Yes or No.`);
    const sKey = titleKey(v.stepTitle);
    const dup = task.steps.get(sKey);
    if (dup) {
      fail(r, `Step "${v.stepTitle}" already appears in task "${task.title}" on row ${dup.row}.`);
      continue;
    }
    task.steps.set(sKey, {
      title: v.stepTitle,
      row: r,
      instructions: v.stepInstructions,
      requiresPhoto: photo ?? false,
    });
  }

  if (modules.size === 0 && errors.length === 0) {
    fail(null, `No rows found on the "${TEMPLATE_SHEET}" sheet.`);
  }

  // Whole-plan checks
  for (const mod of modules.values()) {
    for (const lab of mod.labs.values()) {
      if (!lab.description) {
        fail(lab.row, `Lab "${lab.title}" (module "${mod.title}") needs a Lab Description.`);
      }
    }
  }

  // Module titles must be new.
  if (modules.size) {
    const titles = [...modules.values()].map((m) => m.title);
    const existing = await db
      .select({ title: labPracticeModules.title })
      .from(labPracticeModules)
      .where(inArray(labPracticeModules.title, titles));
    const taken = new Set(existing.map((e) => titleKey(e.title)));
    for (const mod of modules.values()) {
      if (taken.has(titleKey(mod.title))) {
        fail(mod.row, `Module "${mod.title}" already exists — rename it, or edit the existing module in the builder.`);
      }
    }
  }

  const plan: ModulePlan[] = [...modules.values()].map((m) => ({
    title: m.title,
    info: m.info?.value ?? null,
    progressionMode: (m.mode?.value as ProgressionMode | undefined) ?? "fully_sequential",
    labs: [...m.labs.values()].map((l) => ({
      title: l.title,
      description: l.description?.value ?? "",
      scenario: l.scenario?.value ?? null,
      tasks: [...l.tasks.values()].map((t) => ({
        title: t.title,
        description: t.description?.value ?? null,
        steps: [...t.steps.values()].map((s) => ({
          title: s.title,
          instructions: s.instructions || null,
          requiresPhoto: s.requiresPhoto,
        })),
      })),
    })),
  }));

  const summaryModules = plan.map((m) => {
    const tasks = m.labs.flatMap((l) => l.tasks);
    return {
      title: m.title,
      progressionMode: m.progressionMode,
      labs: m.labs.length,
      tasks: tasks.length,
      steps: tasks.reduce((n, t) => n + t.steps.length, 0),
    };
  });
  const totals = summaryModules.reduce(
    (acc, m) => ({
      modules: acc.modules + 1,
      labs: acc.labs + m.labs,
      tasks: acc.tasks + m.tasks,
      steps: acc.steps + m.steps,
    }),
    { modules: 0, labs: 0, tasks: 0, steps: 0 },
  );

  errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  return { plan, summary: { modules: summaryModules, totals }, errors };
}

// ─────────────────────────────────────────────
// Import (single transaction)
// ─────────────────────────────────────────────
export async function importCurriculum(
  plan: ModulePlan[],
  trainerId: number,
): Promise<{ id: number; title: string }[]> {
  return db.transaction(async (tx) => {
    const created: { id: number; title: string }[] = [];
    for (const mod of plan) {
      const [m] = await tx.insert(labPracticeModules).values({
        title: mod.title,
        info: mod.info,
        progressionMode: mod.progressionMode,
        createdBy: trainerId,
      });
      created.push({ id: m.insertId, title: mod.title });

      for (const [li, lab] of mod.labs.entries()) {
        const [l] = await tx.insert(labPracticeLabs).values({
          moduleId: m.insertId,
          title: lab.title,
          description: lab.description,
          scenario: lab.scenario,
          sequenceNo: li + 1,
          createdBy: trainerId,
        });

        for (const [ti, task] of lab.tasks.entries()) {
          const [t] = await tx.insert(labPracticeTasks).values({
            labId: l.insertId,
            title: task.title,
            description: task.description,
            sequenceNo: ti + 1,
            createdBy: trainerId,
          });

          if (task.steps.length) {
            await tx.insert(labPracticeSteps).values(
              task.steps.map((s, si) => ({
                taskId: t.insertId,
                title: s.title,
                instructions: s.instructions,
                requiresPhoto: s.requiresPhoto,
                sequenceNo: si + 1,
                createdBy: trainerId,
              })),
            );
          }
        }
      }
    }
    return created;
  });
}
