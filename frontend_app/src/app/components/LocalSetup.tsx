/**
 * LocalSetup.tsx
 *
 * Full-screen hardware-aware setup flow shown once on first launch.
 * Detects GPU capability, scans for existing models, and presents a
 * choice between downloading the local Gemma-4 model or connecting to
 * the central VICES server.
 *
 * Phase state machine:
 *   detecting → (GPU check + model scan)
 *     ├─ no capable GPU → silently calls onComplete("server")
 *     ├─ GPU + existing models → model-found
 *     └─ GPU + no models     → choose
 *   choose → downloading | onComplete("server")
 *   model-found → onComplete("local") | onComplete("server")
 *   downloading → complete | error (inline)
 *   complete → onComplete("local") [auto after 2 s]
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cpu,
  Wifi,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  HardDrive,
  ArrowRight,
  Shield,
} from "lucide-react";
import { detectGpu, type GpuInfo } from "../utils/gpuDetector";
import {
  scanForModels,
  downloadAllModels,
  NSFW_MODEL_FILES,
  SAFE_MODEL_FILES,
  checkModelsExist,
  formatBytes,
  formatEta,
  type DownloadProgress,
} from "../utils/modelManager";
import { useAgeGate, AgeGateModal } from "./AgeGateModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = "detecting" | "choose" | "model-found" | "downloading" | "complete";

interface FileProgress {
  downloaded: number;
  total: number;
  speedBps: number;
  done: boolean;
}

export interface LocalSetupProps {
  isDark: boolean;
  onComplete: (mode: "local" | "server") => void;
}

// ─── Design tokens (match existing app palette exactly) ──────────────────────

const T = {
  bg: (dark: boolean) => (dark ? "#060606" : "#FAFAF9"),
  card: (dark: boolean) => (dark ? "#0E0E0E" : "#FFFFFF"),
  cardBorder: (dark: boolean) =>
    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
  text: (dark: boolean) => (dark ? "#E2E8F0" : "#1C1917"),
  muted: (dark: boolean) => (dark ? "#71717A" : "#8E8781"),
  dim: (dark: boolean) => (dark ? "#52525B" : "#A8A29E"),
  separator: (dark: boolean) =>
    dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
  accent: "#38BDF8", // cyan — matches AI avatar indicator
  accentDim: "rgba(56,189,248,0.12)",
  accentBorder: "rgba(56,189,248,0.2)",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function totalProgress(files: FileProgress[], nsfw: boolean): { pct: number; done: boolean } {
  const modelsToDownload = nsfw ? NSFW_MODEL_FILES : SAFE_MODEL_FILES;
  const totalBytes = modelsToDownload.reduce(
    (s: number, m: any) => s + m.approximateSizeBytes,
    0
  );
  const downloadedBytes = files.reduce((s: number, f: FileProgress) => s + f.downloaded, 0);
  const allDone = files.every((f) => f.done);
  return {
    pct: totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0,
    done: allDone,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Label({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: "10px",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: T.dim(dark),
      }}
    >
      {children}
    </span>
  );
}

function ProgressBar({
  pct,
  dark,
  accent = false,
}: {
  pct: number;
  dark: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        height: "3px",
        width: "100%",
        borderRadius: "99px",
        background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <motion.div
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.35, ease: "linear" }}
        style={{
          height: "100%",
          borderRadius: "99px",
          background: accent
            ? `linear-gradient(90deg, rgba(56,189,248,0.6), ${T.accent})`
            : dark
            ? "linear-gradient(90deg, rgba(226,232,240,0.3), #E2E8F0)"
            : "linear-gradient(90deg, rgba(28,25,23,0.3), #1C1917)",
          boxShadow: accent ? `0 0 8px rgba(56,189,248,0.4)` : "none",
        }}
      />
    </div>
  );
}

// ─── Phase screens ───────────────────────────────────────────────────────────

function DetectingScreen({ dark }: { dark: boolean }) {
  return (
    <motion.div
      key="detecting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-5"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 size={22} style={{ color: T.dim(dark) }} />
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        <Label dark={dark}>Scanning hardware</Label>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: T.muted(dark),
          }}
        >
          Checking GPU capabilities and model directory...
        </p>
      </div>
    </motion.div>
  );
}

function ChooseScreen({
  dark,
  gpuInfo,
  nsfw,
  setNsfw,
  onLocal,
  onServer,
}: {
  dark: boolean;
  gpuInfo: GpuInfo;
  nsfw: boolean;
  setNsfw: (val: boolean) => void;
  onLocal: () => void;
  onServer: () => void;
}) {
  const totalSizeBytes = (nsfw ? NSFW_MODEL_FILES : SAFE_MODEL_FILES).reduce(
    (s: number, m: any) => s + m.approximateSizeBytes,
    0
  );

  return (
    <motion.div
      key="choose"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center gap-10 w-full max-w-2xl"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: T.accentDim,
            border: `1px solid ${T.accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Cpu size={18} style={{ color: T.accent }} />
        </motion.div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "28px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: T.text(dark),
            textAlign: "center",
          }}
        >
          VICES Intelligence Core
        </h1>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            color: T.muted(dark),
            textAlign: "center",
            maxWidth: "380px",
            lineHeight: 1.6,
          }}
        >
          We detected a capable GPU on your system. You can run VICES locally
          for complete privacy, or connect to the central server.
        </p>

        {/* GPU badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "5px 12px",
            borderRadius: "99px",
            background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            border: `1px solid ${T.cardBorder(dark)}`,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: T.accent,
              boxShadow: `0 0 6px ${T.accent}`,
            }}
          />
          <span
            style={{
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: "11px",
              color: T.muted(dark),
            }}
          >
            {gpuInfo.gpuName}
            {gpuInfo.vramEstimateGb > 0 &&
              ` · ${gpuInfo.vramEstimateGb} GB VRAM`}
          </span>
        </div>
      </div>

      {/* NSFW Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "16px 20px",
          background: dark ? "#0D0D0D" : "#FEFEFE",
          border: `1px solid ${T.cardBorder(dark)}`,
          borderRadius: "12px",
          marginTop: "-15px",
        }}
      >
        <div className="flex flex-col items-start gap-1">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "13.5px",
              fontWeight: 600,
              color: T.text(dark),
            }}
          >
            Adult / NSFW Local Model
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "11px",
              color: T.muted(dark),
            }}
          >
            {nsfw
              ? "Downloads Uncensored Gemma-4 (allows uncensored & mature roleplay)"
              : "Downloads Standard Gemma-4 (maintains PG-13 content boundaries)"}
          </span>
        </div>
        <button
          onClick={() => setNsfw(!nsfw)}
          style={{
            width: "44px",
            height: "24px",
            borderRadius: "99px",
            background: nsfw ? T.accent : (dark ? "#222" : "#ddd"),
            border: "none",
            cursor: "pointer",
            position: "relative",
            transition: "background-color 0.3s ease",
            padding: "2px",
          }}
        >
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "#FFF",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              position: "absolute",
              top: "2px",
              left: nsfw ? "22px" : "2px",
            }}
          />
        </button>
      </div>

      {/* Choice cards */}
      <div className="grid grid-cols-2 gap-4 w-full">
        {/* Local card */}
        <motion.button
          onClick={onLocal}
          whileHover={{ y: -3, boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          style={{
            background: dark ? "#0D0D0D" : "#FEFEFE",
            border: `1px solid ${T.cardBorder(dark)}`,
            borderRadius: "16px",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "16px",
            cursor: "pointer",
            textAlign: "left",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle top glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "20%",
              right: "20%",
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${T.accentBorder}, transparent)`,
            }}
          />

          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: T.accentDim,
              border: `1px solid ${T.accentBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Cpu size={16} style={{ color: T.accent }} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "15px",
                color: T.text(dark),
              }}
            >
              Local Mode
            </span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "12.5px",
                color: T.muted(dark),
                lineHeight: 1.55,
              }}
            >
              Run entirely on your hardware. All conversations stay on your
              device — zero data leaves your machine.
            </span>
          </div>

          <div
            className="w-full"
            style={{
              borderTop: `1px solid ${T.separator(dark)}`,
              paddingTop: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "7px",
            }}
          >
            <SpecRow
              icon={<HardDrive size={11} />}
              label="Download size"
              value={formatBytes(totalSizeBytes)}
              dark={dark}
            />
            <SpecRow
              icon={<Shield size={11} />}
              label="VRAM required"
              value="4 GB+"
              dark={dark}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: T.accent,
            }}
          >
            <Download size={12} />
            Download &amp; Run Locally
          </div>
        </motion.button>

        {/* Server card */}
        <motion.button
          onClick={onServer}
          whileHover={{ y: -3, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          style={{
            background: dark ? "#0D0D0D" : "#FEFEFE",
            border: `1px solid ${T.cardBorder(dark)}`,
            borderRadius: "16px",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "16px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${T.cardBorder(dark)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Wifi size={16} style={{ color: T.muted(dark) }} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "15px",
                color: T.text(dark),
              }}
            >
              Server Mode
            </span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "12.5px",
                color: T.muted(dark),
                lineHeight: 1.55,
              }}
            >
              Connect to the central VICES GPU server. Instant access, no
              download required.
            </span>
          </div>

          <div
            className="w-full"
            style={{
              borderTop: `1px solid ${T.separator(dark)}`,
              paddingTop: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "7px",
            }}
          >
            <SpecRow
              icon={<Wifi size={11} />}
              label="Internet"
              value="Required"
              dark={dark}
            />
            <SpecRow
              icon={<ArrowRight size={11} />}
              label="Download"
              value="None"
              dark={dark}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: T.dim(dark),
            }}
          >
            <ArrowRight size={12} />
            Connect to Server
          </div>
        </motion.button>
      </div>

      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "10.5px",
          color: T.dim(dark),
          textAlign: "center",
        }}
      >
        You can switch modes later by clearing localStorage.
      </p>
    </motion.div>
  );
}

function SpecRow({
  icon,
  label,
  value,
  dark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dark: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Inter', sans-serif",
        fontSize: "11px",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          color: T.dim(dark),
        }}
      >
        <span style={{ opacity: 0.7 }}>{icon}</span>
        {label}
      </span>
      <span style={{ color: T.muted(dark), fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ModelFoundScreen({
  dark,
  foundModels,
  onLocal,
  onServer,
}: {
  dark: boolean;
  foundModels: string[];
  onLocal: () => void;
  onServer: () => void;
}) {
  return (
    <motion.div
      key="model-found"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex flex-col items-center gap-8 w-full max-w-md"
    >
      <div className="flex flex-col items-center gap-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: T.accentDim,
            border: `1px solid ${T.accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <HardDrive size={18} style={{ color: T.accent }} />
        </motion.div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: T.text(dark),
            textAlign: "center",
          }}
        >
          Existing Model Detected
        </h1>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            color: T.muted(dark),
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          VICES found {foundModels.length} model file
          {foundModels.length !== 1 ? "s" : ""} in your local model directory.
        </p>
      </div>

      {/* Found files */}
      <div
        className="w-full flex flex-col gap-2"
        style={{
          background: dark ? "#0D0D0D" : "#FEFEFE",
          border: `1px solid ${T.cardBorder(dark)}`,
          borderRadius: "12px",
          padding: "16px 18px",
        }}
      >
        {foundModels.map((name) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: "11px",
              color: T.muted(dark),
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: T.accent,
                flexShrink: 0,
              }}
            />
            {name}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <motion.button
          onClick={onLocal}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%",
            padding: "13px 20px",
            borderRadius: "10px",
            background: dark ? "#141414" : "#F5F5F4",
            border: `1px solid ${T.accentBorder}`,
            color: T.accent,
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Cpu size={13} />
          Continue with Local Model
        </motion.button>

        <motion.button
          onClick={onServer}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%",
            padding: "13px 20px",
            borderRadius: "10px",
            background: "transparent",
            border: `1px solid ${T.cardBorder(dark)}`,
            color: T.dim(dark),
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Wifi size={13} />
          Connect to Server Instead
        </motion.button>
      </div>
    </motion.div>
  );
}

function DownloadingScreen({
  dark,
  files,
  nsfw,
  error,
  onCancel,
}: {
  dark: boolean;
  files: FileProgress[];
  nsfw: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const overall = totalProgress(files, nsfw);

  return (
    <motion.div
      key="downloading"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex flex-col gap-8 w-full max-w-md"
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "24px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: T.text(dark),
          }}
        >
          Downloading Intelligence Core
        </h1>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12.5px",
            color: T.muted(dark),
          }}
        >
          {overall.done
            ? "All files downloaded. Model is ready."
            : `${overall.pct.toFixed(1)}% complete — do not close the app.`}
        </p>
      </div>

      {/* Overall bar */}
      <div className="flex flex-col gap-2">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'Inter', sans-serif",
            fontSize: "10.5px",
            color: T.dim(dark),
          }}
        >
          <Label dark={dark}>Overall Progress</Label>
          <span>{overall.pct.toFixed(1)}%</span>
        </div>
        <ProgressBar pct={overall.pct} dark={dark} accent />
      </div>

      {/* Per-file entries */}
      <div className="flex flex-col gap-5">
        {(nsfw ? NSFW_MODEL_FILES : SAFE_MODEL_FILES).map((modelMeta, i) => {
          const f = files[i] ?? {
            downloaded: 0,
            total: modelMeta.approximateSizeBytes,
            speedBps: 0,
            done: false,
          };
          const pct =
            f.total > 0 ? Math.min(100, (f.downloaded / f.total) * 100) : 0;
          const isActive = !f.done && i === files.findIndex((fp) => !fp.done);
          const remaining = Math.max(0, f.total - f.downloaded);

          return (
            <div
              key={modelMeta.id}
              style={{
                padding: "18px 20px",
                borderRadius: "12px",
                background: dark ? "#0D0D0D" : "#FEFEFE",
                border: `1px solid ${
                  isActive ? T.accentBorder : T.cardBorder(dark)
                }`,
                transition: "border-color 0.3s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      fontSize: "13px",
                      color: T.text(dark),
                    }}
                  >
                    {modelMeta.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                      fontSize: "10px",
                      color: T.dim(dark),
                    }}
                  >
                    {modelMeta.filename.slice(-36)}…
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {f.done ? (
                    <CheckCircle2 size={14} style={{ color: T.accent }} />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Loader2 size={13} style={{ color: T.accent }} />
                    </motion.div>
                  ) : (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: T.separator(dark),
                      }}
                    />
                  )}
                </div>
              </div>

              <ProgressBar pct={pct} dark={dark} accent={isActive} />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                  fontSize: "10px",
                  color: T.dim(dark),
                }}
              >
                <span>
                  {formatBytes(f.downloaded)} / {formatBytes(f.total)}
                </span>
                <span>
                  {f.done
                    ? "Done"
                    : isActive && f.speedBps > 0
                    ? `${formatBytes(f.speedBps)}/s · ${formatEta(
                        remaining,
                        f.speedBps
                      )}`
                    : "Queued"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.18)",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <AlertCircle size={14} style={{ color: "#F87171", flexShrink: 0, marginTop: 1 }} />
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "12px",
              color: "#F87171",
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
        </motion.div>
      )}

      {/* Cancel */}
      {!overall.done && (
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            fontSize: "11px",
            color: T.dim(dark),
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: 0,
            alignSelf: "center",
            textDecoration: "underline",
          }}
        >
          <X size={11} />
          Cancel download
        </button>
      )}
    </motion.div>
  );
}

function CompleteScreen({
  dark,
  onContinue,
}: {
  dark: boolean;
  onContinue: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onContinue, 2000);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <motion.div
      key="complete"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <CheckCircle2 size={36} style={{ color: T.accent }} />
      </motion.div>

      <div className="flex flex-col items-center gap-2">
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "24px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: T.text(dark),
          }}
        >
          Model Ready
        </h1>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: T.muted(dark),
          }}
        >
          Initialising VICES...
        </p>
      </div>

      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Loader2 size={14} style={{ color: T.dim(dark) }} />
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocalSetup({ isDark: dark, onComplete }: LocalSetupProps) {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  const [foundModels, setFoundModels] = useState<string[]>([]);
  const [dlError, setDlError] = useState<string | null>(null);
  const [nsfw, setNsfw] = useState(false);
  const { isAdultVerified, requestVerification, gateOpen, handleConfirm, handleDismiss } = useAgeGate();

  // Guarded NSFW toggle — intercepts the enable path through the age gate.
  const handleNsfwToggle = (val: boolean) => {
    if (val && !isAdultVerified) {
      requestVerification(() => setNsfw(true));
    } else {
      setNsfw(val);
    }
  };
  const [files, setFiles] = useState<FileProgress[]>(
    NSFW_MODEL_FILES.map((m) => ({
      downloaded: 0,
      total: m.approximateSizeBytes,
      speedBps: 0,
      done: false,
    }))
  );
  const abortRef = useRef<AbortController | null>(null);

  // ── Detection phase ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [gpu, { anyFound }] = await Promise.all([detectGpu(), checkModelsExist()]);
      const models = await scanForModels();
      if (cancelled) return;

      setGpuInfo(gpu);

      if (!gpu.hasCapableGpu) {
        // No capable GPU — skip setup entirely, go straight to server flow
        localStorage.setItem("vices_setup_done", "1");
        localStorage.setItem("vices_mode", "server");
        onComplete("server");
        return;
      }

      setFoundModels(models);

      if (anyFound) {
        setPhase("model-found");
      } else {
        setPhase("choose");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  // ── Download handler ─────────────────────────────────────────────────────
  const startDownload = async () => {
    setPhase("downloading");
    setDlError(null);
    const modelsToDownload = nsfw ? NSFW_MODEL_FILES : SAFE_MODEL_FILES;
    // Reset file progress
    setFiles(
      modelsToDownload.map((m) => ({
        downloaded: 0,
        total: m.approximateSizeBytes,
        speedBps: 0,
        done: false,
      }))
    );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const progress of downloadAllModels(nsfw, controller.signal)) {
        if (controller.signal.aborted) break;
        setFiles((prev) => {
          const next = [...prev];
          next[progress.fileIndex] = {
            downloaded: progress.downloaded,
            total: progress.total,
            speedBps: progress.speedBps,
            done: progress.done,
          };
          return next;
        });
      }

      if (!controller.signal.aborted) {
        setPhase("complete");
        localStorage.setItem("vices_setup_done", "1");
        localStorage.setItem("vices_mode", "local");
      }
    } catch (err: unknown) {
      const isDomAbort =
        err instanceof DOMException && err.name === "AbortError";
      if (!isDomAbort) {
        const msg =
          err instanceof Error ? err.message : "An unknown error occurred.";
        setDlError(`Download failed: ${msg}. Check your connection and retry.`);
      } else {
        // User cancelled — go back to choose
        setPhase("choose");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const cancelDownload = () => {
    abortRef.current?.abort();
  };

  const handleServerChoice = () => {
    localStorage.setItem("vices_setup_done", "1");
    localStorage.setItem("vices_mode", "server");
    onComplete("server");
  };

  const handleLocalModelFound = () => {
    localStorage.setItem("vices_setup_done", "1");
    localStorage.setItem("vices_mode", "local");
    onComplete("local");
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{ background: T.bg(dark) }}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: dark
            ? "radial-gradient(ellipse at 50% 40%, rgba(56,189,248,0.03) 0%, transparent 65%)"
            : "radial-gradient(ellipse at 50% 40%, rgba(56,189,248,0.05) 0%, transparent 65%)",
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: dark
            ? "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)"
            : "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative z-10 w-full flex flex-col items-center justify-center px-8 py-16">
        <AnimatePresence mode="wait">
          {phase === "detecting" && <DetectingScreen dark={dark} />}

          {phase === "choose" && gpuInfo && (
            <ChooseScreen
              dark={dark}
              gpuInfo={gpuInfo}
              nsfw={nsfw}
              setNsfw={handleNsfwToggle}
              onLocal={startDownload}
              onServer={handleServerChoice}
            />
          )}

          {phase === "model-found" && (
            <ModelFoundScreen
              dark={dark}
              foundModels={foundModels}
              onLocal={handleLocalModelFound}
              onServer={handleServerChoice}
            />
          )}

          {phase === "downloading" && (
            <DownloadingScreen
              dark={dark}
              files={files}
              nsfw={nsfw}
              error={dlError}
              onCancel={cancelDownload}
            />
          )}

          {phase === "complete" && (
            <CompleteScreen
              dark={dark}
              onContinue={() => onComplete("local")}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Age gate modal — renders above all LocalSetup content */}
      <AgeGateModal
        open={gateOpen}
        isDark={dark}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
