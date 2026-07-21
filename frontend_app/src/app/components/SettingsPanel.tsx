import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  X,
  Sliders,
  Volume2,
  Image,
  Cpu,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Database,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

interface SettingsPanelProps {
  isDark: boolean;
  sessionUrl: string | null;
  onClose: () => void;
  conversations: any[];
}

const T = {
  bg: (dark: boolean) => (dark ? "rgba(10, 10, 10, 0.85)" : "rgba(245, 245, 244, 0.85)"),
  card: (dark: boolean) => (dark ? "#0E0E0E" : "#FFFFFF"),
  cardBorder: (dark: boolean) =>
    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)",
  text: (dark: boolean) => (dark ? "#E2E8F0" : "#1C1917"),
  muted: (dark: boolean) => (dark ? "#71717A" : "#8E8781"),
  dim: (dark: boolean) => (dark ? "#52525B" : "#A8A29E"),
  separator: (dark: boolean) =>
    dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
  accent: "#38BDF8",
  accentDim: "rgba(56,189,248,0.12)",
  accentBorder: "rgba(56,189,248,0.2)",
};

const VOICE_PRESETS = [
  { value: "en-GB-SoniaNeural", label: "Sonia Neural (UK - Default)" },
  { value: "en-GB-RyanNeural", label: "Ryan Neural (UK - Male)" },
  { value: "en-GB-LibbyNeural", label: "Libby Neural (UK - Warm)" },
  { value: "en-US-JennyNeural", label: "Jenny Neural (US - Warm flirty)" },
  { value: "en-US-GuyNeural", label: "Guy Neural (US - Male)" },
  { value: "en-US-MichelleNeural", label: "Michelle Neural (US - High-pitch)" },
  { value: "en-CA-LiamNeural", label: "Liam Neural (Canada)" },
];

export function SettingsPanel({ isDark, sessionUrl, onClose, conversations }: SettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [contextSize, setContextSize] = useState(2048);
  const [threads, setThreads] = useState(4);
  const [gpuLayers, setGpuLayers] = useState(99);
  const [voice, setVoice] = useState("en-GB-SoniaNeural");
  const [voiceRate, setVoiceRate] = useState(-5);
  const [voicePitch, setVoicePitch] = useState(-5);
  const [sdSteps, setSdSteps] = useState(20);
  const [sdCfg, setSdCfg] = useState(7.5);
  const [sdNeg, setSdNeg] = useState("");
  const [sdBase, setSdBase] = useState("");

  // Age verification state
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(() => {
    return typeof window !== "undefined" && localStorage.getItem("vices_age_verified") === "true";
  });
  const [revokeSuccess, setRevokeSuccess] = useState(false);

  const handleRevokeAdultAccess = () => {
    localStorage.removeItem("vices_age_verified");
    setIsAgeVerified(false);
    setRevokeSuccess(true);
    setTimeout(() => setRevokeSuccess(false), 3000);
  };

  const fetchUrl = (sessionUrl || "http://localhost:8000").replace(/\/+$/, "");

  const handleExportHistory = () => {
    try {
      const dataStr = JSON.stringify(conversations, null, 2);
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
      const exportFileDefaultName = `vices_history_${Date.now()}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      console.error("Failed to export conversations history:", e);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${fetchUrl}/settings`);
      if (res.ok) {
        const data = await res.json();
        setContextSize(data.context_size || 2048);
        setThreads(data.threads || 4);
        setGpuLayers(data.gpu_layers !== undefined ? data.gpu_layers : 99);
        setVoice(data.edge_tts_voice || "en-GB-SoniaNeural");
        
        // Strip % or Hz from voiceRate/voicePitch for easier slider/input management
        const rateRaw = data.edge_tts_rate || "-5%";
        setVoiceRate(parseInt(rateRaw.replace("%", "")) || -5);
        const pitchRaw = data.edge_tts_pitch || "-5Hz";
        setVoicePitch(parseInt(pitchRaw.replace("Hz", "")) || -5);

        setSdSteps(data.sd_steps || 20);
        setSdCfg(data.sd_cfg_scale || 7.5);
        setSdNeg(data.sd_negative_prompt || "");
        setSdBase(data.sd_base_prompt || "");
      } else {
        throw new Error("Failed to load server configurations");
      }
    } catch (e: any) {
      setError(e?.message || "Connection error to server settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [sessionUrl]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // Re-append units
      const rateStr = `${voiceRate > 0 ? "+" : ""}${voiceRate}%`;
      const pitchStr = `${voicePitch > 0 ? "+" : ""}${voicePitch}Hz`;

      const payload = {
        context_size: contextSize,
        threads,
        gpu_layers: gpuLayers,
        edge_tts_voice: voice,
        edge_tts_rate: rateStr,
        edge_tts_pitch: pitchStr,
        sd_steps: sdSteps,
        sd_cfg_scale: sdCfg,
        sd_negative_prompt: sdNeg,
        sd_base_prompt: sdBase,
      };

      const res = await fetch(`${fetchUrl}/settings/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
      } else {
        const data = await res.json();
        throw new Error(data.detail || "Failed to commit settings to disk");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-2xl h-[85vh] flex flex-col rounded-2xl relative overflow-hidden"
        style={{
          background: isDark ? "#0A0A0A" : "#FAFAF9",
          border: `1px solid ${T.cardBorder(isDark)}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${T.separator(isDark)}` }}
        >
          <div className="flex items-center gap-2.5">
            <Sliders size={18} style={{ color: T.accent }} />
            <div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "20px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  color: T.text(isDark),
                }}
              >
                Configuration Panel
              </h2>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  color: T.muted(isDark),
                }}
              >
                Tune your local llama inference core, speech synthesis, and image generation filters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: T.dim(isDark) }}
            className="p-1 rounded-md transition-colors hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: T.accent }} />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* SECTION 1: Llama Server parameters */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu size={15} style={{ color: T.accent }} />
                  <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: T.text(isDark) }}>
                    Inference Core (llama.cpp)
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {/* Context size */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Context size (-c): {contextSize} tokens
                    </label>
                    <input
                      type="range"
                      min="512"
                      max="8192"
                      step="512"
                      value={contextSize}
                      onChange={(e) => setContextSize(parseInt(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  {/* Thread count */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      CPU threads (-t): {threads}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="16"
                      step="1"
                      value={threads}
                      onChange={(e) => setThreads(parseInt(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  {/* GPU offloading */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      GPU layers offloaded (-ngl): {gpuLayers === 0 ? "CPU only" : gpuLayers}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="99"
                      step="5"
                      value={gpuLayers}
                      onChange={(e) => setGpuLayers(parseInt(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px" style={{ background: T.separator(isDark) }} />

              {/* SECTION 2: TTS Preset controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Volume2 size={15} style={{ color: T.accent }} />
                  <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: T.text(isDark) }}>
                    Speech Synthesis (TTS)
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {/* Voice list */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Voice Accent Presets
                    </label>
                    <select
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${T.cardBorder(isDark)}`,
                        color: T.text(isDark),
                      }}
                    >
                      {VOICE_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Speed/Rate slider */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Speaking Speed rate: {voiceRate}%
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="5"
                      value={voiceRate}
                      onChange={(e) => setVoiceRate(parseInt(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  {/* Pitch slider */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Voice Pitch shift: {voicePitch}Hz
                    </label>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="2"
                      value={voicePitch}
                      onChange={(e) => setVoicePitch(parseInt(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px" style={{ background: T.separator(isDark) }} />

              {/* SECTION 3: Image generation configurations */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Image size={15} style={{ color: T.accent }} />
                  <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: T.text(isDark) }}>
                    Stable Diffusion Selfies
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {/* Steps */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Inference Steps: {sdSteps}
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={sdSteps}
                      onChange={(e) => setSdSteps(parseInt(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  {/* CFG */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Guidance Scale (CFG): {sdCfg.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="20.0"
                      step="0.5"
                      value={sdCfg}
                      onChange={(e) => setSdCfg(parseFloat(e.target.value))}
                      className="w-full h-[3px] accent-sky-400 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  {/* Base Prompt */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      SD Character Base Prompt
                    </label>
                    <textarea
                      rows={3}
                      value={sdBase}
                      onChange={(e) => setSdBase(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${T.cardBorder(isDark)}`,
                        color: T.text(isDark),
                      }}
                    />
                  </div>
                  {/* Negative Prompt */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-[11px] font-semibold" style={{ color: T.dim(isDark) }}>
                      Negative Prompt
                    </label>
                    <textarea
                      rows={3}
                      value={sdNeg}
                      onChange={(e) => setSdNeg(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${T.cardBorder(isDark)}`,
                        color: T.text(isDark),
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px" style={{ background: T.separator(isDark) }} />

              {/* SECTION 4: Data & History */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database size={15} style={{ color: T.accent }} />
                  <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: T.text(isDark) }}>
                    Data &amp; History
                  </h3>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-[11px]" style={{ color: T.dim(isDark) }}>
                    Export your conversation logs to a JSON file. This includes all user messages, replies, and timestamps.
                  </p>
                  <button
                    onClick={handleExportHistory}
                    className="self-start px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 border hover:bg-white/5"
                    style={{
                      borderColor: T.cardBorder(isDark),
                      color: T.text(isDark),
                    }}
                  >
                    Export Chat History (.json)
                  </button>
                </div>
              </div>

              <div className="h-px" style={{ background: T.separator(isDark) }} />

              {/* SECTION 5: Safety & Content Verification */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} style={{ color: "#F59E0B" }} />
                  <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: T.text(isDark) }}>
                    Safety &amp; Age Verification
                  </h3>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-[11px]" style={{ color: T.dim(isDark) }}>
                    Manage device-level age confirmation for adult/uncensored content models and roleplay.
                  </p>

                  <div
                    className="p-3.5 rounded-xl border flex items-center justify-between"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                      borderColor: T.cardBorder(isDark),
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium" style={{ color: T.text(isDark) }}>
                        Status: {isAgeVerified ? "Verified (18+ Adult Access Active)" : "Not Verified (Adult Content Locked)"}
                      </span>
                      <span className="text-[11px]" style={{ color: T.muted(isDark) }}>
                        {isAgeVerified
                          ? "You have confirmed 18+ verification on this device."
                          : "Adult content toggles will require verification modal."}
                      </span>
                    </div>

                    {isAgeVerified ? (
                      <button
                        onClick={handleRevokeAdultAccess}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                        style={{ color: "#F59E0B" }}
                      >
                        Revoke Adult Access
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-500 italic">Locked</span>
                    )}
                  </div>

                  {revokeSuccess && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                      <ShieldCheck size={14} />
                      <span>Adult access revoked! Verification will be required to enable adult content again.</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Bar */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            borderTop: `1px solid ${T.separator(isDark)}`,
            background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
          }}
        >
          <span style={{ fontSize: "11px", color: T.muted(isDark) }}>
            * Modifying core params restarts llama-server on next chat.
          </span>
          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-1 text-green-500 text-xs">
                <CheckCircle size={14} />
                <span>Configs committed!</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2"
              style={{
                background: T.accent,
                color: "#000",
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
