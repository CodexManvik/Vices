import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gatekeeper } from "./components/Gatekeeper";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { AdminDashboard } from "./components/AdminDashboard";
import { MoodGlow } from "./components/MoodGlow";
import ImageInspectWindow from "./components/ImageInspectWindow";
import { AIAvatar } from "./components/AIAvatar";
import { Message } from "./components/ChatMessage";
import { LocalSetup } from "./components/LocalSetup";
import { Loader2 } from "lucide-react";
import { PersonaSetup } from "./components/PersonaSetup";
import { PersonaConfig } from "./components/PersonaConfig";
import { SettingsPanel } from "./components/SettingsPanel";
import { MemoryBrowser } from "./components/MemoryBrowser";

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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  // Setup gate state and checking flag
  const [setupDone, setSetupDone] = useState(false);
  const [isCheckingHardware, setIsCheckingHardware] = useState(true);
  const [personaSetupDone, setPersonaSetupDone] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [activeCompanion, setActiveCompanion] = useState<any | null>(null);
  const [showPersonaConfig, setShowPersonaConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  // Hardware and model check on mount
  useEffect(() => {
    let active = true;
    const checkSetupState = async () => {
      try {
        const { detectGpu } = await import("./utils/gpuDetector");
        const { checkModelsExist } = await import("./utils/modelManager");

        const gpu = await detectGpu();
        const { anyFound } = await checkModelsExist();

        if (!active) return;

        if (!gpu.hasCapableGpu) {
          // No capable GPU — bypass setup entirely, use server mode
          localStorage.setItem("vices_setup_done", "1");
          localStorage.setItem("vices_mode", "server");
          setSetupDone(true);
        } else {
          // Has capable GPU.
          if (anyFound) {
            // Models found! We MUST show the "Model Found" screen.
            setSetupDone(false);
          } else {
            // No models found.
            const done = localStorage.getItem("vices_setup_done") === "1";
            const savedMode = localStorage.getItem("vices_mode") as "local" | "server" | null;
            if (done && savedMode === "server") {
              setSetupDone(true);
            } else {
              setSetupDone(false);
            }
          }
        }
      } catch (e) {
        console.error("Hardware scan failed, defaulting to server mode:", e);
        setSetupDone(true);
      } finally {
        if (active) {
          setIsCheckingHardware(false);
        }
      }
    };

    checkSetupState();
    return () => {
      active = false;
    };
  }, []);

  const handleSetupComplete = (mode: "local" | "server") => {
    setSetupDone(true);
    if (mode === "local") {
      setAuthorized(true);
      setSessionUrl("http://localhost:8000");
    } else {
      setAuthorized(false);
      setSessionUrl(null);
    }
  };

  // If local mode is active, automatically authorize the client interface
  useEffect(() => {
    if (setupDone && localStorage.getItem("vices_mode") === "local") {
      setAuthorized(true);
      setSessionUrl("http://localhost:8000");
    }
  }, [setupDone]);

  const checkPersonaState = async (url: string | null) => {
    if (!url) return;
    try {
      const baseUrl = url.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/personas`);
      if (res.ok) {
        const data = await res.json();
        const list = data.personas || [];
        setPersonas(list);
        const active = list.find((p: any) => p.id === data.active_id) || null;
        setActiveCompanion(active);
        if (active) {
          setPersonaSetupDone(true);
        } else {
          setPersonaSetupDone(false);
        }
      }
    } catch (e) {
      console.error("Failed to check persona status:", e);
    }
  };

  useEffect(() => {
    if (sessionUrl) {
      checkPersonaState(sessionUrl);
    }
  }, [sessionUrl]);

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

    if (sessionUrl === "local") {
      setStatus({
        chemistry: 100,
        mood: "warm",
        tone: "casual",
      });
      return;
    }

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
        const res = await fetch(statusUrl);
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

  if (isCheckingHardware) {
    return (
      <div
        className="w-full h-full min-h-screen flex items-center justify-center"
        style={{
          background: isDark ? "#060606" : "#FAFAF9",
          color: isDark ? "#E2E8F0" : "#1C1917",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 size={24} style={{ color: isDark ? "#52525B" : "#A8A29E" }} />
        </motion.div>
      </div>
    );
  }

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
          {!setupDone ? (
            <motion.div
              key="setup"
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.5 }}
              className="w-full h-full"
            >
              <LocalSetup isDark={isDark} onComplete={handleSetupComplete} />
            </motion.div>
          ) : !personaSetupDone ? (
            <motion.div
              key="persona-setup"
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.5 }}
              className="w-full h-full"
            >
              <PersonaSetup
                isDark={isDark}
                sessionUrl={sessionUrl}
                onComplete={() => {
                  if (sessionUrl) checkPersonaState(sessionUrl);
                }}
              />
            </motion.div>
          ) : showAdminPanel ? (
            <motion.div key="admin" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
              <AdminDashboard isDark={isDark} onBack={() => setShowAdminPanel(false)} sessionUrl={sessionUrl} />
            </motion.div>
          ) : !authorized ? (
            <motion.div key="gate" exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.6 }} className="w-full h-full">
              <Gatekeeper onAuthorized={handleAuthorized} isDark={isDark} />
            </motion.div>
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
                    activeCompanionName={activeCompanion?.name || "Rosia"}
                    onConfigurePersona={() => setShowPersonaConfig(true)}
                    onShowSettings={() => setShowSettings(true)}
                    onShowMemory={() => setShowMemory(true)}
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
                        {activeCompanion?.name || "Rosia"} Core
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

        {/* Configure Persona Management overlay */}
        {showPersonaConfig && (
          <PersonaConfig
            isDark={isDark}
            sessionUrl={sessionUrl}
            onClose={() => setShowPersonaConfig(false)}
            onActiveChanged={() => {
              if (sessionUrl) checkPersonaState(sessionUrl);
            }}
          />
        )}

        {/* Advanced Settings Config Panel overlay */}
        {showSettings && (
          <SettingsPanel
            isDark={isDark}
            sessionUrl={sessionUrl}
            onClose={() => setShowSettings(false)}
            conversations={conversations}
          />
        )}

        {/* Memory Diagnostics Browser overlay */}
        {showMemory && (
          <MemoryBrowser
            isDark={isDark}
            sessionUrl={sessionUrl}
            onClose={() => setShowMemory(false)}
          />
        )}
      </div>
    </div>
  );
}