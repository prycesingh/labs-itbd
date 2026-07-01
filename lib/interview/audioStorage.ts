/**
 * Interview Audio Storage Service
 *
 * Abstraction layer for audio file storage:
 * - Filesystem implementation (current)
 * - S3-compatible stub (future)
 * - Signed URL generation
 * - Retention policy management
 */

import {
  buildDownloadUrl,
  deleteManagedUpload,
  extractId,
  openReadStream,
  resolveAbsolutePath,
  saveBufferAsUpload,
} from "@/lib/uploads";
import { randomUUID } from "crypto";
import {
  createReadStream,
  existsSync,
  promises as fs,
  mkdirSync,
  ReadStream,
} from "fs";
import path from "path";
import { AudioUploadError, InterviewError } from "./errors";
import { INTERVIEW_CONFIG, INTERVIEW_ERROR_CODES } from "./jobConstants";

// ─────────────────────────────────────────────
// STORAGE INTERFACE
// ─────────────────────────────────────────────

export interface AudioStorageResult {
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
}

export interface AudioStorageProvider {
  uploadAudio(
    buffer: Buffer,
    sessionId: string,
    questionIndex: number,
    mimeType: string,
    durationMs: number,
  ): Promise<AudioStorageResult>;

  getAudio(storagePath: string): Promise<Buffer>;

  getReadableStream(storagePath: string): Promise<ReadStream>;

  deleteAudio(storagePath: string): Promise<void>;

  exists(storagePath: string): Promise<boolean>;

  getSignedUrl(storagePath: string, expirationHours: number): Promise<string>;
}

// ─────────────────────────────────────────────
// FILESYSTEM IMPLEMENTATION
// ─────────────────────────────────────────────

export class FilesystemAudioStorage implements AudioStorageProvider {
  private uploadRoot: string;

  constructor(uploadRoot?: string) {
    this.uploadRoot = uploadRoot || INTERVIEW_CONFIG.AUDIO_STORAGE_ROOT;

    // Best-effort: create the legacy storage directory if it doesn't exist.
    // Silently skip if the path is not writable (e.g. absolute system path like
    // /uploads/interview-audio when INTERVIEW_AUDIO_ROOT is not set in production).
    // New uploads go through saveBufferAsUpload → getStorageRoot() / UPLOADS_ROOT
    // and handle their own directory creation, so this mkdir is only needed for
    // serving legacy audio files that were stored at this path in older deployments.
    if (!existsSync(this.uploadRoot)) {
      try {
        mkdirSync(this.uploadRoot, { recursive: true });
      } catch {
        // Not writable — ignore. Legacy reads will fail gracefully per-request.
      }
    }
  }

  /**
   * Upload audio file to filesystem
   * Path: {uploadRoot}/{sessionId}/{questionIndex}-{timestamp}-{uuid}.wav
   */
  async uploadAudio(
    buffer: Buffer,
    sessionId: string,
    questionIndex: number,
    mimeType: string,
    durationMs: number,
  ): Promise<AudioStorageResult> {
    try {
      // Validate inputs
      if (!buffer || buffer.length === 0) {
        throw new AudioUploadError(
          "Audio buffer is empty",
          INTERVIEW_ERROR_CODES.AUDIO_INVALID_FORMAT,
        );
      }

      // Generate file name: {questionIndex}-{timestamp}-{uuid}.{ext}
      const ext = this.getExtensionFromMimeType(mimeType);
      const fileName = `${questionIndex}-${Date.now()}-${randomUUID()}.${ext}`;

      const saved = await saveBufferAsUpload(
        buffer,
        `interview/answers/${sessionId}`,
        fileName,
        mimeType,
      );

      return {
        storagePath: buildDownloadUrl(saved.id),
        mimeType,
        sizeBytes: saved.size,
        durationMs,
      };
    } catch (error) {
      if (error instanceof AudioUploadError) throw error;

      throw new AudioUploadError(
        `Failed to upload audio: ${error instanceof Error ? error.message : "Unknown error"}`,
        INTERVIEW_ERROR_CODES.AUDIO_UPLOAD_TIMEOUT,
        true,
      );
    }
  }

  /**
   * Retrieve audio file from filesystem
   */
  async getAudio(storagePath: string): Promise<Buffer> {
    try {
      // Legacy fallback: /uploads/interview-audio/{sessionId}/{filename}
      if (storagePath.startsWith("/uploads/interview-audio/")) {
        const relativePath = this.extractRelativePath(storagePath);
        const filePath = path.join(this.uploadRoot, relativePath);

        const resolvedPath = path.resolve(filePath);
        const resolvedRoot = path.resolve(this.uploadRoot);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          throw new InterviewError(
            "invalid_path",
            false,
            "Invalid storage path",
          );
        }

        return await fs.readFile(filePath);
      }

      const managedId = extractId(storagePath);
      if (!managedId) {
        throw new InterviewError("invalid_path", false, "Invalid storage path");
      }

      const absolutePath = resolveAbsolutePath(managedId);
      return await fs.readFile(absolutePath);
    } catch (error) {
      if (error instanceof InterviewError) throw error;

      throw new InterviewError(
        "read_error",
        false,
        `Failed to read audio file: ${error instanceof Error ? error.message : "Unknown error"}`,
        { storagePath },
      );
    }
  }

  /**
   * Get readable stream for audio file
   * Used for streaming to OpenAI
   */
  async getReadableStream(storagePath: string): Promise<ReadStream> {
    try {
      if (storagePath.startsWith("/uploads/interview-audio/")) {
        const relativePath = this.extractRelativePath(storagePath);
        const filePath = path.join(this.uploadRoot, relativePath);

        const resolvedPath = path.resolve(filePath);
        const resolvedRoot = path.resolve(this.uploadRoot);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          throw new InterviewError(
            "invalid_path",
            false,
            "Invalid storage path",
          );
        }

        if (!existsSync(filePath)) {
          throw new InterviewError(
            "not_found",
            false,
            `Audio file not found: ${storagePath}`,
          );
        }

        return createReadStream(filePath);
      }

      const managedId = extractId(storagePath);
      if (!managedId) {
        throw new InterviewError("invalid_path", false, "Invalid storage path");
      }

      const { stream } = await openReadStream(managedId);
      return stream;
    } catch (error) {
      if (error instanceof InterviewError) throw error;

      throw new InterviewError(
        "stream_error",
        false,
        `Failed to create stream: ${error instanceof Error ? error.message : "Unknown error"}`,
        { storagePath },
      );
    }
  }

  /**
   * Delete audio file from filesystem
   */
  async deleteAudio(storagePath: string): Promise<void> {
    try {
      if (storagePath.startsWith("/uploads/interview-audio/")) {
        const relativePath = this.extractRelativePath(storagePath);
        const filePath = path.join(this.uploadRoot, relativePath);

        const resolvedPath = path.resolve(filePath);
        const resolvedRoot = path.resolve(this.uploadRoot);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          throw new InterviewError(
            "invalid_path",
            false,
            "Invalid storage path",
          );
        }

        if (existsSync(filePath)) {
          await fs.unlink(filePath);
        }

        return;
      }

      await deleteManagedUpload(storagePath);
    } catch (error) {
      if (error instanceof InterviewError) throw error;
      console.error(`Failed to delete audio file: ${storagePath}`, error);
      // Don't throw on delete failure to prevent cascading errors
    }
  }

  /**
   * Check if audio file exists
   */
  async exists(storagePath: string): Promise<boolean> {
    try {
      if (storagePath.startsWith("/uploads/interview-audio/")) {
        const relativePath = this.extractRelativePath(storagePath);
        const filePath = path.join(this.uploadRoot, relativePath);

        const resolvedPath = path.resolve(filePath);
        const resolvedRoot = path.resolve(this.uploadRoot);
        if (!resolvedPath.startsWith(resolvedRoot)) {
          return false;
        }

        return existsSync(filePath);
      }

      const managedId = extractId(storagePath);
      if (!managedId) {
        return false;
      }

      const absolutePath = resolveAbsolutePath(managedId);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate signed URL for file access
   * Currently returns unencrypted path (future: add JWT signing)
   */
  async getSignedUrl(
    storagePath: string,
    _expirationHours: number = 1,
  ): Promise<string> {
    void _expirationHours;

    if (storagePath.startsWith("/uploads/interview-audio/")) {
      return storagePath;
    }

    const id = extractId(storagePath);
    if (id) {
      return buildDownloadUrl(id);
    }

    // Legacy fallback
    return storagePath;
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  /**
   * Extract relative path from storage path
   * Input: /uploads/interview-audio/{sessionId}/{filename}
   * Output: {sessionId}/{filename}
   */
  private extractRelativePath(storagePath: string): string {
    const prefix = "/uploads/interview-audio/";
    if (storagePath.startsWith(prefix)) {
      return storagePath.substring(prefix.length);
    }
    return storagePath;
  }

  /**
   * Get file extension from mime type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "audio/wav": "wav",
      "audio/mp3": "mp3",
      "audio/mpeg": "mp3",
      "audio/webm": "webm",
      "audio/m4a": "m4a",
      "audio/x-m4a": "m4a",
      "audio/ogg": "ogg",
      "audio/mp4": "mp4",
      "audio/aac": "aac",
      "audio/x-aac": "aac",
      "audio/flac": "flac",
    };

    return mimeToExt[mimeType] || "wav";
  }
}

// ─────────────────────────────────────────────
// S3 STORAGE STUB (Future Implementation)
// ─────────────────────────────────────────────

export class S3AudioStorage implements AudioStorageProvider {
  private bucketName: string;
  private s3Client: unknown; // AWS S3 client

  constructor(bucketName?: string) {
    this.bucketName =
      bucketName || process.env.INTERVIEW_S3_BUCKET || "interview-audio";
    // TODO: Initialize AWS S3 client
  }

  async uploadAudio(
    _buffer: Buffer,
    _sessionId: string,
    _questionIndex: number,
    _mimeType: string,
    _durationMs: number,
  ): Promise<AudioStorageResult> {
    void _buffer;
    void _sessionId;
    void _questionIndex;
    void _mimeType;
    void _durationMs;

    throw new Error("S3 storage not yet implemented");
  }

  async getAudio(_storagePath: string): Promise<Buffer> {
    void _storagePath;
    throw new Error("S3 storage not yet implemented");
  }

  async getReadableStream(_storagePath: string): Promise<ReadStream> {
    void _storagePath;
    throw new Error("S3 storage not yet implemented");
  }

  async deleteAudio(_storagePath: string): Promise<void> {
    void _storagePath;
    throw new Error("S3 storage not yet implemented");
  }

  async exists(_storagePath: string): Promise<boolean> {
    void _storagePath;
    throw new Error("S3 storage not yet implemented");
  }

  async getSignedUrl(
    _storagePath: string,
    _expirationHours?: number,
  ): Promise<string> {
    void _storagePath;
    void _expirationHours;

    throw new Error("S3 storage not yet implemented");
  }
}

// ─────────────────────────────────────────────
// SINGLETON PROVIDER
// ─────────────────────────────────────────────

let storageProvider: AudioStorageProvider | null = null;

/**
 * Get or initialize audio storage provider
 * Uses filesystem by default, S3 if configured
 */
export function getAudioStorageProvider(): AudioStorageProvider {
  if (storageProvider) {
    return storageProvider;
  }

  const storageType = process.env.INTERVIEW_AUDIO_STORAGE || "filesystem";

  if (storageType === "s3") {
    storageProvider = new S3AudioStorage();
  } else {
    storageProvider = new FilesystemAudioStorage();
  }

  return storageProvider;
}

/**
 * Reset provider (mainly for testing)
 */
export function resetStorageProvider(): void {
  storageProvider = null;
}

// ─────────────────────────────────────────────
// RETENTION POLICY
// ─────────────────────────────────────────────

/**
 * Cleanup old audio files based on retention policy
 * Called by background job handler
 */
export async function cleanupOldAudioFiles(
  retentionDays: number = INTERVIEW_CONFIG.AUDIO_RETENTION_DAYS,
): Promise<{
  deletedCount: number;
  freedSpaceBytes: number;
}> {
  try {
    const provider = getAudioStorageProvider();

    if (!(provider instanceof FilesystemAudioStorage)) {
      return { deletedCount: 0, freedSpaceBytes: 0 };
    }

    const uploadRoot = INTERVIEW_CONFIG.AUDIO_STORAGE_ROOT;
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    let freedSpaceBytes = 0;

    // Scan all session directories
    const sessionDirs = await fs.readdir(uploadRoot);

    for (const sessionDir of sessionDirs) {
      const sessionPath = path.join(uploadRoot, sessionDir);
      const stats = await fs.stat(sessionPath);

      if (!stats.isDirectory()) {
        continue;
      }

      // Check if directory is old enough to delete
      if (now - stats.mtimeMs > retentionMs) {
        const files = await fs.readdir(sessionPath);

        for (const file of files) {
          const filePath = path.join(sessionPath, file);
          const fileStats = await fs.stat(filePath);
          freedSpaceBytes += fileStats.size;

          await fs.unlink(filePath);
          deletedCount++;
        }

        // Try to remove empty directory
        try {
          await fs.rmdir(sessionPath);
        } catch {
          // Directory may not be empty, ignore
        }
      }
    }

    return { deletedCount, freedSpaceBytes };
  } catch (error) {
    console.error("Cleanup error:", error);
    return { deletedCount: 0, freedSpaceBytes: 0 };
  }
}
