import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDown, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { CommandBar } from "./CommandBar";


interface ChatViewProps {
  isDark: boolean;
  mood: string;
  tone: string;
  sessionUrl: string | null;
  onImageInspectTrigger: (url: string) => void;
  messages: Message[];
  setMessages: (newMessages: Message[] | ((prev: Message[]) => Message[])) => void;
  activeConversationId: string | null;
  typing: boolean;
  setTyping: (t: boolean) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onPlayAudio?: (url: string) => void;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatView({
  isDark,
  mood,
  tone,
  sessionUrl,
  onImageInspectTrigger,
  messages,
  setMessages,
  activeConversationId,
  typing,
  setTyping,
  isSidebarOpen,
  onToggleSidebar,
  onPlayAudio,
}: ChatViewProps) {
  const messageIdRef = useRef<number>(Date.now());

  const messageTextBufferRef = useRef<Record<string, string>>({});
  const messageImageBufferRef = useRef<Record<string, string>>({});
  const bufferFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

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
      setPendingCount((p: number) => p + 1);
    }
  }, [messages, typing, atBottom]);

  // Reset buffers and typing state when active conversation switches
  useEffect(() => {
    messageTextBufferRef.current = {};
    messageImageBufferRef.current = {};
    setTyping(false);
    setPendingCount(0);
    setAtBottom(true);
    setTimeout(() => scrollToBottom(false), 50);
  }, [activeConversationId]);

  useEffect(() => {
    bufferFlushTimerRef.current = setInterval(() => {
      const textBuffer = { ...messageTextBufferRef.current };
      const imageBuffer = { ...messageImageBufferRef.current };
      if (!Object.keys(textBuffer).length && !Object.keys(imageBuffer).length) {
        return;
      }

      setMessages((prev) =>
        prev.map((msg) => {
          const updated = { ...msg };
          if (textBuffer[msg.id]) {
            updated.text = `${updated.text}${textBuffer[msg.id]}`;
          }
          if (imageBuffer[msg.id]) {
            updated.image = imageBuffer[msg.id];
            updated.imageLoading = false;
          }
          return updated;
        })
      );

      messageTextBufferRef.current = {};
      messageImageBufferRef.current = {};
    }, 200);

    return () => {
      if (bufferFlushTimerRef.current) {
        clearInterval(bufferFlushTimerRef.current);
      }
    };
  }, [activeConversationId]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAtBottom(isBottom);
    if (isBottom) setPendingCount(0);
  };

  const handleSend = async (text: string, image?: { url: string; name: string }, voice?: boolean) => {
    if (!sessionUrl || typing || !activeConversationId) return;
    if (!text.trim() && (!image)) return;

    const id = (messageIdRef.current++).toString();
    const assistantId = (messageIdRef.current++).toString();

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
      const fd = new FormData();
      fd.append("user_input", text);
      fd.append("target_model", "default");
      fd.append("voice_requested", voice ? "true" : "false");
      fd.append("conversation_id", activeConversationId || "");

      if (image) {
        const blob = await fetch(image.url).then(r => r.blob());
        fd.append("files", blob, image.name);
      }

      const token = localStorage.getItem("vices_tester_token") || "";

      const res = await fetch(`${sessionUrl}/chat`, {
        method: "POST",
        body: fd,
        headers: {
          "ngrok-skip-browser-warning": "bypass",
          "x-tester-token": token,
        },
      });

      if (!res.ok || !res.body) throw new Error("Chat core failure");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      const processChunk = (rawText: string) => {
        let cleanText = rawText;
        
        // Scan for selfie triggers to display pulsing tech-skeleton camera loading panel
        if (rawText.includes("TRIGGER_SELFIE")) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantId) {
                return { ...msg, imageLoading: true };
              }
              return msg;
            })
          );
        }
        
        const attachmentRegex = /\[SYSTEM_MEDIA_ATTACHMENT:\s*(file:\/\/[^\]]+)\]/g;
        let match;
        while ((match = attachmentRegex.exec(cleanText)) !== null) {
          const fileUrl = match[1].replace("file://", "");
          const imageUrl = `${sessionUrl}/images/${fileUrl}`;
          messageImageBufferRef.current[assistantId] = imageUrl;
          cleanText = cleanText.replace(match[0], "");
        }

        const audioRegex = /\[SYSTEM_AUDIO_ATTACHMENT:\s*(file:\/\/[^\]]+)\]/g;
        let audioMatch;
        while ((audioMatch = audioRegex.exec(cleanText)) !== null) {
          const fileUrl = audioMatch[1].replace("file://", "");
          const audioUrl = `${sessionUrl}/images/${fileUrl}`;
          if (onPlayAudio) {
            onPlayAudio(audioUrl);
          }
          cleanText = cleanText.replace(audioMatch[0], "");
        }
        
        if (cleanText) {
          messageTextBufferRef.current[assistantId] = (
            messageTextBufferRef.current[assistantId] || ""
          ) + cleanText;
        }
      };

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
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

      const buffered = {
        ...messageTextBufferRef.current,
        ...messageImageBufferRef.current,
      };
      if (Object.keys(buffered).length) {
        setMessages((prev) =>
          prev.map((msg) => {
            const updated = { ...msg };
            if (messageTextBufferRef.current[msg.id]) {
              updated.text = `${updated.text}${messageTextBufferRef.current[msg.id]}`;
            }
            if (messageImageBufferRef.current[msg.id]) {
              updated.image = messageImageBufferRef.current[msg.id];
              updated.imageLoading = false;
            }
            return updated;
          })
        );
        messageTextBufferRef.current = {};
        messageImageBufferRef.current = {};
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

  const handleFeedback = (payload: { messageId: string; prompt: string; response: string }) => {
    if (!sessionUrl) return;
    
    const idx = messages.findIndex((m: Message) => m.id === payload.messageId);
    const originalPrompt = messages.slice(0, idx).reverse().find((m: Message) => m.role === "user")?.text || "Unknown Context";

    try {
      fetch(`${sessionUrl}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "bypass",
        },
        body: JSON.stringify({
          user_input: originalPrompt,
          rejected_response: payload.response,
          chosen_response: "",
        }),
      });
    } catch (e) {
      console.error("DPO log failed silently", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header
        className="h-16 shrink-0 flex items-center justify-between px-8 z-10"
        style={{
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1 rounded-md transition-colors hover:bg-white/[0.04] active:bg-white/[0.08]"
            style={{
              color: isDark ? "#71717A" : "#8E8781",
              border: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.04)",
              background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
              cursor: "pointer",
            }}
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          <div className="flex flex-col justify-center">
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", color: isDark ? "#E2E8F0" : "#1C1917", letterSpacing: "0.02em" }}>
              Whispers in the Dark
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: isDark ? "#71717A" : "#A8A29E", letterSpacing: "0.05em", marginTop: "2px" }}>
              Status: <span className="capitalize">{mood} / {tone}</span>
            </p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2 pr-2">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: typing
                ? "linear-gradient(135deg, #38BDF8, #06B6D4)"
                : isDark ? "rgba(226,232,240,0.25)" : "rgba(28,25,23,0.2)",
              boxShadow: typing ? "0 0 8px rgba(56,189,248,0.5)" : "none",
              animation: typing ? "pulse 1.5s ease-in-out infinite" : "none",
              display: "inline-block",
            }}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-10 pt-6 pb-32 space-y-7 mask-void-scroll scrollbar-hide relative z-0" ref={feedRef} onScroll={handleScroll}>
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <ChatMessage message={m} isDark={isDark} onFeedback={handleFeedback} onPreviewImage={onImageInspectTrigger} />
            </motion.div>
          ))}
        </AnimatePresence>

        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start pl-2">
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

      <AnimatePresence>
        {!atBottom && pendingCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} onClick={() => scrollToBottom(true)}
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

      <div className="absolute bottom-8 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[680px] z-50">
        <CommandBar isDark={isDark} onSend={(text, image, voice) => handleSend(text, image, voice)} disabled={typing || !sessionUrl} />
      </div>
    </div>
  );
}