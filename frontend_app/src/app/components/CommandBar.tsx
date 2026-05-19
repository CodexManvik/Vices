import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ImageIcon, Mic, ArrowUp, X } from "lucide-react";

interface CommandBarProps {
  isDark: boolean;
  onSend: (text: string, image?: { url: string; name: string }) => void;
  disabled?: boolean;
}

function VoiceWaveform({ isDark }: { isDark: boolean }) {
  const bars = Array.from({ length: 28 });
  return (
    <div className="flex-1 flex items-center gap-3 px-2 py-1.5 min-h-[24px]">
      <div className="flex items-center gap-2 shrink-0">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isDark ? "#E2E8F0" : "#1C1917",
            boxShadow: isDark
              ? "0 0 10px rgba(226,232,240,0.7)"
              : "0 0 6px rgba(28,25,23,0.3)",
          }}
        />
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: isDark ? "#A1A1AA" : "#52525B",
            letterSpacing: "0.04em",
          }}
        >
          Listening
        </span>
      </div>
      <div
        className="flex-1 flex items-center justify-center gap-[3px] h-6"
        style={{
          borderTop: isDark
            ? "1px solid rgba(255,255,255,0.04)"
            : "1px solid rgba(0,0,0,0.04)",
          paddingTop: "2px",
        }}
      >
        {bars.map((_, i) => (
          <motion.span
            key={i}
            className="block w-[2px] rounded-full"
            animate={{
              height: [
                "20%",
                `${30 + Math.random() * 70}%`,
                `${20 + Math.random() * 50}%`,
                "20%",
              ],
            }}
            transition={{
              duration: 0.9 + (i % 5) * 0.12,
              repeat: Infinity,
              delay: i * 0.04,
              ease: "easeInOut",
            }}
            style={{
              background: isDark
                ? "rgba(226,232,240,0.7)"
                : "rgba(28,25,23,0.6)",
              minHeight: "2px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function CommandBar({ isDark, onSend, disabled }: CommandBarProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [voice, setVoice] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = (value.trim().length > 0 || !!image) && !disabled;

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(value.trim(), image ?? undefined);
    setValue("");
    setImage(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImage({ url, name: f.name });
    e.target.value = "";
  };

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-30 w-[min(720px,calc(100%-48px))] pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.6)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(0,0,0,0.08)",
          boxShadow: isDark
            ? "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 16px 40px rgba(0,0,0,0.12)",
        }}
      >
        {/* Image preview */}
        <AnimatePresence>
          {image && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pt-3"
            >
              <div
                className="inline-flex items-center gap-2 p-1.5 pr-3 rounded-lg"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <img
                  src={image.url}
                  alt=""
                  className="w-10 h-10 object-cover rounded-md"
                  style={{
                    border: isDark
                      ? "1px solid rgba(226,232,240,0.15)"
                      : "1px solid rgba(28,25,23,0.1)",
                  }}
                />
                <span
                  className="max-w-[220px] truncate"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "12px",
                    color: isDark ? "#A1A1AA" : "#52525B",
                  }}
                >
                  {image.name}
                </span>
                <button
                  onClick={() => setImage(null)}
                  className="p-0.5 rounded-md transition-colors"
                  style={{ color: isDark ? "#71717A" : "#78716C" }}
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1 px-3 py-2.5">
          {/* Left icons */}
          <div className="flex items-center gap-0.5 pb-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: isDark ? "#71717A" : "#78716C" }}
              title="Attach image"
            >
              <ImageIcon size={16} />
            </button>
            <button
              onClick={() => setVoice((v) => !v)}
              className="p-1.5 rounded-md transition-colors"
              style={{
                color: voice
                  ? isDark ? "#E2E8F0" : "#1C1917"
                  : isDark ? "#71717A" : "#78716C",
              }}
              title="Voice"
            >
              <Mic size={16} />
            </button>
          </div>

          {/* Textarea OR voice waveform */}
          {voice ? (
            <VoiceWaveform isDark={isDark} />
          ) : (
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Message Rosia..."
              disabled={disabled}
              className="flex-1 resize-none bg-transparent outline-none py-1.5 px-1"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "14.5px",
                color: isDark ? "#E2E8F0" : "#1C1917",
                lineHeight: 1.5,
                minHeight: "24px",
                maxHeight: "160px",
              }}
            />
          )}

          {/* Send button - fades in */}
          <div className="pb-0.5 w-9 h-9 flex items-center justify-center">
            <AnimatePresence>
              {canSend && (
                <motion.button
                  key="send"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                  onClick={handleSend}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: isDark ? "#E2E8F0" : "#1C1917",
                    color: isDark ? "#0A0A0A" : "#F5F5F4",
                    boxShadow: isDark
                      ? "0 0 16px rgba(226,232,240,0.3)"
                      : "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
