import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDown,
  PanelLeftClose,
  PanelLeftOpen,
  Terminal,
  Database,
  SlidersHorizontal,
  Folder,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { PromptBox } from "./PromptBox";
import { cleanClientShorthand } from "../utils/textCleaner";
import { extractUrls, fetchUrlContent } from "../utils/urlFetcher";

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
  onShowSettings?: () => void;
  onShowMemory?: () => void;
  toneEnabled?: boolean;
  activeCompanionName?: string;
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
  onShowSettings,
  onShowMemory,
  toneEnabled = false,
  activeCompanionName = "Rosia",
}: ChatViewProps) {
  const messageIdRef = useRef<number>(Date.now());

  const messageTextBufferRef = useRef<Record<string, string>>({});
  const messageImageBufferRef = useRef<Record<string, string>>({});
  const bufferFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // Codex Terminal Drawer State
  const [showTerminalDrawer, setShowTerminalDrawer] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "[SYSTEM] Vices Agent Kernel initialised.",
    "[MEMORY] Turbovec vector index & LanceDB graph loaded.",
    "[COGNITIVE CORE] ONNX emotion engine active on CPU.",
  ]);

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
    }, 16);

    return () => {
      if (bufferFlushTimerRef.current) clearInterval(bufferFlushTimerRef.current);
    };
  }, [setMessages]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isEnd = scrollHeight - (scrollTop + clientHeight) < 60;
    setAtBottom(isEnd);
    if (isEnd) setPendingCount(0);
  };

  const addTerminalLog = (log: string) => {
    setTerminalLogs((prev) => [...prev.slice(-100), `[${nowTime()}] ${log}`]);
  };

  const handleSendMessage = async (
    text: string,
    image?: { url: string; name: string },
    opts?: { voice?: boolean; search?: boolean; tools?: boolean },
  ) => {
    const voice = opts?.voice;
    if ((!text || !text.trim()) && !image) return;

    const userMessageId = `usr_${++messageIdRef.current}`;
    const userMsg: Message = {
      id: userMessageId,
      role: "user",
      text: text.trim(),
      image: image?.url,
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    addTerminalLog(`USER -> ${text.slice(0, 40)}...`);

    const rosiaMsgId = `ros_${++messageIdRef.current}`;
    const rosiaMsgPlaceholder: Message = {
      id: rosiaMsgId,
      role: "rosia",
      text: "",
      time: nowTime(),
    };

    setMessages((prev) => [...prev, rosiaMsgPlaceholder]);

    // Handle URL extraction & fetching
    const urls = extractUrls(text);
    let webContext = "";
    if (urls.length > 0) {
      addTerminalLog(`[WEB] Extracting page context from ${urls[0]}...`);
      const fetched = await fetchUrlContent(urls[0]);
      webContext = fetched || "";
    }

    const effectiveText = webContext
      ? `${text.trim()}\n\n[Web Context from ${urls[0]}]:\n${webContext}`
      : text.trim();

    try {
      if (!sessionUrl) {
        throw new Error("No backend server URL available.");
      }

      const fd = new FormData();
      fd.append("user_input", effectiveText);
      fd.append("target_model", "default");
      fd.append("voice_requested", voice ? "true" : "false");
      fd.append(
        "client_history",
        JSON.stringify(
          messages.map((m) => ({
            role: (m.role as string) === "user" || (m.role as string) === "usr" ? "user" : "assistant",
            content: m.text,
          }))
        )
      );

      const res = await fetch(`${sessionUrl.replace(/\/+$/, "")}/chat`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      let accumulated = "";
      let pendingShown = false;
      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: isDone } = await reader.read();
          done = isDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            accumulated += chunk;

            // As soon as image generation starts, flip the message into the
            // animated "generating" card — don't wait for the stream to end.
            if (!pendingShown && accumulated.includes("[SYSTEM_MEDIA_PENDING]")) {
              pendingShown = true;
              setMessages((prev) =>
                prev.map((m) => (m.id === rosiaMsgId ? { ...m, imageLoading: true } : m))
              );
            }

            // Buffer only the user-visible text, never the control markers.
            const cleanChunk = chunk
              .replace(/\ndata:\s*\[SYSTEM_MEDIA_PENDING\]\n?/g, "")
              .replace(/\[SYSTEM_MEDIA_PENDING\]/g, "");
            messageTextBufferRef.current[rosiaMsgId] =
              (messageTextBufferRef.current[rosiaMsgId] || "") + cleanChunk;
          }
        }
      }

      // ── Post-process attachments the backend embeds in the stream ──
      // Selfie:  [SYSTEM_MEDIA_ATTACHMENT: file://<name>]  -> message.image
      // Voice:   [SYSTEM_AUDIO_ATTACHMENT: file://<name>]  -> play TTS audio
      // Failure: [SYSTEM_MEDIA_FAILED]                     -> clear the card
      const baseUrl = sessionUrl.replace(/\/+$/, "");
      const mediaMatch = /\[SYSTEM_MEDIA_ATTACHMENT:\s*file:\/\/([^\]\s]+)\]/.exec(accumulated);
      const audioMatch = /\[SYSTEM_AUDIO_ATTACHMENT:\s*file:\/\/([^\]\s]+)\]/.exec(accumulated);
      const mediaFailed = accumulated.includes("[SYSTEM_MEDIA_FAILED]");

      if (mediaMatch || audioMatch || mediaFailed || pendingShown) {
        // Cancel any pending buffered writes for this message and finalize
        // its text with all control markers stripped out.
        delete messageTextBufferRef.current[rosiaMsgId];
        let cleanedText = accumulated
          .replace(/\ndata:\s*\[SYSTEM_(MEDIA|AUDIO)_(ATTACHMENT:[^\]]*|PENDING|FAILED)\]\n?/g, "")
          .replace(/\[SYSTEM_(MEDIA|AUDIO)_(ATTACHMENT:[^\]]*|PENDING|FAILED)\]/g, "")
          .trim();
        if (mediaFailed) {
          cleanedText += (cleanedText ? "\n\n" : "") + "*(couldn't generate the picture this time)*";
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === rosiaMsgId
              ? {
                  ...m,
                  text: cleanedText,
                  image: mediaMatch ? `${baseUrl}/images/${mediaMatch[1]}` : m.image,
                  imageLoading: false,
                }
              : m
          )
        );
        if (mediaMatch) addTerminalLog(`[MEDIA] Selfie attached: ${mediaMatch[1]}`);
        if (mediaFailed) addTerminalLog(`[MEDIA] Image generation failed.`);
        if (audioMatch && onPlayAudio) {
          addTerminalLog(`[VOICE] Playing TTS reply: ${audioMatch[1]}`);
          onPlayAudio(`${baseUrl}/images/${audioMatch[1]}`);
        }
      }
      addTerminalLog(`AGENT -> Response completed.`);
    } catch (e: any) {
      console.error("Chat request failed:", e);
      addTerminalLog(`[ERROR] Chat stream failed: ${e?.message || e}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === rosiaMsgId
            ? { ...m, text: "I encountered a local network issue communicating with the AI kernel." }
            : m
        )
      );
    } finally {
      setTyping(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full relative overflow-hidden select-none"
      style={{
        background: "var(--v-bg)",
        color: "var(--v-text)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Header Toolbar ── */}
      <div
        className="px-5 py-3 flex items-center justify-between border-b shrink-0 z-10"
        style={{
          background: "var(--v-bg-elev)",
          borderColor: "var(--v-border)",
        }}
      >
        {/* Left Side: Sidebar Toggle & Companion Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
            style={{ color: "var(--v-text-muted)" }}
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          <div className="h-4 w-[1px]" style={{ background: "var(--v-border)" }} />

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{activeCompanionName}</span>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase"
              style={{
                background: "var(--v-accent-soft)",
                color: "var(--v-accent)",
              }}
            >
              Active Agent
            </span>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {onShowMemory && (
            <button
              onClick={onShowMemory}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer hover:bg-[var(--v-surface-2)]"
              style={{
                border: "1px solid var(--v-border)",
                color: "var(--v-text-muted)",
              }}
            >
              <Database size={13} />
              <span className="hidden sm:inline">Memory</span>
            </button>
          )}

          <button
            onClick={() => setShowTerminalDrawer(!showTerminalDrawer)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer hover:bg-[var(--v-surface-2)]"
            style={{
              border: showTerminalDrawer ? "1px solid var(--v-accent)" : "1px solid var(--v-border)",
              color: showTerminalDrawer ? "var(--v-accent)" : "var(--v-text-muted)",
              background: showTerminalDrawer ? "var(--v-accent-soft)" : "transparent",
            }}
          >
            <Terminal size={13} />
            <span className="hidden sm:inline">Activity</span>
          </button>

          {onShowSettings && (
            <button
              onClick={onShowSettings}
              className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[var(--v-surface-2)]"
              style={{ color: "var(--v-text-muted)" }}
              title="Settings"
            >
              <SlidersHorizontal size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Chat Feed Scroll Container ── */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-12 md:px-24 py-6"
      >
        <div className="max-w-4xl mx-auto flex flex-col">
          {messages.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-center gap-3 select-none">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2"
                style={{ background: "var(--v-accent-soft)", color: "var(--v-accent)" }}
              >
                <Sparkles size={24} />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                How can {activeCompanionName} help you today?
              </h2>
              <p className="text-xs max-w-sm leading-relaxed" style={{ color: "var(--v-text-muted)" }}>
                Local-first AI workspace &amp; companion. Ask questions, run tasks on your files,
                use the mic to talk — everything stays on this machine.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const prevUserMsg = messages
                .slice(0, index)
                .reverse()
                .find((m) => m.role === "user")?.text;

              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  previousUserPrompt={prevUserMsg}
                  isDark={isDark}
                  onPreviewImage={onImageInspectTrigger}
                  onDelete={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Scroll to bottom floating badge */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-24 right-8 p-2.5 rounded-full shadow-lg border backdrop-blur-md flex items-center gap-2 text-xs font-medium z-20"
            style={{
              background: isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.9)",
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              color: isDark ? "#F8FAFC" : "#0F172A",
            }}
          >
            <ArrowDown size={14} className="text-sky-400" />
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-500 text-white font-semibold">
                {pendingCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Collapsible Terminal Drawer ── */}
      <AnimatePresence>
        {showTerminalDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 180, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t shrink-0 flex flex-col font-mono text-xs overflow-hidden"
            style={{
              background: isDark ? "#060A12" : "#0F172A",
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
              color: "#38BDF8",
            }}
          >
            <div className="px-4 py-2 bg-slate-950 flex items-center justify-between border-b border-slate-800 text-[11px] text-slate-400 select-none">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-sky-400" />
                <span>VICES KERNEL LOGS</span>
              </div>
              <button
                onClick={() => setShowTerminalDrawer(false)}
                className="hover:text-white transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-1 text-[11.5px] leading-relaxed">
              {terminalLogs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap font-mono">
                  {log}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom Input Command Bar ── */}
      <div className="p-4 sm:px-12 md:px-24 shrink-0">
        <div className="max-w-4xl mx-auto">
          <PromptBox
            onSend={handleSendMessage}
            disabled={typing}
            sessionUrl={sessionUrl}
            placeholder={`Message ${activeCompanionName}…`}
            tone={mood}
            toneEnabled={toneEnabled}
          />
        </div>
      </div>
    </div>
  );
}