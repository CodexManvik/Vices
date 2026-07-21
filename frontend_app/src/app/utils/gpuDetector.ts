/**
 * gpuDetector.ts
 *
 * Hardware detection utility for determining whether the user has a GPU
 * capable of running a 4B GGUF model locally (~4 GB VRAM minimum).
 *
 * Detection cascade:
 *   1. WebGPU `requestAdapter` — best signal, gives limits including maxBufferSize
 *   2. WebGL WEBGL_debug_renderer_info — renderer string matching
 *   3. No-signal fallback → returns hasCapableGpu: false
 */

export interface GpuInfo {
  hasCapableGpu: boolean;
  gpuName: string;
  /** Estimated VRAM in GB from WebGPU limits. 0 if unknown. */
  vramEstimateGb: number;
  detectionMethod: "webgpu" | "webgl" | "none";
}

// Renderer string patterns that reliably indicate a discrete GPU with ≥4 GB VRAM.
// Covers NVIDIA (GTX 10xx+, RTX), AMD (RX 400+, Vega, RDNA), and discrete Quadro/FirePro.
const DISCRETE_GPU_PATTERN =
  /nvidia|geforce|rtx|quadro|tesla|radeon rx|radeon vii|radeon pro|rx \d{3,4}|amd rx|vega|navi|rdna/i;

// Known integrated GPU keywords — used as a negative filter after DISCRETE match.
const INTEGRATED_GPU_PATTERN = /intel hd|intel uhd|intel iris|mesa|llvmpipe|software/i;

export async function detectGpu(): Promise<GpuInfo> {
  // ─── Method 1: WebGPU ───────────────────────────────────────────────────────
  if ("gpu" in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      if (adapter) {
        const info: { description?: string; device?: string; vendor?: string } =
          await adapter.requestAdapterInfo().catch(() => ({}));

        // maxBufferSize is typically bound by VRAM on discrete GPUs.
        // 4 GB cards report ~3.8 GB; 6 GB cards ~5.8 GB; integrated ~0.5 GB.
        const maxBufferGb: number =
          (adapter.limits?.maxBufferSize ?? 0) / 1024 ** 3;

        // Conservative threshold: if the adapter can address >1.5 GB buffers,
        // treat it as a discrete card that likely meets the 4 GB requirement.
        // The actual VRAM is communicated to the user as an informational note,
        // not used as a hard gate (they can always override).
        const hasCapableGpu = maxBufferGb > 1.5;

        const rawName =
          info.description ?? info.device ?? info.vendor ?? "Discrete GPU";
        const gpuName = rawName.split("/")[0].trim();

        return {
          hasCapableGpu,
          gpuName: gpuName || "GPU (WebGPU)",
          vramEstimateGb: parseFloat(maxBufferGb.toFixed(1)),
          detectionMethod: "webgpu",
        };
      }
    } catch {
      // WebGPU unavailable or blocked — fall through to WebGL
    }
  }

  // ─── Method 2: WebGL renderer string ────────────────────────────────────────
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);

    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const renderer = (
          gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
        ).trim();

        const isDiscrete =
          DISCRETE_GPU_PATTERN.test(renderer) &&
          !INTEGRATED_GPU_PATTERN.test(renderer);

        const gpuName = renderer.split("/")[0].split("(")[0].trim();

        return {
          hasCapableGpu: isDiscrete,
          gpuName: gpuName || renderer,
          vramEstimateGb: 0,
          detectionMethod: "webgl",
        };
      }
    }
  } catch {
    // WebGL unavailable
  }

  // ─── No signal ──────────────────────────────────────────────────────────────
  return {
    hasCapableGpu: false,
    gpuName: "Unknown",
    vramEstimateGb: 0,
    detectionMethod: "none",
  };
}
