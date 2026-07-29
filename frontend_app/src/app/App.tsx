import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gatekeeper } from "./components/Gatekeeper";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { AdminDashboard } from "./components/AdminDashboard";
import ImageInspectWindow from "./components/ImageInspectWindow";
import { Message } from "./components/ChatMessage";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { PersonaSetup } from "./components/PersonaSetup";
import { PersonaConfig } from "./components/PersonaConfig";
import { SettingsPanel } from "./components/SettingsPanel";
import { MemoryBrowser } from "./components/MemoryBrowser";
import { Toast } from "./components/ui/Toast";
import { useMotionPreference } from "./utils/useMotionPreference";
import { useTheme } from "./utils/useTheme";

export interface Conversation {
  id: string;
  title: string;
  time: string;
  messages: Message[];
}

const DEFAULT_CONVERSATIONS: Conversation[] = [
  { id: "1", title: "New conversation", time: "Now", messages: [] },
];

export default function App() {
  // Honours the OS reduced-motion setting; tells the user once, with an override.
  const motionPref = useMotionPreference();

  const [authorized, setAuthorized] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  // Flow states
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem("aethel_onboarding_done") !== "true"
  );
  const [showPersonaBuilder, setShowPersonaBuilder] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [activeCompanion, setActiveCompanion] = useState<any | null>(null);
  const [showPersonaConfig, setShowPersonaConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

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

  const [status, setStatus] = useState({ toneEnabled: false, mood: "neutral", tone: "casual" });
  const [typing, setTyping] = useState(false);

  // Voice reply playback (TTS audio from the backend)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSpeechAudio = (url: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      setTyping(true);
      audio.play().catch((err) => {
        console.error("[Audio] Playback rejected:", err);
        setTyping(false);
      });
      audio.onended = () => setTyping(false);
      audio.onpause = () => setTyping(false);
    } catch (err) {
      console.error("[Audio] Playback error:", err);
      setTyping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Conversations state with localStorage persistence
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem("aethel_conversations");
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
    const saved = localStorage.getItem("aethel_active_conv_id");
    return saved || "1";
  });

  useEffect(() => {
    localStorage.setItem("aethel_conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem("aethel_active_conv_id", activeConversationId);
    } else {
      localStorage.removeItem("aethel_active_conv_id");
    }
  }, [activeConversationId]);

  // Live affective status from the backend
  useEffect(() => {
    if (!sessionUrl) return;

    if (sessionUrl === "local") {
      setStatus({ toneEnabled: false, mood: "neutral", tone: "casual" });
      return;
    }

    const baseUrl = sessionUrl.replace(/\/+$/, "");
    let eventSource: EventSource | null = null;

    const updateStatus = (data: any) => {
      setStatus({
        toneEnabled: !!data.tone_enabled,
        mood: data.mood || "neutral",
        tone: data.tone || "casual",
      });
    };

    fetch(`${baseUrl}/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && updateStatus(data))
      .catch((e) => console.error("Failed to fetch status:", e));

    if (typeof EventSource !== "undefined") {
      eventSource = new EventSource(`${baseUrl}/status/stream`);
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
      if (eventSource) eventSource.close();
    };
  }, [sessionUrl]);

  useEffect(() => {
    return () => {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, []);

  // Admin panel toggle (Ctrl+Shift+M)
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
    checkPersonaState(url);
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
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

  const updateActiveConversationMessages = (
    newMessages: Message[] | ((prev: Message[]) => Message[])
  ) => {
    if (!activeConversationId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversationId) {
          const updatedMsgs =
            typeof newMessages === "function" ? newMessages(c.messages) : newMessages;

          let newTitle = c.title;
          if (c.title === "New conversation" || c.title === "") {
            const firstUserMsg = updatedMsgs.find((m) => m.role === "user");
            if (firstUserMsg && firstUserMsg.text) {
              newTitle =
                firstUserMsg.text.slice(0, 24) + (firstUserMsg.text.length > 24 ? "..." : "");
            }
          }

          return { ...c, title: newTitle, messages: updatedMsgs, time: "Now" };
        }
        return c;
      })
    );
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col transition-colors duration-300"
      style={{
        background: "var(--v-bg)",
        color: "var(--v-text)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="flex-1 relative min-h-0">
        <AnimatePresence mode="wait">
          {!authorized ? (
            <motion.div
              key="gate"
              exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              transition={{ duration: 0.6 }}
              className="w-full h-full"
            >
              <Gatekeeper onAuthorized={handleAuthorized} isDark={isDark} />
            </motion.div>
          ) : showOnboarding ? (
            <OnboardingWizard
              isDark={isDark}
              sessionUrl={sessionUrl}
              onComplete={() => {
                setShowOnboarding(false);
                if (sessionUrl) checkPersonaState(sessionUrl);
              }}
              onTriggerCustomBuild={() => {
                setShowOnboarding(false);
                setShowPersonaBuilder(true);
              }}
            />
          ) : showPersonaBuilder ? (
            <motion.div
              key="persona-builder"
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.5 }}
              className="w-full h-full"
            >
              <PersonaSetup
                isDark={isDark}
                sessionUrl={sessionUrl}
                onComplete={() => {
                  setShowPersonaBuilder(false);
                  if (sessionUrl) checkPersonaState(sessionUrl);
                }}
              />
            </motion.div>
          ) : showAdminPanel ? (
            <motion.div
              key="admin"
              exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              transition={{ duration: 0.6 }}
              className="w-full h-full"
            >
              <AdminDashboard
                isDark={isDark}
                onBack={() => setShowAdminPanel(false)}
                sessionUrl={sessionUrl}
              />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full h-full flex"
            >
              <AnimatePresence initial={false}>
                {isSidebarOpen && (
                  <motion.div
                    key="sidebar"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 268, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="h-full overflow-hidden shrink-0"
                  >
                    <Sidebar
                      isDark={isDark}
                      toggleTheme={toggleTheme}
                      toneEnabled={status.toneEnabled}
                      mood={status.mood}
                      conversations={conversations}
                      activeConversationId={activeConversationId}
                      onSelectConversation={setActiveConversationId}
                      onNewConversation={handleNewConversation}
                      onDeleteConversation={handleDeleteConversation}
                      typing={typing}
                      activeCompanionName={activeCompanion?.name || "Rosia"}
                      onConfigurePersona={() => setShowPersonaConfig(true)}
                      onShowSettings={() => setShowSettings(true)}
                      onShowMemory={() => setShowMemory(true)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

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
                onShowSettings={() => setShowSettings(true)}
                onShowMemory={() => setShowMemory(true)}
                activeCompanionName={activeCompanion?.name || "Rosia"}
                toneEnabled={status.toneEnabled}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating image inspection overlay */}
        {activePreviewImage && (
          <ImageInspectWindow
            imageUrl={activePreviewImage}
            onClose={() => setActivePreviewImage(null)}
          />
        )}

        {/* Persona management overlay */}
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

        {/* Settings overlay */}
        {showSettings && (
          <SettingsPanel
            isDark={isDark}
            sessionUrl={sessionUrl}
            onClose={() => setShowSettings(false)}
            conversations={conversations}
          />
        )}

        {/* Memory browser overlay */}
        {showMemory && (
          <MemoryBrowser
            isDark={isDark}
            sessionUrl={sessionUrl}
            onClose={() => setShowMemory(false)}
          />
        )}

        {/* One-time notice when the OS asks for reduced motion */}
        <Toast
          open={motionPref.showNotice}
          message="Animations are minimised to match your system's reduced-motion setting."
          actionLabel="Enable anyway"
          onAction={motionPref.enableAnyway}
          onDismiss={motionPref.dismissNotice}
        />
      </div>
    </div>
  );
}
