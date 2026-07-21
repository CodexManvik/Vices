/**
 * modelManager.ts
 *
 * Manages local GGUF model files: directory scanning and streamed downloads.
 * All filesystem operations use @tauri-apps/plugin-fs scoped to
 * $APPLOCALDATA/models (i.e. AppData\Roaming\<app>\models on Windows).
 *
 * Non-Tauri environments (browser dev mode) are handled gracefully:
 * scanForModels() returns [] and downloadAllModels() throws immediately.
 */

const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;

// ─── Model registry ──────────────────────────────────────────────────────────

export const NSFW_MODEL_FILES = [
  {
    id: "main" as const,
    label: "Gemma-4 Uncensored Model",
    filename: "Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf",
    url: "https://huggingface.co/HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive/resolve/main/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf",
    approximateSizeBytes: 2_900_000_000,
  },
  {
    id: "vision" as const,
    label: "Vision Projector (Uncensored)",
    filename: "mmproj-Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-f16.gguf",
    url: "https://huggingface.co/HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive/resolve/main/mmproj-Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-f16.gguf",
    approximateSizeBytes: 820_000_000,
  },
] as const;

export const SAFE_MODEL_FILES = [
  {
    id: "main" as const,
    label: "Gemma-4 Standard Model",
    filename: "gemma-4-E4B-it-Q4_K_M.gguf",
    url: "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
    approximateSizeBytes: 4_980_000_000,
  },
  {
    id: "vision" as const,
    label: "Vision Projector (Standard)",
    filename: "mmproj-F16.gguf",
    url: "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/mmproj-F16.gguf",
    approximateSizeBytes: 600_000_000,
  },
] as const;

// Keep alias to avoid breaking static type definitions elsewhere
export const MODEL_FILES = NSFW_MODEL_FILES;

// ─── Path resolution ─────────────────────────────────────────────────────────

async function getModelsDir(): Promise<string> {
  const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
  const base = await appLocalDataDir();
  return join(base, "models");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns filenames of any .gguf files already present in the models directory.
 * Returns [] when not running inside Tauri or when the directory doesn't exist.
 */
export async function scanForModels(): Promise<string[]> {
  if (!IS_TAURI) return [];

  try {
    const { exists, readDir } = await import("@tauri-apps/plugin-fs");
    const dir = await getModelsDir();

    if (!(await exists(dir))) return [];

    const entries = await readDir(dir);
    return entries
      .filter((e: { isDirectory: boolean; name?: string }) => !e.isDirectory && (e.name ?? "").endsWith(".gguf"))
      .map((e: { name?: string }) => e.name!);
  } catch (err) {
    console.warn("[ModelManager] scanForModels error:", err);
    return [];
  }
}

/**
 * Structural check indicating presence of NSFW or Safe models
 */
export async function checkModelsExist(): Promise<{ nsfwFound: boolean; safeFound: boolean; anyFound: boolean }> {
  const files = await scanForModels();
  const nsfwFound = files.includes(NSFW_MODEL_FILES[0].filename) && files.includes(NSFW_MODEL_FILES[1].filename);
  const safeFound = files.includes(SAFE_MODEL_FILES[0].filename) && files.includes(SAFE_MODEL_FILES[1].filename);
  return { nsfwFound, safeFound, anyFound: nsfwFound || safeFound };
}

export interface DownloadProgress {
  /** Index into modelsToDownload: 0 = main, 1 = vision */
  fileIndex: number;
  downloaded: number;
  total: number;
  /** Bytes per second, rolling average over last 0.5 s */
  speedBps: number;
  done: boolean;
}

/**
 * Streams selected model files to disk sequentially (main then vision).
 * Yields DownloadProgress after every 0.5 s chunk batch.
 * Abortable via AbortSignal — partial files are cleaned up on cancellation.
 */
export async function* downloadAllModels(
  nsfw: boolean,
  signal: AbortSignal
): AsyncGenerator<DownloadProgress> {
  if (!IS_TAURI) {
    throw new Error(
      "downloadAllModels requires a Tauri runtime. Running in browser mode."
    );
  }

  const { exists, mkdir, create, remove } = await import(
    "@tauri-apps/plugin-fs"
  );
  const { join } = await import("@tauri-apps/api/path");
  const modelsDir = await getModelsDir();

  // Ensure models directory exists
  if (!(await exists(modelsDir))) {
    await mkdir(modelsDir, { recursive: true });
  }

  const modelsToDownload = nsfw ? NSFW_MODEL_FILES : SAFE_MODEL_FILES;

  for (let i = 0; i < modelsToDownload.length; i++) {
    const model = modelsToDownload[i];
    const filePath = await join(modelsDir, model.filename);

    let fileHandle: Awaited<ReturnType<typeof create>> | null = null;

    try {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

      const response = await fetch(model.url, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${model.filename}`);
      }
      if (!response.body) {
        throw new Error("Response body is null");
      }

      const total =
        parseInt(response.headers.get("content-length") ?? "0") ||
        model.approximateSizeBytes;

      fileHandle = await create(filePath);

      const reader = response.body.getReader();
      let downloaded = 0;
      let lastYieldMs = Date.now();
      let lastYieldBytes = 0;
      let speedBps = 0;

      while (true) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

        const { done, value } = await reader.read();

        if (done) break;

        await fileHandle.write(value);
        downloaded += value.byteLength;

        const nowMs = Date.now();
        const elapsedS = (nowMs - lastYieldMs) / 1000;

        if (elapsedS >= 0.5) {
          speedBps = (downloaded - lastYieldBytes) / elapsedS;
          lastYieldMs = nowMs;
          lastYieldBytes = downloaded;
          yield { fileIndex: i, downloaded, total, speedBps, done: false };
        }
      }

      // Final yield for this file
      yield { fileIndex: i, downloaded: total, total, speedBps, done: true };

      await fileHandle.close();
      fileHandle = null;
    } catch (err) {
      // Ensure file handle is closed before cleanup attempt
      if (fileHandle) {
        try {
          await fileHandle.close();
        } catch {}
        fileHandle = null;
      }

      // Remove partial file so a retry starts clean
      try {
        await remove(filePath);
      } catch {}

      throw err;
    }
  }
}

// ─── Formatting helpers (used in UI) ─────────────────────────────────────────

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return "—";
  const seconds = remainingBytes / speedBps;
  if (seconds < 5) return "finishing...";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `~${mins} min`;
  return `~${(seconds / 3600).toFixed(1)} hr`;
}
