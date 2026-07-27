/**
 * CommandBar.tsx — chat input.
 * - Real voice input: mic button records, local Whisper transcribes into the box.
 * - Voice-reply toggle: speaker icon asks the backend to speak its answer (TTS).
 * - Image attach preserved. Styled with --v-* design tokens.
 */

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ImageIcon, Mic, ArrowUp, X, Volume2, Loader2, Square } from "lucide-react";
import { useVoiceInput } from "../utils/useVoiceInput";

interface CommandBarProps {
  isDark: boolean;
  onSend: (text: string, image?: { url: string; name: string }, voice?: boolean) => void;
  disabled?: boolean;
  sessionUrl?: string | null;
  placeholder?: string;
}

function RecordingWave() {
  const bars = Array.from({ length: 24 });
  return (
    <div className="flex-1 flex items-center gap-3 px-2 min-h-[36px]">
      <span
        className="text-[12px] font-medium shrink-0"
        style={{ color: "var(--v-danger)" }}
      >
        ● Recording
      </span>
      <div className="flex-1 flex items-center justify-center gap-[3px] h-6">
        {bars.map((_, i) => (
          <motion.span
            key={i}
            className="block w-[2.5px] rounded-full"
            animate={{ height: ["18%", `${35 + Math.random() * 60}%`, "18%"] }}
            transition={{
              duration: 0.8 + (i % 5) * 0.1,
              repeat: Infinity,
              delay: i * 0.03,
              ease: "easeInOut",
            }}
            style={{ background: "var(--v-danger)", minHeight: "3px", opacity: 0.85 }}
          />
        ))}
      </div>
      <span className="text-[11px] shrink-0" style={{ color: "var(--v-text-faint)" }}>
        click ■ to finish
      </span>
    </div>
  );
}

export function CommandBar({ isDark, onSend, disabled, sessionUrl = null, placeholder = "Message your agent…" }: CommandBarProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [speakReply, setSpeakReply] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    state: voiceState,
    error: voiceError,
    startRecording,
    stopRecording,
  } = useVoiceInput({
    sessionUrl,
    onTranscript: (text) => {
      setValue((v) => (v ? `${v} ${text}` : text));
      setTimeout(() => taRef.current?.focus(), 50);
    },
  });

  const canSend = (value.trim().length > 0 || !!image) && !disabled && voiceState === "idle";
  const isRecording = voiceState === "recording";
  const isTranscribing = voiceState === "transcribing";

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 180) + "px";
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
    };
  }, [image?.url]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(value.trim(), image ?? undefined, speakReply);
    setValue("");
    setImage(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
    setImage({ url: URL.createObjectURL(f), name: f.name });
    e.target.value = "";
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-[var(--v-radius)] overflow-hidden"
        style={{
          background: "var(--v-surface)",
          border: `1px solid ${isRecording ? "var(--v-danger)" : "var(--v-border-strong)"}`,
          boxShadow: "var(--v-shadow)",
          transition: "border-color 0.25s",
        }}
      >
        {/* Image preview chip */}
        <AnimatePresence>
          {image && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pt-3"
            >
              <div
                className="inline-flex items-center gap-2 p-1.5 pr-3 rounded-[var(--v-radius-sm)]"
                style={{ background: "var(--v-surface-2)", border: "1px solid var(--v-border)" }}
              >
                <img
                  src={image.url}
                  alt=""
                  className="w-10 h-10 object-cover rounded-md"
                  style={{ border: "1px solid var(--v-border)" }}
                />
                <span
                  className="max-w-[220px] truncate text-[12px]"
                  style={{ color: "var(--v-text-muted)" }}
                >
                  {image.name}
                </span>
                <button
                  onClick={() => setImage(null)}
                  className="p-0.5 rounded-md cursor-pointer"
                  style={{ color: "var(--v-text-faint)" }}
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STT error strip */}
        <AnimatePresence>
          {voiceError && voiceState === "error" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pt-2 text-[11.5px]"
              style={{ color: "var(--v-danger)" }}
            >
              {voiceError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5 px-3 py-2.5">
          {/* Attach */}
          <div className="flex items-center gap-0.5 pb-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isRecording || isTranscribing}
              className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)] disabled:opacity-40"
              style={{ color: "var(--v-text-muted)" }}
              title="Attach image"
            >
              <ImageIcon size={17} />
            </button>

            {/* Mic — records, transcribes locally */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing || !!disabled}
              className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)] disabled:opacity-40"
              style={{ color: isRecording ? "var(--v-danger)" : "var(--v-text-muted)" }}
              title={isRecording ? "Stop recording" : "Voice input (local Whisper)"}
            >
              {isRecording ? (
                <Square size={17} fill="currentColor" />
              ) : isTranscribing ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Mic size={17} />
              )}
            </button>

            {/* Speak-reply toggle (TTS) */}
            <button
              onClick={() => setSpeakReply((v) => !v)}
              className="p-2 rounded-[var(--v-radius-sm)] transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
              style={{
                color: speakReply ? "var(--v-accent)" : "var(--v-text-muted)",
                background: speakReply ? "var(--v-accent-soft)" : "transparent",
              }}
              title={speakReply ? "Voice replies ON" : "Voice replies OFF"}
            >
              <Volume2 size={17} />
            </button>
          </div>

          {/* Input area / recording wave */}
          {isRecording ? (
            <RecordingWave />
          ) : (
            <textarea
              ref={taRef}
              value={isTranscribing ? "Transcribing…" : value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={placeholder}
              disabled={disabled || isTranscribing}
              className="flex-1 resize-none bg-transparent outline-none py-2 px-1 text-[14px]"
              style={{
                color: isTranscribing ? "var(--v-text-faint)" : "var(--v-text)",
                lineHeight: 1.55,
                minHeight: "36px",
                maxHeight: "180px",
                fontStyle: isTranscribing ? "italic" : "normal",
              }}
            />
          )}

          {/* Send */}
          <div className="pb-0.5 w-10 h-10 flex items-center justify-center shrink-0">
            <AnimatePresence>
              {canSend && (
                <motion.button
                  key="send"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleSend}
                  className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                  style={{
                    background: "var(--v-accent)",
                    color: "var(--v-accent-contrast)",
                    boxShadow: "0 4px 14px var(--v-accent-soft)",
                  }}
                  title="Send"
                >
                  <ArrowUp size={16} strokeWidth={2.6} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      <div
        className="text-center text-[10.5px] mt-2 select-none"
        style={{ color: "var(--v-text-faint)" }}
      >
        Local-first · your data never leaves this machine
      </div>
    </div>
  );
}
