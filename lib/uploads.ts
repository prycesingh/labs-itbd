import crypto from "crypto";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";

export type SavedUpload = {
  id: string;
  absolutePath: string;
  size: number;
  mimeType: string | undefined;
};

function getStorageRoot(): string {
  if (process.env.UPLOADS_ROOT) {
    return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_ROOT);
  }
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    "..",
    "uploads-storage",
  );
}

async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function sanitizeSegment(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "file"
  );
}

function sanitizeFileName(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "file";

  const ext = path.extname(trimmed).toLowerCase();
  const base = path.basename(trimmed, ext);
  const safeBase = sanitizeSegment(base);
  const safeExt = ext && /^[.a-z0-9]+$/.test(ext) ? ext : "";
  return `${safeBase || "file"}${safeExt}`;
}

function sanitizeCategoryPath(input: string): string[] {
  const rawSegments = (input || "")
    .split(/[/\\]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const safeSegments = rawSegments
    .filter((segment) => segment !== "." && segment !== "..")
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean);

  return safeSegments.length ? safeSegments : [sanitizeSegment(input || "")];
}

export async function saveUpload(
  file: File,
  category: string,
): Promise<SavedUpload> {
  const root = getStorageRoot();
  const safeCategoryPath = sanitizeCategoryPath(category);
  const targetDir = path.join(root, ...safeCategoryPath);
  await ensureDirectory(targetDir);

  const originalExt = path.extname(file.name || "").toLowerCase();
  const baseName = sanitizeSegment(path.basename(file.name || "", originalExt));
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  const safeExt =
    originalExt && /^[.a-z0-9]+$/.test(originalExt) ? originalExt : "";
  const fileName = `${baseName}-${uniqueSuffix}${safeExt}`;
  const relativeId = path.posix.join(...safeCategoryPath, fileName);
  const absolutePath = path.join(root, ...safeCategoryPath, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    id: relativeId,
    absolutePath,
    size: buffer.length,
    mimeType: file.type || undefined,
  };
}

export async function saveUploadAs(
  file: File,
  category: string,
  targetFileName: string,
): Promise<SavedUpload> {
  const root = getStorageRoot();
  const safeCategoryPath = sanitizeCategoryPath(category);
  const targetDir = path.join(root, ...safeCategoryPath);
  await ensureDirectory(targetDir);

  const safeName = sanitizeFileName(targetFileName);
  const relativeId = path.posix.join(...safeCategoryPath, safeName);
  const absolutePath = path.join(root, ...safeCategoryPath, safeName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    id: relativeId,
    absolutePath,
    size: buffer.length,
    mimeType: file.type || undefined,
  };
}

export async function saveBufferAsUpload(
  buffer: Uint8Array,
  category: string,
  targetFileName: string,
  mimeType?: string,
): Promise<SavedUpload> {
  const file = new File([Buffer.from(buffer)], targetFileName, {
    type: mimeType || "application/octet-stream",
  });
  return saveUploadAs(file, category, targetFileName);
}

export async function saveHrUpload(
  file: File,
  subCategory: string,
): Promise<SavedUpload> {
  const category = subCategory ? `hr/${subCategory}` : "hr";
  return saveUpload(file, category);
}

export function buildDownloadUrl(id: string): string {
  const parts = id.split(/[/\\]+/g).map(encodeURIComponent);
  return `/api/uploads/${parts.join("/")}`;
}

export function resolveAbsolutePath(id: string): string {
  const clean = id.replace(/^\.\/+|^\.\\+/g, "");
  const normalizedParts = clean
    .split(/[/\\]+/g)
    .filter((segment) => segment && segment !== ".." && segment !== ".");
  return path.join(getStorageRoot(), ...normalizedParts);
}

export async function deleteManagedUpload(
  value: string | null | undefined,
): Promise<void> {
  const id = extractId(value);
  if (!id) return;
  try {
    await fs.unlink(resolveAbsolutePath(id));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

export function extractId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:/i.test(value) || value.startsWith("data:")) return null;
  if (value.startsWith("/api/uploads/")) {
    const rest = value.replace(/^\/api\/uploads\//, "");
    return decodeURIComponent(rest);
  }
  if (value.startsWith("/uploads/")) {
    const rest = value.replace(/^\/uploads\//, "");
    return rest;
  }
  return value.replace(/^\/+/, "");
}

export async function openReadStream(id: string) {
  const absolutePath = resolveAbsolutePath(id);
  const stats = await fs.stat(absolutePath);
  const stream = createReadStream(absolutePath);
  return { stream, stats, absolutePath } as const;
}

export async function ensureStorageRoot(): Promise<string> {
  const root = getStorageRoot();
  await ensureDirectory(root);
  return root;
}

export function toClientUrl(value: string | null | undefined): string | null {
  const id = extractId(value);
  if (!id) return value ?? null;
  return buildDownloadUrl(id);
}
