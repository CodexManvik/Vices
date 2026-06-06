import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gatekeeper } from "./components/Gatekeeper";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { AccessRequest } from "./components/AccessRequest";
import { AdminDashboard } from "./components/AdminDashboard";
import { MoodGlow } from "./components/MoodGlow";
import ImageInspectWindow from "./components/ImageInspectWindow";
import { AIAvatar } from "./components/AIAvatar";
import { Message } from "./components/ChatMessage";

export interface Conversation {
  id: string;
  title: string;
  time: string;
  messages: Message[];
}

const DEFAULT_CONVERSATIONS: Conversation[] = [
  { id: "1", title: "Late night thoughts", time: "Now", messages: [] },
  { id: "2", title: "Weekend in Lisbon", time: "Yesterday", messages: [] },
  { id: "3", title: "On reading Borges", time: "Mon", messages: [] },
  { id: "4", title: "First handshake", time: "May 12", messages: [] },
];

const MOOD_COLORS: Record<string, string> = {
  neutral: "#38BDF8",        // radiant cyan
  affectionate: "#F472B6",   // rose pink
  warm: "#F59E0B",           // warm amber
  happy: "#FBBF24",          // sunny gold
  excited: "#EC4899",        // hot pink
  playful: "#EF4444",        // crimson red
  aroused: "#DC2626",        // deep ruby red
  sleepy: "#A78BFA",         // lavender
  cozy: "#FDBA74",           // soft peach
  angry: "#F43F5E",          // glowing rose red
  jealous: "#10B981",        // emerald green
  annoyed: "#C084FC",        // royal violet
  sad: "#3B82F6",            // deep sapphire blue
  bored: "#6B7280",          // slate gray
  analytical: "#22D3EE",     // electric cyan
  cold: "#93C5FD",           // icy blue
};

export default function App() {
  const [authorized, setAuthorized] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [brokerUrl, setBrokerUrl] = useState<string>("");
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  const [status, setStatus] = useState({ chemistry: 50, mood: "neutral", tone: "casual" });
  const [typing, setTyping] = useState(false);

  // Web Audio API Speech Lip-Sync State & References
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSpeechAudio = (url: string) => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      setAudioAnalyser(analyser);
      setTyping(true);

      audio.play().catch(err => {
        console.error("[Audio Sync] Playback rejected by browser policy:", err);
      });

      audio.onended = () => {
        setTyping(false);
        setAudioAnalyser(null);
      };
      audio.onpause = () => {
        setTyping(false);
        setAudioAnalyser(null);
      };
    } catch (err) {
      console.error("[Audio Sync] Error during Web Audio graph creation:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Conversations State with localStorage persistence
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem("vices_conversations");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved conversations", e);
      }
    }
    return DEFAULT_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    const saved = localStorage.getItem("vices_active_conv_id");
    return saved || "1";
  });

  useEffect(() => {
    localStorage.setItem("vices_conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem("vices_active_conv_id", activeConversationId);
    } else {
      localStorage.removeItem("vices_active_conv_id");
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (!sessionUrl) return;

    const baseUrl = sessionUrl.replace(/\/+$/, "");
    const statusUrl = `${baseUrl}/status`;
    const statusStreamUrl = `${baseUrl}/status/stream`;
    let eventSource: EventSource | null = null;

    const updateStatus = (data: any) => {
      setStatus({
        chemistry: data.chemistry || 50,
        mood: data.mood || "neutral",
        tone: data.tone || "casual",
      });
    };

    const fetchStatus = async () => {
      try {
        const res = await fetch(statusUrl, {
          headers: { "ngrok-skip-browser-warning": "bypass" },
        });
        if (res.ok) {
          const data = await res.json();
          updateStatus(data);
        }
      } catch (e) {
        console.error("Failed to fetch status:", e);
      }
    };

    fetchStatus();

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource(statusStreamUrl);
      eventSource.onmessage = (event) => {
        try {
          updateStatus(JSON.parse(event.data));
        } catch (error) {
          console.error("Invalid status stream message:", error);
        }
      };
      eventSource.onerror = (error) => {
        console.error("Status stream error:", error);
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [sessionUrl]);

  useEffect(() => {
    return () => {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };
  }, []);

  // Admin panel toggle with keyboard shortcut (Ctrl+Shift+M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setShowAdminPanel((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAuthorized = (url: string) => {
    setSessionUrl(url);
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
    }
    authTimeoutRef.current = setTimeout(() => setAuthorized(true), 600);
  };

  const handleNewConversation = () => {
    const newId = Date.now().toString();
    const newConv: Conversation = {
      id: newId,
      title: "New conversation",
      time: "Now",
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (activeConversationId === id) {
        setActiveConversationId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const updateActiveConversationMessages = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    if (!activeConversationId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversationId) {
          const updatedMsgs = typeof newMessages === "function" ? newMessages(c.messages) : newMessages;
          
          let newTitle = c.title;
          if (c.title === "New conversation" || c.title === "") {
            const firstUserMsg = updatedMsgs.find((m) => m.role === "user");
            if (firstUserMsg && firstUserMsg.text) {
              newTitle = firstUserMsg.text.slice(0, 24) + (firstUserMsg.text.length > 24 ? "..." : "");
            }
          }

          return {
            ...c,
            title: newTitle,
            messages: updatedMsgs,
            time: "Now",
          };
        }
        return c;
      })
    );
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Curated mood colors for the intimate view text accent
  const currentMoodColor = MOOD_COLORS[status.mood?.toLowerCase()] || "#38BDF8";

  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col transition-colors duration-500"
      style={{
        background: isDark ? "#060606" : "#FAFAF9",
        color: isDark ? "#E2E8F0" : "#1C1917",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="flex-1 relative min-h-0">
        <AnimatePresence mode="wait">
          {showAdminPanel ? (
            <motion.div key="admin" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
              <AdminDashboard isDark={isDark} onBack={() => setShowAdminPanel(false)} sessionUrl={sessionUrl} />
            </motion.div>
          ) : !authorized ? (
            showAccessRequest ? (
              <motion.div key="access-request" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
                <AccessRequest isDark={isDark} onBack={() => setShowAccessRequest(false)} brokerUrl={brokerUrl} />
              </motion.div>
            ) : (
              <motion.div key="gate" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
                <Gatekeeper onAuthorized={handleAuthorized} onRequestAccess={() => setShowAccessRequest(true)} onBrokerUrlSet={(url) => setBrokerUrl(url)} isDark={isDark} />
              </motion.div>
            )
          ) : (
            <motion.div key="app" initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} className="w-full h-full flex">
              {isSidebarOpen ? (
                <div className="h-full overflow-hidden shrink-0 flex w-[260px]">
                  <Sidebar
                    isDark={isDark}
                    toggleTheme={() => setIsDark((v) => !v)}
                    chemistry={status.chemistry}
                    mood={status.mood}
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onSelectConversation={setActiveConversationId}
                    onNewConversation={handleNewConversation}
                    onDeleteConversation={handleDeleteConversation}
                    typing={typing}
                    audioAnalyser={audioAnalyser}
                  />
                </div>
              ) : (
                <div
                  className="h-full shrink-0 flex flex-col items-center justify-center relative px-6 select-none overflow-hidden w-[380px]"
                  style={{
                    background: isDark ? "#080808" : "#F4F4F3",
                    borderRight: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  {/* Glassmorphism Intimate Avatar Card */}
                  <div
                    className="flex flex-col items-center gap-6 p-6 rounded-2xl w-full max-w-sm"
                    style={{
                      background: isDark ? "rgba(255, 255, 255, 0.012)" : "rgba(0, 0, 0, 0.015)",
                      backdropFilter: "blur(20px)",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.04)" : "1px solid rgba(0, 0, 0, 0.04)",
                      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.35)",
                    }}
                  >
                    <div className="relative my-2">
                      <AIAvatar mood={status.mood} typing={typing} size={280} audioAnalyser={audioAnalyser} />
                    </div>

                    <div className="text-center w-full mt-2">
                      <h3
                        style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: "23px",
                          fontWeight: 500,
                          letterSpacing: "0.14em",
                          color: isDark ? "#E2E8F0" : "#1C1917",
                        }}
                      >
                        Rosia Core
                      </h3>
                      <p
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: isDark ? "#71717A" : "#8E8781",
                          marginTop: "6px",
                        }}
                      >
                        Core State: <span className="font-semibold" style={{ color: currentMoodColor }}>{status.mood}</span>
                      </p>
                      
                      {/* Immersive Chemistry connection meter */}
                      <div className="mt-7 flex flex-col gap-2">
                        <div className="flex justify-between text-[11px]" style={{ color: isDark ? "#71717A" : "#8E8781" }}>
                          <span>Dynamic Chemistry</span>
                          <span className="font-semibold" style={{ color: isDark ? "#E2E8F0" : "#1C1917" }}>{status.chemistry}%</span>
                        </div>
                        <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${status.chemistry}%`,
                              background: isDark
                                ? "linear-gradient(90deg, rgba(226,232,240,0.3), #E2E8F0)"
                                : "linear-gradient(90deg, rgba(28,25,23,0.3), #1C1917)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ChatView
                isDark={isDark}
                mood={status.mood}
                tone={status.tone}
                sessionUrl={sessionUrl}
                onImageInspectTrigger={(url) => setActivePreviewImage(url)}
                messages={activeConversation?.messages || []}
                setMessages={updateActiveConversationMessages}
                activeConversationId={activeConversationId}
                typing={typing}
                setTyping={setTyping}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
                onPlayAudio={playSpeechAudio}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Sub Window Inspection Canvas Overlay */}
        {activePreviewImage && (
          <ImageInspectWindow imageUrl={activePreviewImage} onClose={() => setActivePreviewImage(null)} />
        )}
      </div>
    </div>
  );
}