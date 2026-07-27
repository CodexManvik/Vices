import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  X, Sliders, Volume2, Image as ImageIcon, Cpu, Save, Loader2, CheckCircle,
  AlertCircle, Database, FolderOpen, Boxes, Mic, Cloud, RotateCcw, Trash2,
} from "lucide-react";
import { InfoTooltip } from "./ui/InfoTooltip";
import { FilePicker } from "./ui/FilePicker";

interface SettingsPanelProps {
  isDark: boolean;
  sessionUrl: string | null;
  onClose: () => void;
  conversations: any[];
}

const VOICE_PRESETS = [
  { value: "en-GB-SoniaNeural", label: "Sonia (UK) — default" },
  { value: "en-GB-RyanNeural", label: "Ryan (UK, male)" },
  { value: "en-GB-LibbyNeural", label: "Libby (UK, warm)" },
  { value: "en-US-JennyNeural", label: "Jenny (US, warm)" },
  { value: "en-US-GuyNeural", label: "Guy (US, male)" },
];

const KOKORO_VOICES = [
  { value: "af_heart", label: "Heart (US female) — default" },
  { value: "af_bella", label: "Bella (US female)" },
  { value: "am_michael", label: "Michael (US male)" },
  { value: "bf_emma", label: "Emma (UK female)" },
  { value: "bm_george", label: "George (UK male)" },
];

// One place to describe every setting — shown on hover.
const HELP = {
  llm: "The chat model (a .gguf file) that powers all conversation. Leave blank to auto-use the model in models/llm. Browse to pick any .gguf on your PC.",
  ctx: "How much conversation the model can see at once. Auto (0) uses the model's own maximum — recommended. Raising it manually costs VRAM; too low and long chats or big tool results get cut off. Context shift is always on, so the oldest turns drop rather than erroring.",
  threads: "CPU threads used for the parts of the model not on the GPU. Roughly your core count; too high can hurt.",
  ngl: "How many model layers run on the GPU. Higher = faster but more VRAM. 0 = CPU only (slow). Lower this if you hit out-of-memory.",
  backend: "Where generation runs. 'Local' uses your llama.cpp model (private, offline). 'Cloud' calls an OpenAI-compatible API (needs a key in .env).",
  ttsEngine: "Voice used for spoken replies. 'Kokoro' runs locally (private). 'Edge' uses Microsoft's online voices (needs internet).",
  voice: "Which Edge voice speaks replies when the Edge engine is selected.",
  kokoroVoice: "Which local Kokoro voice speaks replies.",
  rate: "How fast the voice speaks. Negative is slower, positive is faster.",
  pitch: "Raises or lowers the voice pitch.",
  arch: "Image model family. 'Auto' detects from the file. 'SD1.5' for Stable Diffusion checkpoints. 'Z-Image' for Z-Image Turbo (transformer + VAE + text encoder).",
  sd15: "A Stable Diffusion 1.5 .safetensors checkpoint. Only used when the architecture is SD1.5. Blank = auto-detect from models/image.",
  ztrans: "The Z-Image Turbo transformer (a .gguf or .safetensors). This is the main image model. Blank = auto-detect from models/image.",
  zvae: "The Z-Image VAE (usually diffusion_pytorch_model.safetensors, ~168 MB). A wrong VAE causes shape errors. Blank = download the correct one.",
  ztext: "The Z-Image text encoder (Qwen3, .gguf or .safetensors). Turns your prompt into guidance. Blank = download from the base repo.",
  zres: "Image size. Lower resolution uses dramatically less GPU memory — on a 4 GB card, start at 512. Raise it only if generation succeeds without running out of memory.",
  steps: "Denoising steps. More = more detail but slower. SD1.5 likes ~20; Z-Image Turbo needs only ~8.",
  cfg: "How strongly the image follows your prompt. Higher = more literal. SD1.5 ~7; Z-Image Turbo uses ~1 (no guidance).",
  base: "Extra tags appended to every image prompt to fix the character's look (hair, style, quality).",
  neg: "Things to avoid in images (deformities, artifacts). Applies to SD1.5.",
};

export function SettingsPanel({ isDark, sessionUrl, onClose, conversations }: SettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Inference
  const [contextSize, setContextSize] = useState(0); // 0 = auto
  const [threads, setThreads] = useState(4);
  const [gpuLayers, setGpuLayers] = useState(99);
  const [backend, setBackend] = useState("local");

  // Models
  const [llmPath, setLlmPath] = useState("");
  const [imageArch, setImageArch] = useState("auto");
  const [sd15Path, setSd15Path] = useState("");
  const [zTransformer, setZTransformer] = useState("");
  const [zVae, setZVae] = useState("");
  const [zText, setZText] = useState("");
  const [zRes, setZRes] = useState(768);

  // Voice
  const [ttsEngine, setTtsEngine] = useState("kokoro");
  const [voice, setVoice] = useState("en-GB-SoniaNeural");
  const [kokoroVoice, setKokoroVoice] = useState("af_heart");
  const [voiceRate, setVoiceRate] = useState(-5);
  const [voicePitch, setVoicePitch] = useState(-5);

  // Image
  const [sdSteps, setSdSteps] = useState(20);
  const [sdCfg, setSdCfg] = useState(7.5);
  const [sdNeg, setSdNeg] = useState("");
  const [sdBase, setSdBase] = useState("");

  // File picker modal
  const [picker, setPicker] = useState<null | { title: string; exts: string; set: (p: string) => void }>(null);

  const fetchUrl = (sessionUrl || "http://localhost:8000").replace(/\/+$/, "");

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${fetchUrl}/settings`);
      if (!res.ok) throw new Error("Failed to load server configuration");
      const d = await res.json();
      setContextSize(d.context_size ?? 0);
      setThreads(d.threads ?? 4);
      setGpuLayers(d.gpu_layers ?? 99);
      setBackend(d.generation_backend || "local");
      setLlmPath(d.llm_model_path || "");
      setImageArch(d.image_arch || "auto");
      setSd15Path(d.image_model_path || "");
      setZTransformer(d.zimage_transformer_path || "");
      setZVae(d.zimage_vae_path || "");
      setZText(d.zimage_text_encoder_path || "");
      setZRes(d.zimage_resolution || 768);
      setTtsEngine(d.tts_engine || "kokoro");
      setVoice(d.edge_tts_voice || "en-GB-SoniaNeural");
      setKokoroVoice(d.kokoro_voice || "af_heart");
      setVoiceRate(parseInt((d.edge_tts_rate || "-5%").replace("%", "")) || -5);
      setVoicePitch(parseInt((d.edge_tts_pitch || "-5Hz").replace("Hz", "")) || -5);
      setSdSteps(d.sd_steps ?? 20);
      setSdCfg(d.sd_cfg_scale ?? 7.5);
      setSdNeg(d.sd_negative_prompt || "");
      setSdBase(d.sd_base_prompt || "");
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
      const payload = {
        context_size: contextSize,
        threads,
        gpu_layers: gpuLayers,
        generation_backend: backend,
        llm_model_path: llmPath,
        image_arch: imageArch,
        image_model_path: sd15Path,
        zimage_transformer_path: zTransformer,
        zimage_vae_path: zVae,
        zimage_text_encoder_path: zText,
        zimage_resolution: zRes,
        tts_engine: ttsEngine,
        edge_tts_voice: voice,
        kokoro_voice: kokoroVoice,
        edge_tts_rate: `${voiceRate > 0 ? "+" : ""}${voiceRate}%`,
        edge_tts_pitch: `${voicePitch > 0 ? "+" : ""}${voicePitch}Hz`,
        sd_steps: sdSteps,
        sd_cfg_scale: sdCfg,
        sd_negative_prompt: sdNeg,
        sd_base_prompt: sdBase,
      };
      const res = await fetch(`${fetchUrl}/settings/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save settings");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportHistory = () => {
    try {
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversations, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataUri);
      a.setAttribute("download", `vices_history_${Date.now()}.json`);
      a.click();
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  // ── small building blocks ─────────────────────────────────────────────
  const Label = ({ text, help }: { text: string; help?: string }) => (
    <label className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: "var(--v-text-muted)" }}>
      {text}
      {help && <InfoTooltip text={help} />}
    </label>
  );

  const PathField = ({
    value, onClear, onBrowse, placeholder,
  }: { value: string; onClear: () => void; onBrowse: () => void; placeholder: string }) => (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 px-3 py-2 rounded-lg text-[11.5px] font-mono truncate"
        style={{ background: "var(--v-surface-2)", border: "1px solid var(--v-border)", color: value ? "var(--v-text)" : "var(--v-text-faint)" }}
        title={value || placeholder}
      >
        {value ? value.split(/[\\/]/).pop() : placeholder}
      </div>
      <button
        onClick={onBrowse}
        className="px-2.5 py-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 shrink-0"
        style={{ background: "var(--v-accent-soft)", color: "var(--v-accent)" }}
      >
        <FolderOpen size={13} /> Browse
      </button>
      {value && (
        <button onClick={onClear} className="p-2 rounded-lg shrink-0 hover:bg-[var(--v-surface-2)]" style={{ color: "var(--v-text-faint)" }} title="Clear (use auto-detect)">
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  );

  const Section = ({ icon: Icon, title, children }: any) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color: "var(--v-accent)" }} />
        <h3 className="text-xs font-semibold tracking-wider uppercase" style={{ color: "var(--v-text)" }}>{title}</h3>
      </div>
      {children}
    </div>
  );

  const Divider = () => <div className="h-px" style={{ background: "var(--v-border)" }} />;

  const selectStyle = {
    background: "var(--v-surface-2)",
    border: "1px solid var(--v-border)",
    color: "var(--v-text)",
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl h-[88vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--v-bg-elev)", border: "1px solid var(--v-border-strong)", boxShadow: "var(--v-shadow-lg)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--v-border)" }}>
          <div className="flex items-center gap-2.5">
            <Sliders size={18} style={{ color: "var(--v-accent)" }} />
            <div>
              <h2 className="text-[17px] font-semibold" style={{ color: "var(--v-text)" }}>Settings</h2>
              <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                Point at any model on your PC, tune inference, voice, and images.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--v-surface-2)]" style={{ color: "var(--v-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--v-accent)" }} />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-lg flex items-center gap-3 text-xs" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "var(--v-danger)" }}>
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              {/* MODELS */}
              <Section icon={Boxes} title="Models">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label text="Chat model (LLM)" help={HELP.llm} />
                    <PathField
                      value={llmPath}
                      placeholder="Auto: models/llm (browse for any .gguf)"
                      onBrowse={() => setPicker({ title: "Select chat model (.gguf)", exts: "gguf", set: setLlmPath })}
                      onClear={() => setLlmPath("")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label text="Image model architecture" help={HELP.arch} />
                    <select value={imageArch} onChange={(e) => setImageArch(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle}>
                      <option value="auto">Auto-detect</option>
                      <option value="sd15">Stable Diffusion 1.5</option>
                      <option value="zimage">Z-Image Turbo</option>
                    </select>
                  </div>

                  {imageArch !== "zimage" && (
                    <div className="space-y-2">
                      <Label text="SD 1.5 checkpoint" help={HELP.sd15} />
                      <PathField
                        value={sd15Path}
                        placeholder="Auto: models/image (browse for .safetensors)"
                        onBrowse={() => setPicker({ title: "Select SD1.5 checkpoint", exts: "safetensors", set: setSd15Path })}
                        onClear={() => setSd15Path("")}
                      />
                    </div>
                  )}

                  {imageArch !== "sd15" && (
                    <div className="space-y-4 p-3.5 rounded-xl" style={{ background: "var(--v-surface-2)", border: "1px solid var(--v-border)" }}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--v-accent)" }}>Z-Image components</div>
                      <div className="space-y-2">
                        <Label text="Transformer" help={HELP.ztrans} />
                        <PathField value={zTransformer} placeholder="Auto: models/image (.gguf / .safetensors)"
                          onBrowse={() => setPicker({ title: "Select Z-Image transformer", exts: "gguf,safetensors", set: setZTransformer })} onClear={() => setZTransformer("")} />
                      </div>
                      <div className="space-y-2">
                        <Label text="VAE" help={HELP.zvae} />
                        <PathField value={zVae} placeholder="Blank = download correct VAE (~168 MB)"
                          onBrowse={() => setPicker({ title: "Select Z-Image VAE", exts: "safetensors", set: setZVae })} onClear={() => setZVae("")} />
                      </div>
                      <div className="space-y-2">
                        <Label text="Text encoder" help={HELP.ztext} />
                        <PathField value={zText} placeholder="Blank = download from base repo"
                          onBrowse={() => setPicker({ title: "Select Z-Image text encoder", exts: "gguf,safetensors", set: setZText })} onClear={() => setZText("")} />
                      </div>
                      <div className="space-y-2">
                        <Label text={`Resolution: ${zRes}×${zRes}`} help={HELP.zres} />
                        <select value={zRes} onChange={(e) => setZRes(+e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle}>
                          <option value={512}>512 × 512 (lowest VRAM — best for 4 GB)</option>
                          <option value={768}>768 × 768 (balanced)</option>
                          <option value={1024}>1024 × 1024 (full quality — needs 6 GB+)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              <Divider />

              {/* INFERENCE */}
              <Section icon={Cpu} title="Inference core">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <Label text="Generation backend" help={HELP.backend} />
                    <select value={backend} onChange={(e) => setBackend(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle}>
                      <option value="local">Local (llama.cpp — private, offline)</option>
                      <option value="cloud">Cloud (OpenAI-compatible API)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      text={`Context size: ${contextSize === 0 ? "Auto (model default)" : contextSize.toLocaleString() + " tokens"}`}
                      help={HELP.ctx}
                    />
                    <input
                      type="range" min={0} max={32768} step={2048}
                      value={contextSize}
                      onChange={(e) => setContextSize(+e.target.value)}
                      className="w-full accent-[var(--v-accent)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label text={`CPU threads: ${threads}`} help={HELP.threads} />
                    <input type="range" min={1} max={16} step={1} value={threads} onChange={(e) => setThreads(+e.target.value)} className="w-full accent-[var(--v-accent)]" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label text={`GPU layers (-ngl): ${gpuLayers === 0 ? "CPU only" : gpuLayers}`} help={HELP.ngl} />
                    <input type="range" min={0} max={99} step={1} value={gpuLayers} onChange={(e) => setGpuLayers(+e.target.value)} className="w-full accent-[var(--v-accent)]" />
                  </div>
                </div>
              </Section>

              <Divider />

              {/* VOICE */}
              <Section icon={Volume2} title="Voice">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <Label text="Text-to-speech engine" help={HELP.ttsEngine} />
                    <select value={ttsEngine} onChange={(e) => setTtsEngine(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle}>
                      <option value="kokoro">Kokoro (local, private)</option>
                      <option value="edge">Edge (Microsoft, online)</option>
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label text={ttsEngine === "kokoro" ? "Kokoro voice" : "Edge voice"} help={ttsEngine === "kokoro" ? HELP.kokoroVoice : HELP.voice} />
                    <select value={ttsEngine === "kokoro" ? kokoroVoice : voice} onChange={(e) => (ttsEngine === "kokoro" ? setKokoroVoice(e.target.value) : setVoice(e.target.value))} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle}>
                      {(ttsEngine === "kokoro" ? KOKORO_VOICES : VOICE_PRESETS).map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label text={`Speed: ${voiceRate}%`} help={HELP.rate} />
                    <input type="range" min={-50} max={50} step={5} value={voiceRate} onChange={(e) => setVoiceRate(+e.target.value)} className="w-full accent-[var(--v-accent)]" />
                  </div>
                  <div className="space-y-2">
                    <Label text={`Pitch: ${voicePitch}Hz`} help={HELP.pitch} />
                    <input type="range" min={-20} max={20} step={2} value={voicePitch} onChange={(e) => setVoicePitch(+e.target.value)} className="w-full accent-[var(--v-accent)]" />
                  </div>
                </div>
              </Section>

              <Divider />

              {/* IMAGE */}
              <Section icon={ImageIcon} title="Image generation">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label text={`Steps: ${sdSteps}`} help={HELP.steps} />
                    <input type="range" min={4} max={50} step={1} value={sdSteps} onChange={(e) => setSdSteps(+e.target.value)} className="w-full accent-[var(--v-accent)]" />
                  </div>
                  <div className="space-y-2">
                    <Label text={`Guidance (CFG): ${sdCfg.toFixed(1)}`} help={HELP.cfg} />
                    <input type="range" min={0} max={20} step={0.5} value={sdCfg} onChange={(e) => setSdCfg(+e.target.value)} className="w-full accent-[var(--v-accent)]" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label text="Character base prompt" help={HELP.base} />
                    <textarea rows={3} value={sdBase} onChange={(e) => setSdBase(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed" style={selectStyle} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label text="Negative prompt" help={HELP.neg} />
                    <textarea rows={3} value={sdNeg} onChange={(e) => setSdNeg(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs leading-relaxed" style={selectStyle} />
                  </div>
                </div>
              </Section>

              <Divider />

              {/* DATA */}
              <Section icon={Database} title="Data & history">
                <button
                  onClick={handleExportHistory}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
                  style={{ border: "1px solid var(--v-border)", color: "var(--v-text)" }}
                >
                  <Save size={13} /> Export chat history (.json)
                </button>
              </Section>
            </>
          )}
        </div>

        {/* Action bar */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--v-border)" }}>
          <span className="text-[11px]" style={{ color: "var(--v-text-faint)" }}>
            Model / core changes take effect on the next message.
          </span>
          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-1 text-xs" style={{ color: "var(--v-success)" }}>
                <CheckCircle size={14} /> <span>Saved</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
              style={{ background: "var(--v-accent)", color: "var(--v-accent-contrast)" }}
            >
              {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save changes</>}
            </button>
          </div>
        </div>
      </motion.div>

      {picker && (
        <FilePicker
          sessionUrl={sessionUrl}
          title={picker.title}
          exts={picker.exts}
          onPick={(p) => { picker.set(p); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
