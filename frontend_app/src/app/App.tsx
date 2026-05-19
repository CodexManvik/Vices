import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gatekeeper } from "./components/Gatekeeper";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { WindowChrome } from "./components/WindowChrome";
import { MoodGlow } from "./components/MoodGlow";

export default function App() {
  const [authorized, setAuthorized] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real status state
  const [status, setStatus] = useState({ chemistry: 50, mood: "neutral", tone: "casual" });

  // Poll the backend for live emotional status
  useEffect(() => {
    if (!sessionUrl) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${sessionUrl}/status`, {
          headers: { "ngrok-skip-browser-warning": "bypass" }
        });
        if (res.ok) {
          const data = await res.json();
          setStatus({
            chemistry: data.chemistry || 50,
            mood: data.mood || "neutral",
            tone: data.tone || "casual"
          });
        }
      } catch (e) {
        console.error("Failed to fetch status:", e);
      }
    };

    // Fetch immediately, then every 10 seconds
    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    
    return () => clearInterval(id);
  }, [sessionUrl]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };
  }, []);

  const handleAuthorized = (url: string) => {
    setSessionUrl(url);
    // Clear any existing timeout first
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
    }
    // Smooth delay before dropping the lock screen for dramatic effect
    authTimeoutRef.current = setTimeout(() => setAuthorized(true), 600);
  };

  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col transition-colors duration-500"
      style={{
        background: isDark ? "#0A0A0A" : "#F5F5F4",
        color: isDark ? "#E2E8F0" : "#1C1917",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Ambient mood tint behind everything */}
      <MoodGlow mood={status.mood} isDark={isDark} />

      {/* Native frameless window chrome */}
      <WindowChrome isDark={isDark} />

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
          ) : (
            <motion.div
              key="app"
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="w-full h-full flex"
            >
              <Sidebar
                isDark={isDark}
                toggleTheme={() => setIsDark((v) => !v)}
                chemistry={status.chemistry}
                mood={status.mood}
              />
              <ChatView
                isDark={isDark}
                mood={status.mood}
                tone={status.tone}
                sessionUrl={sessionUrl}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}