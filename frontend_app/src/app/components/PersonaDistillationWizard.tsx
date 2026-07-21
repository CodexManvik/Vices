/**
 * PersonaDistillationWizard.tsx
 *
 * Guided export and style distillation UI for creating persona style directives
 * from messaging platform exports (WhatsApp, Telegram, Discord, CSV).
 * All analysis is local and privacy-preserving; raw message logs are never saved.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Upload,
  FileText,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  HelpCircle,
  BarChart2,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface PersonaDistillationWizardProps {
  isDark: boolean;
  sessionUrl: string | null;
  personaId: string;
  personaName: string;
  onClose: () => void;
  onComplete?: (result: any) => void;
}

export function PersonaDistillationWizard({
  isDark,
  sessionUrl,
  personaId,
  personaName,
  onClose,
  onComplete,
}: PersonaDistillationWizardProps) {
  const [platform, setPlatform] = useState<"WhatsApp" | "Telegram" | "Discord" | "Generic">("WhatsApp");
  const [targetSender, setTargetSender] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Styling Tokens
  const cardBg = isDark ? "#121214" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const textPrimary = isDark ? "#F4F4F5" : "#18181B";
  const textMuted = isDark ? "#A1A1AA" : "#71717A";
  const inputBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadAndDistill = async () => {
    if (!file || !sessionUrl) {
      setError("Please select a valid export file.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("platform", platform);
      if (targetSender.trim()) {
        formData.append("target_sender", targetSender.trim());
      }

      const token = "local";

      const res = await fetch(`${baseUrl}/personas/${personaId}/distill`, {
        method: "POST",
        headers: {
          "X-Tester-Token": token,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.result) {
        setResult(data.result);
        if (onComplete) onComplete(data.result);
      } else {
        throw new Error(data.detail || "Failed to process chat export.");
      }
    } catch (err: any) {
      setError(err?.message || "Distillation processing failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl relative overflow-hidden border shadow-2xl"
        style={{ background: cardBg, borderColor: cardBorder }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: cardBorder }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30">
              <Sparkles size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: textPrimary }}>
                Chat Style Distillation Wizard
              </h2>
              <p className="text-xs" style={{ color: textMuted }}>
                Extract conversation traits for companion <strong className="text-purple-400">{personaName}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10" style={{ color: textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl border flex items-center gap-3 text-xs bg-red-500/10 border-red-500/30 text-red-400">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <>
              {/* Platform Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  1. Select Source Platform
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["WhatsApp", "Telegram", "Discord", "Generic"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className="py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border flex flex-col items-center gap-1 cursor-pointer"
                      style={{
                        background: platform === p ? "rgba(168,85,247,0.15)" : inputBg,
                        borderColor: platform === p ? "#A855F7" : cardBorder,
                        color: platform === p ? "#C084FC" : textMuted,
                      }}
                    >
                      <MessageSquare size={16} />
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructions Guide */}
              <div className="p-4 rounded-xl border space-y-2 text-xs" style={{ background: inputBg, borderColor: cardBorder }}>
                <div className="flex items-center gap-1.5 font-semibold text-purple-400">
                  <HelpCircle size={14} />
                  <span>How to export {platform} chat logs:</span>
                </div>

                {platform === "WhatsApp" && (
                  <ol className="list-decimal list-inside space-y-1 pl-1" style={{ color: textMuted }}>
                    <li>Open WhatsApp on your phone or desktop.</li>
                    <li>Tap Chat Settings &rarr; Export Chat.</li>
                    <li>Select <strong>Without Media</strong> and save as <code>.txt</code> file.</li>
                  </ol>
                )}

                {platform === "Telegram" && (
                  <ol className="list-decimal list-inside space-y-1 pl-1" style={{ color: textMuted }}>
                    <li>Open Telegram Desktop &rarr; Settings &rarr; Advanced.</li>
                    <li>Select <strong>Export Telegram Data</strong>.</li>
                    <li>Choose JSON format and download messages file.</li>
                  </ol>
                )}

                {platform === "Discord" && (
                  <ol className="list-decimal list-inside space-y-1 pl-1" style={{ color: textMuted }}>
                    <li>Use DiscordChatExporter or official export format.</li>
                    <li>Export target channel as <code>.json</code> or <code>.txt</code>.</li>
                    <li className="text-amber-400">Note: Ensure you comply with Discord ToS when handling personal exports.</li>
                  </ol>
                )}

                {platform === "Generic" && (
                  <p style={{ color: textMuted }}>
                    Upload any <code>.csv</code> or <code>.txt</code> file containing chat lines in <code>sender: message</code> or <code>sender, message</code> format.
                  </p>
                )}
              </div>

              {/* Target Person Name Optional Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  2. Target Person Name in Export (Optional)
                </label>
                <input
                  type="text"
                  value={targetSender}
                  onChange={(e) => setTargetSender(e.target.value)}
                  placeholder="e.g. Alex (leave blank to auto-detect highest message count)"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-purple-400"
                  style={{ background: inputBg, borderColor: cardBorder, color: textPrimary }}
                />
              </div>

              {/* File Upload Dropzone */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  3. Upload Chat Export File
                </label>
                <label
                  htmlFor="chat-export-input"
                  className="w-full py-8 px-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-purple-400 transition-all"
                  style={{ background: inputBg, borderColor: file ? "#A855F7" : cardBorder }}
                >
                  <Upload size={24} className="text-purple-400" />
                  <span className="text-xs font-medium" style={{ color: textPrimary }}>
                    {file ? file.name : "Click or drop your exported chat file here (.txt, .json, .csv)"}
                  </span>
                  {file && <span className="text-[11px] font-mono text-purple-400">{(file.size / 1024).toFixed(1)} KB</span>}
                  <input id="chat-export-input" type="file" accept=".txt,.json,.csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Privacy Security Note */}
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2 text-[11px] text-purple-300">
                <ShieldCheck size={16} className="shrink-0" />
                <span>Zero Cloud Storage: Messages are parsed locally on your PC. Raw logs are discarded instantly after calculating style metrics.</span>
              </div>
            </>
          ) : (
            /* Results View */
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                <CheckCircle2 size={18} />
                <span>Persona Style Distilled Successfully!</span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border flex flex-col gap-1" style={{ background: inputBg, borderColor: cardBorder }}>
                  <span className="text-[10px] uppercase font-mono" style={{ color: textMuted }}>Total Msgs</span>
                  <span className="text-lg font-bold font-mono" style={{ color: textPrimary }}>{result.total_messages}</span>
                </div>

                <div className="p-3 rounded-xl border flex flex-col gap-1" style={{ background: inputBg, borderColor: cardBorder }}>
                  <span className="text-[10px] uppercase font-mono" style={{ color: textMuted }}>Vocab TTR</span>
                  <span className="text-lg font-bold font-mono text-purple-400">{Math.round(result.ttr * 100)}%</span>
                </div>

                <div className="p-3 rounded-xl border flex flex-col gap-1" style={{ background: inputBg, borderColor: cardBorder }}>
                  <span className="text-[10px] uppercase font-mono" style={{ color: textMuted }}>Avg Length</span>
                  <span className="text-lg font-bold font-mono" style={{ color: textPrimary }}>{result.avg_words} words</span>
                </div>

                <div className="p-3 rounded-xl border flex flex-col gap-1" style={{ background: inputBg, borderColor: cardBorder }}>
                  <span className="text-[10px] uppercase font-mono" style={{ color: textMuted }}>Lowercase Rate</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">{Math.round(result.lowercase_rate * 100)}%</span>
                </div>
              </div>

              {/* Synthesized Style Block */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  Synthesized Persona Style Directive
                </span>
                <pre
                  className="p-4 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed border"
                  style={{ background: isDark ? "#09090B" : "#F4F4F5", borderColor: cardBorder, color: textPrimary }}
                >
                  {result.style_directive}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 border-t" style={{ borderColor: cardBorder }}>
          {!result ? (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium" style={{ color: textMuted, border: `1px solid ${cardBorder}` }}>
                Cancel
              </button>
              <button
                onClick={handleUploadAndDistill}
                disabled={!file || processing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Distill Style</span>
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-semibold text-black bg-purple-400 hover:bg-purple-300 transition-all cursor-pointer"
            >
              <span>Done — Style Active</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
