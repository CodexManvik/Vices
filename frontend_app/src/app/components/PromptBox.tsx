/**
 * PromptBox.tsx — the chat composer.
 *
 * Replaces CommandBar. Structure follows the reference "ai-prompt-box"
 * pattern (rounded surface, pill toggles, radix tooltips, inline file
 * preview, recording state) but every colour comes from the --v-* design
 * tokens, so it works in both themes instead of being hardcoded dark.
 *
 * The pills map to real capabilities rather than decoration:
 *   Search — force a web-search-first answer
 *   Tools  — allow the agent loop to touch files/shell this turn
 *   Voice  — ask the backend to speak its reply (TTS)
 *
 * Wrapped by ToneGlow, which paints the conversation's tone around it.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  ArrowUp, Paperclip, X, Mic, Globe, Wrench, Volume2, Loader2, Square,
} from "lucide-react";
import { useVoiceInput } from "../utils/useVoiceInput";
import { ToneGlow } from "./ui/ToneGlow";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Tooltip ─────────────────────────────────────────────────── */
const Tip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <TooltipPrimitive.Root delayDuration={350}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side="top"
        sideOffset={6}
        className="z-50 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium select-none"
        style={{
          background: "var(--v-surface-3)",
          color: "var(--v-text)",
          border: "1px solid var(--v-border)",
          boxShadow: "var(--v-shadow)",
        }}
      >
        {label}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);

/* ── Gradient divider between pill groups ────────────────────── */
const Divider = () => (
  <span
    className="mx-1 shrink-0"
    style={{
      width: "1.5px",
      height: "18px",
      borderRadius: "2px",
      background:
        "linear-gradient(to top, transparent, color-mix(in srgb, var(--v-accent) 60%, transparent), transparent)",
    }}
  />
);

/* ── Recording visualiser ────────────────────────────────────── */
function RecordingWave({ seconds }: { seconds: number }) {
  const bars = Array.from({ length: 28 });
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-3 px-1 py-2 min-h-[44px]">
      <span className="flex items-center gap-2 shrink-0">
        <motion.span
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--v-danger)" }}
          animate={{ opacity: [1, 0.35, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <span className="text-[12px] font-mono" style={{ color: "var(--v-text-muted)" }}>
          {mm}:{ss}
        </span>
      </span>
      <div className="flex-1 flex items-center justify-center gap-[3px] h-7">
        {bars.map((_, i) => (
          <motion.span
            key={i}
            className="block w-[2.5px] rounded-full"
            style={{ background: "var(--v-text-faint)" }}
            animate={{ height: ["16%", `${30 + ((i * 37) % 62)}%`, "16%"] }}
            transition={{
              duration: 0.7 + (i % 5) * 0.11,
              repeat: Infinity,
              delay: i * 0.028,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Pill toggle ─────────────────────────────────────────────── */
function Pill({
  on, onClick, icon: Icon, label, color, tip,
}: {
  on: boolean; onClick: () => void; icon: any; label: string; color: string; tip: string;
}) {
  return (
    <Tip label={tip}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-full border cursor-pointer shrink-0"
        style={{
          background: on ? `color-mix(in srgb, ${color} 15%, transparent)` : "transparent",
          borderColor: on ? color : "transparent",
          color: on ? color : "var(--v-text-faint)",
          transition: `background var(--v-dur) var(--v-ease), border-color var(--v-dur) var(--v-ease), color var(--v-dur) var(--v-ease)`,
        }}
      >
        <Icon size={15} strokeWidth={2} />
        <AnimatePresence initial={false}>
          {on && (
            <motion.span
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-[11.5px] font-medium overflow-hidden whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </Tip>
  );
}

/* ── Main ────────────────────────────────────────────────────── */
interface PromptBoxProps {
  onSend: (
    text: string,
    image?: { url: string; name: string },
    opts?: { voice?: boolean; search?: boolean; tools?: boolean },
  ) => void;
  disabled?: boolean;
  sessionUrl?: string | null;
  placeholder?: string;
  tone?: string;
  toneEnabled?: boolean;
}

export function PromptBox({
  onSend,
  disabled,
  sessionUrl,
  placeholder = "Message VICES…",
  tone,
  toneEnabled = false,
}: PromptBoxProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [voiceReply, setVoiceReply] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [focused, setFocused] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Transcribed speech is appended to whatever is already typed.
  const { state: voiceState, error, startRecording, stopRecording } = useVoiceInput({
    sessionUrl: sessionUrl ?? null,
    onTranscript: (text) => setValue((v) => (v ? `${v} ${text}` : text)),
  });
  const recording = voiceState === "recording";
  const transcribing = voiceState === "transcribing";

  const busy = disabled || transcribing;
  const canSend = (value.trim().length > 0 || !!image) && !busy && !recording;

  /* autosize */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  /* recording timer */
  useEffect(() => {
    if (!recording) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  /* revoke blob previews */
  useEffect(() => () => {
    if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
  }, [image?.url]);

  const attach = (f?: File | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 10 * 1024 * 1024) return;
    if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
    setImage({ url: URL.createObjectURL(f), name: f.name });
  };

  /* paste-to-attach */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) { attach(it.getAsFile()); break; }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [image]);

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim(), image ?? undefined, {
      voice: voiceReply, search: useSearch, tools: useTools,
    });
    setValue("");
    setImage(null);
  };

  const onMic = useCallback(() => {
    if (recording) stopRecording();
    else startRecording();
  }, [recording, startRecording, stopRecording]);

  return (
    <TooltipPrimitive.Provider>
      <ToneGlow tone={tone} enabled={toneEnabled} dim={focused} radius="var(--v-radius-lg)">
        <div
          className="relative rounded-[var(--v-radius-lg)] border p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); attach(e.dataTransfer.files?.[0]); }}
          style={{
            background: "var(--v-surface)",
            borderColor: focused ? "var(--v-border-strong)" : "var(--v-border)",
            boxShadow: "var(--v-shadow-lg)",
            transition: "border-color var(--v-dur) var(--v-ease)",
          }}
        >
          {/* attachment preview */}
          <AnimatePresence>
            {image && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="relative inline-block m-1 group">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-16 h-16 rounded-xl object-cover"
                    style={{ border: "1px solid var(--v-border)" }}
                  />
                  <button
                    onClick={() => setImage(null)}
                    className="absolute -top-1.5 -right-1.5 p-1 rounded-full cursor-pointer"
                    style={{ background: "var(--v-surface-3)", border: "1px solid var(--v-border)" }}
                    aria-label="Remove attachment"
                  >
                    <X size={11} style={{ color: "var(--v-text)" }} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* text / recording */}
          {recording ? (
            <RecordingWave seconds={seconds} />
          ) : (
            <textarea
              ref={taRef}
              rows={1}
              value={value}
              disabled={busy}
              placeholder={
                transcribing ? "Transcribing…" : useSearch ? "Search the web…" : placeholder
              }
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              className="w-full resize-none bg-transparent outline-none px-2 py-2 text-[14px] leading-relaxed min-h-[44px]"
              style={{ color: "var(--v-text)", maxHeight: 200 }}
            />
          )}

          {/* toolbar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className={cx("flex items-center gap-0.5 min-w-0", recording && "opacity-0 pointer-events-none")}>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { attach(e.target.files?.[0]); e.currentTarget.value = ""; }}
              />
              <Tip label="Attach an image">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                  style={{ color: "var(--v-text-faint)", transition: "background var(--v-dur-fast) var(--v-ease), color var(--v-dur-fast) var(--v-ease)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--v-surface-2)"; e.currentTarget.style.color = "var(--v-text-muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--v-text-faint)"; }}
                  aria-label="Attach an image"
                >
                  <Paperclip size={17} />
                </button>
              </Tip>

              <Divider />
              <Pill
                on={useSearch} onClick={() => setUseSearch((v) => !v)}
                icon={Globe} label="Search" color="var(--v-accent-2)"
                tip="Search the web before answering"
              />
              <Divider />
              <Pill
                on={useTools} onClick={() => setUseTools((v) => !v)}
                icon={Wrench} label="Tools" color="var(--v-accent)"
                tip="Let the agent read/write files and run commands"
              />
              <Divider />
              <Pill
                on={voiceReply} onClick={() => setVoiceReply((v) => !v)}
                icon={Volume2} label="Speak" color="var(--v-tone-warm)"
                tip="Have the reply spoken aloud"
              />
            </div>

            {/* mic + send */}
            <div className="flex items-center gap-1.5 shrink-0">
              {!canSend && !recording && (
                <Tip label={transcribing ? "Transcribing…" : "Record a voice message"}>
                  <button
                    onClick={onMic}
                    disabled={transcribing}
                    className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ color: "var(--v-text-faint)" }}
                    aria-label="Record a voice message"
                  >
                    {transcribing ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}
                  </button>
                </Tip>
              )}

              <Tip label={recording ? "Stop and transcribe" : canSend ? "Send message" : "Nothing to send"}>
                <button
                  onClick={recording ? onMic : submit}
                  disabled={!recording && !canSend}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: recording ? "var(--v-danger)" : canSend ? "var(--v-text)" : "var(--v-surface-2)",
                    color: recording ? "#fff" : canSend ? "var(--v-bg)" : "var(--v-text-faint)",
                    transition: "background var(--v-dur) var(--v-ease), color var(--v-dur) var(--v-ease)",
                  }}
                  aria-label={recording ? "Stop recording" : "Send message"}
                >
                  {recording ? <Square size={13} fill="currentColor" /> : <ArrowUp size={16} strokeWidth={2.5} />}
                </button>
              </Tip>
            </div>
          </div>

          {error && (
            <div className="px-2 pb-1 text-[11px]" style={{ color: "var(--v-danger)" }}>
              {error}
            </div>
          )}
        </div>
      </ToneGlow>
    </TooltipPrimitive.Provider>
  );
}
