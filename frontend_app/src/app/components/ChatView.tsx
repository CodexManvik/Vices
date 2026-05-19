import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDown } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { CommandBar } from "./CommandBar";

interface ChatViewProps {
  isDark: boolean;
  mood: string;
  tone: string;
  sessionUrl: string | null;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatView({ isDark, mood, tone, sessionUrl }: ChatViewProps) {
  // Start with a completely clean slate (no hardcoded messages)
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const messageIdRef = useRef<number>(Date.now());

  // Scroll tracking state
  const feedRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Auto-scroll logic
  const scrollToBottom = (smooth = true) => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    if (atBottom) {
      scrollToBottom(true);
      setPendingCount(0);
    } else if (typing) {
      // Only increment pending count if the AI is generating and we are scrolled up
      setPendingCount((p: number) => p + 1);
    }
  }, [messages, typing, atBottom]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    // Check if we are within 100px of the bottom
    const isBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAtBottom(isBottom);
    if (isBottom) setPendingCount(0);
  };

  // --- CORE STREAMING LOGIC ---
  const handleSend = async (text: string, image?: { url: string; name: string }, voice?: boolean) => {
    if (!sessionUrl || typing) return;
    if (!text.trim() && (!image)) return;

    const id = (messageIdRef.current++).toString();
    const assistantId = (messageIdRef.current++).toString();

    // Optimistically push the user's message to the UI immediately
    const newMsg: Message = {
      id,
      role: "user",
      text,
      time: nowTime(),
    };

    setMessages((prev: Message[]) => [
      ...prev,
      newMsg,
      { id: assistantId, role: "rosia", text: "", time: nowTime() },
    ]);
    
    setTyping(true);
    setAtBottom(true);
    scrollToBottom(true);

    try {
      // Build standard FormData for the FastAPI backend
      const fd = new FormData();
      fd.append("user_input", text);
      fd.append("target_model", "default");
      fd.append("voice_requested", voice ? "true" : "false");

      if (image) {
        const blob = await fetch(image.url).then(r => r.blob());
        fd.append("files", blob, image.name);
      }

      const res = await fetch(`${sessionUrl}/chat`, {
        method: "POST",
        body: fd,
        headers: { "ngrok-skip-browser-warning": "bypass" },
      });

      if (!res.ok || !res.body) throw new Error("Chat core failure");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      const processChunk = (rawText: string) => {
        let cleanText = rawText;
        
        // Parse incoming image triggers seamlessly
        const attachmentRegex = /\[SYSTEM_MEDIA_ATTACHMENT:\s*(file:\/\/[^\]]+)\]/g;
        let match;
        while ((match = attachmentRegex.exec(cleanText)) !== null) {
          const fileUrl = match[1].replace("file://", "");
          const imageUrl = `${sessionUrl}/images/${fileUrl}`;
          setMessages((prev: Message[]) =>
            prev.map((x: Message) => (x.id === assistantId ? { ...x, image: imageUrl } : x))
          );
          cleanText = cleanText.replace(match[0], "");
        }
        
        if (cleanText) {
          setMessages((prev: Message[]) =>
            prev.map((x: Message) => (x.id === assistantId ? { ...x, text: x.text + cleanText } : x))
          );
        }
      };

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          // Split SSE lines
          const lines = chunk
            .split(/\r?\n/)
            .map((l) => l.trimEnd())
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart());

          if (lines.length) {
            lines.forEach((dl) => processChunk(dl));
          } else {
            processChunk(chunk);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev: Message[]) =>
        prev.map((x: Message) =>
          x.id === assistantId ? { ...x, text: x.text + "\n\n*[System Error: Core Connection Lost]*" } : x
        )
      );
    } finally {
      setTyping(false);
    }
  };

  // --- SILENT DPO TELEMETRY LOGIC ---
  const handleFeedback = (payload: { messageId: string; prompt: string; response: string }) => {
    if (!sessionUrl) return;
    
    // Find the specific user prompt that caused this bad response
    const idx = messages.findIndex((m: Message) => m.id === payload.messageId);
    const originalPrompt = messages.slice(0, idx).reverse().find((m: Message) => m.role === "user")?.text || "Unknown Context";

    try {
      // Fire and forget (No awaits, no UI freezing)
      fetch(`${sessionUrl}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "bypass",
        },
        body: JSON.stringify({
          user_input: originalPrompt,
          rejected_response: payload.response,
          chosen_response: "", // Leaves it blank for your dataset
        }),
      });
    } catch (e) {
      console.error("DPO log failed silently", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      {/* Top Header */}
      <header
        className="h-16 shrink-0 flex flex-col justify-center px-8 z-10"
        style={{
          borderBottom: isDark
            ? "1px solid rgba(255,255,255,0.04)"
            : "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "20px",
            color: isDark ? "#E2E8F0" : "#1C1917",
            letterSpacing: "0.02em",
          }}
        >
          Whispers in the Dark
        </h2>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            color: isDark ? "#71717A" : "#A8A29E",
            letterSpacing: "0.05em",
            marginTop: "2px",
          }}
        >
          Status: <span className="capitalize">{mood} / {tone}</span>
        </p>
      </header>

      {/* Masked Void Scroll Feed */}
      <div
        className="flex-1 overflow-y-auto px-6 md:px-10 pt-6 pb-32 space-y-7 mask-void-scroll scrollbar-hide relative z-0"
        ref={feedRef}
        onScroll={handleScroll}
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <ChatMessage
                message={m}
                isDark={isDark}
                onFeedback={handleFeedback}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {typing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start pl-2"
          >
            <div className="flex items-center gap-1.5 py-3">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                  style={{ background: isDark ? "#E2E8F0" : "#1C1917" }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Return to present FAB */}
      <AnimatePresence>
        {!atBottom && pendingCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => scrollToBottom(true)}
            className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-2xl"
            style={{
              bottom: "110px",
              background: isDark ? "rgba(20,20,20,0.8)" : "rgba(255,255,255,0.85)",
              backdropFilter: "blur(20px)",
              border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
              color: isDark ? "#E2E8F0" : "#1C1917",
              fontFamily: "'Inter', sans-serif",
              fontSize: "11.5px",
            }}
          >
            <ArrowDown size={14} />
            {pendingCount} New Message{pendingCount > 1 ? "s" : ""}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input Dock */}
      <div className="absolute bottom-8 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[680px] z-50">
        <CommandBar
          isDark={isDark}
          onSend={(text, image, voice) => handleSend(text, image, voice)}
          disabled={typing || !sessionUrl}
        />
      </div>
    </div>
  );
}