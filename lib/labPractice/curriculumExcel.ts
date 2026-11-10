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

type Column = {
  key: ColumnKey;
  header: string;
  width: number;
  /** "Required?" column on the Instructions sheet. */
  required: string;
  /** What to type — used for the guide row, header note and cell prompt. */
  what: string;
  /** Allowed values / format. */
  allowed: string;
  wrap?: boolean;
};

const COLUMNS: Column[] = [
  {
    key: "moduleTitle", header: "Module Title *", width: 28,
    required: "Yes — on the module's FIRST row only",
    what: "Name of the module. Type it on the first row of the module, then leave blank on that module's next rows.",
    allowed: "Text, max 200 characters. Must be a NEW module name.",
  },
  {
    key: "moduleInfo", header: "Module Info", width: 36, wrap: true,
    required: "No",
    what: "Short overview of the module shown to trainees. Fill once, on the module's first row.",
    allowed: "Text.",
  },
  {
    key: "progressionMode", header: "Progression Mode", width: 22,
    required: "No (default: fully_sequential)",
    what: "How steps unlock. Fill once, on the module's first row.",
    allowed: "Pick from the dropdown: fully_sequential = one step at a time across the whole module; steps_in_order = in order within each task; free_order = any order.",
  },
  {
    key: "labTitle", header: "Lab Title *", width: 28,
    required: "Yes — on the lab's FIRST row only",
    what: "Name of the lab. Type it on the first row of the lab, then leave blank on that lab's next rows.",
    allowed: "Text, max 200 characters. Unique within the module.",
  },
  {
    key: "labDescription", header: "Lab Description *", width: 40, wrap: true,
    required: "Yes — once per lab",
    what: "What the lab covers. Fill once, on the lab's first row.",
    allowed: "Text.",
  },
  {
    key: "labScenario", header: "Lab Scenario", width: 40, wrap: true,
    required: "No",
    what: "A real-world situation the trainee works through in this lab. Fill once, on the lab's first row.",
    allowed: "Text.",
  },
  {
    key: "taskTitle", header: "Task Title", width: 28,
    required: "Yes, if the row has a step — on the task's FIRST row only",
    what: "Name of the task. Type it on the first row of the task, then leave blank on that task's next rows.",
    allowed: "Text, max 200 characters. Unique within the lab.",
  },
  {
    key: "taskDescription", header: "Task Description", width: 36, wrap: true,
    required: "No",
    what: "What the task is about. Fill once, on the task's first row.",
    allowed: "Text.",
  },
  {
    key: "stepTitle", header: "Step Title", width: 30,
    required: "Yes — every row is one step",
    what: "Name of the step. Every row = one step, in the order trainees do them.",
    allowed: "Text, max 200 characters. Unique within the task.",
  },
  {
    key: "stepInstructions", header: "Step Instructions", width: 44, wrap: true,
    required: "No",
    what: "How to do this step.",
    allowed: "Text.",
  },
  {
    key: "requiresPhoto", header: "Requires Photo", width: 18,
    required: "No (default: No)",
    what: "Must the trainee upload a photo/screenshot to complete this step?",
    allowed: "Pick from the dropdown: Yes or No. Blank = No.",
  },
];

/** Text in the first cell of the template's guide row; rows starting with
 *  it are skipped on import (in case the trainer forgets to delete it). */
const GUIDE_MARKER = "DELETE THIS ROW";

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
// ITBD brand palette (ARGB) — Excel renders on white, so: blue headers with
// white text, black banner, light-gray guide row with black text.
const C_BLUE = "FF00ADDA";
const C_WHITE = "FFFFFFFF";
const C_BLACK = "FF000000";
const C_LIGHT_GRAY = "FFBFBFBF";
const C_NEUTRAL_GRAY = "FF252525";

const HEADER_ROW = 2; // row 1 = banner
const GUIDE_ROW = 3;
const VALIDATION_LAST_ROW = 1000;

const EXAMPLE_ROWS: { values: Partial<RowValues>; explain: string }[] = [
  {
    values: {
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
    explain: "NEW module + NEW lab + NEW task + its 1st step. Module/lab/task details are filled here, on their first row.",
  },
  {
    values: {
      stepTitle: "Promote to domain controller",
      stepInstructions: "Create a new forest named lab.local.",
      requiresPhoto: "Yes",
    },
    explain: "Titles blank = same module, lab and task as above → 2nd step of \"Install AD DS\".",
  },
  {
    values: { taskTitle: "Manage users", stepTitle: "Create an OU structure", requiresPhoto: "No" },
    explain: "Same module and lab → NEW task \"Manage users\" + its 1st step.",
  },
  {
    values: { stepTitle: "Create 5 test users", requiresPhoto: "Yes" },
    explain: "Same module, lab and task → 2nd step of \"Manage users\".",
  },
  {
    values: {
      labTitle: "DNS and DHCP",
      labDescription: "Configure name resolution and address leasing.",
      taskTitle: "Configure DHCP scope",
      stepTitle: "Create a scope for 10.0.0.0/24",
      requiresPhoto: "Yes",
    },
    explain: "Same module → NEW lab \"DNS and DHCP\" (with its description) + NEW task + 1st step.",
  },
  {
    values: {
      moduleTitle: "Networking Basics",
      progressionMode: "free_order",
      labTitle: "Cabling",
      labDescription: "Terminate and test Ethernet cables.",
      taskTitle: "Crimp a patch cable",
      stepTitle: "Crimp both ends to T568B",
      requiresPhoto: "Yes",
    },
    explain: "A SECOND module starts — module, lab and task titles must all be typed again.",
  },
];

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: C_LIGHT_GRAY } },
  bottom: { style: "thin", color: { argb: C_LIGHT_GRAY } },
  left: { style: "thin", color: { argb: C_LIGHT_GRAY } },
  right: { style: "thin", color: { argb: C_LIGHT_GRAY } },
};

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: C_WHITE } };
  cell.fill = solid(C_BLUE);
  cell.alignment = { vertical: "middle", wrapText: true };
  cell.border = thinBorder;
}

/** Banner (row 1) + blue column headers (row 2), frozen. */
function setupSheet(ws: ExcelJS.Worksheet, banner: string, extraColumns: { header: string; width: number }[] = []) {
  const all = [...COLUMNS.map((c) => ({ header: c.header, width: c.width })), ...extraColumns];
  all.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });

  ws.mergeCells(1, 1, 1, all.length);
  const b = ws.getCell(1, 1);
  b.value = banner;
  b.font = { bold: true, color: { argb: C_WHITE }, size: 11 };
  b.fill = solid(C_BLACK);
  b.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  ws.getRow(1).height = 48;

  const header = ws.getRow(HEADER_ROW);
  all.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    styleHeaderCell(cell);
    const col = COLUMNS[i];
    if (col) cell.note = `${col.what}\n\n${col.allowed}`;
  });
  header.height = 24;
  ws.views = [{ state: "frozen", ySplit: HEADER_ROW }];
  COLUMNS.forEach((c, i) => {
    if (c.wrap) ws.getColumn(i + 1).alignment = { wrapText: true, vertical: "top" };
  });
}

/** Grey guide row describing every column; skipped by the parser. */
function addGuideRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(GUIDE_ROW);
  COLUMNS.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    const body = `${c.what}\n\nAllowed: ${c.allowed}`;
    cell.value = i === 0 ? `${GUIDE_MARKER} before uploading (guide only)\n\n${body}` : body;
    cell.font = { italic: true, size: 9, color: { argb: C_BLACK }, bold: false };
    cell.fill = solid(C_LIGHT_GRAY);
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.border = thinBorder;
  });
  // Make the first cell's marker stand out.
  row.getCell(1).font = { bold: true, size: 9, color: { argb: C_BLACK } };
  row.height = 170;
}

/** Dropdowns + click-to-show hints for every input cell. */
function addValidations(ws: ExcelJS.Worksheet, firstRow: number, lastRow: number) {
  const prompt = (c: Column) => `${c.what} ${c.allowed}`.slice(0, 250);
  const promptTitle = (c: Column) => c.header.replace(" *", "").slice(0, 32);

  COLUMNS.forEach((c, i) => {
    let v: ExcelJS.DataValidation;
    if (c.key === "progressionMode") {
      v = {
        type: "list",
        allowBlank: true,
        formulae: [`"${PROGRESSION_MODES.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Progression mode",
        error: `Pick one of: ${PROGRESSION_MODES.join(", ")}`,
      };
    } else if (c.key === "requiresPhoto") {
      v = {
        type: "list",
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showErrorMessage: true,
        errorTitle: "Requires photo",
        error: "Pick Yes or No (or leave blank for No).",
      };
    } else {
      const max = c.key.endsWith("Title") ? TITLE_MAX : TEXT_MAX;
      v = {
        type: "textLength",
        operator: "lessThanOrEqual",
        allowBlank: true,
        formulae: [max],
        showErrorMessage: true,
        errorTitle: "Too long",
        error: `Maximum ${max.toLocaleString()} characters.`,
      };
    }
    v.showInputMessage = true;
    v.promptTitle = promptTitle(c);
    v.prompt = prompt(c);
    for (let r = firstRow; r <= lastRow; r++) ws.getCell(r, i + 1).dataValidation = v;
  });
}

/** Writes `rows` as a bordered table starting at `startRow`; returns next free row. */
function writeTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  header: string[],
  rows: string[][],
  opts: { merges?: [number, number][]; height?: number } = {},
) {
  // merges: [fromCol, toCol] (1-based) per logical column.
  const spans = opts.merges ?? header.map((_, i) => [i + 1, i + 1] as [number, number]);
  const put = (r: number, values: string[], isHeader: boolean) => {
    values.forEach((text, i) => {
      const [from, to] = spans[i];
      if (to > from) ws.mergeCells(r, from, r, to);
      const cell = ws.getCell(r, from);
      cell.value = text;
      if (isHeader) styleHeaderCell(cell);
      else {
        const blank = text === "(blank)";
        cell.font = blank ? { italic: true, color: { argb: C_LIGHT_GRAY } } : { color: { argb: C_NEUTRAL_GRAY } };
        cell.alignment = { wrapText: true, vertical: "top" };
        cell.border = thinBorder;
      }
      for (let c = from + 1; c <= to; c++) ws.getCell(r, c).border = thinBorder;
    });
    if (!isHeader && opts.height) ws.getRow(r).height = opts.height;
  };
  put(startRow, header, true);
  rows.forEach((row, i) => put(startRow + 1 + i, row, false));
  return startRow + rows.length + 2;
}

function buildInstructions(ws: ExcelJS.Worksheet) {
  [24, 26, 26, 26, 26, 50].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  let r = 1;
  const line = (text: string, font: Partial<ExcelJS.Font> = {}, height?: number) => {
    ws.mergeCells(r, 1, r, 6);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = { color: { argb: C_NEUTRAL_GRAY }, ...font };
    cell.alignment = { wrapText: true, vertical: "top" };
    if (height) ws.getRow(r).height = height;
    r++;
  };
  const heading = (text: string) => {
    r++;
    line(text, { bold: true, size: 13, color: { argb: C_BLUE } });
  };

  line("Guided Labs — bulk module import", { bold: true, size: 18, color: { argb: C_BLUE } }, 28);
  line("Create several modules (with their labs, tasks and steps) in one upload. Read this page once — it takes 2 minutes.", { italic: true });

  heading("Quick start");
  line(`1. Open the "${TEMPLATE_SHEET}" sheet. Delete the grey guide row (row ${GUIDE_ROW}) — if you forget, it is skipped anyway.`);
  line("2. Fill in ONE ROW PER STEP, top to bottom, in the order trainees should do them.");
  line("3. Type a Module / Lab / Task title only on its FIRST row. On the rows below, leave it BLANK — blank means \"same as the row above\".");
  line("4. Put descriptions (Module Info, Lab Description, Lab Scenario, Task Description) on the same row where you typed that title.");
  line("5. Save as .xlsx and upload it in Trainer Workspace → Bulk import. You see a preview — or the problems, by row number — before anything is created.");

  heading("How rows build a module  (one row = one step)");
  r = writeTable(
    ws,
    r,
    ["Row", "Module Title", "Lab Title", "Task Title", "Step Title", "What this row creates"],
    [
      ["1", "Windows Server Fundamentals", "Active Directory setup", "Install AD DS", "Add the AD DS role", "New module + new lab + new task + 1st step"],
      ["2", "(blank)", "(blank)", "(blank)", "Promote to domain controller", "2nd step of \"Install AD DS\" (everything above carries down)"],
      ["3", "(blank)", "(blank)", "Manage users", "Create an OU structure", "New task in the same lab + its 1st step"],
      ["4", "(blank)", "(blank)", "(blank)", "Create 5 test users", "2nd step of \"Manage users\""],
      ["5", "(blank)", "DNS and DHCP", "Configure DHCP scope", "Create a scope", "New lab in the same module + new task + 1st step"],
      ["6", "Networking Basics", "Cabling", "Crimp a patch cable", "Crimp both ends", "A second module — every title typed again"],
    ],
    { height: 32 },
  );
  line("Result:  Windows Server Fundamentals → 2 labs → 3 tasks → 5 steps.   Networking Basics → 1 lab → 1 task → 1 step.", { bold: true });
  line("So a module with 20 steps takes 20 rows — but you type the module name once, each lab name once and each task name once.");
  line(`The "Example" sheet has these rows fully filled in (descriptions included) — it is NOT imported.`, { italic: true });

  heading("Columns and allowed values");
  r = writeTable(
    ws,
    r,
    ["Column", "Required?", "What to enter", "Allowed values"],
    COLUMNS.map((c) => [c.header.replace(" *", ""), c.required, c.what, c.allowed]),
    { merges: [[1, 1], [2, 2], [3, 4], [5, 6]], height: 58 },
  );

  heading("Rules (the upload checks these)");
  line("• Every lab needs a Lab Description.");
  line("• Module names must be NEW. To change an existing module, open it in the builder in the app.");
  line("• A blank title only carries down within the same parent: after a new Module Title, type the Lab and Task titles again.");
  line("• The same step name can't appear twice in one task; the same lab name can't appear twice in one module.");
  line("• Requires Photo: Yes or No (blank = No). Progression Mode: fully_sequential, steps_in_order or free_order (blank = fully_sequential).");
  line("• If anything is wrong, NOTHING is imported — fix the listed rows and upload again.");
  line(`• Only the "${TEMPLATE_SHEET}" sheet is imported. This sheet and "Example" are ignored.`);
}

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Labs ITBD";
  wb.created = new Date();

  buildInstructions(wb.addWorksheet("Instructions", { properties: { tabColor: { argb: C_BLUE } } }));

  // Curriculum — the only sheet that is imported.
  const sheet = wb.addWorksheet(TEMPLATE_SHEET);
  setupSheet(
    sheet,
    `ONE ROW = ONE STEP.  Type a Module / Lab / Task title only on its FIRST row — leave it blank on the rows below and those rows stay in the same module / lab / task.  ` +
      `Delete the grey guide row (row ${GUIDE_ROW}) before uploading.  Help: "Instructions" sheet · filled sample: "Example" sheet.`,
  );
  addGuideRow(sheet);
  addValidations(sheet, GUIDE_ROW + 1, VALIDATION_LAST_ROW);

  // Example — NOT imported; extra column explains each row.
  const example = wb.addWorksheet("Example");
  setupSheet(
    example,
    `EXAMPLE ONLY — this sheet is NOT imported.  Read the last column ("What this row creates") to see how blank titles carry down from the row above.`,
    [{ header: "What this row creates", width: 50 }],
  );
  EXAMPLE_ROWS.forEach((ex, i) => {
    const r = HEADER_ROW + 1 + i;
    COLUMNS.forEach((c, ci) => {
      const cell = example.getCell(r, ci + 1);
      cell.value = ex.values[c.key] ?? null;
      cell.border = thinBorder;
    });
    const explain = example.getCell(r, COLUMNS.length + 1);
    explain.value = ex.explain;
    explain.font = { italic: true, color: { argb: C_NEUTRAL_GRAY } };
    explain.fill = solid(C_LIGHT_GRAY);
    explain.alignment = { wrapText: true, vertical: "top" };
    explain.border = thinBorder;
    example.getRow(r).height = 48;
  });

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
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

  // Find the header row (row 2 under the banner; row 1 in older templates)
  // and map columns by header text so reordered/extra columns still work.
  const colOf = new Map<ColumnKey, number>();
  let headerRow = 0;
  for (let r = 1; r <= Math.min(5, ws.rowCount) && !headerRow; r++) {
    const found = new Map<ColumnKey, number>();
    ws.getRow(r).eachCell((cell, col) => {
      const h = normHeader(cellText(cell.value));
      const match = COLUMNS.find((c) => normHeader(c.header) === h);
      if (match && !found.has(match.key)) found.set(match.key, col);
    });
    if (found.has("moduleTitle")) {
      headerRow = r;
      found.forEach((col, key) => colOf.set(key, col));
    }
  }
  if (!headerRow) {
    fail(null, "Couldn't find the column headers (Module Title, Lab Title, …) — download a fresh template.");
    return empty;
  }
  for (const req of ["labTitle", "labDescription"] as const) {
    if (!colOf.has(req)) {
      fail(headerRow, `Missing column "${COLUMNS.find((c) => c.key === req)!.header}" — download a fresh template.`);
    }
  }
  if (errors.length) return empty;

  if (ws.rowCount - headerRow > MAX_ROWS) {
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

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const v = Object.fromEntries(
      COLUMNS.map((c) => [c.key, colOf.has(c.key) ? cellText(row.getCell(colOf.get(c.key)!).value) : ""]),
    ) as RowValues;
    // The template's grey guide row — skip it if the trainer left it in.
    if (v.moduleTitle.toUpperCase().startsWith(GUIDE_MARKER)) continue;
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
